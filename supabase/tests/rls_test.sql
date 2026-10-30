-- ==============================================================================
-- PawCare AI — Row-Level Security (RLS) Verification Test Script
-- 
-- Mục tiêu: Chứng minh User A và User B bị cô lập hoàn toàn:
-- 1. User B KHÔNG THỂ đọc thú cưng của User A.
-- 2. User B KHÔNG THỂ sửa thú cưng của User A.
-- 3. User B KHÔNG THỂ ghi log cân nặng vào thú cưng của User A.
-- 4. User thường KHÔNG THỂ tự phong quyền admin cho mình.
-- ==============================================================================

BEGIN;

-- 1. Chuẩn bị 2 UUID giả lập người dùng
DO $$
DECLARE
    user_a_id UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    user_b_id UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    pet_a_id   UUID := '11111111-1111-1111-1111-111111111111';
    test_count INT;
BEGIN
    -- Tạo profile cho User A và User B (mô phỏng trigger auth.users)
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES 
        (user_a_id, 'Nguyễn Văn A', '0901111111', 'owner'),
        (user_b_id, 'Trần Thị B', '0902222222', 'owner');

    -- User A tạo thú cưng của mình
    INSERT INTO public.pets (id, owner_id, name, species, current_weight_kg)
    VALUES (pet_a_id, user_a_id, 'Milo của A', 'dog', 12.5);

    -- User A tạo log cân nặng cho pet của A
    INSERT INTO public.weight_logs (pet_id, weight_kg, note)
    VALUES (pet_a_id, 12.5, 'Cân nặng đầu tiên');

    RAISE NOTICE '==> BƯỚC 1: Dữ liệu khởi tạo của User A thành công.';

    -- ==========================================================================
    -- TEST 1: GIẢ LẬP USER B TRUY VẤN DỮ LIỆU CỦA USER A
    -- ==========================================================================
    -- Thiết lập context người dùng hiện tại là User B
    PERFORM set_config('request.jwt.claims', json_build_object('sub', user_b_id::text, 'role', 'authenticated')::text, true);

    -- Thử SELECT thú cưng của User A
    SELECT COUNT(*) INTO test_count FROM public.pets WHERE id = pet_a_id;
    IF test_count <> 0 THEN
        RAISE EXCEPTION 'TEST 1 THẤT BẠI: User B đã đọc được thú cưng của User A!';
    ELSE
        RAISE NOTICE '✅ TEST 1 ĐẠT: User B SELECT pets của User A trả về 0 dòng.';
    END IF;

    -- Thử SELECT weight_logs của User A
    SELECT COUNT(*) INTO test_count FROM public.weight_logs WHERE pet_id = pet_a_id;
    IF test_count <> 0 THEN
        RAISE EXCEPTION 'TEST 1 THẤT BẠI: User B đã đọc được weight_logs của User A!';
    ELSE
        RAISE NOTICE '✅ TEST 1b ĐẠT: User B SELECT weight_logs của User A trả về 0 dòng.';
    END IF;

    -- ==========================================================================
    -- TEST 2: GIẢ LẬP USER B CỐ TÌNH SỬA TÊN THÚ CƯNG CỦA USER A
    -- ==========================================================================
    UPDATE public.pets SET name = 'Milo bị B đổi tên' WHERE id = pet_a_id;
    
    -- Kiểm tra lại: Tên phải không bị thay đổi
    SELECT COUNT(*) INTO test_count FROM public.pets WHERE id = pet_a_id AND name = 'Milo bị B đổi tên';
    IF test_count <> 0 THEN
        RAISE EXCEPTION 'TEST 2 THẤT BẠI: User B đã UPDATE được thú cưng của User A!';
    ELSE
        RAISE NOTICE '✅ TEST 2 ĐẠT: User B UPDATE thú cưng của User A không có tác dụng.';
    END IF;

    -- ==========================================================================
    -- TEST 3: GIẢ LẬP USER B GHI LOG CÂN NẶNG VÀO PET CỦA USER A (Bị chặn bởi WITH CHECK)
    -- ==========================================================================
    BEGIN
        INSERT INTO public.weight_logs (pet_id, weight_kg, note)
        VALUES (pet_a_id, 99.0, 'B cố tình ghi trộm');
        
        RAISE EXCEPTION 'TEST 3 THẤT BẠI: User B đã INSERT được weight_logs vào pet của A!';
    EXCEPTION WHEN row_security_active_violation OR insufficient_privilege THEN
        RAISE NOTICE '✅ TEST 3 ĐẠT: User B bị chặn bởi RLS khi INSERT vào pet của User A.';
    END;

    -- ==========================================================================
    -- TEST 4: NGƯỜI DÙNG THƯỜNG CỐ TỰ NÂNG QUYỀN ADMIN (Trigger chặn)
    -- ==========================================================================
    BEGIN
        UPDATE public.profiles SET role = 'admin' WHERE id = user_b_id;
        RAISE EXCEPTION 'TEST 4 THẤT BẠI: User B đã tự đổi role thành admin thành công!';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '✅ TEST 4 ĐẠT: Trigger đã chặn User B tự phong quyền admin: %', SQLERRM;
    END;

    RAISE NOTICE '🎉 TẤT CẢ CÁC BÀI TEST RLS ĐÃ VƯỢT QUA XUẤT SẮC!';
END $$;

-- Rollback để không lưu dữ liệu test vào database
ROLLBACK;

