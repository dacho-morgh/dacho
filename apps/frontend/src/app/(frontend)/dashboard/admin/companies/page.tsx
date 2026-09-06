import { CompanyList } from '@/components/dashboard/company-list'
import { Typography } from '@/components/ui/typography'

export default function AdminCompaniesPage() {
  return (
    <main className="flex min-h-screen min-w-0 flex-1 flex-col gap-5 p-4 lg:px-4 lg:pt-10 lg:pb-4">
      <Typography variant="h3" color="neutral-900">
        شرکت ها
      </Typography>
      <CompanyList />
    </main>
  )
}
