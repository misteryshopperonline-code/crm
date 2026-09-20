import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBusinessHours, calendarError, defaultCalendar } from '../src/domain/business-calendar';
const calendar = { ...defaultCalendar, enabled: true, endHour: 17 };
const iso = (start: string, hours: number, config = calendar) =>
  new Date(addBusinessHours(Date.parse(start), hours, config)).toISOString();
test('viernes tarde salta al lunes y conserva minutos', () => {
  assert.equal(iso('2026-09-11T21:30:00Z', 2), '2026-09-14T15:30:00.000Z');
});
test('omite feriado y admite jornada de fin de semana', () => {
  assert.equal(
    iso('2026-09-12T15:00:00Z', 1, { ...calendar, holidays: ['2026-09-14'] }),
    '2026-09-15T15:00:00.000Z',
  );
  assert.equal(
    iso('2026-09-12T15:00:00Z', 1, { ...calendar, weekdays: [6] }),
    '2026-09-12T16:00:00.000Z',
  );
});
test('respeta cambio de horario estacional', () => {
  assert.equal(
    iso('2026-03-06T21:00:00Z', 2, { ...calendar, timeZone: 'America/New_York' }),
    '2026-03-09T14:00:00.000Z',
  );
});
test('sin activar mantiene horas transcurridas y rechaza calendario inválido', () => {
  assert.equal(iso('2026-09-12T15:00:00Z', 24, defaultCalendar), '2026-09-13T15:00:00.000Z');
  assert.ok(calendarError({ ...calendar, weekdays: [] }));
  assert.ok(calendarError({ ...calendar, holidays: ['2026-02-30'] }));
  assert.ok(calendarError({ ...calendar, timeZone: 'invalid' }));
});
