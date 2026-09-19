const express = require('express');
const cors = require('cors');
const path = require('path');
const { handler } = require('./netlify/functions/api');

const app = express();
app.use(cors());
app.use(express.json({limit:'10mb'}));

app.use('/api', async (req,res) => {
  const event = {
    httpMethod: req.method,
    path: '/api' + (req.path === '/' ? '' : req.path),
    headers: req.headers,
    queryStringParameters: req.query,
    body: Object.keys(req.body || {}).length ? JSON.stringify(req.body) : null
  };
  try {
    const out = await handler(event);
    res.status(out.statusCode || 200);
    if (out.headers) Object.entries(out.headers).forEach(([k,v])=>res.set(k,v));
    if (out.isBase64Encoded) return res.end(Buffer.from(out.body,'base64'));
    return res.send(out.body || '');
  } catch(e) { return res.status(500).json({error:e.message||'Error interno'}); }
});

app.get('/health', (_,res)=>res.json({ok:true,service:'Funeraria Martínez API'}));

const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`API running on port ${port}`));
