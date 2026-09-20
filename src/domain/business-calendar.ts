import type { BusinessCalendar } from './models';

export const defaultCalendar: BusinessCalendar = {
  enabled: false,
  timeZone: 'America/Guayaquil',
  weekdays: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 18,
  holidays: [],
};
export function calendarError(calendar: BusinessCalendar): string | null {
  if (typeof calendar.timeZone !== 'string' || !calendar.timeZone.trim())
    return 'Indica una zona horaria válida.';
  try {
    new Intl.DateTimeFormat('en', { timeZone: calendar.timeZone }).format();
  } catch {
    return 'Zona horaria no válida.';
  }
  if (
    typeof calendar.enabled !== 'boolean' ||
    !Array.isArray(calendar.weekdays) ||
    !calendar.weekdays.length ||
    calendar.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  )
    return 'Selecciona al menos un día laboral válido.';
  if (
    !Number.isInteger(calendar.startHour) ||
    !Number.isInteger(calendar.endHour) ||
    calendar.startHour < 0 ||
    calendar.endHour > 24 ||
    calendar.startHour >= calendar.endHour
  )
    return 'El horario debe estar entre 0 y 24 y terminar después de comenzar.';
  if (
    !Array.isArray(calendar.holidays) ||
    calendar.holidays.length > 366 ||
    calendar.holidays.some(
      (date) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date,
    )
  )
    return 'Usa fechas válidas AAAA-MM-DD para los feriados (máximo 366).';
  return null;
}
function calendarClock(calendar: BusinessCalendar) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: calendar.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const holidays = new Set(calendar.holidays);
  return (time: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(time).map((part) => [part.type, part.value]),
    );
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
    return {
      open:
        calendar.weekdays.includes(day) &&
        !holidays.has(`${parts.year}-${parts.month}-${parts.day}`) &&
        Number(parts.hour) >= calendar.startHour &&
        Number(parts.hour) < calendar.endHour,
      step: 3600000 - Number(parts.minute) * 60000 - Number(parts.second) * 1000 - (time % 1000),
    };
  };
}
export function addBusinessHours(start: number, hours: number, calendar = defaultCalendar): number {
  if (!calendar.enabled) return start + hours * 3600000;
  if (calendarError(calendar) || !Number.isFinite(start) || !Number.isFinite(hours) || hours < 0)
    throw Error('Calendario o plazo no válido.');
  const clock = calendarClock(calendar);
  let time = start,
    remaining = hours * 3600000;
  for (let count = 0; remaining > 0 && count < 24 * 366 * 10; count++) {
    const { open, step } = clock(time);
    if (open && remaining <= step) return time + remaining;
    if (open) remaining -= step;
    time += step;
  }
  if (remaining > 0) throw Error('No se pudo calcular el plazo con este calendario.');
  return time;
}
