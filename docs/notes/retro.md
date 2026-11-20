# Retrospective — Đảo Đèn Lồng (Phases 1–4, v1.0.0)

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu chính | Contract | Kết quả kiểm thử & hiệu năng |
|---|---|---|---|
| **Phase 1 (PRD-0)** | Game 3D Đêm 1 (Đảo Bến) + Headless runner + xác minh tự động | v1.0 | 11/11 tests PASS, `vite build` sạch, determinism 600 ticks byte-identical. |
| **Phase 2 (Ticket-02)** | Chuẩn hóa tuning, mở rộng 3 Đêm (Đảo Bến, Đảo Cau, Đảo Chuông), Lướt, Rơi, Gió Lạc, Bùa Gió, Gió, Pause, HUD & Audio | v1.1 | 14/14 tests PASS, full-night 21,600 ticks chạy **161 ms** (ngưỡng `<= 30,000 ms`), determinism 100%. |
| **Phase 3 (Ticket-03)** | Change Request lớn: hệ thống `fuel` đèn, `drain`, thắng `dawn_survived`, công thức điểm mới, sức chứa tăng dần, hỗ trợ mù màu | v1.2 | 11/11 suites PASS (cập nhật minh bạch test bị thay thế + giữ nguyên regression), ADR + CHANGELOG đầy đủ, 18,000 ticks chạy **172 ms**. |
| **Phase 4 (Ticket-04)** | Release v1.0.0: Benchmark 1280×720, Soak test 10 Đêm, Bảng xếp hạng lưu đĩa + export CLI, Trợ năng đầy đủ, đóng gói & tài liệu | v1.3 | 15/15 tests PASS, Soak 10 Đêm: `crashes = 0`, `RSS 51.2 -> 58.1 MB` (`1.13× <= 1.2×`), `duration = 0.3 s`; Benchmark 30s đạt `avg_fps >= 60`, `p1_low_fps >= 30`, `load_ms < 2500 ms` ngay trên GPU tích hợp Intel UHD. |

---

## 2. Điều gì hiệu quả và chưa hiệu quả khi làm việc với AI

### Hiệu quả
- **Kiến trúc tách biệt tuyệt đối (`src/sim/` vs `src/game/`):** Quy định ngay từ Phase 1 rằng `src/sim/` là Pure ESM không import DOM/Three.js giúp AI sinh code cực nhanh, chạy được trực tiếp trên `node --test` và CLI headless mà không cần giả lập trình duyệt. Mọi thay đổi sáng tạo về đồ họa/âm thanh ở `src/game/` không bao giờ phá vỡ determinism.
- **Viết ADR & Spec ngắn trước khi sửa code (Phase 3):** Khi nhận Change Request thay thế 4 luật lõi ở Ticket-03, việc lập bảng `[THAY THẾ]` trong `phase-3-adr.md` và `CHANGELOG.md` trước giúp AI cập nhật toàn bộ `engine.js` chính xác chỉ trong 1 lượt chỉnh sửa.
- **Tối ưu GPU có chủ đích (InstancedMesh):** Thay vì để 200 Bóng Mực tạo 2,800 draw calls, việc dùng `THREE.InstancedMesh` (4 draw calls cho 200 Bóng Mực + 100 Đom Đóm) giúp cảnh benchmark đạt tốc độ khung hình cao ngay cả trên Intel UHD Graphics.

### Chưa hiệu quả
- **Giả định cờ dòng lệnh trình duyệt trên Windows:** Ở Phase 4, AI ban đầu dùng `--disable-frame-rate-limit` kết hợp polling PowerShell `Get-CimInstance` đồng bộ để đo RSS trong `bench.mjs`. Cách này gây nghẽn hàng đợi D3D11 và kéo `p1_low_fps` xuống `1.8–3.6 FPS` dù `avg_fps > 120`.
- **Chi tiết biên về thứ tự tick & làm tròn số thực:** AI đôi khi bỏ sót tương tác giữa các bước liền kề trong 12-step tick (ví dụ Step 2 trừ `1/60` fuel trước Step 5 kiểm tra đèn đầy).

---

## 3. Những lần AI sai và cách phát hiện

