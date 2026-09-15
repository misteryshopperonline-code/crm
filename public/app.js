const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state,view='Mi día',filter='all',query='',authMode='login';
const roleNames={admin:'Administrador',supervisor:'Supervisor',executive:'Ejecutivo'};
let activationToken=new URLSearchParams(location.hash.slice(1)).get('invite')||'';
if(activationToken)history.replaceState(null,'',location.pathname);
const isAdmin=()=>state?.currentUser.role==='admin';
const canManage=()=>state?.currentUser.role!=='executive';
const channels=['Correo','WhatsApp','SMS','RCS','Telefonía'],stages=['Nuevo','Contactado','Calificado','Propuesta','Ganado','No viable'];
const nav=[['◷','Mi día'],['▤','Leads'],['♙','Equipo'],['▧','Plantillas'],['⚡','Automatizaciones'],['⇄','Canales'],['⚙','Configuración']];
const status=l=>['Ganado','No viable'].includes(l.stage)?'closed':!l.due?'missing':new Date(l.due)<new Date()?'overdue':new Date(l.due)-Date.now()<86400000?'today':'upcoming';
const date=d=>d?new Date(d).toLocaleString('es-EC',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Sin fecha';
function notify(t){$('#toast').textContent=t;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4000);}
async function request(path,data){
 const r=await fetch('/api/'+path,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});
 const v=await r.json();
 if(!r.ok){if(r.status===401&&state){state=null;$('#dialog').close();renderAuth('login');}throw Error(v.error);}
 return v;
}
async function api(path,data){const v=await request(path,data);if(v.currentUser){const {inviteToken,...next}=v;state=next;}return v;}
function renderAuth(mode){
 authMode=mode;document.body.classList.add('auth-mode');$('#auth-screen').hidden=false;$('#content').replaceChildren();$('#nav').replaceChildren();$('#modal').replaceChildren();$('.sidebar-bottom').replaceChildren();
 $('#auth-screen').innerHTML=`<div class="auth-brand">▥ pulso <span>CRM</span></div><div class="auth-card"><span class="tag">TU EQUIPO, CONECTADO</span><h1>${mode==='setup'?'Tu espacio empieza aquí.':mode==='activate'?'Bienvenido a tu equipo.':'Retoma tu próximo paso.'}</h1><p>${mode==='setup'?'Crea el administrador de este espacio. Los leads existentes se conservarán y quedarán a tu cargo para reasignarlos.':mode==='activate'?'Usa la invitación de tu administrador y elige tu contraseña.':'Inicia sesión para ver tus leads y pendientes.'}</p><form id="auth-form">${mode==='setup'?field('Tu nombre','name'):''}${mode==='activate'?field('Código de invitación','token',activationToken):field('Correo','email','','email')}<label>Contraseña<input name="password" type="password" required ${mode==='login'?'':'minlength="12" maxlength="128"'} autocomplete="${mode==='login'?'current-password':'new-password'}"></label>${mode!=='login'?'<label>Confirmar contraseña<input name="confirmPassword" type="password" required autocomplete="new-password"></label><p class="muted">Entre 12 y 128 caracteres. Puedes usar una frase larga.</p>':''}<p id="auth-error" class="error" role="alert"></p><button class="primary">${mode==='setup'?'Crear mi espacio':mode==='activate'?'Activar mi cuenta':'Iniciar sesión'}</button></form>${mode==='login'?'<button class="text-button" data-auth="activate">Tengo una invitación</button>':mode==='activate'?'<button class="text-button" data-auth="login">Volver al inicio de sesión</button>':''}<div class="auth-note">Espacio local · Tus datos permanecen en este equipo</div></div>`;
}
function showInvitation(value){
 modal(`<span class="tag">INVITACIÓN CREADA</span><h2>Listo para sumarse al equipo</h2><p>Comparte este enlace por un medio privado. Vence en 48 horas y solo puede utilizarse una vez. No se ha enviado ningún correo.</p><label>Enlace de activación<input readonly value="${esc(location.origin+'/#invite='+value)}"></label><p class="muted">Esta edición funciona en este equipo. El enlace localhost solo abrirá este CRM desde aquí; el acceso desde otros equipos requiere un despliegue posterior.</p><button data-action="close" class="primary">Entendido</button>`);
}

