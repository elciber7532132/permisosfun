const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);

const API=window.API_BASE||'/api';

let token=localStorage.getItem("token")||"";

const esc=s=>String(s??"").replace(
  /[&<>"']/g,
  m=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[m])
);

const today=new Date().toISOString().slice(0,10);


/* =========================================================
   PANTALLAS
========================================================= */

function showLogin(){
  $("#landing").classList.add("hidden");
  $("#login").classList.remove("hidden");
  $("#app").classList.add("hidden");

  setTimeout(
    ()=>$("#user").focus(),
    50
  );
}

function showLanding(){
  $("#landing").classList.remove("hidden");
  $("#login").classList.add("hidden");
  $("#app").classList.add("hidden");
}

function showApp(){
  $("#landing").classList.add("hidden");
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
}


/* =========================================================
   API
========================================================= */

function headers(json=true){

  const h={
    Authorization:"Bearer "+token
  };

  if(json){
    h["Content-Type"]="application/json";
  }

  return h;
}

async function api(url,opt={}){

  const r=await fetch(
    API+url,
    {
      ...opt,
      headers:{
        ...headers(
          opt.body!==undefined
        ),
        ...(opt.headers||{})
      }
    }
  );

  if(r.status===401){
    logout();
    throw Error(
      "Sesión expirada"
    );
  }

  const t=
    r.headers.get(
      "content-type"
    )||"";

  const d=
    t.includes("json")
      ? await r.json()
      : await r.blob();

  if(!r.ok){
    throw Error(
      d.error||
      "Error"
    );
  }

  return d;
}


/* =========================================================
   UTILIDADES
========================================================= */

function toast(s){

  const e=$("#toast");

  e.textContent=s;

  e.classList.add(
    "toast-show"
  );

  setTimeout(
    ()=>e.classList.remove(
      "toast-show"
    ),
    2500
  );
}

function openModal(html){

  $("#modalContent")
    .innerHTML=html;

  $("#modal")
    .classList.remove(
      "hidden"
    );
}

function closeModal(){

  $("#modal")
    .classList.add(
      "hidden"
    );
}

function logout(){

  localStorage.removeItem(
    "token"
  );

  token="";

  $("#app")
    .classList.add(
      "hidden"
    );

  showLanding();
}

function initials(n){

  return String(n||"")
    .split(" ")
    .slice(0,2)
    .map(x=>x[0])
    .join("")
    .toUpperCase();
}

function badge(s){

  let c=
    s==="Aprobado"
      ?"green"
      :s==="Rechazado"
      ?"red"
      :s==="Pendiente"
      ?"amber"
      :s==="Activo"
      ?"green"
      :s==="Inactivo"
      ?"gray"
      :"blue";

  return `
    <span class="badge ${c}">
      ${esc(s)}
    </span>
  `;
}


/* =========================================================
   LOGIN
========================================================= */

$("#loginForm").onsubmit=async e=>{

  e.preventDefault();

  try{

    const d=
      await api(
        "/login",
        {
          method:"POST",
          body:JSON.stringify({
            username:
              $("#user").value,
            password:
              $("#pass").value
          })
        }
      );

    token=d.token;

    localStorage.setItem(
      "token",
      token
    );

    showApp();

    $("#sideName")
      .textContent=
      d.user.name;

    loadDashboard();
    loadNotifications();

  }catch(x){

    toast(
      x.message
    );
  }
};

$("#logout").onclick=logout;

$("#openLogin").onclick=showLogin;

$("#openLogin2").onclick=showLogin;


/* =========================================================
   NAVEGACIÓN
========================================================= */

$$(".nav").forEach(
  b=>b.onclick=()=>{

    $$(".nav").forEach(
      x=>x.classList.remove(
        "active"
      )
    );

    b.classList.add(
      "active"
    );

    ({
      dashboard:loadDashboard,
      workers:loadWorkers,
      permissions:loadPermissions,
      attendance:loadAttendance,
      reports:loadReports
    }[b.dataset.page])();
  }
);


$("#todayLabel")
  .textContent=
  new Date().toLocaleDateString(
    "es-PE",
    {
      weekday:"long",
      day:"2-digit",
      month:"long"
    }
  );


/* =========================================================
   RECUPERAR SESIÓN
========================================================= */

