export const channels=['Correo','WhatsApp','SMS','RCS','Telefonía'];
export const stages=['Nuevo','Contactado','Calificado','Propuesta','Ganado','No viable'];
export function validateLead(x, settings, now=Date.now()) {
 const errors=[];
 for(const k of ['name','owner','stage','channel',...settings.required]) if(typeof x[k]!=='string'||!x[k].trim()) errors.push(`Completa ${k}.`);
 if(!stages.includes(x.stage)) errors.push('Estado no válido.');
 if(!channels.includes(x.channel)) errors.push('Canal no válido.');
 if(!x.email?.trim()&&!x.phone?.trim()) errors.push('Registra al menos un correo o teléfono.');
 if(x.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email)) errors.push('Correo no válido.');
 if(x.phone&&!/^\+?[0-9 ()-]{7,20}$/.test(x.phone)) errors.push('Teléfono no válido.');
 if(x.channel==='Correo'&&!x.email?.trim()) errors.push('El canal correo requiere un correo.');
 if(x.channel!=='Correo'&&!x.phone?.trim()) errors.push('Este canal requiere teléfono.');
 if(!['Ganado','No viable'].includes(x.stage)) {
  if(!x.action?.trim()) errors.push('Define la próxima acción.');
  if(!Number.isFinite(Date.parse(x.due))||Date.parse(x.due)<=now) errors.push('La próxima acción debe tener una fecha futura.');
 }
 return [...new Set(errors)];
}
export function urgency(lead, now=Date.now()) {
 if(['Ganado','No viable'].includes(lead.stage)) return 'closed';
 if(!lead.due||!lead.action) return 'missing';
 const diff=Date.parse(lead.due)-now;
 return diff<0?'overdue':diff<86400000?'today':'upcoming';
}
