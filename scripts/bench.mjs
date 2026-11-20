import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PROCESS_START_MS = performance.now();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm'
};

function parseArgs(argv) {
  const args = { seed: 42, duration: 30, out: 'bench.json' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--seed':
        if (next === undefined) throw new Error('Missing value for --seed');
        args.seed = Number(next);
        i++;
        break;
      case '--duration':
        if (next === undefined) throw new Error('Missing value for --duration');
        args.duration = Number(next);
        i++;
        break;
      case '--out':
        if (next === undefined) throw new Error('Missing value for --out');
        args.out = next;
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!Number.isInteger(args.seed)) throw new Error('--seed must be an integer');
  if (!Number.isFinite(args.duration) || args.duration <= 0) throw new Error('--duration must be > 0');
  if (!args.out) throw new Error('--out is required');
  return args;
}

function findBrowserExecutable() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/usr/bin/microsoft-edge'
          ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function sampleProcessRssMbAsync(rootPid, cb) {
  if (!rootPid) return cb(null);
  if (process.platform === 'win32') {
    // Lightweight async tasklist query (no heavy WMI/PowerShell CPU spike during FPS measurement)
    execFile('tasklist', ['/FI', `PID eq ${rootPid}`, '/FO', 'CSV', '/NH'], { timeout: 2000 }, (err, stdout) => {
      if (err || !stdout) return cb(null);
      const match = stdout.match(/"([\d,]+)\s*K"/i);
      if (!match) return cb(null);
      const kb = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(kb) && kb > 0) return cb(Math.round((kb / 1024) * 10) / 10);
      return cb(null);
    });
    return;
  }
  execFile('ps', ['-o', 'rss=', '-p', String(rootPid)], { timeout: 1500 }, (err, stdout) => {
    if (err || !stdout) return cb(null);
    const kb = Number(stdout.trim());
    if (Number.isFinite(kb) && kb > 0) return cb(Math.round((kb / 1024) * 10) / 10);
    return cb(null);
  });
}

function killBrowser(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  } catch {}
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    throw new Error('dist/index.html not found. Run "npm run build" before running benchmark.');
  }

  const browserBin = findBrowserExecutable();
  if (!browserBin) {
    throw new Error('No Chromium/Chrome/Edge browser found. Set CHROME_BIN to your browser executable.');
  }

  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
  let loadMs = null;
  let peakMemMb = null;
  let browserChild = null;
  let memTimer = null;

  const resultPromise = new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(urlObj.pathname);

      if (pathname === '/__bench_ready' && req.method === 'POST') {
        if (loadMs === null) {
          loadMs = Math.round(performance.now() - PROCESS_START_MS);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        return;
      }

      if (pathname === '/__bench_result' && req.method === 'POST') {
        try {
          const payload = await readJsonBody(req);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          resolve({ server, payload });
        } catch (err) {
          res.writeHead(400);
          res.end('Bad Request');
          reject(err);
        }
        return;
      }

      let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
      if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, 'index.html');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const url = `http://127.0.0.1:${addr.port}/?bench=1&seed=${args.seed}&duration=${args.duration}`;
      const browserArgs = [
        `--app=${url}`,
        '--window-size=1280,720',
        '--window-position=80,60',
        '--disable-gpu-vsync',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=CalculateNativeWinOcclusion',
        '--autoplay-policy=no-user-gesture-required',
        `--user-data-dir=${tmpProfile}`
      ];

      browserChild = spawn(browserBin, browserArgs, { stdio: 'ignore' });
      browserChild.on('error', (err) => reject(err));

      // Sample RSS once during warmup (before measurement starts) so no external
      // subprocess spawns interfere with frame pacing during the measurement window.
      memTimer = setTimeout(() => {
        sampleProcessRssMbAsync(browserChild?.pid, (mb) => {
          if (mb !== null && (peakMemMb === null || mb > peakMemMb)) {
            peakMemMb = mb;
          }
        });
      }, 2200);

      // Safety timeout: warmup (3s) + duration + 30s margin
      const timeoutMs = (args.duration + 33) * 1000;
      setTimeout(() => {
        reject(new Error(`Benchmark timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs).unref();
    });
  });

  try {
    const { server, payload } = await resultPromise;
    if (memTimer) clearTimeout(memTimer);
    // Final RSS sample right after measurement completes (before killing browser)
    await new Promise((res) => {
      sampleProcessRssMbAsync(browserChild?.pid, (mb) => {
        if (mb !== null && (peakMemMb === null || mb > peakMemMb)) {
          peakMemMb = mb;
        }
        res();
      });
    });
    killBrowser(browserChild);
    server.close();

    const finalOutput = {
      contract_version: '1.3',
      avg_fps: payload.avg_fps,
      p1_low_fps: payload.p1_low_fps,
      frame_ms_p95: payload.frame_ms_p95,
      frames: payload.frames,
      load_ms: loadMs ?? payload.load_ms ?? Math.round(performance.now() - PROCESS_START_MS),
      peak_mem_mb: peakMemMb,
      vsync_off: true,
      renderer: payload.renderer || 'Three.js 0.174.0 / WebGL2',
      os: `${os.platform()} ${os.release()} (${os.arch()})`
    };

    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(finalOutput, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(finalOutput, null, 2));
  } finally {
    if (memTimer) clearTimeout(memTimer);
    killBrowser(browserChild);
    try {
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
});
