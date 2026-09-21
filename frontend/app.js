javascript
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const API = window.API_BASE || "https://permisosfun-1.onrender.com/api";

let token = localStorage.getItem("token") || "";

/* =========================================================
   UTILIDADES
========================================================= */

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const today = new Date().toISOString().slice(0, 10);

function toast(s) {
  const e = $("#toast");

  if (!e) return;

  e.textContent = s;
  e.classList.add("toast-show");

  setTimeout(() => {
    e.classList.remove("toast-show");
  }, 2500);
}

function openModal(html) {
  const modalContent = $("#modalContent");
  const modal = $("#modal");

  if (!modalContent || !modal) return;

  modalContent.innerHTML = html;
  modal.classList.remove("hidden");
}

function closeModal() {
  const modal = $("#modal");

  if (!modal) return;

  modal.classList.add("hidden");
}

function initials(n) {
  return String(n || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(x => x[0])
    .join("")
    .toUpperCase();
}

function badge(s) {
  let c =
    s === "Aprobado"
      ? "green"
      : s === "Rechazado"
      ? "red"
      : s === "Pendiente"
      ? "amber"
      : s === "Activo"
      ? "green"
      : s === "Inactivo"
      ? "gray"
      : "blue";

  return `
    <span class="badge ${c}">
      ${esc(s || "-")}
    </span>
  `;
}

/* =========================================================
   PANTALLAS
========================================================= */

function showLogin() {
  $("#landing")?.classList.add("hidden");
  $("#login")?.classList.remove("hidden");
  $("#app")?.classList.add("hidden");

  setTimeout(() => {
    $("#user")?.focus();
  }, 50);
}

function showLanding() {
  $("#landing")?.classList.remove("hidden");
  $("#login")?.classList.add("hidden");
  $("#app")?.classList.add("hidden");
}

function showApp() {
  $("#landing")?.classList.add("hidden");
  $("#login")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");
}

/* =========================================================
   API
========================================================= */

function headers(json = true) {
  const h = {};

  if (token) {
    h.Authorization = "Bearer " + token;
  }

  if (json) {
    h["Content-Type"] = "application/json";
  }

  return h;
}

async function api(url, opt = {}) {
  const r = await fetch(API + url, {
    ...opt,
    headers: {
      ...headers(opt.body !== undefined),
      ...(opt.headers || {})
    }
  });

  if (r.status === 401) {
    if (url !== "/login") {
      logout();
    }

    throw Error("No autorizado");
  }

  const contentType =
    r.headers.get("content-type") || "";

  let d;

  if (contentType.includes("json")) {
    d = await r.json();
  } else if (
    contentType.includes("application/pdf") ||
    contentType.includes(
      "application/vnd.openxmlformats-officedocument"
    )
  ) {
    d = await r.blob();
  } else {
    const text = await r.text();

    try {
      d = JSON.parse(text);
    } catch {
      d = {
        error:
          text ||
          "Respuesta inválida del servidor"
      };
    }
  }

  if (!r.ok) {
    throw Error(
      d?.error ||
      "Error del servidor"
    );
  }

  return d;
}

/* =========================================================
   LOGOUT
========================================================= */

function logout() {
  localStorage.removeItem("token");

  token = "";

  $("#app")?.classList.add("hidden");

  showLanding();
}

/* =========================================================
   DOCUMENTOS
========================================================= */

function documentInfo(p) {
  const data = p.document || "";

  const name =
    p.document_name ||
    "Documento sustentatorio";

  const type =
    p.document_type || "";

  if (!data) {
    return `
      <div class="empty">
        No se adjuntó documento sustentatorio.
      </div>
    `;
  }

  const id =
    "documentViewer_" +
    Date.now() +
    "_" +
    Math.random()
      .toString(36)
      .slice(2);

  return `
    <div
      id="${id}"
      style="
        padding:14px;
        border:1px solid #e2e8f0;
        border-radius:10px;
        background:#f8fafc;
      "
    >

      <div
        style="
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:12px;
        "
      >

        <span style="font-size:25px;">
          ${type.startsWith("image/") ? "🖼️" : "📎"}
        </span>

        <div>

          <b>
            ${esc(name)}
          </b>

          <small
            style="
              display:block;
              color:#718096;
              margin-top:3px;
            "
          >
            ${esc(type || "Documento adjunto")}
          </small>

        </div>

      </div>

      ${
        type.startsWith("image/")
          ? `
            <img
              src="${data}"
              alt="${esc(name)}"
              style="
                max-width:100%;
                max-height:450px;
                display:block;
                margin:0 auto 15px;
                border-radius:8px;
                border:1px solid #e2e8f0;
                object-fit:contain;
                background:white;
              "
            >
          `
          : type === "application/pdf"
          ? `
            <div
              style="
                padding:20px;
                text-align:center;
                background:#fff;
                border:1px solid #e2e8f0;
                border-radius:8px;
                margin-bottom:15px;
              "
            >
              <div style="font-size:45px;">
                📄
              </div>

              <b>
                Archivo PDF adjunto
              </b>

              <p
                style="
                  color:#718096;
                  font-size:12px;
                  margin:6px 0 0;
                "
              >
                Haz clic en "Ver documento" para abrirlo.
              </p>
            </div>
          `
          : ""
      }

      <div
        style="
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        "
      >

        <button
          type="button"
          class="secondary"
          id="${id}_open"
          style="
            padding:9px 13px;
          "
        >
          👁️ Ver documento
        </button>

        <button
          type="button"
          class="primary"
          id="${id}_download"
          style="
            padding:9px 13px;
          "
        >
          📥 Descargar
        </button>

      </div>

    </div>
  `;

  setTimeout(() => {

    const openButton =
      document.getElementById(
        id + "_open"
      );

    const downloadButton =
      document.getElementById(
        id + "_download"
      );

    if (openButton) {

      openButton.onclick = () => {

        try {

          const nuevaVentana =
            window.open(
              "",
              "_blank"
            );

          if (!nuevaVentana) {

            toast(
              "El navegador bloqueó la nueva pestaña. Permite ventanas emergentes."
            );

            return;
          }

          /*
             IMÁGENES
          */

          if (
            type === "image/jpeg" ||
            type === "image/png"
          ) {

            nuevaVentana.document.write(`
              <!DOCTYPE html>

              <html>

              <head>

                <title>
                  ${esc(name)}
                </title>

                <meta
                  charset="UTF-8"
                >

                <style>

                  html,
                  body {

                    margin:0;

                    padding:0;

                    width:100%;

                    min-height:100%;

                    background:#111827;

                  }

                  body {

                    display:flex;

                    align-items:center;

                    justify-content:center;

                  }

                  img {

                    max-width:95vw;

                    max-height:95vh;

                    object-fit:contain;

                  }

                </style>

              </head>

              <body>

                <img
                  src="${data}"
                  alt="${esc(name)}"
                >

              </body>

              </html>
            `);

            nuevaVentana.document.close();

            return;
          }

          /*
             PDF
          */

          if (
            type ===
            "application/pdf"
          ) {

            nuevaVentana.location.href =
              data;

            return;
          }

          /*
             OTROS TIPOS
          */

          nuevaVentana.location.href =
            data;

        } catch (error) {

          console.error(
            "ERROR AL ABRIR DOCUMENTO:",
            error
          );

          toast(
            "No se pudo abrir el documento"
          );

        }

      };
    }

    if (downloadButton) {

      downloadButton.onclick = () => {

        try {

          const a =
            document.createElement(
              "a"
            );

          a.href = data;

          a.download =
            name ||
            "documento";

          document.body.appendChild(
            a
          );

          a.click();

          a.remove();

        } catch (error) {

          console.error(
            "ERROR AL DESCARGAR DOCUMENTO:",
            error
          );

          toast(
            "No se pudo descargar el documento"
          );

        }

      };

    }

  }, 0);
}

/* =========================================================
   LOGIN
========================================================= */

const loginForm = $("#loginForm");

if (loginForm) {

  loginForm.onsubmit = async e => {

    e.preventDefault();

    const username =
      $("#user")?.value.trim() || "";

    const password =
      $("#pass")?.value || "";

    if (!username || !password) {

      toast(
        "Ingresa usuario y contraseña"
      );

      return;
    }

    try {

      const d =
        await api(
          "/login",
          {
            method:"POST",

            body:
              JSON.stringify({
                username,
                password
              })
          }
        );

      if (!d.token) {

        throw Error(
          "El servidor no devolvió el token de acceso"
        );

      }

      token =
        d.token;

      localStorage.setItem(
        "token",
        token
      );

      showApp();

      if ($("#sideName")) {

        $("#sideName").textContent =
          d.user?.name ||
          d.user?.username ||
          username;

      }

      await loadDashboard();

      await loadNotifications();

      setInterval(
        loadNotifications,
        15000
      );

    } catch (x) {

      console.error(
        "ERROR LOGIN:",
        x
      );

      toast(
        x.message ||
        "No se pudo iniciar sesión"
      );

    }

  };

}

if ($("#logout")) {
  $("#logout").onclick =
    logout;
}

if ($("#openLogin")) {
  $("#openLogin").onclick =
    showLogin;
}

if ($("#openLogin2")) {
  $("#openLogin2").onclick =
    showLogin;
}

/* =========================================================
   NAVEGACIÓN
========================================================= */

$$(".nav").forEach(b => {

  b.onclick = () => {

    $$(".nav").forEach(
      x =>
        x.classList.remove(
          "active"
        )
    );

    b.classList.add(
      "active"
    );

    const pages = {

      dashboard:
        loadDashboard,

      workers:
        loadWorkers,

      permissions:
        loadPermissions,

      attendance:
        loadAttendance,

      reports:
        loadReports

    };

    const fn =
      pages[b.dataset.page];

    if (fn) {
      fn();
    }

  };

});

/* =========================================================
   FECHA ACTUAL
========================================================= */

if ($("#todayLabel")) {

  $("#todayLabel").textContent =
    new Date().toLocaleDateString(
      "es-PE",
      {
        weekday:"long",
        day:"2-digit",
        month:"long"
      }
    );

}

/* =========================================================
   RECUPERAR SESIÓN
========================================================= */

if (token) {

  showApp();

  api("/me")
    .then(d => {

      if ($("#sideName")) {

        $("#sideName").textContent =
          d.name ||
          d.username ||
          "Administrador";

      }

    })
    .catch(() => {

      logout();

    });

  loadDashboard();

  loadNotifications();

  setInterval(
    loadNotifications,
    15000
  );

} else {

  showLanding();

}

/* =========================================================
   LAYOUT
========================================================= */

function layout(
  title,
  sub,
  actions = ""
) {

  if ($("#pageTitle")) {

    $("#pageTitle").textContent =
      title;

  }

  return `

    <div class="page-head">

      <div>

        <h3>
          ${esc(title)}
        </h3>

        <p>
          ${esc(sub)}
        </p>

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

async function loadDashboard() {

  try {

    const d =
      await api(
        "/dashboard"
      );

    const byType =
      Array.isArray(d.byType)
        ? d.byType
        : [];

    const ranking =
      Array.isArray(d.ranking)
        ? d.ranking
        : [];

    $("#content").innerHTML =

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
${d.activeWorkers ?? 0}
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
${d.totalPermissions ?? 0}
</strong>

<div class="mini">
${d.weekly ?? 0} esta semana
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
${d.pending ?? 0}
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
${d.late ?? 0}
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
  byType.length
    ? byType.map(x => {

        const max =
          Math.max(
            1,
            ...byType.map(
              a =>
                Number(a.total) || 0
            )
          );

        const width =
          Math.min(
            100,
            (
              (Number(x.total) || 0) /
              max
            ) * 100
          );

        return `

<div class="bar-row">

<span>
${esc(x.type)}
</span>

<div class="bar">

<i style="width:${width}%"></i>

</div>

<b>
${x.total}
</b>

</div>

`;

      }).join("")

    :

`

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
${d.today ?? 0}
</b>

</div>


<div class="kpi-line">

<span>
Esta semana
</span>

<b>
${d.weekly ?? 0}
</b>

</div>


<div class="kpi-line">

<span>
Este mes
</span>

<b>
${d.monthly ?? 0}
</b>

</div>


<div class="kpi-line">

<span>
Aprobados
</span>

<b>
${d.approved ?? 0}
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
  ranking.length
    ?
`

<div
class="table-wrap"
style="border:0"
>

<table class="table">

<thead>

<tr>

<th>
Trabajador
</th>

<th>
Área
</th>

<th>
Total
</th>

</tr>

</thead>


<tbody>

${ranking.map(
  x => `

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
${esc(x.area || "-")}
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

    :

`

<div class="empty">

Agrega trabajadores y permisos
para ver estadísticas.

</div>

`

}

</div>

`;

  } catch (e) {

    console.error(
      "DASHBOARD:",
      e
    );

    toast(
      e.message
    );

  }

}

/* =========================================================
   TRABAJADORES
========================================================= */

async function loadWorkers() {

  try {

    const data =
      await api(
        "/workers"
      );

    const rows =
      Array.isArray(
        data.workers
      )
        ? data.workers
        : [];

    $("#content").innerHTML =

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

  } catch (e) {

    toast(
      e.message ||
      "No se pudieron cargar los trabajadores"
    );

  }

}

/* =========================================================
   FILAS TRABAJADORES
========================================================= */

function workerRows(rows) {

  return rows.length

    ?

    rows.map(w => {

      const status =
        w.status === "Inactivo"
          ? "Inactivo"
          : "Activo";

      return `

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
${esc(w.position || "-")}
</td>


<td>
${esc(w.area || "-")}
</td>


<td>
${esc(w.phone || "-")}
</td>


<td>
${esc(w.hire_date || "-")}
</td>


<td>
${badge(status)}
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
onclick='workerForm(${JSON.stringify(w).replace(/'/g, "&#039;")})'
>
Editar
</button>


