export const roles = ['admin', 'supervisor', 'executive'] as const;
export type Role = (typeof roles)[number];
export const roleNames: Record<Role, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  executive: 'Ejecutivo',
};
export const channels = ['Correo', 'WhatsApp', 'SMS', 'RCS', 'Telefonía'] as const;
export const stages = [
  'Nuevo',
  'Contactado',
  'Calificado',
  'Propuesta',
  'Ganado',
  'No viable',
] as const;
export type RequiredField = 'company' | 'email' | 'phone';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
  active: boolean;
  passwordHash: string | null;
  inviteHash: string | null;
  inviteExpires: number | null;
}
export interface Team {
  id: string;
  name: string;
}
export const contactOutcomes = [
  'Sin respuesta',
  'Contacto efectivo',
  'Respuesta recibida',
  'Datos de contacto incorrectos',
  'Otra gestión',
] as const;
export type ContactOutcome = (typeof contactOutcomes)[number];
export interface BusinessCalendar {
  enabled: boolean;
  timeZone: string;
  weekdays: number[];
  startHour: number;
  endHour: number;
  holidays: string[];
}
export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  owner: string;
  ownerId?: string;
  stage: string;
  channel: string;
  action: string;
  due: string;
  created: string;
  last: string | null;
  attempts: number;
  escalation: number;
  legacyOwner?: string;
  firstContactAt?: string | null;
  lastContactAt?: string | null;
  lastOutcome?: ContactOutcome;
  firstContactDue?: string;
}
export interface Activity {
  outcome?: ContactOutcome;
  id: string;
  leadId: string;
  date: string;
  text: string;
  owner: string;
  actorId?: string;
}
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}
export interface Settings {
  calendar?: BusinessCalendar;
  business: string;
  industry: string;
  sla: number;
  required: RequiredField[];
}
export interface Rule {
  id: string;
  name: string;
  event: string;
  description: string;
  enabled: boolean;
}
export interface Integration {
  channel: string;
  provider: string;
  account: string;
  status: string;
}
export interface CrmState {
  leads: Lead[];
  history: Activity[];
  templates: EmailTemplate[];
  settings: Settings;
  rules: Rule[];
  integrations: Integration[];
}
export interface Session {
  hash: string;
  userId: string;
  expires: number;
}
export interface Attempt {
  key: string;
  count: number;
  until: number;
}
export interface AuditEntry {
  id: string;
  date: string;
  actorId: string;
  text: string;
}
export interface DatabaseModel {
  state: CrmState;
  users: User[];
  teams: Team[];
  sessions: Session[];
  attempts: Attempt[];
  audit: AuditEntry[];
}
export interface PublicUser {
  id: string;
  name: string;
  email?: string;
  role: Role;
  teamId: string | null;
  active: boolean;
  pending: boolean;
}
export interface Snapshot extends CrmState {
  asOf: number;
  currentUser: PublicUser;
  users: PublicUser[];
  teams: Team[];
  audit: AuditEntry[];
  assignableUsers: Pick<User, 'id' | 'name' | 'teamId'>[];
}
export type Input = Record<string, unknown>;
