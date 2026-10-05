// SEGURIDAD FINAL - PRACTICAS PROFESIONALES
const AUTHF=firebase.auth();
let SECUSER=null;
let STUDUNSUB=null;
let TUTORUNSUBS=[];
let PUBSTUDENTS=[];
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
  if(STUDUNSUB){STUDUNSUB();STUDUNSUB=null}
  TUTORUNSUBS.forEach(function(f){try{f()}catch(e){}});
  TUTORUNSUBS=[];
}

function screenF(mode){
  AUTHMODE=mode||AUTHMODE||'login';
  const list=PUBSTUDENTS.filter(function(x){return x.active!==false}).sort(function(a,b){return fullF(a).localeCompare(fullF(b),'es')});
  const opts=list.map(function(x){return '<option value="'+esc(fullF(x))+'"></option>'}).join('');
  const tabs='<div class="tabs">'+
    '<button id="fLoginTab" class="btn tab '+(AUTHMODE==='login'?'active':'')+'">Iniciar sesión</button>'+
    '<button id="fRegisterTab" class="btn tab '+(AUTHMODE==='register'?'active':'')+'">Registrarse</button>'+
    '<button id="fTutorTab" class="btn tab '+(AUTHMODE==='tutor'?'active':'')+'">Tutor</button>'+
    '</div>';

  let body='';
  if(AUTHMODE==='register'){
    body='<form id="fRegisterForm" class="form">'+
      '<div class="row"><div class="field"><label>Nombre</label><input id="fRegName" required></div><div class="field"><label>Apellido</label><input id="fRegSurname" required></div></div>'+
      '<div class="field"><label>Carrera</label><input id="fRegCareer" required placeholder="Ej. Lic. en Criminología y Seguridad"></div>'+
      '<button class="btn btn-primary">Registrarme</button>'+
      '<div class="notice">Tu alta se crea automáticamente y queda vinculada a la planilla de alumnos.</div>'+
      '</form>';
  }else if(AUTHMODE==='tutor'){
    body='<form id="fTutorForm" class="form">'+
      '<div class="field"><label>Email</label><input id="fTutorEmail" type="email" required></div>'+
      '<div class="field"><label>Contraseña</label><input id="fTutorPassword" type="password" required></div>'+
      '<button class="btn btn-primary">Ingresar al panel de tutor</button>'+
      '</form>';
  }else{
    body='<form id="fLoginForm" class="form">'+
      '<div class="field"><label>Nombre</label><input id="fLoginName" list="fStudentList" autocomplete="off" required><datalist id="fStudentList">'+opts+'</datalist></div>'+
      '<div class="row"><div class="field"><label>Apellido</label><input id="fLoginSurname" required></div><div class="field"><label>Carrera</label><input id="fLoginCareer" required></div></div>'+
      '<div class="field"><label>Clave personal</label><input id="fLoginCode" type="password" minlength="8" maxlength="8" required></div>'+
      '<button class="btn btn-primary">Iniciar sesión</button>'+
      '<div class="notice">Usá la clave personal que recibiste al registrarte.</div>'+
      '</form>';
  }

  document.getElementById('app').innerHTML='<div class="shell"><div class="login panel">'+
    '<div class="eyebrow">GESTIÓN ACADÉMICA EN LA NUBE</div><h2>PRÁCTICAS PROFESIONALES</h2>'+
    '<div class="subtitle">Acceso seguro y sincronizado.</div>'+tabs+body+'</div></div>';

  document.getElementById('fLoginTab').onclick=function(){screenF('login')};
  document.getElementById('fRegisterTab').onclick=function(){screenF('register')};
  document.getElementById('fTutorTab').onclick=function(){screenF('tutor')};

  const name=document.getElementById('fLoginName');
  if(name){
    name.oninput=function(){
      const s=document.getElementById('fLoginSurname'),c=document.getElementById('fLoginCareer');
      const st=PUBSTUDENTS.find(function(x){return x.active!==false&&nF(fullF(x))===nF(name.value)});
      if(st){s.value=st.surname||'';c.value=st.career||''}
    };
    name.focus();
  }
  const rf=document.getElementById('fRegisterForm');if(rf)rf.onsubmit=registerF;
  const lf=document.getElementById('fLoginForm');if(lf)lf.onsubmit=loginStudentF;
  const tf=document.getElementById('fTutorForm');if(tf)tf.onsubmit=loginTutorF;
}

async function ensureAnonF(){
  if(!AUTHF.currentUser)await AUTHF.signInAnonymously();
}