<button
class="danger"
onclick="deleteWorker(${w.id})"
>
Eliminar
</button>

</td>

</tr>

`;

    }).join("")

    :

`

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

async function filterWorkers() {

  try {

    const search =
      $("#workerSearch")?.value || "";

    const data =
      await api(
        "/workers?search=" +
        encodeURIComponent(search)
      );

    const rows =
      Array.isArray(
        data.workers
      )
        ? data.workers
        : [];

    $("#workerRows").innerHTML =
      workerRows(rows);

  } catch (e) {

    toast(
      e.message ||
      "No se pudo realizar la búsqueda"
    );

  }

}

/* =========================================================
   ELIMINAR TRABAJADOR
========================================================= */

async function deleteWorker(id) {

  const confirmar =
    confirm(
      "¿Estás seguro de que deseas eliminar este trabajador?\n\n" +
      "El trabajador dejará de aparecer en la lista."
    );

  if (!confirmar) return;

  try {

    await api(
      "/workers/" + id,
      {
        method:"DELETE"
      }
    );

    toast(
      "Trabajador eliminado correctamente"
    );

    await loadWorkers();

  } catch (e) {

    toast(
      e.message ||
      "No se pudo eliminar el trabajador"
    );

  }

}

/* =========================================================
   ACTIVAR TRABAJADOR
========================================================= */

