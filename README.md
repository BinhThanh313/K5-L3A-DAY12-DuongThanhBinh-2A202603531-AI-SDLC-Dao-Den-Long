# Đảo Đèn Lồng (Lantern Island) — v1.0.0

Game 3D góc nhìn thứ ba (Three.js + WebGL2 + Pure ESM Simulation) qua **3 Đêm (Ba Hòn Đảo)**: điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) gom đom đóm thắp sáng và **châm dầu giữ các Đèn Lồng Lớn sáng tới Bình Minh** trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**, ngăn **Bóng Mực hút dầu**, né **Gió Lạc**, tận dụng **Bùa Gió**, **Lướt** và **Tỏa Sáng**.

> **Video demo:** Xem `docs/demo/demo.mp4` hoặc file đính kèm trong **GitHub Release `v1.0.0`**.

---

## Yêu cầu hệ thống

- **Node.js >= 20** (chạy giống nhau trên Windows, macOS và Linux)
- Trình duyệt hỗ trợ **WebGL2** (Chrome, Microsoft Edge, Chromium, Firefox hoặc Safari)
- Cho chế độ benchmark tự động: đã cài đặt Google Chrome, Microsoft Edge hoặc Chromium (có thể chỉ định đường dẫn qua biến môi trường `CHROME_BIN`)

---

## Cài đặt và chạy (tối đa 3 lệnh từ repo sạch)

```bash
npm install
npm run build
node scripts/run.mjs
```

Mở trình duyệt tại `http://127.0.0.1:4173` để chơi (có sẵn lưu **Bảng xếp hạng** trên đĩa cục bộ tại `data/leaderboard.json`).

---

## Điều khiển & Trợ năng (Accessibility)

Tất cả 9 phím hành động đều có thể **đổi phím trong Cài đặt** (tự phát hiện trùng phím + nút **Khôi phục mặc định**, lưu lâu dài):

| Phím mặc định | Hành động |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển theo hướng camera (`6.0 m/s`, `7.2 m/s` khi có Bùa Gió) |
| `Space` | Nhảy (`7.0 m/s`, trọng lực `-20 m/s²`) |
| `C` (hoặc `Ctrl`) | Lướt (`14 m/s` trong `0.2 s`, hồi `1.5 s`, không hồi khi có Bùa Gió) |
| `E` (hoặc `F`) | Thắp đèn mới (`10` đom đóm), Thắp lại đèn tắt (`5` đom đóm), hoặc Châm dầu đèn đang sáng (`+10 fuel`/đom đóm) |
| `Shift` (hoặc `K`) | Tỏa Sáng (tốn `3` đom đóm, bán kính 3D `5.0 m`, hồi `3.0 s`) |
| Kéo chuột / Double-click / `Q`/`R` | Xoay & nghiêng camera 3D, cuộn chuột để Zoom |
| `P` / `Esc` | Tạm dừng / Tiếp tục |
| `M` | Tắt / bật âm thanh |

### Tính năng Dễ tiếp cận (Accessibility)
- **Đổi phím:** Toàn bộ 9 hành động (4 hướng di chuyển, nhảy, lướt, tương tác, tỏa sáng, tạm dừng), cảnh báo trùng phím, khôi phục mặc định và tự động lưu.
- **Phụ đề / chỉ báo hình ảnh:** Hiện phụ đề trực quan khi **Bóng Mực xuất hiện** (kèm **mũi tên đỏ/xanh chỉ hướng ở mép màn hình**), **gió sắp thổi**, **10 giây cuối**, và **đèn có `fuel < 30`**.
- **Giảm chuyển động:** Tắt rung camera, tắt hiệu ứng chớp màn hình khi trúng đòn và tắt hoạt ảnh nhấp nháy.
- **Cỡ chữ UI:** Tối thiểu `18 px` ở độ phân giải `1280×720`, hỗ trợ tùy chọn **Chữ lớn (`×1.25`)**.
- **Bảng màu mù màu:** Đổi viền Bóng Mực sang `#00B3FF`, thêm biểu tượng `⚠` trên đồng hồ và hình dạng xẹp 20% + vết rách giấy cho đèn tắt.

---

## Bảng xếp hạng cục bộ (Leaderboard)

- Sau màn hình **Bình Minh** (thắng Đêm 3) hoặc sau khi thua ở bất kỳ Đêm nào, người chơi nhập tên (`3–12` ký tự `[A-Za-z0-9_]` hoặc tiếng Việt có dấu) để lưu điểm (`name`, `score`, `nights_won`, `achieved_at` ISO 8601 có múi giờ, `seed`).
- Tự động giữ **Top 10** (sắp xếp `score` giảm dần; bằng điểm ai đạt trước đứng trên), lưu trên đĩa tại `data/leaderboard.json` và xem trực tiếp từ menu chính (**Bảng xếp hạng**).
- Xuất ra file JSON theo chuẩn Contract v1.3:

```bash
node scripts/run.mjs --export-leaderboard out.json
```

---

## Kiểm thử, Headless, Benchmark & Soak Test (Test Contract v1.3)

### 1. Chạy toàn bộ Unit Test & Xác minh Phase
```bash
npm test
npm run verify
```

