'use client';

import { useEffect, useState } from 'react';

type AuditEvent = { event_id: string; type?: string; actor?: string; at?: string; reason_code?: string };
type Execution = { execution_id: string; result?: string; action_id?: string; executed_at?: string };

export default function MonitoringClient() {
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [execs, setExecs] = useState<Execution[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  async function load() {
    try {
      const [aRes, eRes] = await Promise.all([
        fetch('/api/v1/audit?limit=20'),
        fetch('/api/v1/executions?limit=20'),
      ]);
      const aJson = aRes.ok ? await aRes.json() : { items: [] };
      const eJson = eRes.ok ? await eRes.json() : { items: [] };
      const events: AuditEvent[] = aJson.items ?? aJson ?? [];
      const execList: Execution[] = eJson.items ?? eJson ?? [];
      let added = 0;
      const nextSeen = new Set(seen);
      for (const ev of events) {
        if (!seen.has(ev.event_id)) {
          if (seen.size > 0) added++;
          nextSeen.add(ev.event_id);
        }
      }
      setAudit(events);
      setExecs(execList);
      setSeen(nextSeen);
      if (added > 0) setNewCount((c) => c + added);
      setLastUpdated(new Date().toLocaleString());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      {newCount > 0 && (
        <div className="banner">{newCount} event baru sejak terakhir dicek</div>
      )}
      <div className="grid">
        <div className="card">
          <h2>Audit terbaru</h2>
          <table>
            <thead><tr><th>type</th><th>actor</th><th>at</th><th>reason_code</th></tr></thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.event_id}><td>{e.type}</td><td>{e.actor}</td><td>{e.at}</td><td>{e.reason_code}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Eksekusi terbaru</h2>
          <table>
            <thead><tr><th>execution_id</th><th>result</th><th>action_id</th><th>executed_at</th></tr></thead>
            <tbody>
              {execs.map((e) => (
                <tr key={e.execution_id}><td>{e.execution_id}</td><td>{e.result}</td><td>{e.action_id}</td><td>{e.executed_at}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {lastUpdated && <p>Last updated: {lastUpdated}</p>}
    </div>
  );
}