async function activateWorker(id) {

  const confirmar =
    confirm(
      "¿Deseas volver a activar este trabajador?"
    );

  if (!confirmar) return;

  try {

    await api(
      "/workers/" + id,
      {
        method:"PUT",

        body:
          JSON.stringify({
            status:"Activo"
          })
      }
    );

    toast(
      "Trabajador activado correctamente"
    );

    await loadWorkers();

  } catch (e) {

    toast(
      e.message ||
      "No se pudo activar el trabajador"
    );

  }

}

/* =========================================================
   FORMULARIO TRABAJADOR
========================================================= */

function workerForm(w = {}) {

  openModal(`

<h3 class="modal-title">

${
  w.id
    ? "Editar trabajador"
    : "Nuevo trabajador"
}

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

<select
class="input"
name="status"
>

<option
value="Activo"
${w.status !== "Inactivo" ? "selected" : ""}
>
Activo
</option>


<option
value="Inactivo"
${w.status === "Inactivo" ? "selected" : ""}
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

  $("#workerForm").onsubmit =
    async e => {

      e.preventDefault();

      const o =
        Object.fromEntries(
          new FormData(e.target)
        );

      try {

        await api(
          w.id
            ? "/workers/" + w.id
            : "/workers",

          {
            method:
              w.id
                ? "PUT"
                : "POST",

            body:
              JSON.stringify(o)
          }
        );

        closeModal();

        toast(
          "Trabajador guardado correctamente"
        );

        await loadWorkers();

      } catch (x) {

        toast(
          x.message
        );

      }

    };

}

/* =========================================================
   HISTORIAL TRABAJADOR
========================================================= */

async function workerHistory(id) {

  try {

    const d =
      await api(
        "/workers/" +
        id +
        "/history"
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
  d.worker.position || ""
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
  d.worker.area || "-"
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
    ?
`
${d.permissions
  .slice(0, 8)
  .map(
    p => `

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
  .join("")}
`

    :

`
<div class="empty">
Sin registros.
</div>
`
}

</div>

</div>

</div>

`);

  } catch (e) {

    toast(
      e.message ||
      "No se pudo cargar el historial"
    );

  }

}

/* =========================================================
   PERMISOS
========================================================= */

async function loadPermissions() {

  try {

    const data =
      await api(
        "/permissions"
      );

    const rows =
      Array.isArray(
        data.permissions
      )
        ? data.permissions
        : [];

    const workersData =
      await api(
        "/workers"
      );

    const workers =
      Array.isArray(
        workersData.workers
      )
        ? workersData.workers
        : [];

    $("#content").innerHTML =

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

${permissionRows(
  rows,
  workers
)}

</tbody>

</table>

</div>

`;

  } catch (e) {

    toast(
      e.message ||
      "No se pudieron cargar los permisos"
    );

  }

}

/* =========================================================
   OBTENER TRABAJADOR DEL PERMISO
========================================================= */

function getWorkerForPermission(
  p,
  workers = []
) {

  if (
    p.worker_id !== undefined &&
    p.worker_id !== null
  ) {

    const byId =
      workers.find(
        w =>
          Number(w.id) ===
          Number(p.worker_id)
      );

    if (byId) {
      return byId;
    }

  }

  if (p.dni) {

    const dniPermiso =
      String(
        p.dni
      ).trim();

    const byDni =
      workers.find(
        w =>
          String(
            w.dni || ""
          ).trim() ===
          dniPermiso
      );

    if (byDni) {
      return byDni;
    }

  }

  return null;
}

/* =========================================================
   FILAS DE PERMISOS
========================================================= */

function permissionRows(
  rows,
  workers = []
) {

  return rows.length

    ?

    rows.map(p => {

      const worker =
        getWorkerForPermission(
          p,
          workers
        );

      const workerName =
        worker?.names ||
        p.names ||
        p.nombre ||
        p.worker_name ||
        p.workerNames ||
        p.name ||
        "Sin nombre";

      const workerDni =
        worker?.dni ||
        p.dni ||
        p.worker_dni ||
        p.workerDni ||
        "-";

      return `

<tr>

<td>
${esc(p.date)}
</td>


<td>

<div class="person">

<span class="avatar">
${initials(workerName)}
</span>

<div>

<b>
${esc(workerName)}
</b>

<small
style="
display:block;
color:#8993a2
"
>

DNI:
${esc(workerDni)}

</small>

</div>

</div>

</td>


<td>
${esc(p.type)}
</td>


<td>
${esc(p.exit_time || "-")}
</td>


<td>
${esc(p.return_time || "-")}
</td>


<td>
${esc(p.reason || "-")}
</td>


<td>
${badge(p.status)}
</td>


<td>

${
  p.status === "Pendiente"

    ?

`
<button
class="primary"
onclick="reviewPermission(${p.id})"
>
Revisar
</button>
`

    :

`
<button
class="secondary"
onclick='permissionDetail(${JSON.stringify({
  ...p,
  names:workerName,
  dni:workerDni
}).replace(/'/g, "&#039;")}'
>
Ver
</button>
`
}

<button
class="danger"
onclick="deletePermission(${p.id})"
title="Eliminar permiso"
>
🗑️ Eliminar
</button>

</td>

</tr>

`;

    }).join("")

    :

`

<tr>

<td colspan="8">

<div class="empty">

No hay permisos registrados.

</div>

</td>

</tr>

`;

}

