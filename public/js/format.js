const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TYPE_LABELS = {
  workshop: 'Oficina',
  course: 'Curso',
  event: 'Evento',
};

export function formatActivityType(type) {
  return TYPE_LABELS[type] ?? type;
}

export function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = String(isoDate).split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}/${month}/${year}`;
}

export function formatDateRange(startDate, endDate) {
  if (!startDate) return '';
  if (!endDate || startDate === endDate) {
    return formatDateBR(startDate);
  }
  return `${formatDateBR(startDate)} a ${formatDateBR(endDate)}`;
}

export function formatTimeShort(hhmm) {
  if (!hhmm) return '';
  const [hourStr, minStr] = String(hhmm).split(':');
  const hour = Number(hourStr);
  return minStr === '00' ? `${hour}h` : `${hour}h${minStr}`;
}

function joinWithE(items) {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/**
 * Formats schedules like "Ter e Qui, 14h–16h".
 * Groups days that share the exact same time window.
 */
export function formatSchedules(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return 'Horário a definir';
  }

  const groups = new Map();
  for (const s of schedules) {
    const windowKey = `${s.startTime}-${s.endTime}`;
    const list = groups.get(windowKey) ?? [];
    list.push(s);
    groups.set(windowKey, list);
  }

  const parts = [];
  for (const group of groups.values()) {
    const days = [...new Set(group.map((s) => WEEKDAYS_SHORT[s.weekday] ?? ''))].filter(Boolean);
    const start = formatTimeShort(group[0].startTime);
    const end = formatTimeShort(group[0].endTime);
    parts.push(`${joinWithE(days)}, ${start}–${end}`);
  }

  return parts.join(' • ');
}

export function formatSeats(seatsAvailable, capacity) {
  if (seatsAvailable <= 0) return 'Esgotado';
  if (seatsAvailable === 1) return `1 vaga disponível (de ${capacity})`;
  return `${seatsAvailable} vagas disponíveis (de ${capacity})`;
}