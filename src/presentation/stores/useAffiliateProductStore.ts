/**
 * PawCare AI — Affiliate Product Store (Zustand)
 *
 * Manages PetCare Shop products, categories, filters and admin operations.
 */
import { create } from 'zustand';
import type {
  AffiliateProduct,
  CreateProductInput,
  ProductCategory,
  ProductPetType,
  ProductStatus,
  UpdateProductInput,
} from '@/domain/entities/AffiliateProduct';
import { affiliateProductRepository } from '@/di/container';

interface AffiliateProductState {
  // User states
  products: AffiliateProduct[];
  categories: ProductCategory[];
  selectedCategory: string | null;
  selectedPetType: ProductPetType;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  selectedProduct: AffiliateProduct | null;

  // Admin states
  adminProducts: AffiliateProduct[];
  adminStatusFilter: ProductStatus | 'all';
  adminSearch: string;
  isAdminLoading: boolean;

  // User actions
  loadCategories: () => Promise<void>;
  loadActiveProducts: () => Promise<void>;
  setSelectedCategory: (categoryId: string | null) => void;
  setSelectedPetType: (petType: ProductPetType) => void;
  setSearchQuery: (query: string) => void;
  loadProductDetail: (id: string) => Promise<AffiliateProduct | null>;
  getProductsByArticleId: (articleId: string) => Promise<AffiliateProduct[]>;

  // Admin actions
  setAdminStatusFilter: (status: ProductStatus | 'all') => void;
  setAdminSearch: (query: string) => void;
  loadAdminProducts: () => Promise<void>;
  createProduct: (input: CreateProductInput) => Promise<AffiliateProduct>;
  updateProduct: (id: string, input: UpdateProductInput) => Promise<AffiliateProduct>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductStatus: (id: string, newStatus: ProductStatus) => Promise<void>;
  createCategory: (name: string, icon?: string) => Promise<ProductCategory>;
  linkProductsToArticle: (articleId: string, productIds: string[]) => Promise<void>;
  getProductArticleIds: (productId: string) => Promise<string[]>;
}

export const useAffiliateProductStore = create<AffiliateProductState>((set, get) => ({
  // User initial states
  products: [],
  categories: [],
  selectedCategory: null,
  selectedPetType: 'all',
  searchQuery: '',
  isLoading: false,
  error: null,
  selectedProduct: null,

  // Admin initial states
  adminProducts: [],
  adminStatusFilter: 'all',
  adminSearch: '',
  isAdminLoading: false,

  loadCategories: async () => {
    try {
      const cats = await affiliateProductRepository.getProductCategories();
      set({ categories: cats });
    } catch {
      // Ignored
    }
  },

  loadActiveProducts: async () => {
    try {
      set({ isLoading: true, error: null });
      const { selectedCategory, selectedPetType, searchQuery } = get();
      const items = await affiliateProductRepository.getActiveProducts({
        categoryId: selectedCategory,
        petType: selectedPetType,
        search: searchQuery,
      });
      set({ products: items, isLoading: false });
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Không thể tải danh sách sản phẩm' });
    }
  },

  setSelectedCategory: (categoryId) => {
    set({ selectedCategory: categoryId });
    void get().loadActiveProducts();
  },

  setSelectedPetType: (petType) => {
    set({ selectedPetType: petType });
    void get().loadActiveProducts();
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    void get().loadActiveProducts();
  },

  loadProductDetail: async (id: string) => {
    try {
      set({ isLoading: true, error: null });
      const prod = await affiliateProductRepository.getProductById(id);
      set({ selectedProduct: prod, isLoading: false });
      return prod;
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Không thể tải chi tiết sản phẩm' });
      return null;
    }
  },

  getProductsByArticleId: async (articleId: string) => {
    try {
      return await affiliateProductRepository.getProductsByArticleId(articleId);
    } catch {
      return [];
    }
  },

  // Admin actions
  setAdminStatusFilter: (status) => {
    set({ adminStatusFilter: status });
    void get().loadAdminProducts();
  },

  setAdminSearch: (query) => {
    set({ adminSearch: query });
    void get().loadAdminProducts();
  },

  loadAdminProducts: async () => {
    try {
      set({ isAdminLoading: true });
      const { adminStatusFilter, adminSearch } = get();
      const items = await affiliateProductRepository.getAllProductsAdmin({
        status: adminStatusFilter,
        search: adminSearch,
      });
      set({ adminProducts: items, isAdminLoading: false });
    } catch {
      set({ isAdminLoading: false });
    }
  },

  createProduct: async (input) => {
    const created = await affiliateProductRepository.createProduct(input);
    const updated = [created, ...get().adminProducts];
    set({ adminProducts: updated });
    if (created.status === 'active') {
      void get().loadActiveProducts();
    }
    return created;
  },

  updateProduct: async (id, input) => {
    const updated = await affiliateProductRepository.updateProduct(id, input);
    const list = get().adminProducts.map((p) => (p.id === id ? updated : p));
    set({ adminProducts: list });
    void get().loadActiveProducts();
    return updated;
  },

  deleteProduct: async (id) => {
    await affiliateProductRepository.deleteProduct(id);
    const remaining = get().adminProducts.filter((p) => p.id !== id);
    set({ adminProducts: remaining });
    void get().loadActiveProducts();
  },

  toggleProductStatus: async (id, newStatus) => {
    const updated = await affiliateProductRepository.toggleProductStatus(id, newStatus);
    const list = get().adminProducts.map((p) => (p.id === id ? updated : p));
    set({ adminProducts: list });
    void get().loadActiveProducts();
  },

  createCategory: async (name, icon) => {
    const cat = await affiliateProductRepository.createCategory(name, icon);
    const updated = [...get().categories, cat];
    set({ categories: updated });
    return cat;
  },

  linkProductsToArticle: async (articleId, productIds) => {
    await affiliateProductRepository.linkProductsToArticle(articleId, productIds);
  },

  getProductArticleIds: async (productId) => {
    return affiliateProductRepository.getProductArticleIds(productId);
  },
}));

