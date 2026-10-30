-- ==============================================================================
-- PawCare AI — Reference Seed Data
-- 20 popular dog breeds & 10 popular cat breeds in Vietnam
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. POPULAR DOG BREEDS (20 GIỐNG CHÓ PHỔ BIẾN)
-- ------------------------------------------------------------------------------
INSERT INTO public.breeds (id, species, name_en, name_vi, size_category, typical_weight_min_kg, typical_weight_max_kg, description, common_health_issues)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'dog', 'Golden Retriever', 'Chó Golden Retriever', 'large', 25.0, 34.0, 
     'Thông minh, thân thiện, trung thành. Là một trong những giống chó gia đình được yêu thích nhất.', 
     '["Loạn sản xương hông", "Đục thủy tinh thể", "Dị ứng da", "Bệnh tim mạch"]'::jsonb),

    ('10000000-0000-0000-0000-000000000002', 'dog', 'Pembroke Welsh Corgi', 'Chó Corgi Chân Ngắn', 'medium', 10.0, 14.0, 
     'Thân dài chân ngắn, nhanh nhẹn, hòa đồng và thích vận động.', 
     '["Thoát vị đĩa đệm (IVDD)", "Béo phì", "Bệnh thoái hóa tủy sống", "Loạn sản võng mạc"]'::jsonb),

    ('10000000-0000-0000-0000-000000000003', 'dog', 'Poodle (Toy)', 'Chó Poodle Toy', 'toy', 2.5, 4.5, 
     'Kích thước nhỏ gọn, lông xoăn không rụng, cực kỳ thông minh và dễ huấn luyện.', 
     '["Trật bánh chè", "Xẹp khí quản", "Bệnh răng miệng", "Đục thủy tinh thể"]'::jsonb),

    ('10000000-0000-0000-0000-000000000004', 'dog', 'Siberian Husky', 'Chó Husky Bắc Cực', 'large', 16.0, 27.0, 
     'Mắt xanh hoặc đa sắc, bộ lông dày 2 lớp, tính cách tinh nghịch và giàu năng lượng.', 
     '["Đục thủy tinh thể", "Teo võng mạc tiến triển", "Loạn sản xương hông"]'::jsonb),

    ('10000000-0000-0000-0000-000000000005', 'dog', 'Shiba Inu', 'Chó Shiba Inu Nhật Bản', 'small', 8.0, 11.0, 
     'Giống chó cổ của Nhật, tính cách độc lập, sạch sẽ và trung thành tuyệt đối.', 
     '["Dị ứng atopy", "Trật khớp bánh chè", "Bệnh tăng nhãn áp"]'::jsonb),

    ('10000000-0000-0000-0000-000000000006', 'dog', 'Phu Quoc Ridgeback', 'Chó Phú Quốc', 'medium', 12.0, 18.0, 
     'Quốc khuyển Việt Nam, có xoáy lông trên lưng, chân màng vịt, bơi giỏi và tinh anh.', 
     '["Viêm xoang bì (dermoid sinus)", "Bệnh đường ruột", "Ký sinh trùng máu"]'::jsonb),

    ('10000000-0000-0000-0000-000000000007', 'dog', 'Hmong Bobtail Dog', 'Chó H''Mông Cộc Đuôi', 'medium', 15.0, 25.0, 
     'Một trong tứ đại quốc khuyển Việt Nam, đuôi cộc tự nhiên, dũng cảm, giữ nhà cừ khôi.', 
     '["Loạn sản xương hông", "Bệnh viêm tai"]'::jsonb),

    ('10000000-0000-0000-0000-000000000008', 'dog', 'Bac Ha Dog', 'Chó Bắc Hà', 'medium', 16.0, 26.0, 
     'Bộ lông dày bờm xù như sư tử, kiên cường, cảnh giác và trung thành.', 
     '["Ve rận ký sinh", "Viêm da do độ ẩm", "Bệnh đường tiêu hóa"]'::jsonb),

    ('10000000-0000-0000-0000-000000000009', 'dog', 'French Bulldog', 'Chó Bulldog Pháp', 'small', 9.0, 13.0, 
     'Tai dơi đặc trưng, mặt ngắn đáng yêu, ít sủa, phù hợp sống tại căn hộ chung cư.', 
     '["Hội chứng đường thở mặt ngắn (BOAS)", "Dị ứng da", "Nhạy cảm nhiệt độ cao"]'::jsonb),

    ('10000000-0000-0000-0000-000000000010', 'dog', 'Pomeranian', 'Chó Phốc Sóc', 'toy', 1.8, 3.5, 
     'Bông xù như cục kẹo, nhanh nhẹn, tiếng sủa vang, quấn chủ.', 
     '["Trật khớp bánh chè", "Xẹp khí quản", "Rụng lông cục bộ (Alopecia X)"]'::jsonb),

    ('10000000-0000-0000-0000-000000000011', 'dog', 'Labrador Retriever', 'Chó Labrador', 'large', 25.0, 36.0, 
     'Rất hiền lành, thích nước, dễ huấn luyện, ưa thích đồ ăn.', 
     '["Béo phì", "Loạn sản xương khuỷu và xương hông", "Viêm tai"]'::jsonb),

    ('10000000-0000-0000-0000-000000000012', 'dog', 'Samoyed', 'Chó Samoyed', 'large', 17.0, 30.0, 
     'Nụ cười Samoyed trứ danh, lông trắng tuyết lộng lẫy, thân thiện với trẻ nhỏ.', 
     '["Bệnh thận di truyền", "Viêm da lông dày", "Loạn sản khớp hông"]'::jsonb),

    ('10000000-0000-0000-0000-000000000013', 'dog', 'Alaskan Malamute', 'Chó Alaska', 'large', 34.0, 45.0, 
     'Vóc dáng to lớn cơ bắp, lông dày chịu lạnh, trầm tính hơn Husky.', 
     '["Loạn sản xương hông", "Đục thủy tinh thể", "Bệnh suy giáp"]'::jsonb),

    ('10000000-0000-0000-0000-000000000014', 'dog', 'Chihuahua', 'Chó Chihuahua', 'toy', 1.5, 3.0, 
     'Giống chó nhỏ nhất thế giới, lanh lợi, dũng cảm và gắn bó khăng khít với một chủ.', 
     '["Hạ đường huyết", "Hở thóp sọ (molera)", "Bệnh van tim thoái hóa"]'::jsonb),

    ('10000000-0000-0000-0000-000000000015', 'dog', 'Pug', 'Chó Pug Mặt Xệ', 'small', 6.0, 9.0, 
     'Mặt nhăn ngộ nghĩnh, tính cách vui vẻ, lười vận động, thích ngủ.', 
     '["Hội chứng BOAS", "Viêm nếp gấp da mặt", "Loét giác mạc"]'::jsonb),

    ('10000000-0000-0000-0000-000000000016', 'dog', 'Dachshund', 'Chó Lạp Xưởng', 'small', 5.0, 10.0, 
     'Thân dài ngực nở chân ngắn, dũng cảm và tính bảo vệ lãnh thổ cao.', 
     '["Bệnh đĩa đệm cột sống (IVDD)", "Béo phì", "Bệnh võng mạc"]'::jsonb),

    ('10000000-0000-0000-0000-000000000017', 'dog', 'Beagle', 'Chó Beagle', 'medium', 9.0, 15.0, 
     'Khứu giác cực nhạy, tai cụp dài, luôn tràn đầy tò mò và thân thiện.', 
     '["Béo phì", "Động kinh vô căn", "Viêm tai ngoài"]'::jsonb),

    ('10000000-0000-0000-0000-000000000018', 'dog', 'German Shepherd', 'Chó Béc-giê Đức', 'large', 22.0, 40.0, 
     'Thông minh hàng đầu, can đảm, đa năng trong canh gác và bảo vệ.', 
     '["Loạn sản khớp hông và khớp khuỷu", "Bệnh tủy sống thoái hóa", "Giãn xoắn dạ dày"]'::jsonb),

    ('10000000-0000-0000-0000-000000000019', 'dog', 'Doberman Pinscher', 'Chó Doberman', 'large', 30.0, 42.0, 
     'Thanh lịch, cơ bắp cuồn cuộn, tốc độ cao và khả năng bảo vệ chủ nhân tuyệt đỉnh.', 
     '["Bệnh cơ tim giãn (DCM)", "Bệnh Von Willebrand", "Bất ổn định đốt sống cổ"]'::jsonb),

    ('10000000-0000-0000-0000-000000000020', 'dog', 'Border Collie', 'Chó Chăn Cừu Border Collie', 'medium', 14.0, 20.0, 
     'Giống chó thông minh nhất thế giới, phản xạ chớp nhoáng, đòi hỏi kích thích trí não cao.', 
     '["Dị tật mắt Collie (CEA)", "Động kinh", "Loạn sản khớp hông"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name_vi = EXCLUDED.name_vi,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description;

-- ------------------------------------------------------------------------------
-- 2. POPULAR CAT BREEDS (10 GIỐNG MÈO PHỔ BIẾN)
-- ------------------------------------------------------------------------------
INSERT INTO public.breeds (id, species, name_en, name_vi, size_category, typical_weight_min_kg, typical_weight_max_kg, description, common_health_issues)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'cat', 'British Shorthair', 'Mèo Anh Lông Ngắn', 'medium', 4.0, 8.0, 
     'Đầu tròn má bánh bao, lông dày như nhung, tính cách điềm đạm và độc lập.', 
     '["Bệnh cơ tim phì đại (HCM)", "Bệnh thận đa nang (PKD)", "Béo phì"]'::jsonb),

    ('20000000-0000-0000-0000-000000000002', 'cat', 'British Longhair', 'Mèo Anh Lông Dài', 'medium', 4.0, 7.5, 
     'Phiên bản lông dài sang trọng của mèo Anh, quý phái, hiền hòa và thích yên tĩnh.', 
     '["Búi lông trong dạ dày", "Bệnh thận đa nang", "Viêm nướu"]'::jsonb),

    ('20000000-0000-0000-0000-000000000003', 'cat', 'Scottish Fold', 'Mèo Tai Cụp Scottish Fold', 'medium', 3.0, 6.0, 
     'Đôi tai gấp độc đáo, mắt to tròn như cú vèo, tính nết ngọt ngào, quấn người.', 
     '["Bệnh dị tật sụn xương (Osteochondrodysplasia)", "Bệnh cơ tim phì đại", "Bệnh viêm khớp sớm"]'::jsonb),

    ('20000000-0000-0000-0000-000000000004', 'cat', 'Persian Cat', 'Mèo Ba Tư Lông Xù', 'medium', 3.5, 6.5, 
     'Mặt tịt quý tộc, bộ lông dài thướt tha, cử chỉ tao nhã và trầm lặng.', 
     '["Hội chứng đường thở mặt ngắn", "Chảy nước mắt liên tục", "Bệnh thận đa nang (PKD)"]'::jsonb),

    ('20000000-0000-0000-0000-000000000005', 'cat', 'Ragdoll', 'Mèo Ragdoll', 'large', 4.5, 9.0, 
     'Mắt xanh thẳm, kích thước lớn, mềm nhũn thư thái khi được bế trên tay.', 
     '["Bệnh cơ tim phì đại (HCM)", "Sỏi bàng quang", "Béo phì"]'::jsonb),

    ('20000000-0000-0000-0000-000000000006', 'cat', 'Domestic Short-Haired Cat (Vietnamese Tabby)', 'Mèo Mướp Ta', 'small', 3.0, 5.0, 
     'Mèo bản địa Việt Nam, vằn mướp hình chữ M trên trán, bắt chuột giỏi, sức đề kháng cao.', 
     '["Bệnh giảm bạch cầu (FPV)", "Ký sinh trùng đường ruột", "Viêm tai"]'::jsonb),

    ('20000000-0000-0000-0000-000000000007', 'cat', 'Maine Coon', 'Mèo Maine Coon Khổng Lồ', 'giant', 5.0, 11.0, 
     'Giống mèo nhà to lớn nhất thế giới, tai có chùm lông như linh miêu, tính cách hiền như chó cưng.', 
     '["Bệnh cơ tim phì đại (HCM)", "Loạn sản xương hông", "Teo cơ tủy sống"]'::jsonb),

    ('20000000-0000-0000-0000-000000000008', 'cat', 'Sphynx', 'Mèo Không Lông Sphynx', 'medium', 3.5, 6.0, 
     'Không có lông, làn da nhăn ấm áp, cực kỳ thân thiện, thông minh và thích sưởi ấm.', 
     '["Viêm da dị ứng và tích dầu", "Nhiễm lạnh hạ thân nhiệt", "Bệnh cơ tim phì đại"]'::jsonb),

    ('20000000-0000-0000-0000-000000000009', 'cat', 'Bengal Cat', 'Mèo Báo Bengal', 'medium', 4.0, 7.5, 
     'Họa tiết đốm hoa mai như loài báo hoang dã, vóc dáng săn chắc, cực kỳ năng động và thích nước.', 
     '["Thiếu hụt men PK (Pyruvate Kinase)", "Bệnh cơ tim phì đại", "Teo võng mạc tiến triển"]'::jsonb),

    ('20000000-0000-0000-0000-000000000010', 'cat', 'Siamese Cat', 'Mèo Xiêm', 'medium', 3.0, 5.0, 
     'Thân hình mảnh mai duyên dáng, điểm màu sẫm ở tai/mặt/chân, tiếng kêu vang và rất tình cảm.', 
     '["Hen suyễn ở mèo", "Bệnh amyloidosis (tích tụ protein)", "Bệnh răng miệng"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    name_vi = EXCLUDED.name_vi,
    name_en = EXCLUDED.name_en,
    description = EXCLUDED.description;

-- ==============================================================================
-- 3. HƯỚNG DẪN TẠO TÀI KHOẢN QUẢN TRỊ VIÊN (ADMIN) AN TOÀN
-- ==============================================================================
-- KHÔNG BAO GIỜ hard-code mật khẩu admin trong file SQL public.
-- 
-- Cách 1: Tạo qua Supabase Studio Web UI (Khuyến nghị)
--   1. Truy cập Authentication -> Users -> Add User -> Create User.
--   2. Nhập email (vd: admin@pawcare.vn) và mật khẩu an toàn.
--   3. Mở SQL Editor và nâng quyền admin cho user đó:
--      UPDATE public.profiles
--      SET role = 'admin'
--      WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@pawcare.vn');
--
-- Cách 2: Tạo bằng Supabase CLI khi chạy local
--   supabase auth signup --email admin@pawcare.vn --password "YourStrongPassword123!"
--   supabase db execute "UPDATE public.profiles SET role = 'admin' WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@pawcare.vn');"

