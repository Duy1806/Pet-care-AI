/**
 * PawCare AI — Supabase Auth Repository Implementation
 *
 * Implements the AuthRepository domain interface with real Supabase Auth.
 * Includes user metadata, profile syncing, recovery flow, Google OAuth, and Vietnamese error mapping.
 */
import type { AuthSession, LoginResult, RegisterResult, User, UserRole } from '../../domain/entities/User';
import type { AuthRepository, SignUpParams } from '../../domain/repositories/AuthRepository';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';

WebBrowser.maybeCompleteAuthSession();

export class AuthRepositorySupabase implements AuthRepository {
  /**
   * Helper: Fetch extra profile fields from public.profiles
   */
  private async getProfileData(userId: string): Promise<{
    fullName: string;
    phone: string;
    role: UserRole;
    avatarUrl: string | null;
    preferredTheme: 'light' | 'dark' | 'system';
  }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone, role, avatar_url, preferred_theme')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return {
          fullName: 'Chủ nuôi',
          phone: '',
          role: 'owner',
          avatarUrl: null,
          preferredTheme: 'system',
        };
      }

      return {
        fullName: data.full_name || 'Chủ nuôi',
        phone: data.phone || '',
        role: (data.role as UserRole) || 'owner',
        avatarUrl: data.avatar_url,
        preferredTheme: (data.preferred_theme as any) || 'system',
      };
    } catch {
      return {
        fullName: 'Chủ nuôi',
        phone: '',
        role: 'owner',
        avatarUrl: null,
        preferredTheme: 'system',
      };
    }
  }

  async signIn(email: string, password: string): Promise<LoginResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.user || !data.session) {
        throw new Error(mapSupabaseError(error));
      }

      const profile = await this.getProfileData(data.user.id);

      const user: User = {
        id: data.user.id,
        email: data.user.email || email,
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        preferredTheme: profile.preferredTheme,
        petPreferences: (data.user.user_metadata?.pet_preferences as any) || [],
        createdAt: data.user.created_at,
      };

      const session: AuthSession = {
        user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: (data.session.expires_at || 0) * 1000,
      };

      return { user, session };
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async signInWithGoogle(): Promise<LoginResult | null> {
    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw new Error(mapSupabaseError(error));
      }

      if (!data?.url) {
        throw new Error('Không thể khởi tạo phiên đăng nhập Google');
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

      if (result.type === 'success' && result.url) {
        // Parse params from redirect
        const parsed: Record<string, string> = {};
        const segments = result.url.split(/[#?&]/);
        for (const seg of segments) {
          const eqIdx = seg.indexOf('=');
          if (eqIdx !== -1) {
            const k = decodeURIComponent(seg.substring(0, eqIdx));
            const v = decodeURIComponent(seg.substring(eqIdx + 1));
            if (k && v) parsed[k] = v;
          }
        }

        if (parsed.access_token && parsed.refresh_token) {
          const { data: sData, error: sErr } = await supabase.auth.setSession({
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
          });
          if (sErr || !sData.user || !sData.session) {
            throw new Error(mapSupabaseError(sErr));
          }
          const profile = await this.getProfileData(sData.user.id);
          const user: User = {
            id: sData.user.id,
            email: sData.user.email || '',
            fullName: profile.fullName || sData.user.user_metadata?.full_name || 'Người dùng Google',
            phone: profile.phone,
            role: profile.role,
            avatarUrl: profile.avatarUrl || sData.user.user_metadata?.avatar_url || null,
            preferredTheme: profile.preferredTheme,
            petPreferences: (sData.user.user_metadata?.pet_preferences as any) || [],
            createdAt: sData.user.created_at,
          };
          const session: AuthSession = {
            user,
            accessToken: sData.session.access_token,
            refreshToken: sData.session.refresh_token,
            expiresAt: (sData.session.expires_at || 0) * 1000,
          };
          return { user, session };
        } else if (parsed.code) {
          const { data: sData, error: cErr } = await supabase.auth.exchangeCodeForSession(parsed.code);
          if (cErr || !sData.user || !sData.session) {
            throw new Error(mapSupabaseError(cErr));
          }
          const profile = await this.getProfileData(sData.user.id);
          const user: User = {
            id: sData.user.id,
            email: sData.user.email || '',
            fullName: profile.fullName || sData.user.user_metadata?.full_name || 'Người dùng Google',
            phone: profile.phone,
            role: profile.role,
            avatarUrl: profile.avatarUrl || sData.user.user_metadata?.avatar_url || null,
            preferredTheme: profile.preferredTheme,
            petPreferences: (sData.user.user_metadata?.pet_preferences as any) || [],
            createdAt: sData.user.created_at,
          };
          const session: AuthSession = {
            user,
            accessToken: sData.session.access_token,
            refreshToken: sData.session.refresh_token,
            expiresAt: (sData.session.expires_at || 0) * 1000,
          };
          return { user, session };
        }
      }

      // Check if session was updated in background
      const { data: existingSession } = await supabase.auth.getSession();
      if (existingSession?.session?.user) {
        const u = existingSession.session.user;
        const profile = await this.getProfileData(u.id);
        const user: User = {
          id: u.id,
          email: u.email || '',
          fullName: profile.fullName || u.user_metadata?.full_name || 'Người dùng Google',
          phone: profile.phone,
          role: profile.role,
          avatarUrl: profile.avatarUrl || u.user_metadata?.avatar_url || null,
          preferredTheme: profile.preferredTheme,
          petPreferences: (u.user_metadata?.pet_preferences as any) || [],
          createdAt: u.created_at,
        };
        const session: AuthSession = {
          user,
          accessToken: existingSession.session.access_token,
          refreshToken: existingSession.session.refresh_token,
          expiresAt: (existingSession.session.expires_at || 0) * 1000,
        };
        return { user, session };
      }

      return null;
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async signUp(params: SignUpParams): Promise<RegisterResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: {
          data: {
            full_name: params.fullName,
            phone: params.phone,
            pet_preferences: params.petPreferences || [],
          },
        },
      });

      if (error || !data.user) {
        throw new Error(mapSupabaseError(error));
      }

      const user: User = {
        id: data.user.id,
        email: data.user.email || params.email,
        fullName: params.fullName,
        phone: params.phone,
        role: 'owner',
        avatarUrl: null,
        preferredTheme: 'system',
        petPreferences: params.petPreferences || [],
        createdAt: data.user.created_at,
      };

      const hasSession = Boolean(data.session?.access_token);
      const session: AuthSession | null = hasSession
        ? {
            user,
            accessToken: data.session!.access_token,
            refreshToken: data.session!.refresh_token,
            expiresAt: (data.session!.expires_at || 0) * 1000,
          }
        : null;

      return {
        user,
        session,
        requiresEmailVerification: !hasSession || !data.user.confirmed_at,
      };
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async verifySignUpOtp(email: string, otp: string): Promise<LoginResult> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'signup',
      });

      if (error || !data.user || !data.session) {
        throw new Error(mapSupabaseError(error));
      }

      const profile = await this.getProfileData(data.user.id);

      const user: User = {
        id: data.user.id,
        email: data.user.email || email,
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        preferredTheme: profile.preferredTheme,
        petPreferences: (data.user.user_metadata?.pet_preferences as any) || [],
        createdAt: data.user.created_at,
      };

      const session: AuthSession = {
        user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: (data.session.expires_at || 0) * 1000,
      };

      return { user, session };
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async resendSignUpOtp(email: string): Promise<void> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) {
        throw new Error(mapSupabaseError(error));
      }
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async signOut(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(mapSupabaseError(error));
      }
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async sendPasswordResetCode(email: string): Promise<void> {
    try {
      const redirectUrl = Linking.createURL('forgot-password', {
        queryParams: { step: 'new-password' },
      });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        throw new Error(mapSupabaseError(error));
      }
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async verifyResetOtp(email: string, otp: string): Promise<void> {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'recovery',
      });
      if (error) {
        throw new Error(mapSupabaseError(error));
      }
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async resetPassword(_email: string, newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        throw new Error(mapSupabaseError(error));
      }
    } catch (e) {
      throw new Error(mapSupabaseError(e));
    }
  }

  async restoreSession(): Promise<AuthSession | null> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session || !data.session.user) {
        return null;
      }

      const profile = await this.getProfileData(data.session.user.id);

      const user: User = {
        id: data.session.user.id,
        email: data.session.user.email || '',
        fullName: profile.fullName,
        phone: profile.phone,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        preferredTheme: profile.preferredTheme,
        petPreferences: (data.session.user.user_metadata?.pet_preferences as any) || [],
        createdAt: data.session.user.created_at,
      };

      return {
        user,
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: (data.session.expires_at || 0) * 1000,
      };
    } catch {
      return null;
    }
  }

  async getCurrentUser(): Promise<User | null> {
    const session = await this.restoreSession();
    return session?.user || null;
  }

  async updateProfile(params: { fullName?: string; phone?: string; avatarUrl?: string | null }): Promise<User> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('Chưa đăng nhập.');
    }

    const updates: Record<string, any> = {};
    if (params.fullName !== undefined) updates.full_name = params.fullName.trim();
    if (params.phone !== undefined) updates.phone = params.phone.trim();
    if (params.avatarUrl !== undefined) updates.avatar_url = params.avatarUrl;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', authUser.id);

      if (error) {
        throw new Error(error.message || 'Không thể cập nhật thông tin hồ sơ.');
      }
    }

    if (params.fullName !== undefined) {
      await supabase.auth.updateUser({
        data: { full_name: params.fullName.trim() },
      });
    }

    const profile = await this.getProfileData(authUser.id);
    return {
      id: authUser.id,
      email: authUser.email || '',
      fullName: profile.fullName,
      phone: profile.phone,
      role: profile.role,
      avatarUrl: profile.avatarUrl,
      preferredTheme: profile.preferredTheme,
      petPreferences: (authUser.user_metadata?.pet_preferences as any) || [],
      createdAt: authUser.created_at,
    };
  }
}
