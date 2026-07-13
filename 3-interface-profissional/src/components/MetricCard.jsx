export default function MetricCard({ label, value, suffix = '', status, compact = false }) {
  const className = status === 'weak' || status < 92 ? 'metric-card warning' : 'metric-card';
  return (
    <div className={compact ? 'metric-card compact' : className}>
      <span className="metric-label">{label}</span>
      <div className="metric-value">{value} {suffix}</div>
    </div>
  );
}
