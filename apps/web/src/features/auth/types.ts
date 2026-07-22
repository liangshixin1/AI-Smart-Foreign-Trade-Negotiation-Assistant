export type UserRole = 'student' | 'teacher' | 'technician'

export interface UserSummary {
  id: string
  email: string
  student_no: string | null
  display_name: string
  roles: UserRole[]
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  user: UserSummary
}

export interface PersistedAuth {
  accessToken: string
  refreshToken: string
  user: UserSummary
}
