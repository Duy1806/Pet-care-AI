/**
 * PawCare AI — Article DAO (Local SQLite Access)
 *
 * Caches blog categories and published articles for offline reading.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Article, BlogCategory, TargetSpecies } from '@/domain/entities/Article';

export class ArticleDao {
  constructor(private readonly db: SQLiteDatabase) {}

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
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_local_articles_species ON articles(target_species);
      CREATE INDEX IF NOT EXISTS idx_local_articles_cat ON articles(category_id);
    `);
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
    for (const a of articles) {
      await this.db.runAsync(
        `INSERT INTO articles (
          id, author_id, category_id, category_name, title, slug,
          cover_image_url, excerpt, content, target_species,
          source_url, source_name, status, views_count,
          published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          updated_at = excluded.updated_at;`,
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
      );
    }
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
      FROM articles WHERE status = 'published'`;
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

  async getById(id: string): Promise<Article | null> {
    await this.ensureTables();
    return this.db.getFirstAsync<Article>(
      `SELECT 
        id, author_id as authorId, category_id as categoryId, category_name as categoryName,
        title, slug, cover_image_url as coverImageUrl, excerpt, content,
        target_species as targetSpecies, source_url as sourceUrl, source_name as sourceName,
        status, views_count as viewsCount, published_at as publishedAt,
        created_at as createdAt, updated_at as updatedAt
       FROM articles WHERE id = ?;`,
      id,
    );
  }
}