### 2. Chế độ Headless (Đêm 1–3)
```bash
node src/headless/cli.js --seed 42 --night 1 --ticks 14400 --out out.jsonl --snapshot-every 60
```

### 3. Chế độ Benchmark (1280×720, 200 Bóng Mực wander, 100 Đom Đóm, L1–L3 sáng fuel 100)
```bash
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json
```
- Mở cửa sổ `1280×720` (không toàn màn hình) qua Chromium/Edge với `--disable-gpu-vsync` (`vsync_off: true`).
- Trong cảnh benchmark, các hiệu ứng/vật thể trang trí sáng tạo thêm được tắt; chỉ giữ ánh sáng, đổ bóng Đêm 1 chuẩn, 200 Bóng Mực `wander`, 100 Đom Đóm (render qua `THREE.InstancedMesh`), Mây đứng yên tại `(0,0,0)` và camera bay vòng tròn bán kính `30 m`, `Y = 15 m` (15 s/vòng, ngược chiều kim đồng hồ từ `(30,15,0)`).
- Kết quả chạy tham khảo trên máy phát triển được lưu tại [bench.json](bench.json).

### 4. Chế độ Soak Test (10 Đêm liên tiếp trong 1 tiến trình)
```bash
node scripts/soak.mjs --seed 7 --nights 10 --out soak.json
```
- Kết quả chạy tham khảo được lưu tại [soak.json](soak.json) (`crashes: 0`, `mem_end_mb <= 1.2 × mem_start_mb`).

---

## Luật chơi & Cách tính điểm (Contract v1.3)

Khớp 100% với [game.contract.json](game.contract.json) và [CHANGELOG.md](CHANGELOG.md):

- **Nhiên liệu đèn (`fuel`):** Đèn vừa thắp có `fuel = 100`, tự hao `1.0/s`. Khi `fuel < 30`, đèn mất vùng an toàn `6 m`, Bóng Mực `wander` sẽ lao tới hút dầu (`drain` `5.0/s`). Khi `fuel <= 0`, đèn tắt (`lantern_out`) và chỉ cần `5` đom đóm để thắp lại (`ever_lit = true`).
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)`.
- **Điều kiện thắng (`dawn_survived`):** Sống sót tới Bình Minh (`240s / 270s / 300s`) và giữ số đèn đang sáng `>= ceil(0.6 × tổng đèn)` (Đêm 1: `3/5`, Đêm 2: `4/6`, Đêm 3: `5/7`).

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm nạp vào đèn (thắp mới, thắp lại hoặc châm dầu) | `+5` |
| Thắp đèn lần đầu (`per_lantern`) | `+100` |
| Thắp lại đèn đã từng sáng (`relight`) | `+40` |
| Làm choáng 1 Bóng Mực bằng Tỏa Sáng (`+15` nếu đang `drain`) | `+5` / `+15` |
| Thưởng Bình Minh (khi thắng) — mỗi đèn đang sáng | `+50 + floor(fuel)` |
| Thưởng Bình Minh (khi thắng) — mỗi Ngọn Lửa còn lại | `+50 × flames` |

---

## Sáng tạo của tôi

Mọi yếu tố sáng tạo được tách hoàn toàn trong `src/game/` (không làm đổi đầu ra headless của `src/sim/` và tự tắt trong cảnh benchmark):

1. **Hiệu ứng gợn gió bước chân & Áo choàng Bóng Mực đa trạng thái:** Vòng sóng gió khi Lướt/có Bùa Gió; Bóng Mực 3D với áo choàng, sừng cong, 5 xúc tu xoay và hoạt ảnh riêng cho cả 6 trạng thái (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`).
2. **Kiến trúc 3D đa tầng & Đổ bóng toàn đảo:** Đèn Lồng Lớn có bệ đá bát giác, mái đình 2 tầng, thanh nhiên liệu 3D; Đảo Cau có hàng cây cau 3D & cầu tre đốt tròn; Đảo Chuông có Tháp Chuông 2 tầng mái cong và lá bay báo gió 3D.
3. **Âm thanh ngũ cung & nhạc nền đêm tổng hợp (`src/game/audio.js`):** Web Audio API tự sinh hoàn toàn, không dùng asset ngoài.

---

## Tài liệu SDLC, Retrospective, Bằng chứng & Harness AI

- **Retrospective tổng kết 4 Phase:** [docs/notes/retro.md](docs/notes/retro.md)
- **ADR & Changelog:** [docs/notes/phase-3-adr.md](docs/notes/phase-3-adr.md), [CHANGELOG.md](CHANGELOG.md)
- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [scripts/verify-phase.mjs](scripts/verify-phase.mjs), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Specs & Evals:** [phase-1-spec.md](docs/notes/phase-1-spec.md), [phase-1-eval.md](docs/notes/phase-1-eval.md), [phase-2-spec.md](docs/notes/phase-2-spec.md), [phase-2-eval.md](docs/notes/phase-2-eval.md), [phase-3-eval.md](docs/notes/phase-3-eval.md), [phase-4-eval.md](docs/notes/phase-4-eval.md), [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng:** [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md) · [Phase 4](docs/proof/phase-4/README.md)
- **Kết quả đo chuẩn:** [bench.json](bench.json) · [soak.json](soak.json)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE), [CREDITS.md](CREDITS.md)