if(token){

  showApp();

  api("/me")
    .then(
      d=>
        $("#sideName")
          .textContent=d.name
    )
    .catch(
      ()=>{
        logout();
      }
    );

  loadDashboard();

  loadNotifications();

  setInterval(
    loadNotifications,
    15000
  );

}else{

  showLanding();
}


/* =========================================================
   LAYOUT
========================================================= */

function layout(
  title,
  sub,
  actions=""
){

  $("#pageTitle")
    .textContent=title;

  return `
    <div class="page-head">
      <div>
        <h3>${title}</h3>
        <p>${sub}</p>
      </div>

      <div class="actions">
        ${actions}
      </div>
    </div>
  `;
}


/* =========================================================
   DASHBOARD
========================================================= */

async function loadDashboard(){

  try{

    const d=
      await api(
        "/dashboard"
      );

    $("#content").innerHTML=
      layout(
        "Resumen general",
        "Indicadores del entorno empresarial"
      )

      +

`
<div class="stats">

<div class="stat">
<span class="label">
Trabajadores activos
</span>

<strong>
${d.totalWorkers}
</strong>

<div class="mini">
Personal registrado
</div>

<span class="circle">
♙
</span>
</div>


<div class="stat">
<span class="label">
Permisos registrados
</span>

<strong>
${d.permissions}
</strong>

<div class="mini">
${d.weekly} esta semana
</div>

<span class="circle">
◷
</span>
</div>


<div class="stat">
<span class="label">
Pendientes
</span>

<strong>
${d.pending}
</strong>

<div class="mini">
Requieren revisión
</div>

<span class="circle">
!
</span>
</div>


<div class="stat">
<span class="label">
Tardanzas semana
</span>

<strong>
${d.late}
</strong>

<div class="mini">
Registros con demora
</div>

<span class="circle">
⏱
</span>
</div>

</div>


<div class="grid2">

<div class="card">

<h4>
Permisos por tipo
</h4>

<div class="bars">

${
d.byType.length

? d.byType.map(
x=>`

<div class="bar-row">

<span>
${esc(x.type)}
</span>

<div class="bar">

<i style="
width:${
Math.min(
100,
x.total /
Math.max(
...d.byType.map(
a=>a.total
)
) *
100
)
}%">
</i>

</div>

<b>
${x.total}
</b>

</div>
`
).join("")

:`
<div class="empty">
Aún no hay permisos registrados.
</div>
`
}

</div>

</div>


<div class="card">

<h4>
Resumen del período
</h4>

<div class="kpi-line">
<span>
Salidas de hoy
</span>

<b>
${d.today}
</b>
</div>

<div class="kpi-line">
<span>
Esta semana
</span>

<b>
${d.weekly}
</b>
</div>

<div class="kpi-line">
<span>
Este mes
</span>

<b>
${d.monthly}
</b>
</div>

<div class="kpi-line">
<span>
Aprobados
</span>

<b>
${d.approved}
</b>
</div>

</div>

</div>


<div
class="card"
style="margin-top:18px"
>

<h4>
Trabajadores con más registros de permisos
</h4>

${
d.ranking.length

?`

<div
class="table-wrap"
style="border:0"
>

<table class="table">

<thead>

<tr>
<th>Trabajador</th>
<th>Área</th>
<th>Total</th>
</tr>

</thead>

<tbody>

${d.ranking.map(
x=>`

<tr>

<td>

<div class="person">

<span class="avatar">
${initials(x.names)}
</span>

<b>
${esc(x.names)}
</b>

</div>

</td>

<td>
${esc(x.area||"-")}
</td>

<td>
${x.total}
</td>

</tr>

`
).join("")}

</tbody>

</table>

</div>

`

:`

<div class="empty">
Agrega trabajadores y permisos
para ver estadísticas.
</div>

`

}

</div>
`;

  }catch(e){

    toast(
      e.message
    );
  }
}


/* =========================================================
   TRABAJADORES
========================================================= */

