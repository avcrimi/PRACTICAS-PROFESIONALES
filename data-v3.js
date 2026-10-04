// Gestión de Prácticas Profesionales - sincronización V3.
// Usa las colecciones Firebase que ya existen en este proyecto.
// No modifica el diseño de la página.

const legacyLoginV2=login;
const legacyRenderTutorV2=renderTutor;

function uniqueIdV3(prefix){
  const raw=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10));
  return prefix+'-'+raw;
}
function normalizeTextV3(v){
  return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function parseFullNameV3(full){
  const parts=String(full||'').trim().split(/\s+/);
  if(parts.length<2)return{name:parts[0]||'',surname:''};
  return{name:parts.slice(0,-1).join(' '),surname:parts[parts.length-1]};
}
function studentNameV3(st){return st?((st.name||'')+' '+(st.surname||'')).trim():'—';}

async function migrateLegacyV3(){
  let legacy={};
  try{
    const snap=await firestore.collection('system').doc('main_data').get();
    if(snap.exists)legacy=snap.data()||{};
  }catch(err){
    console.warn('No se pudo leer el histórico main_data:',err);
    return;
  }

  const students=Array.isArray(legacy.students)?legacy.students:[];
  const practices=Array.isArray(legacy.practices)?legacy.practices:[];
  const classes=Array.isArray(legacy.classes)?legacy.classes:[];
  const improvements=Array.isArray(legacy.improvements)?legacy.improvements:[];
  const audits=Array.isArray(legacy.audit)?legacy.audit:[];

  try{
    for(let i=0;i<students.length;i+=400){
      const batch=firestore.batch();
      students.slice(i,i+400).forEach(st=>{
        const id=String(st.id||uniqueIdV3('stu'));
        const full=studentNameV3(st);
        const payload={
          nombreCompleto:full,
          nombre:st.name||parseFullNameV3(full).name,
          apellido:st.surname||parseFullNameV3(full).surname,
          carrera:st.career||'',
          rol:'estudiante',
          organization:st.organization||'',
          referent:st.referent||'',
          active:st.active!==false,
          legacyStudentId:id,
          migratedAt:new Date().toISOString()
        };
        batch.set(firestore.collection('usuarios').doc(id),payload,{merge:true});
      });
      await batch.commit();
    }
  }catch(err){
    console.error('No se pudieron migrar alumnos al esquema existente:',err);
  }

  try{
    const batchItems=[];
    practices.forEach(p=>{
      if(!p||!p.id)return;
      batchItems.push({
        id:'legacy-practice-'+String(p.id),
        data:{
          id_estudiante:String(p.studentId||''),
          tipo:'practica',
          fecha:p.date||'',
          cantidad_horas:Number(p.hours||0),
          descripcion:p.activity||'',
          observaciones:p.notes||'',
          hora_inicio:p.start||'',
          hora_fin:p.end||'',
          creado_el:p.createdAt||new Date().toISOString(),
          origen:'legacy_main_data',
          legacy_id:String(p.id)
        }
      });
    });
    classes.forEach(c=>{
      if(!c||!c.id)return;
      batchItems.push({
        id:'legacy-class-'+String(c.id),
        data:{
          id_estudiante:String(c.studentId||''),
          tipo:'clase',
          fecha:c.date||'',
          cantidad_horas:Number(c.hours||0),
          descripcion:c.status||'Presente',
          creado_el:c.createdAt||new Date().toISOString(),
          origen:'legacy_main_data',
          legacy_id:String(c.id)
        }
      });
    });
    improvements.forEach(m=>{
      if(!m||!m.id)return;
      batchItems.push({
        id:'legacy-improvement-'+String(m.id),
        data:{
          id_estudiante:String(m.studentId||''),
          tipo:'mejora',
          fecha:String(m.month||''),
          cantidad_horas:0,
          descripcion:m.text||'',
          creado_el:m.savedAt||m.createdAt||new Date().toISOString(),
          origen:'legacy_main_data',
          legacy_id:String(m.id)
        }
      });
    });
    for(let i=0;i<batchItems.length;i+=400){
      const batch=firestore.batch();
      batchItems.slice(i,i+400).forEach(item=>{
        batch.set(firestore.collection('registros_horas').doc(item.id),item.data,{merge:true});
      });
      await batch.commit();
    }
  }catch(err){
    console.error('No se pudieron migrar los registros históricos:',err);
  }

  try{
    const batchItems=audits.filter(x=>x&&x.id).map(a=>({
      id:'legacy-audit-'+String(a.id),
      data:{
        id_estudiante:String(a.targetId||''),
        tipo:'auditoria',
        fecha:String(a.date||''),
        cantidad_horas:0,
        descripcion:String(a.detail||''),
        accion:String(a.action||''),
        creado_el:String(a.date||new Date().toISOString()),
        origen:'legacy_main_data',
        legacy_id:String(a.id)
      }
    }));
    for(let i=0;i<batchItems.length;i+=400){
      const batch=firestore.batch();
      batchItems.slice(i,i+400).forEach(item=>{
        batch.set(firestore.collection('registros_horas').doc(item.id),item.data,{merge:true});
      });
      await batch.commit();
    }
  }catch(err){
    console.error('No se pudo migrar la auditoría histórica:',err);
  }
}

async function loadLegacySettingsV3(){
  try{
    const snap=await firestore.collection('system').doc('main_data').get();
    if(!snap.exists)return;
    const remote=snap.data()||{};
    if(remote.settings)db.settings=Object.assign({},db.settings,remote.settings);
    if(Array.isArray(remote.tutors))db.tutors=remote.tutors.map((t,i)=>Object.assign({
      id:t.id||('tut-'+i),active:t.active!==false
    },t));
  }catch(err){console.warn('No se pudieron cargar tutores/configuración:',err)}
}

const readyV3=new Set();
let cloudReadyV3=false;

function subscribeStudentsV3(){
  firestore.collection('usuarios').onSnapshot(snap=>{
    db.students=snap.docs
      .map(d=>Object.assign({id:d.id},d.data()))
      .filter(x=>!x.rol||x.rol==='estudiante')
      .map(x=>{
        const parsed=parseFullNameV3(x.nombreCompleto||'');
        return Object.assign({},x,{
          id:x.id,
          name:x.name||x.nombre||parsed.name,
          surname:x.surname||x.apellido||parsed.surname,
          career:x.career||x.carrera||'',
          organization:x.organization||'',
          referent:x.referent||'',
          active:x.active!==false
        });
      });
    readyV3.add('students');
    refreshLoginOptionsV3();
    if(cloudReadyV3&&session){
      if(session.role==='student')renderStudent();
      else renderTutor();
    }
    if(!session&&readyV3.size>=2){cloudReadyV3=true;login();}
  },err=>{
    console.error('Error leyendo usuarios:',err);
    readyV3.add('students');
    if(readyV3.size>=2&&!session){cloudReadyV3=true;login();}
  });
}

function subscribeRecordsV3(){
  firestore.collection('registros_horas').onSnapshot(snap=>{
    const rows=snap.docs.map(d=>Object.assign({id:d.id},d.data()));
    db.practices=rows.filter(x=>x.tipo==='practica').map(x=>({
      id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',
      start:x.hora_inicio||'',end:x.hora_fin||'',
      hours:Number(x.cantidad_horas||0),activity:x.descripcion||'',notes:x.observaciones||'',
      createdAt:x.creado_el||'',active:x.active!==false
    }));
    db.classes=rows.filter(x=>x.tipo==='clase').map(x=>({
      id:x.id,studentId:String(x.id_estudiante||''),date:x.fecha||'',
      hours:Number(x.cantidad_horas||0),status:x.descripcion||'Presente',
      createdAt:x.creado_el||'',active:x.active!==false
    }));
    db.improvements=rows.filter(x=>x.tipo==='mejora').map(x=>({
      id:x.id,studentId:String(x.id_estudiante||''),month:x.fecha||'',
      text:x.descripcion||'',savedAt:x.creado_el||'',createdAt:x.creado_el||''
    }));
    db.audit=rows.filter(x=>x.tipo==='auditoria');
    readyV3.add('records');
    if(readyV3.size>=2)cloudReadyV3=true;
    if(session){
      if(session.role==='student')renderStudent();
      else renderTutor();
    }else{
      login();
      refreshLoginOptionsV3();
    }
  },err=>{
    console.error('Error leyendo registros_horas:',err);
    readyV3.add('records');
    if(readyV3.size>=2){cloudReadyV3=true;if(!session)login();}
  });
}

function refreshLoginOptionsV3(){
  const dl=document.getElementById('studentNameSuggestions'),cd=document.getElementById('careerSuggestions');
  if(!dl)return;
  const students=(db.students||[]).filter(s=>s.active!==false).sort((a,b)=>studentNameV3(a).localeCompare(studentNameV3(b),'es'));
  dl.innerHTML=students.map(s=>'<option value="'+esc(studentNameV3(s))+'" label="'+esc(s.career||'')+'"></option>').join('');
  if(cd)cd.innerHTML=[...new Set(students.map(s=>s.career).filter(Boolean))].map(c=>'<option value="'+esc(c)+'"></option>').join('');
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
    nameField.oninput=autofillStudentV3;
    let list=document.getElementById('studentNameSuggestions');
    if(!list){
      list=document.createElement('datalist');
      list.id='studentNameSuggestions';
      nameField.parentNode.appendChild(list);
    }
    refreshLoginOptionsV3();
  }
  const button=form.querySelector('.btn-primary');
  if(button)button.textContent='Ingresar / registrarse';
};

