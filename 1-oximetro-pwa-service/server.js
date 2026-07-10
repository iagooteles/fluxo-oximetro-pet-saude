const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const { generateReading, setScenario, getScenario } = require('./mockOximeter');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const server = http.createServer(app);

// ---------------------------------------------------------------------
// Este serviço representa o "hardware" do oxímetro.
// No mundo real, ele NÃO existiria como servidor de rede - a PWA leria
// direto do dispositivo via Web Bluetooth API (GATT characteristic notify).
//
// Aqui, simulamos esse comportamento via WebSocket: quem conecta em
// /ws/device é a PWA (patient-simulator.html), e passa a receber uma
// leitura por segundo, exatamente como receberia um evento
// 'characteristicvaluechanged' do Bluetooth real.
// ---------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws/device' });

wss.on('connection', (ws) => {
  console.log('[DEVICE] PWA conectada ao oxímetro. Iniciando emissão de leituras...');

  const interval = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return clearInterval(interval);
    const reading = generateReading();
    ws.send(JSON.stringify(reading));
  }, 1000);

  ws.on('close', () => {
    clearInterval(interval);
    console.log('[DEVICE] PWA desconectada.');
  });
});

// Endpoint auxiliar para trocar o cenário simulado (repouso/exercício/dessaturação)
// Pode ser chamado manualmente via curl/Postman durante os testes.
app.post('/api/scenario', (req, res) => {
  setScenario(req.body.scenario);
  console.log(`[CMD] Cenário alterado para: ${req.body.scenario}`);
  res.json({ ok: true, scenario: getScenario() });
});

app.get('/api/scenario', (req, res) => {
  res.json({ scenario: getScenario() });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`[oximetro-service] rodando em http://localhost:${PORT}`);
  console.log(`WS do dispositivo: ws://localhost:${PORT}/ws/device`);
});
