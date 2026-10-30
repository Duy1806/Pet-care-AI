/**
 * PawCare AI — Auth Repository Interface
 * Pure domain contract. Implementation can be mock or Supabase.
 */
import type { AuthSession, LoginResult, PetPreference, RegisterResult, User } from '../entities/User';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  petPreferences?: PetPreference[];
}

export interface AuthRepository {
  /** Sign in with email and password */
  signIn(email: string, password: string): Promise<LoginResult>;

  /** Create a new account */
  signUp(params: SignUpParams): Promise<RegisterResult>;

  /** Verify the OTP code sent after sign up */
  verifySignUpOtp(email: string, otp: string): Promise<LoginResult>;

  /** Resend the sign up verification OTP code */
  resendSignUpOtp(email: string): Promise<void>;

  /** Sign out the current user */
  signOut(): Promise<void>;

  /** Send a password reset code to the given email */
  sendPasswordResetCode(email: string): Promise<void>;

  /** Verify the OTP code sent for password reset */
  verifyResetOtp(email: string, otp: string): Promise<void>;

  /** Set a new password after OTP verification */
  resetPassword(email: string, newPassword: string): Promise<void>;

  /** Restore the session from secure storage (app start) */
  restoreSession(): Promise<AuthSession | null>;

  /** Get the currently signed-in user, or null */
  getCurrentUser(): Promise<User | null>;
}
