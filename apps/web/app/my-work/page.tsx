import { apiGet } from "@/lib/api";
import { EmptyState, Unavailable } from "@/components/states";

export const dynamic = "force-dynamic";

type Task = { id: string; title?: string; status?: string; assignee?: string | null; updated_at?: string };

export default async function MyWorkPage() {
  const tasks = await apiGet<{ items: Task[] }>("/tasks");
  return (
    <>
      <header className="page-head">
        <div className="page-head__text">
          <h1>My Work</h1>
          <p>Daftar tugas yang terdaftar di backend, termasuk status lifecycle-nya.</p>
        </div>
      </header>
      {!tasks.ok ? (
        <Unavailable title="Daftar tugas" error={tasks.error} />
      ) : tasks.data.items.length === 0 ? (
        <EmptyState icon="task_alt" title="Belum ada tugas." body="Tugas muncul di sini setelah dibuat dan ditugaskan." />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead><tr><th>ID</th><th>Judul</th><th>Status</th><th>Assignee</th><th>Diperbarui</th></tr></thead>
            <tbody>
              {tasks.data.items.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.id}</td>
                  <td>{t.title ?? "—"}</td>
                  <td><span className="badge badge--outline">{t.status ?? "—"}</span></td>
                  <td>{t.assignee ?? "—"}</td>
                  <td className="mono">{t.updated_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
