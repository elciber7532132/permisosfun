const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Pool } = require('pg');

const SECRET =
  process.env.JWT_SECRET || 'cambia-esta-clave-en-produccion';

const DB_FILE =
  process.env.DB_FILE ||
  path.join(__dirname, '../../data/empresarial.json');

/*
|--------------------------------------------------------------------------
| POSTGRESQL
|--------------------------------------------------------------------------
| Render debe tener:
|
| DATABASE_URL = Internal Database URL
|
| La aplicación utiliza un schema exclusivo:
|
| permisosfun
|
| para no tocar las tablas de otros sistemas.
|--------------------------------------------------------------------------
*/

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

/*
|--------------------------------------------------------------------------
| BASE DE DATOS INICIAL
|--------------------------------------------------------------------------
*/

function createEmptyDB() {
  return {
    admins: [],
    workers: [],
    permissions: [],
    attendance: [],
    signatures: [],
    counters: {
      workers: 0,
      permissions: 0,
      attendance: 0,
      signatures: 0,
    },
  };
}

/*
|--------------------------------------------------------------------------
| CREAR TABLA POSTGRESQL
|--------------------------------------------------------------------------
*/

let databaseReady = false;

async function ensurePostgres() {
  if (databaseReady) return;

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL no está configurada en las variables de entorno.'
    );
  }

  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS permisosfun
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS permisosfun.app_state (
      id INTEGER PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  databaseReady = true;
}

/*
|--------------------------------------------------------------------------
| CARGAR BASE DE DATOS
|--------------------------------------------------------------------------
*/

async function loadDB() {
  await ensurePostgres();

  const result = await pool.query(`
    SELECT data
    FROM permisosfun.app_state
    WHERE id = 1
    LIMIT 1
  `);

  if (result.rows.length > 0) {
    const db = result.rows[0].data;

    if (!db.admins) db.admins = [];
    if (!db.workers) db.workers = [];
    if (!db.permissions) db.permissions = [];
    if (!db.attendance) db.attendance = [];
    if (!db.signatures) db.signatures = [];

    if (!db.counters) {
      db.counters = {
        workers: 0,
        permissions: 0,
        attendance: 0,
        signatures: 0,
      };
    }

    return db;
  }

  /*
  |--------------------------------------------------------------------------
  | SI TODAVÍA NO EXISTE INFORMACIÓN EN POSTGRESQL
  |--------------------------------------------------------------------------
  | Se intenta recuperar el JSON local solamente como migración inicial.
  |--------------------------------------------------------------------------
  */

  let db = null;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');

      if (raw.trim()) {
        db = JSON.parse(raw);
      }
    }
  } catch (error) {
    console.log(
      'No se pudo leer el archivo JSON anterior:',
      error.message
    );
  }

  if (!db) {
    db = createEmptyDB();
  }

  if (!db.admins) db.admins = [];
  if (!db.workers) db.workers = [];
  if (!db.permissions) db.permissions = [];
  if (!db.attendance) db.attendance = [];
  if (!db.signatures) db.signatures = [];

  if (!db.counters) {
    db.counters = {
      workers: 0,
      permissions: 0,
      attendance: 0,
      signatures: 0,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | ADMINISTRADOR INICIAL
  |--------------------------------------------------------------------------
  */

  if (!Array.isArray(db.admins)) {
    db.admins = [];
  }

  if (db.admins.length === 0) {
    db.admins.push({
      id: 1,
      username: 'admin',
      password: bcrypt.hashSync('admin123', 10),
      name: 'Administrador',
    });
  }

  /*
  |--------------------------------------------------------------------------
  | GUARDAR ESTADO INICIAL EN POSTGRESQL
  |--------------------------------------------------------------------------
  */

  await pool.query(
    `
    INSERT INTO permisosfun.app_state
      (id, data, updated_at)
    VALUES
      (1, $1::jsonb, NOW())
    ON CONFLICT (id)
    DO NOTHING
    `,
    [JSON.stringify(db)]
  );

  return db;
}

/*
|--------------------------------------------------------------------------
| GUARDAR EN POSTGRESQL
|--------------------------------------------------------------------------
*/

async function saveDB(db) {
  await ensurePostgres();

  await pool.query(
    `
    INSERT INTO permisosfun.app_state
      (id, data, updated_at)
    VALUES
      (1, $1::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW()
    `,
    [JSON.stringify(db)]
  );
}

/*
|--------------------------------------------------------------------------
| GENERAR ID
|--------------------------------------------------------------------------
*/

function nextId(db, type) {
  if (!db.counters) {
    db.counters = {};
  }

  if (!db.counters[type]) {
    db.counters[type] = 0;
  }

  db.counters[type]++;

  return db.counters[type];
}

/*
|--------------------------------------------------------------------------
| RESPUESTA JSON
|--------------------------------------------------------------------------
*/

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization',
      'Access-Control-Allow-Methods':
        'GET, POST, PUT, DELETE, OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

/*
|--------------------------------------------------------------------------
| AUTENTICACIÓN
|--------------------------------------------------------------------------
*/

function auth(event) {
  const headers = event.headers || {};

  const authorization =
    headers.authorization ||
    headers.Authorization ||
    '';

  if (!authorization.startsWith('Bearer ')) {
    return {
      error: json(401, {
        error: 'No autorizado',
      }),
    };
  }

  const token = authorization.substring(7);

  try {
    const user = jwt.verify(token, SECRET);

    return {
      user,
    };
  } catch (error) {
    return {
      error: json(401, {
        error: 'Sesión expirada',
      }),
    };
  }
}

/*
|--------------------------------------------------------------------------
| BODY
|--------------------------------------------------------------------------
*/

function parseBody(event) {
  if (!event.body) return {};

  try {
    if (event.isBase64Encoded) {
      return JSON.parse(
        Buffer.from(event.body, 'base64').toString('utf8')
      );
    }

    if (typeof event.body === 'string') {
      return JSON.parse(event.body);
    }

    return event.body;
  } catch (error) {
    return {};
  }
}

/*
|--------------------------------------------------------------------------
| FECHA
|--------------------------------------------------------------------------
*/

function qDate(value) {
  if (!value) return '';

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 10);
  }

  return d.toISOString().slice(0, 10);
}

