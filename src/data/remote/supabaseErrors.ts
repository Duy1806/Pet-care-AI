/**
 * PawCare AI — Supabase Error Mapper
 *
 * Maps standard Supabase Auth and PostgREST errors into friendly Vietnamese messages.
 */
import type { AuthError } from '@supabase/supabase-js';

export function mapSupabaseError(error: AuthError | Error | unknown): string {
  if (!error) return 'Đã xảy ra lỗi không xác định.';

  const message = error instanceof Error ? error.message : String(error);
  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes('invalid login credentials') ||
    lowerMsg.includes('invalid grant') ||
    lowerMsg.includes('invalid_credentials')
  ) {
    return 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.';
  }

  if (
    lowerMsg.includes('user already registered') ||
    lowerMsg.includes('user_already_exists') ||
    lowerMsg.includes('already exists')
  ) {
    return 'Email này đã được đăng ký tài khoản. Vui lòng đăng nhập hoặc dùng email khác.';
  }

  if (lowerMsg.includes('email not confirmed')) {
    return 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra hộp thư email của bạn.';
  }

  if (
    lowerMsg.includes('token has expired') ||
    lowerMsg.includes('otp expired') ||
    lowerMsg.includes('invalid token')
  ) {
    return 'Mã xác nhận đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu mã mới.';
  }

  if (
    lowerMsg.includes('over_email_send_rate_limit') ||
    lowerMsg.includes('rate limit') ||
    lowerMsg.includes('too many requests')
  ) {
    return 'Supabase miễn phí giới hạn gửi tối đa 2-3 email/giờ. Vui lòng đợi khoảng 30-60 phút hoặc kích hoạt Custom SMTP trong Dashboard.';
  }

  if (lowerMsg.includes('password should be at least')) {
    return 'Mật khẩu phải có ít nhất 8 ký tự theo tiêu chuẩn bảo mật.';
  }

  if (
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('connection refused')
  ) {
    return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng Internet của bạn.';
  }

  return message || 'Đã xảy ra lỗi. Vui lòng thử lại sau ít phút.';
}

