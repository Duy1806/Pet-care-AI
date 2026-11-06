/**
 * PawCare AI — Affiliate Product DAO (Local SQLite Access)
 *
 * Implements offline-first storage and outbox synchronization
 * for PetCare Shop affiliate products and article links.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from './OutboxDao';
import { generateUUID } from './uuid';
import type {
  AffiliateProduct,
  CreateProductInput,
  ProductCategory,
  ProductPetType,
  ProductStatus,
  UpdateProductInput,
} from '@/domain/entities/AffiliateProduct';

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

export class AffiliateProductDao {
  private readonly outboxDao: OutboxDao;

  constructor(private readonly db: SQLiteDatabase) {
    this.outboxDao = new OutboxDao(db);
  }

  async ensureTables(): Promise<void> {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT,
        description TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS affiliate_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL,
        image_url TEXT,
        price REAL NOT NULL DEFAULT 0,
        category_id TEXT,
        category_name TEXT,
        pet_type TEXT NOT NULL DEFAULT 'all',
        merchant_name TEXT NOT NULL DEFAULT 'Shopee',
        affiliate_url TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        last_synced_at TEXT,
        local_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS article_products (
        article_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (article_id, product_id)
      );

      CREATE INDEX IF NOT EXISTS idx_affiliate_products_status ON affiliate_products(status);
      CREATE INDEX IF NOT EXISTS idx_affiliate_products_category ON affiliate_products(category_id);
      CREATE INDEX IF NOT EXISTS idx_affiliate_products_pet_type ON affiliate_products(pet_type);
      CREATE INDEX IF NOT EXISTS idx_article_products_article ON article_products(article_id);
      CREATE INDEX IF NOT EXISTS idx_article_products_product ON article_products(product_id);
    `);

    // Ensure columns dynamically
    try {
      const tableInfo = await this.db.getAllAsync<{ name: string }>('PRAGMA table_info(affiliate_products);');
      const existingCols = new Set(tableInfo.map((c) => c.name));

      const requiredCols: Array<{ name: string; type: string }> = [
        { name: 'deleted_at', type: 'TEXT' },
        { name: 'sync_status', type: "TEXT NOT NULL DEFAULT 'synced'" },
        { name: 'last_synced_at', type: 'TEXT' },
        { name: 'local_updated_at', type: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP' },
        { name: 'category_name', type: 'TEXT' },
      ];

      for (const col of requiredCols) {
        if (!existingCols.has(col.name)) {
          await this.db.execAsync(`ALTER TABLE affiliate_products ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    } catch (e) {
      console.warn('[AffiliateProductDao] Column migration warning:', e);
    }
  }

  async saveCategories(categories: ProductCategory[]): Promise<void> {
    await this.ensureTables();
    for (const c of categories) {
      await this.db.runAsync(
        `INSERT INTO product_categories (id, name, slug, icon, description, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           slug = excluded.slug,
           icon = excluded.icon,
           description = excluded.description,
           sort_order = excluded.sort_order;`,
        c.id,
        c.name,
        c.slug,
        c.icon ?? null,
        c.description ?? null,
        c.sortOrder ?? 0,
      );
    }
  }

  async getCategories(): Promise<ProductCategory[]> {
    await this.ensureTables();
    return this.db.getAllAsync<ProductCategory>(
      `SELECT id, name, slug, icon, description, sort_order as sortOrder FROM product_categories ORDER BY sort_order ASC;`,
    );
  }

  async saveProducts(products: AffiliateProduct[]): Promise<void> {
    await this.ensureTables();
    const now = new Date().toISOString();
    for (const p of products) {
      await this.db.runAsync(
        `INSERT INTO affiliate_products (
          id, name, slug, description, image_url, price,
          category_id, category_name, pet_type, merchant_name, affiliate_url,
          status, created_by, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          slug = excluded.slug,
          description = excluded.description,
          image_url = excluded.image_url,
          price = excluded.price,
          category_id = excluded.category_id,
          category_name = excluded.category_name,
          pet_type = excluded.pet_type,
          merchant_name = excluded.merchant_name,
          affiliate_url = excluded.affiliate_url,
          status = excluded.status,
          updated_at = excluded.updated_at,
          sync_status = 'synced',
          last_synced_at = excluded.last_synced_at;`,
        p.id,
        p.name,
        p.slug,
        p.description,
        p.imageUrl ?? null,
        p.price,
        p.categoryId ?? null,
        p.categoryName ?? null,
        p.petType,
        p.merchantName,
        p.affiliateUrl,
        p.status,
        p.createdBy ?? null,
        p.createdAt,
        p.updatedAt,
        now,
        now,
      );

      // Save article links if present
      if (p.articleIds && p.articleIds.length > 0) {
        for (const artId of p.articleIds) {
          await this.db.runAsync(
            `INSERT OR IGNORE INTO article_products (article_id, product_id) VALUES (?, ?);`,
            artId,
            p.id,
          );
        }
      }
    }
  }

  async getActiveProducts(params?: {
    categoryId?: string | null;
    petType?: ProductPetType;
    search?: string;
    limit?: number;
  }): Promise<AffiliateProduct[]> {
    await this.ensureTables();
    let query = `SELECT 
      p.id, p.name, p.slug, p.description, p.image_url as imageUrl, p.price,
      p.category_id as categoryId, COALESCE(c.name, p.category_name) as categoryName, c.icon as categoryIcon,
      p.pet_type as petType, p.merchant_name as merchantName, p.affiliate_url as affiliateUrl,
      p.status, p.created_at as createdAt, p.updated_at as updatedAt, p.created_by as createdBy
      FROM affiliate_products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.status = 'active' AND p.deleted_at IS NULL`;
    const sqlParams: any[] = [];

    if (params?.categoryId) {
      query += ` AND p.category_id = ?`;
      sqlParams.push(params.categoryId);
    }

    if (params?.petType && params.petType !== 'all') {
      query += ` AND (p.pet_type = ? OR p.pet_type = 'all')`;
      sqlParams.push(params.petType);
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.merchant_name) LIKE ?)`;
      sqlParams.push(term, term, term);
    }

    query += ` ORDER BY p.created_at DESC`;

    if (params?.limit) {
      query += ` LIMIT ?`;
      sqlParams.push(params.limit);
    }

    return this.db.getAllAsync<AffiliateProduct>(query, ...sqlParams);
  }

  async getAllAdmin(params?: { status?: ProductStatus | 'all'; search?: string }): Promise<AffiliateProduct[]> {
    await this.ensureTables();
    let query = `SELECT 
      p.id, p.name, p.slug, p.description, p.image_url as imageUrl, p.price,
      p.category_id as categoryId, COALESCE(c.name, p.category_name) as categoryName, c.icon as categoryIcon,
      p.pet_type as petType, p.merchant_name as merchantName, p.affiliate_url as affiliateUrl,
      p.status, p.created_at as createdAt, p.updated_at as updatedAt, p.created_by as createdBy
      FROM affiliate_products p
      LEFT JOIN product_categories c ON p.category_id = c.id
      WHERE p.deleted_at IS NULL`;
    const sqlParams: any[] = [];

    if (params?.status && params.status !== 'all') {
      query += ` AND p.status = ?`;
      sqlParams.push(params.status);
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.merchant_name) LIKE ?)`;
      sqlParams.push(term, term, term);
    }

    query += ` ORDER BY p.created_at DESC;`;

    return this.db.getAllAsync<AffiliateProduct>(query, ...sqlParams);
  }

  async getById(id: string): Promise<AffiliateProduct | null> {
    await this.ensureTables();
    const product = await this.db.getFirstAsync<AffiliateProduct>(
      `SELECT 
        p.id, p.name, p.slug, p.description, p.image_url as imageUrl, p.price,
        p.category_id as categoryId, COALESCE(c.name, p.category_name) as categoryName, c.icon as categoryIcon,
        p.pet_type as petType, p.merchant_name as merchantName, p.affiliate_url as affiliateUrl,
        p.status, p.created_at as createdAt, p.updated_at as updatedAt, p.created_by as createdBy
       FROM affiliate_products p
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.deleted_at IS NULL;`,
      id,
    );

    if (!product) return null;

    // Fetch linked article IDs
    const rows = await this.db.getAllAsync<{ article_id: string }>(
      `SELECT article_id FROM article_products WHERE product_id = ?;`,
      id,
    );
    product.articleIds = rows.map((r) => r.article_id);

    return product;
  }

  async getProductsByArticleId(articleId: string): Promise<AffiliateProduct[]> {
    await this.ensureTables();
    return this.db.getAllAsync<AffiliateProduct>(
      `SELECT 
        p.id, p.name, p.slug, p.description, p.image_url as imageUrl, p.price,
        p.category_id as categoryId, COALESCE(c.name, p.category_name) as categoryName, c.icon as categoryIcon,
        p.pet_type as petType, p.merchant_name as merchantName, p.affiliate_url as affiliateUrl,
        p.status, p.created_at as createdAt, p.updated_at as updatedAt, p.created_by as createdBy
       FROM affiliate_products p
       INNER JOIN article_products ap ON p.id = ap.product_id
       LEFT JOIN product_categories c ON p.category_id = c.id
       WHERE ap.article_id = ? AND p.status = 'active' AND p.deleted_at IS NULL
       ORDER BY p.price ASC;`,
      articleId,
    );
  }

  async create(input: CreateProductInput, createdBy?: string | null): Promise<AffiliateProduct> {
    await this.ensureTables();
    const now = new Date().toISOString();
    const id = generateUUID();
    const baseSlug = slugify(input.name);
    const slug = `${baseSlug}-${id.slice(0, 4)}`;

    let categoryName = 'Phụ kiện chung';
    if (input.categoryId) {
      const cat = await this.db.getFirstAsync<{ name: string }>(
        'SELECT name FROM product_categories WHERE id = ?;',
        input.categoryId,
      );
      if (cat?.name) categoryName = cat.name;
    }

    const product: AffiliateProduct = {
      id,
      name: input.name.trim(),
      slug,
      description: input.description.trim(),
      imageUrl: input.imageUrl?.trim() || null,
      price: Number(input.price) || 0,
      categoryId: input.categoryId || null,
      categoryName,
      petType: input.petType || 'all',
      merchantName: input.merchantName?.trim() || 'Shopee',
      affiliateUrl: input.affiliateUrl.trim(),
      status: input.status || 'active',
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy || null,
      articleIds: input.articleIds || [],
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO affiliate_products (
          id, name, slug, description, image_url, price,
          category_id, category_name, pet_type, merchant_name, affiliate_url,
          status, created_by, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending_create', NULL, ?);`,
        product.id,
        product.name,
        product.slug,
        product.description ?? null,
        product.imageUrl ?? null,
        product.price,
        product.categoryId ?? null,
        product.categoryName ?? null,
        product.petType,
        product.merchantName ?? null,
        product.affiliateUrl,
        product.status,
        product.createdBy ?? null,
        product.createdAt,
        product.updatedAt,
        now,
      );

      // Save article links
      if (product.articleIds && product.articleIds.length > 0) {
        for (const artId of product.articleIds) {
          await this.db.runAsync(
            `INSERT OR IGNORE INTO article_products (article_id, product_id) VALUES (?, ?);`,
            artId,
            product.id,
          );
        }
      }

      // Add to outbox for sync
      await this.outboxDao.add('affiliate_products', product.id, 'INSERT', {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        image_url: product.imageUrl,
        price: product.price,
        category_id: product.categoryId,
        pet_type: product.petType,
        merchant_name: product.merchantName,
        affiliate_url: product.affiliateUrl,
        status: product.status,
        created_by: product.createdBy,
        created_at: product.createdAt,
        updated_at: product.updatedAt,
        article_ids: product.articleIds,
      });
    });

    return product;
  }

  async update(id: string, input: UpdateProductInput): Promise<AffiliateProduct> {
    await this.ensureTables();
    const existing = await this.getById(id);
    if (!existing) throw new Error('Không tìm thấy sản phẩm để cập nhật');

    const now = new Date().toISOString();

    let categoryName = existing.categoryName;
    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        const cat = await this.db.getFirstAsync<{ name: string }>(
          'SELECT name FROM product_categories WHERE id = ?;',
          input.categoryId,
        );
        categoryName = cat?.name || categoryName;
      } else {
        categoryName = undefined;
      }
    }

    const updatedProduct: AffiliateProduct = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      description: input.description !== undefined ? input.description.trim() : existing.description,
      imageUrl: input.imageUrl !== undefined ? input.imageUrl?.trim() || null : existing.imageUrl,
      price: input.price !== undefined ? Number(input.price) || 0 : existing.price,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      categoryName,
      petType: input.petType !== undefined ? input.petType : existing.petType,
      merchantName: input.merchantName !== undefined ? input.merchantName.trim() : existing.merchantName,
      affiliateUrl: input.affiliateUrl !== undefined ? input.affiliateUrl.trim() : existing.affiliateUrl,
      status: input.status !== undefined ? input.status : existing.status,
      updatedAt: now,
      articleIds: input.articleIds !== undefined ? input.articleIds : existing.articleIds,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE affiliate_products SET
          name = ?, description = ?, image_url = ?, price = ?,
          category_id = ?, category_name = ?, pet_type = ?, merchant_name = ?,
          affiliate_url = ?, status = ?, updated_at = ?, local_updated_at = ?,
          sync_status = 'pending_update'
        WHERE id = ?;`,
        updatedProduct.name,
        updatedProduct.description ?? null,
        updatedProduct.imageUrl ?? null,
        updatedProduct.price,
        updatedProduct.categoryId ?? null,
        updatedProduct.categoryName ?? null,
        updatedProduct.petType,
        updatedProduct.merchantName ?? null,
        updatedProduct.affiliateUrl,
        updatedProduct.status,
        now,
        now,
        id,
      );

      // Update article links if provided
      if (input.articleIds !== undefined) {
        await this.db.runAsync(`DELETE FROM article_products WHERE product_id = ?;`, id);
        for (const artId of input.articleIds) {
          await this.db.runAsync(
            `INSERT OR IGNORE INTO article_products (article_id, product_id) VALUES (?, ?);`,
            artId,
            id,
          );
        }
      }

      await this.outboxDao.add('affiliate_products', id, 'UPDATE', {
        name: updatedProduct.name,
        description: updatedProduct.description,
        image_url: updatedProduct.imageUrl,
        price: updatedProduct.price,
        category_id: updatedProduct.categoryId,
        pet_type: updatedProduct.petType,
        merchant_name: updatedProduct.merchantName,
        affiliate_url: updatedProduct.affiliateUrl,
        status: updatedProduct.status,
        updated_at: now,
        article_ids: updatedProduct.articleIds,
      });
    });

    return updatedProduct;
  }

  async softDelete(id: string): Promise<void> {
    await this.ensureTables();
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE affiliate_products SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending_delete'
         WHERE id = ?;`,
        now,
        now,
        now,
        id,
      );

      await this.outboxDao.add('affiliate_products', id, 'DELETE', {
        id,
        deleted_at: now,
      });
    });
  }

  async markSynced(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE affiliate_products SET sync_status = 'synced', last_synced_at = ? WHERE id = ?;`,
      now,
      id,
    );
  }

  async linkProductsToArticle(articleId: string, productIds: string[]): Promise<void> {
    await this.ensureTables();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(`DELETE FROM article_products WHERE article_id = ?;`, articleId);
      for (const pId of productIds) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO article_products (article_id, product_id) VALUES (?, ?);`,
          articleId,
          pId,
        );
      }
    });
  }

  async getProductArticleIds(productId: string): Promise<string[]> {
    await this.ensureTables();
    const rows = await this.db.getAllAsync<{ article_id: string }>(
      `SELECT article_id FROM article_products WHERE product_id = ?;`,
      productId,
    );
    return rows.map((r) => r.article_id);
  }

  async upsertFromRemote(remoteProduct: Record<string, any>): Promise<'updated' | 'inserted' | 'conflict'> {
    await this.ensureTables();
    const existing = await this.db.getFirstAsync<{
      id: string;
      sync_status: string;
      local_updated_at: string;
    }>('SELECT id, sync_status, local_updated_at FROM affiliate_products WHERE id = ?;', remoteProduct.id);

    const now = new Date().toISOString();

    if (!existing) {
      await this.db.runAsync(
        `INSERT INTO affiliate_products (
          id, name, slug, description, image_url, price,
          category_id, category_name, pet_type, merchant_name, affiliate_url,
          status, created_by, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
        remoteProduct.id,
        remoteProduct.name,
        remoteProduct.slug,
        remoteProduct.description,
        remoteProduct.image_url || null,
        remoteProduct.price || 0,
        remoteProduct.category_id || null,
        remoteProduct.category_name || null,
        remoteProduct.pet_type || 'all',
        remoteProduct.merchant_name || 'Shopee',
        remoteProduct.affiliate_url,
        remoteProduct.status || 'active',
        remoteProduct.created_by || null,
        remoteProduct.created_at,
        remoteProduct.updated_at,
        remoteProduct.deleted_at || null,
        now,
        now,
      );
      return 'inserted';
    }

    if (existing.sync_status !== 'synced') {
      const localTime = new Date(existing.local_updated_at).getTime();
      const remoteTime = new Date(remoteProduct.updated_at).getTime();
      if (localTime > remoteTime) {
        return 'conflict';
      }
    }

    await this.db.runAsync(
      `UPDATE affiliate_products SET
        name = ?, slug = ?, description = ?, image_url = ?, price = ?,
        category_id = ?, category_name = COALESCE(?, category_name),
        pet_type = ?, merchant_name = ?, affiliate_url = ?, status = ?,
        updated_at = ?, deleted_at = ?, sync_status = 'synced', last_synced_at = ?,
        local_updated_at = ?
      WHERE id = ?;`,
      remoteProduct.name,
      remoteProduct.slug,
      remoteProduct.description,
      remoteProduct.image_url || null,
      remoteProduct.price || 0,
      remoteProduct.category_id || null,
      remoteProduct.category_name || null,
      remoteProduct.pet_type || 'all',
      remoteProduct.merchant_name || 'Shopee',
      remoteProduct.affiliate_url,
      remoteProduct.status || 'active',
      remoteProduct.updated_at,
      remoteProduct.deleted_at || null,
      now,
      now,
      remoteProduct.id,
    );
    return 'updated';
  }
}
