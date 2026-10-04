// Gestión de Prácticas Profesionales - capa de sincronización V2.
// Se carga después de index.html para mantener el diseño existente.

const legacyLoginV2=login;
const legacyRenderTutorV2=renderTutor;

function uniqueIdV2(prefix){
  const raw=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  return prefix+'-'+raw;
}
function normalizeTextV2(v){
  return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function stableHashV2(value){
  let h=2166136261;
  for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h+=(h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24);}
  return(h>>>0).toString(36);
}
async function writeRecordsV2(collectionName,records,idPrefix){
  const items=Array.isArray(records)?records:[];
  for(let i=0;i<items.length;i+=450){
    const batch=firestore.batch();
    items.slice(i,i+450).forEach(original=>{
      const data=clone(original||{}),docId=String(data.id||uniqueIdV2(idPrefix||collectionName));
      delete data.id;
      batch.set(firestore.collection(collectionName).doc(docId),data,{merge:true});
    });
    await batch.commit();
  }
}
async function migrateLegacyDataV2(){
  const markerRef=firestore.collection('system').doc('collection_migration_v2');
  if((await markerRef.get()).exists)return;
  const legacySnap=await firestore.collection('system').doc('main_data').get();

  if(legacySnap.exists){
    const remote=legacySnap.data()||{};
    await writeRecordsV2('students',remote.students||[],'stu');
    await writeRecordsV2('practices',remote.practices||[],'p');
    await writeRecordsV2('classes',remote.classes||[],'c');
    await writeRecordsV2('improvements',remote.improvements||[],'i');
    await writeRecordsV2('audit',remote.audit||[],'a');

    const tutors=(remote.tutors||[]).map((t,i)=>({
      id:t.id||('tut-'+stableHashV2(String(t.name||'Tutor '+(i+1))+'|'+String(t.pin||''))),
      name:t.name||('Tutor '+(i+1)),
      pin:String(t.pin||''),
      active:t.active!==false
    }));
    await writeRecordsV2('tutors',tutors,'tut');
    await firestore.collection('system').doc('config').set(
      remote.settings||{institution:'Universidad Siglo 21',practicePeriod:'2026',organizationDefault:''},
      {merge:true}
    );
    await markerRef.set({
      version:2,migratedAt:new Date().toISOString(),source:'system/main_data',
      counts:{
        students:(remote.students||[]).length,
        practices:(remote.practices||[]).length,
        classes:(remote.classes||[]).length,
        improvements:(remote.improvements||[]).length,
        audit:(remote.audit||[]).length,
        tutors:tutors.length
      }
    },{merge:true});
  }else{
    await writeRecordsV2('tutors',[
      {id:'tut-8822',pin:'8822',name:'Tutor 1',active:true},
      {id:'tut-1122',pin:'1122',name:'Tutor 2',active:true},
      {id:'tut-3344',pin:'3344',name:'Tutor 3',active:true},
      {id:'tut-5566',pin:'5566',name:'Tutor 4',active:true}
    ],'tut');
    await firestore.collection('system').doc('config').set(
      {institution:'Universidad Siglo 21',practicePeriod:'2026',organizationDefault:''},
      {merge:true}
    );
    await markerRef.set({version:2,migratedAt:new Date().toISOString(),source:'new_installation'},{merge:true});
  }
}

const readyV2=new Set();
let cloudReadyV2=false;
function subscribeCollectionV2(collectionName,target,key){
  firestore.collection(collectionName).onSnapshot(snap=>{
    db[target]=snap.docs.map(d=>Object.assign({id:d.id},d.data()));
    readyV2.add(key);
    if(readyV2.size>=7)cloudReadyV2=true;
    if(!session){
      if(cloudReadyV2)login();
      refreshLoginOptionsV2();
    }else{
      if(session.role==='student')renderStudent();
      else if(session.role==='tutor')renderTutor();
    }
  },err=>{
    console.error('Error en sincronización de '+collectionName+':',err);
    readyV2.add(key);
    if(readyV2.size>=7){cloudReadyV2=true;if(!session)login();}
  });
}