async function loadWorkers(){

  const rows=
    await api(
      "/workers"
    );

  $("#content").innerHTML=
    layout(
      "Trabajadores",
      "Registro y administración del personal",
      `
      <button
        class="primary"
        onclick="workerForm()"
      >
        + Nuevo trabajador
      </button>
      `
    )

    +

`
<div class="toolbar">

<input
id="workerSearch"
placeholder="Buscar por DNI, nombre, cargo o área"
oninput="filterWorkers()"
style="flex:1"
>

</div>


<div class="table-wrap">

<table class="table">

<thead>

<tr>

<th>
Trabajador
</th>

<th>
DNI
</th>

<th>
Cargo
</th>

<th>
Área
</th>

<th>
Teléfono
</th>

<th>
Ingreso
</th>

<th>
Estado
</th>

<th>
Acciones
</th>

</tr>

</thead>

<tbody id="workerRows">

${workerRows(rows)}

</tbody>

</table>

</div>
`;
}


/* =========================================================
   FILAS DE TRABAJADORES
========================================================= */

function workerRows(rows){

  return rows.length

  ? rows.map(
      w=>`

<tr>

<td>

<div class="person">

<span class="avatar">
${initials(w.names)}
</span>

<b>
${esc(w.names)}
</b>

</div>

</td>


<td>
${esc(w.dni)}
</td>


<td>
${esc(w.position||"-")}
</td>


<td>
${esc(w.area||"-")}
</td>


<td>
${esc(w.phone||"-")}
</td>


<td>
${esc(w.hire_date||"-")}
</td>


<td>
${badge(w.status)}
</td>


<td>

<button
class="secondary"
onclick="workerHistory(${w.id})"
>
Ver
</button>


<button
class="secondary"
onclick='workerForm(${JSON.stringify(w)})'
>
Editar
</button>


${
w.status==="Activo"

?

`
<button
class="danger"
onclick="deleteWorker(${w.id})"
>
Eliminar
</button>
`

:

`
<button
class="secondary"
onclick="activateWorker(${w.id})"
>
Activar
</button>
`

}

</td>

</tr>

`
    ).join("")

  :`

<tr>

<td colspan="8">

<div class="empty">

No hay trabajadores registrados.

</div>

</td>

</tr>

`;
}


/* =========================================================
   BUSCAR TRABAJADOR
========================================================= */

async function filterWorkers(){

  const rows=
    await api(
      "/workers?search="+
      encodeURIComponent(
        $("#workerSearch").value
      )
    );

  $("#workerRows")
    .innerHTML=
      workerRows(rows);
}


/* =========================================================
   ELIMINAR TRABAJADOR
========================================================= */

async function deleteWorker(id){

  const confirmar=
    confirm(
      "¿Estás seguro de que deseas eliminar este trabajador?\n\n"+
      "El trabajador pasará a estado INACTIVO y conservará su historial."
    );

  if(!confirmar){
    return;
  }

  try{

    await api(
      "/workers/"+id,
      {
        method:"DELETE"
      }
    );

    toast(
      "Trabajador eliminado correctamente"
    );

    loadWorkers();

    loadDashboard();

  }catch(e){

    toast(
      e.message ||
      "No se pudo eliminar el trabajador"
    );
  }
}


/* =========================================================
   ACTIVAR TRABAJADOR
========================================================= */

async function activateWorker(id){

  const confirmar=
    confirm(
      "¿Deseas volver a activar este trabajador?"
    );

  if(!confirmar){
    return;
  }

  try{

    await api(
      "/workers/"+id,
      {
        method:"PUT",
        body:JSON.stringify({
          status:"Activo"
        })
      }
    );

    toast(
      "Trabajador activado correctamente"
    );

    loadWorkers();

    loadDashboard();

  }catch(e){

    toast(
      e.message ||
      "No se pudo activar el trabajador"
    );
  }
}


/* =========================================================
   FORMULARIO TRABAJADOR
========================================================= */

