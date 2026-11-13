// Date helpers. All business dates are ISO strings (YYYY-MM-DD) in America/Fortaleza.

const TIME_ZONE = 'America/Fortaleza';
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const fortalezaFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function todayInFortaleza(now = new Date()) {
  return fortalezaFormatter.format(now); // en-CA yields YYYY-MM-DD
}

export function isValidIsoDate(value) {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function ageOn(birthDate, onDate) {
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = onDate.split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age -= 1;
  return age;
}

/** 0 = domingo ... 6 = sábado */
export function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
