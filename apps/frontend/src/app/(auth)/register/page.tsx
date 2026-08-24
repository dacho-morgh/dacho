import type { Metadata } from 'next'
import RegisterPage from '@/components/auth/register-page'

export const metadata: Metadata = {
  title: 'ثبت‌نام | صندوق نوآوری بوشهر',
  description: 'ثبت‌نام در سامانه صندوق پژوهش و فناوری استان بوشهر',
}

export default function Page() {
  return <RegisterPage />
}
