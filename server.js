const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { generateReading, setScenario } = require('./mockOximeter');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);

// ---------------------------------------------------------------------
// 1) WEBSOCKET - dois "canais" lógicos na mesma porta, diferenciados por path
//    /ws/patient      -> a PWA do paciente conecta aqui e ENVIA leituras
//    /ws/professional -> o dashboard do fisioterapeuta conecta aqui e RECEBE
// ---------------------------------------------------------------------
const wss = new WebSocketServer({ server });
const professionalSockets = new Set();
const sseClients = new Set();

wss.on('connection', (ws, req) => {
  const isProfessional = req.url.startsWith('/ws/professional');
  const isPatient = req.url.startsWith('/ws/patient');

  if (isProfessional) {
    professionalSockets.add(ws);
    console.log(`[WS] Profissional conectado. Total: ${professionalSockets.size}`);
    ws.on('close', () => professionalSockets.delete(ws));

    // Canal de volta: profissional pode mandar comando pro paciente (ex: mudar cenário no mock)
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'set-scenario') {
          setScenario(msg.scenario);
          console.log(`[CMD] Cenário alterado para: ${msg.scenario}`);
        }
      } catch (e) {
        console.error('Mensagem inválida do profissional:', e.message);
      }
    });
  }

  if (isPatient) {
    console.log('[WS] PWA do paciente conectada, iniciando stream de leituras...');
    const interval = setInterval(() => {
      if (ws.readyState !== ws.OPEN) return clearInterval(interval);

      // A PWA "envia" a leitura mockada (no mundo real, isso viria do
      // callback de notificação do Web Bluetooth GATT characteristic)
      const reading = generateReading();
      ws.send(JSON.stringify(reading));
      broadcastToProfessionals(reading);
    }, 1000);

    ws.on('close', () => clearInterval(interval));
  }
});

function broadcastToProfessionals(reading) {
  const payload = JSON.stringify(reading);

  // Broadcast via WebSocket
  professionalSockets.forEach((sock) => {
    if (sock.readyState === sock.OPEN) sock.send(payload);
  });

  // Broadcast via SSE
  sseClients.forEach((res) => {
    res.write(`data: ${payload}\n\n`);
  });
}

// ---------------------------------------------------------------------
// 2) SSE - alternativa somente de leitura pro dashboard do profissional
//    GET /sse/professional
// ---------------------------------------------------------------------
app.get('/sse/professional', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  sseClients.add(res);
  console.log(`[SSE] Profissional conectado. Total: ${sseClients.size}`);

  req.on('close', () => {
    sseClients.delete(res);
    console.log(`[SSE] Profissional desconectado. Total: ${sseClients.size}`);
  });
});

// ---------------------------------------------------------------------
// 3) Endpoint auxiliar para simular o paciente sem WS (fallback REST/polling)
//    Útil para comparar polling vs WS/SSE em termos de latência percebida
// ---------------------------------------------------------------------
app.get('/api/oximeter/reading', (req, res) => {
  const reading = generateReading();
  broadcastToProfessionals(reading);
  res.json(reading);
});

app.post('/api/oximeter/scenario', (req, res) => {
  setScenario(req.body.scenario);
  res.json({ ok: true, scenario: req.body.scenario });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`WS paciente:      ws://localhost:${PORT}/ws/patient`);
  console.log(`WS profissional:  ws://localhost:${PORT}/ws/professional`);
  console.log(`SSE profissional: http://localhost:${PORT}/sse/professional`);
});
