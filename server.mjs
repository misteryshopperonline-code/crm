import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, readFileSync, copyFileSync, existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {validateLead,channels,urgency} from './domain.mjs';
import {initAuth,publicUser,roles,roleNames,hashPassword,verifyPassword,passwordError,token,digest,canSeeLead,canAssign} from './auth.mjs';
const dataDir=process.env.DATA_DIR || 'data';
mkdirSync(dataDir,{recursive:true,mode:0o700});
const databasePath=join(dataDir,'crm.sqlite');
// Preserve a one-time copy of the pre-authentication database before changing its schema.
if(existsSync(databasePath) && !existsSync(join(dataDir,'crm.before-auth.sqlite'))) {
  const old=new DatabaseSync(databasePath);
  const migrated=old.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  old.close();
  if(!migrated) copyFileSync(databasePath,join(dataDir,'crm.before-auth.sqlite'));
}
const db=new DatabaseSync(databasePath);
db.exec('CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, json TEXT NOT NULL)');
let state=JSON.parse(db.prepare('SELECT json FROM state WHERE id=1').get()?.json||'null');
if(!state) {
 state={leads:[],templates:[{id:randomUUID(),name:'Primer contacto',subject:'Hola {{nombre}}, conversemos',body:'Hola {{nombre}},\n\nGracias por tu interés en {{empresa}}. ¿Cuándo te vendría bien conversar?\n\nSaludos,\n{{ejecutivo}}'}],settings:{business:'Mi negocio',industry:'Servicios',sla:24,required:[]},rules:[{id:'first',name:'Primera gestión automática',event:'Al crear un lead',description:'Asigna primer contacto dentro del SLA configurado.',enabled:true},{id:'overdue',name:'Escalar actividades vencidas',event:'Cada minuto',description:'Marca nivel 1 al vencer y nivel 2 tras 24 horas. Alerta visible en el tablero.',enabled:true}],history:[],integrations:channels.map(channel=>({channel,provider:'',account:'',status:'Sin conectar'}))};save();
}
const auth=initAuth(db);
function save(){db.prepare('INSERT OR REPLACE INTO state VALUES (1,?)').run(JSON.stringify(state));}
function transaction(fn) {
  const previous=structuredClone(state);
  db.exec('BEGIN IMMEDIATE');
  try {const value=fn();save();db.exec('COMMIT');return value;}
  catch(error){state=previous;db.exec('ROLLBACK');throw error;}
}
function automation(){let changed=false;for(const lead of state.leads){const level=state.rules.find(r=>r.id==='overdue').enabled&&urgency(lead)==='overdue'?(Date.now()-Date.parse(lead.due)>86400000?2:1):0;if(lead.escalation!==level){lead.escalation=level;changed=true;}}if(changed)save();}
setInterval(automation,60000).unref();
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const string=(v,max=500)=>typeof v==='string'&&v.trim().length<=max?v.trim():'';
const email=v=>string(v,254).toLowerCase();
const validEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function requireAdmin(user) {if(user.role!=='admin')fail(403,'Esta acción requiere un administrador.');}
function snapshot(actor) {
  automation();
  const allUsers=auth.users(), admin=actor.role==='admin';
  const leads=state.leads.filter(l=>canSeeLead(actor,l,allUsers)).map(l=>({...l,owner:allUsers.find(u=>u.id===l.ownerId)?.name||l.owner}));
  const ids=new Set(leads.map(l=>l.id));
  const colleagues=allUsers.filter(u=>admin||u.id===actor.id||(actor.role==='supervisor'&&u.teamId===actor.teamId));
  return {...state,leads,history:state.history.filter(h=>ids.has(h.leadId)),
    integrations:admin?state.integrations:[],rules:admin?state.rules:[],
    currentUser:publicUser(actor),users:colleagues.map(u=>admin?publicUser(u):{id:u.id,name:u.name,role:u.role,teamId:u.teamId,active:!!u.active,pending:!u.passwordHash}),
    assignableUsers:allUsers.filter(u=>canAssign(actor,u)).map(u=>({id:u.id,name:u.name,teamId:u.teamId})),
    teams:auth.teams().filter(t=>admin||t.id===actor.teamId),
    audit:admin?db.prepare('SELECT * FROM audit ORDER BY date DESC LIMIT 100').all():[]};
}
const port=Number(process.env.PORT||4310);
const server=createServer(async(req,res)=>{
  const reply=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  const actualPort=server.address()?.port;
  const allowedHosts=[`127.0.0.1:${actualPort}`,`localhost:${actualPort}`];
  try {
    if(!allowedHosts.includes(req.headers.host))return reply(403,{error:'Host no permitido.'});
    if(req.url.startsWith('/api/')) {
      if(req.method==='GET'&&req.url==='/api/auth/status')return reply(200,{needsSetup:auth.users().length===0});
      let actor=auth.authenticate(req.headers.cookie);
      if(req.method==='GET'&&req.url==='/api/state') {
        if(!actor)fail(401,'Inicia sesión para continuar.');
        return reply(200,snapshot(actor));
      }
      if(req.method!=='POST')fail(405,'Método no permitido.');
      if(req.headers.origin!==`http://${req.headers.host}`)fail(403,'Origen no permitido.');
      if(!req.headers['content-type']?.startsWith('application/json'))fail(415,'JSON requerido.');
      let raw='';for await(const c of req){raw+=c;if(raw.length>100000)fail(413,'Solicitud demasiado grande.');}
      const body=JSON.parse(raw);
      if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'Solicitud no válida.');
      if(['/api/auth/setup','/api/auth/login','/api/auth/activate'].includes(req.url)) {
        const key=`${req.socket.remoteAddress}:${req.url}`;
        const accountKey=req.url==='/api/auth/login'?`login-account:${digest(email(body.email))}`:null;
        if(auth.limited(key)||(accountKey&&auth.limited(accountKey)))fail(429,'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.');
        auth.attempt(key);
        if(accountKey)auth.attempt(accountKey);
        if(req.url==='/api/auth/setup') {
          if(auth.users().length)fail(409,'El administrador inicial ya está configurado.');
          const name=string(body.name,100),address=email(body.email),err=passwordError(body.password);
          if(!name||!validEmail(address)||err)fail(422,err||'Completa nombre y correo válido.');
          const hash=await hashPassword(body.password);
          transaction(()=>{
            // Recheck after password hashing, which yields to concurrent requests.
            if(auth.users().length)fail(409,'El administrador inicial ya está configurado.');
            const id=randomUUID(),teamId=randomUUID();
            db.prepare('INSERT INTO teams VALUES (?,?)').run(teamId,'Equipo comercial');
            db.prepare('INSERT INTO users(id,name,email,role,teamId,passwordHash) VALUES (?,?,?,?,?,?)').run(id,name,address,'admin',teamId,hash);
            for(const lead of state.leads)if(!lead.ownerId){lead.legacyOwner=lead.owner;lead.ownerId=id;lead.owner=name;}
            auth.audit(id,'Configuró el espacio y asumió los leads anteriores para su reasignación.');
            actor=auth.user(id);
          });
        } else if(req.url==='/api/auth/login') {
          const user=db.prepare('SELECT * FROM users WHERE email=?').get(email(body.email));
          if(!await verifyPassword(body.password,user?.passwordHash)||!user?.active)fail(401,'Correo o contraseña incorrectos.');
          actor=auth.user(user.id);
          if(!actor?.active||actor.passwordHash!==user.passwordHash)fail(401,'La cuenta cambió. Inténtalo de nuevo.');
        } else {
          if(passwordError(body.password))fail(422,passwordError(body.password));
          const invite=string(body.token,64);
          if(!/^[a-f0-9]{64}$/.test(invite))fail(422,'La invitación no es válida o ha vencido.');
          const hash=await hashPassword(body.password);
          transaction(()=>{
            actor=db.prepare('SELECT * FROM users WHERE inviteHash=? AND inviteExpires>? AND active=1').get(digest(invite),Date.now());
            if(!actor)fail(422,'La invitación no es válida o ha vencido.');
            db.prepare('UPDATE users SET passwordHash=?,inviteHash=NULL,inviteExpires=NULL WHERE id=?').run(hash,actor.id);
            auth.audit(actor.id,'Activó su cuenta.');
            actor=auth.user(actor.id);
          });
        }
        auth.clearAttempts(key);
        if(accountKey)auth.clearAttempts(accountKey);
        auth.issueSession(actor.id,res);
        return reply(200,snapshot(actor));
      }
      if(!actor)fail(401,'Inicia sesión para continuar.');
      if(req.url==='/api/auth/logout') {
        const value=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('pulso_session='))?.slice(14);
        if(value)db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(value));
        auth.clearCookie(res);return reply(200,{ok:true});
      }
      if(req.url==='/api/auth/password') {
        const key=`password:${actor.id}`;
        if(auth.limited(key))fail(429,'Demasiados intentos. Espera 15 minutos.');
        auth.attempt(key);
        if(!await verifyPassword(body.currentPassword,actor.passwordHash))fail(422,'La contraseña actual no es correcta.');
        if(passwordError(body.password))fail(422,passwordError(body.password));
        const hash=await hashPassword(body.password),fresh=auth.user(actor.id);
        if(!fresh?.active||fresh.passwordHash!==actor.passwordHash)fail(401,'La cuenta cambió. Inicia sesión nuevamente.');
        transaction(()=>{db.prepare('UPDATE users SET passwordHash=? WHERE id=?').run(hash,actor.id);auth.invalidate(actor.id);auth.audit(actor.id,'Cambió su contraseña e invalidó sus sesiones anteriores.');});
        auth.clearAttempts(key);auth.issueSession(actor.id,res);return reply(200,snapshot(auth.user(actor.id)));
      }
      let inviteToken;
      transaction(()=>{
        if(req.url==='/api/teams') {
          requireAdmin(actor);
          const name=string(body.name,100);if(!name)fail(422,'Indica un nombre de equipo.');
          if(auth.teams().some(t=>t.name.toLowerCase()===name.toLowerCase()&&t.id!==body.id))fail(409,'Ya existe un equipo con ese nombre.');
          if(body.id){if(!auth.teams().some(t=>t.id===body.id))fail(404,'Equipo no encontrado.');db.prepare('UPDATE teams SET name=? WHERE id=?').run(name,body.id);}
          else db.prepare('INSERT INTO teams VALUES (?,?)').run(randomUUID(),name);
          auth.audit(actor.id,`Guardó el equipo ${name}.`);
        } else if(req.url==='/api/users') {
          requireAdmin(actor);
          const name=string(body.name,100),address=email(body.email),role=body.role,teamId=string(body.teamId,100)||null;
          if(!name||!validEmail(address)||!roles.includes(role)||typeof body.active!=='boolean')fail(422,'Completa nombre, correo, rol y estado.');
          if((role!=='admin'&&!teamId)||(teamId&&!auth.teams().some(t=>t.id===teamId)))fail(422,'Selecciona un equipo válido.');
          if(auth.users().some(u=>u.email===address&&u.id!==body.id))fail(409,'Ese correo ya está registrado.');
          const old=body.id?auth.user(body.id):null;
          if(body.id&&!old)fail(404,'Usuario no encontrado.');
          if(old){
            if(old.id===actor.id&&(!body.active||role!=='admin'))fail(422,'No puedes quitarte tu propio acceso de administrador.');
            if((!body.active||teamId!==old.teamId)&&state.leads.some(l=>l.ownerId===old.id))fail(422,'Reasigna primero todos los leads de este usuario, incluidos los cerrados.');
            db.prepare('UPDATE users SET name=?,email=?,role=?,teamId=?,active=? WHERE id=?').run(name,address,role,teamId,Number(body.active),old.id);
            if(old.role!==role||old.teamId!==teamId||!body.active||old.email!==address){
              auth.invalidate(old.id);
              if(!old.passwordHash)db.prepare('UPDATE users SET inviteHash=NULL,inviteExpires=NULL WHERE id=?').run(old.id);
            }
            for(const lead of state.leads)if(lead.ownerId===old.id)lead.owner=name;
            auth.audit(actor.id,`Actualizó a ${name}: ${roleNames[role]}, ${body.active?'activo':'desactivado'}.`);
          } else {
            if(!body.active)fail(422,'Crea el usuario activo para poder invitarlo.');
            inviteToken=token();
            db.prepare('INSERT INTO users(id,name,email,role,teamId,active,inviteHash,inviteExpires) VALUES (?,?,?,?,?,1,?,?)').run(randomUUID(),name,address,role,teamId,digest(inviteToken),Date.now()+48*3600000);
            auth.audit(actor.id,`Invitó a ${name} con rol ${roleNames[role]}.`);
          }
        } else if(req.url==='/api/users/invite') {
          requireAdmin(actor);
          const user=auth.user(body.id);
          if(!user||!user.active||user.passwordHash)fail(422,'Solo puedes renovar invitaciones de usuarios pendientes y activos.');
          inviteToken=token();db.prepare('UPDATE users SET inviteHash=?,inviteExpires=? WHERE id=?').run(digest(inviteToken),Date.now()+48*3600000,user.id);
          auth.audit(actor.id,`Renovó la invitación de ${user.name}.`);
        } else if(req.url==='/api/leads/reassign') {
          const lead=state.leads.find(l=>l.id===body.id),users=auth.users(),target=auth.user(body.ownerId);
          if(!lead||!canSeeLead(actor,lead,users))fail(404,'Lead no encontrado.');
          if(actor.role==='executive'||!canAssign(actor,target))fail(403,'No puedes reasignar a este usuario.');
          if(target.id===lead.ownerId)fail(422,'Selecciona un responsable diferente.');
          const reason=string(body.reason,2000);if(!reason)fail(422,'Indica el motivo de la reasignación.');
          state.history.unshift({id:randomUUID(),leadId:lead.id,date:new Date().toISOString(),owner:actor.name,actorId:actor.id,text:`Reasignación de ${lead.owner} a ${target.name}: ${reason}`});
          lead.ownerId=target.id;lead.owner=target.name;
          auth.audit(actor.id,`Reasignó el lead ${lead.id} a ${target.name}.`);
        } else if(req.url==='/api/leads') {
          const old=body.id?state.leads.find(l=>l.id===body.id):null,users=auth.users();
          if(body.id&&(!old||!canSeeLead(actor,old,users)))fail(404,'Lead no encontrado.');
          const ownerId=body.ownerId || (old?.ownerId ?? actor.id),target=auth.user(ownerId);
          if(!canAssign(actor,target))fail(403,'Selecciona un responsable activo dentro de tu alcance.');
          if(old&&old.ownerId!==ownerId)fail(422,'Usa Reasignar para cambiar el responsable.');
          const lead=Object.fromEntries(['name','company','email','phone','stage','channel','action','due'].map(k=>[k,string(body[k])]));
          lead.ownerId=target.id;lead.owner=target.name;
          if(!old&&state.rules.find(r=>r.id==='first').enabled){lead.action||='Primer contacto';lead.due||=new Date(Date.now()+state.settings.sla*3600000).toISOString();}
          const errors=validateLead(lead,state.settings);if(errors.length)fail(422,errors.join(' '));
          if(state.leads.some(l=>l.id!==old?.id&&((lead.email&&l.email.toLowerCase()===lead.email.toLowerCase())||(lead.phone&&l.phone.replace(/\D/g,'')===lead.phone.replace(/\D/g,'')))))fail(409,'No se puede guardar: el medio de contacto ya está registrado. Consulta al administrador.');
          const result=string(body.result,5000);if(old&&!result)fail(422,'Registra el resultado de la gestión.');
          Object.assign(lead,{id:old?.id||randomUUID(),created:old?.created||new Date().toISOString(),attempts:(old?.attempts||0)+(old?1:0),last:old?new Date().toISOString():null,escalation:0});
          if(old?.legacyOwner)lead.legacyOwner=old.legacyOwner;
          if(old)state.leads[state.leads.indexOf(old)]=lead;else state.leads.push(lead);
          state.history.unshift({id:randomUUID(),leadId:lead.id,date:new Date().toISOString(),text:old?result:'Lead creado',owner:actor.name,actorId:actor.id});
        } else if(req.url==='/api/templates') {
          if(actor.role==='executive')fail(403,'La edición de plantillas requiere supervisor o administrador.');
          const name=string(body.name,100),subject=string(body.subject,500),content=string(body.body,20000);
          if(!name||!subject||!content)fail(422,'Completa nombre, asunto y contenido.');
          if(/{{(?!nombre}}|empresa}}|ejecutivo}})[^}]*}}/.test(content+subject))fail(422,'Variables disponibles: nombre, empresa y ejecutivo.');
          const t={id:body.id||randomUUID(),name,subject,body:content},i=state.templates.findIndex(t=>t.id===body.id);
          if(body.id&&i<0)fail(404,'Plantilla no encontrada.');
          if(i<0)state.templates.push(t);else state.templates[i]=t;
        } else if(req.url==='/api/settings') {
          requireAdmin(actor);
          if(!string(body.business)||!string(body.industry)||!Number.isFinite(+body.sla)||+body.sla<1||+body.sla>720||!Array.isArray(body.required)||body.required.some(k=>!['company','email','phone'].includes(k)))fail(422,'Revisa negocio, sector, campos y SLA (1–720 horas).');
          state.settings={business:string(body.business),industry:string(body.industry),sla:+body.sla,required:body.required};
        } else if(req.url==='/api/rules') {
          requireAdmin(actor);
          const rule=state.rules.find(r=>r.id===body.id);if(!rule||typeof body.enabled!=='boolean')fail(422,'Regla no válida.');rule.enabled=body.enabled;
        } else if(req.url==='/api/integrations') {
          requireAdmin(actor);
          const integration=state.integrations.find(i=>i.channel===body.channel);
          if(!integration||!string(body.provider)||!string(body.account))fail(422,'Completa proveedor e identificador de cuenta.');
          Object.assign(integration,{provider:string(body.provider),account:string(body.account),status:'Configuración guardada · conexión pendiente'});
        } else fail(404,'Ruta no encontrada.');
      });
      // A role/team/email update may invalidate the caller's session; return only current permissions.
      const current=auth.user(actor.id);
      return reply(200,{...snapshot(current),...(inviteToken?{inviteToken}: {})});
    }
    const file={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}[req.url?.split('?')[0]];
    if(!file){res.writeHead(404);return res.end('No encontrado');}
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    res.end(readFileSync(new URL(`./public/${file}`,import.meta.url)));
  } catch(err){reply(err.status || (err instanceof SyntaxError?400:500),{error:err.status?err.message:err instanceof SyntaxError?'JSON no válido.':'No se pudo guardar. Inténtalo de nuevo.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Pulso CRM http://127.0.0.1:${server.address().port}`));
