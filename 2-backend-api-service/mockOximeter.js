/**
 * Simulador de leituras de oxímetro de pulso (formato similar ao que
 * um oxímetro BLE real envia via GATT characteristic - ex: perfil PLX).
 *
 * Campos:
 * - spo2: saturação de oxigênio (%) - normal 95-100, atenção <92, crítico <88
 * - heartRate: frequência cardíaca (bpm)
 * - perfusionIndex: força do sinal de pulso (0.02 - 20) - indica qualidade da leitura
 * - signalQuality: 'good' | 'weak' | 'lost' (simula dedo mal posicionado / movimento)
 * - timestamp: ISO string
 */

let state = {
  spo2: 97,
  heartRate: 75,
  scenario: 'rest', // 'rest' | 'exercise' | 'desaturation'
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Random walk suave para parecer uma leitura real (não teleporta os valores)
function nextValue(current, min, max, maxStep) {
  const step = (Math.random() - 0.5) * 2 * maxStep;
  return clamp(Math.round((current + step) * 10) / 10, min, max);
}

function setScenario(scenario) {
  if (['rest', 'exercise', 'desaturation'].includes(scenario)) {
    state.scenario = scenario;
  }
}

function generateReading() {
  // Simula perda de sinal ocasional (dedo se mexeu, sensor mal posicionado)
  const signalLost = Math.random() < 0.03;

  if (signalLost) {
    return {
      spo2: null,
      heartRate: null,
      perfusionIndex: null,
      signalQuality: 'lost',
      scenario: state.scenario,
      timestamp: new Date().toISOString(),
    };
  }

  let targetSpo2Range = [95, 99];
  let targetHrRange = [60, 90];

  if (state.scenario === 'exercise') {
    targetSpo2Range = [92, 98];
    targetHrRange = [100, 150];
  } else if (state.scenario === 'desaturation') {
    // Simula um evento de dessaturação (comum em reabilitação pulmonar
    // durante esforço - o que o fisioterapeuta precisa monitorar de perto)
    targetSpo2Range = [82, 90];
    targetHrRange = [95, 130];
  }

  state.spo2 = nextValue(state.spo2, targetSpo2Range[0], targetSpo2Range[1], 1.5);
  state.heartRate = nextValue(state.heartRate, targetHrRange[0], targetHrRange[1], 4);

  const perfusionIndex = clamp(Math.round((Math.random() * 8 + 1) * 10) / 10, 0.2, 20);
  const signalQuality = perfusionIndex < 1 ? 'weak' : 'good';

  return {
    spo2: Math.round(state.spo2),
    heartRate: Math.round(state.heartRate),
    perfusionIndex,
    signalQuality,
    scenario: state.scenario,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { generateReading, setScenario };