function autofillStudentV3(){
  const field=document.getElementById('ln');if(!field)return;
  const value=normalizeTextV3(field.value);
  const st=(db.students||[]).find(s=>s.active!==false&&normalizeTextV3(studentNameV3(s))===value);
  if(!st)return;
  const surname=document.getElementById('ls'),career=document.getElementById('lc');
  if(surname)surname.value=st.surname||'';
  if(career)career.value=st.career||'';
}

studentLogin=async function(e){
  e.preventDefault();
  const rawName=document.getElementById('ln').value.trim();
  const rawSurname=document.getElementById('ls').value.trim();
  const career=document.getElementById('lc').value.trim();
  if(!rawName||!rawSurname||!career){alert('Completá nombre, apellido y carrera.');return}

  const matches=(db.students||[]).filter(x=>x.active!==false&&normalizeTextV3(x.name)===normalizeTextV3(rawName)&&normalizeTextV3(x.surname)===normalizeTextV3(rawSurname));
  let st=matches.find(x=>normalizeTextV3(x.career)===normalizeTextV3(career))||matches[0];

  if(st){
    session={role:'student',studentId:st.id,tab:'home'};
    renderStudent();
    return;
  }

  const id=uniqueIdV3('stu');
  const full=(rawName+' '+rawSurname).trim();
  const record={
    nombreCompleto:full,
    nombre:rawName,
    apellido:rawSurname,
    carrera:career,
    rol:'estudiante',
    organization:'',
    referent:'',
    active:true,
    createdAt:today(),
    updatedAt:new Date().toISOString()
  };

  try{
    await firestore.collection('usuarios').doc(id).set(record,{merge:false});
    await auditV3('CREATE_STUDENT',id,full+' · '+career);
    db.students.push(Object.assign({id:id,name:rawName,surname:rawSurname,career:career},record));
    session={role:'student',studentId:id,tab:'home'};
    renderStudent();
  }catch(err){
    console.error(err);
    alert('No se pudo registrar al estudiante en la nube: '+err.message);
  }
};

