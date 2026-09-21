const express = require('express');
const cors = require('cors');
const { handler } = require('./netlify/functions/api');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', async (req, res) => {
  try {
    const event = {
      httpMethod: req.method,

      // IMPORTANTE:
      // Como este middleware está montado en /api,
      // req.path será /public/worker, /login, etc.
      path: req.path,

      headers: req.headers,

      queryStringParameters: req.query,

      body:
        req.body && Object.keys(req.body).length
          ? JSON.stringify(req.body)
          : null
    };

    const out = await handler(event);

    res.status(out.statusCode || 200);

    if (out.headers) {
      Object.entries(out.headers).forEach(([key, value]) => {
        res.set(key, value);
      });
    }

    if (out.isBase64Encoded) {
      return res.end(Buffer.from(out.body, 'base64'));
    }

    return res.send(out.body || '');
  } catch (error) {
    console.error('ERROR API:', error);

    return res.status(500).json({
      error: error.message || 'Error interno'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Funeraria Martínez API'
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
