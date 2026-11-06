"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeSkillStatus, type SkillStatusResult } from "./actions";

export default function SkillStatusButton({
  slug,
  current
}: {
  slug: string;
  current: string;
}) {
  const [next, setNext] = useState("active");
  const [result, setResult] = useState<SkillStatusResult | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (result?.ok) {
    return (
      <span className="badge badge--success" role="status">
        Status jadi {result.status}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <label className="field__label" htmlFor={`skill-status-${slug}`}>
        Status baru
      </label>
      <select
        id={`skill-status-${slug}`}
        className="select"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        disabled={pending}
        style={{ width: "auto", minHeight: 44 }}
      >
        <option value="active">active</option>
        <option value="disabled">disabled</option>
        <option value="deprecated">deprecated</option>
      </select>
      <button
        type="button"
        className="btn btn--primary"
        style={{ minHeight: 44 }}
        disabled={pending || next === current}
        aria-busy={pending}
        onClick={() =>
          startTransition(async () => {
            const out = await changeSkillStatus(slug, next);
            setResult(out);
            if (out.ok) router.refresh();
          })
        }
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          save
        </span>
        {pending ? "Mengirim…" : "Simpan"}
      </button>
      {result && !result.ok && (
        <span className="field__error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error
          </span>
          {result.error}
        </span>
      )}
    </div>
  );
}