function workerForm(w={}){

  openModal(`

<h3 class="modal-title">

${w.id
  ?"Editar trabajador"
  :"Nuevo trabajador"}

</h3>


<form id="workerForm">

<div class="form-grid">


<div class="field">

<label>
DNI *
</label>

<input
class="input"
name="dni"
value="${esc(w.dni)}"
required
>

</div>


<div class="field">

<label>
Nombres y apellidos *
</label>

<input
class="input"
name="names"
value="${esc(w.names)}"
required
>

</div>


<div class="field">

<label>
Cargo
</label>

<input
class="input"
name="position"
value="${esc(w.position)}"
>

</div>


<div class="field">

<label>
Área
</label>

<input
class="input"
name="area"
value="${esc(w.area)}"
>

</div>


<div class="field">

<label>
Teléfono
</label>

<input
class="input"
name="phone"
value="${esc(w.phone)}"
>

</div>


<div class="field">

<label>
Correo
</label>

<input
class="input"
type="email"
name="email"
value="${esc(w.email)}"
>

</div>


<div class="field">

<label>
Fecha de ingreso
</label>

<input
class="input"
type="date"
name="hire_date"
value="${esc(w.hire_date)}"
>

</div>


<div class="field">

<label>
Estado
</label>

<select name="status">

<option
${w.status==="Activo"?"selected":""}
>
Activo
</option>

<option
${w.status==="Inactivo"?"selected":""}
>
Inactivo
</option>

</select>

</div>


</div>


<div class="modal-actions">

<button
type="button"
class="secondary"
onclick="closeModal()"
>
Cancelar
</button>

<button
class="primary"
>
Guardar trabajador
</button>

</div>

</form>

`);

  $("#workerForm").onsubmit=
    async e=>{

      e.preventDefault();

      const o=
        Object.fromEntries(
          new FormData(
            e.target
          )
        );

      try{

        await api(
          w.id
            ?"/workers/"+w.id
            :"/workers",
          {
            method:
              w.id
                ?"PUT"
                :"POST",

            body:
              JSON.stringify(o)
          }
        );

        closeModal();

        toast(
          "Trabajador guardado correctamente"
        );

        loadWorkers();

        loadDashboard();

      }catch(x){

        toast(
          x.message
        );
      }
    };
}


/* =========================================================
   HISTORIAL TRABAJADOR
========================================================= */

async function workerHistory(id){

  const d=
    await api(
      "/workers/"+id+"/history"
    );

  openModal(`

<h3 class="modal-title">

Historial de
${esc(d.worker.names)}

</h3>


<div class="profile">


<div class="card">

<div
class="avatar"
style="
width:90px;
height:90px;
font-size:25px;
margin:auto
"
>

${initials(
  d.worker.names
)}

</div>


<h4
style="
text-align:center;
margin:12px 0 0
"
>

${esc(
  d.worker.names
)}

</h4>


<p
style="
text-align:center;
color:#718096;
font-size:12px
"
>

${esc(
  d.worker.position||""
)}

</p>

</div>


<div>

<div class="profile-main">

<div class="profile-box">

<small>
Permisos
</small>

<b>
${d.permissions.length}
</b>

</div>


<div class="profile-box">

<small>
Asistencias
</small>

<b>
${d.attendance.length}
</b>

</div>


<div class="profile-box">

<small>
Área
</small>

<b>
${esc(
  d.worker.area||"-"
)}
</b>

</div>

</div>


<div
class="card"
style="margin-top:12px"
>

<h4>
Últimos permisos
</h4>

${
d.permissions.length

?d.permissions
  .slice(0,8)
  .map(
    p=>`

<div class="kpi-line">

<span>
${esc(p.date)}
·
${esc(p.type)}
</span>

${badge(p.status)}

</div>

`
  )
  .join("")

:`<div class="empty">
Sin registros.
</div>`
}

</div>

</div>

</div>

`);
}


/* =========================================================
   PERMISOS
========================================================= */

async function loadPermissions(){

  const rows=
    await api(
      "/permissions"
    );

  $("#content").innerHTML=
    layout(
      "Permisos y salidas",
      "Solicitudes, autorizaciones y control de salidas",

      `
      <button
      class="primary"
      onclick="permissionForm()"
      >
      + Registrar permiso
      </button>
      `
    )

+

`
<div class="toolbar">

<input
id="psearch"
placeholder="Buscar trabajador o DNI"
oninput="filterPermissions()"
>

<select
id="pstatus"
onchange="filterPermissions()"
>

<option value="">
Todos los estados
</option>

<option>
Aprobado
</option>

<option>
Pendiente
</option>

<option>
Rechazado
</option>

</select>


<select
id="ptype"
onchange="filterPermissions()"
>

<option value="">
Todos los tipos
</option>

<option>
Salida personal
</option>

<option>
Cita médica
</option>

<option>
Enfermedad
</option>

<option>
Emergencia familiar
</option>

<option>
Trámite personal
</option>

<option>
Emergencia
</option>

<option>
Permiso
</option>

<option>
Inasistencia
</option>

<option>
Tardanza
</option>

<option>
Otro
</option>

</select>

</div>


<div class="table-wrap">

<table class="table">

<thead>

<tr>

<th>
Fecha
</th>

<th>
Trabajador
</th>

<th>
Tipo
</th>

<th>
Salida
</th>

<th>
Retorno
</th>

<th>
Motivo
</th>

<th>
Estado
</th>

<th>
Acciones
</th>

</tr>

</thead>

<tbody id="permissionRows">

${permissionRows(rows)}

</tbody>

</table>

</div>
`;
}


