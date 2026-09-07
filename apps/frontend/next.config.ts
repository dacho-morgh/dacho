import path from 'path'
import { fileURLToPath } from 'url'
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)
import { redirects } from './redirects'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Note: `output: 'standalone'` is intentionally NOT set — the Docker runner
  // serves via `next start` against a complete prod node_modules (the standalone
  // tracer only partially copies symlinked pnpm deps, e.g. @swc/helpers/esm).
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
      {
        pathname: '/figma/**',
        search: '',
      },
      {
        pathname: '/icons/**',
        search: '',
      },
      {
        pathname: '/images/**',
      },
    ],
    qualities: [75, 85, 100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL /* 'https://example.com' */].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  redirects,
  experimental: {
    optimizePackageImports: ['lucide-react', '@payloadcms/ui', '@dacho/cms-core'],
  },
  turbopack: {
    // Monorepo: `next` and the workspace packages are hoisted to the workspace
    // root, so Turbopack must resolve from there.
    root: path.resolve(dirname, '../../'),
  },
  // Transpile the workspace cms-core package (ships raw TS).
  transpilePackages: ['@dacho/cms-core'],
  allowedDevOrigins: ['192.168.100.14', '192.168.0.113', '127.0.0.1'],
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
