# Funeraria Martínez — Vercel + Render

Proyecto preparado para:
- GitHub: código fuente
- Render: backend Node/Express + almacenamiento JSON
- Vercel: frontend estático

## Render
1. Importa este repositorio en Render.
2. Web Service.
3. Build: `npm install`
4. Start: `npm start`
5. Render asignará una URL como `https://funeraria-martinez-api.onrender.com`.
6. Para persistencia real en Render, usa un Persistent Disk y configura `DB_FILE` dentro de ese disco. Sin disco, los datos pueden perderse al reiniciar/redeployar.

## Vercel
1. Importa el mismo repositorio.
2. Root/Publish: `frontend` o configura el proyecto como sitio estático.
3. El archivo `frontend/api-config.js` usa `/api`.
4. En `vercel.json`, reemplaza `https://TU-API-RENDER.onrender.com` por la URL real de Render.
5. Vuelve a desplegar Vercel.

## Acceso inicial
Usuario: `admin`
Contraseña: `admin123`

El sistema inicia sin trabajadores, permisos ni asistencias.