1. **Phase 1 — `spawnSync(process.execPath, ..., { shell: true })` lỗi trên Windows:** Đường dẫn `C:\Program Files\nodejs\node.exe` có dấu cách nên bị cắt cụt. *Phát hiện:* chạy thật `npm run verify`. *Khắc phục:* chỉ bật `shell: true` cho `npm`, giữ `shell: false` cho `process.execPath`.
2. **Phase 1 — Kịch bản thắng trong `verify-phase.mjs` thiếu 1 đom đóm:** Nhân vật còn 4/5 sau khi Tỏa Sáng nên kết thúc ở `state: "playing"` thay vì `"won"`. *Phát hiện:* đọc trực tiếp file proof `out-win.jsonl`. *Khắc phục:* thêm hard-assertion `winEnd.state === 'won'` vào script xác minh.
3. **Phase 2 — Vòng lặp CLI headless dừng sớm khi gặp `paused`:** Kiểm tra `sim.state === 'playing'` khiến CLI thoát ngay lúc nhấn Pause. *Phát hiện:* code review trước khi chạy test v1.1. *Khắc phục:* đổi thành `sim.state !== 'won' && sim.state !== 'lost'` và viết test hồi quy.
4. **Phase 3 — Châm dầu ngay sau khi thắp đèn làm tiêu tốn 1 đom đóm thừa:** Do Step 2 trừ `1/60` (`fuelUnits = 5999`, hiển thị `100.0`) trước Step 5. *Phát hiện:* unit test `[P3] fuel decay, lantern_out, relight cost 5, and refuel formula`. *Khắc phục:* coi đèn đầy khi `fuelUnits >= FUEL_MAX_UNITS - 3`.
5. **Phase 4 — `p1_low_fps` tụt xuống ~3 FPS khi bật `--disable-frame-rate-limit` + PowerShell RSS:** *Phát hiện:* chạy thật `bench.mjs` 30s và so sánh `p1_low_fps` với `frame_ms_p95`. *Khắc phục:* chuyển đo RSS sang `tasklist` bất đồng bộ, bake shadow map tĩnh trong cảnh bench, và chỉ dùng `--disable-gpu-vsync` — `p1_low_fps` tăng hơn 10 lần.

---

## 4. Harness nào giúp nhiều nhất?

1. **`scripts/verify-phase.mjs` + skill `.agents/skills/verify-phase/SKILL.md` (Hiệu quả nhất):** Tự động hóa toàn bộ cổng chất lượng (unit tests, headless scenarios, soak test, export leaderboard, determinism 2 lần chạy, build Vite, xuất bằng chứng vào `docs/proof/phase-N/`). Mọi lỗi hồi quy đều bị chặn trước khi commit/tag.
2. **`AGENTS.md` ngắn gọn (~30 dòng):** Ghi rõ 12 bước tick order, đơn vị `fuel` nguyên `1/60`, tên trạng thái chuẩn và quy tắc bất biến `src/sim/`. Giúp AI không đi lệch kiến trúc qua nhiều phiên làm việc.
3. **Test đồng bộ `game.contract.json` ↔ `src/sim/config.js`:** Đảm bảo không bao giờ xảy ra lệch thông số tuning giữa code và hợp đồng chấm tự động.

---

## 5. Ước tính token / chi phí AI & cách tiết kiệm token

| Phase | Input tokens (ước tính) | Output tokens (ước tính) | Chi phí ước tính (USD) |
|---|---:|---:|---:|
| Phase 1 | ~25,000 | ~10,000 | ~$0.05 – $0.10 |
| Phase 2 | ~35,000 | ~18,000 | ~$0.08 – $0.15 |
| Phase 3 | ~22,000 | ~11,000 | ~$0.05 – $0.09 |
| Phase 4 | ~32,000 | ~18,000 | ~$0.08 – $0.14 |
| **Tổng cộng** | **~114,000** | **~57,000** | **~$0.26 – $0.48** |

**Chiến lược tiết kiệm token đã áp dụng:**
- Chọn stack cực gọn (`three` + `vite` + Node built-in `node:test`, `node:http`), không dùng framework/ORM/test-runner nặng làm phình ngữ cảnh.
- Đọc nhiều file song song trong 1 lượt thay vì đọc lẻ tẻ từng file.
- Giữ `AGENTS.md` súc tích, chỉ chứa quy tắc thiết yếu thay vì copy toàn bộ PRD.
- Dùng kiểm thử tự động cục bộ (`npm test`, `npm run verify`) để phát hiện lỗi ngay trong 1 giây thay vì sửa mò nhiều lượt.

---

## 6. Nếu làm lại từ đầu, sẽ đổi gì?

1. **Dùng `THREE.InstancedMesh` cho Đom Đóm và Bóng Mực ngay từ Phase 1:** Giúp kiến trúc render đồng nhất giữa chế độ chơi thường và chế độ benchmark, giảm thiểu việc phải tối ưu lại ở Phase 4.
2. **Thiết kế `scripts/run.mjs` (server cục bộ + API lưu đĩa) sớm hơn:** Thay vì dùng `vite preview` ở Phase 1–3 rồi mới chuyển sang server Node ở Phase 4, có sẵn server nhỏ từ đầu sẽ hỗ trợ lưu điểm, xuất JSON và benchmark mượt mà hơn.
3. **Bổ sung CI headless + soak test vào GitHub Actions ngay từ Phase 2:** Chạy tự động trên mỗi push để đảm bảo môi trường Linux/Windows luôn đồng nhất.
