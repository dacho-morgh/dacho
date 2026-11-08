// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProfileDialog } from '@/components/dashboard/profile/profile-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { FieldLabel } from '@/components/ui/field'
import { SelectedFile } from '@/components/ui/file-input'
import { Form, FormField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

afterEach(cleanup)

const markers = () => document.querySelectorAll('[data-slot="required-marker"]')

describe('required marker (Design QA #277)', () => {
  it('FieldLabel and Label draw one decorative * that is not part of the label text', () => {
    render(
      createElement(
        'div',
        null,
        createElement(FieldLabel, { htmlFor: 'a', required: true }, 'نام'),
        createElement(Label, { htmlFor: 'b', required: true }, 'شهر'),
        createElement(FieldLabel, { htmlFor: 'c' }, 'اختیاری'),
        createElement('input', { id: 'a' }),
        createElement('input', { id: 'b' }),
        createElement('input', { id: 'c' }),
      ),
    )
    expect(markers()).toHaveLength(2)
    expect(markers()[0]?.getAttribute('aria-hidden')).toBe('true')
    // Not in the text, so the accessible name and exact label queries stay clean.
    expect(screen.getByLabelText('نام')).toBeTruthy()
    expect(screen.getByLabelText('شهر')).toBeTruthy()
  })

  it('FormField required marks the label and sets aria-required on the control', () => {
    function Harness() {
      const form = useForm({ defaultValues: { name: '', note: '' } })
      return createElement(
        Form,
        form as never,
        createElement(FormField, {
          control: form.control,
          name: 'name',
          label: 'نام',
          required: true,
          render: ({ field, controlProps }: { field: object; controlProps: object }) =>
            createElement(Input, { ...field, ...controlProps }),
        } as never),
        createElement(FormField, {
          control: form.control,
          name: 'note',
          label: 'توضیح',
          render: ({ field, controlProps }: { field: object; controlProps: object }) =>
            createElement(Input, { ...field, ...controlProps }),
        } as never),
      )
    }
    render(createElement(Harness))
    expect(markers()).toHaveLength(1)
    expect(screen.getByLabelText('نام').getAttribute('aria-required')).toBe('true')
    expect(screen.getByLabelText('توضیح').getAttribute('aria-required')).toBeNull()
  })

  it('an Input label gets the marker from aria-required or required', () => {
    render(
      createElement(
        'div',
        null,
        createElement(Input, { label: 'الف', 'aria-required': 'true', placeholder: 'x' }),
        createElement(Input, { label: 'ب', required: true, placeholder: 'x' }),
        createElement(Input, { label: 'ج', placeholder: 'x' }),
      ),
    )
    expect(markers()).toHaveLength(2)
  })
})

describe('primary action position and colour (Design QA #277)', () => {
  it('a filled primary label is white even when wrapped in Typography', () => {
    const classes = buttonVariants({ variant: 'primary' })
    expect(classes).toContain('text-fill-brand-foreground')
    expect(classes).toContain('[&_.text-foreground]:text-fill-brand-foreground')
  })

  it('DialogFooter keeps the primary button first in the DOM (right in RTL)', () => {
    render(
      createElement(
        Dialog,
        { open: true },
        createElement(
          DialogContent,
          { 'aria-describedby': undefined },
          createElement(DialogTitle, null, 'عنوان'),
          createElement(
            DialogFooter,
            null,
            createElement(Button, { variant: 'primary' }, 'ذخیره'),
            createElement(Button, { variant: 'outline-gray' }, 'انصراف'),
          ),
        ),
      ),
    )
    const footer = document.querySelector('[data-slot="dialog-footer"]')!
    expect(footer.closest('[dir="rtl"]')).toBeTruthy()
    expect(footer.firstElementChild?.textContent).toBe('ذخیره')
  })

  it('ProfileDialog renders primary before secondary', () => {
    render(
      createElement(
        ProfileDialog,
        {
          title: 'افزودن',
          onClose: vi.fn(),
          primary: createElement('button', { type: 'button' }, 'ثبت'),
          secondary: createElement('button', { type: 'button' }, 'انصراف'),
          children: createElement('input', { 'aria-label': 'نام' }),
        },
      ),
    )
    const footer = document.querySelector('[data-slot="dialog-footer"]')!
    expect(Array.from(footer.children).map((child) => child.textContent)).toEqual(['ثبت', 'انصراف'])
  })
})

describe('SelectedFile', () => {
  it('has an x that removes the picked file', () => {
    const onRemove = vi.fn()
    render(createElement(SelectedFile, { file: { name: 'receipt.pdf', size: 1_500_000 }, onRemove }))
    expect(screen.getByText('receipt.pdf')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'حذف receipt.pdf' }))
    expect(onRemove).toHaveBeenCalledOnce()
  })
})
