/**
 * PawCare AI — Mock Auth Repository
 *
 * Simulates network requests with configurable delays.
 * Supports testing error states:
 * - wrong password → "Sai mật khẩu"
 * - email already exists → "Email đã được sử dụng"
 * - wrong OTP → "Mã xác nhận không đúng"
 * - unknown email on reset → "Không tìm thấy tài khoản"
 */
import type { AuthSession, LoginResult, RegisterResult, User } from '../../domain/entities/User';
import type { AuthRepository, SignUpParams } from '../../domain/repositories/AuthRepository';

/** Simulated delay (ms) to mimic network latency */
const MOCK_DELAY = 1200;

/** Simulate a network call */
const delay = (ms: number = MOCK_DELAY): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** In-memory user store for the mock */
const mockUsers = new Map<string, { user: User; password: string }>();

/** Pre-seed a demo user */
mockUsers.set('demo@pawcare.vn', {
  user: {
    id: 'mock-user-001',
    email: 'demo@pawcare.vn',
    fullName: 'Nguyễn Văn An',
    phone: '0901234567',
    role: 'owner',
    avatarUrl: null,
    preferredTheme: 'system',
    petPreferences: ['dog'],
    createdAt: new Date().toISOString(),
  },
  password: 'Demo@123',
});

/** The mock OTP that always works */
const MOCK_VALID_OTP = '123456';

/** Track which emails have been verified (OTP step passed) */
const verifiedResetEmails = new Set<string>();

let currentSession: AuthSession | null = null;

function createSession(user: User): AuthSession {
  return {
    user,
    accessToken: `mock-access-${Date.now()}`,
    refreshToken: `mock-refresh-${Date.now()}`,
    expiresAt: Date.now() + 3600 * 1000,
  };
}

export class AuthRepositoryMock implements AuthRepository {
  /** Pending unverified sign-up accounts */
  private pendingSignUps = new Map<string, { user: User; password: string }>();

  async signIn(email: string, password: string): Promise<LoginResult> {
    await delay();
    const entry = mockUsers.get(email);
    if (!entry) {
      throw new Error('Không tìm thấy tài khoản với email này');
    }
    if (entry.password !== password) {
      throw new Error('Sai mật khẩu. Vui lòng thử lại');
    }
    const session = createSession(entry.user);
    currentSession = session;
    return { user: entry.user, session };
  }

  async signUp(params: SignUpParams): Promise<RegisterResult> {
    await delay();
    if (mockUsers.has(params.email)) {
      throw new Error('Email đã được sử dụng. Vui lòng dùng email khác');
    }
    const user: User = {
      id: `mock-user-${Date.now()}`,
      email: params.email,
      fullName: params.fullName,
      phone: params.phone,
      role: 'owner',
      avatarUrl: null,
      preferredTheme: 'system',
      petPreferences: params.petPreferences ?? [],
      createdAt: new Date().toISOString(),
    };
    this.pendingSignUps.set(params.email, { user, password: params.password });
    console.log(`[Mock] Sign Up Verification OTP for ${params.email}: ${MOCK_VALID_OTP}`);
    return {
      user,
      session: null,
      requiresEmailVerification: true,
    };
  }

  async verifySignUpOtp(email: string, otp: string): Promise<LoginResult> {
    await delay(600);
    if (otp !== MOCK_VALID_OTP) {
      throw new Error('Mã OTP xác nhận không đúng. Vui lòng kiểm tra lại');
    }
    const pending = this.pendingSignUps.get(email);
    if (pending) {
      mockUsers.set(email, pending);
      this.pendingSignUps.delete(email);
      const session = createSession(pending.user);
      currentSession = session;
      return { user: pending.user, session };
    }
    const existing = mockUsers.get(email);
    if (existing) {
      const session = createSession(existing.user);
      currentSession = session;
      return { user: existing.user, session };
    }
    throw new Error('Không tìm thấy thông tin đăng ký cho email này');
  }

  async resendSignUpOtp(email: string): Promise<void> {
    await delay(400);
    console.log(`[Mock] Resent Sign Up OTP for ${email}: ${MOCK_VALID_OTP}`);
  }

  async signOut(): Promise<void> {
    await delay(500);
    currentSession = null;
  }

  async sendPasswordResetCode(email: string): Promise<void> {
    await delay();
    if (!mockUsers.has(email)) {
      // Auto-register so user can test forgot password with ANY email in mock mode
      const user: User = {
        id: `mock-user-${Date.now()}`,
        email,
        fullName: 'Chủ nuôi',
        phone: '',
        role: 'owner',
        avatarUrl: null,
        preferredTheme: 'system',
        petPreferences: [],
        createdAt: new Date().toISOString(),
      };
      mockUsers.set(email, { user, password: 'Demo@123' });
    }
    // In a real app this sends an email. Mock logs OTP.
    console.log(`[Mock] Reset Password OTP for ${email}: ${MOCK_VALID_OTP}`);
  }

  async verifyResetOtp(email: string, otp: string): Promise<void> {
    await delay(800);
    if (otp !== MOCK_VALID_OTP) {
      throw new Error('Mã xác nhận không đúng. Vui lòng kiểm tra lại');
    }
    verifiedResetEmails.add(email);
  }

  async resetPassword(email: string, newPassword: string): Promise<void> {
    await delay();
    if (!verifiedResetEmails.has(email)) {
      throw new Error('Phiên xác minh đã hết hạn. Vui lòng thử lại');
    }
    const entry = mockUsers.get(email);
    if (!entry) {
      throw new Error('Không tìm thấy tài khoản');
    }
    entry.password = newPassword;
    verifiedResetEmails.delete(email);
  }

  async restoreSession(): Promise<AuthSession | null> {
    await delay(600);
    return currentSession;
  }

  async getCurrentUser(): Promise<User | null> {
    return currentSession?.user ?? null;
  }
}
