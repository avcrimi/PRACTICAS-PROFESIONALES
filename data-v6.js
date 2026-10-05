// PRÁCTICAS PROFESIONALES - sincronización V6
// Alta pública mediante transacción sobre main_data + cargas independientes en registros_horas.
const baseLoginV6=login;
function norm6(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ')}
function full6(s){return s?((s.name||s.nombre||'')+' '+(s.surname||s.apellido||'')).trim():'—'}
function code6(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const a=new Uint8Array(8);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);let o='';for(let i=0;i<8;i++)o+=chars[a[i]%chars.length];return o}
async function hash6(v){const d=new TextEncoder().encode(norm6(v));if(window.crypto&&crypto.subtle){const h=await crypto.subtle.digest('SHA-256',d);return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,'0')).join('')}return btoa(unescape(encodeURIComponent(norm6(v))))}
function studentFromLegacy6(x){return {id:String(x.id||''),name:x.name||x.nombre||'',surname:x.surname||x.apellido||'',career:x.career||x.carrera||'',organization:x.organization||'',referent:x.referent||'',active:x.active!==false,accessCodeHash:x.accessCodeHash||''}}
function login6(mode){
  const list=((db.students||[]).filter(s=>s.active!==false).sort((a,b)=>full6(a).localeCompare(full6(b),'es')))
    .map(s=>'<option value="'+esc(full6(s))+'"></option>').join('');
  const tutor=(mode==='tutor');
  document.getElementById('app').innerHTML='<div class="shell"><div class="login panel">'+
    '<div class="eyebrow">GESTIÓN ACADÉMICA EN LA NUBE</div><h2>PRÁCTICAS PROFESIONALES</h2>'+
    '<div class="subtitle">Acceso seguro y sincronizado con la planilla de alumnos.</div>'+
    '<div class="tabs">'+
      '<button id="v6Login" class="btn tab '+(!tutor?'active':'')+'" onclick="login6(\'login\')">Iniciar sesión</button>'+
      '<button id="v6Register" class="btn tab" onclick="login6(\'register\')">Registrarse</button>'+
      '<button id="v6Tutor" class="btn tab '+(tutor?'active':'')+'" onclick="login6(\'tutor\')">Tutor</button>'+
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
    if(!session)login6('login');else if(session.role==='student')renderStudent();else renderTutor();
  },err=>{console.error('Sincronización de planilla:',err);if(!session)login6('login')});
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
subscribeMainDataV6();