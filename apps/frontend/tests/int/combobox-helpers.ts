import { fireEvent, within } from '@testing-library/react'

/*
 * Drives the shared searchable dropdown (ComboboxField / DashboardSelect). Unlike a
 * native <select>, its options exist only while the list is open, and the input
 * shows the chosen option's label (the stored id goes to `onChange` / a hidden input).
 */

function openList(input: HTMLElement): HTMLElement {
  fireEvent.focus(input)
  const list = document.getElementById(input.getAttribute('aria-controls') ?? '')
  if (!list) throw new Error(`The list of ${input.id || 'the combobox'} did not open`)
  return list
}

/** Opens the list and returns the text of every option, then closes it again. */
export function optionTexts(input: HTMLElement): string[] {
  const texts = within(openList(input))
    .queryAllByRole('option')
    .map((option) => option.textContent ?? '')
  fireEvent.keyDown(input, { key: 'Escape' })
  return texts
}

/** Opens the list and picks the option whose visible label matches `name`. */
export function chooseOption(input: HTMLElement, name: string | RegExp): void {
  fireEvent.click(within(openList(input)).getByRole('option', { name }))
}
