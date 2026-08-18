/**
 * Category icon mapping for mobile.
 *
 * Maps lucide-react icon names from backend categories to lucide-react-native icon components.
 * Matches the frontend getCategoryIcon logic from JobListingPage.tsx.
 */

import {
  Brush,
  Sprout,
  Hammer,
  Package,
  Handshake,
  Wrench,
  Paintbrush,
  Truck,
  Laptop,
  MoreHorizontal,
  Home,
  Grid3x3,
  LucideIcon,
} from 'lucide-react-native';

/**
 * Map of lucide-react icon names (from backend) to lucide-react-native icon components.
 *
 * The backend stores category.icon as a string (e.g., "Brush", "Wrench").
 * This map converts those string names to the corresponding lucide-react-native icons.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  Brush,
  BrushCleaning: Brush,
  Sprout,
  Flower2: Sprout,
  Hammer,
  Box: Package,
  Package,
  Handshake,
  Wrench,
  Paintbrush,
  Truck,
  Laptop,
  Home,
  MoreHorizontal,
  Grid3x3,
};

/**
 * Get icon component for a category.
 *
 * Priority:
 * 1. Use backend category.icon if it maps to a known icon
 * 2. Fall back to name-based matching (category name contains keywords)
 * 3. Return default MoreHorizontal icon
 *
 * @param category - Category object with name and optional icon field
 * @returns lucide-react-native icon component
 */
export function getCategoryIcon(
  category: { name?: string; icon?: string } | null | undefined
): LucideIcon {
  if (!category) return MoreHorizontal;

  // Try backend icon first
  if (category.icon && ICON_MAP[category.icon]) {
    return ICON_MAP[category.icon];
  }

  // Fallback: match by category name
  const lowerName = (category.name || '').toLowerCase();

  if (lowerName.includes('håndverk') || lowerName.includes('oppussing'))
    return Wrench;
  if (lowerName.includes('maling')) return Paintbrush;
  if (lowerName.includes('rengjøring') || lowerName.includes('rense'))
    return Home;
  if (lowerName.includes('flytting') || lowerName.includes('flytt'))
    return Truck;
  if (lowerName.includes('hage') || lowerName.includes('hagearbeid'))
    return Sprout;
  if (lowerName.includes('it') || lowerName.includes('nettverk') || lowerName.includes('pc'))
    return Laptop;
  if (lowerName.includes('transport')) return Package;
  if (lowerName.includes('rørlegger')) return Wrench;
  if (lowerName.includes('småjobber')) return Handshake;

  return MoreHorizontal;
}

/**
 * Get icon component and label for "Alle" (All categories).
 * Matches the "All" icon used in the frontend.
 *
 * @returns lucide-react-native icon component
 */
export function getAllCategoriesIcon(): LucideIcon {
  return Grid3x3;
}
