import { useState, useCallback } from 'react';

export interface SearchFiltersState {
  // Text search
  searchText: string;
  
  // Categories
  selectedCategories: string[];
  
  // Price
  minPrice: number;
  maxPrice: number;
  
  // Urgent
  isUrgent: boolean;
  
  // Location - counties, municipalities, areas
  selectedCountyCodes: string[];
  selectedMunicipalityCodes: string[];
  selectedAreaCodes: string[];
  expandedCounties: string[];
  expandedMunicipalities: string[];
  
  // Current location
  userLocation: { lat: number; lng: number } | null;
  isLocating: boolean;
  
  // Sort
  sortValue: string;
}

const DEFAULT_FILTERS: SearchFiltersState = {
  searchText: '',
  selectedCategories: [],
  minPrice: 0,
  maxPrice: 100000,
  isUrgent: false,
  selectedCountyCodes: [],
  selectedMunicipalityCodes: [],
  selectedAreaCodes: [],
  expandedCounties: [],
  expandedMunicipalities: [],
  userLocation: null,
  isLocating: false,
  sortValue: 'newest',
};

/**
 * Hook to manage all search filter state in one place.
 * Provides typed state and convenient mutation functions.
 * 
 * Usage:
 *   const filters = useSearchFilters();
 *   filters.setMinPrice(5000);
 *   filters.toggleCategory('Maling');
 *   filters.resetAll();
 */
export function useSearchFilters(initialSearch = '') {
  const [filters, setFilters] = useState<SearchFiltersState>({
    ...DEFAULT_FILTERS,
    searchText: initialSearch,
  });

  // Search
  const setSearchText = useCallback((text: string) => {
    setFilters((prev) => ({ ...prev, searchText: text }));
  }, []);

  // Categories
  const setSelectedCategories = useCallback((categories: string[]) => {
    setFilters((prev) => ({ ...prev, selectedCategories: categories }));
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(category)
        ? prev.selectedCategories.filter((c) => c !== category)
        : [...prev.selectedCategories, category],
    }));
  }, []);

  // Price
  const setMinPrice = useCallback((price: number) => {
    setFilters((prev) => ({ ...prev, minPrice: price }));
  }, []);

  const setMaxPrice = useCallback((price: number) => {
    setFilters((prev) => ({ ...prev, maxPrice: price }));
  }, []);

  const resetPrice = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      minPrice: DEFAULT_FILTERS.minPrice,
      maxPrice: DEFAULT_FILTERS.maxPrice,
    }));
  }, []);

  // Urgent
  const setIsUrgent = useCallback((urgent: boolean) => {
    setFilters((prev) => ({ ...prev, isUrgent: urgent }));
  }, []);

  // Location - Counties
  const setSelectedCountyCodes = useCallback((codes: string[]) => {
    setFilters((prev) => ({ ...prev, selectedCountyCodes: codes }));
  }, []);

  const toggleCounty = useCallback((code: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedCountyCodes: prev.selectedCountyCodes.includes(code)
        ? prev.selectedCountyCodes.filter((c) => c !== code)
        : [...prev.selectedCountyCodes, code],
    }));
  }, []);

  const toggleExpandCounty = useCallback((code: string) => {
    setFilters((prev) => ({
      ...prev,
      expandedCounties: prev.expandedCounties.includes(code)
        ? prev.expandedCounties.filter((c) => c !== code)
        : [...prev.expandedCounties, code],
    }));
  }, []);

  // Location - Municipalities
  const setSelectedMunicipalityCodes = useCallback((codes: string[]) => {
    setFilters((prev) => ({ ...prev, selectedMunicipalityCodes: codes }));
  }, []);

  const toggleMunicipality = useCallback((code: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedMunicipalityCodes: prev.selectedMunicipalityCodes.includes(code)
        ? prev.selectedMunicipalityCodes.filter((m) => m !== code)
        : [...prev.selectedMunicipalityCodes, code],
    }));
  }, []);

  const toggleExpandMunicipality = useCallback((code: string) => {
    setFilters((prev) => ({
      ...prev,
      expandedMunicipalities: prev.expandedMunicipalities.includes(code)
        ? prev.expandedMunicipalities.filter((m) => m !== code)
        : [...prev.expandedMunicipalities, code],
    }));
  }, []);

  // Location - Areas
  const setSelectedAreaCodes = useCallback((codes: string[]) => {
    setFilters((prev) => ({ ...prev, selectedAreaCodes: codes }));
  }, []);

  const toggleArea = useCallback((code: string) => {
    setFilters((prev) => ({
      ...prev,
      selectedAreaCodes: prev.selectedAreaCodes.includes(code)
        ? prev.selectedAreaCodes.filter((a) => a !== code)
        : [...prev.selectedAreaCodes, code],
    }));
  }, []);

  const resetLocation = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      selectedCountyCodes: [],
      selectedMunicipalityCodes: [],
      selectedAreaCodes: [],
      expandedCounties: [],
      expandedMunicipalities: [],
    }));
  }, []);

  // Current location
  const setUserLocation = useCallback(
    (location: { lat: number; lng: number } | null) => {
      setFilters((prev) => ({ ...prev, userLocation: location }));
    },
    []
  );

  const setIsLocating = useCallback((locating: boolean) => {
    setFilters((prev) => ({ ...prev, isLocating: locating }));
  }, []);

  // Sort
  const setSortValue = useCallback((sort: string) => {
    setFilters((prev) => ({ ...prev, sortValue: sort }));
  }, []);

  // Reset all
  const resetAll = useCallback(() => {
    setFilters({
      ...DEFAULT_FILTERS,
      searchText: '', // Keep search empty on reset
    });
  }, []);

  return {
    // State
    ...filters,

    // Search
    setSearchText,

    // Categories
    setSelectedCategories,
    toggleCategory,

    // Price
    setMinPrice,
    setMaxPrice,
    resetPrice,

    // Urgent
    setIsUrgent,

    // Location
    setSelectedCountyCodes,
    toggleCounty,
    toggleExpandCounty,
    setSelectedMunicipalityCodes,
    toggleMunicipality,
    toggleExpandMunicipality,
    setSelectedAreaCodes,
    toggleArea,
    resetLocation,

    // Current location
    setUserLocation,
    setIsLocating,

    // Sort
    setSortValue,

    // Global
    resetAll,
  };
}
