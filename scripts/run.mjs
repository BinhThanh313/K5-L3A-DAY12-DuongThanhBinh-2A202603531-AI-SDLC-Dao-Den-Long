import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addLeaderboardEntry, sortAndTrimEntries } from '../src/sim/leaderboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DEFAULT_LB_PATH = path.join(ROOT_DIR, 'data', 'leaderboard.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm'
};

function getLeaderboardPath() {
  return process.env.DDL_LEADERBOARD_PATH
    ? path.resolve(process.env.DDL_LEADERBOARD_PATH)
    : DEFAULT_LB_PATH;
}

function readLeaderboardEntries() {
  const lbPath = getLeaderboardPath();
  if (!fs.existsSync(lbPath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(lbPath, 'utf8'));
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.entries) ? raw.entries : [];
    return sortAndTrimEntries(list);
  } catch {
    return [];
  }
}

function writeLeaderboardEntries(entries) {
  const lbPath = getLeaderboardPath();
  fs.mkdirSync(path.dirname(lbPath), { recursive: true });
  const sorted = sortAndTrimEntries(entries);
  fs.writeFileSync(lbPath, JSON.stringify({ entries: sorted }, null, 2) + '\n', 'utf8');
  return sorted;
}

function parseArgs(argv) {
  const args = { host: '127.0.0.1', port: 4173, exportLeaderboard: null };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--export-leaderboard':
        if (next === undefined) throw new Error('Missing file path for --export-leaderboard');
        args.exportLeaderboard = next;
        i++;
        break;
      case '--host':
        if (next === undefined) throw new Error('Missing value for --host');
        args.host = next;
        i++;
        break;
      case '--port':
        if (next === undefined) throw new Error('Missing value for --port');
        args.port = Number(next);
        i++;
        break;
      default:
        // Ignore unknown flags gracefully if passed through npm run
        break;
    }
  }
  return args;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 64) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error(`Invalid JSON: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.exportLeaderboard) {
    const entries = readLeaderboardEntries();
    const outPath = path.resolve(args.exportLeaderboard);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ entries }, null, 2) + '\n', 'utf8');
    console.log(`Exported ${entries.length} leaderboard entries to ${outPath}`);
    process.exit(0);
  }

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    process.stderr.write('Error: dist/index.html not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    const urlObj = new URL(req.url || '/', `http://${args.host}:${args.port}`);
    const pathname = decodeURIComponent(urlObj.pathname);

    if (pathname === '/api/leaderboard' && req.method === 'GET') {
      const entries = readLeaderboardEntries();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ entries }));
      return;
    }

    if (pathname === '/api/leaderboard' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const current = readLeaderboardEntries();
        const updated = addLeaderboardEntry(current, body);
        writeLeaderboardEntries(updated);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ entries: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
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

  server.listen(args.port, args.host, () => {
    console.log(`Đảo Đèn Lồng v1.0.0 running at http://${args.host}:${args.port}/`);
    console.log(`Leaderboard storage: ${getLeaderboardPath()}`);
  });
}

try {
  main();
} catch (err) {
  process.stderr.write(`Error: ${err.message}\n`);
  process.exit(1);
}