async function registerF(e){
  e.preventDefault();
  try{
    await ensureAnonF();
    const name=document.getElementById('fRegName').value.trim();
    const surname=document.getElementById('fRegSurname').value.trim();
    const career=document.getElementById('fRegCareer').value.trim();
    if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}

    const key=await hashF(name+'|'+surname+'|'+career);
    const dirRef=firestore.collection('student_directory').doc(key);
    const dirSnap=await dirRef.get();
    if(dirSnap.exists&&dirSnap.data().ownerUid){
      alert('Este alumno ya está registrado. Usá “Iniciar sesión”.');
      screenF('login');
      return;
    }

    const password=codeF();
    const cred=await AUTHF.createUserWithEmailAndPassword(emailF(key),password);
    const uid=cred.user.uid;
    const studentId=(dirSnap.exists&&dirSnap.data().studentId)?String(dirSnap.data().studentId):uid;
    const now=new Date().toISOString();

    await firestore.collection('student_profiles').doc(uid).set({
      uid:uid,studentId:studentId,name:name,surname:surname,career:career,
      organization:dirSnap.exists?(dirSnap.data().organization||''):'',
      referent:dirSnap.exists?(dirSnap.data().referent||''):'',
      active:true,createdAt:now,updatedAt:now
    },{merge:true});

    await dirRef.set({ownerUid:uid,studentId:studentId,name:name,surname:surname,career:career,active:true},{merge:true});

    SECUSER={role:'student',uid:uid,studentId:studentId};
    session={role:'student',uid:uid,studentId:studentId,tab:'home'};
    alert('¡Registro completado!\\n\\nTu clave personal es: '+password+'\\n\\nGuardala para futuros ingresos.');
    startStudentF();
  }catch(err){
    console.error(err);
    alert(err&&err.code==='auth/email-already-in-use'?'Este alumno ya está registrado. Usá “Iniciar sesión”.':'No se pudo completar el registro: '+(err.message||err));
  }
}

async function loginStudentF(e){
  e.preventDefault();
  try{
    const name=document.getElementById('fLoginName').value.trim();
    const surname=document.getElementById('fLoginSurname').value.trim();
    const career=document.getElementById('fLoginCareer').value.trim();
    const password=document.getElementById('fLoginCode').value.trim();
    const key=await hashF(name+'|'+surname+'|'+career);
    const cred=await AUTHF.signInWithEmailAndPassword(emailF(key),password);
    const p=await firestore.collection('student_profiles').doc(cred.user.uid).get();
    if(!p.exists||p.data().active===false)throw new Error('Cuenta de alumno no habilitada.');
    SECUSER={role:'student',uid:cred.user.uid,studentId:String(p.data().studentId)};
    startStudentF();
  }catch(err){console.error(err);alert('No se pudo iniciar sesión: '+(err.message||err))}
}

async function startStudentF(){
  clearF();
  const p=await firestore.collection('student_profiles').doc(SECUSER.uid).get();
  if(!p.exists)throw new Error('Perfil de alumno no encontrado.');
  const x=p.data(),sid=String(x.studentId);
  db.students=[{id:sid,name:x.name||'',surname:x.surname||'',career:x.career||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false}];
  session={role:'student',uid:SECUSER.uid,studentId:sid,tab:session&&session.tab?session.tab:'home'};

  STUDUNSUB=firestore.collection('alumnos').doc(sid).collection('registros').onSnapshot(function(snap){
    const rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data())});
    db.practices=rows.filter(function(x){return x.kind==='practica'}).map(function(x){return {id:x.id,studentId:sid,date:x.date||'',start:x.start||'',end:x.end||'',hours:Number(x.hours||0),activity:x.activity||'',notes:x.notes||''}});
    db.classes=rows.filter(function(x){return x.kind==='clase'}).map(function(x){return {id:x.id,studentId:sid,date:x.date||'',hours:Number(x.hours||0),status:x.status||'Presente'}});
    db.improvements=rows.filter(function(x){return x.kind==='mejora'}).map(function(x){return {id:x.id,studentId:sid,month:x.month||'',text:x.text||''}});
    renderStudent();
  },function(err){console.error(err);alert('No se pudo sincronizar: '+err.message)});

  renderStudent();
}

savePractice=async function(e){
  e.preventDefault();
  try{
    if(!SECUSER||SECUSER.role!=='student')throw new Error('Sesión de alumno inválida.');
    const sid=SECUSER.studentId;
    const date=document.getElementById('pd').value;
    const start=document.getElementById('ps').value;
    const end=document.getElementById('pe').value;
    const activity=document.getElementById('pa').value.trim();
    const notes=document.getElementById('pn').value.trim();
    const day=new Date(date+'T12:00:00').getDay();
    if(day===0||day===6){alert('La jornada práctica debe ser de lunes a viernes.');return}
    const a=start.split(':'),b=end.split(':');
    const minutes=(Number(b[0])*60+Number(b[1]))-(Number(a[0])*60+Number(a[1]));
    if(minutes<=0){alert('La hora de finalización debe ser posterior a la de inicio.');return}
    const hours=Math.round(minutes/60*100)/100;
    if(weeklyPractice(sid,date)+hours>weekMax+1e-9){alert('Esta carga supera el máximo de '+weekMax+' horas semanales.');return}
    await firestore.collection('alumnos').doc(sid).collection('registros').doc('p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({
      studentId:sid,kind:'practica',date:date,start:start,end:end,hours:hours,activity:activity,notes:notes,
      createdAt:new Date().toISOString(),createdBy:SECUSER.uid
    },{merge:false});
    session.tab='home';renderStudent();alert('Registro guardado correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar: '+err.message)}
};

