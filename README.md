# Telereabilitação Pulmonar - Fluxo Oxímetro → PWA → API → Dashboard

Projeto segmentado em serviços independentes, refletindo os limites reais do sistema.

## Serviços

| Serviço | Porta | Responsabilidade |
|---|---|---|
| `oximetro-service` | 3002 | Simula o dispositivo BLE (emite leituras mockadas). Também hospeda `patient-simulator.html`, que representa a PWA. |
| `api-service` | 3001 | Camada intermediária: recebe da PWA, distribui pro(s) profissional(is) via WS e SSE. Não gera dado nenhum. |
| `interface-profissional` | - | *(próxima etapa - React)* dashboard real do fisioterapeuta |

## Por que separar assim

No mundo real, esses são três atores completamente distintos:
- O **oxímetro** não conhece a API, nem o dashboard. Ele só fala BLE com quem estiver por perto (a PWA).
- A **PWA** é quem faz a ponte: lê do Bluetooth, manda pra API.
- A **API** não sabe nada sobre Bluetooth. Ela só recebe leituras (de qualquer fonte que fale o protocolo certo) e distribui.

Separar em serviços agora, mesmo mockado, evita que essas responsabilidades se misturem no código e facilita trocar qualquer uma das pontas depois (ex: trocar o mock pelo Bluetooth real sem tocar na API).

## Como rodar

Precisa de **3 terminais** (2 por enquanto):

```bash
# Terminal 1
cd oximetro-service
npm install
npm start
# -> roda em http://localhost:3002

# Terminal 2
cd api-service
npm install
npm start
# -> roda em http://localhost:3001
```

Depois, no navegador:

1. Abra `http://localhost:3001/dashboard-teste.html` (dashboard do profissional) — ele já conecta e fica esperando dados.
2. Abra `http://localhost:3002/patient-simulator.html` (PWA) — ela conecta no oxímetro E na API, e o stream começa a fluir ponta a ponta.

Use os botões de cenário no dashboard para simular repouso/exercício/dessaturação — a chamada vai direto pro `oximetro-service` (é lá que o estado do mock vive agora).

## Estrutura

```
fluxo-oximetro/
  oximetro-service/
    server.js          -> expõe as leituras via WS (/ws/device) + REST (/api/scenario)
    mockOximeter.js     -> gerador de leituras mockadas
    package.json
    public/
      patient-simulator.html   -> representa a PWA (device -> api-service)

  api-service/
    server.js          -> WS (/ws/patient, /ws/professional) + SSE (/sse/professional)
    package.json
    public/
      dashboard-teste.html     -> representa o dashboard do profissional (WS vs SSE)

  .gitignore
  README.md
```

## Próximos passos

1. **`interface-profissional`** como projeto React separado, consumindo `ws://localhost:3001/ws/professional` (ou SSE, dependendo do que a comparação mostrar).
2. Trocar o `patient-simulator.html` por uma PWA React de verdade, com manifest + service worker, mantendo a mesma lógica de "conecta no device, retransmite pra API".
3. Quando for pro Bluetooth real: o `oximetro-service` deixa de existir como servidor de rede — a PWA passa a ler direto via Web Bluetooth API. O `api-service` não muda nada, porque ele só espera receber JSON em `/ws/patient`, não importa a origem.
4. Autenticação nos WS (`/ws/patient` e `/ws/professional` estão abertos) e vínculo paciente↔fisioterapeuta antes de qualquer uso com dado real.
