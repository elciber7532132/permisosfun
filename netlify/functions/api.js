const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const SECRET =
  process.env.JWT_SECRET ||
  'cambia-esta-clave-en-netlify';

const DB_FILE =
  process.env.DB_FILE ||
  path.join(__dirname, '../../data/empresarial.json');


/* =========================================================
   BASE DE DATOS
========================================================= */

async function loadDB() {

  let db = null;

  try {
    db = JSON.parse(
      fs.readFileSync(DB_FILE, 'utf8')
    );
  } catch {}

  if (!db) {

    db = {
      admins: [],
      workers: [],
      permissions: [],
      attendance: [],
      signatures: [],

      counters: {
        workers: 0,
        permissions: 0,
        attendance: 0,
        signatures: 0
      }
    };

    db.admins.push({
      id: 1,
      username: 'admin',
      password: bcrypt.hashSync(
        'admin123',
        10
      ),
      name: 'Administrador'
    });

    fs.mkdirSync(
      path.dirname(DB_FILE),
      {
        recursive: true
      }
    );

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(
        db,
        null,
        2
      )
    );
  }

  return db;
}


async function saveDB(db) {

  fs.mkdirSync(
    path.dirname(DB_FILE),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(
      db,
      null,
      2
    )
  );
}


function nextId(db, type) {

  db.counters[type] =
    (db.counters[type] || 0) + 1;

  return db.counters[type];
}


/* =========================================================
   RESPUESTAS
========================================================= */

function json(
  statusCode,
  body
) {

  return {
    statusCode,

    headers: {
      'Content-Type':
        'application/json',

      'Cache-Control':
        'no-store',

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        'Content-Type, Authorization',

      'Access-Control-Allow-Methods':
        'GET, POST, PUT, DELETE, OPTIONS'
    },

    body: JSON.stringify(body)
  };
}


/* =========================================================
   AUTENTICACIÓN
========================================================= */

function auth(event) {

  const h =
    event.headers.authorization ||
    event.headers.Authorization ||
    '';

  if (!h.startsWith('Bearer ')) {

    throw Object.assign(
      new Error('No autorizado'),
      {
        statusCode: 401
      }
    );
  }

  try {

    return jwt.verify(
      h.slice(7),
      SECRET
    );

  } catch {

    throw Object.assign(
      new Error('Sesión expirada'),
      {
        statusCode: 401
      }
    );
  }
}


/* =========================================================
   BODY
========================================================= */

function parseBody(event) {

  try {

    return event.body
      ? JSON.parse(event.body)
      : {};

  } catch {

    return {};
  }
}


function qDate(v) {

  return String(v || '')
    .slice(0, 10);
}


function nowISO() {

  return new Date().toISOString();
}


/* =========================================================
   ENRIQUECER PERMISO
========================================================= */

function enrichPermission(
  p,
  db
) {

  const w =
    db.workers.find(
      x =>
        x.id === p.worker_id
    ) || {};

  return {

    ...p,

    dni:
      w.dni || '',

    names:
      w.names || '',

    position:
      w.position || '',

    area:
      w.area || ''
  };
}


/* =========================================================
   REPORTES
========================================================= */

async function reportExcel(db) {

  const wb =
    new ExcelJS.Workbook();

  const ws =
    wb.addWorksheet(
      'Permisos'
    );

  ws.columns = [

    {
      header: 'Fecha',
      key: 'date',
      width: 14
    },

    {
      header: 'Trabajador',
      key: 'names',
      width: 28
    },

    {
      header: 'DNI',
      key: 'dni',
      width: 14
    },

    {
      header: 'Área',
      key: 'area',
      width: 20
    },

    {
      header: 'Tipo',
      key: 'type',
      width: 22
    },

    {
      header: 'Salida',
      key: 'exit_time',
      width: 12
    },

    {
      header: 'Retorno',
      key: 'return_time',
      width: 12
    },

    {
      header: 'Motivo',
      key: 'reason',
      width: 35
    },

    {
      header: 'Estado',
      key: 'status',
      width: 15
    },

    {
      header: 'Autorizó',
      key: 'approved_by',
      width: 22
    },

    {
      header: 'Decisión',
      key: 'decision_reason',
      width: 35
    }
  ];


  db.permissions
    .map(
      p =>
        enrichPermission(
          p,
          db
        )
    )
    .forEach(
      p =>
        ws.addRow(p)
    );


  ws.getRow(1).font = {
    bold: true
  };


  ws.autoFilter =
    'A1:K1';


  return Buffer.from(
    await wb.xlsx.writeBuffer()
  );
}


