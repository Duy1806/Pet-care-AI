-- ==============================================================================
-- Migration: 20261106000007_affiliate_marketing.sql
-- Description: Affiliate Marketing (PetCare Shop)
--              Includes product_categories, affiliate_products, article_products,
--              Row-Level Security, indexes & curated dog & cat seed products.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRODUCT CATEGORIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT DEFAULT 'tag-outline',
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 2. AFFILIATE PRODUCTS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.affiliate_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    pet_type TEXT NOT NULL DEFAULT 'all' CHECK (pet_type IN ('all', 'dog', 'cat')),
    merchant_name TEXT NOT NULL DEFAULT 'Shopee',
    affiliate_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'hidden')),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 3. ARTICLE PRODUCTS JUNCTION TABLE (Many-to-Many)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.article_products (
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.affiliate_products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (article_id, product_id)
);

-- ------------------------------------------------------------------------------
-- 4. INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_affiliate_products_status ON public.affiliate_products(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_affiliate_products_category ON public.affiliate_products(category_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_products_pet_type ON public.affiliate_products(pet_type);
CREATE INDEX IF NOT EXISTS idx_article_products_article ON public.article_products(article_id);
CREATE INDEX IF NOT EXISTS idx_article_products_product ON public.article_products(product_id);

-- ------------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_products ENABLE ROW LEVEL SECURITY;

-- Product Categories Policies
CREATE POLICY "product_categories_select" ON public.product_categories
    FOR SELECT USING (deleted_at IS NULL OR public.is_admin());

CREATE POLICY "product_categories_admin_all" ON public.product_categories
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Affiliate Products Policies:
-- Users can only view active, non-deleted products. Admins have full access.
CREATE POLICY "affiliate_products_select" ON public.affiliate_products
    FOR SELECT USING (
        (status = 'active' AND deleted_at IS NULL)
        OR public.is_admin()
    );

CREATE POLICY "affiliate_products_admin_all" ON public.affiliate_products
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Article Products Policies:
CREATE POLICY "article_products_select" ON public.article_products
    FOR SELECT USING (true);

CREATE POLICY "article_products_admin_all" ON public.article_products
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- 6. CURATED INITIAL PRODUCT CATEGORIES
-- ------------------------------------------------------------------------------
INSERT INTO public.product_categories (id, name, slug, icon, description, sort_order)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Vệ sinh & Tắm gội', 've-sinh-tam-goi', 'shower', 'Sữa tắm, nước rửa tai, xịt khử mùi và găng tay vệ sinh', 1),
    ('d2222222-2222-2222-2222-222222222222', 'Thức ăn & Dinh dưỡng', 'thuc-an-dinh-duong', 'food-drumstick', 'Hạt khô, pate dinh dưỡng, gel dinh dưỡng và bánh thưởng', 2),
    ('d3333333-3333-3333-3333-333333333333', 'Phụ kiện & Dụng cụ', 'phu-kien-dung-cu', 'brush', 'Lược chải lông, máy hút lông, khăn tắm và vòng cổ dẫn dắt', 3),
    ('d4444444-4444-4444-4444-444444444444', 'Y tế & Chăm sóc', 'y-te-cham-soc', 'medical-bag', 'Thuốc nhỏ ve rận, men tiêu hóa, xịt sát trùng vết thương', 4),
    ('d5555555-5555-5555-5555-555555555555', 'Đồ chơi & Ổ nệm', 'do-choi-o-nem', 'paw', 'Bóng gặm sạch răng, cào móng mèo, nệm êm ái cho thú cưng', 5)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. CURATED INITIAL AFFILIATE PRODUCTS
-- ------------------------------------------------------------------------------
INSERT INTO public.affiliate_products (
    id, name, slug, description, image_url, price, category_id, pet_type, merchant_name, affiliate_url, status
) VALUES
(
    'p1111111-1111-1111-1111-111111111111',
    'Sữa tắm thú cưng Joyce & Dolls hương hoa thơm lâu',
    'sua-tam-joyce-dolls',
    'Dòng sữa tắm cao cấp dịu nhẹ, cân bằng độ pH da thú cưng, giữ hương thơm dễ chịu suốt 5-7 ngày và phòng ngừa nấm ngứa.',
    'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=600&q=80',
    185000,
    'd1111111-1111-1111-1111-111111111111',
    'all',
    'Shopee',
    'https://shopee.vn',
    'active'
),
(
    'p2222222-2222-2222-2222-222222222222',
    'Dung dịch vệ sinh tai cho chó mèo Epi-Otic Virbac (125ml)',
    'dung-dich-ve-sinh-tai-epi-otic',
    'Dung dịch rửa tai thú y hàng đầu giúp tan ráy tai, làm sạch sâu, khử mùi hôi và phòng ngừa viêm tai, rận tai hiệu quả.',
    'https://images.unsplash.com/photo-1543852786-1cf6624b9987?auto=format&fit=crop&w=600&q=80',
    195000,
    'd1111111-1111-1111-1111-111111111111',
    'all',
    'Shopee',
    'https://shopee.vn',
    'active'
),
(
    'p3333333-3333-3333-3333-333333333333',
    'Lược chải lông tự động nhả lông thông minh',
    'luoc-chai-long-thong-minh',
    'Thiết kế nút bấm thu gọn răng lược, dễ dàng gỡ bỏ toàn bộ lông rối chỉ trong 1 giây, đầu chải bọc bi massage không gây xước da.',
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=600&q=80',
    89000,
    'd3333333-3333-3333-3333-333333333333',
    'all',
    'Lazada',
    'https://lazada.vn',
    'active'
),
(
    'p4444444-4444-4444-4444-444444444444',
    'Hạt dinh dưỡng Royal Canin dành cho Chó Poodle & Chó nhỏ',
    'hat-royal-canin-mini-adult',
    'Công thức hạt chuẩn dinh dưỡng giúp tăng cường đề kháng, bảo vệ hệ tiêu hóa nhạy cảm và giữ màu lông luôn bóng mượt.',
    'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=600&q=80',
    340000,
    'd2222222-2222-2222-2222-222222222222',
    'dog',
    'Shopee',
    'https://shopee.vn',
    'active'
),
(
    'p5555555-5555-5555-5555-555555555555',
    'Pate dinh dưỡng cao cấp Nekko cho mèo (Gói 70g)',
    'pate-nekko-cho-meo',
    'Thịt cá ngừ nguyên chất giàu Omega-3 và Taurine giúp bổ mắt, mượt lông và cung cấp đầy đủ nước cho mèo cưng hàng ngày.',
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
    18000,
    'd2222222-2222-2222-2222-222222222222',
    'cat',
    'Tiki',
    'https://tiki.vn',
    'active'
)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. LINK PRODUCTS TO SEED ARTICLES
-- ------------------------------------------------------------------------------
INSERT INTO public.article_products (article_id, product_id)
VALUES
    -- Bài hướng dẫn tắm cho chó (a1111111...) gắn sữa tắm (p1111111...) & lược chải lông (p3333333...)
    ('a1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111'),
    ('a1111111-1111-1111-1111-111111111111', 'p3333333-3333-3333-3333-333333333333'),
    -- Bài vệ sinh tai cho mèo (a2222222...) gắn nước rửa tai Epi-Otic (p2222222...)
    ('a2222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;
