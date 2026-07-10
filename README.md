# POC - Telereabilitação Pulmonar: Oxímetro → PWA → API → Dashboard

Projeto de teste para validar o pipeline de dados antes de integrar o Bluetooth real.

## Como rodar

```bash
cd backend
npm install
npm start
```

O servidor sobe em `http://localhost:3001` e já serve as páginas de teste:

- `http://localhost:3001/patient-simulator.html` — simula a PWA do paciente (conecta em `/ws/patient` e recebe o stream mockado a cada 1s)
- `http://localhost:3001/dashboard-teste.html` — simula o dashboard do fisioterapeuta, recebendo os **mesmos dados simultaneamente via WebSocket e via SSE**, lado a lado, com latência medida em tempo real

**Ordem de teste:** abra `dashboard-teste.html` primeiro (ele já conecta e espera), depois abra `patient-simulator.html` em outra aba — o stream começa a fluir para os dois protocolos ao mesmo tempo, e você consegue comparar latência e comportamento de reconexão.

Use os botões "Cenário: Repouso / Exercício / Dessaturação" no dashboard para simular condições diferentes do paciente durante o exercício — isso é o tipo de evento que mais importa na reabilitação pulmonar (queda de SpO2 durante esforço).

## Estrutura

```
backend/
  server.js          -> API: WS (paciente + profissional) + SSE + REST
  mockOximeter.js     -> gerador de leituras mockadas realistas
  public/
    patient-simulator.html   -> simula a PWA do paciente
    dashboard-teste.html     -> simula o dashboard do profissional (WS vs SSE)
```

## Por que essa arquitetura

**WebSocket paciente→API:** a PWA nunca "empurra" um HTTP POST a cada leitura — mantém uma conexão persistente e envia continuamente. Menor overhead, e já deixa aberto o canal de volta (a API pode mandar comandos pro app do paciente: iniciar/parar sessão, pedir recalibração, etc.).

**WebSocket API→dashboard (recomendado) vs SSE (testado em paralelo):** ambos resolvem o broadcast pra múltiplos profissionais vendo o mesmo paciente. A diferença prática que você vai notar testando:
- SSE reconecta sozinho nativamente (`EventSource`), WS você programa a reconexão (já está no `dashboard-teste.html`)
- SSE não permite o dashboard mandar nada de volta pro servidor (ex: o fisioterapeuta clicar "marcar evento" ou "iniciar cenário")
- WS funciona igual em ambas as pontas, então você usa a mesma lib/mental model nos dois lados

**WebRTC não foi implementado aqui de propósito.** Ele resolve um problema que você não tem: comunicação P2P de baixíssima latência sem depender do servidor (ótimo pra vídeo/áudio). No seu caso os dados *precisam* passar pela API — pra persistir no banco, autenticar, disparar alertas, e permitir múltiplos profissionais olhando o mesmo paciente sem multiplicar conexões P2P. Adicionar WebRTC aqui significa herdar STUN/TURN/signaling só pra reinventar o que WS já faz de graça.

## Próximos passos reais

1. **Trocar o mock pelo Bluetooth real na PWA:** usar a [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) — a maioria dos oxímetros de consumo expõe o profile `Pulse Oximeter` (UUID `0x1822`) via GATT. O evento `characteristicvaluechanged` substitui o `setInterval` do mock, mantendo o mesmo formato de payload que já está definido em `mockOximeter.js` — assim o resto do pipeline não muda.
2. **Persistência:** decidir se toda leitura é gravada (alto volume) ou se só eventos relevantes (desaturação, início/fim de sessão) viram registro permanente — importante pra prontuário e auditoria em saúde.
3. **Autenticação/autorização:** o `/ws/professional` e `/ws/patient` aqui estão abertos; em produção, token JWT na query string ou no handshake, e vincular o paciente correto ao fisioterapeuta correto.
4. **Alertas:** já dá pra adicionar no `server.js`, dentro de `broadcastToProfessionals`, uma checagem `if (reading.spo2 < 90) dispararAlerta(...)`.
5. **PWA de verdade:** manifest.json, service worker, e testar o Web Bluetooth em Android (Chrome) — importante saber que **Web Bluetooth não funciona no Safari/iOS**, o que pode ser um limitador dependendo do público de pacientes.
