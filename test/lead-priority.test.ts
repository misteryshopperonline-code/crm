import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leadPriority, matchesAttention } from '../src/domain/lead-priority';
import type { Lead } from '../src/domain/models';
const now = Date.parse('2026-09-14T15:00:00Z');
const lead: Lead = {
  id: '1',
  name: 'Prueba',
  company: '',
  email: 'a@example.com',
  phone: '',
  owner: 'Prueba',
  stage: 'Nuevo',
  channel: 'Correo',
  action: 'Contactar',
  due: '2026-09-14T16:00:00Z',
  created: '2026-09-12T15:00:00Z',
  last: null,
  attempts: 0,
  escalation: 0,
};
test('el lunes mantiene visibles los leads del sábado sin gestionar', () => {
  const result = leadPriority(lead, now);
  assert.equal(result.weekend, true);
  assert.equal(result.alert, true);
  assert.equal(result.label, 'Alta');
  assert.equal(matchesAttention(lead, 'weekend', now), true);
});
test('una gestión elimina el pendiente de fin de semana y activa seguimiento', () => {
  const managed = {
    ...lead,
    last: '2026-09-14T14:00:00Z',
    firstContactAt: '2026-09-14T14:00:00Z',
    attempts: 1,
  };
  assert.equal(matchesAttention(managed, 'weekend', now), false);
  assert.equal(matchesAttention(managed, 'followup', now), true);
  assert.equal(leadPriority(managed, now).alert, true);
  assert.equal(leadPriority({ ...managed, due: '2026-09-18T15:00:00Z' }, now).alert, false);
});
test('cerrados quedan fuera de alertas y colas de trabajo', () => {
  const closed = { ...lead, stage: 'Ganado' };
  assert.equal(leadPriority(closed, now).score, 0);
  assert.equal(leadPriority(closed, now).alert, false);
  assert.equal(matchesAttention(closed, 'weekend', now), false);
});
test('usa Ecuador continental para determinar sábado y domingo', () => {
  assert.equal(leadPriority({ ...lead, created: '2026-09-12T02:00:00Z' }, now).weekend, false);
  assert.equal(leadPriority({ ...lead, created: '2026-09-14T02:00:00Z' }, now).weekend, true);
});
test('vencimientos pesan más que datos de contacto completos', () => {
  assert.ok(
    leadPriority({ ...lead, created: '2026-09-14T14:00:00Z', due: '2026-09-14T14:30:00Z' }, now)
      .score >
      leadPriority(
        {
          ...lead,
          created: '2026-09-14T14:00:00Z',
          phone: '0991234567',
          due: '2026-09-18T15:00:00Z',
        },
        now,
      ).score,
  );
});

test('un intento sin respuesta no confirma contacto', () => {
  assert.equal(
    leadPriority(
      { ...lead, attempts: 4, last: new Date(now).toISOString(), stage: 'Contactado' },
      now,
    ).managed,
    false,
  );
});