savePractice=async function(e){
  e.preventDefault();
  const stid=session.studentId,date=document.getElementById('pd').value,start=document.getElementById('ps').value,end=document.getElementById('pe').value,activity=document.getElementById('pa').value.trim(),notes=document.getElementById('pn').value.trim();
  const day=new Date(date+'T12:00:00').getDay();
  if(day===0||day===6){alert('La jornada práctica debe ser de lunes a viernes.');return}
  if(!start||!end){alert('Completá hora de inicio y fin.');return}
  const [sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number),mins=(eh*60+em)-(sh*60+sm);
  if(mins<=0){alert('La hora de finalización debe ser posterior a la de inicio.');return}
  const hours=Math.round((mins/60)*100)/100;
  const weekly=weeklyPractice(stid,date);
  if(weekly+hours>weekMax+1e-9){alert('Esta carga supera el máximo de '+weekMax+' horas semanales. Tenés '+fmt(weekly)+' en esa semana.');return}

  const record={id_estudiante:stid,tipo:'practica',fecha:date,cantidad_horas:hours,descripcion:activity,observaciones:notes,hora_inicio:start,hora_fin:end,creado_el:new Date().toISOString(),origen:'v3'};
  const docId=uniqueIdV3('p');

  try{
    await firestore.collection('registros_horas').doc(docId).set(record,{merge:false});
    await auditV3('CREATE_PRACTICE',stid,date+' · '+hours+' h');
    session.tab='home';
    renderStudent();
    alert('Registro guardado en la nube: '+fmt(hours)+'.');
  }catch(err){console.error(err);alert('No se pudo guardar el registro: '+err.message)}
};

