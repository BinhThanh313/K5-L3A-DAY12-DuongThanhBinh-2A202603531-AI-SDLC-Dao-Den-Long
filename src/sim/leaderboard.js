// Pure ESM leaderboard helpers (Contract v1.3) — zero browser/DOM imports

export const LEADERBOARD_MAX_ENTRIES = 10;
const NAME_REGEX = /^[\p{L}0-9_]{3,12}$/u;

export function validatePlayerName(name) {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Tên phải là chuỗi ký tự.' };
  }
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 12) {
    return { valid: false, error: 'Tên phải dài từ 3 đến 12 ký tự.' };
  }
  if (!NAME_REGEX.test(trimmed)) {
    return { valid: false, error: 'Chỉ cho phép chữ cái, chữ số và dấu gạch dưới (_).' };
  }
  return { valid: true, value: trimmed };
}

export function formatIsoWithTimezone(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');

  const yyyy = d.getFullYear();
  const mon = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mon}-${day}T${hrs}:${mins}:${secs}${sign}${hh}:${mm}`;
}

export function sortAndTrimEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return [...entries]
    .filter(
      (e) =>
        e &&
        typeof e.name === 'string' &&
        typeof e.score === 'number' &&
        Number.isFinite(e.score) &&
        typeof e.nights_won === 'number' &&
        typeof e.achieved_at === 'string'
    )
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at);
      const tb = Date.parse(b.achieved_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) {
        return ta - tb; // Earlier achieved_at ranks higher on tie
      }
      return a.achieved_at.localeCompare(b.achieved_at);
    })
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

export function addLeaderboardEntry(entries, rawEntry) {
  const check = validatePlayerName(rawEntry?.name);
  if (!check.valid) {
    throw new Error(check.error);
  }
  const entry = {
    name: check.value,
    score: Math.max(0, Math.floor(Number(rawEntry.score) || 0)),
    nights_won: Math.max(0, Math.min(3, Math.floor(Number(rawEntry.nights_won) || 0))),
    achieved_at:
      typeof rawEntry.achieved_at === 'string' && rawEntry.achieved_at.trim()
        ? rawEntry.achieved_at.trim()
        : formatIsoWithTimezone(new Date()),
    seed: Number.isInteger(rawEntry.seed) ? rawEntry.seed : Math.floor(Number(rawEntry.seed) || 0)
  };
  return sortAndTrimEntries([...(Array.isArray(entries) ? entries : []), entry]);
}
