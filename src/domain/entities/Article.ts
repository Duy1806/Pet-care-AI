/**
 * PawCare AI — Domain Entity: Article & BlogCategory
 */

export type ArticleStatus = 'draft' | 'published' | 'hidden';

export type TargetSpecies = 'all' | 'dog' | 'cat' | 'bird' | 'rabbit' | 'hamster';

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  description?: string | null;
  sortOrder?: number;
}

export interface Article {
  id: string;
  authorId: string | null;
  authorName?: string;
  categoryId: string | null;
  categoryName?: string;
  categoryIcon?: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  excerpt: string;
  content: string;
  targetSpecies: TargetSpecies;
  sourceUrl: string | null;
  sourceName: string | null;
  status: ArticleStatus;
  viewsCount: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleInput {
  title: string;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  excerpt: string;
  content: string;
  targetSpecies?: TargetSpecies;
  sourceUrl?: string | null;
  sourceName?: string | null;
  status?: ArticleStatus;
}

export interface UpdateArticleInput {
  title?: string;
  categoryId?: string | null;
  coverImageUrl?: string | null;
  excerpt?: string;
  content?: string;
  targetSpecies?: TargetSpecies;
  sourceUrl?: string | null;
  sourceName?: string | null;
  status?: ArticleStatus;
}
