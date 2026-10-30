# Pet-Care-AI

Ứng dụng chăm sóc thú cưng tích hợp AI nhận diện giống loài và gợi ý dinh dưỡng.
Đồ án Capstone, học phần Phát triển ứng dụng di động đa nền tảng (VKU).

## Công nghệ
- React Native + Expo **SDK 57** + TypeScript + Expo Router
- Giao diện: react-native-paper (Material 3, có Dark Mode)
- Kiến trúc: Clean Architecture 3 lớp (domain, data, presentation)

## Cài đặt

1. Cài Node.js bản LTS (xem số trong `.nvmrc`), Git, VS Code.
2. Trên điện thoại cài **Expo Go bản mới nhất** (App Store hoặc CH Play).
3. Mở terminal và chạy lần lượt:

        git clone https://github.com/TrLy24/Pet-Care-AI.git
        cd Pet-Care-AI
        npm ci
        npx expo start

4. Quét mã QR bằng điện thoại (cùng Wi-Fi với máy tính).
5. Nếu cần biến môi trường: copy `.env.example` thành `.env` và điền giá trị (hỏi nhóm trưởng). **Không đưa `.env` lên GitHub.**

## Cấu trúc thư mục
- `src/domain`: quy tắc nghiệp vụ, thuần TypeScript, **không import UI hay thư viện ngoài**.
- `src/data`: lưu và lấy dữ liệu (local, Supabase, AI).
- `src/presentation`: màn hình, component, theme.
- `src/di`: nối các lớp lại với nhau.
- `src/app`: điều hướng (Expo Router), mỗi file chỉ hiển thị một màn hình từ `src/presentation`.

Thêm tính năng mới: làm theo mẫu tính năng Pet (entity, repository, usecase, repository cài đặt, screen).

## Quy ước làm việc
- Không code trực tiếp trên `main`. Mỗi việc một nhánh: `feature/...`, `fix/...`, `docs/...`.
- Commit viết theo dạng: `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`.
- Mọi thay đổi gộp vào `main` qua Pull Request, cần 1 người duyệt.
- Trước khi tạo Pull Request chạy: `npm run typecheck` và `npm test`.
- Không đưa `.env`, API key, keystore lên GitHub.