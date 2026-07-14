const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------------------------------------------------------------------
// Este serviço NÃO gera dados. Ele só faz a ponte:
//   PWA (paciente) --envia--> /ws/patient --broadcast--> profissional(is)
//
// /ws/patient      -> a PWA conecta aqui e ENVIA as leituras que recebeu do oxímetro
// /ws/professional -> o dashboard do fisioterapeuta conecta aqui e RECEBE
// /sse/professional -> alternativa somente-leitura via SSE (pra comparação)
// ---------------------------------------------------------------------
const professionalSockets = new Set();
const sseClients = new Set();
let patientConnectionEnabled = true;
let messageCounter = 0;
let lastPatientReading = {
  spo2: null,
  heartRate: null,
  perfusionIndex: 0,
  signalQuality: 'lost',
  scenario: 'disconnected',
  timestamp: new Date().toISOString(),
  connectionState: 'OFF',
};

wss.on('connection', (ws, req) => {
  const isProfessional = req.url.startsWith('/ws/professional');
  const isPatient = req.url.startsWith('/ws/patient');

  if (isProfessional) {
    professionalSockets.add(ws);
    console.log(`[WS] Profissional conectado. Total: ${professionalSockets.size}`);
    ws.on('close', () => professionalSockets.delete(ws));
  }

  if (isPatient) {
    console.log('[WS] PWA do paciente conectada.');

    ws.on('message', (raw) => {
      try {
        const reading = JSON.parse(raw);
        lastPatientReading = { ...reading, connectionState: 'ON' };
        if (patientConnectionEnabled) {
          broadcastToProfessionals(lastPatientReading);
        }
      } catch (e) {
        console.error('Leitura inválida recebida da PWA:', e.message);
      }
    });

    ws.on('close', () => console.log('[WS] PWA do paciente desconectada.'));
  }
});

function makeDisconnectedReading() {
  return {
    spo2: null,
    heartRate: null,
    perfusionIndex: 0,
    signalQuality: 'lost',
    scenario: 'disconnected',
    timestamp: new Date().toISOString(),
    connectionState: 'OFF',
  };
}

function enrichReading(reading) {
  return {
    ...reading,
    seq: ++messageCounter,
    serverTimestamp: new Date().toISOString(),
  };
}

function broadcastToProfessionals(reading) {
  const outgoingReading = enrichReading(reading);
  const payload = JSON.stringify(outgoingReading);

  professionalSockets.forEach((sock) => {
    if (sock.readyState === sock.OPEN) sock.send(payload);
  });

  sseClients.forEach((res) => {
    res.write(`data: ${payload}\n\n`);
  });
}

setInterval(() => {
  if (!patientConnectionEnabled) {
    broadcastToProfessionals(makeDisconnectedReading());
  }
}, 1000);

app.post('/api/connection', (req, res) => {
  const connected = req.body?.connected === true;
  patientConnectionEnabled = connected;
  console.log(`[CMD] Conexão do paciente alterada para: ${connected ? 'ON' : 'OFF'}`);
  res.json({ ok: true, connected });
});

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

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[api-service] rodando em http://localhost:${PORT}`);
  console.log(`WS paciente:      ws://localhost:${PORT}/ws/patient`);
  console.log(`WS profissional:  ws://localhost:${PORT}/ws/professional`);
  console.log(`SSE profissional: http://localhost:${PORT}/sse/professional`);
});