function permissionRows(rows){

  return rows.length

  ?rows.map(
    p=>`

<tr>

<td>
${esc(p.date)}
</td>


<td>

<b>
${esc(p.names)}
</b>

<small
style="
display:block;
color:#8993a2
"
>
${esc(p.dni)}
</small>

</td>


<td>
${esc(p.type)}
</td>


<td>
${esc(p.exit_time||"-")}
</td>


<td>
${esc(p.return_time||"-")}
</td>


<td>
${esc(p.reason||"-")}
</td>


<td>
${badge(p.status)}
</td>


<td>

${
p.status==="Pendiente"

?`

<button
class="primary"
onclick="reviewPermission(${p.id})"
>
Revisar
</button>

`

:`

<button
class="secondary"
onclick="permissionDetail(${JSON.stringify(p).replace(/"/g,"&quot;")})"
>
Ver
</button>

`

}

</td>

</tr>

`
  ).join("")

  :`

<tr>

<td colspan="8">

<div class="empty">
No hay permisos registrados.
</div>

</td>

</tr>

`;
}


async function filterPermissions(){

  let u=
    "/permissions?search="+
    encodeURIComponent(
      $("#psearch").value
    )+
    "&status="+
    encodeURIComponent(
      $("#pstatus").value
    )+
    "&type="+
    encodeURIComponent(
      $("#ptype").value
    );

  $("#permissionRows")
    .innerHTML=
      permissionRows(
        await api(u)
      );
}


/* =========================================================
   FORMULARIO PERMISO
========================================================= */

async function permissionForm(){

  const ws=
    await api(
      "/workers"
    );

  const active=
    ws.filter(
      w =>
        w.status==="Activo"
    );

  openModal(`

<h3 class="modal-title">
Registrar permiso o salida
</h3>


<form id="permissionForm">

<div class="form-grid">


<div class="field full">

<label>
Trabajador *
</label>

<select
name="worker_id"
required
>

<option value="">
Seleccionar trabajador
</option>

${active.map(
w=>`

<option value="${w.id}">

${esc(w.names)}
·
${esc(w.dni)}

</option>

`
).join("")}

</select>

</div>


<div class="field">

<label>
Tipo *
</label>

<select
name="type"
required
>

${
[
"Salida personal",
"Cita médica",
"Enfermedad",
"Emergencia familiar",
"Trámite personal",
"Emergencia",
"Permiso",
"Inasistencia",
"Tardanza",
"Otro"
].map(
x=>
`<option>${x}</option>`
).join("")
}

</select>

</div>


<div class="field">

<label>
Fecha *
</label>

<input
class="input"
type="date"
name="date"
value="${today}"
required
>

</div>


<div class="field">

<label>
Hora de salida
</label>

<input
class="input"
type="time"
name="exit_time"
>

</div>


<div class="field">

<label>
Hora de retorno
</label>

<input
class="input"
type="time"
name="return_time"
>

</div>


<div class="field full">

<label>
Motivo
</label>

<input
class="input"
name="reason"
placeholder="Motivo principal"
>

</div>


<div class="field full">

<label>
Observación
</label>

<textarea
name="observation"
placeholder="Detalle adicional, autorización, documento, etc."
></textarea>

</div>


<div class="field full">

<label>
Documento sustentatorio
</label>

<input
class="input"
name="document"
placeholder="Nombre o referencia del documento (opcional)"
>

</div>


</div>


<div class="modal-actions">

<button
type="button"
class="secondary"
onclick="closeModal()"
>
Cancelar
</button>

<button
class="primary"
>
Registrar
</button>

</div>

</form>

`);

  $("#permissionForm").onsubmit=
    async e=>{

      e.preventDefault();

      try{

        await api(
          "/permissions",
          {
            method:"POST",
            body:JSON.stringify(
              Object.fromEntries(
                new FormData(
                  e.target
                )
              )
            )
          }
        );

        closeModal();

        toast(
          "Permiso registrado"
        );

        loadPermissions();

      }catch(x){

        toast(
          x.message
        );
      }
    };
}