// Durante la transición, si una sesión anterior todavía escribe en main_data,
// se copian solo los registros que aún no existen en las colecciones nuevas.
// Nunca se eliminan registros.
async function bridgeLegacyV2(remote){
  const groups=[
    ['students',remote.students||[]],
    ['practices',remote.practices||[]],
    ['classes',remote.classes||[]],
    ['improvements',remote.improvements||[]],
    ['audit',remote.audit||[]]
  ];
  for(const group of groups){
    const local=db[group[0]]||[];
    for(const item of group[1]){
      if(!item||!item.id)continue;
      if(local.some(x=>String(x.id)===String(item.id)))continue;
      await firestore.collection(group[0]).doc(String(item.id)).set(clone(item),{merge:true});
    }
  }
}

initCloudData=async function(){
  try{
    await migrateLegacyDataV2();
    subscribeCollectionV2('students','students','students');
    subscribeCollectionV2('practices','practices','practices');
    subscribeCollectionV2('classes','classes','classes');
    subscribeCollectionV2('improvements','improvements','improvements');
    subscribeCollectionV2('audit','audit','audit');
    subscribeCollectionV2('tutors','tutors','tutors');

    firestore.collection('system').doc('config').onSnapshot(snap=>{
      if(snap.exists)db.settings=Object.assign({},db.settings,snap.data());
      readyV2.add('config');
      if(readyV2.size>=7){cloudReadyV2=true;if(!session)login();}
    },err=>{
      console.error('Error en configuración:',err);
      readyV2.add('config');
      if(readyV2.size>=7){cloudReadyV2=true;if(!session)login();}
    });

    firestore.collection('system').doc('main_data').onSnapshot(snap=>{
      if(snap.exists)bridgeLegacyV2(snap.data()||{}).catch(err=>console.error('Puente legacy:',err));
    },err=>console.warn('Histórico legacy no disponible:',err));
  }catch(err){
    console.error('Error al inicializar la nube V2:',err);
    alert('No se pudo inicializar la base en la nube. Verificá la conexión con Firebase.');
  }
};

function refreshLoginOptionsV2(){
  const dl=document.getElementById('studentNameSuggestions'),cd=document.getElementById('careerSuggestions');
  if(!dl||!cd)return;
  const students=(db.students||[]).filter(s=>s.active!==false).sort((a,b)=>studentName(a).localeCompare(studentName(b),'es'));
  dl.innerHTML=students.map(s=>'<option value="'+esc(studentName(s))+'" label="'+esc(s.career||'')+'"></option>').join('');
  cd.innerHTML=[...new Set(students.map(s=>s.career).filter(Boolean))].map(c=>'<option value="'+esc(c)+'"></option>').join('');
}
function autofillStudentV2(){
  const field=document.getElementById('ln');if(!field)return;
  const value=field.value||'';
  const st=(db.students||[]).find(s=>s.active!==false&&normalizeTextV2(studentName(s))===normalizeTextV2(value));
  if(!st)return;
  const surname=document.getElementById('ls'),career=document.getElementById('lc');
  if(surname)surname.value=st.surname||'';
  if(career)career.value=st.career||'';
}

login=function(){
  legacyLoginV2();
  const form=document.querySelector('#loginStudent form');
  if(!form)return;

  let careerField=document.getElementById('careerLoginField');
  if(!careerField){
    careerField=document.createElement('div');
    careerField.id='careerLoginField';
    careerField.className='field';
    careerField.innerHTML='<label>Carrera</label><input id="lc" list="careerSuggestions" autocomplete="off" placeholder="Ej. Criminología y Seguridad" required><datalist id="careerSuggestions"></datalist>';
    const primary=form.querySelector('.btn-primary');
    if(primary)form.insertBefore(careerField,primary);else form.appendChild(careerField);
  }

  const nameField=document.getElementById('ln');
  if(nameField){
    nameField.setAttribute('list','studentNameSuggestions');
    nameField.oninput=autofillStudentV2;
    let list=document.getElementById('studentNameSuggestions');
    if(!list){
      list=document.createElement('datalist');
      list.id='studentNameSuggestions';
      nameField.parentNode.appendChild(list);
    }
    refreshLoginOptionsV2();
  }

  const button=form.querySelector('.btn-primary');
  if(button)button.textContent='Ingresar / registrarse';
};

