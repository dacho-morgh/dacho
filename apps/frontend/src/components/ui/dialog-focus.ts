/** Start a dialog on its first field to fill in, not on the close control (Radix onOpenAutoFocus). */
export function focusFirstField(event: Event): void {
  const content = event.currentTarget
  if (!(content instanceof HTMLElement)) return
  const field = content.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
  if (!field) return
  event.preventDefault()
  field.focus()
}
