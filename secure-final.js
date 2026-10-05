// secure-final.js — versión segura final
const AUTHF=firebase.auth();
let SEC_USER=null;
let SEC_STUDENT_UNSUB=null;
let SEC_TUTOR_UNSUBS=[];
let PUB_STUDENTS=[];
let AUTHMODE='login';

function nF(v){return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ')}
function fullF(x){return ((x.name||'')+' '+(x.surname||'')).trim()}
async function hashF(v){
  const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nF(v)));
  return Array.from(new Uint8Array(d)).map(function(x){return x.toString(16).padStart(2,'0')}).join('');
}
function emailF(key){return 'student.'+key+'@practicas-profesionales-us21.firebaseapp.com'}
function codeF(){
  const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',b=new Uint8Array(8);
  crypto.getRandomValues(b);
  return Array.from(b).map(function(x){return a[x%a.length]}).join('');
}
function clearF(){
  if(SEC_STUDENT_UNSUB){SEC_STUDENT_UNSUB();SEC_STUDENT_UNSUB=null}
  SEC_TUTOR_UNSUBS.forEach(function(f){try{f()}catch(e){}});
  SEC_TUTOR_UNSUBS=[];
}
function screenF(mode){
  AUTHMODE=mode||AUTHMODE||'login';
  const list=PUB_STUDENTS.filter(function(x){return x.active!==false}).sort(function(a,b){return fullF(a).localeCompare(fullF(b),'es')});
  const opts=list.map(function(x){return '<option value="'+esc(fullF(x))+'"></option>'}).join('');
  const tabs='<div class="tabs">'+
    '<button id="fLoginTab" class="btn tab '+(AUTHMODE==='login'?'active':'')+'">Iniciar sesión</button>'+
    '<button id="fRegisterTab" class="btn tab '+(AUTHMODE==='register'?'active':'')+'">Registrarse</button>'+
    '<button id="fTutorTab" class="btn tab '+(AUTHMODE==='tutor'?'active':'')+'">Tutor</button></div>';
  let body='';
  if(AUTHMODE==='register'){
    body='<form id="fRegisterForm" class="form"><div class="row"><div class="field"><label>Nombre</label><input id="fRegName" required></div><div class="field"><label>Apellido</label><input id="fRegSurname" required></div></div><div class="field"><label>Carrera</label><input id="fRegCareer" required placeholder="Ej. Lic. en Criminología y Seguridad"></div><button class="btn btn-primary">Registrarme</button><div class="notice">Tu alta se crea automáticamente y queda vinculada a la planilla de alumnos.</div></form>';
  }else if(AUTHMODE==='tutor'){
    body='<form id="fTutorForm" class="form"><div class="field"><label>Email del tutor</label><input id="fTutorEmail" type="email" required></div><div class="field"><label>Contraseña</label><input id="fTutorPassword" type="password" required></div><button class="btn btn-primary">Ingresar al panel de tutor</button><div class="notice">Acceso exclusivo para cuentas autorizadas.</div></form>';
  }else{
    body='<form id="fLoginForm" class="form"><div class="field"><label>Nombre</label><input id="fLoginName" list="fStudentList" autocomplete="off" required><datalist id="fStudentList">'+opts+'</datalist></div><div class="row"><div class="field"><label>Apellido</label><input id="fLoginSurname" required></div><div class="field"><label>Carrera</label><input id="fLoginCareer" required></div></div><div class="field"><label>Clave personal</label><input id="fLoginCode" type="password" minlength="8" maxlength="8" required></div><button class="btn btn-primary">Iniciar sesión</button><div class="notice">Usá la clave personal que recibiste al registrarte.</div></form>';
  }
  document.getElementById('app').innerHTML='<div class="shell"><div class="login panel"><div class="eyebrow">GESTIÓN ACADÉMICA EN LA NUBE</div><h2>PRÁCTICAS PROFESIONALES</h2><div class="subtitle">Acceso seguro y sincronizado.</div>'+tabs+body+'</div></div>';
  document.getElementById('fLoginTab').onclick=function(){screenF('login')};
  document.getElementById('fRegisterTab').onclick=function(){screenF('register')};
  document.getElementById('fTutorTab').onclick=function(){screenF('tutor')};
  const name=document.getElementById('fLoginName');
  if(name)name.oninput=function(){const st=PUB_STUDENTS.find(function(x){return x.active!==false&&nF(fullF(x))===nF(name.value)});if(st){document.getElementById('fLoginSurname').value=st.surname||'';document.getElementById('fLoginCareer').value=st.career||''}};
  const rf=document.getElementById('fRegisterForm');if(rf)rf.onsubmit=registerF;
  const lf=document.getElementById('fLoginForm');if(lf)lf.onsubmit=loginStudentF;
  const tf=document.getElementById('fTutorForm');if(tf)tf.onsubmit=loginTutorF;
}
async function anonF(){if(!AUTHF.currentUser)await AUTHF.signInAnonymously()}
async function registerF(e){
  e.preventDefault();
  try{
    await anonF();
    const name=document.getElementById('fRegName').value.trim();
    const surname=document.getElementById('fRegSurname').value.trim();
    const career=document.getElementById('fRegCareer').value.trim();
    if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}
    const key=await hashF(name+'|'+surname+'|'+career);
    const dirRef=firestore.collection('student_directory').doc(key);
    const dir=await dirRef.get();
    if(dir.exists&&dir.data().ownerUid){alert('Este alumno ya está registrado. Usá “Iniciar sesión”.');screenF('login');return}
    const password=codeF();
    const cred=await AUTHF.createUserWithEmailAndPassword(emailF(key),password);
    const uid=cred.user.uid;
    const studentId=dir.exists&&dir.data().studentId?String(dir.data().studentId):uid;
    const now=new Date().toISOString();
    await firestore.collection('student_profiles').doc(uid).set({uid:uid,studentId:studentId,name:name,surname:surname,career:career,organization:dir.exists?(dir.data().organization||''):'',referent:dir.exists?(dir.data().referent||''):'',active:true,createdAt:now,updatedAt:now},{merge:true});
    await dirRef.set({ownerUid:uid,studentId:studentId,name:name,surname:surname,career:career,active:true},{merge:true});
    SEC_USER={role:'student',uid:uid,studentId:studentId};
    session={role:'student',uid:uid,studentId:studentId,tab:'home'};
    alert('¡Registro completado!\\n\\nTu clave personal es: '+password+'\\n\\nGuardala para futuros ingresos.');
    startStudentF();
  }catch(err){console.error(err);alert(err&&err.code==='auth/email-already-in-use'?'Este alumno ya está registrado. Usá “Iniciar sesión”.':'No se pudo registrar: '+(err.message||err))}
}
async function loginStudentF(e){
  e.preventDefault();
  try{
    const name=document.getElementById('fLoginName').value.trim(),surname=document.getElementById('fLoginSurname').value.trim(),career=document.getElementById('fLoginCareer').value.trim(),password=document.getElementById('fLoginCode').value.trim();
    const key=await hashF(name+'|'+surname+'|'+career);
    const cred=await AUTHF.signInWithEmailAndPassword(emailF(key),password);
    const p=await firestore.collection('student_profiles').doc(cred.user.uid).get();
    if(!p.exists||p.data().active===false)throw new Error('Cuenta de alumno no habilitada.');
    SEC_USER={role:'student',uid:cred.user.uid,studentId:String(p.data().studentId)};
    startStudentF();
  }catch(err){console.error(err);alert('No se pudo iniciar sesión: '+(err.message||err))}
}
async function startStudentF(){
  clearF();
  const p=await firestore.collection('student_profiles').doc(SEC_USER.uid).get();
  if(!p.exists)throw new Error('Perfil de alumno no encontrado.');
  const x=p.data(),sid=String(x.studentId);
  db.students=[{id:sid,name:x.name||'',surname:x.surname||'',career:x.career||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false}];
  session={role:'student',uid:SEC_USER.uid,studentId:sid,tab:session&&session.tab?session.tab:'home'};
  SEC_STUDENT_UNSUB=firestore.collection('registros_horas').where('ownerUid','==',SEC_USER.uid).onSnapshot(function(snap){
    const rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    db.practices=rows.filter(function(x){return x.tipo==='practica'}).map(function(x){return {id:x.id,studentId:sid,date:x.fecha||'',start:x.hora_inicio||'',end:x.hora_fin||'',hours:Number(x.cantidad_horas||0),activity:x.descripcion||'',notes:x.observaciones||''}});
    db.classes=rows.filter(function(x){return x.tipo==='clase'}).map(function(x){return {id:x.id,studentId:sid,date:x.fecha||'',hours:Number(x.cantidad_horas||0),status:x.descripcion||'Presente'}});
    db.improvements=rows.filter(function(x){return x.tipo==='mejora'}).map(function(x){return {id:x.id,studentId:sid,month:x.fecha||'',text:x.descripcion||''}});
    renderStudent();
  },function(err){console.error('Sincronización alumno:',err);alert('No se pudo sincronizar tu información: '+err.message)});
  renderStudent();
}
savePractice=async function(e){
  e.preventDefault();
  try{
    const sid=SEC_USER.studentId,date=document.getElementById('pd').value,start=document.getElementById('ps').value,end=document.getElementById('pe').value,activity=document.getElementById('pa').value.trim(),notes=document.getElementById('pn').value.trim();
    const day=new Date(date+'T12:00:00').getDay();if(day===0||day===6){alert('La jornada práctica debe ser de lunes a viernes.');return}
    const a=start.split(':'),b=end.split(':'),mins=(Number(b[0])*60+Number(b[1]))-(Number(a[0])*60+Number(a[1]));if(mins<=0){alert('La hora de finalización debe ser posterior a la de inicio.');return}
    const hours=Math.round(mins/60*100)/100;if(weeklyPractice(sid,date)+hours>weekMax+1e-9){alert('Esta carga supera el máximo de '+weekMax+' horas semanales.');return}
    await firestore.collection('registros_horas').doc('p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({ownerUid:SEC_USER.uid,id_estudiante:sid,tipo:'practica',fecha:date,cantidad_horas:hours,descripcion:activity,observaciones:notes,hora_inicio:start,hora_fin:end,creado_el:new Date().toISOString(),origen:'secure-final'},{merge:false});
    session.tab='home';renderStudent();alert('Registro guardado correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar el registro: '+err.message)}
};
saveClass=async function(e){
  e.preventDefault();
  try{
    const sid=SEC_USER.studentId,date=document.getElementById('cd').value,hours=Number(document.getElementById('ch').value);
    if(!Number.isFinite(hours)||hours<=0||hours>24){alert('Ingresá horas válidas.');return}
    if(db.classes.some(function(x){return x.studentId===sid&&x.date===date})){alert('Ya existe una asistencia para esa fecha. El registro anterior se conserva.');return}
    await firestore.collection('registros_horas').doc('c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({ownerUid:SEC_USER.uid,id_estudiante:sid,tipo:'clase',fecha:date,cantidad_horas:hours,descripcion:'Presente',creado_el:new Date().toISOString(),origen:'secure-final'},{merge:false});
    session.tab='home';renderStudent();alert('Asistencia guardada correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar la asistencia: '+err.message)}
};
saveImprovement=async function(e){
  e.preventDefault();
  try{
    const sid=SEC_USER.studentId,text=document.getElementById('improvement').value.trim();
    await firestore.collection('registros_horas').doc('i-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({ownerUid:SEC_USER.uid,id_estudiante:sid,tipo:'mejora',fecha:today().slice(0,7),cantidad_horas:0,descripcion:text,creado_el:new Date().toISOString(),origen:'secure-final'},{merge:false});
    renderStudent();alert('Mejora mensual guardada correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar la mejora: '+err.message)}
};
updateStudentMeta=async function(stid,field,val){
  try{
    const payload={};payload[field]=val;payload.updatedAt=new Date().toISOString();
    await firestore.collection('student_profiles').doc(SEC_USER.uid).set(payload,{merge:true});
  }catch(err){console.error(err);alert('No se pudo sincronizar el dato del alumno: '+err.message)}
};
async function loginTutorF(e){
  e.preventDefault();
  try{
    const cred=await AUTHF.signInWithEmailAndPassword(document.getElementById('fTutorEmail').value.trim(),document.getElementById('fTutorPassword').value);
    const t=await firestore.collection('tutores').doc(cred.user.uid).get();
    if(!t.exists||t.data().active===false)throw new Error('Cuenta no autorizada como tutor.');
    SEC_USER={role:'tutor',uid:cred.user.uid,tutor:t.data().name||cred.user.email};
    session={role:'tutor',uid:cred.user.uid,tutor:SEC_USER.tutor,tab:'dashboard'};
    startTutorF();
  }catch(err){console.error(err);alert('No se pudo ingresar al panel de tutor: '+(err.message||err))}
}
function startTutorF(){
  clearF();
  const dir=firestore.collection('student_directory').onSnapshot(function(snap){
    db.students=snap.docs.map(function(d){const x=d.data()||{};return {id:String(x.studentId||d.id),name:x.name||'',surname:x.surname||'',career:x.career||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false}});
    if(session&&session.role==='tutor')renderTutor();
  },function(err){console.error('Directorio tutor:',err)});
  const reg=firestore.collection('registros_horas').onSnapshot(function(snap){
    const rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    db.practices=rows.filter(function(x){return x.tipo==='practica'}).map(function(x){return {id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',start:x.hora_inicio||'',end:x.hora_fin||'',hours:Number(x.cantidad_horas||0),activity:x.descripcion||'',notes:x.observaciones||''}});
    db.classes=rows.filter(function(x){return x.tipo==='clase'}).map(function(x){return {id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',hours:Number(x.cantidad_horas||0),status:x.descripcion||'Presente'}});
    db.improvements=rows.filter(function(x){return x.tipo==='mejora'}).map(function(x){return {id:x.id,studentId:String(x.id_estudiante||''),month:x.fecha||'',text:x.descripcion||''}});
    if(session&&session.role==='tutor')renderTutor();
  },function(err){console.error('Registros tutor:',err)});
  TUTORUNSUBS=[dir,reg];
  renderTutor();
}
function tutorActivityF(){
  const rows=[].concat(
    db.practices.map(function(x){return {date:x.date,studentId:x.studentId,type:'Práctica',hours:x.hours,text:(x.activity||'')+(x.notes?' · '+x.notes:'')}}),
    db.classes.map(function(x){return {date:x.date,studentId:x.studentId,type:'Clase',hours:x.hours,text:x.status||''}}),
    db.improvements.map(function(x){return {date:x.month,studentId:x.studentId,type:'Mejora mensual',hours:null,text:x.text||''}})
  ).sort(function(a,b){return String(b.date).localeCompare(String(a.date))});
  return '<section class="panel"><div class="section-head"><h2>Historial completo de cargas</h2><span class="badge">'+rows.length+' registros · no se elimina ningún registro</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Fecha</th><th>Alumno</th><th>Carrera</th><th>Tipo</th><th>Horas</th><th>Contenido</th></tr></thead><tbody>'+rows.map(function(r){const st=db.students.find(function(s){return String(s.id)===String(r.studentId)});return '<tr><td>'+fmtDate(r.date)+'</td><td><strong>'+esc(fullF(st||{}))+'</strong></td><td>'+esc(st?st.career||'':'')+'</td><td>'+esc(r.type)+'</td><td>'+((r.hours===null)?'—':fmt(r.hours))+'</td><td>'+esc(r.text||'')+'</td></tr>'}).join('')+'</tbody></table></div></section>';
}
const renderTutorBaseF=renderTutor;
renderTutor=function(){
  if(session&&session.role==='tutor'&&session.tab==='history'){
    document.getElementById('app').innerHTML=layout(
      '<div class="hero"><div><div class="eyebrow">Panel de tutores</div><div class="title">Historial completo</div><div class="muted">Todas las cargas de todos los alumnos.</div></div></div>'+
      '<div class="nav-tabs"><button class="btn" onclick='session.tab="dashboard";renderTutor()'>Dashboard</button><button class="btn" onclick='session.tab="students";renderTutor()'>Alumnos</button><button class="btn active">Historial</button></div>'+tutorActivityF(),
      'TUTOR · '+session.tutor
    );
    return;
  }
  renderTutorBaseF();
  const nav=document.querySelector('.nav-tabs');
  if(nav&&!nav.querySelector('[data-sec-history]')){
    const b=document.createElement('button');b.className='btn';b.textContent='Historial';b.setAttribute('data-sec-history','1');b.onclick=function(){session.tab='history';renderTutor()};nav.appendChild(b);
  }
};
async function safeSaveStudentF(e){
  e.preventDefault();
  try{
    if(!SEC_USER||SEC_USER.role!=='tutor')throw new Error('Sesión de tutor inválida.');
    const idVal=document.getElementById('sid').value,name=document.getElementById('sn').value.trim(),surname=document.getElementById('ss').value.trim(),career=document.getElementById('sc').value.trim(),organization=document.getElementById('so').value.trim(),referent=document.getElementById('sr').value.trim(),active=document.getElementById('sa').checked;
    if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}
    const key=await hashF(name+'|'+surname+'|'+career);
    const ref=firestore.collection('student_directory').doc(key);
    const payload={name:name,surname:surname,career:career,organization:organization,referent:referent,active:active,studentId:idVal||('stu-'+key.slice(0,20)),updatedAt:new Date().toISOString()};
    await ref.set(payload,{merge:true});
    clearStudentForm();renderTutor();alert('Alumno guardado correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar el alumno: '+err.message)}
}
saveStudent=safeSaveStudentF;
deleteStudent=async function(id){
  try{
    if(!SEC_USER||SEC_USER.role!=='tutor')throw new Error('Sesión de tutor inválida.');
    const st=(db.students||[]).find(function(x){return String(x.id)===String(id)});if(!st)return;
    if(!confirm('¿Deshabilitar a '+fullF(st)+'? Sus datos y registros se conservarán.'))return;
    const key=await hashF((st.name||'')+'|'+(st.surname||'')+'|'+(st.career||''));
    await firestore.collection('student_directory').doc(key).set({active:false,updatedAt:new Date().toISOString()},{merge:true});
    renderTutor();alert('Alumno deshabilitado. No se borró ningún registro.');
  }catch(err){console.error(err);alert('No se pudo deshabilitar al alumno: '+err.message)}
};
saveSettings=async function(){alert('La configuración de acceso se administra en Firebase Authentication y Firestore.')};
addTutorPin=async function(){alert('Para agregar un tutor hay que crear primero su cuenta en Firebase Authentication y vincularla con un documento en Firestore.')};
removeTutor=async function(){alert('Las cuentas de tutor se administran desde Firebase Authentication.')};
window.logout=async function(){clearF();SEC_USER=null;session=null;await AUTHF.signOut();await anonF();screenF('login')};
async function bootSecureFinal(){
  try{
    await anonF();
    screenF('login');
  }catch(err){console.error('Firebase:',err);alert('No se pudo iniciar la conexión segura con Firebase: '+err.message)}
}
bootSecureFinal();