/* =========================================================
   ELIMINAR PERMISO
========================================================= */

async function deletePermission(id) {

  const confirmar =
    confirm(
      "¿Estás seguro de que deseas eliminar este registro de permiso?\n\n" +
      "Esta acción eliminará el registro definitivamente."
    );

  if (!confirmar) return;

  try {

    await api(
      "/permissions/" +
      id,
      {
        method:"DELETE"
      }
    );

    toast(
      "Permiso eliminado correctamente"
    );

    await loadPermissions();

    await loadNotifications();

  } catch (e) {

    toast(
      e.message ||
      "No se pudo eliminar el permiso"
    );

  }

}

/* =========================================================
   FILTRAR PERMISOS
========================================================= */

async function filterPermissions() {

  try {

    const search =
      $("#psearch")?.value || "";

    const status =
      $("#pstatus")?.value || "";

    const type =
      $("#ptype")?.value || "";

    const u =
      "/permissions?search=" +
      encodeURIComponent(search) +
      "&status=" +
      encodeURIComponent(status) +
      "&type=" +
      encodeURIComponent(type);

    const data =
      await api(u);

    const rows =
      Array.isArray(
        data.permissions
      )
        ? data.permissions
        : [];

    const workersData =
      await api(
        "/workers"
      );

    const workers =
      Array.isArray(
        workersData.workers
      )
        ? workersData.workers
        : [];

    $("#permissionRows").innerHTML =
      permissionRows(
        rows,
        workers
      );

  } catch (e) {

    toast(
      e.message ||
      "No se pudieron filtrar los permisos"
    );

  }

}

