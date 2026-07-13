# API Service (2-backend-api-service)

Este serviço é a camada intermediária entre a PWA do paciente e a interface profissional.
Ele não gera leituras de oxímetro — ele recebe dados do cliente paciente e os distribui para o dashboard.

## O que este serviço faz

- Serve arquivos estáticos a partir da pasta `public/`.
- Expondo um dashboard de teste em `http://localhost:3001/dashboard-teste.html`.
- Aceita conexões WebSocket de profissionais em `ws://localhost:3001/ws/professional`.
- Aceita conexões SSE de profissionais em `http://localhost:3001/sse/professional`.
- Recebe leituras do paciente via WebSocket em `ws://localhost:3001/ws/patient`.
- Repassa cada leitura recebida para todos os profissionais conectados.

## Como funciona o fluxo de dados

1. O `oximetro-service` gera leituras e a PWA do paciente (`patient-simulator.html`) se conecta a ele.
2. A PWA retransmite as leituras para `2-backend-api-service` via WebSocket em `/ws/patient`.
3. O `api-service` recebe cada leitura JSON e entrega em tempo real para:
   - clientes WebSocket profissionais em `/ws/professional`
   - clientes SSE profissionais em `/sse/professional`
4. O dashboard do profissional mostra essas leituras e registra logs de recebimento.

## Rotas principais

- `GET /` ou `GET /dashboard-teste.html`
  - Página do dashboard de teste.

- `GET /sse/professional`
  - Endpoint SSE para clientes profissionais.

- `GET /ws/professional`
  - Endpoint WebSocket para clientes profissionais.

- `GET /ws/patient`
  - Endpoint WebSocket para a PWA do paciente enviar leituras.

## Executando o serviço

No diretório `2-backend-api-service`:

```bash
npm install
npm start
```

O serviço ficará disponível em `http://localhost:3001`.

## Como testar

1. Suba o `oximetro-service` em `http://localhost:3002`.
2. Suba este `api-service` em `http://localhost:3001`.
3. Abra `http://localhost:3002/patient-simulator.html` para iniciar a PWA do paciente.
4. Abra `http://localhost:3001/dashboard-teste.html` para ver os dados chegando.

## Observações importantes

- O `api-service` não gera dados de oxímetro. Ele funciona como um roteador de dados entre paciente e profissional.
- Trocar o cenário no dashboard usa o `oximetro-service`, porque é ele que mantém o estado do mock.
- O envio de cada leitura deve ocorrer aproximadamente a cada 1 segundo, conforme o oxímetro mockado e a PWA.

## Estrutura do serviço

- `server.js` — servidor Express + WebSocket que distribui leituras.
- `mockOximeter.js` — gerador de leituras presente apenas para testes locais.
- `public/dashboard-teste.html` — dashboard que consome dados de WS e SSE.
- `package.json` — scripts e dependências.
