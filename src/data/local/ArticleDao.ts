/**
 * PawCare AI — Article DAO (Local SQLite Access)
 *
 * Provides offline-first storage and synchronization outbox queuing
 * for PetCare Blog articles and categories.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { OutboxDao } from './OutboxDao';
import { generateUUID } from './uuid';
import type { Article, ArticleStatus, BlogCategory, CreateArticleInput, TargetSpecies, UpdateArticleInput } from '@/domain/entities/Article';

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

export class ArticleDao {
  private readonly outboxDao: OutboxDao;

  constructor(private readonly db: SQLiteDatabase) {
    this.outboxDao = new OutboxDao(db);
  }

  async ensureTables(): Promise<void> {
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS blog_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        icon TEXT,
        description TEXT,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        author_id TEXT,
        category_id TEXT,
        category_name TEXT,
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        cover_image_url TEXT,
        excerpt TEXT NOT NULL,
        content TEXT NOT NULL,
        target_species TEXT NOT NULL DEFAULT 'all',
        source_url TEXT,
        source_name TEXT,
        status TEXT NOT NULL DEFAULT 'published',
        views_count INTEGER NOT NULL DEFAULT 0,
        published_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        sync_status TEXT NOT NULL DEFAULT 'synced',
        last_synced_at TEXT,
        local_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_local_articles_species ON articles(target_species);
      CREATE INDEX IF NOT EXISTS idx_local_articles_cat ON articles(category_id);
      CREATE INDEX IF NOT EXISTS idx_local_articles_status ON articles(status);
    `);

    // Dynamically ensure missing columns on existing SQLite installs
    try {
      const tableInfo = await this.db.getAllAsync<{ name: string }>('PRAGMA table_info(articles);');
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
          await this.db.execAsync(`ALTER TABLE articles ADD COLUMN ${col.name} ${col.type};`);
        }
      }
    } catch (e) {
      console.warn('[ArticleDao] Column migration error:', e);
    }
  }

  async saveCategories(categories: BlogCategory[]): Promise<void> {
    await this.ensureTables();
    for (const c of categories) {
      await this.db.runAsync(
        `INSERT INTO blog_categories (id, name, slug, icon, description, sort_order)
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

  async getCategories(): Promise<BlogCategory[]> {
    await this.ensureTables();
    return this.db.getAllAsync<BlogCategory>(
      `SELECT id, name, slug, icon, description, sort_order as sortOrder FROM blog_categories ORDER BY sort_order ASC;`,
    );
  }

  async saveArticles(articles: Article[]): Promise<void> {
    await this.ensureTables();
    const now = new Date().toISOString();
    for (const a of articles) {
      await this.db.runAsync(
        `INSERT INTO articles (
          id, author_id, category_id, category_name, title, slug,
          cover_image_url, excerpt, content, target_species,
          source_url, source_name, status, views_count,
          published_at, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'synced', ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          author_id = excluded.author_id,
          category_id = excluded.category_id,
          category_name = excluded.category_name,
          title = excluded.title,
          slug = excluded.slug,
          cover_image_url = excluded.cover_image_url,
          excerpt = excluded.excerpt,
          content = excluded.content,
          target_species = excluded.target_species,
          source_url = excluded.source_url,
          source_name = excluded.source_name,
          status = excluded.status,
          views_count = excluded.views_count,
          published_at = excluded.published_at,
          updated_at = excluded.updated_at,
          sync_status = 'synced',
          last_synced_at = excluded.last_synced_at;`,
        a.id,
        a.authorId,
        a.categoryId,
        a.categoryName ?? null,
        a.title,
        a.slug,
        a.coverImageUrl,
        a.excerpt,
        a.content,
        a.targetSpecies,
        a.sourceUrl,
        a.sourceName,
        a.status,
        a.viewsCount,
        a.publishedAt,
        a.createdAt,
        a.updatedAt,
        now,
        now,
      );
    }
  }

  /**
   * Offline-first create article by Admin
   */
  async create(input: CreateArticleInput, authorId: string | null): Promise<Article> {
    await this.ensureTables();
    const now = new Date().toISOString();
    const id = generateUUID();
    const baseSlug = slugify(input.title);
    const slug = `${baseSlug}-${id.slice(0, 4)}`;

    // Resolve category name from SQLite if present
    let categoryName = 'Kiến thức chung';
    if (input.categoryId) {
      const cat = await this.db.getFirstAsync<{ name: string }>(
        'SELECT name FROM blog_categories WHERE id = ?;',
        input.categoryId,
      );
      if (cat?.name) categoryName = cat.name;
    }

    const article: Article = {
      id,
      authorId,
      authorName: 'Admin',
      categoryId: input.categoryId || null,
      categoryName,
      title: input.title.trim(),
      slug,
      coverImageUrl: input.coverImageUrl?.trim() || null,
      excerpt: input.excerpt.trim(),
      content: input.content.trim(),
      targetSpecies: input.targetSpecies || 'all',
      sourceUrl: input.sourceUrl?.trim() || null,
      sourceName: input.sourceName?.trim() || null,
      status: input.status || 'published',
      viewsCount: 0,
      publishedAt: input.status === 'published' ? now : now,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO articles (
          id, author_id, category_id, category_name, title, slug,
          cover_image_url, excerpt, content, target_species,
          source_url, source_name, status, views_count,
          published_at, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending_create', NULL, ?);`,
        article.id,
        article.authorId,
        article.categoryId,
        article.categoryName ?? null,
        article.title,
        article.slug,
        article.coverImageUrl,
        article.excerpt,
        article.content,
        article.targetSpecies,
        article.sourceUrl,
        article.sourceName,
        article.status,
        article.viewsCount,
        article.publishedAt,
        article.createdAt,
        article.updatedAt,
        now,
      );

      // Queue for background synchronization to Supabase
      await this.outboxDao.add('articles', article.id, 'INSERT', {
        id: article.id,
        author_id: article.authorId,
        category_id: article.categoryId,
        title: article.title,
        slug: article.slug,
        cover_image_url: article.coverImageUrl,
        excerpt: article.excerpt,
        content: article.content,
        target_species: article.targetSpecies,
        source_url: article.sourceUrl,
        source_name: article.sourceName,
        status: article.status,
        published_at: article.publishedAt,
        created_at: article.createdAt,
        updated_at: article.updatedAt,
      });
    });

    return article;
  }

  /**
   * Offline-first update article by Admin
   */
  async update(id: string, input: UpdateArticleInput): Promise<Article> {
    await this.ensureTables();
    const existing = await this.getById(id);
    if (!existing) throw new Error('Không tìm thấy bài viết để cập nhật');

    const now = new Date().toISOString();
    const updatedStatus = input.status !== undefined ? input.status : existing.status;
    const publishedAt = updatedStatus === 'published' ? (existing.publishedAt || now) : existing.publishedAt;

    let categoryName = existing.categoryName;
    if (input.categoryId !== undefined) {
      if (input.categoryId) {
        const cat = await this.db.getFirstAsync<{ name: string }>(
          'SELECT name FROM blog_categories WHERE id = ?;',
          input.categoryId,
        );
        categoryName = cat?.name || categoryName;
      } else {
        categoryName = 'Kiến thức chung';
      }
    }

    const updatedArticle: Article = {
      ...existing,
      title: input.title !== undefined ? input.title.trim() : existing.title,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      categoryName,
      coverImageUrl: input.coverImageUrl !== undefined ? input.coverImageUrl?.trim() || null : existing.coverImageUrl,
      excerpt: input.excerpt !== undefined ? input.excerpt.trim() : existing.excerpt,
      content: input.content !== undefined ? input.content.trim() : existing.content,
      targetSpecies: input.targetSpecies !== undefined ? input.targetSpecies : existing.targetSpecies,
      sourceUrl: input.sourceUrl !== undefined ? input.sourceUrl?.trim() || null : existing.sourceUrl,
      sourceName: input.sourceName !== undefined ? input.sourceName?.trim() || null : existing.sourceName,
      status: updatedStatus,
      publishedAt,
      updatedAt: now,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE articles SET
          title = ?, category_id = ?, category_name = ?, cover_image_url = ?,
          excerpt = ?, content = ?, target_species = ?, source_url = ?,
          source_name = ?, status = ?, published_at = ?, updated_at = ?,
          local_updated_at = ?, sync_status = 'pending_update'
        WHERE id = ?;`,
        updatedArticle.title,
        updatedArticle.categoryId,
        updatedArticle.categoryName ?? null,
        updatedArticle.coverImageUrl,
        updatedArticle.excerpt,
        updatedArticle.content,
        updatedArticle.targetSpecies,
        updatedArticle.sourceUrl,
        updatedArticle.sourceName,
        updatedArticle.status,
        updatedArticle.publishedAt,
        now,
        now,
        id,
      );

      await this.outboxDao.add('articles', id, 'UPDATE', {
        title: updatedArticle.title,
        category_id: updatedArticle.categoryId,
        cover_image_url: updatedArticle.coverImageUrl,
        excerpt: updatedArticle.excerpt,
        content: updatedArticle.content,
        target_species: updatedArticle.targetSpecies,
        source_url: updatedArticle.sourceUrl,
        source_name: updatedArticle.sourceName,
        status: updatedArticle.status,
        published_at: updatedArticle.publishedAt,
        updated_at: now,
      });
    });

    return updatedArticle;
  }

  /**
   * Offline-first soft delete article by Admin
   */
  async softDelete(id: string): Promise<void> {
    await this.ensureTables();
    const now = new Date().toISOString();
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE articles SET deleted_at = ?, updated_at = ?, local_updated_at = ?, sync_status = 'pending_delete'
         WHERE id = ?;`,
        now,
        now,
        now,
        id,
      );

      await this.outboxDao.add('articles', id, 'DELETE', {
        id,
        deleted_at: now,
      });
    });
  }

  async markSynced(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.db.runAsync(
      `UPDATE articles SET sync_status = 'synced', last_synced_at = ? WHERE id = ?;`,
      now,
      id,
    );
  }

  /**
   * Upsert from Remote Pull (Sync Engine)
   */
  async upsertFromRemote(remoteArticle: Record<string, any>): Promise<'updated' | 'inserted' | 'conflict'> {
    await this.ensureTables();
    const existing = await this.db.getFirstAsync<{
      id: string;
      sync_status: string;
      local_updated_at: string;
    }>('SELECT id, sync_status, local_updated_at FROM articles WHERE id = ?;', remoteArticle.id);

    const now = new Date().toISOString();

    if (!existing) {
      await this.db.runAsync(
        `INSERT INTO articles (
          id, author_id, category_id, category_name, title, slug,
          cover_image_url, excerpt, content, target_species,
          source_url, source_name, status, views_count,
          published_at, created_at, updated_at, deleted_at,
          sync_status, last_synced_at, local_updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
        remoteArticle.id,
        remoteArticle.author_id,
        remoteArticle.category_id,
        remoteArticle.category_name || null,
        remoteArticle.title,
        remoteArticle.slug,
        remoteArticle.cover_image_url || null,
        remoteArticle.excerpt,
        remoteArticle.content,
        remoteArticle.target_species || 'all',
        remoteArticle.source_url || null,
        remoteArticle.source_name || null,
        remoteArticle.status || 'published',
        remoteArticle.views_count || 0,
        remoteArticle.published_at || null,
        remoteArticle.created_at,
        remoteArticle.updated_at,
        remoteArticle.deleted_at || null,
        now,
        now,
      );
      return 'inserted';
    }

    if (existing.sync_status !== 'synced') {
      const localTime = new Date(existing.local_updated_at).getTime();
      const remoteTime = new Date(remoteArticle.updated_at).getTime();
      if (localTime > remoteTime) {
        return 'conflict';
      }
    }

    await this.db.runAsync(
      `UPDATE articles SET
        author_id = ?, category_id = ?, category_name = COALESCE(?, category_name),
        title = ?, slug = ?, cover_image_url = ?, excerpt = ?, content = ?,
        target_species = ?, source_url = ?, source_name = ?, status = ?,
        views_count = ?, published_at = ?, updated_at = ?, deleted_at = ?,
        sync_status = 'synced', last_synced_at = ?, local_updated_at = ?
      WHERE id = ?;`,
      remoteArticle.author_id,
      remoteArticle.category_id,
      remoteArticle.category_name || null,
      remoteArticle.title,
      remoteArticle.slug,
      remoteArticle.cover_image_url || null,
      remoteArticle.excerpt,
      remoteArticle.content,
      remoteArticle.target_species || 'all',
      remoteArticle.source_url || null,
      remoteArticle.source_name || null,
      remoteArticle.status || 'published',
      remoteArticle.views_count || 0,
      remoteArticle.published_at || null,
      remoteArticle.updated_at,
      remoteArticle.deleted_at || null,
      now,
      now,
      remoteArticle.id,
    );
    return 'updated';
  }

  async getPublishedArticles(params?: {
    categoryId?: string | null;
    species?: TargetSpecies;
    search?: string;
  }): Promise<Article[]> {
    await this.ensureTables();
    let query = `SELECT 
      id, author_id as authorId, category_id as categoryId, category_name as categoryName,
      title, slug, cover_image_url as coverImageUrl, excerpt, content,
      target_species as targetSpecies, source_url as sourceUrl, source_name as sourceName,
      status, views_count as viewsCount, published_at as publishedAt,
      created_at as createdAt, updated_at as updatedAt
      FROM articles WHERE status = 'published' AND deleted_at IS NULL`;
    const sqlParams: any[] = [];

    if (params?.categoryId) {
      query += ` AND category_id = ?`;
      sqlParams.push(params.categoryId);
    }

    if (params?.species && params.species !== 'all') {
      query += ` AND (target_species = ? OR target_species = 'all')`;
      sqlParams.push(params.species);
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ?)`;
      sqlParams.push(term, term);
    }

    query += ` ORDER BY published_at DESC;`;

    return this.db.getAllAsync<Article>(query, ...sqlParams);
  }

  async getAllAdmin(params?: { status?: string | 'all'; search?: string }): Promise<Article[]> {
    await this.ensureTables();
    let query = `SELECT 
      id, author_id as authorId, category_id as categoryId, category_name as categoryName,
      title, slug, cover_image_url as coverImageUrl, excerpt, content,
      target_species as targetSpecies, source_url as sourceUrl, source_name as sourceName,
      status, views_count as viewsCount, published_at as publishedAt,
      created_at as createdAt, updated_at as updatedAt
      FROM articles WHERE deleted_at IS NULL`;
    const sqlParams: any[] = [];

    if (params?.status && params.status !== 'all') {
      query += ` AND status = ?`;
      sqlParams.push(params.status);
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim().toLowerCase()}%`;
      query += ` AND (LOWER(title) LIKE ? OR LOWER(excerpt) LIKE ?)`;
      sqlParams.push(term, term);
    }

    query += ` ORDER BY created_at DESC;`;

    return this.db.getAllAsync<Article>(query, ...sqlParams);
  }

  async getById(id: string): Promise<Article | null> {
    await this.ensureTables();
    return this.db.getFirstAsync<Article>(
      `SELECT 
        id, author_id as authorId, category_id as categoryId, category_name as categoryName,
        title, slug, cover_image_url as coverImageUrl, excerpt, content,
        target_species as targetSpecies, source_url as sourceUrl, source_name as sourceName,
        status, views_count as viewsCount, published_at as publishedAt,
        created_at as createdAt, updated_at as updatedAt
       FROM articles WHERE id = ? AND deleted_at IS NULL;`,
      id,
    );
  }
}
