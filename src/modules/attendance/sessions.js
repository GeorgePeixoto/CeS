import { addDays, weekdayOf } from '../../lib/dates.js';

/**
 * Pure function that computes all session dates (YYYY-MM-DD) between
 * startDate and endDate matching any schedule weekday (0 = Sunday .. 6 = Saturday).
 */
export function listSessionDates(activity) {
  const startDate = activity?.startDate ?? activity?.start_date;
  const endDate = activity?.endDate ?? activity?.end_date;
  const schedules = activity?.schedules ?? [];

  if (!startDate || !endDate || endDate < startDate || schedules.length === 0) {
    return [];
  }

  const weekdays = new Set(schedules.map((s) => Number(s.weekday)));
  const dates = [];

  for (let current = startDate; current <= endDate; current = addDays(current, 1)) {
    if (weekdays.has(weekdayOf(current))) {
      dates.push(current);
    }
  }

  return dates;
}