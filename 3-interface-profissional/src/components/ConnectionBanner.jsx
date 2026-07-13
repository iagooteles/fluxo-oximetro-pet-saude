export default function ConnectionBanner({ wsConnected, sseConnected }) {
  return (
    <div className="connection-banner">
      <div>
        <span className={`dot ${wsConnected ? 'online' : 'offline'}`} />
        WebSocket: {wsConnected ? 'conectado' : 'desconectado'}
      </div>
      <div>
        <span className={`dot ${sseConnected ? 'online' : 'offline'}`} />
        SSE: {sseConnected ? 'conectado' : 'desconectado'}
      </div>
    </div>
  );
}
