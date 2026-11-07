/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Next dev memblokir resource dev (HMR/RSC) dari host selain origin default.
  // Tanpa ini, membuka lewat 127.0.0.1 membuat halaman tampil tapi tidak
  // ter-hydrate: tombol/tema/form mati, dan suite Playwright ikut gagal.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Dashboard lama tetap berjalan sendiri; apps/web tidak mengimpornya.
  outputFileTracingRoot: undefined
};

export default nextConfig;