saveClass=async function(e){
  e.preventDefault();
  const date=document.getElementById('cd').value,hours=Number(document.getElementById('ch').value);
  if(!Number.isFinite(hours)||hours<=0||hours>24){alert('Ingresá una cantidad de horas válida.');return}
  const dup=db.classes.find(x=>x.studentId===session.studentId&&x.date===date&&x.active!==false);
  if(dup){alert('Ya existe una asistencia para esa fecha. El registro anterior se conserva y no se reemplaza.');return}

  const record={id_estudiante:session.studentId,tipo:'clase',fecha:date,cantidad_horas:hours,descripcion:'Presente',creado_el:new Date().toISOString(),origen:'v3'};
  const docId=uniqueIdV3('c');

  try{
    await firestore.collection('registros_horas').doc(docId).set(record,{merge:false});
    await auditV3('CREATE_CLASS',session.studentId,date+' · '+hours+' h');
    session.tab='home';
    renderStudent();
    alert('Asistencia guardada en la nube.');
  }catch(err){console.error(err);alert('No se pudo guardar la asistencia: '+err.message)}
};

function latestImprovementV3(stid,month){
  return db.improvements.filter(x=>x.studentId===stid&&x.month===month).sort((a,b)=>String(b.savedAt||'').localeCompare(String(a.savedAt||'')))[0];
}
studentImprovement=function(st){
  const month=today().slice(0,7),old=latestImprovementV3(st.id,month),text=old?old.text:'';
  return '<section class="panel"><div class="section-head"><h2>Mejora mensual</h2><span class="badge">Obligatorio</span></div><form class="form" onsubmit="saveImprovement(event)"><div class="field"><label>¿Qué mejorarías de tu práctica o plataforma?</label><textarea id="improvement" required placeholder="Escribí tus observaciones...">'+esc(text)+'</textarea></div><button class="btn btn-primary">Guardar mejora mensual</button></form></section>';
};
saveImprovement=async function(e){
  e.preventDefault();
  const month=today().slice(0,7),text=document.getElementById('improvement').value.trim();
  const record={id_estudiante:session.studentId,tipo:'mejora',fecha:month,cantidad_horas:0,descripcion:text,creado_el:new Date().toISOString(),origen:'v3'};
  try{
    await firestore.collection('registros_horas').doc(uniqueIdV3('i')).set(record,{merge:false});
    await auditV3('SAVE_IMPROVEMENT',session.studentId,month);
    renderStudent();
    alert('Mejora mensual guardada en la nube.');
  }catch(err){console.error(err);alert('No se pudo guardar la mejora: '+err.message)}
};

const metaTimersV3={};
updateStudentMeta=function(stid,field,val){
  const st=db.students.find(x=>x.id===stid);if(st)st[field]=val;
  const key=stid+'|'+field;
  clearTimeout(metaTimersV3[key]);
  metaTimersV3[key]=setTimeout(async()=>{
    try{
      const map=field==='organization'?'organization':field==='referent'?'referent':field;
      await firestore.collection('usuarios').doc(stid).set({[map]:val,updatedAt:new Date().toISOString()},{merge:true});
    }catch(err){console.error('No se pudo sincronizar '+field+':',err)}
  },450);
};

