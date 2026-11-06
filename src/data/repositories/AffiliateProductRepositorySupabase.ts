/**
 * PawCare AI — Supabase Affiliate Product Repository Implementation
 *
 * Implements AffiliateProductRepository with Supabase queries,
 * offline SQLite fallback and outbox synchronization.
 */
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';
import { getDatabase } from '../local/database';
import { AffiliateProductDao } from '../local/AffiliateProductDao';
import type {
  AffiliateProduct,
  CreateProductInput,
  ProductCategory,
  ProductPetType,
  ProductStatus,
  UpdateProductInput,
} from '@/domain/entities/AffiliateProduct';
import type {
  AdminProductFilterParams,
  AffiliateProductRepository,
  ProductFilterParams,
} from '@/domain/repositories/AffiliateProductRepository';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function mapRowToProduct(row: any): AffiliateProduct {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    price: Number(row.price) || 0,
    categoryId: row.category_id,
    categoryName: row.product_categories?.name || 'Phụ kiện chung',
    categoryIcon: row.product_categories?.icon || 'tag-outline',
    petType: (row.pet_type as ProductPetType) || 'all',
    merchantName: row.merchant_name || 'Shopee',
    affiliateUrl: row.affiliate_url,
    status: (row.status as ProductStatus) || 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapRowToCategory(row: any): ProductCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon || 'tag-outline',
    description: row.description,
    sortOrder: row.sort_order ?? 0,
  };
}

