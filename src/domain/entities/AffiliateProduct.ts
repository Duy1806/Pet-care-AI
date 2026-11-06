/**
 * PawCare AI — Affiliate Product Domain Entity
 *
 * Defines the core models for PetCare Shop & Affiliate Marketing.
 */

export type ProductStatus = 'active' | 'draft' | 'hidden';
export type ProductPetType = 'all' | 'dog' | 'cat';

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  sortOrder?: number;
}

export interface AffiliateProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string | null;
  price: number; // Giá tham khảo (VND)
  categoryId?: string | null;
  categoryName?: string;
  categoryIcon?: string;
  petType: ProductPetType;
  merchantName: string; // e.g. 'Shopee', 'Lazada', 'Tiki', 'Website đối tác'
  affiliateUrl: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  articleIds?: string[]; // IDs of articles linked to this product
}

export interface CreateProductInput {
  name: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  categoryId?: string | null;
  petType?: ProductPetType;
  merchantName: string;
  affiliateUrl: string;
  status?: ProductStatus;
  articleIds?: string[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  imageUrl?: string | null;
  price?: number;
  categoryId?: string | null;
  petType?: ProductPetType;
  merchantName?: string;
  affiliateUrl?: string;
  status?: ProductStatus;
  articleIds?: string[];
}