studentLogin=async function(e){
  e.preventDefault();
  const rawName=document.getElementById('ln').value.trim();
  const rawSurname=document.getElementById('ls').value.trim();
  const career=document.getElementById('lc').value.trim();
  if(!rawName||!rawSurname||!career){alert('Completá nombre, apellido y carrera.');return}

  const fullMatch=(db.students||[]).find(x=>x.active!==false&&normalizeTextV2(studentName(x))===normalizeTextV2(rawName));
  const matches=(db.students||[]).filter(x=>x.active!==false&&normalizeTextV2(x.name)===normalizeTextV2(rawName)&&normalizeTextV2(x.surname)===normalizeTextV2(rawSurname));
  const st=fullMatch||matches.find(x=>normalizeTextV2(x.career)===normalizeTextV2(career))||matches[0];

  if(st){
    session={role:'student',studentId:st.id,tab:'home'};
    renderStudent();
    return;
  }

  const record={
    id:uniqueIdV2('stu'),name:rawName,surname:rawSurname,career:career,
    organization:'',referent:'',active:true,createdAt:today(),updatedAt:new Date().toISOString()
  };

  try{
    await firestore.collection('students').doc(record.id).set(record,{merge:false});
    await audit('CREATE_STUDENT',record.id,rawName+' '+rawSurname+' · '+career);
    db.students.push(clone(record));
    session={role:'student',studentId:record.id,tab:'home'};
    renderStudent();
  }catch(err){console.error(err);alert('No se pudo registrar al estudiante en la nube: '+err.message)}
};

savePractice=async function(e){
  e.preventDefault();
  const stid=session.studentId,date=document.getElementById('pd').value,start=document.getElementById('ps').value,end=document.getElementById('pe').value,activity=document.getElementById('pa').value.trim(),notes=document.getElementById('pn').value.trim();
  const day=new Date(date+'T12:00:00').getDay();
  if(day===0||day===6){alert('La jornada práctica debe ser de lunes a viernes.');return}
  if(!start||!end){alert('Completá hora de inicio y fin.');return}
  const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number),mins=(eh*60+em)-(sh*60+sm);
  if(mins<=0){alert('La hora de finalización debe ser posterior a la de inicio.');return}
  const hours=Math.round((mins/60)*100)/100,weekly=weeklyPractice(stid,date);
  if(weekly+hours>weekMax+1e-9){alert('Esta carga supera el máximo de '+weekMax+' horas semanales. Tenés '+fmt(weekly)+' en esa semana.');return}

  const record={id:uniqueIdV2('p'),studentId:stid,date,start,end,hours,activity,notes,createdAt:new Date().toISOString(),createdBy:'student'};
  try{
    await firestore.collection('practices').doc(record.id).set(record,{merge:false});
    await audit('CREATE_PRACTICE',stid,date+' · '+hours+' h');
    db.practices.push(clone(record));
    alert('Registro guardado en la nube: '+fmt(hours)+'.');
    session.tab='home';renderStudent();
  }catch(err){console.error(err);alert('No se pudo guardar el registro: '+err.message)}
};

saveClass=async function(e){
  e.preventDefault();
  const date=document.getElementById('cd').value,hours=Number(document.getElementById('ch').value);
  if(!Number.isFinite(hours)||hours<=0||hours>24){alert('Ingresá una cantidad de horas válida.');return}
  const dup=db.classes.find(x=>x.studentId===session.studentId&&x.date===date&&x.active!==false);
  if(dup){alert('Ya existe una asistencia para esa fecha. El registro anterior se conserva y no se reemplaza.');return}
  const record={id:uniqueIdV2('c'),studentId:session.studentId,date,hours,status:'Presente',createdAt:new Date().toISOString(),createdBy:'student'};
  try{
    await firestore.collection('classes').doc(record.id).set(record,{merge:false});
    await audit('CREATE_CLASS',session.studentId,date+' · '+hours+' h');
    db.classes.push(clone(record));
    alert('Asistencia guardada en la nube.');
    session.tab='home';renderStudent();
  }catch(err){console.error(err);alert('No se pudo guardar la asistencia: '+err.message)}
};