/* =========================================================
   NOTIFICACIONES
========================================================= */

async function loadNotifications(){

  try{

    const d=
      await api(
        "/notifications"
      );

    const b=
      $("#pendingCount");

    b.textContent=
      d.pending;

    b.classList.toggle(
      "zero",
      d.pending===0
    );

  }catch(e){}
}


async function showNotifications(){

  const d=
    await api(
      "/notifications"
    );

  openModal(`

<h3 class="modal-title">
🔔 Solicitudes pendientes
</h3>


${
d.latest.length

?d.latest.map(
x=>`

<div
class="notification-row"
onclick="reviewPermission(${x.id})"
>

<div>

<div class="person">

<span class="avatar">
${initials(x.names)}
</span>

<b>
${esc(x.names)}
</b>

</div>


<small>
${esc(x.type)}
·
${esc(x.date)}
</small>

</div>


<span class="badge amber">
Pendiente
</span>

</div>

`
).join("")

:`

<div class="empty">
No tienes solicitudes pendientes.
</div>

`
}


<div class="modal-actions">

<button
class="primary"
onclick="closeModal();loadPermissions()"
>
Ver todos los permisos
</button>

</div>

`);
}


/* =========================================================
   REVISAR PERMISO
========================================================= */

async function reviewPermission(id){

  const rows=
    await api(
      "/permissions"
    );

  const p=
    rows.find(
      x =>
        Number(x.id) ===
        Number(id)
    );

  if(!p){

    return toast(
      "No se encontró la solicitud"
    );
  }

  openModal(`

<h3 class="modal-title">
Revisar solicitud de permiso
</h3>


<div class="review-head">

<div class="person">

<span class="avatar">
${initials(p.names)}
</span>

<div>

<b>
${esc(p.names)}
</b>

<small>
${esc(p.dni)}
·
${esc(p.position||"")}
·
${esc(p.area||"")}
</small>

</div>

</div>

${badge(p.status)}

</div>


<div
class="profile-main"
style="margin-top:16px"
>

<div class="profile-box">

<small>
Tipo
</small>

<b>
${esc(p.type)}
</b>

</div>


<div class="profile-box">

<small>
Fecha
</small>

<b>
${esc(p.date)}
</b>

</div>


<div class="profile-box">

<small>
Horario
</small>

<b>
${esc(p.exit_time||"-")}
-
${esc(p.return_time||"-")}
</b>

</div>

</div>


<div class="review-note">

<b>
Motivo
</b>

<p>
${esc(
  p.reason||
  "No especificado"
)}
</p>

</div>


<div class="review-note">

<b>
Observación
</b>

<p>
${esc(
  p.observation||
  "Sin observaciones"
)}
</p>

</div>


<div class="review-note">

<b>
Documento sustentatorio
</b>

<p>
${esc(
  p.document||
  "No adjuntado"
)}
</p>

</div>


${
p.status==="Pendiente"

?`

<div class="decision-box">

<label>
Comentario de la decisión
</label>

<textarea
id="decisionReason"
placeholder="Opcional al aprobar; obligatorio al rechazar"
></textarea>

</div>


<div class="modal-actions">

<button
class="secondary"
onclick="closeModal()"
>
Cerrar
</button>


<button
class="danger"
onclick="decidePermission(${p.id},'Rechazado')"
>
✕ Rechazar
</button>


<button
class="primary"
onclick="decidePermission(${p.id},'Aprobado')"
>
✓ Aprobar permiso
</button>

</div>

`

:`

<div class="review-note">

<b>
Decisión
</b>

<p>
${esc(
  p.decision_reason||
  "Sin comentario"
)}
</p>

</div>


<div class="modal-actions">

<button
class="secondary"
onclick="closeModal()"
>
Cerrar
</button>

</div>

`
}

`);
}


/* =========================================================
   DECISIÓN PERMISO
========================================================= */

