-- ==============================================================================
-- Migration: 20261106000006_blog_articles.sql
-- Description: PetCare Blog & Knowledge Base (Articles & Categories)
--              Includes Row-Level Security, constraints, indexes & curated seed data.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BLOG CATEGORIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT 'book-open-outline',
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_blog_categories_updated_at
    BEFORE UPDATE ON public.blog_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 2. ARTICLES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.blog_categories(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    cover_image_url TEXT,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    target_species TEXT NOT NULL DEFAULT 'all' CHECK (target_species IN ('all', 'dog', 'cat', 'bird', 'rabbit', 'hamster')),
    source_url TEXT,
    source_name TEXT,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden')),
    views_count INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE TRIGGER set_articles_updated_at
    BEFORE UPDATE ON public.articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------------
-- 3. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articles_status_published ON public.articles(status, published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_target_species ON public.articles(target_species);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_blog_categories_sort ON public.blog_categories(sort_order ASC);

-- ------------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Categories RLS
CREATE POLICY "categories_select" ON public.blog_categories
    FOR SELECT
    USING (deleted_at IS NULL OR public.is_admin());

CREATE POLICY "categories_insert_admin" ON public.blog_categories
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_admin" ON public.blog_categories
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "categories_delete_admin" ON public.blog_categories
    FOR DELETE
    USING (public.is_admin());

-- Articles RLS: Regular users can ONLY read published, non-deleted articles.
-- Admins can read, insert, update and delete everything.
CREATE POLICY "articles_select" ON public.articles
    FOR SELECT
    USING (
        (status = 'published' AND deleted_at IS NULL)
        OR public.is_admin()
    );

CREATE POLICY "articles_insert_admin" ON public.articles
    FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "articles_update_admin" ON public.articles
    FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "articles_delete_admin" ON public.articles
    FOR DELETE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. SEED INITIAL CATEGORIES
-- ------------------------------------------------------------------------------
INSERT INTO public.blog_categories (id, name, slug, icon, description, sort_order)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Vệ sinh & Làm đẹp', 've-sinh-lam-dep', 'shower', 'Kỹ thuật tắm rửa, tỉa lông, chải chuốt và vệ sinh tai mắt', 1),
    ('c2222222-2222-2222-2222-222222222222', 'Dinh dưỡng & Bữa ăn', 'dinh-duong-bua-an', 'food-drumstick', 'Thực phẩm dinh dưỡng, chế độ ăn an toàn và các món kiêng kỵ', 2),
    ('c3333333-3333-3333-3333-333333333333', 'Sức khỏe & Y tế', 'suc-khoe-y-te', 'medical-bag', 'Phòng ngừa bệnh tật, lịch tiêm phòng và sơ cứu khẩn cấp', 3),
    ('c4444444-4444-4444-4444-444444444444', 'Thú cưng nhỏ & Đặc biệt', 'thu-cung-nho', 'paw', 'Kinh nghiệm nuôi dưỡng Hamster, Chim cảnh, Thỏ và Bò sát', 4),
    ('c5555555-5555-5555-5555-555555555555', 'Huấn luyện & Tập tính', 'huan-luyen-hanh-vi', 'school', 'Thấu hiểu tâm lý, dạy đi vệ sinh đúng chỗ và các bài tập cơ bản', 5)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. SEED CURATED ARTICLES (Với trích dẫn nguồn uy tín và nội dung biên tập chuẩn thú y)
-- ------------------------------------------------------------------------------
INSERT INTO public.articles (
    id, category_id, title, slug, cover_image_url, excerpt, content, target_species, source_url, source_name, status, views_count
) VALUES
(
    'a1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    'Hướng dẫn tắm cho chó đúng cách và an toàn tại nhà',
    'huong-dan-tam-cho-cho-dung-cach',
    'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80',
    'Quy trình 5 bước tắm rửa sạch sẽ, bảo vệ da lông không bị nấm viêm và giữ cho cún cưng luôn thơm tho.',
    '## 1. Chuẩn bị trước khi tắm
Tắm cho cún cưng không chỉ giúp khử mùi hôi mà còn phòng ngừa ve rận và các bệnh viêm da. Trước khi tắm, bạn cần chuẩn bị:
- **Sữa tắm chuyên dụng cho chó**: Tuyệt đối không dùng sữa tắm của người vì độ pH da của cún có tính kiềm nhẹ (~7.5), trong khi người có tính axit (~5.5).
- **Khăn bông siêu thấm hút** và **máy sấy tóc** (chế độ gió ấm hoặc mát).
- **Bông gòn nút tai**: Đặt nhẹ vào 2 tai để tránh nước lọt vào trong gây viêm tai giữa.

## 2. Quy trình tắm 5 bước chuẩn thú y
1. **Chải lông trước khi xả nước**: Giúp gỡ các búi rối; khi lông ướt, các búi rối sẽ thắt chặt hơn và rất khó gỡ.
2. **Làm ướt toàn thân**: Dùng vòi nước ấm vừa phải, xối từ phần cổ ra sau lưng, hai bên hông và bốn chân.
3. **Thoa xà phòng & massage nhẹ nhàng**: Thoa đều bọt sữa tắm từ cổ xuống đuôi, massage trong khoảng 5-7 phút.
4. **Vệ sinh vùng mặt**: Không xịt trực tiếp vòi nước vào mặt bé; dùng khăn ẩm lau khóe mắt và quanh mõm.
5. **Xả sạch hoàn toàn bọt xà phòng**: Bọt xà phòng còn sót lại trên da là nguyên nhân hàng đầu gây ngứa và gàu.

## 3. Chăm sóc sau khi tắm
- Lau khô bằng khăn bông, sau đó sấy khô lông tận chân lông.
- Thưởng cho bé một chút bánh thưởng (treat) để tạo ấn tượng tích cực cho những lần tắm sau.',
    'dog',
    'https://www.akc.org/expert-advice/health/how-often-should-you-wash-your-dog/',
    'American Kennel Club (AKC)',
    'published',
    142
),
(
    'a2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111',
    'Cách vệ sinh tai cho mèo an toàn, phòng ngừa rận tai',
    'cach-ve-sinh-tai-cho-meo-an-toan',
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    'Nhận biết dấu hiệu viêm tai, rận tai Otodectes và cách vệ sinh ống tai mèo mà không làm tổn thương màng nhĩ.',
    '## 1. Khi nào mèo cần được vệ sinh tai?
Đôi tai của mèo rất nhạy cảm. Tai khỏe mạnh thường có màu hồng nhạt, không có mùi lạ và chỉ có một lớp sáp mỏng bảo vệ. Bạn cần can thiệp vệ sinh khi thấy:
- Mèo thường xuyên gãi tai hoặc lắc đầu liên tục.
- Xuất hiện chất bẩn màu nâu sẫm giống bã cà phê (dấu hiệu điển hình của rận tai).
- Tai có mùi hôi hoặc tấy đỏ.

## 2. Dụng cụ cần chuẩn bị
- **Dung dịch rửa tai thú y chuyên dụng cho mèo** (chứa chất làm tan sáp tai và kháng khuẩn dịu nhẹ).
- **Bông gòn hoặc gạc mềm**: Tuyệt đối KHÔNG dùng tăm bông chọc sâu vào ống tai vì có thể đẩy chất bẩn vào sâu hơn hoặc chọc thủng màng nhĩ.

## 3. Các bước thực hiện
1. Giữ bé mèo nằm thư giãn trong lòng hoặc quấn khăn nhẹ quanh thân mèo (kiểu bánh mì cuộn) nếu mèo phản ứng.
2. Nhỏ 2 - 3 giọt dung dịch rửa tai vào vành tai trong của bé.
3. Dùng ngón cái và ngón trỏ xoa nhẹ gốc tai trong 20-30 giây (bạn sẽ nghe tiếng "lách chách" khi dung dịch hòa tan ráy tai).
4. Thả cho mèo tự lắc đầu để văng chất bẩn ra ngoài vành tai.
5. Dùng bông gòn lau sạch các chất bẩn trồi lên ở vành tai ngoài.',
    'cat',
    'https://vcahospitals.com/know-your-pet/cleaning-cats-ears',
    'VCA Animal Hospitals',
    'published',
    98
),
(
    'a3333333-3333-3333-3333-333333333333',
    'c2222222-2222-2222-2222-222222222222',
    'Top 7 thực phẩm cực kỳ nguy hiểm tuyệt đối không cho chó ăn',
    'top-7-thuc-pham-nguy-hiem-cho-cho',
    'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    'Sô-cô-la, hành tỏi, nho tươi, xylitol... Những món ăn quen thuộc của con người có thể gây suy thận cấp hoặc tử vong cho chó.',
    '## Cảnh giác: Dạ dày thú cưng không giống con người!
Nhiều người nuôi thường có thói quen chia sẻ đồ ăn vặt của mình cho cún cưng. Tuy nhiên, một số hợp chất cơ thể người chuyển hóa dễ dàng lại là chất kịch độc đối với loài chó.

### 1. Sô-cô-la & Cacao
Chứa **Theobromine** và caffeine. Chó không thể chuyển hóa Theobromine hiệu quả, dẫn đến tim đập nhanh, co giật, xuất huyết trong và ngừng tim. Sô-cô-la đen và bột cacao có nồng độ độc tính cao nhất.

### 2. Nho tươi và Nho khô
Nho là nguyên nhân gây suy thận cấp tính ở chó chỉ với một lượng rất nhỏ. Các triệu chứng bao gồm nôn mửa, lờ đờ trong vòng 12 giờ và suy thận sau 24-48 giờ.

### 3. Hành, Tỏi, Hẹ
Chứa hợp chất **Thiosulfate** phá hủy tế bào hồng cầu của chó, gây bệnh thiếu máu tán huyết nghiêm trọng (Heinz body anemia).

### 4. Chất tạo ngọt nhân tạo Xylitol
Có trong kẹo cao su không đường, bánh ngọt, bơ đậu phộng ăn kiêng. Xylitol kích thích tuyến tụy tiết lượng lớn insulin, gây tụt đường huyết cấp (hạ đường huyết) và suy gan cấp chỉ sau 30 phút.

### 5. Xương gia cầm đã nấu chín
Xương gà, vịt nấu chín trở nên giòn và dễ gãy vụn thành các mảnh sắc nhọn, có thể đâm thủng thực quản, dạ dày và ruột của cún.',
    'dog',
    'https://www.aspca.org/pet-care/animal-poison-control/people-foods-pets-should-never-eat',
    'ASPCA Animal Poison Control',
    'published',
    215
),
(
    'a4444444-4444-4444-4444-444444444444',
    'c1111111-1111-1111-1111-111111111111',
    'Bí quyết chăm sóc bộ lông thú cưng luôn mềm mượt, giảm rụng',
    'bi-quyet-cham-soc-long-thu-cung-mem-muot',
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
    'Dinh dưỡng bổ sung Omega 3-6, kết hợp thói quen chải lông hằng ngày giúp giảm 80% lông rụng khắp nhà.',
    '## 1. Dinh dưỡng từ bên trong quyết định 70% vẻ đẹp bộ lông
Bộ lông của chó mèo phản ánh trực tiếp sức khỏe bên trong. Để lông dày, khỏe và bóng:
- **Axit béo Omega-3 & Omega-6**: Bổ sung dầu cá hồi (Salmon Oil) hoặc hạt lanh giúp tăng độ bóng của lông và giảm kích ứng da.
- **Protein chất lượng cao**: Lông có cấu tạo chủ yếu từ keratin (một loại protein). Chế độ ăn thiếu đạm sẽ khiến lông giòn, xơ xác và dễ rụng.
- **Kẽm (Zinc) và Vitamin A, E**: Hỗ trợ tái tạo nang lông và lớp biểu bì da.

## 2. Quy trình chải lông đúng kỹ thuật
- **Tần suất**: Chó lông dài hoặc mèo rụng lông mùa thay lông nên được chải mỗi ngày từ 5-10 phút.
- **Chọn đúng lược**:
  - Lược cào gỡ rối (Slicker Brush) cho lông dài, xoăn.
  - Lược khử lông chết (Undercoat de-shedding tool) giúp loại bỏ lớp lông tơ gãy rụng mà không làm xước da.
- Luôn chải theo chiều mọc của sợi lông, thao tác nhẹ nhàng từ cổ xuống lưng và đuôi.',
    'all',
    'https://www.petmd.com/dog/general-health/how-keep-your-pets-coat-healthy',
    'PetMD Veterinary Advice',
    'published',
    89
),
(
    'a5555555-5555-5555-5555-555555555555',
    'c4444444-4444-4444-4444-444444444444',
    'Cẩm nang nuôi dưỡng Hamster cơ bản dành cho người mới bắt đầu',
    'cam-nang-nuoi-duong-hamster-co-ban',
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80',
    'Kích thước lồng chuồng tối thiểu, bánh xe chạy an toàn, lót chuồng khử mùi và chế độ hạt cân bằng cho chuột Hamster.',
    '## 1. Chuẩn bị chuồng nuôi đạt chuẩn
Hamster là loài thú cưng nhỏ nhưng có nhu cầu vận động lãnh thổ rất lớn:
- **Diện tích sàn tối thiểu**: Tối thiểu 50cm x 30cm (tương đương sàn ~2000 cm²). Tuyệt đối tránh các loại lồng mini nhiều tầng hẹp vì dễ làm gãy chân bé.
- **Bánh xe chạy (Wheel)**: Cần có đường kính tối thiểu 20cm (cho Robo / Winter White) hoặc 28cm (cho Syrian/Bear) để tránh làm cong cột sống của Hamster.
- **Lót chuồng**: Lót mùn cưa chuyên dụng không bụi, lót giấy nén hoặc cỏ timothy dày từ 5-10cm để bé có thể đào hang theo bản năng tự nhiên.

## 2. Thức ăn và nước uống
- **Hạt trộn đa dạng**: Ngũ cốc, hạt kê, hạt lanh, yến mạch, sấy củ quả. Hạn chế hạt hướng dương vì nhiều dầu dễ gây béo phì.
- **Bình nước bi treo**: Thay nước sạch mỗi ngày. Tuyệt đối không cho uống nước trong chén vì bé dễ làm đổ gây ướt lông và cảm lạnh.',
    'hamster',
    'https://www.rspca.org.uk/adviceandwelfare/pets/rodents/hamsters',
    'RSPCA UK Pet Care',
    'published',
    67
),
(
    'a6666666-6666-6666-6666-666666666666',
    'c4444444-4444-4444-4444-444444444444',
    'Hướng dẫn chăm sóc chim cảnh trong mùa thay đổi thời tiết',
    'huong-dan-cham-soc-chim-canh-khoe-manh',
    'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80',
    'Giữ ấm lồng chim, phòng tránh gió lùa và cân bằng khoáng chất vitamin giúp chim luôn hót vang, lông bóng.',
    '## 1. Vị trí đặt lồng và nhiệt độ môi trường
Hệ hô hấp của chim cảnh rất nhạy cảm với sự thay đổi của thời tiết và luồng gió:
- **Tránh gió lùa**: Treo lồng ở nơi thoáng đãng, nhiều ánh sáng tự nhiên buổi sáng nhưng tuyệt đối tránh luồng gió lùa trực tiếp hoặc máy lạnh phả vào.
- **Ánh nắng ban mai**: Cho chim tắm nắng 15-20 phút vào buổi sáng sớm (trước 8h30) để cơ thể tự tổng hợp Vitamin D3 giúp hấp thụ canxi tốt hơn.
- **Áo trùm lồng**: Vào ban đêm hoặc mùa lạnh, cần trùm 3/4 áo lồng để giữ ấm và tránh các loài côn trùng, chuột gây hoảng loạn.

## 2. Dinh dưỡng đa dạng
- Ngoài cám chim chất lượng, cần bổ sung rau xanh tươi (xà lách, rau muống non) và hoa quả chín (táo, chuối).
- Treo nang mực hoặc khoáng vi lượng trong lồng để chim mài mỏ và bổ sung canxi giúp xương mỏ chắc khỏe.',
    'bird',
    'https://vcahospitals.com/know-your-pet/general-care-of-pet-birds',
    'VCA Animal Hospitals',
    'published',
    53
)
ON CONFLICT (slug) DO NOTHING;
