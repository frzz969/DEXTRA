/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dashboard lama tetap berjalan sendiri; apps/web tidak mengimpornya.
  outputFileTracingRoot: undefined
};

export default nextConfig;
