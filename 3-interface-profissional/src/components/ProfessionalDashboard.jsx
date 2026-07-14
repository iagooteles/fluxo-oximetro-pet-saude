import { useEffect, useMemo, useState, useCallback } from 'react';
import { LineChart, ComposedChart, Line, Area, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MetricCard from './MetricCard.jsx';
import ConnectionBanner from './ConnectionBanner.jsx';

const API_HOST = 'localhost:3001';
const HISTORY_WINDOW_MS = 5 * 60 * 1000;

function parseReading(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function mapSignalState(reading) {
  if (!reading) return 0;
  return reading.signalQuality === 'lost' ? 0 : 1;
}

function ProtocolCharts({ protocolName, chartData, spo2Dots }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="chart-panel-header" style={{ marginBottom: 0 }}>
        <h2>{protocolName}</h2>
        <p>Dados recebidos por este protocolo</p>
      </div>
      <section className="charts-row">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h2>Saturação (%)</h2>
            <p>Últimos 5 minutos</p>
          </div>
          <div className="chart-panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={spo2Dots} margin={{ top: 16, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="4 4" />
                <XAxis
                  dataKey="relativeX"
                  tick={{ fill: '#EAEDDA', fontSize: 12, fontFamily: 'Nunito' }}
                  type="number"
                  domain={[0, 300]}
                  reversed
                  ticks={[0, 60, 120, 180, 240, 300]}
                  tickFormatter={(value) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`}
                  interval={0}
                  padding={{ left: 0, right: 0 }}
                />
                <YAxis domain={[80, 100]} tick={{ fill: '#EAEDDA', fontSize: 12, fontFamily: 'Nunito' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} formatter={(value) => (value == null ? 'off' : `${value}%`)} />
                <Scatter dataKey="display" fill="#497EE6" line={false} shape="circle" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h2>Frequência Cardíaca</h2>
            <p>Últimos 5 minutos</p>
          </div>
          <div className="chart-panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="4 4" />
                <XAxis
                  dataKey="relativeX"
                  tick={{ fill: '#EAEDDA', fontSize: 12, fontFamily: 'Nunito' }}
                  type="number"
                  domain={[0, 300]}
                  reversed
                  ticks={[0, 60, 120, 180, 240, 300]}
                  tickFormatter={(value) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`}
                  interval={0}
                  padding={{ left: 0, right: 0 }}
                />
                <YAxis domain={[50, 'auto']} tick={{ fill: '#EAEDDA', fontSize: 12, fontFamily: 'Nunito' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} />
                <Line type="monotone" dataKey="hr" stroke="#FF8E16" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h2>Sinal do oxímetro</h2>
            <p>Últimos 5 minutos</p>
          </div>
          <div className="chart-panel-body">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 6 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="4 4" />
                <XAxis
                  dataKey="relativeX"
                  tick={{ fill: '#EAEDDA', fontSize: 12, fontFamily: 'Nunito' }}
                  type="number"
                  domain={[0, 300]}
                  reversed
                  ticks={[0, 60, 120, 180, 240, 300]}
                  tickFormatter={(value) => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`}
                  interval={0}
                  padding={{ left: 0, right: 0 }}
                />
                <YAxis domain={[0, 1]} tick={{ fill: '#EAEDDA', fontSize: 12, fontFamily: 'Nunito' }} tickCount={2} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#e2e8f0' }} formatter={(value) => (value === 1 ? 'Ligado' : 'Desligado')} />
                <Area type="stepAfter" dataKey="signalOn" stroke="#C0DD97" fill="#C0DD97" fillOpacity={0.35} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function ProfessionalDashboard() {
  const [wsConnected, setWsConnected] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [lastReading, setLastReading] = useState(null);
  const [wsReading, setWsReading] = useState(null);
  const [sseReading, setSseReading] = useState(null);
  const [wsHistory, setWsHistory] = useState([]);
  const [sseHistory, setSseHistory] = useState([]);
  const [now, setNow] = useState(Date.now());

  const pushReading = useCallback((reading, source) => {
    if (!reading) return;
    const timestampMs = new Date(reading.timestamp).getTime() || Date.now();
    const isDisconnected = reading.connectionState === 'OFF';
    const enriched = {
      ...reading,
      spo2: isDisconnected ? null : reading.spo2,
      heartRate: isDisconnected ? null : reading.heartRate,
      timestampMs,
      time: new Date(timestampMs).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }),
      signalOn: isDisconnected ? 0 : mapSignalState(reading),
    };

    if (source === 'ws') {
      setWsReading(enriched);
    } else if (source === 'sse') {
      setSseReading(enriched);
    }

    setLastReading(enriched);
    if (source === 'ws') {
      setWsHistory((current) => {
        const nowMs = Date.now();
        const next = [...current, enriched];
        return next
          .filter((item) => item.timestampMs >= nowMs - HISTORY_WINDOW_MS)
          .slice(-300);
      });
    } else if (source === 'sse') {
      setSseHistory((current) => {
        const nowMs = Date.now();
        const next = [...current, enriched];
        return next
          .filter((item) => item.timestampMs >= nowMs - HISTORY_WINDOW_MS)
          .slice(-300);
      });
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`ws://${API_HOST}/ws/professional`);

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (event) => {
      const reading = parseReading(event.data);
      pushReading(reading, 'ws');
    };

    return () => ws.close();
  }, [pushReading]);

  useEffect(() => {
    const evt = new EventSource(`http://${API_HOST}/sse/professional`);

    evt.onopen = () => setSseConnected(true);
    evt.onerror = () => setSseConnected(false);
    evt.onmessage = (event) => {
      const reading = parseReading(event.data);
      pushReading(reading, 'sse');
    };

    return () => evt.close();
  }, [pushReading]);

  const buildChartData = useCallback((historyItems) => historyItems
    .map((item) => ({
      relativeX: Math.min(300, Math.max(0, Math.round((now - item.timestampMs) / 1000))),
      spo2: item.spo2,
      hr: item.heartRate,
      signalOn: item.signalOn,
      connectionState: item.connectionState,
      timestampMs: item.timestampMs,
    }))
    .filter((item) => item.relativeX <= 300)
    .sort((a, b) => b.relativeX - a.relativeX), [now]);

  const wsChartData = useMemo(() => buildChartData(wsHistory), [buildChartData, wsHistory]);
  const sseChartData = useMemo(() => buildChartData(sseHistory), [buildChartData, sseHistory]);

  const buildSpo2Dots = useCallback((chartData) => {
    let lastBucket = -1;
    return chartData.map((item) => {
      const bucket = Math.floor(item.timestampMs / 5000);
      const display = bucket !== lastBucket ? item.spo2 : null;
      lastBucket = bucket;
      return { ...item, display };
    });
  }, []);

  const wsSpo2Dots = useMemo(() => buildSpo2Dots(wsChartData), [buildSpo2Dots, wsChartData]);
  const sseSpo2Dots = useMemo(() => buildSpo2Dots(sseChartData), [buildSpo2Dots, sseChartData]);

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Interface do profissional</p>
          <h1>Monitor de oxímetro</h1>
          <p className="description">Recebe dados do paciente em tempo real via API e exibe histórico e métricas.</p>
        </div>

        <ConnectionBanner wsConnected={wsConnected} sseConnected={sseConnected} />
      </header>

      <section className="metrics-grid">
        <MetricCard label="SpO2" value={lastReading?.spo2 ?? '--'} suffix="%" status={lastReading?.spo2} />
        <MetricCard label="BPM" value={lastReading?.heartRate ?? '--'} suffix="bpm" status={lastReading?.spo2} />
        <MetricCard label="Perfusão" value={lastReading?.perfusionIndex ?? '--'} suffix="PI" status={lastReading?.signalQuality} />
        <MetricCard label="Conexão" value={lastReading?.connectionState ?? 'OFF'} compact />
      </section>

      <section className="charts-row">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <h2>WebSocket</h2>
            <p>Fluxo em tempo real</p>
          </div>
          <div className="chart-panel-body">
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 12 }}>
              <MetricCard label="SpO2" value={wsReading?.spo2 ?? '--'} suffix="%" status={wsReading?.spo2} />
              <MetricCard label="BPM" value={wsReading?.heartRate ?? '--'} suffix="bpm" status={wsReading?.spo2} />
            </div>
            <div className="description">{wsReading?.connectionState ?? 'OFF'}</div>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <h2>SSE</h2>
            <p>Fluxo unidirecional</p>
          </div>
          <div className="chart-panel-body">
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', marginBottom: 12 }}>
              <MetricCard label="SpO2" value={sseReading?.spo2 ?? '--'} suffix="%" status={sseReading?.spo2} />
              <MetricCard label="BPM" value={sseReading?.heartRate ?? '--'} suffix="bpm" status={sseReading?.spo2} />
            </div>
            <div className="description">{sseReading?.connectionState ?? 'OFF'}</div>
          </div>
        </div>
      </section>

      <ProtocolCharts protocolName="WebSocket" chartData={wsChartData} spo2Dots={wsSpo2Dots} />
      <ProtocolCharts protocolName="SSE" chartData={sseChartData} spo2Dots={sseSpo2Dots} />
    </div>
  );
}