export class AffiliateProductRepositorySupabase implements AffiliateProductRepository {
  async getActiveProducts(params?: ProductFilterParams): Promise<AffiliateProduct[]> {
    try {
      let query = supabase
        .from('affiliate_products')
        .select('*, product_categories(name, icon)')
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (params?.categoryId) {
        query = query.eq('category_id', params.categoryId);
      }

      if (params?.petType && params.petType !== 'all') {
        query = query.or(`pet_type.eq.${params.petType},pet_type.eq.all`);
      }

      if (params?.search && params.search.trim()) {
        const term = `%${params.search.trim()}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term},merchant_name.ilike.${term}`);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw new Error(mapSupabaseError(error));

      const products = (data || []).map(mapRowToProduct);

      // Async cache to SQLite
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveProducts(products);
      } catch {}

      return products;
    } catch {
      // Offline fallback
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        return dao.getActiveProducts(params);
      } catch {
        return [];
      }
    }
  }

  async getProductById(id: string): Promise<AffiliateProduct | null> {
    try {
      const { data, error } = await supabase
        .from('affiliate_products')
        .select('*, product_categories(name, icon)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error || !data) return null;

      const product = mapRowToProduct(data);

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveProducts([product]);
      } catch {}

      return product;
    } catch {
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        return dao.getById(id);
      } catch {
        return null;
      }
    }
  }

  async getProductCategories(): Promise<ProductCategory[]> {
    try {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw new Error(mapSupabaseError(error));

      const categories = (data || []).map(mapRowToCategory);

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveCategories(categories);
      } catch {}

      return categories;
    } catch {
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        return dao.getCategories();
      } catch {
        return [];
      }
    }
  }

  async getProductsByArticleId(articleId: string): Promise<AffiliateProduct[]> {
    try {
      const { data, error } = await supabase
        .from('article_products')
        .select('affiliate_products(*, product_categories(name, icon))')
        .eq('article_id', articleId);

      if (error) throw new Error(mapSupabaseError(error));

      const products: AffiliateProduct[] = [];
      for (const row of (data as any[]) || []) {
        const prod = Array.isArray(row.affiliate_products)
          ? row.affiliate_products[0]
          : row.affiliate_products;
        if (prod && !prod.deleted_at && prod.status === 'active') {
          products.push(mapRowToProduct(prod));
        }
      }

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveProducts(products);
      } catch {}

      return products;
    } catch {
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        return dao.getProductsByArticleId(articleId);
      } catch {
        return [];
      }
    }
  }

  async getAllProductsAdmin(params?: AdminProductFilterParams): Promise<AffiliateProduct[]> {
    try {
      let query = supabase
        .from('affiliate_products')
        .select('*, product_categories(name, icon)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (params?.status && params.status !== 'all') {
        query = query.eq('status', params.status);
      }

      if (params?.search && params.search.trim()) {
        const term = `%${params.search.trim()}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term},merchant_name.ilike.${term}`);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw new Error(mapSupabaseError(error));

      const products = (data || []).map(mapRowToProduct);

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveProducts(products);
      } catch {}

      return products;
    } catch {
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        return dao.getAllAdmin(params);
      } catch {
        return [];
      }
    }
  }

  async createProduct(input: CreateProductInput): Promise<AffiliateProduct> {
    let authorId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      authorId = data?.session?.user?.id || null;
    } catch {}

    try {
      const baseSlug = slugify(input.name);
      const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

      const rowToInsert = {
        name: input.name.trim(),
        slug: uniqueSlug,
        description: input.description.trim(),
        image_url: input.imageUrl?.trim() || null,
        price: Number(input.price) || 0,
        category_id: input.categoryId || null,
        pet_type: input.petType || 'all',
        merchant_name: input.merchantName?.trim() || 'Shopee',
        affiliate_url: input.affiliateUrl.trim(),
        status: input.status || 'active',
        created_by: authorId,
      };

      const { data, error } = await supabase
        .from('affiliate_products')
        .insert(rowToInsert)
        .select('*, product_categories(name, icon)')
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      const created = mapRowToProduct(data);

      // Link articles if provided
      if (input.articleIds && input.articleIds.length > 0) {
        const links = input.articleIds.map((artId) => ({
          article_id: artId,
          product_id: created.id,
        }));
        await supabase.from('article_products').upsert(links);
        created.articleIds = input.articleIds;
      }

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveProducts([created]);
      } catch {}

      return created;
    } catch {
      // Offline fallback: Write to SQLite and add to Outbox
      const db = await getDatabase();
      const dao = new AffiliateProductDao(db);
      return dao.create(input, authorId);
    }
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<AffiliateProduct> {
    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (input.name !== undefined) updates.name = input.name.trim();
      if (input.description !== undefined) updates.description = input.description.trim();
      if (input.imageUrl !== undefined) updates.image_url = input.imageUrl?.trim() || null;
      if (input.price !== undefined) updates.price = Number(input.price) || 0;
      if (input.categoryId !== undefined) updates.category_id = input.categoryId;
      if (input.petType !== undefined) updates.pet_type = input.petType;
      if (input.merchantName !== undefined) updates.merchant_name = input.merchantName.trim();
      if (input.affiliateUrl !== undefined) updates.affiliate_url = input.affiliateUrl.trim();
      if (input.status !== undefined) updates.status = input.status;

      const { data, error } = await supabase
        .from('affiliate_products')
        .update(updates)
        .eq('id', id)
        .select('*, product_categories(name, icon)')
        .single();

      if (error || !data) {
        throw new Error(mapSupabaseError(error));
      }

      const updated = mapRowToProduct(data);

      // Link articles if provided
      if (input.articleIds !== undefined) {
        await supabase.from('article_products').delete().eq('product_id', id);
        if (input.articleIds.length > 0) {
          const links = input.articleIds.map((artId) => ({
            article_id: artId,
            product_id: id,
          }));
          await supabase.from('article_products').upsert(links);
        }
        updated.articleIds = input.articleIds;
      }

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.saveProducts([updated]);
      } catch {}

      return updated;
    } catch {
      // Offline fallback
      const db = await getDatabase();
      const dao = new AffiliateProductDao(db);
      return dao.update(id, input);
    }
  }

  async deleteProduct(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('affiliate_products')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', id);

      if (error) throw new Error(mapSupabaseError(error));

      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        await dao.softDelete(id);
      } catch {}
    } catch {
      const db = await getDatabase();
      const dao = new AffiliateProductDao(db);
      await dao.softDelete(id);
    }
  }

  async toggleProductStatus(id: string, status: ProductStatus): Promise<AffiliateProduct> {
    return this.updateProduct(id, { status });
  }

  async createCategory(name: string, icon?: string): Promise<ProductCategory> {
    const slug = slugify(name);
    const { data, error } = await supabase
      .from('product_categories')
      .insert({
        name: name.trim(),
        slug,
        icon: icon || 'tag-outline',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(mapSupabaseError(error));
    }

    const cat = mapRowToCategory(data);
    try {
      const db = await getDatabase();
      const dao = new AffiliateProductDao(db);
      await dao.saveCategories([cat]);
    } catch {}

    return cat;
  }

  async linkProductsToArticle(articleId: string, productIds: string[]): Promise<void> {
    try {
      await supabase.from('article_products').delete().eq('article_id', articleId);
      if (productIds.length > 0) {
        const rows = productIds.map((pId) => ({
          article_id: articleId,
          product_id: pId,
        }));
        const { error } = await supabase.from('article_products').upsert(rows);
        if (error) throw new Error(mapSupabaseError(error));
      }
    } catch {
      // Ignored or handled locally
    }

    try {
      const db = await getDatabase();
      const dao = new AffiliateProductDao(db);
      await dao.linkProductsToArticle(articleId, productIds);
    } catch {}
  }

  async getProductArticleIds(productId: string): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('article_products')
        .select('article_id')
        .eq('product_id', productId);

      if (error) throw new Error(mapSupabaseError(error));
      return (data || []).map((r) => r.article_id);
    } catch {
      try {
        const db = await getDatabase();
        const dao = new AffiliateProductDao(db);
        return dao.getProductArticleIds(productId);
      } catch {
        return [];
      }
    }
  }
}

export const affiliateProductRepository = new AffiliateProductRepositorySupabase();
