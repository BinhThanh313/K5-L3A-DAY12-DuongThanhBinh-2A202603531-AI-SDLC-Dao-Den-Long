# Đảo Đèn Lồng (Lantern Island) — Day 12 AI SDLC

Game 3D góc nhìn thứ ba: điều khiển **Mây** (đội nón lá treo đèn lồng nhỏ) gom đom đóm để thắp sáng 5 **Đèn Lồng Lớn** trên **Đảo Bến**, đồng thời né hoặc tỏa sáng xua đuổi **Bóng Mực** trong sương đen.

> **Video demo:** *(Sẽ cập nhật link Release `v1.0.0` ở Phase 4)*

---

## Cài đặt và chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js >= 20** (chạy giống nhau trên macOS, Linux và Windows).

```bash
npm install
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

Mở trình duyệt tại `http://127.0.0.1:4173` để chơi. (Hoặc dùng `npm run dev` khi phát triển.)

---

## Điều khiển

| Phím / Chuột | Hành động |
|---|---|
| `W A S D` hoặc phím mũi tên | Di chuyển theo hướng camera |
| `Space` | Nhảy |
| `E` hoặc `F` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong bán kính `3.0 m`) |
| `Shift` hoặc `K` | Tỏa sáng (tốn `1` đom đóm, làm choáng & đẩy lùi Bóng Mực trong `7.0 m`) |
| Kéo chuột trái hoặc `Q` / `R` | Xoay camera 3D quanh Mây |
| `M` | Bật / tắt âm thanh |
| `Enter` | Chơi lại khi kết thúc màn |

---

## Cách tính điểm

Các thông số khớp 100% với [game.contract.json](game.contract.json):

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm (`per_mote`) | `+10` |
| Thắp sáng 1 Đèn Lồng Lớn (`per_lantern`) | `+200` |
| Làm choáng 1 Bóng Mực bằng Tỏa sáng (`per_stun`) | `+50` |
| Thưởng thắng — mỗi giây còn lại (`per_second_left`) | `+5 × floor(time_left_s)` |
| Thưởng thắng — mỗi ngọn lửa còn lại (`per_flame_left`) | `+100 × flames` |

*(Ghi chú: `fall_enabled` là `false` — đảo tròn bán kính `35 m` có rào giới hạn mềm nên không có sự kiện rơi khỏi đảo.)*

---

## Kiểm thử và chế độ Headless (Test Contract v1.0)

Chạy toàn bộ bộ test đơn vị + headless + kiểm tra tính tất định + build và xuất bằng chứng:

```bash
npm test
npm run verify
```

Chạy chế độ headless trực tiếp theo Test Contract v1.0:

```bash
node src/headless/cli.js --seed 42 --night 1 --ticks 600 --out out.jsonl --snapshot-every 10
```

---

## Sáng tạo của tôi

Mọi yếu tố sáng tạo được tách hoàn toàn trong `src/game/` (không ảnh hưởng đầu ra headless trong `src/sim/`):

1. **Âm thanh ngũ cung tự sinh (`src/game/audio.js`):** Sử dụng Web Audio API tổng hợp tiếng chuông ngũ cung tăng dần theo số đom đóm đang mang, hợp âm ấm khi thắp Đèn Lồng Lớn, sóng âm khi Tỏa sáng và âm trầm khi bị Bóng Mực chạm — không cần file asset ngoài.
2. **Đảo sáng dần theo tiến độ & vòng sáng vùng an toàn:** Khi mỗi Đèn Lồng Lớn được thắp, sương mù tím đen tan dần, ánh sáng bầu trời ấm lên và một vòng ánh sáng vàng cam mảnh hiện trên mặt đất đúng bán kính `safe_radius = 6.0 m` giúp người chơi quan sát trực quan vùng Bóng Mực không thể xâm nhập.
3. **Chi tiết Đảo Bến & Mây:** Cọc bến gỗ quanh mép đảo, biển mây bồng bềnh bên dưới, và chiếc đèn lồng nhỏ treo trước vành nón lá của Mây đung đưa theo bước chạy.

*Bằng chứng phần lõi & Test Contract không bị ảnh hưởng:* xem [docs/proof/phase-1/verification-summary.txt](docs/proof/phase-1/verification-summary.txt) (`11/11` test đạt, tính tất định giống hệt nhau từng byte).

---

## Tài liệu SDLC, Bằng chứng & Harness AI

- **Harness AI:** [AGENTS.md](AGENTS.md), [.agents/skills/verify-phase/SKILL.md](.agents/skills/verify-phase/SKILL.md), [scripts/verify-phase.mjs](scripts/verify-phase.mjs), [.github/workflows/ci.yml](.github/workflows/ci.yml)
- **Spec & Giả định Phase 1:** [docs/notes/phase-1-spec.md](docs/notes/phase-1-spec.md)
- **Đánh giá & Nhật ký AI/Token:** [docs/notes/phase-1-eval.md](docs/notes/phase-1-eval.md), [docs/notes/ai-log.md](docs/notes/ai-log.md)
- **Bằng chứng Phase 1:** [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- **Bản quyền & Nguồn:** [LICENSE](LICENSE), [CREDITS.md](CREDITS.md)
