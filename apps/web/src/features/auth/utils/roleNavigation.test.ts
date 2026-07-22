import { describe, expect, it } from 'vitest'

import { homePathForRoles } from '@/features/auth/utils/roleNavigation'

describe('homePathForRoles', () => {
  it('routes every role to its own workspace', () => {
    expect(homePathForRoles(['student'])).toBe('/student')
    expect(homePathForRoles(['teacher'])).toBe('/teacher')
    expect(homePathForRoles(['technician'])).toBe('/technician')
  })

  it('uses a deterministic priority and denies users without roles', () => {
    expect(homePathForRoles(['technician', 'teacher'])).toBe('/teacher')
    expect(homePathForRoles([])).toBe('/login')
  })
})
