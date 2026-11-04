/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@shelf/shared'],
  experimental: {
    // server actions body size limit (clip uploads / long notes)
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
}
export default nextConfig
