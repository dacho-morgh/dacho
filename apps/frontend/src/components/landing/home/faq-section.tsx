import configPromise from '@payload-config'
import { getPayload } from 'payload'
import RichText from '@/components/RichText'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

const FaqSection = async () => {
  const payload = await getPayload({ config: configPromise })
  const { docs: faqs } = await payload.find({
    collection: 'faq',
    pagination: false,
    sort: 'priority',
  })

  if (faqs.length === 0) return null

  return (
    <section className="flex w-full flex-col items-center gap-10 bg-[#FAFAFA] px-4 py-24 sm:px-6 sm:py-32 lg:px-0 lg:py-40">
      <div className="flex w-full max-w-200 flex-col items-center gap-2 text-center">
        <h2 className="text-[40px] leading-16 font-medium text-[#525252]">سوالات پر تکرار</h2>
        <p className="w-full text-xl leading-8 font-light text-[#737373]">
          از انتشار فرصت‌های صنعتی تا داوری تخصصی و تخصیص بودجه، تمام مسیر همکاری در یک فضای یکپارچه
          مدیریت می‌شود.
        </p>
      </div>

      <Accordion type="single" collapsible className="w-full max-w-200 gap-4">
        {faqs.map((faq) => (
          <AccordionItem
            key={faq.id}
            value={String(faq.id)}
            className="rounded-2xl border-0! bg-[#F5F5F5] px-4 data-[state=open]:pb-4"
          >
            <AccordionTrigger className="min-h-16 flex-row-reverse items-center rounded-none py-4 text-right text-base leading-7 font-normal! text-[#404040] hover:no-underline [&>svg]:size-8 [&>svg]:rounded-full [&>svg]:bg-[#E5E5E5] [&>svg]:p-1.5 [&>svg]:text-[#404040] [&[data-state=open]>svg]:bg-[#404040] [&[data-state=open]>svg]:text-[#FAFAFA]">
              {faq.title}
            </AccordionTrigger>
            <AccordionContent className="pb-0 text-right text-base! leading-7! font-light! text-[#525252]!">
              <RichText
                className="[&_p]:m-0"
                data={faq.description}
                enableGutter={false}
                enableProse={false}
              />
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}

export default FaqSection