saveStudent=async function(e){
  e.preventDefault();
  const idVal=document.getElementById('sid').value,name=document.getElementById('sn').value.trim(),surname=document.getElementById('ss').value.trim(),career=document.getElementById('sc').value.trim(),organization=document.getElementById('so').value.trim(),referent=document.getElementById('sr').value.trim(),active=document.getElementById('sa').checked;
  if(!name||!surname||!career){alert('Completá nombre, apellido y carrera.');return}

  const duplicate=db.students.find(st=>st.id!==idVal&&normalizeTextV3(st.name)===normalizeTextV3(name)&&normalizeTextV3(st.surname)===normalizeTextV3(surname)&&normalizeTextV3(st.career)===normalizeTextV3(career)&&st.active!==false);
  if(duplicate){alert('Ese alumno ya está registrado con la misma carrera.');return}

  const docId=idVal||uniqueIdV3('stu'),payload={
    nombreCompleto:(name+' '+surname).trim(),
    nombre:name,apellido:surname,carrera:career,rol:'estudiante',
    name,surname,career,organization,referent,active,
    updatedAt:new Date().toISOString()
  };
  if(!idVal)payload.createdAt=today();

  try{
    await firestore.collection('usuarios').doc(docId).set(payload,{merge:true});
    await auditV3(idVal?'UPDATE_STUDENT':'CREATE_STUDENT',docId,name+' '+surname);
    clearStudentForm();
    renderTutor();
  }catch(err){console.error(err);alert('No se pudo guardar al alumno: '+err.message)}
};

deleteStudent=async function(id){
  const st=db.students.find(x=>x.id===id);if(!st)return;
  if(!confirm('¿Deshabilitar a '+studentName(st)+'? Sus datos y registros se conservarán en la nube.'))return;
  try{
    await firestore.collection('usuarios').doc(id).set({active:false,disabledAt:new Date().toISOString(),updatedAt:new Date().toISOString()},{merge:true});
    await auditV3('DISABLE_STUDENT',id,studentName(st));
    st.active=false;
    renderTutor();
    alert('Alumno deshabilitado. Sus prácticas, clases y mejoras siguen conservadas.');
  }catch(err){console.error(err);alert('No se pudo deshabilitar al alumno: '+err.message)}
};

async function updateTutorsV3(mutator,action,detail){
  const ref=firestore.collection('system').doc('main_data');
  try{
    await firestore.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      const data=snap.exists?(snap.data()||{}):{};
      const tutors=Array.isArray(data.tutors)?data.tutors:[];
      const next=mutator(tutors.map(x=>Object.assign({},x)));
      tx.set(ref,{tutors:next},{merge:true});
    });
    await auditV3(action,'tutors',detail);
    await loadLegacySettingsV3();
    renderTutor();
  }catch(err){console.error(err);alert('No se pudo actualizar la gestión de tutores: '+err.message)}
}
saveSettings=async function(e){
  e.preventDefault();
  const payload={institution:document.getElementById('setInst').value.trim(),practicePeriod:document.getElementById('setPer').value.trim()};
  try{
    const ref=firestore.collection('system').doc('main_data');
    await ref.set({settings:Object.assign({},db.settings,payload)},{merge:true});
    db.settings=Object.assign({},db.settings,payload);
    await auditV3('UPDATE_SETTINGS','settings',payload.institution+' · '+payload.practicePeriod);
    alert('Configuración guardada en la nube.');
  }catch(err){console.error(err);alert('No se pudo guardar la configuración: '+err.message)}
};
addTutorPin=async function(e){
  e.preventDefault();
  const name=document.getElementById('newTutorName').value.trim(),pin=document.getElementById('newTutorPin').value.trim();
  if(pin.length<4){alert('El PIN debe tener al menos 4 dígitos.');return}
  if(db.tutors.some(t=>String(t.pin)===pin&&t.active!==false)){alert('Ese PIN ya está en uso.');return}
  await updateTutorsV3(t=>t.concat([{id:uniqueIdV3('tut'),name,pin,active:true,createdAt:new Date().toISOString()}]),'CREATE_TUTOR',name);
};
removeTutor=async function(idx){
  const active=(db.tutors||[]).filter(x=>x.active!==false);
  if(active.length<=1){alert('Debe quedar al menos un tutor activo.');return}
  const t=db.tutors[idx];if(!t)return;
  if(!confirm('¿Deshabilitar este PIN de tutor? El registro se conservará.'))return;
  await updateTutorsV3(t=>t.map(x=>x.id===t.id?Object.assign({},x,{active:false,disabledAt:new Date().toISOString()}):x),'DISABLE_TUTOR',t.name);
};