/*
|--------------------------------------------------------------------------
| FECHA/HORA ACTUAL
|--------------------------------------------------------------------------
*/

function nowISO() {
  return new Date().toISOString();
}

/*
|--------------------------------------------------------------------------
| VALIDAR DOCUMENTO
|--------------------------------------------------------------------------
*/

function validateDocument(x) {
  if (!x) {
    return {
      document: '',
      document_name: '',
      document_type: '',
    };
  }

  if (typeof x !== 'string') {
    throw new Error('Documento inválido.');
  }

  const match = x.match(
    /^data:(image\/jpeg|image\/png|application\/pdf);base64,(.+)$/s
  );

  if (!match) {
    throw new Error(
      'El documento debe ser JPG, PNG o PDF.'
    );
  }

  const mime = match[1];
  const base64 = match[2];

  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length > 4 * 1024 * 1024) {
    throw new Error(
      'El documento no puede superar los 4 MB.'
    );
  }

  return {
    document: x,
    document_name: '',
    document_type: mime,
  };
}

/*
|--------------------------------------------------------------------------
| ENRIQUECER PERMISO
|--------------------------------------------------------------------------
*/

function enrichPermission(permission, db) {
  const worker = db.workers.find(
    w => Number(w.id) === Number(permission.worker_id)
  );

  return {
    ...permission,

    worker: worker || null,

    worker_name: worker
      ? worker.names || worker.name || ''
      : '',

    worker_dni: worker
      ? worker.dni || ''
      : '',

    worker_area: worker
      ? worker.area || ''
      : '',

    worker_position: worker
      ? worker.position || worker.cargo || ''
      : '',
  };
}

/*
|--------------------------------------------------------------------------
| EXCEL
|--------------------------------------------------------------------------
*/

async function reportExcel(db) {
  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet(
    'Solicitudes'
  );

  sheet.columns = [
    {
      header: 'ID',
      key: 'id',
      width: 10,
    },
    {
      header: 'DNI',
      key: 'dni',
      width: 15,
    },
    {
      header: 'Trabajador',
      key: 'worker',
      width: 30,
    },
    {
      header: 'Área',
      key: 'area',
      width: 20,
    },
    {
      header: 'Cargo',
      key: 'position',
      width: 25,
    },
    {
      header: 'Tipo',
      key: 'type',
      width: 20,
    },
    {
      header: 'Fecha',
      key: 'date',
      width: 15,
    },
    {
      header: 'Hora salida',
      key: 'exit_time',
      width: 15,
    },
    {
      header: 'Hora retorno',
      key: 'return_time',
      width: 15,
    },
    {
      header: 'Motivo',
      key: 'reason',
      width: 40,
    },
    {
      header: 'Observación',
      key: 'observation',
      width: 40,
    },
    {
      header: 'Estado',
      key: 'status',
      width: 15,
    },
    {
      header: 'Fecha solicitud',
      key: 'created_at',
      width: 25,
    },
  ];

  for (const p of db.permissions) {
    const worker = db.workers.find(
      w => Number(w.id) === Number(p.worker_id)
    );

    sheet.addRow({
      id: p.id,
      dni: worker?.dni || '',
      worker:
        worker?.names ||
        worker?.name ||
        '',
      area: worker?.area || '',
      position:
        worker?.position ||
        worker?.cargo ||
        '',
      type: p.type || '',
      date: p.date || '',
      exit_time: p.exit_time || '',
      return_time: p.return_time || '',
      reason: p.reason || '',
      observation: p.observation || '',
      status: p.status || '',
      created_at: p.created_at || '',
    });
  }

  return workbook.xlsx.writeBuffer();
}

