/**
 * PawCare AI — Supabase Article Repository Implementation
 *
 * Implements ArticleRepository with real Supabase queries, RLS policies,
 * and offline SQLite fallback for seamless reading experience.
 */
import { supabase } from '../remote/supabaseClient';
import { mapSupabaseError } from '../remote/supabaseErrors';
import { getDatabase } from '../local/database';
import { ArticleDao } from '../local/ArticleDao';
import type {
  Article,
  ArticleStatus,
  BlogCategory,
  CreateArticleInput,
  TargetSpecies,
  UpdateArticleInput,
} from '@/domain/entities/Article';
import type {
  AdminArticleFilterParams,
  ArticleFilterParams,
  ArticleRepository,
} from '@/domain/repositories/ArticleRepository';

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

function mapRowToArticle(row: any): Article {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.profiles?.full_name || 'Ban biên tập PetCare AI',
    categoryId: row.category_id,
    categoryName: row.blog_categories?.name || 'Kiến thức chung',
    categoryIcon: row.blog_categories?.icon || 'book-open-outline',
    title: row.title,
    slug: row.slug,
    coverImageUrl: row.cover_image_url,
    excerpt: row.excerpt,
    content: row.content,
    targetSpecies: (row.target_species as TargetSpecies) || 'all',
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    status: (row.status as ArticleStatus) || 'published',
    viewsCount: row.views_count ?? 0,
    publishedAt: row.published_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToCategory(row: any): BlogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon || 'book-open-outline',
    description: row.description,
    sortOrder: row.sort_order ?? 0,
  };
}

export class ArticleRepositorySupabase implements ArticleRepository {
  async getPublishedArticles(params?: ArticleFilterParams): Promise<Article[]> {
    try {
      let query = supabase
        .from('articles')
        .select('*, blog_categories(name, icon), profiles:author_id(full_name)')
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('published_at', { ascending: false });

      if (params?.categoryId) {
        query = query.eq('category_id', params.categoryId);
      }

      if (params?.species && params.species !== 'all') {
        query = query.or(`target_species.eq.${params.species},target_species.eq.all`);
      }

      if (params?.search && params.search.trim()) {
        const term = `%${params.search.trim()}%`;
        query = query.or(`title.ilike.${term},excerpt.ilike.${term}`);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;
      if (error) throw new Error(mapSupabaseError(error));

      const articles = (data || []).map(mapRowToArticle);

      // Async cache to local SQLite for offline reading
      try {
        const db = await getDatabase();
        const dao = new ArticleDao(db);
        await dao.saveArticles(articles);
      } catch {}

      return articles;
    } catch {
      // Offline fallback: load from local SQLite
      try {
        const db = await getDatabase();
        const dao = new ArticleDao(db);
        return dao.getPublishedArticles(params);
      } catch {
        return [];
      }
    }
  }

  async getArticleById(id: string): Promise<Article | null> {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*, blog_categories(name, icon), profiles:author_id(full_name)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();

      if (error || !data) return null;

      // Increment view count asynchronously
      void supabase
        .from('articles')
        .update({ views_count: (data.views_count || 0) + 1 })
        .eq('id', id);

      const article = mapRowToArticle(data);

      try {
        const db = await getDatabase();
        const dao = new ArticleDao(db);
        await dao.saveArticles([article]);
      } catch {}

      return article;
    } catch {
      // Offline fallback
      try {
        const db = await getDatabase();
        const dao = new ArticleDao(db);
        return dao.getById(id);
      } catch {
        return null;
      }
    }
  }

  async getCategories(): Promise<BlogCategory[]> {
    try {
      const { data, error } = await supabase
        .from('blog_categories')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw new Error(mapSupabaseError(error));

      const categories = (data || []).map(mapRowToCategory);

      try {
        const db = await getDatabase();
        const dao = new ArticleDao(db);
        await dao.saveCategories(categories);
      } catch {}

      return categories;
    } catch {
      // Offline fallback
      try {
        const db = await getDatabase();
        const dao = new ArticleDao(db);
        return dao.getCategories();
      } catch {
        return [];
      }
    }
  }