async function auditV3(action,targetId,detail){
  try{
    await firestore.collection('registros_horas').doc(uniqueIdV3('audit')).set({
      id_estudiante:String(targetId||''),
      tipo:'auditoria',
      fecha:new Date().toISOString().slice(0,10),
      cantidad_horas:0,
      descripcion:String(detail||''),
      accion:String(action||''),
      creado_el:new Date().toISOString(),
      origen:'v3'
    },{merge:false});
  }catch(err){console.warn('No se pudo registrar la auditoría:',err)}
}

const legacyExportJSONV3=exportJSON;
importJSON=async function(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async function(ev){
    try{
      const imported=JSON.parse(ev.target.result);
      const students=Array.isArray(imported.students)?imported.students:[];
      for(let i=0;i<students.length;i+=100){
        const batch=firestore.batch();
        students.slice(i,i+100).forEach(st=>{
          const id=String(st.id||uniqueIdV3('stu'));
          batch.set(firestore.collection('usuarios').doc(id),{
            nombreCompleto:studentNameV3(st),nombre:st.name||'',apellido:st.surname||'',carrera:st.career||'',
            rol:'estudiante',organization:st.organization||'',referent:st.referent||'',active:st.active!==false,
            name:st.name||'',surname:st.surname||'',career:st.career||''
          },{merge:true});
        });
        await batch.commit();
      }
      alert('Base importada y sincronizada. Los registros existentes se conservaron.');
      location.reload();
    }catch(err){console.error(err);alert('Archivo inválido o error al importar: '+err.message)}
  };
  reader.readAsText(file);
};

