# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

Game 3D góc nhìn thứ ba qua **3 Đêm (Ba Hòn Đảo)**: điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) gom đom đóm thắp sáng và **châm dầu giữ các Đèn Lồng Lớn sáng tới Bình Minh** trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**, ngăn **Bóng Mực hút dầu**, né **Gió Lạc**, tận dụng **Bùa Gió**, **Lướt** và **Tỏa Sáng**.

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` ở Phase 4)*

---

## Cài đặt và chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js >= 20** (chạy giống nhau trên macOS, Linux và Windows).

```bash
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Mở trình duyệt tại `http://127.0.0.1:4173` để chơi.

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W A S D` / phím mũi tên | Di chuyển theo hướng camera (`6.0 m/s`, `7.2 m/s` khi có Bùa Gió) |
| `Space` | Nhảy (`7.0 m/s`, trọng lực `-20 m/s²`) |
| `C` hoặc `Ctrl` | Lướt (`14 m/s` trong `0.2 s`, hồi `1.5 s`, không hồi khi có Bùa Gió) |
| `E` hoặc `F` | Thắp đèn mới (`10` đom đóm), Thắp lại đèn tắt (`5` đom đóm), hoặc Châm dầu đèn đang sáng (`+10 fuel`/đom đóm) |
| `Shift` hoặc `K` | Tỏa Sáng (tốn `3` đom đóm, bán kính 3D `5.0 m`, hồi `3.0 s`) |
| Kéo chuột trái/phải, Double-click, hoặc `Q`/`R` | Xoay & nghiêng camera 3D, cuộn chuột để Zoom |
| `Esc` hoặc `P` | Tạm dừng / Tiếp tục (có Cài đặt âm lượng, độ nhạy chuột & **Bảng màu dễ phân biệt / Mù màu**) |
| `M` | Tắt / bật âm thanh |

---

## Luật chơi & Cách tính điểm (Chuẩn Contract v1.2 — Phase 3)

Khớp 100% với [game.contract.json](game.contract.json) và [CHANGELOG.md](CHANGELOG.md):

- **Nhiên liệu đèn (`fuel`):** Đèn vừa thắp có `fuel = 100`, tự hao `1.0/s`. Khi `fuel < 30`, đèn mất vùng an toàn `6 m`, nhấp nháy `1 Hz`, và Bóng Mực ở trạng thái `wander` sẽ lao tới hút dầu (`drain` `5.0/s`). Khi `fuel <= 0`, đèn tắt (`lantern_out`) và chỉ cần `5` đom đóm để thắp lại (`ever_lit = true`).
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

## Kiểm thử và chế độ Headless (Test Contract v1.2)

```bash
npm test
npm run verify
```

Chạy chế độ headless trực tiếp cho Đêm 1, 2 hoặc 3:

```bash
node src/headless/cli.js --seed 42 --night 1 --ticks 14400 --out out.jsonl --snapshot-every 60
```

---

## Sáng tạo của tôi

Mọi yếu tố sáng tạo được tách hoàn toàn trong `src/game/` (không làm đổi đầu ra headless của `src/sim/`):

1. **Hiệu ứng gợn gió bước chân (World-space Foot Ripples) & Áo choàng Bóng Mực đa trạng thái:** Khi Mây có Bùa Gió hoặc Lướt, dưới chân Mây tạo cánh cung rẽ gió và để lại các vòng sóng gió + bụi sáng nở rộng trên mặt đất; Bóng Mực có tạo hình áo choàng mực, sừng cong, 5 xúc tu xoay và hoạt ảnh riêng cho cả 6 trạng thái (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`).
2. **Kiến trúc 3D đa tầng & Đổ bóng toàn đảo (2048×2048 Shadow Map):** Đèn Lồng Lớn có bệ đá bát giác 2 bậc, khung lồng gỗ, mái đình 2 tầng, thanh nhiên liệu 3D nổi phía trên và hiệu ứng xẹp 20% + vết rách giấy khi tắt; Đảo Cau có hàng cây cau 3D & cầu tre đốt tròn; Đảo Chuông có Tháp Chuông 2 tầng mái cong và lá bay báo gió 3D.
3. **Âm thanh ngũ cung & nhạc nền đêm tổng hợp (`src/game/audio.js`):** Web Audio API tự sinh nhạc nền đêm và hơn 10 hiệu ứng âm thanh không cần asset ngoài.

*Bằng chứng phần lõi & Test Contract v1.2 đạt chuẩn:* xem [docs/proof/phase-3/verification-summary.txt](docs/proof/phase-3/verification-summary.txt).

---

## Tài liệu SDLC, ADR, Changelog, Bằng chứng & Harness AI

- **ADR & Changelog (Phase 3 Change Request):** [docs/notes/phase-3-adr.md](docs/notes/phase-3-adr.md), [CHANGELOG.md](CHANGELOG.md)
- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [scripts/verify-phase.mjs](scripts/verify-phase.mjs), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Specs & Evals:** [phase-1-spec.md](docs/notes/phase-1-spec.md), [phase-1-eval.md](docs/notes/phase-1-eval.md), [phase-2-spec.md](docs/notes/phase-2-spec.md), [phase-2-eval.md](docs/notes/phase-2-eval.md), [phase-3-eval.md](docs/notes/phase-3-eval.md), [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng:** [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE), [CREDITS.md](CREDITS.md)