function latestImprovementV2(stid,month){
  return db.improvements.filter(x=>x.studentId===stid&&x.month===month).sort((a,b)=>String(b.savedAt||b.createdAt||'').localeCompare(String(a.savedAt||a.createdAt||'')))[0];
}
studentImprovement=function(st){
  const month=today().slice(0,7),old=latestImprovementV2(st.id,month),text=old?old.text:'';
  return '<section class="panel"><div class="section-head"><h2>Mejora mensual</h2><span class="badge">Obligatorio</span></div><form class="form" onsubmit="saveImprovement(event)"><div class="field"><label>¿Qué mejorarías de tu práctica o plataforma?</label><textarea id="improvement" required placeholder="Escribí tus observaciones...">'+esc(text)+'</textarea></div><button class="btn btn-primary">Guardar mejora mensual</button></form></section>';
};
saveImprovement=async function(e){
  e.preventDefault();
  const month=today().slice(0,7),text=document.getElementById('improvement').value.trim();
  const record={id:uniqueIdV2('i'),studentId:session.studentId,month,text,savedAt:new Date().toISOString(),createdAt:new Date().toISOString(),createdBy:'student'};
  try{
    await firestore.collection('improvements').doc(record.id).set(record,{merge:false});
    await audit('SAVE_IMPROVEMENT',session.studentId,month);
    db.improvements.push(clone(record));
    alert('Mejora mensual guardada en la nube.');
    renderStudent();
  }catch(err){console.error(err);alert('No se pudo guardar la mejora: '+err.message)}
};

const metaTimersV2={};
updateStudentMeta=function(stid,field,val){
  const st=db.students.find(x=>x.id===stid);
  if(st)st[field]=val;
  const key=stid+'|'+field;
  clearTimeout(metaTimersV2[key]);
  metaTimersV2[key]=setTimeout(async()=>{
    try{
      await firestore.collection('students').doc(stid).set({[field]:val,updatedAt:new Date().toISOString()},{merge:true});
    }catch(err){console.error('No se pudo sincronizar '+field+': '+err.message)}
  },450);
};

saveStudent=async function(e){
  e.preventDefault();
  const idVal=document.getElementById('sid').value,name=document.getElementById('sn').value.trim(),surname=document.getElementById('ss').value.trim(),career=document.getElementById('sc').value.trim(),organization=document.getElementById('so').value.trim(),referent=document.getElementById('sr').value.trim(),active=document.getElementById('sa').checked;
  if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}
  const duplicate=db.students.find(st=>st.id!==idVal&&normalizeTextV2(st.name)===normalizeTextV2(name)&&normalizeTextV2(st.surname)===normalizeTextV2(surname)&&normalizeTextV2(st.career)===normalizeTextV2(career)&&st.active!==false);
  if(duplicate){alert('Ese alumno ya está registrado con la misma carrera.');return}

  const docId=idVal||uniqueIdV2('stu'),payload={name,surname,career,organization,referent,active,updatedAt:new Date().toISOString()};
  if(!idVal)payload.createdAt=today();

  try{
    await firestore.collection('students').doc(docId).set(payload,{merge:true});
    await audit(idVal?'UPDATE_STUDENT':'CREATE_STUDENT',docId,name+' '+surname);
    const local=Object.assign({id:docId},payload),idx=db.students.findIndex(s=>s.id===docId);
    if(idx>=0)db.students[idx]=Object.assign({},db.students[idx],local);else db.students.push(local);
    clearStudentForm();renderTutor();alert('Alumno guardado en la nube correctamente.');
  }catch(err){console.error(err);alert('No se pudo guardar al alumno: '+err.message)}
};

