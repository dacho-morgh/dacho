import type { ReactNode } from 'react'

export default function LetterDetailLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen w-full min-w-0 flex-col gap-6 bg-neutral-50 px-4 pb-4 pt-10" dir="rtl">
      {children}
    </main>
  )
}
