import path from 'path'
import { fileURLToPath } from 'url'
import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  output: 'standalone',
  // Temporarily required on Windows until Next.js fixes Turbopack Sass resolution.
  // See: https://github.com/vercel/next.js/issues/86431
  sassOptions: {
    loadPaths: ['./node_modules/@payloadcms/ui/dist/scss/'],
  },
  reactStrictMode: true,
  turbopack: {
    // Monorepo: `next` is hoisted to the workspace root, not this app's node_modules.
    root: path.resolve(dirname, '../../'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