deleteStudent=async function(id){
  const st=db.students.find(x=>x.id===id);
  if(!st)return;
  if(!confirm('¿Deshabilitar a '+studentName(st)+'? Sus datos y registros se conservarán en la nube.'))return;
  try{
    const payload={active:false,disabledAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    await firestore.collection('students').doc(id).set(payload,{merge:true});
    await audit('DISABLE_STUDENT',id,studentName(st));
    Object.assign(st,payload);
    renderTutor();
    alert('Alumno deshabilitado. Sus prácticas, clases y mejoras siguen conservadas.');
  }catch(err){console.error(err);alert('No se pudo deshabilitar al alumno: '+err.message)}
};

saveSettings=async function(e){
  e.preventDefault();
  const payload={institution:document.getElementById('setInst').value.trim(),practicePeriod:document.getElementById('setPer').value.trim(),organizationDefault:db.settings.organizationDefault||''};
  try{
    await firestore.collection('system').doc('config').set(payload,{merge:true});
    db.settings=Object.assign({},db.settings,payload);
    alert('Configuración guardada en la nube.');
  }catch(err){console.error(err);alert('No se pudo guardar la configuración: '+err.message)}
};

addTutorPin=async function(e){
  e.preventDefault();
  const name=document.getElementById('newTutorName').value.trim(),pin=document.getElementById('newTutorPin').value.trim();
  if(pin.length<4){alert('El PIN debe tener al menos 4 dígitos.');return}
  if(db.tutors.some(t=>String(t.pin)===pin&&t.active!==false)){alert('Ese PIN ya está en uso.');return}
  const record={id:uniqueIdV2('tut'),name,pin,active:true,createdAt:new Date().toISOString()};
  try{
    await firestore.collection('tutors').doc(record.id).set(record,{merge:false});
    await audit('CREATE_TUTOR',record.id,name);
    db.tutors.push(clone(record));
    alert('Tutor agregado con éxito.');
    renderTutor();
  }catch(err){console.error(err);alert('No se pudo agregar el tutor: '+err.message)}
};

removeTutor=async function(idx){
  const t=db.tutors[idx];if(!t)return;
  if(db.tutors.filter(x=>x.active!==false).length<=1){alert('Debe quedar al menos un tutor activo.');return}
  if(!confirm('¿Deshabilitar este PIN de tutor? El registro se conservará.'))return;
  try{
    const payload={active:false,disabledAt:new Date().toISOString()};
    await firestore.collection('tutors').doc(t.id).set(payload,{merge:true});
    await audit('DISABLE_TUTOR',t.id,t.name);
    Object.assign(t,payload);
    renderTutor();
  }catch(err){console.error(err);alert('No se pudo deshabilitar el tutor: '+err.message)}
};

async function auditV2(action,targetId,detail){
  const record={id:uniqueIdV2('a'),date:new Date().toISOString(),action,targetId,detail};
  try{
    await firestore.collection('audit').doc(record.id).set(record,{merge:false});
    db.audit.unshift(record);
    if(db.audit.length>500)db.audit.length=500;
  }catch(err){console.error('No se pudo registrar auditoría:',err)}
}
audit=auditV2;

function tutorActivityV2(){
  const rows=[
    ...db.practices.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Práctica',hours:x.hours,detail:(x.activity||'')+(x.notes?' · '+x.notes:'')})),
    ...db.classes.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Clase',hours:x.hours,detail:x.status||'Presente'})),
    ...db.improvements.map(x=>({sort:x.savedAt||x.createdAt||x.month,date:x.savedAt?String(x.savedAt).slice(0,10):x.month,studentId:x.studentId,type:'Mejora mensual',hours:null,detail:x.text||''}))
  ].sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  const names=[...new Set(db.students.map(s=>studentName(s)))].sort((a,b)=>a.localeCompare(b,'es'));
  return "<section class='panel'><div class='section-head'><h2>Historial completo de cargas</h2><span class='badge'>"+rows.length+" registros · no se elimina ningún registro</span></div>"+
    "<div class='row' style='margin-bottom:12px'><div class='field'><label>Buscar alumno</label><input id='activitySearchV2' list='activityStudentSuggestionsV2' placeholder='Escribí nombre o apellido...' oninput='renderTutorActivityRowsV2()'><datalist id='activityStudentSuggestionsV2'>"+names.map(n=>'<option value="'+esc(n)+'"></option>').join('')+"</datalist></div>"+
    "<div class='field'><label>Tipo</label><select id='activityTypeV2' onchange='renderTutorActivityRowsV2()'><option value=''>Todos</option><option value='Práctica'>Práctica</option><option value='Clase'>Clase</option><option value='Mejora mensual'>Mejora mensual</option></select></div></div>"+
    "<div class='table-wrap'><table class='table'><thead><tr><th>Fecha</th><th>Alumno</th><th>Carrera</th><th>Tipo</th><th>Horas</th><th>Contenido cargado</th></tr></thead><tbody id='tutorActivityRowsV2'>"+renderTutorActivityRowsHtmlV2(rows)+"</tbody></table></div></section>";
}
function renderTutorActivityRowsHtmlV2(rows){
  return rows.map(r=>{
    const st=db.students.find(s=>s.id===r.studentId);
    return '<tr><td>'+fmtDate(r.date)+'</td><td><strong>'+esc(studentName(st))+'</strong></td><td>'+esc(st?st.career||'':'')+'</td><td><span class="tag">'+esc(r.type)+'</span></td><td>'+((r.hours===null||r.hours===undefined)?'—':fmt(r.hours))+'</td><td style="white-space:normal;min-width:320px">'+esc(r.detail||'')+'</td></tr>';
  }).join('')||'<tr><td colspan="6"><div class="empty">No hay cargas que coincidan con la búsqueda.</div></td></tr>';
}
function renderTutorActivityRowsV2(){
  const search=document.getElementById('activitySearchV2'),typeEl=document.getElementById('activityTypeV2');
  const q=normalizeTextV2(search?search.value:''),type=typeEl?typeEl.value:'';
  const rows=[
    ...db.practices.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Práctica',hours:x.hours,detail:(x.activity||'')+(x.notes?' · '+x.notes:'')})),
    ...db.classes.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Clase',hours:x.hours,detail:x.status||'Presente'})),
    ...db.improvements.map(x=>({sort:x.savedAt||x.createdAt||x.month,date:x.savedAt?String(x.savedAt).slice(0,10):x.month,studentId:x.studentId,type:'Mejora mensual',hours:null,detail:x.text||''}))
  ].sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  const filtered=rows.filter(r=>{
    const st=db.students.find(s=>s.id===r.studentId);
    const person=normalizeTextV2(studentName(st)+' '+(st?st.career||'':''));
    return (!q||person.includes(q))&&(!type||r.type===type);
  });
  const el=document.getElementById('tutorActivityRowsV2');
  if(el)el.innerHTML=renderTutorActivityRowsHtmlV2(filtered);
}

renderTutor=function(){
  if(session&&session.tab==='activity'){
    const html=layout(
      "<div class='hero'><div><div class='eyebrow'>Panel de tutores</div><div class='title'>Seguimiento de Prácticas Profesionales</div><div class='muted'>Control global de alumnos y planillas oficiales en la nube.</div></div></div>"+
      "<div class='nav-tabs'><button class='btn active' onclick='navTutor(\"activity\")'>Historial</button><button class='btn' onclick='navTutor(\"dashboard\")'>Dashboard</button><button class='btn' onclick='navTutor(\"students\")'>Alumnos</button><button class='btn' onclick='navTutor(\"plans\")'>Planillas</button><button class='btn' onclick='navTutor(\"settings\")'>Configuración</button></div>"+
      tutorActivityV2(),'TUTOR · '+session.tutor
    );
    document.getElementById('app').innerHTML=html;
    return;
  }

  legacyRenderTutorV2();
  const nav=document.querySelector('.nav-tabs');
  if(nav&&!nav.querySelector('[data-v2-history]')){
    const btn=document.createElement('button');
    btn.className='btn';
    btn.setAttribute('data-v2-history','1');
    btn.textContent='Historial';
    btn.onclick=function(){navTutor('activity')};
    nav.appendChild(btn);
  }
  document.querySelectorAll('button.btn-danger').forEach(btn=>{
    if(btn.textContent.trim()==='Eliminar')btn.textContent='Deshabilitar';
  });
};

importJSON=async function(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async function(ev){
    try{
      const imported=JSON.parse(ev.target.result);
      await writeRecordsV2('students',imported.students||[],'stu');
      await writeRecordsV2('practices',imported.practices||[],'p');
      await writeRecordsV2('classes',imported.classes||[],'c');
      await writeRecordsV2('improvements',imported.improvements||[],'i');
      await writeRecordsV2('audit',imported.audit||[],'a');
      await writeRecordsV2('tutors',imported.tutors||[],'tut');
      if(imported.settings)await firestore.collection('system').doc('config').set(imported.settings,{merge:true});
      alert('Base importada y sincronizada. Se conservaron los registros existentes y no se eliminó nada.');
      location.reload();
    }catch(err){console.error(err);alert('Archivo inválido o error al importar: '+err.message)}
  };
  reader.readAsText(file);
};