function title(name,sub,button=''){return `<div class="title"><div><div class="eyebrow">TU OPERACIÓN, EN ORDEN</div><h1>${name}</h1><p>${sub}</p></div>${button}</div>`;}
const btn=(label,action,cls='primary')=>`<button class="${cls}" data-action="${action}">${label}</button>`;
function render(){
 if(!state?.currentUser)return;
 document.body.classList.remove('auth-mode');$('#auth-screen').hidden=true;$('#auth-screen').replaceChildren();
 if(!isAdmin()&&['Configuración','Canales','Automatizaciones'].includes(view))view='Mi día';
 $('.sidebar-bottom').innerHTML=`<span class="avatar">${esc(state.currentUser.name.slice(0,2).toUpperCase())}</span><div><strong>${esc(state.currentUser.name)}</strong><small>${roleNames[state.currentUser.role]}</small><button class="text-button" data-action="profile">Mi cuenta</button><button class="text-button" data-action="logout">Salir</button></div>`;
 $('#business').textContent=state.settings.business;$('#breadcrumb').textContent=view;
 $('#nav').innerHTML=nav.filter(([,n])=>isAdmin()||!['Configuración','Canales','Automatizaciones'].includes(n)).map(([i,n])=>`<button class="${view===n?'active':''}" data-view="${n}"><span>${i}</span>${n}${n==='Mi día'?`<small>${state.leads.filter(l=>['today','overdue','missing'].includes(status(l))).length}</small>`:''}</button>`).join('');
 if(view==='Mi día'||view==='Leads')dashboard();
 if(view==='Equipo')teamView();
 if(view==='Plantillas')$('#content').innerHTML=title('Una buena conversación<br>empieza aquí.','Plantillas de correo reutilizables para cada etapa.',canManage()?btn('+ Nueva plantilla','template'):'')+`<div class="grid">${state.templates.map(t=>`<article class="panel"><span class="tag">CORREO</span><h2>${esc(t.name)}</h2><strong>${esc(t.subject)}</strong><p class="preview">${esc(t.body)}</p><div class="actions">${canManage()?`<button data-template="${t.id}">Editar plantilla</button>`:''}<button data-preview="${t.id}">Vista previa</button></div></article>`).join('')}</div>`;
 if(view==='Automatizaciones')$('#content').innerHTML=title('El seguimiento continúa.','Reglas internas que se ejecutan mientras el servidor está encendido.')+state.rules.map(r=>`<article class="panel rule"><div class="rule-icon">⚡</div><div><span class="tag">${esc(r.event)}</span><h2>${esc(r.name)}</h2><p>${esc(r.description)}</p></div><button class="${r.enabled?'enabled':''}" data-rule="${r.id}" aria-pressed="${r.enabled}">${r.enabled?'Activa ✓':'Pausada'}</button></article>`).join('')+`<div class="note">Siempre obligatorio: al registrar una gestión, indicar resultado y próxima acción con fecha, salvo que el lead se cierre. Las alertas de escalamiento aparecen en el tablero; no envían mensajes externos.</div>`;
 if(view==='Canales')$('#content').innerHTML=title('Todas las conversaciones.<br>Un mismo seguimiento.','Prepara tus cuentas. La autenticación y el envío se habilitarán por canal.')+`<div class="grid">${state.integrations.map((i,n)=>`<article class="panel"><div class="channel-icon">${['✉','◉','▤','◈','☎'][n]}</div><h2>${i.channel}</h2><span class="tag neutral">${esc(i.status)}</span><p>${esc(i.provider||'Selecciona el proveedor de tu negocio.')}</p><button data-channel="${i.channel}">Configurar canal ↗</button></article>`).join('')}</div><div class="note">No hay envíos ni recepción activos. No ingreses contraseñas o tokens aquí; la conexión segura con proveedores forma parte de la siguiente iteración.</div>`;
 if(view==='Configuración')$('#content').innerHTML=title('A la medida de tu negocio.','Define lo esencial una vez. El equipo sigue las mismas reglas.')+`<form id="settings" class="panel settings"><h2>Tu negocio</h2>${field('Nombre del negocio','business',state.settings.business)}${field('Sector','industry',state.settings.industry)}${field('Tiempo máximo para primer contacto (horas)','sla',state.settings.sla,'number')}<h2>Calidad de los datos</h2><p>Nombre, responsable, estado y un medio de contacto son obligatorios. Todo lead abierto necesita próxima acción y fecha.</p><h3>Campos obligatorios adicionales</h3>${['company','email','phone'].map((k,i)=>`<label class="check"><input type="checkbox" name="required" value="${k}" ${state.settings.required.includes(k)?'checked':''}>${['Empresa','Correo','Teléfono'][i]}</label>`).join('')}<p class="muted">Las nuevas reglas se aplican al crear o gestionar leads. Revisa los registros anteriores antes de ampliar requisitos.</p><button class="primary">Guardar configuración</button></form>`;
}
function dashboard(){
 const count=k=>state.leads.filter(l=>status(l)===k).length;
 const list=state.leads.filter(l=>(view==='Leads'||status(l)!=='closed')&&(filter==='all'||status(l)===filter)&&`${l.name} ${l.company} ${l.owner}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>new Date(a.due)-new Date(b.due));
 $('#content').innerHTML=title(view==='Mi día'?'Cada lead, un próximo paso.':'Tu próxima oportunidad.','Prioriza lo pendiente y mantén cada conversación en movimiento.',btn('+ Nuevo lead','lead'))+`<div class="metrics">${[['overdue','Vencidos','Necesitan tu atención','red'],['today','Próximas 24 horas','El siguiente paso es hoy','amber'],['upcoming','Programados','Cada oportunidad en marcha','green'],['missing','Sin próxima acción','Ningún lead debe quedar atrás','slate']].map(([k,t,s,c])=>`<button class="metric ${c} ${filter===k?'selected':''}" data-filter="${k}"><span>${t}<b>↗</b></span><strong>${count(k)}</strong><small>${s}</small></button>`).join('')}</div><div class="toolbar"><div><h2>${view==='Mi día'?'Tu agenda de seguimiento':'Directorio de leads'} <span class="number">${list.length}</span></h2><p>Una gestión completa siempre deja el siguiente paso definido.</p></div><input id="search" placeholder="Buscar lead, empresa o ejecutivo" aria-label="Buscar leads" value="${esc(query)}"></div><div class="filters">${[['all','Todos'],['overdue','Vencidos'],['today','Próximas 24 h'],['upcoming','Programados'],...(view==='Leads'?[['closed','Cerrados']]:[])].map(([k,n])=>`<button data-filter="${k}" class="${filter===k?'chosen':''}">${n}</button>`).join('')}</div><div class="lead-list">${list.length?list.map(l=>`<article class="lead-row"><div class="person"><span class="avatar">${esc(l.name.slice(0,2).toUpperCase())}</span><div><h3>${esc(l.name)}</h3><p>${esc(l.company||'Contacto individual')} · ${esc(l.stage)}</p></div></div><div><strong>${esc(l.action||l.stage)}</strong><p>${esc(l.channel)} · ${esc(l.owner)}</p></div><div><span class="deadline ${status(l)}">${date(l.due)}</span><p>${l.escalation?'Escalamiento nivel '+l.escalation:l.attempts+' gestiones registradas'}</p></div><div class="lead-actions"><button data-lead="${l.id}">Registrar gestión ↗</button>${canManage()?`<button class="text-button" data-reassign="${l.id}">Reasignar</button>`:''}</div></article>`).join(''):`<div class="empty"><span>✓</span><h2>${state.leads.length?'No hay leads en esta vista':'Tu seguimiento empieza con un lead'}</h2><p>${state.leads.length?'Cambia los filtros para ver otras oportunidades.':'Crea tu primer contacto. Cada lead tendrá un responsable y un próximo paso.'}</p>${btn('+ Crear lead','lead')}</div>`}</div><div class="footnote">◷ Las prioridades se calculan con la fecha y hora de este dispositivo.</div>`;
}
function field(label,name,value='',type='text',required=true){return `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${type==='number'?'min="1" max="720"':''}></label>`;}
function select(label,name,options,value){return `<label>${label}<select name="${name}">${options.map(o=>`<option ${o===value?'selected':''}>${esc(o)}</option>`).join('')}</select></label>`;}
function modal(html){$('#modal').innerHTML=`<button class="close" data-action="close" aria-label="Cerrar">×</button>${html}<p id="error" role="alert"></p>`;$('#dialog').showModal();}
function leadModal(id){const l=state.leads.find(l=>l.id===id)||{};const due=new Date(Date.now()+state.settings.sla*3600000);const local=new Date(due-due.getTimezoneOffset()*60000).toISOString().slice(0,16);modal(`<h2>${id?'Registrar gestión':'Nuevo lead'}</h2><p>Completa los datos y deja definido el próximo paso.</p><form id="lead-form" data-id="${id||''}"><div class="form-grid">${field('Nombre','name',l.name)}${field('Empresa','company',l.company,'text',state.settings.required.includes('company'))}${field('Correo','email',l.email,'email',state.settings.required.includes('email'))}${field('Teléfono','phone',l.phone,'tel',state.settings.required.includes('phone'))}${id?`<label>Responsable<input value="${esc(l.owner)}" readonly></label><input type="hidden" name="ownerId" value="${esc(l.ownerId)}">`:userSelect('Responsable','ownerId',state.currentUser.id)}${select('Estado','stage',stages,l.stage)}${select('Canal preferido','channel',channels,l.channel)}${field('Próxima acción','action',l.action||'Primer contacto','text',false)}${field('Fecha y hora próxima acción','due',local,'datetime-local',false)}</div>${id?'<label>Resultado de esta gestión<textarea name="result" required placeholder="¿Qué ocurrió en el contacto?"></textarea></label>':''}<button class="primary">${id?'Guardar gestión y siguiente paso':'Crear lead'}</button></form>${id?`<h3>Historial</h3><div class="history">${state.history.filter(h=>h.leadId===id).map(h=>`<p><small>${date(h.date)} · ${esc(h.owner)}</small><br>${esc(h.text)}</p>`).join('')}</div>`:''}`);}
function templateModal(id){const t=state.templates.find(t=>t.id===id)||{};modal(`<h2>${id?'Editar':'Nueva'} plantilla</h2><form id="template-form" data-id="${id||''}">${field('Nombre','name',t.name)}${field('Asunto','subject',t.subject)}<label>Contenido<textarea name="body" rows="8" required>${esc(t.body||'')}</textarea></label><p>Variables: {{nombre}}, {{empresa}}, {{ejecutivo}}</p><button class="primary">Guardar plantilla</button></form>`);}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;try{
 if(b.dataset.auth){renderAuth(b.dataset.auth);return;}
 if(b.dataset.action==='logout'){await request('auth/logout',{});state=null;view='Mi día';renderAuth('login');return;}
 if(b.dataset.action==='profile'){modal(`<h2>Mi cuenta</h2><p>${esc(state.currentUser.name)} · ${roleNames[state.currentUser.role]}</p><form id="password-form">${field('Contraseña actual','currentPassword','','password')}${field('Nueva contraseña','password','','password')}${field('Confirmar contraseña','confirmPassword','','password')}<p>Entre 12 y 128 caracteres. Se cerrarán tus otras sesiones.</p><button class="primary">Cambiar contraseña</button></form>`);return;}
 if(b.dataset.action==='user')userModal();
 if(b.dataset.user)userModal(b.dataset.user);
 if(b.dataset.action==='team')teamModal();
 if(b.dataset.team)teamModal(b.dataset.team);
 if(b.dataset.invite){const v=await api('users/invite',{id:b.dataset.invite});render();showInvitation(v.inviteToken);}
 if(b.dataset.reassign){const l=state.leads.find(l=>l.id===b.dataset.reassign);modal(`<h2>Reasignar lead</h2><p>${esc(l.name)} · Responsable actual: ${esc(l.owner)}</p><form id="reassign-form" data-id="${l.id}">${userSelect('Nuevo responsable','ownerId',l.ownerId)}${field('Motivo','reason')}<button class="primary">Reasignar</button></form>`);}

 if(b.dataset.view){view=b.dataset.view;filter='all';query='';render();}
 if(b.dataset.filter){filter=b.dataset.filter;render();}
 if(b.dataset.action==='lead')leadModal();if(b.dataset.lead)leadModal(b.dataset.lead);
 if(b.dataset.action==='close')$('#dialog').close();
 if(b.dataset.action==='template')templateModal();if(b.dataset.template)templateModal(b.dataset.template);
 if(b.dataset.preview){const t=state.templates.find(t=>t.id===b.dataset.preview);const replace=s=>s.replaceAll('{{nombre}}','Alex').replaceAll('{{empresa}}',state.settings.business).replaceAll('{{ejecutivo}}','Tu ejecutivo');modal(`<span class="tag">EJEMPLO · SIN ENVÍO</span><h2>${esc(replace(t.subject))}</h2><p class="preview">${esc(replace(t.body))}</p>`);}
 if(b.dataset.rule){const r=state.rules.find(r=>r.id===b.dataset.rule);await api('rules',{id:r.id,enabled:!r.enabled});render();}
 if(b.dataset.channel){const i=state.integrations.find(i=>i.channel===b.dataset.channel);modal(`<h2>Configurar ${esc(i.channel)}</h2><p>Guarda los datos de referencia de tu proveedor.</p><form id="channel-form" data-channel="${i.channel}">${field('Proveedor','provider',i.provider)}${field('Identificador público de cuenta (sin claves)','account',i.account)}<button class="primary">Guardar configuración</button></form>`);}
 }catch(e){notify(e.message);}});
document.addEventListener('input',e=>{if(e.target.id==='search'){const p=e.target.selectionStart;query=e.target.value;dashboard();$('#search').focus();$('#search').setSelectionRange(p,p);}});
document.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),b=f.querySelector('button');b.disabled=true;
 try{
  if(f.id==='auth-form'){
   if(authMode!=='login'&&d.password!==d.confirmPassword)throw Error('Las contraseñas no coinciden.');
   await api('auth/'+authMode,d);activationToken='';view='Mi día';render();return;
  }
  if(f.id==='password-form'){
   if(d.password!==d.confirmPassword)throw Error('Las contraseñas no coinciden.');
   await api('auth/password',d);$('#dialog').close();render();notify('Contraseña actualizada');return;
  }
  let path;
  if(f.id==='lead-form'){path='leads';d.id=f.dataset.id;if(d.due)d.due=new Date(d.due).toISOString();}
  if(f.id==='reassign-form'){path='leads/reassign';d.id=f.dataset.id;}
  if(f.id==='user-form'){path='users';d.id=f.dataset.id;d.active=d.active==='on';}
  if(f.id==='team-form'){path='teams';d.id=f.dataset.id;}
  if(f.id==='template-form'){path='templates';d.id=f.dataset.id;}
  if(f.id==='channel-form'){path='integrations';d.channel=f.dataset.channel;}
  if(f.id==='settings'){path='settings';d.required=new FormData(f).getAll('required');}
  if(!path)return;
  const result=await api(path,d);$('#dialog').close();render();
  if(result.inviteToken)showInvitation(result.inviteToken);else notify('Cambios guardados');
 }catch(err){
  if(f.id==='auth-form')$('#auth-error').textContent=err.message;
  else if($('#dialog').open)$('#error').textContent=err.message;
  else notify(err.message);
 }finally{b.disabled=false;}
});
function userSelect(label,name,value){return `<label>${label}<select name="${name}" required>${state.assignableUsers.map(u=>`<option value="${u.id}" ${u.id===value?'selected':''}>${esc(u.name)} · ${esc(state.teams.find(t=>t.id===u.teamId)?.name||'Administración')}</option>`).join('')}</select></label>`;}
function teamModal(id){const t=state.teams.find(t=>t.id===id)||{};modal(`<h2>${id?'Editar':'Nuevo'} equipo</h2><form id="team-form" data-id="${id||''}">${field('Nombre del equipo','name',t.name)}<button class="primary">Guardar equipo</button></form>`);}
function userModal(id){
 const u=state.users.find(u=>u.id===id)||{role:'executive',active:true,teamId:state.teams[0]?.id};
 modal(`<h2>${id?'Editar usuario':'Invitar a una persona'}</h2><p>${id?'Los cambios de permisos cierran las sesiones del usuario.':'Cada persona elegirá su contraseña con una invitación de un solo uso.'}</p><form id="user-form" data-id="${id||''}">${field('Nombre','name',u.name)}${field('Correo','email',u.email,'email')}<div class="form-grid"><label>Rol<select name="role">${Object.entries(roleNames).map(([k,n])=>`<option value="${k}" ${k===u.role?'selected':''}>${n}</option>`).join('')}</select></label><label>Equipo<select name="teamId"><option value="">Sin equipo (solo administrador)</option>${state.teams.map(t=>`<option value="${t.id}" ${t.id===u.teamId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label></div><label class="check"><input type="checkbox" name="active" ${u.active?'checked':''}>Usuario activo</label><div class="permission-hint"><strong>Alcance por rol</strong><p>Ejecutivo: sus leads. Supervisor: leads de su equipo y plantillas. Administrador: todo el espacio y su configuración.</p></div><button class="primary">${id?'Guardar usuario':'Crear invitación'}</button></form>`);
}
function teamView(){
 const admin=isAdmin();
 $('#content').innerHTML=title(admin?'Un equipo. Cada responsabilidad clara.':'Tu equipo, al día.',admin?'Organiza personas, permisos y carga de seguimiento.':'El estado del seguimiento dentro de tu alcance.',admin?btn('+ Invitar persona','user'):'')+
 `<div class="team-toolbar"><h2>${admin?'Equipos':'Tu equipo'}</h2>${admin?btn('+ Nuevo equipo','team','') :''}</div><div class="team-grid">${state.teams.map(t=>`<article class="panel"><span class="tag">EQUIPO</span><h2>${esc(t.name)}</h2><p>${state.users.filter(u=>u.teamId===t.id&&u.active&&!u.pending).length} personas activas</p>${admin?`<button data-team="${t.id}">Editar equipo</button>`:''}</article>`).join('')}</div><div class="team-toolbar"><h2>Personas y seguimiento</h2><span class="muted">${state.users.length} personas visibles</span></div><div class="people-list">${state.users.map(u=>{
 const leads=state.leads.filter(l=>l.ownerId===u.id),overdue=leads.filter(l=>status(l)==='overdue').length,open=leads.filter(l=>status(l)!=='closed').length;
 return `<article class="person-row"><div class="person"><span class="avatar">${esc(u.name.slice(0,2).toUpperCase())}</span><div><h3>${esc(u.name)}</h3><p>${roleNames[u.role]} · ${esc(state.teams.find(t=>t.id===u.teamId)?.name||'Administración')}</p>${admin?`<p>${esc(u.email)}</p>`:''}</div></div><span class="tag ${!u.active||u.pending?'neutral':''}">${!u.active?'Desactivado':u.pending?'Invitación pendiente':'Activo'}</span><div><strong>${open} abiertos</strong><p class="${overdue?'error':''}">${overdue} vencidos</p></div>${admin?`<div class="actions"><button data-user="${u.id}">Editar</button>${u.pending&&u.active?`<button data-invite="${u.id}">Renovar invitación</button>`:''}</div>`:''}</article>`;
 }).join('')}</div>${admin?`<div class="team-toolbar"><h2>Actividad administrativa</h2></div><div class="panel audit-list">${state.audit.length?state.audit.map(a=>`<p><small>${date(a.date)} · ${esc(state.users.find(u=>u.id===a.actorId)?.name||'Usuario')}</small><br>${esc(a.text)}</p>`).join(''):'Aún no hay cambios registrados.'}</div>`:''}`;
}
try{
 const status=await request('auth/status');
 if(status.needsSetup)renderAuth('setup');
 else if(activationToken)renderAuth('activate');
 else {try{await api('state');render();}catch(e){renderAuth('login');}}
}catch(e){$('#content').textContent='No se pudo cargar el CRM. Recarga la página para reintentar.';}
setInterval(async()=>{
 if(state&&!$('#dialog').open&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
  try{await api('state');render();}catch(e){if(state)notify('No se pudo actualizar el tablero.');}
 }
},60000);
