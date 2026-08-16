import configPromise from '@dacho/cms-core'
import path from 'path'
import type { SanitizedConfig } from 'payload'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Thin wrapper: the CMS domain (collections, fields, hooks, access) lives in
// the React-free @dacho/cms-core package. The fused app re-exports that config
// but pins the admin import map to its own src dir, so custom admin components
// stay in this repo and `payload generate:importmap` writes here.
//
// buildConfig() is async (returns a Promise), so we await it before spreading.
export default (async (): Promise<SanitizedConfig> => {
  const config = await configPromise
  return {
    ...config,
    admin: {
      ...config.admin,
      importMap: {
        ...config.admin.importMap,
        baseDir: path.resolve(dirname),
      },
    },
  }
})()
