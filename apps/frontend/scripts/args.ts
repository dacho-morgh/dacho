/**
 * Tiny `--key=value` / `--key value` parser for the seed scripts.
 *
 * Precedence: command-line flag → environment variable → the caller's default.
 * Keeps secrets off the command line's history-free side by also accepting the
 * env var, which is what CI and compose use.
 */
export function readOption(name: string, envVar: string, fallback: string): string
export function readOption(name: string, envVar: string): string | undefined
export function readOption(
  name: string,
  envVar: string,
  fallback?: string,
): string | undefined {
  const argv = process.argv.slice(2)
  const flag = `--${name}`

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === flag) {
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) return next
      return undefined
    }
    if (arg?.startsWith(`${flag}=`)) {
      const value = arg.slice(flag.length + 1)
      return value === '' ? undefined : value
    }
  }

  const fromEnv = process.env[envVar]
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  return fallback
}