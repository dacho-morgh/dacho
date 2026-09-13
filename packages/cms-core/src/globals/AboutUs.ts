import { authenticated } from '@cms-core/access/authenticated'
import type { GlobalConfig } from 'payload'
import { revalidateAboutUs } from './hooks/revalidateAboutUs'

export const AboutUs: GlobalConfig = {
  slug: 'about-us',
  label: 'About Us',
  access: {
    read: () => true,
    update: authenticated,
  },
  admin: {
    group: 'Pages',
  },
  fields: [
    {
      name: 'introduction',
      type: 'group',
      label: 'Introduction',
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
          label: 'Heading',
          defaultValue: 'پیوند هوشمندانه صنعت و فناوری در قلب انرژی کشور',
        },
        {
          name: 'description',
          type: 'textarea',
          required: true,
          label: 'Description',
          defaultValue:
            'کارخانه نوآوری نفت، گاز و پتروشیمی بوشهر، با هدف راه‌اندازی نخستین هاب تخصصی نوآوری در حوزه انرژی‌های فسیلی و تجدیدپذیر در منطقه راهبردی عسلویه شکل گرفته است.',
        },
        {
          name: 'statement',
          type: 'textarea',
          required: true,
          label: 'Highlighted Statement',
          defaultValue: 'رسالت ما، تبدیل چالش‌های واقعی صنعت به راهکارهای فناورانه و اقتصادی است',
        },
        {
          name: 'media',
          type: 'upload',
          relationTo: 'media',
          label: 'Image or Video',
          admin: {
            description: 'Upload an image or video for the introduction section.',
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateAboutUs],
  },
}
