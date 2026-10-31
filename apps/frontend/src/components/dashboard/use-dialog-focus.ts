'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'

/**
 * Keyboard contract of a modal: focus moves in, Tab stays inside, Escape closes,
 * and closing returns focus to the control that opened it.
 */
export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void,
): void {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const fields = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
    // The first control is the close button; start on the first thing to fill in when there is one.
    const start = dialog.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
    ;(start ?? fields()[0])?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = fields()
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    dialog.addEventListener('keydown', onKeyDown)
    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [dialogRef])
}
