// PRÁCTICAS PROFESIONALES - sincronización V6
// Alta pública mediante transacción sobre main_data + cargas independientes en registros_horas.
const baseLoginV6=login;
function norm6(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ')}
function full6(s){return s?((s.name||s.nombre||'')+' '+(s.surname||s.apellido||'')).trim():'—'}
function code6(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=new Uint8Array(8);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);let o='';for(let i=0;i<8;i++)o+=chars[a[i]%chars.length];return o}
async function hash6(v){const d=new TextEncoder().encode(norm6(v));if(window.crypto&&crypto.subtle){const h=await crypto.subtle.digest('SHA-256',d);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('')}return btoa(unescape(encodeURIComponent(norm6(v))))}
function studentFromLegacy6(x){return {id:String(x.id||''),name:x.name||x.nombre||'',surname:x.surname||x.apellido||'',career:x.career||x.carrera||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false,accessCodeHash:x.accessCodeHash||''}}
let authModeV6='login';
function login6(mode){
  mode=mode||authModeV6||'login';
  authModeV6=mode;
  const list=((db.students||[]).filter(s=>s.active!==false).sort((a,b)=>full6(a).localeCompare(full6(b),'es')))
    .map(s=>'<option value="'+esc(full6(s))+'"></option>').join('');
  const tutor=(mode==='tutor');
  document.getElementById('app').innerHTML='<div class="shell"><div class="login panel">'+
    '<div class="eyebrow">GESTIÓN ACADÉMICA EN LA NUBE</div><h2>PRÁCTICAS PROFESIONALES</h2>'+
    '<div class="subtitle">Acceso seguro y sincronizado con la planilla de alumnos.</div>'+
    '<div class="tabs">'+
      '<button id="v6Login" class="btn tab '+(mode==='login'?'active':'')+'" onclick="login6(\'login\')">Iniciar sesión</button>'+
      '<button id="v6Register" class="btn tab '+(mode==='register'?'active':'')+'" onclick="login6(\'register\')">Registrarse</button>'+
      '<button id="v6Tutor" class="btn tab '+(mode==='tutor'?'active':'')+'" onclick="login6(\'tutor\')">Tutor</button>'+
    '</div>'+
    (tutor?'<div id="v6TutorBox"><form class="form" onsubmit="tutorLoginV6(event)"><div class="field"><label>PIN de tutor</label><input id="v6Pin" type="password" inputmode="numeric" required></div><button class="btn btn-primary">Ingresar al panel de tutor</button></form></div>':mode==='register'?'<div id="v6RegisterBox"><form class="form" onsubmit="studentRegisterV6(event)"><div class="row"><div class="field"><label>Nombre</label><input id="v6Name" required></div><div class="field"><label>Apellido</label><input id="v6Surname" required></div></div><div class="field"><label>Carrera</label><input id="v6Career" required placeholder="Ej. Lic. en Criminología y Seguridad"></div><button class="btn btn-primary">Registrarme</button><div class="notice">Al registrarte quedás incorporado directamente a la planilla de alumnos y recibís una clave personal.</div></form></div>':'<div id="v6LoginBox"><form class="form" onsubmit="studentLoginV6(event)"><div class="field"><label>Nombre</label><input id="v6LoginName" list="v6Students" autocomplete="off" oninput="auto6()" required><datalist id="v6Students">'+list+'</datalist></div><div class="field"><label>Apellido</label><input id="v6LoginSurname" required></div><div class="field"><label>Clave de acceso</label><input id="v6Code" type="password" minlength="8" maxlength="8" required placeholder="Tu clave personal"></div><button class="btn btn-primary">Iniciar sesión</button><div class="notice">Usá la clave personal que recibiste al registrarte.</div></form></div>')+
  '</div></div>';
}
function auto6(){const n=document.getElementById('v6LoginName'),s=document.getElementById('v6LoginSurname');if(!n||!s)return;const st=(db.students||[]).find(x=>x.active!==false&&norm6(full6(x))===norm6(n.value));if(st)s.value=st.surname||''}
async function studentRegisterV6(e){
  e.preventDefault();
  const name=document.getElementById('v6Name').value.trim();
  const surname=document.getElementById('v6Surname').value.trim();
  const career=document.getElementById('v6Career').value.trim();
  if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}
  const existing=(db.students||[]).find(s=>norm6(s.name)===norm6(name)&&norm6(s.surname)===norm6(surname)&&norm6(s.career)===norm6(career));
  if(existing&&existing.accessCodeHash){alert('Este alumno ya está registrado. Usá “Iniciar sesión”.');login6('login');return}
  const studentId=existing?String(existing.id):('stu-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));
  const access=code6(),hash=await hash6(access),now=new Date().toISOString();
  try{
    const ref=firestore.collection('registros_horas').doc('alumno-'+studentId);
    if((await ref.get()).exists){alert('Este alumno ya está registrado. Usá “Iniciar sesión”.');login6('login');return}
    await ref.set({id_estudiante:studentId,tipo:'registro_alumno',nombre:name,apellido:surname,carrera:career,nombreCompleto:(name+' '+surname).trim(),accessCodeHash:hash,accessCodeVersion:1,active:true,createdAt:today(),creado_el:now,organization:'',referent:'',origen:'v7'},{merge:false});
    if(!Array.isArray(db.__registeredStudentsV6))db.__registeredStudentsV6=[];
    db.__registeredStudentsV6.push({id:studentId,name,surname,career,organization:'',referent:'',active:true,accessCodeHash:hash});
    db.students.push({id:studentId,name,surname,career,organization:'',referent:'',active:true,accessCodeHash:hash});
    session={role:'student',studentId,tab:'home'};
    renderStudent();
    alert('¡Registro completado!\n\nTu clave personal es: '+access+'\n\nGuardala para futuros ingresos.');
  }catch(err){console.error(err);alert('No se pudo registrar al alumno en la planilla: '+err.message)}
}
async function studentLoginV6(e){
  e.preventDefault();
  const name=document.getElementById('v6LoginName').value.trim(),surname=document.getElementById('v6LoginSurname').value.trim(),access=document.getElementById('v6Code').value.trim();
  try{const hash=await hash6(access);const st=(db.students||[]).find(x=>x.active!==false&&norm6(x.name)===norm6(name)&&norm6(x.surname)===norm6(surname)&&x.accessCodeHash===hash);if(!st){alert('Datos o clave incorrectos.');return}session={role:'student',studentId:st.id,tab:'home'};renderStudent()}catch(err){console.error(err);alert('No se pudo validar el acceso: '+err.message)}
}
function tutorLoginV6(e){
  e.preventDefault();
  const pin=document.getElementById('v6Pin').value.trim();
  const t=(db.tutors||[]).find(x=>x.active!==false&&String(x.pin)===pin);
  if(!t){alert('PIN incorrecto.');return}
  session={role:'tutor',tutor:t.name,tab:'dashboard'};renderTutor();
}
function subscribeMainDataV6(){
  firestore.collection('system').doc('main_data').onSnapshot(snap=>{
    const data=snap.exists?(snap.data()||{}):{};
    db.students=(Array.isArray(data.students)?data.students:[]).map(studentFromLegacy6);
    db.tutors=Array.isArray(data.tutors)?data.tutors:[];
    if(data.settings)db.settings=Object.assign({},db.settings,data.settings);
    refreshV6Suggestions();
    if(!session)login6(authModeV6);else if(session.role==='student')renderStudent();else renderTutor();
  },err=>{console.error('Sincronización de planilla:',err);if(!session)login6(authModeV6)});
  firestore.collection('registros_horas').onSnapshot(snap=>{
    const rows=snap.docs.map(d=>Object.assign({id:d.id},d.data()));
    db.practices=rows.filter(x=>x.tipo==='practica').map(x=>({id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',start:x.hora_inicio||'',end:x.hora_fin||'',hours:Number(x.cantidad_horas||0),activity:x.descripcion||'',notes:x.observaciones||'',createdAt:x.creado_el||''}));
    db.classes=rows.filter(x=>x.tipo==='clase').map(x=>({id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',hours:Number(x.cantidad_horas||0),status:x.descripcion||'Presente',createdAt:x.creado_el||''}));
    db.improvements=rows.filter(x=>x.tipo==='mejora').map(x=>({id:x.id,studentId:String(x.id_estudiante||''),month:x.fecha||'',text:x.descripcion||'',savedAt:x.creado_el||'',createdAt:x.creado_el||''}));
    if(session){if(session.role==='student')renderStudent();else renderTutor()}
  },err=>console.error('Sincronización de cargas:',err));
}
function refreshV6Suggestions(){const d=document.getElementById('v6Students');if(!d)return;d.innerHTML=(db.students||[]).filter(x=>x.active!==false).sort((a,b)=>full6(a).localeCompare(full6(b),'es')).map(x=>'<option value="'+esc(full6(x))+'"></option>').join('')}
login=function(){login6('login')};
window.__v6ready=true;


/* ==================== SEGURIDAD V8 ==================== */
/* Fuente de verdad nueva: student_directory + student_profiles + alumnos/{id}/registros. */

let authStudentUnsubV8=null;
let authTutorUnsubV8=[];
let directoryStudentsV8=[];
let tutorMainDataV8={students:[],tutors:[],settings:{}};

function normV8(v){
  return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function fullV8(s){return s?((s.name||'')+' '+(s.surname||'')).trim():'—'}
function codeV8(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a=new Uint8Array(8);
  if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);
  let out='';
  for(let i=0;i<8;i++)out+=chars[a[i]%chars.length];
  return out;
}
async function shaV8(v){
  const data=new TextEncoder().encode(normV8(v));
  const digest=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
function emailV8(studentKey){
  return 'student.'+studentKey.slice(0,48)+'@practicas-profesionales-us21.firebaseapp.com';
}
function clearRealtimeV8(){
  authStudentUnsubV8&&authStudentUnsubV8();
  authStudentUnsubV8=null;
  authTutorUnsubV8.forEach(function(unsub){try{unsub()}catch(e){}});
  authTutorUnsubV8=[];
}
function mapProfileV8(data,id){
  return {
    id:id,
    name:data.name||data.nombre||'',
    surname:data.surname||data.apellido||'',
    career:data.career||data.carrera||'',
    organization:data.organization||'',
    referent:data.referent||'',
    active:data.active!==false,
    studentId:data.studentId||id
  };
}
function renderLoginV8(mode){
  const students=directoryStudentsV8.filter(function(s){return s.active!==false}).sort(function(a,b){return fullV8(a).localeCompare(fullV8(b),'es')});
  const opts=students.map(function(s){return '<option value="'+esc(fullV8(s))+'"></option>'}).join('');
  document.getElementById('app').innerHTML=
    '<div class="shell"><div class="login panel">'+
    '<div class="eyebrow">GESTIÓN ACADÉMICA EN LA NUBE</div>'+
    '<h2>PRÁCTICAS PROFESIONALES</h2>'+
    '<div class="subtitle">Acceso seguro y sincronizado.</div>'+
    '<div class="tabs">'+
    '<button class="btn tab '+(mode==='login'?'active':'')+'" onclick="renderLoginV8(\\'login\\')">Iniciar sesión</button>'+
    '<button class="btn tab '+(mode==='register'?'active':'')+'" onclick="renderLoginV8(\\'register\\')">Registrarse</button>'+
    '<button class="btn tab '+(mode==='tutor'?'active':'')+'" onclick="renderLoginV8(\\'tutor\\')">Tutor</button>'+
    '</div>'+
    (mode==='register'
      ? '<form class="form" onsubmit="studentRegisterV8(event)"><div class="row"><div class="field"><label>Nombre</label><input id="reg8Name" required></div><div class="field"><label>Apellido</label><input id="reg8Surname" required></div></div><div class="field"><label>Carrera</label><input id="reg8Career" required placeholder="Ej. Lic. en Criminología y Seguridad"></div><button class="btn btn-primary">Registrarme</button><div class="notice">Se crea automáticamente tu ficha de alumno y una clave personal de acceso.</div></form>'
      : mode==='tutor'
        ? '<form class="form" onsubmit="tutorLoginV8(event)"><div class="field"><label>Email del tutor</label><input id="tutor8Email" type="email" autocomplete="username" required></div><div class="field"><label>Contraseña</label><input id="tutor8Password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary">Ingresar al panel de tutor</button><div class="notice">El acceso de tutor está protegido por Firebase Authentication.</div></form>'
        : '<form class="form" onsubmit="studentLoginV8(event)"><div class="field"><label>Nombre</label><input id="login8Name" list="students8" autocomplete="off" oninput="autofillLoginV8()" required><datalist id="students8">'+opts+'</datalist></div><div class="field"><label>Apellido</label><input id="login8Surname" required></div><div class="field"><label>Carrera</label><input id="login8Career" required></div><div class="field"><label>Clave de acceso</label><input id="login8Code" type="password" minlength="8" maxlength="8" required placeholder="Tu clave personal"></div><button class="btn btn-primary">Iniciar sesión</button><div class="notice">La clave personal es necesaria para acceder a tu información.</div></form>')+
    '</div></div>';
}
function autofillLoginV8(){
  const n=document.getElementById('login8Name'),s=document.getElementById('login8Surname'),c=document.getElementById('login8Career');
  if(!n)return;
  const st=directoryStudentsV8.find(function(x){return x.active!==false&&normV8(fullV8(x))===normV8(n.value)});
  if(st){if(s)s.value=st.surname||'';if(c)c.value=st.career||''}
}
async function studentRegisterV8(e){
  e.preventDefault();
  const name=document.getElementById('reg8Name').value.trim();
  const surname=document.getElementById('reg8Surname').value.trim();
  const career=document.getElementById('reg8Career').value.trim();
  if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}
  try{
    const key=await shaV8(name+'|'+surname+'|'+career);
    const dirRef=firestore.collection('student_directory').doc(key);
    const dirSnap=await dirRef.get();
    const existing=dirSnap.exists?dirSnap.data():null;
    if(existing&&existing.active===false){alert('Este alumno está deshabilitado. Consultá a la tutoría.');return}

    const studentId=existing&&existing.studentId?String(existing.studentId):'stu-'+key.slice(0,20);
    const access=codeV8();
    const credential=await firebase.auth().createUserWithEmailAndPassword(emailV8(key),access);
    const uid=credential.user.uid;
    const now=new Date().toISOString();

    const writes=[];
    writes.push(firestore.collection('student_directory').doc(key).set({
      name:name,surname:surname,career:career,studentId:studentId,active:true,createdAt:existing&&existing.createdAt?existing.createdAt:now
    },{merge:true}));
    writes.push(firestore.collection('student_auth').doc(studentId).set({
      uid:uid,createdAt:now
    },{merge:false}));
    writes.push(firestore.collection('student_profiles').doc(uid).set({
      studentId:studentId,name:name,surname:surname,career:career,organization:existing&&existing.organization?existing.organization:'',referent:existing&&existing.referent?existing.referent:'',active:true,createdAt:now,updatedAt:now
    },{merge:true}));
    await Promise.all(writes);

    await startStudentV8(uid,studentId);
    alert('¡Registro completado!\\n\\nTu clave personal es: '+access+'\\n\\nGuardala. La vas a necesitar para volver a ingresar.');
  }catch(err){
    console.error(err);
    if(err&&err.code==='auth/email-already-in-use')alert('Este alumno ya tiene una cuenta. Usá “Iniciar sesión”.');
    else alert('No se pudo completar el registro: '+(err.message||err));
  }
}
async function studentLoginV8(e){
  e.preventDefault();
  const name=document.getElementById('login8Name').value.trim();
  const surname=document.getElementById('login8Surname').value.trim();
  const career=document.getElementById('login8Career').value.trim();
  const access=document.getElementById('login8Code').value.trim();
  if(!name||!surname||!career||!access){alert('Completá todos los datos.');return}
  try{
    const key=await shaV8(name+'|'+surname+'|'+career);
    const dirSnap=await firestore.collection('student_directory').doc(key).get();
    if(!dirSnap.exists){alert('No encontramos ese alumno. Para la primera alta usá “Registrarse”.');return}
    const dir=dirSnap.data()||{};
    if(dir.active===false){alert('Este alumno está deshabilitado. Consultá a la tutoría.');return}
    const credential=await firebase.auth().signInWithEmailAndPassword(emailV8(key),access);
    await startStudentV8(credential.user.uid,String(dir.studentId));
  }catch(err){
    console.error(err);
    alert('No pudimos validar el acceso: '+(err.message||err));
  }
}
async function startStudentV8(uid,studentId){
  clearRealtimeV8();
  const profileSnap=await firestore.collection('student_profiles').doc(uid).get();
  if(!profileSnap.exists)throw new Error('No se encontró el perfil del alumno.');
  const profile=profileSnap.data()||{};
  if(String(profile.studentId)!==String(studentId))throw new Error('La cuenta no coincide con el alumno.');
  db.students=[Object.assign({id:studentId},mapProfileV8(profile,studentId))];
  session={role:'student',studentId:studentId,tab:'home',uid:uid};
  authStudentUnsubV8=firestore.collection('alumnos').doc(studentId).collection('registros').onSnapshot(function(snap){
    const rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    db.practices=rows.filter(function(x){return x.kind==='practica'}).map(function(x){return {id:x.id,studentId:studentId,date:x.date||'',start:x.start||'',end:x.end||'',hours:Number(x.hours||0),activity:x.activity||'',notes:x.notes||'',createdAt:x.createdAt||''}});
    db.classes=rows.filter(function(x){return x.kind==='clase'}).map(function(x){return {id:x.id,studentId:studentId,date:x.date||'',hours:Number(x.hours||0),status:x.status||'Presente',createdAt:x.createdAt||''}});
    db.improvements=rows.filter(function(x){return x.kind==='mejora'}).map(function(x){return {id:x.id,studentId:studentId,month:x.month||'',text:x.text||'',savedAt:x.createdAt||'',createdAt:x.createdAt||''}});
    renderStudent();
  },function(err){console.error('Sincronización del alumno:',err);alert('No se pudo sincronizar tu información: '+err.message)});
  renderStudent();
}
function refreshDirectoryV8(){
  firestore.collection('student_directory').onSnapshot(function(snap){
    directoryStudentsV8=snap.docs.map(function(d){
      const x=d.data()||{};
      return {id:d.id,name:x.name||'',surname:x.surname||'',career:x.career||'',studentId:x.studentId||d.id,organization:x.organization||'',referent:x.referent||'',active:x.active!==false};
    });
    if(!session)renderLoginV8('login');
    else if(session.role==='student')renderStudent();
  },function(err){console.error('Directorio:',err);if(!session)renderLoginV8('login')});
}
async function savePracticeV8(e){
  e.preventDefault();
  try{
    if(!firebase.auth().currentUser||session.role!=='student')throw new Error('Sesión de estudiante no válida.');
    const stid=session.studentId,date=document.getElementById('pd').value,start=document.getElementById('ps').value,end=document.getElementById('pe').value,activity=document.getElementById('pa').value.trim(),notes=document.getElementById('pn').value.trim();
    const day=new Date(date+'T12:00:00').getDay();
    if(day===0||day===6){alert('La jornada práctica debe ser de lunes a viernes.');return}
    const parts1=start.split(':'),parts2=end.split(':');
    const mins=(Number(parts2[0])*60+Number(parts2[1]))-(Number(parts1[0])*60+Number(parts1[1]));
    if(mins<=0){alert('La hora de finalización debe ser posterior a la de inicio.');return}
    const hours=Math.round(mins/60*100)/100,weekly=weeklyPractice(stid,date);
    if(weekly+hours>weekMax+1e-9){alert('Esta carga supera el máximo de '+weekMax+' horas semanales. Tenés '+fmt(weekly)+' en esa semana.');return}
    const now=new Date().toISOString();
    await firestore.collection('alumnos').doc(stid).collection('registros').doc('p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({kind:'practica',date:date,start:start,end:end,hours:hours,activity:activity,notes:notes,createdAt:now,createdBy:firebase.auth().currentUser.uid},{merge:false});
    session.tab='home';renderStudent();alert('Registro guardado correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar el registro: '+err.message)}
}
async function saveClassV8(e){
  e.preventDefault();
  try{
    if(!firebase.auth().currentUser||session.role!=='student')throw new Error('Sesión de estudiante no válida.');
    const date=document.getElementById('cd').value,hours=Number(document.getElementById('ch').value);
    if(!Number.isFinite(hours)||hours<=0||hours>24){alert('Ingresá una cantidad de horas válida.');return}
    if(db.classes.some(function(x){return x.studentId===session.studentId&&x.date===date})){alert('Ya existe una asistencia para esa fecha. El registro anterior se conserva y no se reemplaza.');return}
    await firestore.collection('alumnos').doc(session.studentId).collection('registros').doc('c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({kind:'clase',date:date,hours:hours,status:'Presente',createdAt:new Date().toISOString(),createdBy:firebase.auth().currentUser.uid},{merge:false});
    session.tab='home';renderStudent();alert('Asistencia guardada correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar la asistencia: '+err.message)}
}
async function saveImprovementV8(e){
  e.preventDefault();
  try{
    if(!firebase.auth().currentUser||session.role!=='student')throw new Error('Sesión de estudiante no válida.');
    const month=today().slice(0,7),text=document.getElementById('improvement').value.trim();
    await firestore.collection('alumnos').doc(session.studentId).collection('registros').doc('i-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({kind:'mejora',month:month,text:text,createdAt:new Date().toISOString(),createdBy:firebase.auth().currentUser.uid},{merge:false});
    renderStudent();alert('Mejora mensual guardada correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar la mejora: '+err.message)}
}
savePractice=savePracticeV8;
saveClass=saveClassV8;
saveImprovement=saveImprovementV8;

function tutorLoginV8(e){
  e.preventDefault();
  const email=document.getElementById('tutor8Email').value.trim();
  const password=document.getElementById('tutor8Password').value;
  firebase.auth().signInWithEmailAndPassword(email,password).then(async function(cred){
    const tutorSnap=await firestore.collection('tutores').doc(cred.user.uid).get();
    if(!tutorSnap.exists||tutorSnap.data().active===false)throw new Error('Esta cuenta no está habilitada como tutor.');
    session={role:'tutor',tutor:tutorSnap.data().name||email,tab:'dashboard',uid:cred.user.uid};
    await migrateLegacyV8();
    startTutorV8();
  }).catch(function(err){console.error(err);alert('No se pudo ingresar como tutor: '+(err.message||err))});
}
async function seedDirectoryFromLegacyV8(students){
  for(let i=0;i<students.length;i+=400){
    const batch=firestore.batch();
    students.slice(i,i+400).forEach(function(st){
      const name=st.name||'',surname=st.surname||'',career=st.career||'';
      if(!name||!surname)return;
      const keySource=normV8(name)+'|'+normV8(surname)+'|'+normV8(career);
      let h=0;for(let j=0;j<keySource.length;j++){h=((h<<5)-h)+keySource.charCodeAt(j);h|=0}
      const key='legacy-'+Math.abs(h).toString(36);
      batch.set(firestore.collection('student_directory').doc(key),{name:name,surname:surname,career:career,studentId:String(st.id),active:st.active!==false,organization:st.organization||'',referent:st.referent||''},{merge:true});
    });
    await batch.commit();
  }
}
async function migrateLegacyV8(){
  try{
    const mainSnap=await firestore.collection('system').doc('main_data').get();
    const main=mainSnap.exists?(mainSnap.data()||{}):{};
    const mainStudents=Array.isArray(main.students)?main.students:[];
    await seedDirectoryFromLegacyV8(mainStudents);

    const records=[];
    (Array.isArray(main.practices)?main.practices:[]).forEach(function(x){if(x&&x.id&&x.studentId)records.push({sid:String(x.studentId),rid:'legacy-p-'+String(x.id),data:{kind:'practica',date:x.date||'',start:x.start||'',end:x.end||'',hours:Number(x.hours||0),activity:x.activity||'',notes:x.notes||'',createdAt:x.createdAt||'legacy',legacyId:String(x.id)}})});
    (Array.isArray(main.classes)?main.classes:[]).forEach(function(x){if(x&&x.id&&x.studentId)records.push({sid:String(x.studentId),rid:'legacy-c-'+String(x.id),data:{kind:'clase',date:x.date||'',hours:Number(x.hours||0),status:x.status||'Presente',createdAt:x.createdAt||'legacy',legacyId:String(x.id)}})});
    (Array.isArray(main.improvements)?main.improvements:[]).forEach(function(x){if(x&&x.id&&x.studentId)records.push({sid:String(x.studentId),rid:'legacy-i-'+String(x.id),data:{kind:'mejora',month:x.month||'',text:x.text||'',createdAt:x.createdAt||'legacy',legacyId:String(x.id)}})});
    for(let i=0;i<records.length;i++){
      const r=records[i];
      await firestore.collection('alumnos').doc(r.sid).collection('registros').doc(r.rid).set(r.data,{merge:true});
    }
  }catch(err){console.warn('Migración histórica:',err)}
}
function loadTutorDataV8(){
  firestore.collection('student_directory').onSnapshot(function(snap){
    directoryStudentsV8=snap.docs.map(function(d){const x=d.data()||{};return {id:d.id,name:x.name||'',surname:x.surname||'',career:x.career||'',studentId:x.studentId||d.id,organization:x.organization||'',referent:x.referent||'',active:x.active!==false}});
    db.students=directoryStudentsV8.map(function(x){return {id:String(x.studentId),name:x.name,surname:x.surname,career:x.career,organization:x.organization||'',referent:x.referent||'',active:x.active}});
    if(session&&session.role==='tutor')renderTutor();
  },function(err){console.error(err)});
  firestore.collectionGroup('registros').onSnapshot(function(snap){
    const rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    db.practices=rows.filter(function(x){return x.kind==='practica'}).map(function(x){return Object.assign({studentId:x.studentId||''},{id:x.id,date:x.date||'',start:x.start||'',end:x.end||'',hours:Number(x.hours||0),activity:x.activity||'',notes:x.notes||'',createdAt:x.createdAt||''})});
    db.classes=rows.filter(function(x){return x.kind==='clase'}).map(function(x){return Object.assign({studentId:x.studentId||''},{id:x.id,date:x.date||'',hours:Number(x.hours||0),status:x.status||'Presente',createdAt:x.createdAt||''})});
    db.improvements=rows.filter(function(x){return x.kind==='mejora'}).map(function(x){return Object.assign({studentId:x.studentId||''},{id:x.id,month:x.month||'',text:x.text||'',savedAt:x.createdAt||'',createdAt:x.createdAt||''})});
    if(session&&session.role==='tutor')renderTutor();
  },function(err){console.error('Registros tutor:',err)});
  authTutorUnsubV8.push(firestore.collection('student_profiles').onSnapshot(function(snap){
    snap.docs.forEach(function(doc){
      const p=doc.data()||{};const idx=db.students.findIndex(function(s){return String(s.id)===String(p.studentId)});
      if(idx<0)db.students.push({id:String(p.studentId),name:p.name||'',surname:p.surname||'',career:p.career||'',organization:p.organization||'',referent:p.referent||'',active:p.active!==false});
    });
    if(session&&session.role==='tutor')renderTutor();
  },function(err){console.error('Perfiles tutor:',err)}));
}
function startTutorV8(){
  clearRealtimeV8();
  loadTutorDataV8();
  renderTutor();
}
renderTutor=(function(oldRender){
  return function(){
    oldRender();
    const nav=document.querySelector('.nav-tabs');
    if(nav&&!nav.querySelector('[data-v8-history]')){
      const btn=document.createElement('button');
      btn.className='btn';btn.setAttribute('data-v8-history','1');btn.textContent='Historial';
      btn.onclick=function(){session.tab='history';renderTutor()};
      nav.appendChild(btn);
    }
    if(session&&session.tab==='history'){
      const old=nav&&nav.querySelector('[data-v8-history]');
      if(old)old.classList.add('active');
    }
  }
})(renderTutor);

renderStudent=(function(oldRender){
  return function(){
    oldRender();
    requestAnimationFrame(function(){
      const nav=document.querySelector('.nav-tabs');if(!nav||!session)return;
      const map={Inicio:'home','Registrar práctica':'practice','Asistencia a clase':'class','Mi historial':'history','Mi planilla':'planilla','Mejora mensual':'improvement'};
      nav.querySelectorAll('button').forEach(function(btn){const key=map[btn.textContent.trim()];if(key){btn.classList.toggle('active',key===session.tab)}});
    });
  }
})(renderStudent);

function logoutV8(){
  clearRealtimeV8();
  session=null;
  firebase.auth().signOut().finally(function(){renderLoginV8('login')});
}
window.logout=logoutV8;

firebase.auth().onAuthStateChanged(function(user){
  if(user&&user.isAnonymous){
    firebase.auth().signOut().finally(function(){renderLoginV8('login')});
    return;
  }
});
const oldLoginV8=login;
login=function(){renderLoginV8('login')};
refreshDirectoryV8();
