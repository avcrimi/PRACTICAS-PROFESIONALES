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

  const existing=(db.students||[]).find(s=>norm6(s.name)===norm6(name)&&norm6(s.surname)===norm6(surname));
  if(existing&&existing.accessCodeHash){
    alert('Este alumno ya está registrado. Usá “Iniciar sesión”.');
    login6('login');
    return;
  }

  const studentId=existing
    ? String(existing.id)
    : ('stu-'+(await hash6(norm6(name)+'|'+norm6(surname)+'|'+norm6(career))).slice(0,20));
  const access=code6(),hash=await hash6(access),now=new Date().toISOString();

  try{
    await ensureAnonymousAuthV6();
    const ref=firestore.collection('registros_horas').doc('alumno-'+studentId);
    await ref.create({
      id_estudiante:studentId,
      tipo:'registro_alumno',
      nombre:name,
      apellido:surname,
      carrera:career,
      nombreCompleto:(name+' '+surname).trim(),
      accessCodeHash:hash,
      accessCodeVersion:1,
      active:true,
      createdAt:today(),
      creado_el:now,
      organization:'',
      referent:'',
      origen:'v8'
    });

    session={role:'student',studentId,tab:'home'};
    switchRecordsListenerV8();
    renderStudent();
    alert('¡Registro completado!\n\nTu clave personal es: '+access+'\n\nGuardala para futuros ingresos.');
  }catch(err){
    console.error(err);
    if(err&&err.code==='already-exists'){
      alert('Este alumno ya fue registrado. Usá “Iniciar sesión” con la clave que recibiste.');
      login6('login');
      return;
    }
    alert('No se pudo registrar al alumno en la nube: '+(err.message||err));
  }
}
async function studentLoginV6(e){
  e.preventDefault();
  const name=document.getElementById('v6LoginName').value.trim(),surname=document.getElementById('v6LoginSurname').value.trim(),access=document.getElementById('v6Code').value.trim();
  try{const hash=await hash6(access);const st=(db.students||[]).find(x=>x.active!==false&&norm6(x.name)===norm6(name)&&norm6(x.surname)===norm6(surname)&&x.accessCodeHash===hash);if(!st){alert('Datos o clave incorrectos.');return}session={role:'student',studentId:st.id,tab:'home'};switchRecordsListenerV8();renderStudent()}catch(err){console.error(err);alert('No se pudo validar el acceso: '+err.message)}
}
function tutorLoginV6(e){
  e.preventDefault();
  const pin=document.getElementById('v6Pin').value.trim();
  const t=(db.tutors||[]).find(x=>x.active!==false&&String(x.pin)===pin);
  if(!t){alert('PIN incorrecto.');return}
  session={role:'tutor',tutor:t.name,tab:'dashboard'};switchRecordsListenerV8();renderTutor();
}
let recordsUnsubscribeV8=null;
function mapRecordsV8(rows){
  db.practices=rows.filter(x=>x.tipo==='practica').map(x=>({id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',start:x.hora_inicio||'',end:x.hora_fin||'',hours:Number(x.cantidad_horas||0),activity:x.descripcion||'',notes:x.observaciones||'',createdAt:x.creado_el||''}));
  db.classes=rows.filter(x=>x.tipo==='clase').map(x=>({id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',hours:Number(x.cantidad_horas||0),status:x.descripcion||'Presente',createdAt:x.creado_el||''}));
  db.improvements=rows.filter(x=>x.tipo==='mejora').map(x=>({id:x.id,studentId:String(x.id_estudiante||''),month:x.fecha||'',text:x.descripcion||'',savedAt:x.creado_el||'',createdAt:x.creado_el||''}));
}
function switchRecordsListenerV8(){
  if(recordsUnsubscribeV8){recordsUnsubscribeV8();recordsUnsubscribeV8=null;}
  if(!session){db.practices=[];db.classes=[];db.improvements=[];return;}
  let q=firestore.collection('registros_horas');
  if(session.role==='student')q=q.where('id_estudiante','==',String(session.studentId));
  recordsUnsubscribeV8=q.onSnapshot(snap=>{
    mapRecordsV8(snap.docs.map(d=>Object.assign({id:d.id},d.data())));
    if(session&&session.role==='student')renderStudent();
    else if(session&&session.role==='tutor')renderTutor();
  },err=>console.error('Sincronización de cargas:',err));
}
function applyRegistrationDirectoryV8(rows){
  const regs=rows.filter(x=>x.tipo==='registro_alumno').map(x=>({id:String(x.id_estudiante||''),name:x.nombre||'',surname:x.apellido||'',career:x.carrera||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false,accessCodeHash:x.accessCodeHash||'',fromRegistrationV8:true}));
  const map=new Map();
  (db.students||[]).forEach(st=>{if(!st.fromRegistrationV8)map.set(String(st.id),st);});
  regs.forEach(st=>map.set(String(st.id),st));
  db.__registeredStudentsV8=regs;
  db.students=Array.from(map.values());
  refreshV6Suggestions();
  if(!session)login6(authModeV6);
  else if(session.role==='student')renderStudent();
  else renderTutor();
}
function subscribeMainDataV6(){
  firestore.collection('system').doc('main_data').onSnapshot(snap=>{
    const data=snap.exists?(snap.data()||{}):{};
    db.students=(Array.isArray(data.students)?data.students:[]).map(studentFromLegacy6);
    db.tutors=Array.isArray(data.tutors)?data.tutors:[];
    if(data.settings)db.settings=Object.assign({},db.settings,data.settings);
    refreshV6Suggestions();
    if(!session)login6(authModeV6);
    else if(session.role==='student')renderStudent();
    else renderTutor();
  },err=>{console.error('Sincronización de planilla:',err);if(!session)login6(authModeV6);});
  firestore.collection('registros_horas').where('tipo','==','registro_alumno').onSnapshot(snap=>{
    applyRegistrationDirectoryV8(snap.docs.map(d=>Object.assign({id:d.id},d.data())));
  },err=>console.error('Sincronización del padrón:',err));
  switchRecordsListenerV8();
}
function refreshV6Suggestions(){const d=document.getElementById('v6Students');if(!d)return;d.innerHTML=(db.students||[]).filter(x=>x.active!==false).sort((a,b)=>full6(a).localeCompare(full6(b),'es')).map(x=>'<option value="'+esc(full6(x))+'"></option>').join('')}
login=function(){login6('login')};
window.__v6ready=true;
subscribeMainDataV6();
// AUTH_ANON_BOOT_V1
async function ensureAnonymousAuthV6(){
  try{
    if(!firebase.auth)throw new Error('Firebase Authentication no está cargado.');
    if(!firebase.auth().currentUser){
      await firebase.auth().signInAnonymously();
    }
    window.__firebaseAuthReadyV6=true;
  }catch(err){
    console.error('Error de autenticación Firebase:',err);
    alert('No se pudo iniciar la conexión segura con Firebase: '+err.message);
    throw err;
  }
}
const originalStudentLoginV6=studentLoginV6;
studentLoginV6=async function(e){
  try{
    await ensureAnonymousAuthV6();
    return await originalStudentLoginV6(e);
  }catch(err){
    console.error(err);
  }
};
ensureAnonymousAuthV6().then(function(){console.log('Firebase Auth listo')}).catch(function(){});

// FINAL_SYNC_CONFIG_V7
// Todas las cargas se guardan como documentos independientes.
// No se utiliza saveData() ni se reemplaza el documento principal.

const renderStudentBaseV7=renderStudent;
renderStudent=function(){
  renderStudentBaseV7();
  requestAnimationFrame(function(){
    const nav=document.querySelector('.nav-tabs');
    if(!nav||!session)return;

    const labels={
      'Inicio':'home',
      'Registrar práctica':'practice',
      'Asistencia a clase':'class',
      'Mi historial':'history',
      'Mi planilla':'planilla',
      'Mejora mensual':'improvement'
    };

    nav.querySelectorAll('button').forEach(function(btn){
      const text=btn.textContent.trim();
      if(labels[text]){
        btn.classList.remove('active');
        if(labels[text]===session.tab)btn.classList.add('active');
      }
    });
  });
};

async function ensureAuthV7(){
  if(firebase.auth().currentUser)return;
  await firebase.auth().signInAnonymously();
}

async function savePracticeV7(e){
  e.preventDefault();
  try{
    await ensureAuthV7();
    const stid=session.studentId;
    const date=document.getElementById('pd').value;
    const start=document.getElementById('ps').value;
    const end=document.getElementById('pe').value;
    const activity=document.getElementById('pa').value.trim();
    const notes=document.getElementById('pn').value.trim();
    const day=new Date(date+'T12:00:00').getDay();
    if(day===0||day===6){alert('La jornada práctica debe ser de lunes a viernes.');return}

    const startParts=start.split(':'),endParts=end.split(':');
    const minutes=(Number(endParts[0])*60+Number(endParts[1]))-(Number(startParts[0])*60+Number(startParts[1]));
    if(minutes<=0){alert('La hora de finalización debe ser posterior a la de inicio.');return}

    const hours=Math.round(minutes/60*100)/100;
    const weekly=weeklyPractice(stid,date);
    if(weekly+hours>weekMax+1e-9){
      alert('Esta carga supera el máximo de '+weekMax+' horas semanales. Tenés '+fmt(weekly)+' en esa semana.');
      return;
    }

    await firestore.collection('registros_horas').doc('p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({
      id_estudiante:stid,
      tipo:'practica',
      fecha:date,
      cantidad_horas:hours,
      descripcion:activity,
      observaciones:notes,
      hora_inicio:start,
      hora_fin:end,
      creado_el:new Date().toISOString(),
      origen:'v7'
    },{merge:false});

    session.tab='home';
    renderStudent();
    alert('Registro guardado en la nube: '+fmt(hours)+'.');
  }catch(err){
    console.error(err);
    alert('No se pudo guardar el registro: '+err.message);
  }
}

async function saveClassV7(e){
  e.preventDefault();
  try{
    await ensureAuthV7();
    const date=document.getElementById('cd').value;
    const hours=Number(document.getElementById('ch').value);
    if(!Number.isFinite(hours)||hours<=0||hours>24){alert('Ingresá una cantidad de horas válida.');return}

    if(db.classes.some(function(x){return x.studentId===session.studentId&&x.date===date;})){
      alert('Ya existe una asistencia para esa fecha. El registro anterior se conserva y no se reemplaza.');
      return;
    }

    await firestore.collection('registros_horas').doc('c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({
      id_estudiante:session.studentId,
      tipo:'clase',
      fecha:date,
      cantidad_horas:hours,
      descripcion:'Presente',
      creado_el:new Date().toISOString(),
      origen:'v7'
    },{merge:false});

    session.tab='home';
    renderStudent();
    alert('Asistencia guardada en la nube.');
  }catch(err){
    console.error(err);
    alert('No se pudo guardar la asistencia: '+err.message);
  }
}

async function saveImprovementV7(e){
  e.preventDefault();
  try{
    await ensureAuthV7();
    const month=today().slice(0,7);
    const text=document.getElementById('improvement').value.trim();

    await firestore.collection('registros_horas').doc('i-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({
      id_estudiante:session.studentId,
      tipo:'mejora',
      fecha:month,
      cantidad_horas:0,
      descripcion:text,
      creado_el:new Date().toISOString(),
      origen:'v7'
    },{merge:false});

    renderStudent();
    alert('Mejora mensual guardada en la nube.');
  }catch(err){
    console.error(err);
    alert('No se pudo guardar la mejora: '+err.message);
  }
}

updateStudentMeta=async function(stid,field,val){
  try{
    await ensureAuthV7();
    const payload={};
    payload[field]=val;
    payload.updatedAt=new Date().toISOString();
    await firestore.collection('registros_horas').doc('alumno-'+String(stid)).set(payload,{merge:true});
  }catch(err){
    console.error('No se pudo sincronizar el dato del alumno:',err);
  }
};

saveStudent=async function(e){
  e.preventDefault();
  try{
    await ensureAuthV7();
    const idVal=document.getElementById('sid').value;
    const name=document.getElementById('sn').value.trim();
    const surname=document.getElementById('ss').value.trim();
    const career=document.getElementById('sc').value.trim();
    const organization=document.getElementById('so').value.trim();
    const referent=document.getElementById('sr').value.trim();
    const active=document.getElementById('sa').checked;
    if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}

    const id=idVal||('stu-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9));
    await firestore.collection('registros_horas').doc('alumno-'+id).set({
      id_estudiante:id,
      tipo:'registro_alumno',
      nombre:name,
      apellido:surname,
      carrera:career,
      nombreCompleto:(name+' '+surname).trim(),
      organization:organization,
      referent:referent,
      active:active,
      updatedAt:new Date().toISOString(),
      origen:'v7-admin'
    },{merge:true});

    clearStudentForm();
    renderTutor();
    alert('Alumno guardado correctamente.');
  }catch(err){
    console.error(err);
    alert('No se pudo guardar el alumno: '+err.message);
  }
};

deleteStudent=async function(id){
  try{
    await ensureAuthV7();
    const st=db.students.find(function(x){return x.id===id;});
    if(!st)return;
    if(!confirm('¿Deshabilitar a '+full6(st)+'? Sus datos y registros se conservarán en la nube.'))return;

    await firestore.collection('registros_horas').doc('alumno-'+id).set({
      active:false,
      disabledAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    },{merge:true});

    renderTutor();
    alert('Alumno deshabilitado. Sus prácticas, clases y mejoras siguen conservadas.');
  }catch(err){
    console.error(err);
    alert('No se pudo deshabilitar al alumno: '+err.message);
  }
};

savePractice=savePracticeV7;
saveClass=saveClassV7;
saveImprovement=saveImprovementV7;

const recordsListenerV7=firestore.collection('registros_horas').onSnapshot(function(snap){
  const rows=snap.docs.map(function(doc){return Object.assign({id:doc.id},doc.data())});
  const regs=rows.filter(function(x){return x.tipo==='registro_alumno'}).map(function(x){
    return {
      id:String(x.id_estudiante||''),
      name:x.nombre||'',
      surname:x.apellido||'',
      career:x.carrera||'',
      organization:x.organization||'',
      referent:x.referent||'',
      active:x.active!==false,
      accessCodeHash:x.accessCodeHash||'',
      fromRegistrationV7:true
    };
  });
  db.__registeredStudentsV7=regs;

  const map=new Map();
  (db.students||[]).forEach(function(st){
    if(!st.fromRegistrationV7)map.set(String(st.id),st);
  });
  regs.forEach(function(st){map.set(String(st.id),st)});
  db.students=Array.from(map.values());

  if(!session)login6(authModeV6);
  else if(session.role==='student')renderStudent();
  else renderTutor();
},function(err){
  console.error('Sincronización final de registros:',err);
});

// NAV_CLICK_FIX_V2
document.addEventListener('click',function(event){
  const button=event.target.closest('.nav-tabs button');
  if(!button)return;
  const nav=button.closest('.nav-tabs');
  if(!nav)return;
  nav.querySelectorAll('button').forEach(function(b){b.classList.remove('active')});
  button.classList.add('active');
});
