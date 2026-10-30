/**
 * PawCare AI — User Entity
 * Pure domain model. No framework dependencies.
 */

/** User role in the system */
export type UserRole = 'owner' | 'admin';

/** Pet species preference selected during registration */
export type PetPreference = 'dog' | 'cat' | 'other';

/** Represents an authenticated user */
export interface User {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  avatarUrl: string | null;
  preferredTheme: 'light' | 'dark' | 'system';
  petPreferences: PetPreference[];
  createdAt: string;
}

/** Session information for the current authenticated user */
export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/** Result of a registration attempt */
export interface RegisterResult {
  user: User;
  session?: AuthSession | null;
  /** Whether the user needs to verify their email with an OTP before signing in */
  requiresEmailVerification?: boolean;
}

/** Result of a login attempt */
export interface LoginResult {
  user: User;
  session: AuthSession;
}

/** OTP verification step in forgot-password flow */
export type ForgotPasswordStep = 'email' | 'otp' | 'new-password' | 'success';
