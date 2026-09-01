/**
 * Category types for job discovery and filtering.
 *
 * Maps to backend Category model with icon field containing lucide-react icon names.
 */

export interface Category {
  _id: string;
  name: string;
  icon: string;
  parentId?: string;
  slug?: string;
  isActive?: boolean;
}

export interface CategoryWithCount extends Category {
  count: number;
  subcategories?: CategoryWithCount[];
}

export interface FilterOptions {
  categories: CategoryWithCount[];
  locations: { name: string; count: number }[];
  urgentCount: number;
  priceRange: { min: number; max: number };
  sortOptions: Array<{
    value: string;
    label: string;
  }>;
  types: Array<{
    label: string;
    value: string;
    count: number;
  }>;
}
