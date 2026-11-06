/**
 * PawCare AI — Domain Repository Interface: ArticleRepository
 */
import type {
  Article,
  ArticleStatus,
  BlogCategory,
  CreateArticleInput,
  TargetSpecies,
  UpdateArticleInput,
} from '../entities/Article';

export interface ArticleFilterParams {
  categoryId?: string | null;
  species?: TargetSpecies;
  search?: string;
  limit?: number;
}

export interface AdminArticleFilterParams {
  status?: ArticleStatus | 'all';
  search?: string;
  limit?: number;
}

export interface ArticleRepository {
  /** User facing: Get only published articles */
  getPublishedArticles(params?: ArticleFilterParams): Promise<Article[]>;

  /** User facing: Get details of an article */
  getArticleById(id: string): Promise<Article | null>;

  /** Get all categories */
  getCategories(): Promise<BlogCategory[]>;

  /** Admin facing: Get all articles (draft, published, hidden) */
  getAllArticlesAdmin(params?: AdminArticleFilterParams): Promise<Article[]>;

  /** Admin facing: Create a new article */
  createArticle(input: CreateArticleInput): Promise<Article>;

  /** Admin facing: Update article */
  updateArticle(id: string, input: UpdateArticleInput): Promise<Article>;

  /** Admin facing: Delete article (soft-delete) */
  deleteArticle(id: string): Promise<void>;

  /** Admin facing: Quick toggle status */
  toggleArticleStatus(id: string, status: ArticleStatus): Promise<Article>;

  /** Admin facing: Create a new category */
  createCategory(name: string, icon?: string): Promise<BlogCategory>;
}
