# Oximetro Service (simulador)

Este serviço simula um oxímetro de pulso BLE e expõe leituras por WebSocket.
Ele representa o hardware do oxímetro na arquitetura, permitindo testar a PWA sem o dispositivo real.

## O que está aqui

- `mockOximeter.js`
  - Gera leituras simuladas de SpO2, batimentos, perfusão e qualidade de sinal.
  - Mantém um `state` interno para tornar a leitura contínua e suave.
  - Não simula perda de sinal nesta versão: o oxímetro emite leituras consistentes a cada 1 segundo.

- `server.js`
  - Roda em `http://localhost:3002`.
  - Abre um WebSocket em `ws://localhost:3002/ws/device`.
  - Envia uma leitura por segundo para cada cliente conectado.

- `public/patient-simulator.html`
  - Página que representa a PWA do paciente.
  - Conecta ao simulador do oxímetro e mostra valores em tempo real.
  - Também exibe logs com cada leitura recebida.

## Como o simulador envia os dados

A cada 1 segundo, o servidor executa `generateReading()` e manda o JSON pelo WebSocket:

- `spo2` (percentual de oxigênio no sangue)
- `heartRate` (batimentos por minuto)
- `perfusionIndex` (força do sinal de pulso)
- `signalQuality` (`good` ou `weak`)
- `scenario` (`rest`, `exercise`, `desaturation`)
- `timestamp` (marca de tempo ISO)

O envio é feito com `ws.send(JSON.stringify(reading))` dentro de um `setInterval(..., 1000)`.

## Realismo da simulação

A simulação busca ser próxima o suficiente para testes de interface e fluxo de dados, mas não é uma simulação clínica completa.

O que está mais fiel:
- Valores de SpO2 seguem faixas plausíveis para repouso, exercício e dessaturação.
- A frequência cardíaca varia de forma suave e contínua.
- `perfusionIndex` é gerado para indicar qualidade de sinal e diferenciar leituras boas de leituras fracas.
- O envio a cada 1 segundo é alinhado com o comportamento típico de notificações BLE de oxímetros.

Limitações importantes:
- Não há processamento real de sinal plethysmográfico.
- Não há calibração médica, nem resposta a movimentos ou perfis fisiológicos individuais.
- O `signalQuality` aqui é um indicador simplificado, não o mesmo que um oxímetro real calcula internamente.

## Uso

```bash
cd 1-oximetro-pwa-service
npm install
npm start
```

Abra no navegador:

- `http://localhost:3002/patient-simulator.html` para ver as leituras do oxímetro e o log de envio.

## Por que esta versão é útil

Para o fluxo do projeto, o simulador garante que a PWA receba dados de forma contínua e previsível.
Quando você migrar para a próxima etapa (leitura real do oxímetro ou uso da API em `2-backend-api-service`), essa camada de mock ajuda a validar o consumo dos dados sem precisar do hardware.
