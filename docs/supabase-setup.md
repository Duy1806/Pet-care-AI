# 🐾 Hướng dẫn Thiết lập Supabase cho PawCare AI

Tài liệu này hướng dẫn chi tiết cách cấu hình cơ sở dữ liệu Supabase cho môi trường Local (Supabase CLI) và Supabase Cloud.

---

## 1. Biến Môi Trường (`.env`)

Tạo file `.env` tại thư mục gốc dự án dựa trên `.env.example`:

```bash
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Giữ cờ true nếu muốn dùng mock auth trong lúc chưa cấu hình Supabase
EXPO_PUBLIC_USE_MOCK=false
```

> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG** đặt `SUPABASE_SERVICE_ROLE_KEY` trong code ứng dụng di động (`src/`). Client chỉ được sử dụng `ANON_KEY` kết hợp với Row-Level Security (RLS).

---

## 2. Triển Khai Migration & Seed Data

### Cách A: Sử dụng Supabase CLI (Khuyến nghị cho Developer)

1. Cài đặt Supabase CLI và đăng nhập:
   ```bash
   npx supabase login
   ```

2. Liên kết với project Supabase trên Cloud:
   ```bash
   npx supabase link --project-ref <your-project-id>
   ```

3. Đẩy toàn bộ migrations lên database:
   ```bash
   npx supabase db push
   ```

4. Nạp dữ liệu danh mục giống loài mẫu (Seed):
   ```bash
   npx supabase db reset # (Nếu chạy local)
   # hoặc chạy lệnh nạp seed:
   npx supabase db execute --file ./supabase/seed.sql
   ```

---

### Cách B: Sử dụng Supabase Studio (Giao diện Web)

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard) và chọn Project của bạn.
2. Vào mục **SQL Editor**.
3. Mở và chạy lần lượt các file SQL theo thứ tự:
   - `supabase/migrations/20261030000001_initial_schema.sql` (Cấu trúc bảng, trigger)
   - `supabase/migrations/20261030000002_rls_and_storage.sql` (RLS, Storage, Realtime)
   - `supabase/seed.sql` (30 giống chó mèo phổ biến)
4. Chạy kiểm tra cách ly dữ liệu:
   - Mở file `supabase/tests/rls_test.sql` và nhấn **Run** trong SQL Editor để xác nhận các bài test đều vượt qua (`NOTICE: ✅ TEST ĐẠT`).

---

## 3. Tạo Tài Khoản Quản Trị Viên (Admin Account)

1. Vào tab **Authentication** -> **Users** -> Nhấn **Add User** -> **Create User**.
2. Nhập email: `admin@pawcare.vn` và mật khẩu mạnh.
3. Mở **SQL Editor** và thực thi câu lệnh nâng quyền:
   ```sql
   UPDATE public.profiles
   SET role = 'admin'
   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@pawcare.vn');
   ```
4. Kiểm tra quyền tài khoản:
   ```sql
   SELECT id, full_name, email, role FROM public.profiles WHERE role = 'admin';
   ```

---

## 4. Xác minh Cấu hình Storage & Realtime

- **Storage**: Kiểm tra 3 buckets đã xuất hiện trong **Storage**:
  - `avatars`: Public Read (Ảnh đại diện người dùng)
  - `pet-photos`: Private (Ảnh thú cưng, chỉ chủ nuôi truy cập)
  - `breed-scan-images`: Private (Ảnh chụp nhận diện giống AI)
- **Realtime**: Trong mục **Database** -> **Replication**, đảm bảo 2 bảng `pets` và `reminders` đã được bật Realtime.

