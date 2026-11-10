import { describe, expect, it } from 'vitest'

import { COMPANY_TYPE_OPTIONS as CMS_COMPANY_TYPE_OPTIONS } from '@dacho/cms-core/auth/self-signup'
import { COMPANY_TYPE_OPTIONS } from '../src/dashboard/company-info-rules.js'

describe('company info rules', () => {
  it('accepts exactly the company types the CMS select accepts', () => {
    expect([...COMPANY_TYPE_OPTIONS]).toEqual([...CMS_COMPANY_TYPE_OPTIONS])
  })
})
