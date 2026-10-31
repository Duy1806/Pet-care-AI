/**
 * PawCare AI — Supabase Error Mapper
 *
 * Maps standard Supabase Auth and PostgREST errors into friendly Vietnamese messages.
 */
import type { AuthError } from '@supabase/supabase-js';

export function mapSupabaseError(error: AuthError | Error | unknown): string {
  if (!error) return 'Đã xảy ra lỗi không xác định.';

  let message = '';
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, any>;
    message = obj.message || obj.error_description || obj.details || obj.hint || obj.msg || '';
  }

  if (!message || message === '[object Object]') {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  const lowerMsg = message.toLowerCase();

  if (
    lowerMsg.includes('invalid input syntax for type uuid') ||
    lowerMsg.includes('22p02')
  ) {
    return 'Dữ liệu này là bản ghi mẫu cục bộ, không thể thao tác trên máy chủ từ xa.';
  }

  if (
    lowerMsg.includes('row-level security') ||
    lowerMsg.includes('violates row-level security policy')
  ) {
    return 'Bạn không có quyền thực hiện thao tác này hoặc phiên đăng nhập đã hết hạn.';
  }

  if (
    lowerMsg.includes('violates foreign key constraint') ||
    lowerMsg.includes('23503')
  ) {
    return 'Không thể xóa hồ sơ vì đang có dữ liệu y tế hoặc lịch tiêm chủng liên quan.';
  }

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

