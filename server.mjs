import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {validateLead,channels,urgency} from './domain.mjs';
mkdirSync('data',{recursive:true});
const db=new DatabaseSync('data/crm.sqlite');
db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, json TEXT NOT NULL)');
let state=JSON.parse(db.prepare('SELECT json FROM state WHERE id=1').get()?.json||'null');
if(!state) {
 state={leads:[],templates:[{id:randomUUID(),name:'Primer contacto',subject:'Hola {{nombre}}, conversemos',body:'Hola {{nombre}},\n\nGracias por tu interés en {{empresa}}. ¿Cuándo te vendría bien conversar?\n\nSaludos,\n{{ejecutivo}}'}],settings:{business:'Mi negocio',industry:'Servicios',sla:24,required:[]},rules:[{id:'first',name:'Primera gestión automática',event:'Al crear un lead',description:'Asigna primer contacto dentro del SLA configurado.',enabled:true},{id:'overdue',name:'Escalar actividades vencidas',event:'Cada minuto',description:'Marca nivel 1 al vencer y nivel 2 tras 24 horas. Alerta visible en el tablero.',enabled:true}],history:[],integrations:channels.map(channel=>({channel,provider:'',account:'',status:'Sin conectar'}))};save();
}
function save(){db.prepare('INSERT OR REPLACE INTO state VALUES (1,?)').run(JSON.stringify(state));}
function automation(){let changed=false;for(const lead of state.leads){const level=state.rules.find(r=>r.id==='overdue').enabled&&urgency(lead)==='overdue'?(Date.now()-Date.parse(lead.due)>86400000?2:1):0;if(lead.escalation!==level){lead.escalation=level;changed=true;}}if(changed)save();}
setInterval(automation,60000).unref();
const port=Number(process.env.PORT||4310);
createServer(async(req,res)=>{
 const reply=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
 try{
 if(req.url.startsWith('/api/')){
  if(req.method==='GET'&&req.url==='/api/state'){automation();return reply(200,state);}
  if(req.method!=='POST')return reply(405,{error:'Método no permitido'});
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reply(403,{error:'Origen no permitido'});
  if(!req.headers['content-type']?.startsWith('application/json'))return reply(415,{error:'JSON requerido'});
  let raw='';for await(const c of req){raw+=c;if(raw.length>100000)return reply(413,{error:'Solicitud demasiado grande'});}const body=JSON.parse(raw);
  if(req.url==='/api/leads'){
   const old=body.id?state.leads.find(l=>l.id===body.id):null;
   if(body.id&&!old)return reply(404,{error:'Lead no encontrado'});
   const lead=Object.fromEntries(['name','company','email','phone','owner','stage','channel','action','due'].map(k=>[k,typeof body[k]==='string'?body[k].trim():'']));
   if(!old&&state.rules.find(r=>r.id==='first').enabled){lead.action||='Primer contacto';lead.due||=new Date(Date.now()+state.settings.sla*3600000).toISOString();}
   const errors=validateLead(lead,state.settings);if(errors.length)return reply(422,{error:errors.join(' ')});
   if(state.leads.some(l=>l.id!==old?.id&&((lead.email&&l.email.toLowerCase()===lead.email.toLowerCase())||(lead.phone&&l.phone.replace(/\D/g,'')===lead.phone.replace(/\D/g,'')))))return reply(409,{error:'Ya existe un lead con ese correo o teléfono.'});
   if(old&&!body.result?.trim())return reply(422,{error:'Registra el resultado de la gestión.'});
   Object.assign(lead,{id:old?.id||randomUUID(),created:old?.created||new Date().toISOString(),attempts:(old?.attempts||0)+(old?1:0),last:old?new Date().toISOString():null,escalation:0});
   if(old)state.leads[state.leads.indexOf(old)]=lead;else state.leads.push(lead);
   state.history.unshift({id:randomUUID(),leadId:lead.id,date:new Date().toISOString(),text:old?body.result.trim():'Lead creado',owner:lead.owner});
  }else if(req.url==='/api/templates'){
   if(!body.name?.trim()||!body.subject?.trim()||!body.body?.trim())return reply(422,{error:'Completa nombre, asunto y contenido.'});
   if(/{{(?!nombre}}|empresa}}|ejecutivo}})[^}]*}}/.test(body.body+body.subject))return reply(422,{error:'Variables disponibles: nombre, empresa y ejecutivo.'});
   const t={id:body.id||randomUUID(),name:body.name.trim(),subject:body.subject.trim(),body:body.body.trim()};const i=state.templates.findIndex(t=>t.id===body.id);if(i<0)state.templates.push(t);else state.templates[i]=t;
  }else if(req.url==='/api/settings'){
   if(!body.business?.trim()||!body.industry?.trim()||!Number.isFinite(+body.sla)||+body.sla<1||+body.sla>720||!Array.isArray(body.required)||body.required.some(k=>!['company','email','phone'].includes(k)))return reply(422,{error:'Revisa el nombre, sector, campos y SLA (1–720 horas).'});
   state.settings={business:body.business.trim(),industry:body.industry.trim(),sla:+body.sla,required:body.required};
  }else if(req.url==='/api/rules'){
   const rule=state.rules.find(r=>r.id===body.id);if(!rule||typeof body.enabled!=='boolean')return reply(422,{error:'Regla no válida'});rule.enabled=body.enabled;
  }else if(req.url==='/api/integrations'){
   const integration=state.integrations.find(i=>i.channel===body.channel);if(!integration||!body.provider?.trim()||!body.account?.trim())return reply(422,{error:'Completa proveedor e identificador de cuenta.'});Object.assign(integration,{provider:body.provider.trim(),account:body.account.trim(),status:'Configuración guardada · conexión pendiente'});
  }else return reply(404,{error:'Ruta no encontrada'});
  save();automation();return reply(200,state);
 }
 const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[req.url?.split('?')[0]];
 if(!file){res.writeHead(404);return res.end('No encontrado');}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(readFileSync(new URL(`./public/${file}`,import.meta.url)));
 }catch(err){reply(err instanceof SyntaxError?400:500,{error:err instanceof SyntaxError?'JSON no válido':'No se pudo guardar. Inténtalo de nuevo.'});}
}).listen(port,'127.0.0.1',()=>console.log(`Pulso CRM http://127.0.0.1:${port}`));
