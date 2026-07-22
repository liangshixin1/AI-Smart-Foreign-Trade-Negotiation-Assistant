import { describe, expect, it } from 'vitest'

import { parsePersistedAuth } from '@/features/auth/utils/sessionValidation'

describe('parsePersistedAuth', () => {
  it('accepts a complete typed session', () => {
    const session = {
      accessToken: 'access',
      refreshToken: 'refresh',
      user: {
        id: 'user-id',
        email: 'student@example.test',
        student_no: '2026001',
        display_name: 'Student',
        roles: ['student'],
      },
    }
    expect(parsePersistedAuth(JSON.stringify(session))).toEqual(session)
  })

  it('rejects corrupt or privilege-injected sessions', () => {
    expect(parsePersistedAuth('{bad json')).toBeNull()
    expect(
      parsePersistedAuth(
        JSON.stringify({
          accessToken: 'a',
          refreshToken: 'r',
          user: {
            id: 'u',
            email: 'x',
            student_no: null,
            display_name: 'X',
            roles: ['superadmin'],
          },
        }),
      ),
    ).toBeNull()
  })
})
