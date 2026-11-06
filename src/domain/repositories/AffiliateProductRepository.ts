/**
 * PawCare AI — Affiliate Product Repository Interface
 */
import type {
  AffiliateProduct,
  CreateProductInput,
  ProductCategory,
  ProductPetType,
  ProductStatus,
  UpdateProductInput,
} from '../entities/AffiliateProduct';

export interface ProductFilterParams {
  categoryId?: string | null;
  petType?: ProductPetType;
  search?: string;
  limit?: number;
}

export interface AdminProductFilterParams {
  status?: ProductStatus | 'all';
  search?: string;
  limit?: number;
}

export interface AffiliateProductRepository {
  /** User operations */
  getActiveProducts(params?: ProductFilterParams): Promise<AffiliateProduct[]>;
  getProductById(id: string): Promise<AffiliateProduct | null>;
  getProductCategories(): Promise<ProductCategory[]>;
  getProductsByArticleId(articleId: string): Promise<AffiliateProduct[]>;

  /** Admin operations */
  getAllProductsAdmin(params?: AdminProductFilterParams): Promise<AffiliateProduct[]>;
  createProduct(input: CreateProductInput): Promise<AffiliateProduct>;
  updateProduct(id: string, input: UpdateProductInput): Promise<AffiliateProduct>;
  deleteProduct(id: string): Promise<void>;
  toggleProductStatus(id: string, status: ProductStatus): Promise<AffiliateProduct>;
  createCategory(name: string, icon?: string): Promise<ProductCategory>;
  linkProductsToArticle(articleId: string, productIds: string[]): Promise<void>;
  getProductArticleIds(productId: string): Promise<string[]>;
}