async function reportPDF(db) {

  const doc =
    new PDFDocument({
      margin: 40
    });

  const chunks = [];

  doc.on(
    'data',
    c =>
      chunks.push(c)
  );

  const done =
    new Promise(
      resolve =>
        doc.on(
          'end',
          resolve
        )
    );


  doc
    .fontSize(18)
    .text(
      'Reporte de permisos y salidas - Funeraria Martínez'
    );


  doc
    .moveDown()
    .fontSize(9)
    .text(
      'Generado: ' +
      new Date()
        .toLocaleString(
          'es-PE'
        )
    );


  doc.moveDown();


  db.permissions
    .map(
      p =>
        enrichPermission(
          p,
          db
        )
    )
    .forEach(
      (p, i) => {

        doc
          .fontSize(10)
          .text(
            `${i + 1}. ${p.date} | ${p.names} (${p.dni})`
          );


        doc
          .fontSize(9)
          .text(
            `Tipo: ${p.type} | Horario: ${
              p.exit_time || '-'
            } - ${
              p.return_time || '-'
            } | Estado: ${p.status}`
          );


        doc.text(
          `Motivo: ${
            p.reason || '-'
          } | Autorizó: ${
            p.approved_by || '-'
          }`
        );


        if (
          p.decision_reason
        ) {

          doc.text(
            `Decisión: ${
              p.decision_reason
            }`
          );
        }


        doc.moveDown(0.7);
      }
    );


  doc.end();

  await done;

  return Buffer.concat(
    chunks
  );
}


/* =========================================================
   API
========================================================= */

