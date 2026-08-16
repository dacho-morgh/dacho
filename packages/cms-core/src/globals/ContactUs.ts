import type { GlobalConfig } from 'payload'

import { authenticated } from '@cms-core/access/authenticated'

export const ContactUs: GlobalConfig = {
  slug: 'contact-us',
  label: 'Contact Us',
  access: {
    read: () => true,
    update: authenticated,
  },
  admin: {
    group: 'Globals',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Contact Us',
      label: 'Heading',
    },
    {
      name: 'subtext',
      type: 'textarea',
      label: 'Subtext',
    },
    {
      name: 'email',
      type: 'email',
      label: 'Destination Email',
      admin: {
        description: 'Where form submissions will be sent',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Phone Number',
    },
    {
      name: 'address',
      type: 'richText',
      label: 'Address',
    },
    {
      name: 'mapEmbed',
      type: 'textarea',
      label: 'Map Embed URL',
      admin: {
        description: 'Google Maps or Neshan embed iframe URL',
      },
    },
    {
      name: 'formFields',
      type: 'array',
      label: 'Form Fields',
      admin: {
        description: 'Configurable fields shown on the contact form',
        initCollapsed: true,
      },
      defaultValue: [
        {
          label: 'Name',
          fieldKey: 'name',
          fieldType: 'text',
          isRequired: true,
          placeholder: 'Your name',
        },
        {
          label: 'Email',
          fieldKey: 'email',
          fieldType: 'email',
          isRequired: true,
          placeholder: 'your@email.com',
        },
        {
          label: 'Subject',
          fieldKey: 'subject',
          fieldType: 'text',
          isRequired: true,
          placeholder: 'What is this about?',
        },
        {
          label: 'Message',
          fieldKey: 'message',
          fieldType: 'textarea',
          isRequired: true,
          placeholder: 'Your message...',
        },
      ],
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'fieldKey',
          type: 'text',
          required: true,
        },
        {
          name: 'fieldType',
          type: 'select',
          required: true,
          defaultValue: 'text',
          options: [
            { label: 'Text', value: 'text' },
            { label: 'Email', value: 'email' },
            { label: 'Textarea', value: 'textarea' },
          ],
        },
        {
          name: 'isRequired',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'placeholder',
          type: 'text',
        },
      ],
    },
  ],
}
