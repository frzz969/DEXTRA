"use client";

import { useTransition } from "react";
import { signOut } from "@/lib/auth-actions";

export default function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn btn--secondary"
      disabled={pending}
      onClick={() => startTransition(async () => { await signOut(); })}
    >
      <span className="material-symbols-outlined" aria-hidden="true">{pending ? "hourglass_top" : "logout"}</span>
      {pending ? "Keluar…" : "Keluar"}
    </button>
  );
}