saveClass=async function(e){
  e.preventDefault();
  try{
    const sid=SECUSER.studentId,date=document.getElementById('cd').value,hours=Number(document.getElementById('ch').value);
    if(!Number.isFinite(hours)||hours<=0||hours>24){alert('Ingresá horas válidas.');return}
    if(db.classes.some(function(x){return x.studentId===sid&&x.date===date})){alert('Ya existe una asistencia para esa fecha.');return}
    await firestore.collection('alumnos').doc(sid).collection('registros').doc('c-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({
      studentId:sid,kind:'clase',date:date,hours:hours,status:'Presente',
      createdAt:new Date().toISOString(),createdBy:SECUSER.uid
    },{merge:false});
    session.tab='home';renderStudent();alert('Asistencia guardada correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar: '+err.message)}
};

saveImprovement=async function(e){
  e.preventDefault();
  try{
    const sid=SECUSER.studentId,text=document.getElementById('improvement').value.trim();
    await firestore.collection('alumnos').doc(sid).collection('registros').doc('i-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)).set({
      studentId:sid,kind:'mejora',month:today().slice(0,7),text:text,
      createdAt:new Date().toISOString(),createdBy:SECUSER.uid
    },{merge:false});
    renderStudent();alert('Mejora mensual guardada correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar: '+err.message)}
};

updateStudentMeta=async function(stid,field,val){
  try{
    if(!SECUSER||SECUSER.role!=='student')return;
    const payload={};payload[field]=val;payload.updatedAt=new Date().toISOString();
    await firestore.collection('student_profiles').doc(SECUSER.uid).set(payload,{merge:true});
  }catch(err){console.error(err)}
};

async function loginTutorF(e){
  e.preventDefault();
  try{
    const cred=await AUTHF.signInWithEmailAndPassword(document.getElementById('fTutorEmail').value.trim(),document.getElementById('fTutorPassword').value);
    const t=await firestore.collection('tutores').doc(cred.user.uid).get();
    if(!t.exists||t.data().active===false)throw new Error('Cuenta no autorizada como tutor.');
    SECUSER={role:'tutor',uid:cred.user.uid,tutor:t.data().name||cred.user.email};
    session={role:'tutor',uid:cred.user.uid,tutor:SECUSER.tutor,tab:'dashboard'};
    startTutorF();
  }catch(err){console.error(err);alert('No se pudo ingresar como tutor: '+err.message)}
}

function startTutorF(){
  clearF();
  const d=firestore.collection('student_directory').onSnapshot(function(snap){
    db.students=snap.docs.map(function(doc){const x=doc.data()||{};return {id:String(x.studentId||doc.id),name:x.name||'',surname:x.surname||'',career:x.career||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false}});
    renderTutor();
  });
  const r=firestore.collectionGroup('registros').onSnapshot(function(snap){
    const rows=snap.docs.map(function(doc){const x=doc.data()||{},parent=doc.ref.parent.parent;return Object.assign({id:doc.id,studentId:x.studentId||(parent?parent.id:'')},x)});
    db.practices=rows.filter(function(x){return x.kind==='practica'}).map(function(x){return {id:x.id,studentId:x.studentId,date:x.date||'',start:x.start||'',end:x.end||'',hours:Number(x.hours||0),activity:x.activity||'',notes:x.notes||''}});
    db.classes=rows.filter(function(x){return x.kind==='clase'}).map(function(x){return {id:x.id,studentId:x.studentId,date:x.date||'',hours:Number(x.hours||0),status:x.status||'Presente'}});
    db.improvements=rows.filter(function(x){return x.kind==='mejora'}).map(function(x){return {id:x.id,studentId:x.studentId,month:x.month||'',text:x.text||''}});
    renderTutor();
  });
  TUTORUNSUBS=[d,r];
  renderTutor();
}

window.logout=async function(){
  clearF();SECUSER=null;session=null;
  try{await AUTHF.signOut()}finally{screenF('login')}
};

login=function(){screenF(AUTHMODE)};
screenF('login');

firestore.collection('student_directory').onSnapshot(function(snap){
  PUBSTUDENTS=snap.docs.map(function(doc){const x=doc.data()||{};return Object.assign({id:doc.id},x)});
  if(!SECUSER)screenF(AUTHMODE);
},function(err){console.error('Directorio:',err)});

AUTHF.onAuthStateChanged(function(user){
  if(!user)return;
  if(SECUSER)return;
  firestore.collection('tutores').doc(user.uid).get().then(function(t){
    if(t.exists&&t.data().active!==false){
      SECUSER={role:'tutor',uid:user.uid,tutor:t.data().name||user.email};
      session={role:'tutor',uid:user.uid,tutor:SECUSER.tutor,tab:'dashboard'};
      startTutorF();
    }
  }).catch(function(err){console.error('Auth:',err)});
});