async function decidePermission(
  id,
  status
){

  const reason=
    $("#decisionReason")?.value||
    "";

  if(
    status==="Rechazado" &&
    !reason.trim()
  ){

    toast(
      "Escribe el motivo del rechazo"
    );

    return;
  }

  if(
    !confirm(
      status==="Aprobado"
        ?"¿Confirmas que deseas APROBAR esta solicitud?"
        :"¿Confirmas que deseas RECHAZAR esta solicitud?"
    )
  ){

    return;
  }

  try{

    await api(
      "/permissions/"+id+"/status",
      {
        method:"PUT",
        body:JSON.stringify({
          status,
          reason
        })
      }
    );

    closeModal();

    toast(
      status==="Aprobado"
        ?"Permiso aprobado correctamente"
        :"Permiso rechazado"
    );

    loadNotifications();

    loadPermissions();

  }catch(e){

    toast(
      e.message
    );
  }
}


async function setPermission(
  id,
  status
){

  if(
    !confirm(
      `¿Deseas marcar este permiso como ${status}?`
    )
  ){

    return;
  }

  try{

    await api(
      "/permissions/"+id+"/status",
      {
        method:"PUT",
        body:JSON.stringify({
          status
        })
      }
    );

    toast(
      "Estado actualizado"
    );

    loadPermissions();

  }catch(e){

    toast(
      e.message
    );
  }
}


/* =========================================================
   DETALLE PERMISO
========================================================= */

function permissionDetail(p){

  openModal(`

<h3 class="modal-title">
Detalle del permiso
</h3>


<div class="profile-main">


<div class="profile-box">

<small>
Trabajador
</small>

<b>
${esc(p.names)}
</b>

</div>


<div class="profile-box">

<small>
Fecha
</small>

<b>
${esc(p.date)}
</b>

</div>


<div class="profile-box">

<small>
Estado
</small>

${badge(p.status)}

</div>


<div class="profile-box">

<small>
Tipo
</small>

<b>
${esc(p.type)}
</b>

</div>


<div class="profile-box">

<small>
Salida
</small>

<b>
${esc(p.exit_time||"-")}
</b>

</div>


<div class="profile-box">

<small>
Retorno
</small>

<b>
${esc(p.return_time||"-")}
</b>

</div>


</div>


<div
class="card"
style="margin-top:15px"
>

<div class="kpi-line">

<span>
Motivo
</span>

<b>
${esc(p.reason||"-")}
</b>

</div>


<div class="kpi-line">

<span>
Observación
</span>

<b>
${esc(p.observation||"-")}
</b>

</div>


<div class="kpi-line">

<span>
Autorizó
</span>

<b>
${esc(p.approved_by||"-")}
</b>

</div>


<div class="kpi-line">

<span>
Comentario de decisión
</span>

<b>
${esc(p.decision_reason||"-")}
</b>

</div>

</div>

`);
}


/* =========================================================
   ASISTENCIA
========================================================= */

async function loadAttendance(){

  const rows=
    await api(
      "/attendance?date="+today
    );

  $("#content").innerHTML=
    layout(
      "Asistencia",
      "Control diario de entradas, salidas y tardanzas",

      `
      <button
      class="primary"
      onclick="attendanceForm()"
      >
      + Registrar asistencia
      </button>
      `
    )

+

`
<div class="toolbar">

<input
type="date"
id="adate"
value="${today}"
onchange="refreshAttendance()"
>

</div>


<div class="table-wrap">

<table class="table">

<thead>

<tr>

<th>
Trabajador
</th>

<th>
Fecha
</th>

<th>
Entrada
</th>

<th>
Salida
</th>

<th>
Estado
</th>

<th>
Tardanza
</th>

<th>
Observación
</th>

</tr>

</thead>

<tbody id="attendanceRows">

${attendanceRows(rows)}

</tbody>

</table>

</div>
`;
}


function attendanceRows(rows){

  return rows.length

  ?rows.map(
    a=>`

<tr>

<td>

<b>
${esc(a.names)}
</b>

<small
style="
display:block;
color:#8993a2
"
>
${esc(a.area||"")}
</small>

</td>


<td>
${esc(a.date)}
</td>


<td>
${esc(a.entry_time||"-")}
</td>


<td>
${esc(a.exit_time||"-")}
</td>


<td>
${badge(a.status)}
</td>


<td>
${a.late_minutes||0} min
</td>


<td>
${esc(a.observation||"-")}
</td>

</tr>

`
  ).join("")

  :`

<tr>

<td colspan="7">

<div class="empty">
No hay registros para esta fecha.
</div>

</td>

</tr>

`;
}


