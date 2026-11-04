/**
 * PawCare AI — Supabase Auth Repository Implementation
 *
 * Implements the AuthRepository domain interface with real Supabase Auth.
 * Includes user metadata, profile syncing, recovery flow, and Vietnamese error mapping.
 */
import type { AuthSession, LoginResult, RegisterResult, User, UserRole } from '../../domain/entities/User';
import type { AuthRepository, SignUpParams } from '../../domain/repositories/AuthRepository';
import * as Linking from 'expo-linking';
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';

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
        preferredTheme: data.preferred_theme || 'system',
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

