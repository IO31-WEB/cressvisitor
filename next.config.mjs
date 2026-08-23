/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  // mapbox-gl/react-map-gl ship ESM with worker imports that occasionally
  // need explicit transpilation under Next's default webpack config.
  transpilePackages: ["react-map-gl", "mapbox-gl"],
};

export default nextConfig;
