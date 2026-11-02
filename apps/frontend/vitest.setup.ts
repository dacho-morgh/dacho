// Any setup scripts you might need go here

// Load .env files
import 'dotenv/config'

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}


// Dashboard results are announced as sonner toasts from the layout's Toaster.
// Component tests render without the layout, so mount one per jsdom test.
if (typeof document !== 'undefined') {
  const { afterEach, beforeEach } = await import('vitest')
  const { act, createElement } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { toast } = await import('sonner')
  const { Toaster } = await import('@/components/ui/sonner')
  let root: import('react-dom/client').Root | null = null
  let host: HTMLDivElement | null = null
  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root?.render(createElement(Toaster)))
  })
  afterEach(() => {
    toast.dismiss()
    act(() => root?.unmount())
    host?.remove()
    root = null
    host = null
  })
}
