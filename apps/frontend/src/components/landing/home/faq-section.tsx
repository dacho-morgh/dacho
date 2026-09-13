import configPromise from '@payload-config'
import { getPayload } from 'payload'
import RichText from '@/components/RichText'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Typography } from '@/components/ui/typography'
import { buildSafe } from '@/utilities/buildSafe'

const FaqSection = async () => {
  const faqs = await buildSafe('home FAQ', async () => {
    const payload = await getPayload({ config: configPromise })
    const { docs } = await payload.find({
      collection: 'faq',
      pagination: false,
      sort: 'priority',
    })
    return docs
  })

  if (!faqs || faqs.length === 0) return null

  return (
    <section className="flex w-full flex-col items-center gap-10 bg-neutral-50 px-4 pt-10 pb-15 sm:px-6 lg:px-0 lg:py-20">
      <div className="flex w-full max-w-200 flex-col items-center gap-2 text-center">
        <Typography as="h2" variant="32/extrabold" sm="40/extrabold" color="neutral-600">
          سوالات پر تکرار
        </Typography>
        <Typography variant="16/regular" sm="20/regular" color="neutral-500" className="w-full">
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </Typography>
      </div>

      <Accordion type="single" collapsible className="w-full max-w-200 gap-4">
        {faqs.map((faq) => (
          <AccordionItem
            key={faq.id}
            value={String(faq.id)}
            className="rounded-2xl border-0! bg-neutral-100 px-4 data-[state=open]:pb-4"
          >
            <AccordionTrigger className="min-h-16 flex-row-reverse items-center rounded-none py-4 text-right hover:no-underline [&>svg]:size-8 [&>svg]:rounded-full [&>svg]:bg-neutral-200 [&>svg]:p-1.5 [&>svg]:text-neutral-700 [&[data-state=open]>svg]:bg-neutral-700 [&[data-state=open]>svg]:text-neutral-50">
              <Typography as="span" variant="16/semibold" color="neutral-700">
                {faq.title}
              </Typography>
            </AccordionTrigger>
            <AccordionContent className="pb-0 text-right">
              <Typography asChild variant="16/regular" color="neutral-600" className="[&_p]:m-0">
                <RichText data={faq.description} enableGutter={false} enableProse={false} />
              </Typography>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

export default FaqSection
