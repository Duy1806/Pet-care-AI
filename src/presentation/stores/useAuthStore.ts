/**
 * PawCare AI — Auth Store
 *
 * Global auth state managed by Zustand.
 * All actions delegate to domain use-cases via the DI container.
 * The store NEVER imports data-layer code directly.
 */
import { create } from 'zustand';
import type { AuthSession, ForgotPasswordStep, User } from '../../domain/entities/User';
import type { SignUpParams } from '../../domain/repositories/AuthRepository';
import {
  forgotPasswordUseCase,
  loginUseCase,
  logoutUseCase,
  registerUseCase,
  restoreSessionUseCase,
} from '../../di/container';

interface AuthState {
  /** Current user, null when not authenticated */
  user: User | null;
  /** Current session tokens */
  session: AuthSession | null;
  /** Global loading flag for auth operations */
  isLoading: boolean;
  /** Whether session restoration has completed (app init) */
  isInitialized: boolean;
  /** Last error message (Vietnamese) */
  error: string | null;

  // --- Sign Up Verification State ---
  signUpEmail: string;
  isVerifyingSignUp: boolean;

  // --- Forgot Password Flow State ---
  /** Current step in the forgot-password flow */
  forgotPasswordStep: ForgotPasswordStep;
  /** Email entered in step 1, carried through the flow */
  forgotPasswordEmail: string;

  // --- Actions ---
  /** Restore session from secure storage on app start */
  initialize: () => Promise<void>;
  /** Sign in with email and password */
  login: (email: string, password: string) => Promise<boolean>;
  /** Create a new account */
  register: (params: SignUpParams) => Promise<'success' | 'requires_verification' | false>;
  /** Verify OTP after sign up */
  verifySignUpOtp: (otp: string) => Promise<boolean>;
  /** Resend sign up OTP */
  resendSignUpOtp: () => Promise<boolean>;
  /** Cancel unverified sign up */
  cancelSignUpVerification: () => void;
  /** Sign out */
  logout: () => Promise<void>;
  /** Clear error state */
  clearError: () => void;

  // --- Forgot Password Actions ---
  /** Step 1: Send OTP to email */
  sendResetCode: (email: string) => Promise<boolean>;
  /** Step 2: Verify the OTP */
  verifyOtp: (otp: string) => Promise<boolean>;
  /** Step 3: Set new password */
  resetPassword: (newPassword: string) => Promise<boolean>;
  /** Reset the forgot-password flow */
  resetForgotPasswordFlow: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,
  error: null,
  signUpEmail: '',
  isVerifyingSignUp: false,
  forgotPasswordStep: 'email',
  forgotPasswordEmail: '',

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      const session = await restoreSessionUseCase.execute();
      set({
        user: session?.user ?? null,
        session,
        isInitialized: true,
        isLoading: false,
      });
    } catch {
      set({ isInitialized: true, isLoading: false });
    }
  },

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const result = await loginUseCase.execute(email, password);
      set({
        user: result.user,
        session: result.session,
        isLoading: false,
      });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  register: async (params) => {
    try {
      set({ isLoading: true, error: null, signUpEmail: params.email });
      const result = await registerUseCase.execute(params);
      if (result.requiresEmailVerification) {
        set({
          isLoading: false,
          isVerifyingSignUp: true,
          user: result.user,
          session: null,
        });
        return 'requires_verification';
      }
      set({
        user: result.user,
        session: result.session ?? null,
        isVerifyingSignUp: false,
        isLoading: false,
      });
      return 'success';
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  verifySignUpOtp: async (otp) => {
    try {
      set({ isLoading: true, error: null });
      const email = get().signUpEmail;
      const result = await registerUseCase.verifyOtp(email, otp);
      set({
        user: result.user,
        session: result.session,
        isVerifyingSignUp: false,
        isLoading: false,
      });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  resendSignUpOtp: async () => {
    try {
      set({ isLoading: true, error: null });
      const email = get().signUpEmail;
      await registerUseCase.resendOtp(email);
      set({ isLoading: false });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  cancelSignUpVerification: () => {
    set({
      isVerifyingSignUp: false,
      signUpEmail: '',
      user: null,
      session: null,
      error: null,
    });
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await logoutUseCase.execute();
      set({ user: null, session: null, isLoading: false, error: null });
    } catch {
      set({ user: null, session: null, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  sendResetCode: async (email) => {
    try {
      set({ isLoading: true, error: null, forgotPasswordEmail: email });
      await forgotPasswordUseCase.sendCode(email);
      set({ isLoading: false, forgotPasswordStep: 'otp' });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  verifyOtp: async (otp) => {
    try {
      set({ isLoading: true, error: null });
      await forgotPasswordUseCase.verifyOtp(get().forgotPasswordEmail, otp);
      set({ isLoading: false, forgotPasswordStep: 'new-password' });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  resetPassword: async (newPassword) => {
    try {
      set({ isLoading: true, error: null });
      await forgotPasswordUseCase.resetPassword(get().forgotPasswordEmail, newPassword);
      set({ isLoading: false, forgotPasswordStep: 'success' });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Đã xảy ra lỗi';
      set({ isLoading: false, error: message });
      return false;
    }
  },

  resetForgotPasswordFlow: () =>
    set({
      forgotPasswordStep: 'email',
      forgotPasswordEmail: '',
      error: null,
    }),
}));
