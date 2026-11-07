import type { ReactNode } from "react";

/* Grup rute untuk layar bare: /login, /forbidden, /unavailable. Ketiganya
 * dirancang setinggi viewport tanpa chrome, jadi grup ini sengaja tidak
 * memasang header, footer, atau stylesheet pemasaran apa pun. Layout hanya
 * meneruskan children. */
export default function BareLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
