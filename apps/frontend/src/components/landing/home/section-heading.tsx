import { Typography } from '@/components/ui/typography'

type SectionHeadingProps = {
  title: string
  description: string
}

const SectionHeading = ({ title, description }: SectionHeadingProps) => (
  <div className="mx-auto flex w-full max-w-7xl flex-col items-end gap-2 px-4 text-right lg:px-0">
    <div className="flex items-center justify-end gap-4">
      <Typography as="h2" variant="32/extrabold" sm="40/extrabold" color="neutral-600">
        {title}
      </Typography>
      <span aria-hidden="true" className="h-12 w-2 shrink-0 rounded-lg bg-secondary-500" />
    </div>
    <Typography variant="16/regular" sm="20/regular" color="neutral-500">
      {description}
    </Typography>
  </div>
)

export default SectionHeading
