import React, { useState, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search, X, ChevronRight } from 'lucide-react-native';
import { useInfiniteJobs } from '../../src/hooks/useInfiniteJobs';
import { useCategories } from '../../src/hooks/useCategories';
import { JobCard } from '../../src/components/JobCard';
import { CategoryChip } from '../../src/components/CategoryChip';

// Sort options matching backend vocabulary from utils/serviceSort.js
// Canonical values: 'newest', 'price_low', 'price_high', 'relevant'
// 'relevant' is deliberately identical to 'newest' for now (no relevance signal)
const SORT_OPTIONS = [
  { value: 'newest', label: 'Nyeste først' },
  { value: 'price_low', label: 'Laveste pris' },
  { value: 'price_high', label: 'Høyeste pris' },
  { value: 'relevant', label: 'Mest relevant' },
] as const;

// Simple debounce helper
function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Initialize search from route params if provided
  const initialSearch = (params.search as string) || '';
  const initialCategory = (params.category as string) || '';

  // UI state only — no server data state
  const [searchText, setSearchText] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [sortValue, setSortValue] = useState('newest');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Fetch categories from backend with icons
  const { data: filterOptions, isLoading: categoriesLoading } = useCategories();

  // Debounced search ref
  const debouncedSearch = useRef(
    debounce(() => {
      // Empty body — the query key change triggers refetch automatically
    }, 500)
  ).current;

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    debouncedSearch();
  };

  const handleClearSearch = () => {
    setSearchText('');
  };

  const handleCategoryToggle = (category: string) => {
    setSelectedCategory(selectedCategory === category ? '' : category);
  };

  // Fetch jobs using infinite query with current filters
  // Note: backend expects 'category' param as comma-separated string (see serviceController.js line 144)
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteJobs({
    search: searchText,
    categories: selectedCategory ? [selectedCategory] : [],
    sort: sortValue,
    limit: 16,
  });

  // Flatten all pages into a single array for rendering
  const allJobs = data?.pages.flatMap((page) => page.data) ?? [];
  const totalCount = data?.pages[0]?.pagination?.total ?? 0;

  const handleLoadMore = () => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <FlatList
        data={allJobs}
        keyExtractor={(job) => job._id}
        renderItem={({ item }) => (
          <View className="px-4 pb-8">
            <JobCard job={item} />
          </View>
        )}
        ListHeaderComponent={
          <View className="px-4 pt-4 pb-4 gap-4">
            {/* ── Search Input ──────────────────────────────────────────── */}
            <View className="rounded-xl bg-white border border-[#E6E7E1] flex-row items-center px-3 py-2 gap-2">
              <Search size={18} color="#63665F" />
              <TextInput
                className="flex-1 text-[15px] text-[#0B0B0B] placeholder-[#9B9E96]"
                placeholder="Søk etter oppdrag..."
                placeholderTextColor="#9B9E96"
                value={searchText}
                onChangeText={handleSearchChange}
              />
              {searchText ? (
                <TouchableOpacity onPress={handleClearSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={18} color="#63665F" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* ── Results Count and Sort ────────────────────────────────– */}
            <View className="flex-row items-center justify-between">
              <Text className="text-[0.875rem] text-[#63665F]">
                {totalCount} {totalCount === 1 ? 'resultat' : 'resultater'}
              </Text>

              {/* Sort Dropdown */}
              <View className="relative">
                <TouchableOpacity
                  onPress={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex-row items-center gap-1 px-3 py-2 bg-white border border-[#E6E7E1] rounded-lg"
                >
                  <Text className="text-[0.75rem] font-medium text-[#0B0B0B]">
                    {SORT_OPTIONS.find((s) => s.value === sortValue)?.label || 'Sorter'}
                  </Text>
                  <ChevronRight size={14} color="#63665F" />
                </TouchableOpacity>

                {showSortDropdown && (
                  <View className="absolute top-full right-0 mt-1 bg-white border border-[#E6E7E1] rounded-lg z-50 shadow-sm min-w-40">
                    {SORT_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                          setSortValue(option.value);
                          setShowSortDropdown(false);
                        }}
                        className="px-3 py-2.5 border-b border-[#E6E7E1] flex-row items-center justify-between"
                      >
                        <Text className="text-[0.875rem] text-[#0B0B0B]">{option.label}</Text>
                        {sortValue === option.value && (
                          <Text className="text-[0.875rem] font-semibold text-[#2E6641]">✓</Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>

            {/* ── Category Filter Chips ───────────────────────────────– */}
            {categoriesLoading ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#2E6641" size="small" />
              </View>
            ) : (
              <View className="gap-2">
                <Text className="text-[0.8125rem] font-medium text-[#63665F]">Kategorier</Text>
                <View className="flex-row flex-wrap gap-2">
                  {/* All button */}
                  <CategoryChip
                    category={{ name: 'Alle' }}
                    isSelected={selectedCategory === ''}
                    onPress={() => handleCategoryToggle('')}
                    showIcon={true}
                  />

                  {/* Category chips from backend */}
                  {filterOptions?.categories?.map((cat) => (
                    <CategoryChip
                      key={cat._id}
                      category={cat}
                      isSelected={selectedCategory === cat.name}
                      onPress={() => handleCategoryToggle(cat.name)}
                      showIcon={true}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* ── Loading State ────────────────────────────────────────– */}
            {isLoading && (
              <View className="py-12 items-center justify-center">
                <ActivityIndicator color="#2E6641" size="large" />
                <Text className="mt-4 text-[0.875rem] text-[#63665F]">Søker etter oppdrag...</Text>
              </View>
            )}

            {/* ── Error State ──────────────────────────────────────────– */}
            {isError && !isLoading && (
              <View className="bg-white rounded-2xl p-4 border border-[#E6E7E1] mb-4">
                <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                  Kunne ikke laste oppdrag
                </Text>
                <Text className="mt-1.5 text-[0.875rem] text-[#63665F]">
                  Sjekk internettforbindelsen din og prøv igjen.
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    refetch();
                  }}
                  className="mt-4 py-2 px-4 bg-[#2E6641] rounded-lg"
                >
                  <Text className="text-white text-[0.875rem] font-semibold">Prøv igjen</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Empty State ──────────────────────────────────────────– */}
            {!isLoading && !isError && allJobs.length === 0 && (
              <View className="bg-white rounded-2xl p-6 border border-[#E6E7E1] mb-4 items-center">
                <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
                  Ingen oppdrag funnet
                </Text>
                <Text className="mt-1.5 text-[0.875rem] text-[#63665F] text-center">
                  {searchText || selectedCategory
                    ? 'Prøv å endre søket eller filteret ditt'
                    : 'Det finnes ingen tilgjengelige oppdrag akkurat nå'}
                </Text>
                {(searchText || selectedCategory) && (
                  <TouchableOpacity
                    onPress={() => {
                      handleClearSearch();
                      setSelectedCategory('');
                    }}
                    className="mt-4 py-2 px-4 bg-[#2E6641] rounded-lg"
                  >
                    <Text className="text-white text-[0.875rem] font-semibold">Fjern filtre</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        }
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-8 items-center justify-center">
              <ActivityIndicator color="#2E6641" size="small" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
