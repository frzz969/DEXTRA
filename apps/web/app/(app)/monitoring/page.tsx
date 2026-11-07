import MonitoringClient from './monitoring-client';

export const dynamic = 'force-dynamic';

export default function MonitoringPage() {
  return (
    <div>
      <h1>Monitoring & feedback loop</h1>
      <p>Live feed of recent audit events and executions.</p>
      <MonitoringClient />
    </div>
  );
}