/*
|--------------------------------------------------------------------------
| PDF
|--------------------------------------------------------------------------
*/

function reportPDF(db) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 40,
      size: 'A4',
    });

    const chunks = [];

    doc.on('data', chunk => {
      chunks.push(chunk);
    });

    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    doc.on('error', reject);

    doc
      .fontSize(18)
      .text(
        'Reporte de Solicitudes de Permiso',
        {
          align: 'center',
        }
      );

    doc.moveDown();

    for (const p of db.permissions) {
      const worker = db.workers.find(
        w =>
          Number(w.id) ===
          Number(p.worker_id)
      );

      doc
        .fontSize(10)
        .text(
          `Solicitud #${p.id}`
        );

      doc.text(
        `Trabajador: ${
          worker?.names ||
          worker?.name ||
          ''
        }`
      );

      doc.text(
        `DNI: ${
          worker?.dni || ''
        }`
      );

      doc.text(
        `Área: ${
          worker?.area || ''
        }`
      );

      doc.text(
        `Cargo: ${
          worker?.position ||
          worker?.cargo ||
          ''
        }`
      );

      doc.text(
        `Tipo: ${p.type || ''}`
      );

      doc.text(
        `Fecha: ${p.date || ''}`
      );

      doc.text(
        `Salida: ${
          p.exit_time || ''
        }`
      );

      doc.text(
        `Retorno: ${
          p.return_time || ''
        }`
      );

      doc.text(
        `Motivo: ${
          p.reason || ''
        }`
      );

      doc.text(
        `Estado: ${
          p.status || ''
        }`
      );

      doc.moveDown();

      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();

      doc.moveDown();
    }

    doc.end();
  });
}

/*
|--------------------------------------------------------------------------
| HANDLER
|--------------------------------------------------------------------------
*/

