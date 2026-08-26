import 'dotenv/config'
import { getPayload } from 'payload'
import type { RequiredDataFromCollectionSlug } from 'payload'

import config from '../src/payload.config.js'

// The two public forms from the Figma connect/cooperation design. Submissions
// land in the `form-submissions` collection, distinguishable by the `form`
// relationship. Field names must match what the frontend `MessageForm` sends.
const confirmationMessage = {
  root: {
    type: 'root',
    version: 1,
    direction: 'rtl' as const,
    format: '' as const,
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: 'rtl' as const,
        format: '' as const,
        indent: 0,
        children: [{ type: 'text', version: 1, text: 'پیام شما با موفقیت ارسال شد.' }],
      },
    ],
  },
}

const sharedFields = [
  {
    name: 'fullName',
    blockType: 'text',
    blockName: 'fullName',
    label: 'نام و نام خانوادگی',
    required: true,
    width: 100,
  },
  {
    name: 'email',
    blockType: 'email',
    blockName: 'email',
    label: 'ایمیل',
    required: true,
    width: 100,
  },
  {
    name: 'phone',
    blockType: 'number',
    blockName: 'phone',
    label: 'شماره همراه',
    required: true,
    width: 100,
  },
  {
    name: 'subject',
    blockType: 'text',
    blockName: 'subject',
    label: 'موضوع',
    required: true,
    width: 100,
  },
  {
    name: 'message',
    blockType: 'textarea',
    blockName: 'message',
    label: 'پیام',
    required: true,
    width: 100,
  },
] as const

const FORMS: RequiredDataFromCollectionSlug<'forms'>[] = [
  {
    title: 'فرم تماس با ما',
    submitButtonLabel: 'ارسال پیام',
    confirmationType: 'message',
    confirmationMessage,
    fields: [...sharedFields],
  },
  {
    title: 'درخواست همکاری',
    submitButtonLabel: 'ارسال درخواست',
    confirmationType: 'message',
    confirmationMessage,
    fields: [...sharedFields],
  },
]

async function main(): Promise<void> {
  const payload = await getPayload({ config })

  for (const formData of FORMS) {
    const existing = await payload.find({
      collection: 'forms',
      where: { title: { equals: formData.title } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      console.log(`Form "${formData.title}" already exists (id ${existing.docs[0]!.id})`)
    } else {
      const created = await payload.create({ collection: 'forms', data: formData })
      console.log(`Created form "${formData.title}" (id ${created.id})`)
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
