/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false, // ENABLE type safety during builds
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