async function handler(event) {
  try {
    let requestPath =
      event.path ||
      event.rawPath ||
      '/';

    /*
     * Normalizar rutas Netlify /api
     */

    requestPath = requestPath
      .replace(
        '/.netlify/functions/api',
        ''
      )
      .replace(/^\/api/, '');

    if (!requestPath) {
      requestPath = '/';
    }

    if (!requestPath.startsWith('/')) {
      requestPath =
        '/' + requestPath;
    }

    const method =
      event.httpMethod ||
      event.requestContext?.http?.method ||
      'GET';

    /*
    |--------------------------------------------------------------------------
    | CORS OPTIONS
    |--------------------------------------------------------------------------
    */

    if (method === 'OPTIONS') {
      return json(200, {
        ok: true,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CARGAR POSTGRESQL
    |--------------------------------------------------------------------------
    */

    const db = await loadDB();

    /*
    |--------------------------------------------------------------------------
    | LOGIN
    |--------------------------------------------------------------------------
    */

    if (
      method === 'POST' &&
      requestPath === '/login'
    ) {
      const body = parseBody(event);

      const username =
        String(
          body.username || ''
        ).trim();

      const password =
        String(
          body.password || ''
        );

      const admin =
        db.admins.find(
          a =>
            String(
              a.username
            ).toLowerCase() ===
            username.toLowerCase()
        );

      if (!admin) {
        return json(401, {
          error:
            'Usuario o contraseña incorrectos.',
        });
      }

      const valid =
        await bcrypt.compare(
          password,
          admin.password
        );

      if (!valid) {
        return json(401, {
          error:
            'Usuario o contraseña incorrectos.',
        });
      }

      const token =
        jwt.sign(
          {
            id: admin.id,
            username:
              admin.username,
            name:
              admin.name,
            role: 'admin',
          },
          SECRET,
          {
            expiresIn: '8h',
          }
        );

      return json(200, {
        ok: true,
        token,
        user: {
          id: admin.id,
          username:
            admin.username,
          name:
            admin.name,
          role: 'admin',
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CONSULTAR TRABAJADOR DESDE FORMULARIO PÚBLICO
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/public/worker'
    ) {
      const dni =
        String(
          event.queryStringParameters
            ?.dni || ''
        ).trim();

      if (!dni) {
        return json(400, {
          error:
            'DNI requerido.',
        });
      }

      const worker =
        db.workers.find(
          w =>
            String(
              w.dni || ''
            ).trim() === dni &&
            w.active !== false
        );

      if (!worker) {
        return json(404, {
          ok: false,
          found: false,
          error:
            'Trabajador no encontrado.',
        });
      }

      return json(200, {
        ok: true,
        found: true,
        worker: {
          id: worker.id,
          dni: worker.dni,
          names:
            worker.names ||
            worker.name ||
            '',
          position:
            worker.position ||
            worker.cargo ||
            '',
          area:
            worker.area || '',
          phone:
            worker.phone || '',
          email:
            worker.email || '',
        },
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREAR SOLICITUD PÚBLICA
    |--------------------------------------------------------------------------
    */

    if (
      method === 'POST' &&
      requestPath ===
        '/public/permissions'
    ) {
      const body = parseBody(event);

      const dni =
        String(
          body.dni || ''
        ).trim();

      const type =
        String(
          body.type || ''
        ).trim();

      const date =
        qDate(body.date);

      if (!dni) {
        return json(400, {
          error:
            'DNI requerido.',
        });
      }

      if (!type) {
        return json(400, {
          error:
            'Tipo de permiso requerido.',
        });
      }

      if (!date) {
        return json(400, {
          error:
            'Fecha requerida.',
        });
      }

      const worker =
        db.workers.find(
          w =>
            String(
              w.dni || ''
            ).trim() === dni &&
            w.active !== false
        );

      if (!worker) {
        return json(404, {
          error:
            'No se encontró un trabajador activo con ese DNI.',
        });
      }

      /*
      |--------------------------------------------------------------------------
      | DOCUMENTO
      |--------------------------------------------------------------------------
      */

      let documentData;

      try {
        documentData =
          validateDocument(
            body.document
          );
      } catch (error) {
        return json(400, {
          error:
            error.message,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | ID
      |--------------------------------------------------------------------------
      */

      const id =
        nextId(
          db,
          'permissions'
        );

      const permission = {
        id,

        worker_id:
          worker.id,

        type,

        date,

        exit_time:
          body.exit_time ||
          '',

        return_time:
          body.return_time ||
          '',

        reason:
          body.reason ||
          '',

        observation:
          body.observation ||
          '',

        document:
          documentData.document,

        document_name:
          body.document_name ||
          '',

        document_type:
          documentData.document_type,

        status:
          'Pendiente',

        approved_by:
          '',

        approved_at:
          '',

        decision_reason:
          '',

        created_at:
          nowISO(),
      };

      db.permissions.push(
        permission
      );

      await saveDB(db);

      return json(201, {
        ok: true,
        message:
          'Solicitud registrada correctamente.',
        permission:
          enrichPermission(
            permission,
            db
          ),
        numeroSolicitud:
          id,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DESDE AQUÍ TODAS LAS RUTAS REQUIEREN LOGIN
    |--------------------------------------------------------------------------
    */

    const authentication =
      auth(event);

    if (authentication.error) {
      return authentication.error;
    }

    const user =
      authentication.user;

    /*
    |--------------------------------------------------------------------------
    | ME
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath === '/me'
    ) {
      return json(200, {
        ok: true,
        user,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | WORKERS - LISTAR
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath === '/workers'
    ) {
      const params =
        event.queryStringParameters ||
        {};

      const search =
        String(
          params.search || ''
        )
          .trim()
          .toLowerCase();

      let workers =
        [...db.workers];

      if (search) {
        workers =
          workers.filter(w =>
            [
              w.dni,
              w.names,
              w.name,
              w.area,
              w.position,
              w.cargo,
              w.phone,
              w.email,
            ]
              .filter(Boolean)
              .some(value =>
                String(value)
                  .toLowerCase()
                  .includes(search)
              )
          );
      }

      return json(200, {
        ok: true,
        workers,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREAR WORKER
    |--------------------------------------------------------------------------
    */

    if (
      method === 'POST' &&
      requestPath === '/workers'
    ) {
      const body =
        parseBody(event);

      const dni =
        String(
          body.dni || ''
        ).trim();

      const names =
        String(
          body.names ||
          body.name ||
          ''
        ).trim();

      if (!dni || !names) {
        return json(400, {
          error:
            'DNI y nombres son obligatorios.',
        });
      }

      const duplicate =
        db.workers.find(
          w =>
            String(
              w.dni || ''
            ).trim() === dni
        );

      if (duplicate) {
        return json(409, {
          error:
            'Ya existe un trabajador con ese DNI.',
        });
      }

      const worker = {
        id: nextId(
          db,
          'workers'
        ),

        dni,

        names,

        name: names,

        area:
          body.area || '',

        position:
          body.position ||
          body.cargo ||
          '',

        cargo:
          body.cargo ||
          body.position ||
          '',

        phone:
          body.phone || '',

        email:
          body.email || '',

        active:
          body.active !== false,

        created_at:
          nowISO(),
      };

      db.workers.push(
        worker
      );

      await saveDB(db);

      return json(201, {
        ok: true,
        worker,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | EDITAR WORKER
    |--------------------------------------------------------------------------
    */

    if (
      method === 'PUT' &&
      /^\/workers\/\d+$/.test(
        requestPath
      )
    ) {
      const id =
        Number(
          requestPath.split('/')[2]
        );

      const worker =
        db.workers.find(
          w =>
            Number(w.id) === id
        );

      if (!worker) {
        return json(404, {
          error:
            'Trabajador no encontrado.',
        });
      }

      const body =
        parseBody(event);

      if (body.dni !== undefined) {
        worker.dni =
          String(
            body.dni
          ).trim();
      }

      if (
        body.names !== undefined ||
        body.name !== undefined
      ) {
        worker.names =
          String(
            body.names ??
              body.name ??
              ''
          ).trim();

        worker.name =
          worker.names;
      }

      if (
        body.area !== undefined
      ) {
        worker.area =
          body.area;
      }

      if (
        body.position !==
          undefined ||
        body.cargo !== undefined
      ) {
        worker.position =
          body.position ??
          body.cargo ??
          '';

        worker.cargo =
          body.cargo ??
          body.position ??
          '';
      }

      if (
        body.phone !==
        undefined
      ) {
        worker.phone =
          body.phone;
      }

      if (
        body.email !==
        undefined
      ) {
        worker.email =
          body.email;
      }

      if (
        body.active !==
        undefined
      ) {
        worker.active =
          Boolean(
            body.active
          );
      }

      await saveDB(db);

      return json(200, {
        ok: true,
        worker,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ELIMINAR WORKER
    |--------------------------------------------------------------------------
    */

    if (
      method === 'DELETE' &&
      /^\/workers\/\d+$/.test(
        requestPath
      )
    ) {
      const id =
        Number(
          requestPath.split('/')[2]
        );

      const index =
        db.workers.findIndex(
          w =>
            Number(w.id) === id
        );

      if (index === -1) {
        return json(404, {
          error:
            'Trabajador no encontrado.',
        });
      }

      db.workers.splice(
        index,
        1
      );

      db.permissions =
        db.permissions.filter(
          p =>
            Number(
              p.worker_id
            ) !== id
        );

      db.attendance =
        db.attendance.filter(
          a =>
            Number(
              a.worker_id
            ) !== id
        );

      db.signatures =
        db.signatures.filter(
          s =>
            Number(
              s.worker_id
            ) !== id
        );

      await saveDB(db);

      return json(200, {
        ok: true,
        message:
          'Trabajador eliminado correctamente.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | HISTORIAL WORKER
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      /^\/workers\/\d+\/history$/.test(
        requestPath
      )
    ) {
      const id =
        Number(
          requestPath.split('/')[2]
        );

      const worker =
        db.workers.find(
          w =>
            Number(w.id) === id
        );

      if (!worker) {
        return json(404, {
          error:
            'Trabajador no encontrado.',
        });
      }

      const permissions =
        db.permissions
          .filter(
            p =>
              Number(
                p.worker_id
              ) === id
          )
          .map(p =>
            enrichPermission(
              p,
              db
            )
          );

      const attendance =
        db.attendance.filter(
          a =>
            Number(
              a.worker_id
            ) === id
        );

      return json(200, {
        ok: true,
        worker,
        permissions,
        attendance,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | PERMISSIONS - LISTAR
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/permissions'
    ) {
      const params =
        event.queryStringParameters ||
        {};

      const search =
        String(
          params.search || ''
        )
          .trim()
          .toLowerCase();

      const status =
        String(
          params.status || ''
        ).trim();

      const type =
        String(
          params.type || ''
        ).trim();

      const from =
        qDate(params.from);

      const to =
        qDate(params.to);

      let permissions =
        db.permissions.map(
          p =>
            enrichPermission(
              p,
              db
            )
        );

      if (search) {
        permissions =
          permissions.filter(
            p =>
              [
                p.worker_name,
                p.worker_dni,
                p.worker_area,
                p.worker_position,
                p.type,
                p.reason,
                p.observation,
              ]
                .filter(Boolean)
                .some(value =>
                  String(value)
                    .toLowerCase()
                    .includes(search)
                )
          );
      }

      if (status) {
        permissions =
          permissions.filter(
            p =>
              String(
                p.status
              ) === status
          );
      }

      if (type) {
        permissions =
          permissions.filter(
            p =>
              String(
                p.type
              ) === type
          );
      }

      if (from) {
        permissions =
          permissions.filter(
            p =>
              qDate(p.date) >=
              from
          );
      }

      if (to) {
        permissions =
          permissions.filter(
            p =>
              qDate(p.date) <=
              to
          );
      }

      permissions.sort(
        (a, b) =>
          new Date(
            b.created_at || 0
          ) -
          new Date(
            a.created_at || 0
          )
      );

      return json(200, {
        ok: true,
        permissions,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CREAR PERMISSION DESDE DASHBOARD
    |--------------------------------------------------------------------------
    */

    if (
      method === 'POST' &&
      requestPath ===
        '/permissions'
    ) {
      const body =
        parseBody(event);

      const workerId =
        Number(
          body.worker_id
        );

      const worker =
        db.workers.find(
          w =>
            Number(w.id) ===
            workerId
        );

      if (!worker) {
        return json(404, {
          error:
            'Trabajador no encontrado.',
        });
      }

      let documentData;

      try {
        documentData =
          validateDocument(
            body.document
          );
      } catch (error) {
        return json(400, {
          error:
            error.message,
        });
      }

      const permission = {
        id: nextId(
          db,
          'permissions'
        ),

        worker_id:
          workerId,

        type:
          body.type || '',

        date:
          qDate(body.date),

        exit_time:
          body.exit_time ||
          '',

        return_time:
          body.return_time ||
          '',

        reason:
          body.reason ||
          '',

        observation:
          body.observation ||
          '',

        document:
          documentData.document,

        document_name:
          body.document_name ||
          '',

        document_type:
          documentData.document_type,

        status:
          body.status ||
          'Pendiente',

        approved_by:
          '',

        approved_at:
          '',

        decision_reason:
          '',

        created_at:
          nowISO(),
      };

      db.permissions.push(
        permission
      );

      await saveDB(db);

      return json(201, {
        ok: true,
        permission:
          enrichPermission(
            permission,
            db
          ),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ELIMINAR PERMISSION
    |--------------------------------------------------------------------------
    */

    if (
      method === 'DELETE' &&
      /^\/permissions\/\d+$/.test(
        requestPath
      )
    ) {
      const id =
        Number(
          requestPath.split('/')[2]
        );

      const index =
        db.permissions.findIndex(
          p =>
            Number(p.id) === id
        );

      if (index === -1) {
        return json(404, {
          error:
            'Solicitud no encontrada.',
        });
      }

      db.permissions.splice(
        index,
        1
      );

      db.signatures =
        db.signatures.filter(
          s =>
            Number(
              s.permission_id
            ) !== id
        );

      await saveDB(db);

      return json(200, {
        ok: true,
        message:
          'Solicitud eliminada correctamente.',
      });
    }

    /*
    |--------------------------------------------------------------------------
    | CAMBIAR ESTADO DE PERMISSION
    |--------------------------------------------------------------------------
    */

    if (
      method === 'PUT' &&
      /^\/permissions\/\d+\/status$/.test(
        requestPath
      )
    ) {
      const id =
        Number(
          requestPath.split('/')[2]
        );

      const permission =
        db.permissions.find(
          p =>
            Number(p.id) === id
        );

      if (!permission) {
        return json(404, {
          error:
            'Solicitud no encontrada.',
        });
      }

      const body =
        parseBody(event);

      const newStatus =
        String(
          body.status || ''
        ).trim();

      if (
        ![
          'Pendiente',
          'Aprobado',
          'Rechazado',
        ].includes(
          newStatus
        )
      ) {
        return json(400, {
          error:
            'Estado inválido.',
        });
      }

      if (
        newStatus ===
          'Rechazado' &&
        !String(
          body.reason ||
            body.decision_reason ||
            ''
        ).trim()
      ) {
        return json(400, {
          error:
            'Debe indicar el motivo del rechazo.',
        });
      }

      permission.status =
        newStatus;

      permission.decision_reason =
        String(
          body.reason ||
            body.decision_reason ||
            ''
        ).trim();

      if (
        newStatus ===
          'Pendiente'
      ) {
        permission.approved_by =
          '';

        permission.approved_at =
          '';
      } else {
        permission.approved_by =
          user.name ||
          user.username ||
          '';

        permission.approved_at =
          nowISO();
      }

      /*
      |--------------------------------------------------------------------------
      | FIRMA
      |--------------------------------------------------------------------------
      */

      if (
        newStatus ===
          'Aprobado' ||
        newStatus ===
          'Rechazado'
      ) {
        const signature = {
          id: nextId(
            db,
            'signatures'
          ),

          permission_id:
            permission.id,

          user_id:
            user.id,

          user_name:
            user.name ||
            user.username ||
            '',

          status:
            newStatus,

          reason:
            permission.decision_reason ||
            '',

          created_at:
            nowISO(),
        };

        db.signatures.push(
          signature
        );
      }

      await saveDB(db);

      return json(200, {
        ok: true,
        permission:
          enrichPermission(
            permission,
            db
          ),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ATTENDANCE - LISTAR
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/attendance'
    ) {
      const params =
        event.queryStringParameters ||
        {};

      const date =
        qDate(params.date);

      let attendance =
        [...db.attendance];

      if (date) {
        attendance =
          attendance.filter(
            a =>
              qDate(a.date) ===
              date
          );
      }

      attendance =
        attendance.map(a => {
          const worker =
            db.workers.find(
              w =>
                Number(w.id) ===
                Number(
                  a.worker_id
                )
            );

          return {
            ...a,
            worker:
              worker || null,
          };
        });

      return json(200, {
        ok: true,
        attendance,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | ATTENDANCE - CREAR
    |--------------------------------------------------------------------------
    */

    if (
      method === 'POST' &&
      requestPath ===
        '/attendance'
    ) {
      const body =
        parseBody(event);

      const workerId =
        Number(
          body.worker_id
        );

      const worker =
        db.workers.find(
          w =>
            Number(w.id) ===
            workerId
        );

      if (!worker) {
        return json(404, {
          error:
            'Trabajador no encontrado.',
        });
      }

      const attendance = {
        id: nextId(
          db,
          'attendance'
        ),

        worker_id:
          workerId,

        date:
          qDate(
            body.date
          ) ||
          qDate(
            nowISO()
          ),

        entry_time:
          body.entry_time ||
          '',

        exit_time:
          body.exit_time ||
          '',

        status:
          body.status ||
          'Presente',

        observation:
          body.observation ||
          '',

        created_at:
          nowISO(),
      };

      db.attendance.push(
        attendance
      );

      await saveDB(db);

      return json(201, {
        ok: true,
        attendance,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | NOTIFICACIONES
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/notifications'
    ) {
      const pending =
        db.permissions.filter(
          p =>
            p.status ===
            'Pendiente'
        );

      return json(200, {
        ok: true,
        notifications:
          pending.map(p => {
            const worker =
              db.workers.find(
                w =>
                  Number(
                    w.id
                  ) ===
                  Number(
                    p.worker_id
                  )
              );

            return {
              id: p.id,
              type:
                'permission',
              title:
                'Nueva solicitud de permiso',
              message:
                `${
                  worker?.names ||
                  worker?.name ||
                  'Trabajador'
                } tiene una solicitud pendiente.`,
              permission:
                enrichPermission(
                  p,
                  db
                ),
              created_at:
                p.created_at,
            };
          }),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | DASHBOARD
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/dashboard'
    ) {
      const workers =
        db.workers;

      const permissions =
        db.permissions;

      const today =
        qDate(
          new Date()
        );

      const activeWorkers =
        workers.filter(
          w =>
            w.active !==
            false
        ).length;

      const inactiveWorkers =
        workers.filter(
          w =>
            w.active ===
            false
        ).length;

      const pending =
        permissions.filter(
          p =>
            p.status ===
            'Pendiente'
        ).length;

      const approved =
        permissions.filter(
          p =>
            p.status ===
            'Aprobado'
        ).length;

      const rejected =
        permissions.filter(
          p =>
            p.status ===
            'Rechazado'
        ).length;

      const todayPermissions =
        permissions.filter(
          p =>
            qDate(
              p.date
            ) === today
        );

      /*
      |--------------------------------------------------------------------------
      | SEMANA
      |--------------------------------------------------------------------------
      */

      const now =
        new Date();

      const day =
        now.getDay();

      const diff =
        day === 0
          ? -6
          : 1 - day;

      const weekStart =
        new Date(now);

      weekStart.setDate(
        now.getDate() +
          diff
      );

      weekStart.setHours(
        0,
        0,
        0,
        0
      );

      const weekEnd =
        new Date(
          weekStart
        );

      weekEnd.setDate(
        weekStart.getDate() +
          6
      );

      weekEnd.setHours(
        23,
        59,
        59,
        999
      );

      const weekly =
        permissions.filter(
          p => {
            const d =
              new Date(
                `${qDate(
                  p.date
                )}T00:00:00`
              );

            return (
              d >=
                weekStart &&
              d <=
                weekEnd
            );
          }
        );

      /*
      |--------------------------------------------------------------------------
      | MES
      |--------------------------------------------------------------------------
      */

      const month =
        now.getMonth();

      const year =
        now.getFullYear();

      const monthly =
        permissions.filter(
          p => {
            const d =
              new Date(
                `${qDate(
                  p.date
                )}T00:00:00`
              );

            return (
              d.getMonth() ===
                month &&
              d.getFullYear() ===
                year
            );
          }
        );

      /*
      |--------------------------------------------------------------------------
      | POR TIPO
      |--------------------------------------------------------------------------
      */

      const byType = {};

      permissions.forEach(
        p => {
          const type =
            p.type ||
            'Sin tipo';

          byType[type] =
            (byType[type] ||
              0) + 1;
        }
      );

      /*
      |--------------------------------------------------------------------------
      | RANKING DE TRABAJADORES
      |--------------------------------------------------------------------------
      */

      const rankingMap =
        {};

      permissions.forEach(
        p => {
          const worker =
            workers.find(
              w =>
                Number(
                  w.id
                ) ===
                Number(
                  p.worker_id
                )
            );

          if (!worker)
            return;

          const id =
            worker.id;

          if (
            !rankingMap[id]
          ) {
            rankingMap[id] = {
              worker_id:
                id,

              dni:
                worker.dni ||
                '',

              name:
                worker.names ||
                worker.name ||
                '',

              area:
                worker.area ||
                '',

              position:
                worker.position ||
                worker.cargo ||
                '',

              total: 0,
            };
          }

          rankingMap[id].total++;
        }
      );

      const ranking =
        Object.values(
          rankingMap
        ).sort(
          (a, b) =>
            b.total -
            a.total
        );

      /*
      |--------------------------------------------------------------------------
      | RESPUESTA
      |--------------------------------------------------------------------------
      */

      return json(200, {
        ok: true,

        activeWorkers,

        inactiveWorkers,

        totalWorkers:
          workers.length,

        totalPermissions:
          permissions.length,

        pending,

        approved,

        rejected,

        today:
          todayPermissions.length,

        weekly:
          weekly.length,

        monthly:
          monthly.length,

        byType,

        ranking,

        recent:
          permissions
            .slice()
            .sort(
              (a, b) =>
                new Date(
                  b.created_at ||
                    0
                ) -
                new Date(
                  a.created_at ||
                    0
                )
            )
            .slice(0, 10)
            .map(p =>
              enrichPermission(
                p,
                db
              )
            ),
      });
    }

    /*
    |--------------------------------------------------------------------------
    | REPORTE EXCEL
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/reports/excel'
    ) {
      const buffer =
        await reportExcel(
          db
        );

      return {
        statusCode: 200,

        isBase64Encoded:
          true,

        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

          'Content-Disposition':
            'attachment; filename="reporte-permisos.xlsx"',

          'Access-Control-Allow-Origin':
            '*',

          'Access-Control-Allow-Headers':
            'Content-Type, Authorization',

          'Access-Control-Allow-Methods':
            'GET, POST, PUT, DELETE, OPTIONS',
        },

        body:
          buffer.toString(
            'base64'
          ),
      };
    }

    /*
    |--------------------------------------------------------------------------
    | REPORTE PDF
    |--------------------------------------------------------------------------
    */

    if (
      method === 'GET' &&
      requestPath ===
        '/reports/pdf'
    ) {
      const buffer =
        await reportPDF(
          db
        );

      return {
        statusCode: 200,

        isBase64Encoded:
          true,

        headers: {
          'Content-Type':
            'application/pdf',

          'Content-Disposition':
            'attachment; filename="reporte-permisos.pdf"',

          'Access-Control-Allow-Origin':
            '*',

          'Access-Control-Allow-Headers':
            'Content-Type, Authorization',

          'Access-Control-Allow-Methods':
            'GET, POST, PUT, DELETE, OPTIONS',
        },

        body:
          buffer.toString(
            'base64'
          ),
      };
    }

    /*
    |--------------------------------------------------------------------------
    | RUTA NO ENCONTRADA
    |--------------------------------------------------------------------------
    */

    return json(404, {
      error:
        'Ruta no encontrada.',
      path:
        requestPath,
      method,
    });
  } catch (error) {
    console.error(
      'ERROR API:',
      error
    );

    return json(500, {
      error:
        error.message ||
        'Error interno del servidor.',
    });
  }
}

/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

module.exports = {
  handler,
  pool,
};