/* =========================================================
   FORMULARIO PERMISO
========================================================= */

async function permissionForm() {

  const data =
    await api(
      "/workers"
    );

  const ws =
    Array.isArray(
      data.workers
    )
      ? data.workers
      : [];

  const active =
    ws.filter(
      w =>
        w.status !==
        "Inactivo"
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
  w => `

<option
value="${w.id}"
>

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
  x =>
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

  $("#permissionForm").onsubmit =
    async e => {

      e.preventDefault();

      try {

        await api(
          "/permissions",
          {
            method:"POST",

            body:
              JSON.stringify(
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

        await loadPermissions();

        await loadNotifications();

      } catch (x) {

        toast(
          x.message
        );

      }

    };

}

/* =========================================================
   NOTIFICACIONES
========================================================= */

async function loadNotifications() {

  try {

    const d =
      await api(
        "/notifications"
      );

    const b =
      $("#pendingCount");

    if (!b) return;

    b.textContent =
      d.pending ?? 0;

    b.classList.toggle(
      "zero",
      (d.pending ?? 0) === 0
    );

  } catch (e) {

    console.error(
      "NOTIFICACIONES:",
      e
    );

  }

}

async function showNotifications() {

  try {

    const d =
      await api(
        "/notifications"
      );

    const latest =
      Array.isArray(
        d.latest
      )
        ? d.latest
        : [];

    const workersData =
      await api(
        "/workers"
      );

    const workers =
      Array.isArray(
        workersData.workers
      )
        ? workersData.workers
        : [];

    openModal(`

<h3 class="modal-title">

🔔 Solicitudes pendientes

</h3>


${
  latest.length
    ?

    latest.map(x => {

      const worker =
        getWorkerForPermission(
          x,
          workers
        );

      const workerName =
        worker?.names ||
        x.names ||
        x.nombre ||
        x.worker_name ||
        "Sin nombre";

      return `

<div
class="notification-row"
onclick="reviewPermission(${x.id})"
>

<div>

<div class="person">

<span class="avatar">
${initials(workerName)}
</span>

<b>
${esc(workerName)}
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

`;

    }).join("")

    :

`

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

  } catch (e) {

    toast(
      e.message ||
      "No se pudieron cargar las notificaciones"
    );

  }

}

/* =========================================================
   REVISAR PERMISO
========================================================= */

async function reviewPermission(id) {

  try {

    const data =
      await api(
        "/permissions"
      );

    const rows =
      Array.isArray(
        data.permissions
      )
        ? data.permissions
        : [];

    const p =
      rows.find(
        x =>
          Number(x.id) ===
          Number(id)
      );

    if (!p) {

      return toast(
        "No se encontró la solicitud"
      );

    }

    const workersData =
      await api(
        "/workers"
      );

    const workers =
      Array.isArray(
        workersData.workers
      )
        ? workersData.workers
        : [];

    const worker =
      getWorkerForPermission(
        p,
        workers
      );

    const workerName =
      worker?.names ||
      p.names ||
      p.nombre ||
      p.worker_name ||
      "Sin nombre";

    const workerDni =
      worker?.dni ||
      p.dni ||
      p.worker_dni ||
      "-";

    openModal(`

<h3 class="modal-title">

Revisar solicitud de permiso

</h3>


<div class="review-head">


<div class="person">

<span class="avatar">

${initials(
  workerName
)}

</span>


<div>

<b>

${esc(
  workerName
)}

</b>


<small>

${esc(
  workerDni
)}

·

${esc(
  worker?.position ||
  p.position ||
  ""
)}

·

${esc(
  worker?.area ||
  p.area ||
  ""
)}

</small>

</div>

</div>


${badge(
  p.status
)}


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

${esc(
  p.exit_time || "-"
)}

-

${esc(
  p.return_time || "-"
)}

</b>

</div>


</div>


<div class="review-note">

<b>
Motivo
</b>


<p>

${esc(
  p.reason ||
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
  p.observation ||
  "Sin observaciones"
)}

</p>

</div>


<div class="review-note">

<b>
Documento sustentatorio
</b>


${documentInfo(p)}


</div>


${
  p.status ===
  "Pendiente"

    ?

`

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

    :

`

<div class="review-note">

<b>
Decisión
</b>


<p>

${esc(
  p.decision_reason ||
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

  } catch (e) {

    toast(
      e.message ||
      "No se pudo abrir la solicitud"
    );

  }

}

/* =========================================================
   DECISIÓN PERMISO
========================================================= */

async function decidePermission(
  id,
  status
) {

  const reason =
    $("#decisionReason")?.value ||
    "";

  if (
    status ===
    "Rechazado" &&
    !reason.trim()
  ) {

    toast(
      "Escribe el motivo del rechazo"
    );

    return;
  }

  if (
    !confirm(
      status ===
      "Aprobado"
        ?
        "¿Confirmas que deseas APROBAR esta solicitud?"
        :
        "¿Confirmas que deseas RECHAZAR esta solicitud?"
    )
  ) {

    return;

  }

  try {

    await api(
      "/permissions/" +
      id +
      "/status",
      {
        method:"PUT",

        body:
          JSON.stringify({
            status,
            reason
          })
      }
    );

    closeModal();

    toast(
      status ===
      "Aprobado"
        ?
        "Permiso aprobado correctamente"
        :
        "Permiso rechazado"
    );

    await loadNotifications();

    await loadPermissions();

  } catch (e) {

    toast(
      e.message
    );

  }

}

async function setPermission(
  id,
  status
) {

  if (
    !confirm(
      `¿Deseas marcar este permiso como ${status}?`
    )
  ) {

    return;

  }

  try {

    await api(
      "/permissions/" +
      id +
      "/status",
      {
        method:"PUT",

        body:
          JSON.stringify({
            status
          })
      }
    );

    toast(
      "Estado actualizado"
    );

    await loadPermissions();

    await loadNotifications();

  } catch (e) {

    toast(
      e.message
    );

  }

}

/* =========================================================
   DETALLE PERMISO
========================================================= */

function permissionDetail(p) {

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
${esc(
  p.names ||
  p.nombre ||
  p.worker_name ||
  "Sin nombre"
)}
</b>

</div>


<div class="profile-box">

<small>
DNI
</small>

<b>
${esc(
  p.dni ||
  p.worker_dni ||
  "-"
)}
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
${esc(
  p.exit_time || "-"
)}
</b>

</div>


<div class="profile-box">

<small>
Retorno
</small>

<b>
${esc(
  p.return_time || "-"
)}
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
${esc(
  p.reason || "-"
)}
</b>

</div>


<div class="kpi-line">

<span>
Observación
</span>

<b>
${esc(
  p.observation || "-"
)}
</b>

</div>


<div class="kpi-line">

<span>
Autorizó
</span>

<b>
${esc(
  p.approved_by || "-"
)}
</b>

</div>


<div class="kpi-line">

<span>
Comentario de decisión
</span>

<b>
${esc(
  p.decision_reason || "-"
)}
</b>

</div>


</div>


<div
class="card"
style="margin-top:15px"
>

<h4>
Documento sustentatorio
</h4>


${documentInfo(p)}


</div>

`);

}

/* =========================================================
   ASISTENCIA
========================================================= */

async function loadAttendance() {

  try {

    const data =
      await api(
        "/attendance?date=" +
        today
      );

    const rows =
      Array.isArray(
        data.attendance
      )
        ? data.attendance
        : Array.isArray(data)
        ? data
        : [];

    $("#content").innerHTML =

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

  } catch (e) {

    toast(
      e.message ||
      "No se pudo cargar la asistencia"
    );

  }

}

function attendanceRows(rows) {

  return rows.length

    ?

    rows.map(
      a => `

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

${esc(
  a.area || ""
)}

</small>

</td>


<td>
${esc(a.date)}
</td>


<td>
${esc(
  a.entry_time || "-"
)}
</td>


<td>
${esc(
  a.exit_time || "-"
)}
</td>


<td>
${badge(a.status)}
</td>


<td>
${a.late_minutes || 0} min
</td>


<td>
${esc(
  a.observation || "-"
)}
</td>


</tr>

`
    ).join("")

    :

`

<tr>

<td colspan="7">

<div class="empty">

No hay registros para esta fecha.

</div>

</td>

</tr>

`;

}

async function refreshAttendance() {

  try {

    const data =
      await api(
        "/attendance?date=" +
        $("#adate").value
      );

    const rows =
      Array.isArray(
        data.attendance
      )
        ? data.attendance
        : Array.isArray(data)
        ? data
        : [];

    $("#attendanceRows").innerHTML =
      attendanceRows(rows);

  } catch (e) {

    toast(
      e.message ||
      "No se pudo actualizar la asistencia"
    );

  }

}

/* =========================================================
   FORMULARIO ASISTENCIA
========================================================= */

async function attendanceForm() {

  const data =
    await api(
      "/workers"
    );

  const ws =
    Array.isArray(
      data.workers
    )
      ? data.workers
      : [];

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
        w.status !==
        "Inactivo"
    )
    .map(
      w => `

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

  $("#attendanceForm").onsubmit =
    async e => {

      e.preventDefault();

      try {

        await api(
          "/attendance",
          {
            method:"POST",

            body:
              JSON.stringify(
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

        await loadAttendance();

      } catch (x) {

        toast(
          x.message
        );

      }

    };

}

/* =========================================================
   REPORTES
========================================================= */

function loadReports() {

  if ($("#pageTitle")) {

    $("#pageTitle").textContent =
      "Reportes";

  }

  $("#content").innerHTML =

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

async function downloadReport(type) {

  try {

    const b =
      await api(
        "/reports/" +
        type
      );

    const url =
      URL.createObjectURL(
        b
      );

    const a =
      document.createElement(
        "a"
      );

    a.href =
      url;

    a.download =
      type === "pdf"
        ? "Reporte_Permisos.pdf"
        : "Reporte_Permisos.xlsx";

    document.body.appendChild(
      a
    );

    a.click();

    a.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1000
    );

  } catch (e) {

    toast(
      e.message ||
      "No se pudo descargar el reporte"
    );

  }

}

