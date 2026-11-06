/**
 * PawCare AI — Article Store (Zustand)
 *
 * Manages Blog & Pet Care Knowledge articles for both users and administrators.
 */
import { create } from 'zustand';
import type {
  Article,
  ArticleStatus,
  BlogCategory,
  CreateArticleInput,
  TargetSpecies,
  UpdateArticleInput,
} from '@/domain/entities/Article';
import { articleRepository } from '@/di/container';

interface ArticleState {
  // User states
  articles: Article[];
  categories: BlogCategory[];
  selectedCategory: string | null;
  selectedSpecies: TargetSpecies;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  currentArticle: Article | null;

  // Admin states
  adminArticles: Article[];
  adminStatusFilter: ArticleStatus | 'all';
  adminSearch: string;
  isAdminLoading: boolean;

  // User actions
  loadPublishedArticles: () => Promise<void>;
  loadCategories: () => Promise<void>;
  setSelectedCategory: (categoryId: string | null) => void;
  setSelectedSpecies: (species: TargetSpecies) => void;
  setSearchQuery: (query: string) => void;
  loadArticleDetail: (id: string) => Promise<Article | null>;

  // Admin actions
  setAdminStatusFilter: (status: ArticleStatus | 'all') => void;
  setAdminSearch: (query: string) => void;
  loadAdminArticles: () => Promise<void>;
  createArticle: (input: CreateArticleInput) => Promise<Article>;
  updateArticle: (id: string, input: UpdateArticleInput) => Promise<Article>;
  deleteArticle: (id: string) => Promise<void>;
  toggleStatus: (id: string, newStatus: ArticleStatus) => Promise<void>;
  createCategory: (name: string, icon?: string) => Promise<BlogCategory>;
}

export const useArticleStore = create<ArticleState>((set, get) => ({
  // User initial states
  articles: [],
  categories: [],
  selectedCategory: null,
  selectedSpecies: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  currentArticle: null,

  // Admin initial states
  adminArticles: [],
  adminStatusFilter: 'all',
  adminSearch: '',
  isAdminLoading: false,

  loadCategories: async () => {
    try {
      const cats = await articleRepository.getCategories();
      set({ categories: cats });
    } catch {
      // Ignored
    }
  },

  loadPublishedArticles: async () => {
    try {
      set({ isLoading: true, error: null });
      const { selectedCategory, selectedSpecies, searchQuery } = get();
      const fetched = await articleRepository.getPublishedArticles({
        categoryId: selectedCategory,
        species: selectedSpecies,
        search: searchQuery,
      });
      set({ articles: fetched, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Không thể tải danh sách bài viết' });
    }
  },

  setSelectedCategory: (categoryId) => {
    set({ selectedCategory: categoryId });
    void get().loadPublishedArticles();
  },

  setSelectedSpecies: (species) => {
    set({ selectedSpecies: species });
    void get().loadPublishedArticles();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    void get().loadPublishedArticles();
  },

  loadArticleDetail: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const article = await articleRepository.getArticleById(id);
      set({ currentArticle: article, isLoading: false });
      return article;
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Không thể tải chi tiết bài viết' });
      return null;
    }
  },

  // Admin actions
  setAdminStatusFilter: (status) => {
    set({ adminStatusFilter: status });
    void get().loadAdminArticles();
  },

  setAdminSearch: (query) => {
    set({ adminSearch: query });
    void get().loadAdminArticles();
  },

  loadAdminArticles: async () => {
    try {
      set({ isAdminLoading: true });
      const { adminStatusFilter, adminSearch } = get();
      const items = await articleRepository.getAllArticlesAdmin({
        status: adminStatusFilter,
        search: adminSearch,
      });
      set({ adminArticles: items, isAdminLoading: false });
    } catch (e) {
      set({ isAdminLoading: false });
    }
  },

  createArticle: async (input) => {
    const created = await articleRepository.createArticle(input);
    const updated = [created, ...get().adminArticles];
    set({ adminArticles: updated });
    // Also refresh public articles if it was published
    if (created.status === 'published') {
      void get().loadPublishedArticles();
    }
    return created;
  },

  updateArticle: async (id, input) => {
    const updated = await articleRepository.updateArticle(id, input);
    const list = get().adminArticles.map((a) => (a.id === id ? updated : a));
    set({ adminArticles: list });
    void get().loadPublishedArticles();
    return updated;
  },

  deleteArticle: async (id) => {
    await articleRepository.deleteArticle(id);
    const remaining = get().adminArticles.filter((a) => a.id !== id);
    set({ adminArticles: remaining });
    void get().loadPublishedArticles();
  },

  toggleStatus: async (id, newStatus) => {
    const updated = await articleRepository.toggleArticleStatus(id, newStatus);
    const list = get().adminArticles.map((a) => (a.id === id ? updated : a));
    set({ adminArticles: list });
    void get().loadPublishedArticles();
  },

  createCategory: async (name, icon) => {
    const cat = await articleRepository.createCategory(name, icon);
    const updated = [...get().categories, cat];
    set({ categories: updated });
    return cat;
  },
}));
