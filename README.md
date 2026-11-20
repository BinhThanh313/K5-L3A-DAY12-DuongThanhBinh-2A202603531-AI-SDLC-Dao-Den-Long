# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

Game 3D góc nhìn thứ ba qua **3 Đêm (Ba Hòn Đảo)**: điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) gom đom đóm thắp sáng các **Đèn Lồng Lớn** trên **Đảo Bến**, **Đảo Cau** và **Đảo Chuông**, né **Bóng Mực** và **Gió Lạc**, tận dụng **Bùa Gió**, **Lướt** và **Tỏa Sáng**.

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
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (bán kính `2.0 m`, cần `10` đom đóm/đèn) |
| `Shift` hoặc `K` | Tỏa Sáng (tốn `3` đom đóm, bán kính 3D `5.0 m`, hồi `3.0 s`) |
| Kéo chuột trái hoặc `Q` / `R` | Xoay camera 3D (độ nhạy chỉnh được trong Cài đặt) |
| `Esc` hoặc `P` | Tạm dừng / Tiếp tục |
| `M` | Tắt / bật âm thanh |

---

## Cách tính điểm (Chuẩn Contract v1.1)

Khớp 100% với [game.contract.json](game.contract.json):

| Sự kiện | Điểm |
|---|---|
| Nạp 1 đom đóm vào đèn (`per_mote`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`) | `+100` |
| Làm choáng 1 Bóng Mực bằng Tỏa Sáng (`per_stun`) | `+5` |
| Thưởng thắng — mỗi giây còn lại (`per_second_left`) | `+2 × floor(time_left_s)` |
| Thưởng thắng — mỗi Ngọn Lửa còn lại (`per_flame_left`) | `+50 × flames` |

Tổng điểm chiến dịch = tổng điểm các Đêm đã thắng (Đêm 1 → Đêm 2 → Đêm 3).

---

## Kiểm thử và chế độ Headless (Test Contract v1.1)

```bash
npm test
npm run verify
```

Chạy chế độ headless trực tiếp cho Đêm 1, 2 hoặc 3:

```bash
node src/headless/cli.js --seed 42 --night 3 --ticks 21600 --out out.jsonl --snapshot-every 60
```

---

## Sáng tạo của tôi

Mọi yếu tố sáng tạo được tách hoàn toàn trong `src/game/` (không làm đổi đầu ra headless của `src/sim/`):

1. **Âm thanh ngũ cung & nhạc nền đêm tổng hợp (`src/game/audio.js`):** Web Audio API tự sinh nhạc nền đêm dịu nhẹ và đủ bộ hiệu ứng âm thanh (nhặt đom đóm ngũ cung, bùa gió, nạp/thắp đèn, tỏa sáng, nhảy, lướt, bị đánh, Bóng Mực xuất hiện, đếm ngược 10 giây cuối, thắng/thua) không cần file asset ngoài.
2. **Vòng sáng vùng an toàn trực quan:** Khi mỗi Đèn Lồng Lớn bừng sáng, một vòng ánh sáng vàng cam hiện trên mặt đất đúng bán kính `safe_radius = 6.0 m` cùng ánh sáng môi trường tăng theo công thức chuẩn `0.15 + 0.55 × (đèn sáng / tổng đèn)`.
3. **Chi tiết bản đồ & Mây:** Đèn lồng nhỏ đung đưa trước vành nón lá của Mây, cọc bến gỗ quanh Đảo Bến, tháp chuông mái vàng trên Đảo Chuông, và mũi tên chỉ hướng đèn chưa sáng gần nhất khi nằm ngoài màn hình.

*Bằng chứng phần lõi & Test Contract v1.1 đạt chuẩn:* xem [docs/proof/phase-2/verification-summary.txt](docs/proof/phase-2/verification-summary.txt) (`14/14` test đạt, 21.600 tick chạy trong `161 ms`, tính tất định khớp từng byte).

---

## Tài liệu SDLC, Bằng chứng & Harness AI

- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [scripts/verify-phase.mjs](scripts/verify-phase.mjs), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Specs & Evals:** [phase-1-spec.md](docs/notes/phase-1-spec.md), [phase-1-eval.md](docs/notes/phase-1-eval.md), [phase-2-spec.md](docs/notes/phase-2-spec.md), [phase-2-eval.md](docs/notes/phase-2-eval.md), [ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng:** [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE), [CREDITS.md](CREDITS.md)
