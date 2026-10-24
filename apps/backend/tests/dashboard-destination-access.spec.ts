import { describe, expect, it } from 'vitest'
import { canOpenDashboardDestination } from '../src/dashboard/destination-access.js'
import { dashboardSelfProfile } from '../src/dashboard/self-profile.js'

describe('current-role dashboard destinations', () => {
  it('allows the shared dashboard exactly without treating it as a route prefix', () => {
    expect(canOpenDashboardDestination('reviewer', '/dashboard')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/companies')).toBe(false)
    expect(canOpenDashboardDestination('representative', '/dashboard/employees')).toBe(false)
  })

  it('restricts company, employee, and company-profile routes to their current role', () => {
    expect(canOpenDashboardDestination('central-secretariat', '/dashboard/companies/42')).toBe(true)
    expect(canOpenDashboardDestination('reviewer', '/dashboard/companies/42')).toBe(false)
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
    expect(canOpenDashboardDestination('reviewer', '/dashboard%2fcompanies')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '/dashboard\\companies')).toBe(false)
    expect(canOpenDashboardDestination('reviewer', '//outside.example/dashboard')).toBe(false)
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
