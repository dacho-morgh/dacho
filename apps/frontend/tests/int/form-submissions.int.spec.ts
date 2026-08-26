import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'

// The contact forms are public to submit (form-builder default `create: true`)
// but readable only by CMS-role holders (we override `read` with hasCmsRole) —
// an anonymous or applicant user must never see submissions via the API.
const FORM_TITLE = 'int-test-form'

let payload: Payload
let formId: number | undefined

const cleanup = async () => {
  if (formId !== undefined) {
    await payload.delete({
      collection: 'form-submissions',
      where: { form: { equals: formId } },
    })
  }
  await payload.delete({
    collection: 'forms',
    where: { title: { equals: FORM_TITLE } },
  })
}

describe('form submissions', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()

    const form = await payload.create({
      collection: 'forms',
      data: {
        title: FORM_TITLE,
        submitButtonLabel: 'Submit',
        confirmationType: 'message',
        confirmationMessage: {
          root: {
            type: 'root',
            version: 1,
            direction: 'ltr' as const,
            format: '' as const,
            indent: 0,
            children: [
              {
                type: 'paragraph',
                version: 1,
                direction: 'ltr' as const,
                format: '' as const,
                indent: 0,
                children: [{ type: 'text', version: 1, text: 'ok' }],
              },
            ],
          },
        },
        fields: [
          {
            name: 'email',
            blockType: 'email',
            blockName: 'email',
            label: 'Email',
            required: true,
            width: 100,
          },
        ],
      },
    })
    formId = form.id
  })

  afterAll(async () => {
    await cleanup()
  })

  it('accepts a public submission', async () => {
    const submission = await payload.create({
      collection: 'form-submissions',
      overrideAccess: false,
      data: {
        form: formId!,
        submissionData: [{ field: 'email', value: 'test@example.com' }],
      },
    })

    expect(submission.id).toBeDefined()
    const formRef = submission.form
    expect(typeof formRef === 'number' ? formRef : formRef.id).toBe(formId)
  })

  it('hides submissions from anonymous reads', async () => {
    // A submission was created above; `read` is gated by hasCmsRole, so an
    // anonymous read must be rejected outright (false access → Forbidden).
    await expect(
      payload.find({
        collection: 'form-submissions',
        overrideAccess: false,
        pagination: false,
      }),
    ).rejects.toThrow(/Forbidden|not allowed/)
  })
})