  async getAllArticlesAdmin(params?: AdminArticleFilterParams): Promise<Article[]> {
    let query = supabase
      .from('articles')
      .select('*, blog_categories(name, icon), profiles:author_id(full_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (params?.status && params.status !== 'all') {
      query = query.eq('status', params.status);
    }

    if (params?.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`title.ilike.${term},excerpt.ilike.${term}`);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(mapSupabaseError(error));

    return (data || []).map(mapRowToArticle);
  }

  async createArticle(input: CreateArticleInput): Promise<Article> {
    let authorId: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      authorId = data?.session?.user?.id || null;
    } catch {}

    const baseSlug = slugify(input.title);
    const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;

    const rowToInsert = {
      author_id: authorId,
      category_id: input.categoryId || null,
      title: input.title.trim(),
      slug: uniqueSlug,
      cover_image_url: input.coverImageUrl?.trim() || null,
      excerpt: input.excerpt.trim(),
      content: input.content.trim(),
      target_species: input.targetSpecies || 'all',
      source_url: input.sourceUrl?.trim() || null,
      source_name: input.sourceName?.trim() || null,
      status: input.status || 'published',
      published_at: input.status === 'published' ? new Date().toISOString() : null,
    };

    const { data, error } = await supabase
      .from('articles')
      .insert(rowToInsert)
      .select('*, blog_categories(name, icon), profiles:author_id(full_name)')
      .single();

    if (error || !data) {
      throw new Error(mapSupabaseError(error));
    }

    const created = mapRowToArticle(data);
    try {
      const db = await getDatabase();
      const dao = new ArticleDao(db);
      await dao.saveArticles([created]);
    } catch {}

    return created;
  }

  async updateArticle(id: string, input: UpdateArticleInput): Promise<Article> {
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updates.title = input.title.trim();
    if (input.categoryId !== undefined) updates.category_id = input.categoryId;
    if (input.coverImageUrl !== undefined) updates.cover_image_url = input.coverImageUrl?.trim() || null;
    if (input.excerpt !== undefined) updates.excerpt = input.excerpt.trim();
    if (input.content !== undefined) updates.content = input.content.trim();
    if (input.targetSpecies !== undefined) updates.target_species = input.targetSpecies;
    if (input.sourceUrl !== undefined) updates.source_url = input.sourceUrl?.trim() || null;
    if (input.sourceName !== undefined) updates.source_name = input.sourceName?.trim() || null;
    if (input.status !== undefined) {
      updates.status = input.status;
      if (input.status === 'published') {
        updates.published_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from('articles')
      .update(updates)
      .eq('id', id)
      .select('*, blog_categories(name, icon), profiles:author_id(full_name)')
      .single();

    if (error || !data) {
      throw new Error(mapSupabaseError(error));
    }

    const updated = mapRowToArticle(data);
    try {
      const db = await getDatabase();
      const dao = new ArticleDao(db);
      await dao.saveArticles([updated]);
    } catch {}

    return updated;
  }

  async deleteArticle(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('articles')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id);

    if (error) throw new Error(mapSupabaseError(error));
  }

  async toggleArticleStatus(id: string, status: ArticleStatus): Promise<Article> {
    return this.updateArticle(id, { status });
  }

  async createCategory(name: string, icon?: string): Promise<BlogCategory> {
    const slug = slugify(name);
    const { data, error } = await supabase
      .from('blog_categories')
      .insert({
        name: name.trim(),
        slug,
        icon: icon || 'book-open-outline',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(mapSupabaseError(error));
    }

    const cat = mapRowToCategory(data);
    try {
      const db = await getDatabase();
      const dao = new ArticleDao(db);
      await dao.saveCategories([cat]);
    } catch {}

    return cat;
  }
}

export const articleRepository = new ArticleRepositorySupabase();
