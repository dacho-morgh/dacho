import { describe, expect, it } from 'vitest'
import { canOpenDashboardDestination } from '../src/dashboard/destination-access.js'
import { dashboardSelfProfile } from '../src/dashboard/self-profile.js'

describe('current-role dashboard destinations', () => {
  it('preserves inbox list and detail aliases for every operational role', () => {
    const roles = ['system-owner', 'central-secretariat', 'chief-reviewer', 'reviewer',
      'employer-reviewer', 'investment-reviewer', 'representative'] as const
    for (const role of roles) {
      expect(canOpenDashboardDestination(role, '/dashboard/inbox')).toBe(true)
      expect(canOpenDashboardDestination(role, '/dashboard/inbox/letter-id')).toBe(true)
      expect(canOpenDashboardDestination(role, '/dashboard/inbox-other')).toBe(false)
    }
  })

  it('opens a support or form mail detail whose id carries an escaped colon, and nothing else escaped', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    for (const role of ['representative', 'system-owner', 'central-secretariat'] as const) {
      expect(canOpenDashboardDestination(role, `/dashboard/letters/support%3A${id}`)).toBe(true)
      expect(canOpenDashboardDestination(role, `/dashboard/letters/support%3a${id}`)).toBe(true)
    }
    expect(canOpenDashboardDestination('representative', '/dashboard/letters/support%2F..%2Fcompanies')).toBe(false)
    expect(canOpenDashboardDestination('representative', '/dashboard/companies%3Ax')).toBe(false)
  })

  it('allows the shared dashboard exactly without treating it as a route prefix', () => {
    expect(canOpenDashboardDestination('reviewer', '/dashboard')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/companies')).toBe(false)
    expect(canOpenDashboardDestination('representative', '/dashboard/employees')).toBe(false)
  })

  it('restricts company, employee, and company-profile routes to their current role', () => {
    expect(canOpenDashboardDestination('central-secretariat', '/dashboard/companies/42')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/companies/42')).toBe(false)
    // A chief reviewer opens one company's page from a case, never the list or the pages beneath it.
    expect(canOpenDashboardDestination('chief-reviewer', '/dashboard/companies/42')).toBe(true)
    expect(canOpenDashboardDestination('chief-reviewer', '/dashboard/companies')).toBe(false)
    expect(canOpenDashboardDestination('chief-reviewer', '/dashboard/companies/42/requests/7')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/employees')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/profile/company')).toBe(false)
    expect(canOpenDashboardDestination('representative', '/dashboard/profile/company')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/profile/account')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/profile/staff')).toBe(true)
    expect(canOpenDashboardDestination('representative', '/dashboard/profile/staff')).toBe(false)
  })

  it('keeps case pages scoped by role and rejects path-normalization tricks', () => {
    expect(canOpenDashboardDestination('investment-reviewer', '/dashboard/requests/abc/evaluation')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/requests/../companies')).toBe(false)
    expect(canOpenDashboardDestination('central-secretariat', '/dashboard/follow-ups')).toBe(true)
    expect(canOpenDashboardDestination('system-owner', '/dashboard/follow-ups')).toBe(true)
    expect(canOpenDashboardDestination('investment-reviewer', '/dashboard/follow-ups')).toBe(false)
    expect(canOpenDashboardDestination('representative', '/dashboard/follow-ups')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '/dashboard%2fcompanies')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '/dashboard\\companies')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '//outside.example/dashboard')).toBe(false)
  })

  it('allows management roles and representatives to access exhibition routes', () => {
    expect(canOpenDashboardDestination('system-owner', '/dashboard/exhibitions')).toBe(true)
    expect(canOpenDashboardDestination('system-owner', '/dashboard/exhibitions/ex-1')).toBe(true)
    expect(canOpenDashboardDestination('system-owner', '/dashboard/events')).toBe(true)
    expect(canOpenDashboardDestination('central-secretariat', '/dashboard/exhibitions/ex-1')).toBe(true)
    expect(canOpenDashboardDestination('representative', '/dashboard/exhibitions/ex-1')).toBe(true)
    expect(canOpenDashboardDestination('chief-reviewer', '/dashboard/exhibitions/ex-1')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/exhibitions')).toBe(false)
  })

  it('keeps the event and exhibition admin pages to the System Owner (S5)', () => {
    const adminPages = [
      '/dashboard/events/new',
      '/dashboard/events/0f5f8c1e-3b8a-4c7e-9a43-2f6a1c0d9e11/edit',
      '/dashboard/events/0f5f8c1e-3b8a-4c7e-9a43-2f6a1c0d9e11/subtopics',
      '/dashboard/exhibitions/12/edit',
    ]
    for (const path of adminPages) {
      expect(canOpenDashboardDestination('system-owner', path)).toBe(true)
      for (const role of ['central-secretariat', 'chief-reviewer', 'reviewer', 'employer-reviewer', 'investment-reviewer', 'representative'] as const) {
        expect(canOpenDashboardDestination(role, path)).toBe(false)
      }
    }
    // Companies keep the public event list and booth pages.
    expect(canOpenDashboardDestination('representative', '/dashboard/events')).toBe(true)
    expect(canOpenDashboardDestination('representative', '/dashboard/exhibitions/12')).toBe(true)
  })
})

describe('dashboard own-profile projection', () => {
  it('returns only the current person’s safe profile fields', () => {
    const profile = dashboardSelfProfile({
      id: 'user-7', phone: '+989121234567', email: 'reviewer@example.test', name: 'داور',
      position: 'بررسی پرونده', roles: ['admin', 'editor'], operationalRole: 'reviewer',
      companyId: 'company-9', isActive: true,
    }, 'reviewer')

    expect(profile).toEqual({
      name: 'داور', position: 'بررسی پرونده', role: 'reviewer',
      contacts: { phone: '+989121234567', email: 'reviewer@example.test' },
    })
    expect(profile).not.toHaveProperty('id')
    expect(profile).not.toHaveProperty('roles')
    expect(profile).not.toHaveProperty('companyId')
  })
})
