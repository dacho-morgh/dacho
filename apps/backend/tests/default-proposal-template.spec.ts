import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PROPOSAL_TEMPLATE_FILENAME,
  DEFAULT_PROPOSAL_TEMPLATE_MIME,
  defaultProposalTemplateBody,
} from '../src/dashboard/default-proposal-template.js'
import { validateDocumentFile } from '../src/documents/policy.js'

describe('the bundled sample proposal form', () => {
  it('is a Word document the document policy accepts, so the owner can swap it for another one', () => {
    const body = defaultProposalTemplateBody()
    expect(body.length).toBeGreaterThan(10_000)
    const result = validateDocumentFile({
      category: 'rfp',
      filename: DEFAULT_PROPOSAL_TEMPLATE_FILENAME,
      mimeType: DEFAULT_PROPOSAL_TEMPLATE_MIME,
      body,
    })
    expect(result.ok).toBe(true)
  })
})