function tutorActivityV3(){
  const rows=[
    ...db.practices.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Práctica',hours:x.hours,detail:(x.activity||'')+(x.notes?' · '+x.notes:'')})),
    ...db.classes.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Clase',hours:x.hours,detail:x.status||'Presente'})),
    ...db.improvements.map(x=>({sort:x.savedAt||x.createdAt||x.month,date:x.savedAt?String(x.savedAt).slice(0,10):x.month,studentId:x.studentId,type:'Mejora mensual',hours:null,detail:x.text||''}))
  ].sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  const names=[...new Set(db.students.map(s=>studentName(s)))].sort((a,b)=>a.localeCompare(b,'es'));

  const renderRows=rs=>rs.map(r=>{
    const st=db.students.find(s=>s.id===r.studentId);
    return '<tr><td>'+fmtDate(r.date)+'</td><td><strong>'+esc(studentName(st))+'</strong></td><td>'+esc(st?st.career||'':'')+'</td><td><span class="tag">'+esc(r.type)+'</span></td><td>'+((r.hours===null||r.hours===undefined)?'—':fmt(r.hours))+'</td><td style="white-space:normal;min-width:320px">'+esc(r.detail||'')+'</td></tr>';
  }).join('')||'<tr><td colspan="6"><div class="empty">No hay cargas que coincidan con la búsqueda.</div></td></tr>';

  return "<section class='panel'><div class='section-head'><h2>Historial completo de cargas</h2><span class='badge'>"+rows.length+" registros · no se elimina ningún registro</span></div>"+
    "<div class='row' style='margin-bottom:12px'><div class='field'><label>Buscar alumno</label><input id='activitySearchV3' list='activityStudentSuggestionsV3' placeholder='Escribí nombre o apellido...' oninput='renderTutorActivityRowsV3()'><datalist id='activityStudentSuggestionsV3'>"+names.map(n=>'<option value="'+esc(n)+'"></option>').join('')+"</datalist></div>"+
    "<div class='field'><label>Tipo</label><select id='activityTypeV3' onchange='renderTutorActivityRowsV3()'><option value=''>Todos</option><option value='Práctica'>Práctica</option><option value='Clase'>Clase</option><option value='Mejora mensual'>Mejora mensual</option></select></div></div>"+
    "<div class='table-wrap'><table class='table'><thead><tr><th>Fecha</th><th>Alumno</th><th>Carrera</th><th>Tipo</th><th>Horas</th><th>Contenido cargado</th></tr></thead><tbody id='tutorActivityRowsV3'>"+renderRows(rows)+"</tbody></table></div></section>";
}
function renderTutorActivityRowsV3(){
  const search=document.getElementById('activitySearchV3'),typeEl=document.getElementById('activityTypeV3');
  const q=normalizeTextV3(search?search.value:''),type=typeEl?typeEl.value:'';
  const rows=[
    ...db.practices.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Práctica',hours:x.hours,detail:(x.activity||'')+(x.notes?' · '+x.notes:'')})),
    ...db.classes.map(x=>({sort:x.createdAt||x.date,date:x.date,studentId:x.studentId,type:'Clase',hours:x.hours,detail:x.status||'Presente'})),
    ...db.improvements.map(x=>({sort:x.savedAt||x.createdAt||x.month,date:x.savedAt?String(x.savedAt).slice(0,10):x.month,studentId:x.studentId,type:'Mejora mensual',hours:null,detail:x.text||''}))
  ].sort((a,b)=>String(b.sort).localeCompare(String(a.sort)));
  const filtered=rows.filter(r=>{
    const st=db.students.find(s=>s.id===r.studentId);
    const person=normalizeTextV3(studentName(st)+' '+(st?st.career||'':''));
    return (!q||person.includes(q))&&(!type||r.type===type);
  });
  const el=document.getElementById('tutorActivityRowsV3');
  if(el){
    el.innerHTML=filtered.map(r=>{
      const st=db.students.find(s=>s.id===r.studentId);
      return '<tr><td>'+fmtDate(r.date)+'</td><td><strong>'+esc(studentName(st))+'</strong></td><td>'+esc(st?st.career||'':'')+'</td><td><span class="tag">'+esc(r.type)+'</span></td><td>'+((r.hours===null||r.hours===undefined)?'—':fmt(r.hours))+'</td><td style="white-space:normal;min-width:320px">'+esc(r.detail||'')+'</td></tr>';
    }).join('')||'<tr><td colspan="6"><div class="empty">No hay cargas que coincidan con la búsqueda.</div></td></tr>';
  }
}

renderTutor=function(){
  if(session&&session.tab==='activity'){
    const html=layout(
      "<div class='hero'><div><div class='eyebrow'>Panel de tutores</div><div class='title'>Seguimiento de Prácticas Profesionales</div><div class='muted'>Control global de alumnos y planillas oficiales en la nube.</div></div></div>"+
      "<div class='nav-tabs'><button class='btn active' onclick='navTutor(\"activity\")'>Historial</button><button class='btn' onclick='navTutor(\"dashboard\")'>Dashboard</button><button class='btn' onclick='navTutor(\"students\")'>Alumnos</button><button class='btn' onclick='navTutor(\"plans\")'>Planillas</button><button class='btn' onclick='navTutor(\"settings\")'>Configuración</button></div>"+
      tutorActivityV3(),'TUTOR · '+session.tutor
    );
    document.getElementById('app').innerHTML=html;
    return;
  }

  legacyRenderTutorV2();
  const nav=document.querySelector('.nav-tabs');
  if(nav&&!nav.querySelector('[data-v3-history]')){
    const btn=document.createElement('button');
    btn.className='btn';
    btn.setAttribute('data-v3-history','1');
    btn.textContent='Historial';
    btn.onclick=function(){navTutor('activity')};
    nav.appendChild(btn);
  }
  document.querySelectorAll('button.btn-danger').forEach(btn=>{
    if(btn.textContent.trim()==='Eliminar')btn.textContent='Deshabilitar';
  });
};

(async function bootV3(){
  await loadLegacySettingsV3();
  await migrateLegacyV3();
  subscribeStudentsV3();
  subscribeRecordsV3();
})();
