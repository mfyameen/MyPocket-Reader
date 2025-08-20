/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false, // ENABLE security linting during builds
  },
  typescript: {
    ignoreBuildErrors: false, // ENABLE type safety during builds
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