async function refreshAttendance(){

  const r=
    await api(
      "/attendance?date="+
      $("#adate").value
    );

  $("#attendanceRows")
    .innerHTML=
      attendanceRows(r);
}


/* =========================================================
   FORMULARIO ASISTENCIA
========================================================= */

async function attendanceForm(){

  const ws=
    await api(
      "/workers"
    );

  openModal(`

<h3 class="modal-title">
Registrar asistencia
</h3>


<form id="attendanceForm">

<div class="form-grid">


<div class="field full">

<label>
Trabajador *
</label>

<select
name="worker_id"
required
>

${
ws
.filter(
  w =>
    w.status==="Activo"
)
.map(
  w=>`

<option
value="${w.id}"
>

${esc(w.names)}

</option>

`
)
.join("")
}

</select>

</div>


<div class="field">

<label>
Fecha
</label>

<input
class="input"
type="date"
name="date"
value="${today}"
>

</div>


<div class="field">

<label>
Estado
</label>

<select
name="status"
>

<option>
Presente
</option>

<option>
Falta
</option>

<option>
Justificado
</option>

<option>
Vacaciones
</option>

</select>

</div>


<div class="field">

<label>
Entrada
</label>

<input
class="input"
type="time"
name="entry_time"
>

</div>


<div class="field">

<label>
Salida
</label>

<input
class="input"
type="time"
name="exit_time"
>

</div>


<div class="field">

<label>
Minutos de tardanza
</label>

<input
class="input"
type="number"
min="0"
name="late_minutes"
value="0"
>

</div>


<div class="field full">

<label>
Justificación / observación
</label>

<textarea
name="observation"
></textarea>

</div>


</div>


<div class="modal-actions">

<button
type="button"
class="secondary"
onclick="closeModal()"
>
Cancelar
</button>

<button
class="primary"
>
Guardar
</button>

</div>

</form>

`);

  $("#attendanceForm").onsubmit=
    async e=>{

      e.preventDefault();

      try{

        await api(
          "/attendance",
          {
            method:"POST",
            body:JSON.stringify(
              Object.fromEntries(
                new FormData(
                  e.target
                )
              )
            )
          }
        );

        closeModal();

        toast(
          "Asistencia guardada"
        );

        loadAttendance();

      }catch(x){

        toast(
          x.message
        );
      }
    };
}


/* =========================================================
   REPORTES
========================================================= */

function loadReports(){

  $("#pageTitle")
    .textContent=
    "Reportes";

  $("#content").innerHTML=

    layout(
      "Reportes",
      "Exporta información para control administrativo"
    )

+

`
<div class="grid2">


<div class="card">

<h4>
Reporte de permisos y salidas
</h4>

<p
style="
color:#718096;
font-size:12px;
line-height:1.7
"
>

Incluye trabajador, DNI, fecha,
tipo, horario, motivo, estado
y responsable de autorización.

</p>


<button
class="primary"
onclick="downloadReport('pdf')"
>
Descargar PDF
</button>


<button
class="secondary"
onclick="downloadReport('excel')"
>
Descargar Excel
</button>

</div>


<div class="card">

<h4>
Información disponible
</h4>


<div class="kpi-line">

<span>
Personal
</span>

<b>
Trabajadores
</b>

</div>


<div class="kpi-line">

<span>
Control
</span>

<b>
Permisos y salidas
</b>

</div>


<div class="kpi-line">

<span>
Asistencia
</span>

<b>
Entradas y tardanzas
</b>

</div>


<div class="kpi-line">

<span>
Estadísticas
</span>

<b>
Dashboard
</b>

</div>

</div>

</div>
`;
}


/* =========================================================
   DESCARGAR REPORTES
========================================================= */

async function downloadReport(type){

  const b=
    await api(
      "/reports/"+type
    );

  const url=
    URL.createObjectURL(b);

  const a=
    document.createElement(
      "a"
    );

  a.href=url;

  a.download=
    type==="pdf"
      ?"Reporte_Permisos.pdf"
      :"Reporte_Permisos.xlsx";

  a.click();

  URL.revokeObjectURL(url);
}
