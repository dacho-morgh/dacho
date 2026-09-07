import type { GlobalConfig } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'
import { link } from '@cms-core/fields/link'
import { revalidateFooter } from './hooks/revalidateFooter'

export const Footer: GlobalConfig = {
  slug: 'footer',
  access: {
    read: () => true,
    update: authenticated,
  },
  admin: {
    group: 'Globals',
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'لوگو',
      admin: {
        description: 'لوگوی فوتر (در صورت عدم انتخاب، از لوگوی پیش‌فرض استفاده می‌شود)',
      },
    },
    {
      name: 'logoText',
      type: 'text',
      label: 'متن جایگزین لوگو',
      defaultValue: 'صندوق',
      admin: {
        description: 'متن لوگوتایپ یا متن جایگزین برای دسترسی‌پذیری',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'توضیحات',
      admin: {
        description: 'متن توضیحات زیر لوگو در فوتر',
      },
    },
    {
      name: 'address',
      type: 'text',
      label: 'آدرس',
      admin: {
        description: 'آدرس دفتر یا شرکت در فوتر',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'شماره تماس',
      admin: {
        description: 'شماره‌های تماس در فوتر',
      },
    },
    {
      name: 'columns',
      type: 'array',
      label: 'ستون‌های پیوندها',
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          required: true,
          label: 'عنوان ستون',
        },
        {
          name: 'navItems',
          type: 'array',
          label: 'پیوندها',
          fields: [
            link({
              appearances: false,
            }),
          ],
          admin: {
            initCollapsed: true,
            components: {
              RowLabel: '@/Footer/RowLabel#RowLabel',
            },
          },
        },
      ],
    },
    {
      name: 'navItems',
      type: 'array',
      label: 'پیوندهای تک‌ستونه (پشتیبانی گذشته‌نگر)',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
      admin: {
        initCollapsed: true,
        components: {
          RowLabel: '@/Footer/RowLabel#RowLabel',
        },
      },
    },
    {
      name: 'copyright',
      type: 'text',
      label: 'متن کپی‌رایت',
      admin: {
        description: 'متن حقوق و کپی‌رایت در انتهای فوتر',
      },
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'پیوندهای شبکه‌های اجتماعی',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'platform',
          type: 'text',
          required: true,
          label: 'نام پلتفرم',
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'آدرس (URL)',
        },
        {
          name: 'icon',
          type: 'upload',
          relationTo: 'media',
          label: 'آیکون (PNG یا SVG)',
          admin: {
            description: 'تصویر یا آیکون شبکه اجتماعی (PNG یا SVG)',
          },
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateFooter],
  },
}