exports.handler =
  async event => {

    const method =
      event.httpMethod;


    const path =
      event.path
        .replace(
          /^\/\.netlify\/functions\/api/,
          ''
        )
        .replace(
          /^\/api/,
          ''
        ) || '/';


    try {

      /* ===================================================
         CARGAR BASE DE DATOS
      =================================================== */

      const db =
        await loadDB();


      /* ===================================================
         CORS OPTIONS
      =================================================== */

      if (
        method === 'OPTIONS'
      ) {

        return json(
          200,
          {
            ok: true
          }
        );
      }


      /* ===================================================
         LOGIN
         PÚBLICO
      =================================================== */

      if (
        method === 'POST' &&
        path === '/login'
      ) {

        const {
          username,
          password
        } =
          parseBody(event);


        const a =
          db.admins.find(
            x =>
              x.username ===
              username
          );


        if (
          !a ||
          !bcrypt.compareSync(
            password || '',
            a.password
          )
        ) {

          return json(
            401,
            {
              error:
                'Usuario o contraseña incorrectos'
            }
          );
        }


        const token =
          jwt.sign(
            {
              id: a.id,
              username:
                a.username,
              name:
                a.name
            },

            SECRET,

            {
              expiresIn:
                '8h'
            }
          );


        return json(
          200,
          {
            token,

            user: {
              username:
                a.username,

              name:
                a.name
            }
          }
        );
      }


      /* ===================================================
         ===================================================
         RUTAS PÚBLICAS DEL FORMULARIO
         ===================================================
         =================================================== */


      /* ===================================================
         BUSCAR TRABAJADOR POR DNI
         
         GET:
         /public/worker?dni=12345678
         
         NO REQUIERE LOGIN
      =================================================== */

      if (
        method === 'GET' &&
        path === '/public/worker'
      ) {

        const dni =
          String(
            event
              .queryStringParameters
              ?.dni || ''
          ).trim();


        if (!dni) {

          return json(
            400,
            {
              error:
                'Debes enviar el DNI'
            }
          );
        }


        const worker =
          db.workers.find(
            w =>
              String(
                w.dni || ''
              ).trim() === dni &&

              w.status !==
                'Inactivo'
          );


        if (!worker) {

          return json(
            404,
            {
              error:
                'No se encontró un trabajador activo con ese DNI'
            }
          );
        }


        return json(
          200,
          {
            ok: true,

            worker: {

              id:
                worker.id,

              dni:
                worker.dni,

              names:
                worker.names,

              position:
                worker.position ||
                '',

              area:
                worker.area ||
                '',

              phone:
                worker.phone ||
                '',

              email:
                worker.email ||
                ''
            }
          }
        );
      }


      /* ===================================================
         CREAR PERMISO DESDE FORMULARIO PÚBLICO
         
         POST:
         /public/permissions
         
         NO REQUIERE LOGIN
      =================================================== */

      if (
        method === 'POST' &&
        path ===
          '/public/permissions'
      ) {

        const x =
          parseBody(event);


        const dni =
          String(
            x.dni || ''
          ).trim();


        /* -----------------------------------------------
           VALIDACIONES
        ------------------------------------------------ */

        if (!dni) {

          return json(
            400,
            {
              error:
                'El DNI es obligatorio'
            }
          );
        }


        if (!x.type) {

          return json(
            400,
            {
              error:
                'El tipo de permiso es obligatorio'
            }
          );
        }


        if (!x.date) {

          return json(
            400,
            {
              error:
                'La fecha es obligatoria'
            }
          );
        }


        /* -----------------------------------------------
           BUSCAR TRABAJADOR
        ------------------------------------------------ */

        const worker =
          db.workers.find(
            w =>
              String(
                w.dni || ''
              ).trim() === dni &&

              w.status !==
                'Inactivo'
          );


        if (!worker) {

          return json(
            404,
            {
              error:
                'No se encontró un trabajador activo con ese DNI'
            }
          );
        }


        /* -----------------------------------------------
           CREAR PERMISO
        ------------------------------------------------ */

        const p = {

          id:
            nextId(
              db,
              'permissions'
            ),

          worker_id:
            worker.id,

          type:
            x.type,

          date:
            x.date,

          exit_time:
            x.exit_time || '',

          return_time:
            x.return_time || '',

          reason:
            x.reason || '',

          observation:
            x.observation || '',

          document:
            x.document || '',

          status:
            'Pendiente',

          approved_by:
            '',

          approved_at:
            '',

          decision_reason:
            '',

          created_at:
            nowISO()
        };


        /* -----------------------------------------------
           GUARDAR
        ------------------------------------------------ */

        db.permissions.push(p);


        await saveDB(
          db
        );


        /* -----------------------------------------------
           RESPUESTA
        ------------------------------------------------ */

        return json(
          200,
          {

            ok: true,

            message:
              'Solicitud enviada correctamente',

            permission: {

              id:
                p.id,

              worker_id:
                p.worker_id,

              dni:
                worker.dni,

              names:
                worker.names,

              area:
                worker.area ||
                '',

              type:
                p.type,

              date:
                p.date,

              status:
                p.status
            }
          }
        );
      }


      /* ===================================================
         ===================================================
         DESDE AQUÍ TODO SIGUE PROTEGIDO
         ===================================================
         =================================================== */

      const user =
        auth(event);


      /* ===================================================
         ME
      =================================================== */

      if (
        method === 'GET' &&
        path === '/me'
      ) {

        return json(
          200,
          user
        );
      }


      /* ===================================================
         TRABAJADORES - LISTAR
      =================================================== */

      if (
        method === 'GET' &&
        path === '/workers'
      ) {

        const s =
          (
            event
              .queryStringParameters
              ?.search || ''
          ).toLowerCase();


        const rows =
          db.workers

            .filter(
              w =>
                !s ||
                [
                  w.dni,
                  w.names,
                  w.position,
                  w.area
                ].some(
                  v =>
                    String(
                      v || ''
                    )
                      .toLowerCase()
                      .includes(s)
                )
            )

            .sort(
              (a, b) =>
                a.names.localeCompare(
                  b.names
                )
            );


        return json(
          200,
          rows
        );
      }


      /* ===================================================
         TRABAJADORES - CREAR
      =================================================== */

      if (
        method === 'POST' &&
        path === '/workers'
      ) {

        const x =
          parseBody(event);


        if (
          !x.dni ||
          !x.names
        ) {

          return json(
            400,
            {
              error:
                'DNI y nombres son obligatorios'
            }
          );
        }


        if (
          db.workers.some(
            w =>
              w.dni ===
              x.dni
          )
        ) {

          return json(
            400,
            {
              error:
                'El DNI ya está registrado'
            }
          );
        }


        const w = {

          id:
            nextId(
              db,
              'workers'
            ),

          dni:
            x.dni,

          names:
            x.names,

          position:
            x.position ||
            '',

          area:
            x.area ||
            '',

          phone:
            x.phone ||
            '',

          email:
            x.email ||
            '',

          hire_date:
            x.hire_date ||
            '',

          status:
            x.status ||
            'Activo',

          photo:
            x.photo ||
            '',

          created_at:
            nowISO()
        };


        db.workers.push(
          w
        );


        await saveDB(
          db
        );


        return json(
          200,
          {
            ok: true,
            worker: w
          }
        );
      }


      /* ===================================================
         TRABAJADORES - EDITAR / ELIMINAR / HISTORIAL
      =================================================== */

      const wm =
        path.match(
          /^\/workers\/(\d+)(?:\/history)?$/
        );


      /* ===================================================
         EDITAR
      =================================================== */

      if (
        wm &&
        method === 'PUT' &&
        !path.endsWith(
          '/history'
        )
      ) {

        const id =
          +wm[1];


        const i =
          db.workers.findIndex(
            w =>
              w.id === id
          );


        if (i < 0) {

          return json(
            404,
            {
              error:
                'Trabajador no encontrado'
            }
          );
        }


        const x =
          parseBody(event);


        db.workers[i] = {

          ...db.workers[i],

          ...x,

          id
        };


        await saveDB(
          db
        );


        return json(
          200,
          {
            ok: true,

            worker:
              db.workers[i]
          }
        );
      }


      /* ===================================================
         ELIMINAR TRABAJADOR
         
         SE PASA A INACTIVO
      =================================================== */

      if (
        wm &&
        method === 'DELETE' &&
        !path.endsWith(
          '/history'
        )
      ) {

        const id =
          +wm[1];


        const worker =
          db.workers.find(
            w =>
              w.id === id
          );


        if (!worker) {

          return json(
            404,
            {
              error:
                'Trabajador no encontrado'
            }
          );
        }


        worker.status =
          'Inactivo';


        await saveDB(
          db
        );


        return json(
          200,
          {

            ok: true,

            message:
              'Trabajador eliminado correctamente',

            worker
          }
        );
      }


      /* ===================================================
         HISTORIAL
      =================================================== */

      if (
        wm &&
        method === 'GET' &&
        path.endsWith(
          '/history'
        )
      ) {

        const worker =
          db.workers.find(
            w =>
              w.id ===
              +wm[1]
          );


        if (!worker) {

          return json(
            404,
            {
              error:
                'Trabajador no encontrado'
            }
          );
        }


        return json(
          200,
          {

            worker,

            permissions:
              db.permissions

                .filter(
                  p =>
                    p.worker_id ===
                    worker.id
                )

                .sort(
                  (a, b) =>
                    String(
                      b.date
                    ).localeCompare(
                      String(
                        a.date
                      )
                    )
                ),

            attendance:
              db.attendance

                .filter(
                  a =>
                    a.worker_id ===
                    worker.id
                )

                .sort(
                  (a, b) =>
                    String(
                      b.date
                    ).localeCompare(
                      String(
                        a.date
                      )
                    )
                )
          }
        );
      }


      /* ===================================================
         PERMISOS - LISTAR
      =================================================== */

      if (
        method === 'GET' &&
        path === '/permissions'
      ) {

        const qp =
          event
            .queryStringParameters ||
          {};


        let rows =
          db.permissions.map(
            p =>
              enrichPermission(
                p,
                db
              )
          );


        if (qp.search) {

          const s =
            qp.search.toLowerCase();


          rows =
            rows.filter(
              p =>
                p.dni
                  .toLowerCase()
                  .includes(s) ||

                p.names
                  .toLowerCase()
                  .includes(s)
            );
        }


        if (qp.status) {

          rows =
            rows.filter(
              p =>
                p.status ===
                qp.status
            );
        }


        if (qp.type) {

          rows =
            rows.filter(
              p =>
                p.type ===
                qp.type
            );
        }


        if (qp.from) {

          rows =
            rows.filter(
              p =>
                p.date >=
                qp.from
            );
        }


        if (qp.to) {

          rows =
            rows.filter(
              p =>
                p.date <=
                qp.to
            );
        }


        rows.sort(
          (a, b) =>
            String(
              b.date
            ).localeCompare(
              String(
                a.date
              )
            ) ||
            b.id - a.id
        );


        return json(
          200,
          rows
        );
      }


      /* ===================================================
         PERMISOS - CREAR DESDE DASHBOARD
      =================================================== */

      if (
        method === 'POST' &&
        path === '/permissions'
      ) {

        const x =
          parseBody(event);


        if (
          !x.worker_id ||
          !x.type ||
          !x.date
        ) {

          return json(
            400,
            {
              error:
                'Trabajador, tipo y fecha son obligatorios'
            }
          );
        }


        const p = {

          id:
            nextId(
              db,
              'permissions'
            ),

          worker_id:
            +x.worker_id,

          type:
            x.type,

          date:
            x.date,

          exit_time:
            x.exit_time ||
            '',

          return_time:
            x.return_time ||
            '',

          reason:
            x.reason ||
            '',

          observation:
            x.observation ||
            '',

          document:
            x.document ||
            '',

          status:
            'Pendiente',

          approved_by:
            '',

          approved_at:
            '',

          decision_reason:
            '',

          created_at:
            nowISO()
        };


        db.permissions.push(
          p
        );


        await saveDB(
          db
        );


        return json(
          200,
          {
            ok: true,
            permission: p
          }
        );
      }


      /* ===================================================
         PERMISOS - CAMBIAR ESTADO
      =================================================== */

      const pm =
        path.match(
          /^\/permissions\/(\d+)\/status$/
        );


      if (
        pm &&
        method === 'PUT'
      ) {

        const p =
          db.permissions.find(
            x =>
              x.id ===
              +pm[1]
          );


        if (!p) {

          return json(
            404,
            {
              error:
                'Permiso no encontrado'
            }
          );
        }


        const {
          status,
          reason = ''
        } =
          parseBody(event);


        if (
          ![
            'Aprobado',
            'Rechazado',
            'Pendiente'
          ].includes(
            status
          )
        ) {

          return json(
            400,
            {
              error:
                'Estado inválido'
            }
          );
        }


        if (
          status ===
            'Rechazado' &&
          !String(
            reason
          ).trim()
        ) {

          return json(
            400,
            {
              error:
                'Debes indicar el motivo del rechazo'
            }
          );
        }


        p.status =
          status;


        p.approved_by =
          status ===
          'Pendiente'
            ? ''
            : user.name;


        p.approved_at =
          status ===
          'Pendiente'
            ? ''
            : nowISO();


        p.decision_reason =
          String(
            reason || ''
          );


        db.signatures.push({

          id:
            nextId(
              db,
              'signatures'
            ),

          permission_id:
            p.id,

          signer:
            user.name,

          action:
            status,

          signed_at:
            nowISO()
        });


        await saveDB(
          db
        );


        return json(
          200,
          {
            ok: true
          }
        );
      }


      /* ===================================================
         ASISTENCIA - LISTAR
      =================================================== */

      if (
        method === 'GET' &&
        path === '/attendance'
      ) {

        const qp =
          event
            .queryStringParameters ||
          {};


        let rows =
          db.attendance.map(
            a => {

              const w =
                db.workers.find(
                  x =>
                    x.id ===
                    a.worker_id
                ) || {};


              return {

                ...a,

                names:
                  w.names ||
                  '',

                dni:
                  w.dni ||
                  '',

                area:
                  w.area ||
                  '',

                position:
                  w.position ||
                  ''
              };
            }
          );


        if (qp.date) {

          rows =
            rows.filter(
              a =>
                a.date ===
                qp.date
            );
        }


        if (qp.worker_id) {

          rows =
            rows.filter(
              a =>
                a.worker_id ===
                +qp.worker_id
            );
        }


        rows.sort(
          (a, b) =>
            String(
              b.date
            ).localeCompare(
              String(
                a.date
              )
            ) ||

            a.names.localeCompare(
              b.names
            )
        );


        return json(
          200,
          rows
        );
      }


      /* ===================================================
         ASISTENCIA - GUARDAR
      =================================================== */

      if (
        method === 'POST' &&
        path === '/attendance'
      ) {

        const x =
          parseBody(event);


        let a =
          db.attendance.find(
            v =>
              v.worker_id ===
                +x.worker_id &&

              v.date ===
                x.date
          );


        if (!a) {

          a = {

            id:
              nextId(
                db,
                'attendance'
              ),

            worker_id:
              +x.worker_id,

            date:
              x.date
          };


          db.attendance.push(
            a
          );
        }


        Object.assign(
          a,
          {

            entry_time:
              x.entry_time ||
              '',

            exit_time:
              x.exit_time ||
              '',

            status:
              x.status ||
              'Presente',

            late_minutes:
              Number(
                x.late_minutes
              ) || 0,

            justification:
              x.justification ||
              '',

            observation:
              x.observation ||
              ''
          }
        );


        await saveDB(
          db
        );


        return json(
          200,
          {
            ok: true
          }
        );
      }


      /* ===================================================
         NOTIFICACIONES
      =================================================== */

      if (
        method === 'GET' &&
        path ===
          '/notifications'
      ) {

        const latest =
          db.permissions

            .filter(
              p =>
                p.status ===
                'Pendiente'
            )

            .sort(
              (a, b) =>
                String(
                  b.created_at
                ).localeCompare(
                  String(
                    a.created_at
                  )
                )
            )

            .slice(
              0,
              8
            )

            .map(
              p => {

                const x =
                  enrichPermission(
                    p,
                    db
                  );


                return {

                  id:
                    p.id,

                  date:
                    p.date,

                  type:
                    p.type,

                  created_at:
                    p.created_at,

                  names:
                    x.names,

                  dni:
                    x.dni
                };
              }
            );


        return json(
          200,
          {

            pending:
              db.permissions.filter(
                p =>
                  p.status ===
                  'Pendiente'
              ).length,

            latest
          }
        );
      }


      /* ===================================================
         DASHBOARD
      =================================================== */

      if (
        method === 'GET' &&
        path === '/dashboard'
      ) {

        const now =
          new Date();


        const iso =
          now
            .toISOString()
            .slice(
              0,
              10
            );


        const month =
          iso.slice(
            0,
            7
          );


        const weekStart =
          new Date(
            now
          );


        weekStart.setDate(
          now.getDate() -
          6
        );


        const ws =
          weekStart
            .toISOString()
            .slice(
              0,
              10
            );


        const active =
          db.workers.filter(
            w =>
              w.status ===
              'Activo'
          ).length;


        const inactive =
          db.workers.filter(
            w =>
              w.status ===
              'Inactivo'
          ).length;


        const permissions =
          db.permissions;


        const byType =
          {};


        permissions.forEach(
          p =>
            byType[p.type] =
              (byType[p.type] || 0) +
              1
        );


        const ranking =
          {};


        permissions.forEach(
          p => {

            const w =
              db.workers.find(
                x =>
                  x.id ===
                  p.worker_id
              );


            if (w) {

              ranking[w.id] =
                (ranking[w.id] || 0) +
                1;
            }
          }
        );


        return json(
          200,
          {

            totalWorkers:
              active,

            inactive,

            permissions:
              permissions.length,

            pending:
              permissions.filter(
                p =>
                  p.status ===
                  'Pendiente'
              ).length,

            late:
              db.attendance.filter(
                a =>
                  a.date >= ws &&
                  Number(
                    a.late_minutes
                  ) > 0
              ).length,

            today:
              permissions.filter(
                p =>
                  p.date ===
                  iso
              ).length,

            weekly:
              permissions.filter(
                p =>
                  p.date >= ws
              ).length,

            monthly:
              permissions.filter(
                p =>
                  String(
                    p.date
                  ).startsWith(
                    month
                  )
              ).length,

            approved:
              permissions.filter(
                p =>
                  p.status ===
                  'Aprobado'
              ).length,

            byType:
              Object.entries(
                byType
              ).map(
                ([type, total]) => ({
                  type,
                  total
                })
              ),

            ranking:
              Object.entries(
                ranking
              )

              .map(
                ([id, total]) => {

                  const w =
                    db.workers.find(
                      x =>
                        x.id ===
                        +id
                    ) || {};


                  return {

                    names:
                      w.names ||
                      '',

                    area:
                      w.area ||
                      '',

                    total
                  };
                }
              )

              .sort(
                (a, b) =>
                  b.total -
                  a.total
              )
          }
        );
      }


      /* ===================================================
         REPORTE EXCEL
      =================================================== */

      if (
        method === 'GET' &&
        path ===
          '/reports/excel'
      ) {

        const b =
          await reportExcel(
            db
          );


        return {

          statusCode:
            200,

          isBase64Encoded:
            true,

          headers: {

            'Content-Type':
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

            'Content-Disposition':
              'attachment; filename="Reporte_Permisos.xlsx"'
          },

          body:
            b.toString(
              'base64'
            )
        };
      }


      /* ===================================================
         REPORTE PDF
      =================================================== */

      if (
        method === 'GET' &&
        path ===
          '/reports/pdf'
      ) {

        const b =
          await reportPDF(
            db
          );


        return {

          statusCode:
            200,

          isBase64Encoded:
            true,

          headers: {

            'Content-Type':
              'application/pdf',

            'Content-Disposition':
              'attachment; filename="Reporte_Permisos.pdf"'
          },

          body:
            b.toString(
              'base64'
            )
        };
      }


      /* ===================================================
         RUTA NO ENCONTRADA
      =================================================== */

      return json(
        404,
        {
          error:
            'Ruta no encontrada'
        }
      );


    } catch (e) {

      console.error(e);


      return json(
        e.statusCode ||
          500,

        {
          error:
            e.message ||
            'Error interno'
        }
      );
    }
  };
