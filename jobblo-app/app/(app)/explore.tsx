import React from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useInfiniteJobs } from '../../src/hooks/useInfiniteJobs';
import { useCategories } from '../../src/hooks/useCategories';
import { useLocationTree } from '../../src/hooks/useLocationTree';
import { useSearchFilters } from '../../src/hooks/useSearchFilters';
import { JobCard } from '../../src/components/JobCard';
import { Button } from '../../src/components/ui/Button';
import { CategoryChip } from '../../src/components/CategoryChip';
import { SearchHeader } from '../../src/components/search/SearchHeader';
import { SearchResultsHeader } from '../../src/components/search/SearchResultsHeader';
import { ActiveFiltersDisplay } from '../../src/components/search/ActiveFiltersDisplay';
import { SearchFilterSheet } from '../../src/components/search/SearchFilterSheet';

/**
 * Explore/Search screen for browsing jobs with comprehensive filtering.
 */
export default function ExploreScreen() {
  const params = useLocalSearchParams();
  const initialSearch = (params.search as string) || '';

  const filters = useSearchFilters(initialSearch);
  const [sheetVisible, setSheetVisible] = React.useState(false);

  const { data: filterOptions, isLoading: categoriesLoading } = useCategories();
  const { data: locationTree, isLoading: locationsLoading } = useLocationTree();

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteJobs({
    search: filters.searchText,
    categories: filters.selectedCategories,
    sort: filters.sortValue,
    minPrice: filters.minPrice > 0 ? filters.minPrice : undefined,
    maxPrice: filters.maxPrice < 100000 ? filters.maxPrice : undefined,
    urgent: filters.isUrgent,
    countyCodes: filters.selectedCountyCodes,
    municipalityCodes: filters.selectedMunicipalityCodes,
    areaCodes: filters.selectedAreaCodes,
    lat: filters.userLocation?.lat,
    lng: filters.userLocation?.lng,
    radius: filters.userLocation ? 5000 : undefined,
    limit: 16,
  });

  const allJobs = data?.pages.flatMap((page) => page.data) ?? [];
  const totalCount = data?.pages[0]?.pagination?.total ?? 0;
  const filterCategories = filterOptions?.categories ?? [];

  const handleLoadMore = () => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage();
    }
  };

  const renderHeader = () => (
    <View>
      <SearchHeader
        searchText={filters.searchText}
        onSearchChange={filters.setSearchText}
        onFilterPress={() => setSheetVisible(true)}
        activeFilterCount={
          filters.selectedCategories.length +
          (filters.minPrice !== 0 || filters.maxPrice !== 100000 ? 1 : 0) +
          (filters.isUrgent ? 1 : 0) +
          filters.selectedCountyCodes.length +
          filters.selectedMunicipalityCodes.length +
          (filters.userLocation ? 1 : 0)
        }
      />

      <SearchResultsHeader
        totalCount={totalCount}
        isLoading={isLoading}
        sortValue={filters.sortValue}
        onSortChange={filters.setSortValue}
      />

      <ActiveFiltersDisplay
        filters={filters}
        locationTree={locationTree}
        onRemoveCategory={(cat) => {
          filters.setSelectedCategories(
            filters.selectedCategories.filter((c) => c !== cat)
          );
        }}
        onRemovePrice={filters.resetPrice}
        onRemoveUrgent={() => filters.setIsUrgent(false)}
        onRemoveCounty={(code) => {
          filters.setSelectedCountyCodes(
            filters.selectedCountyCodes.filter((c) => c !== code)
          );
          if (locationTree) {
            const county = locationTree.find((c) => c.code === code);
            if (county?.children) {
              const munCodes = county.children.map((m) => m.code);
              filters.setSelectedMunicipalityCodes(
                filters.selectedMunicipalityCodes.filter(
                  (m) => !munCodes.includes(m)
                )
              );
              const areaCodes = county.children.flatMap(
                (m) => m.children?.map((a) => a.code) ?? []
              );
              filters.setSelectedAreaCodes(
                filters.selectedAreaCodes.filter((a) => !areaCodes.includes(a))
              );
            }
          }
        }}
        onRemoveMunicipality={(code) => {
          filters.setSelectedMunicipalityCodes(
            filters.selectedMunicipalityCodes.filter((m) => m !== code)
          );
          if (locationTree) {
            const parentCounty = locationTree.find((c) =>
              c.children?.some((m) => m.code === code)
            );
            const municipality = parentCounty?.children?.find(
              (m) => m.code === code
            );
            if (municipality?.children) {
              const areaCodes = municipality.children.map((a) => a.code);
              filters.setSelectedAreaCodes(
                filters.selectedAreaCodes.filter((a) => !areaCodes.includes(a))
              );
            }
          }
        }}
        onRemoveLocation={() => filters.setUserLocation(null)}
      />

      <View className="mb-2 px-4">
        <Text className="mb-2 text-[0.8125rem] font-medium text-[#63665F]">
          Kategorier
        </Text>
        {categoriesLoading ? (
          <View className="py-3">
            <ActivityIndicator color="#2E6641" size="small" />
          </View>
        ) : (
          <View className="flex-row flex-wrap -mx-1.5">
            <View className="w-1/3 px-1.5 pb-3">
              <CategoryChip
                category={{ name: 'Alle' }}
                isSelected={filters.selectedCategories.length === 0}
                onPress={() => filters.setSelectedCategories([])}
              />
            </View>
            {filterCategories.map((cat) => (
              <View key={cat._id} className="w-1/3 px-1.5 pb-3">
                <CategoryChip
                  category={cat}
                  isSelected={filters.selectedCategories.includes(cat.name)}
                  onPress={() => filters.toggleCategory(cat.name)}
                />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <SearchFilterSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        filters={filters}
        categories={filterCategories}
        locationTree={locationTree}
        categoriesLoading={categoriesLoading}
        locationsLoading={locationsLoading}
        onToggleCategory={filters.toggleCategory}
        onSetMinPrice={filters.setMinPrice}
        onSetMaxPrice={filters.setMaxPrice}
        onResetPrice={filters.resetPrice}
        onSetIsUrgent={filters.setIsUrgent}
        onToggleCounty={(code) => {
          const isSelected = filters.selectedCountyCodes.includes(code);
          if (isSelected) {
            filters.setSelectedCountyCodes(
              filters.selectedCountyCodes.filter((c) => c !== code)
            );
            if (locationTree) {
              const county = locationTree.find((c) => c.code === code);
              if (county?.children) {
                const munCodes = county.children.map((m) => m.code);
                filters.setSelectedMunicipalityCodes(
                  filters.selectedMunicipalityCodes.filter(
                    (m) => !munCodes.includes(m)
                  )
                );
                const areaCodes = county.children.flatMap(
                  (m) => m.children?.map((a) => a.code) ?? []
                );
                filters.setSelectedAreaCodes(
                  filters.selectedAreaCodes.filter(
                    (a) => !areaCodes.includes(a)
                  )
                );
              }
            }
            filters.toggleExpandCounty(code);
          } else {
            filters.setSelectedCountyCodes([
              ...filters.selectedCountyCodes,
              code,
            ]);
            filters.toggleExpandCounty(code);
          }
        }}
        onToggleCountyExpand={filters.toggleExpandCounty}
        onToggleMunicipality={(code) => {
          const isSelected = filters.selectedMunicipalityCodes.includes(code);
          if (isSelected) {
            filters.setSelectedMunicipalityCodes(
              filters.selectedMunicipalityCodes.filter((m) => m !== code)
            );
            if (locationTree) {
              const parentCounty = locationTree.find((c) =>
                c.children?.some((m) => m.code === code)
              );
              const municipality = parentCounty?.children?.find(
                (m) => m.code === code
              );
              if (municipality?.children) {
                const areaCodes = municipality.children.map((a) => a.code);
                filters.setSelectedAreaCodes(
                  filters.selectedAreaCodes.filter(
                    (a) => !areaCodes.includes(a)
                  )
                );
              }
            }
            filters.toggleExpandMunicipality(code);
          } else {
            filters.setSelectedMunicipalityCodes([
              ...filters.selectedMunicipalityCodes,
              code,
            ]);
            const parentCounty = locationTree?.find((c) =>
              c.children?.some((m) => m.code === code)
            );
            const municipality = parentCounty?.children?.find(
              (m) => m.code === code
            );
            if (municipality?.children && municipality.children.length > 0) {
              filters.toggleExpandMunicipality(code);
            }
          }
        }}
        onToggleMunicipalityExpand={filters.toggleExpandMunicipality}
        onToggleArea={(code) => {
          filters.setSelectedAreaCodes(
            filters.selectedAreaCodes.includes(code)
              ? filters.selectedAreaCodes.filter((a) => a !== code)
              : [...filters.selectedAreaCodes, code]
          );
        }}
        onResetLocation={filters.resetLocation}
        onSetUserLocation={filters.setUserLocation}
        onSetIsLocating={filters.setIsLocating}
        onResetAllFilters={filters.resetAll}
        jobsCount={allJobs.length}
        hasNextPage={hasNextPage}
      />

      <FlatList
        data={allJobs}
        keyExtractor={(job) => job._id}
        renderItem={({ item }) => (
          <View className="px-4 pb-8">
            <JobCard job={item} />
          </View>
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator color="#2E6641" size="small" />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading && !isError && allJobs.length === 0 ? (
            <View className="mx-4 rounded-[24px] border border-[#E6E7E1] bg-white p-6">
              <Text className="text-[1rem] font-semibold text-[#0B0B0B]">
                Ingen oppdrag funnet
              </Text>
              <Text className="mt-2 text-[0.875rem] leading-relaxed text-[#63665F]">
                {filters.searchText ||
                filters.selectedCategories.length > 0 ||
                filters.minPrice !== 0 ||
                filters.maxPrice !== 100000 ||
                filters.isUrgent ||
                filters.selectedCountyCodes.length > 0 ||
                filters.selectedMunicipalityCodes.length > 0 ||
                filters.userLocation
                  ? 'Pr�v et annet s�keord eller fjern noen filtrer.'
                  : 'Det finnes ingen tilgjengelige oppdrag akkurat n�.'}
              </Text>
              {(filters.searchText ||
                filters.selectedCategories.length > 0 ||
                filters.minPrice !== 0 ||
                filters.maxPrice !== 100000 ||
                filters.isUrgent ||
                filters.selectedCountyCodes.length > 0 ||
                filters.selectedMunicipalityCodes.length > 0 ||
                filters.userLocation) && (
                <View className="mt-4">
                  <Button
                    label="Nullstill filtre"
                    onPress={filters.resetAll}
                  />
                </View>
              )}
            </View>
          ) : null
        }
      />

      {isError && !isLoading && (
        <View className="absolute inset-x-4 top-24 rounded-[24px] border border-[#E6E7E1] bg-white p-6">
          <Text className="text-[0.9375rem] font-semibold text-[#0B0B0B]">
            Kunne ikke laste oppdrag
          </Text>
          <Text className="mt-1 text-[0.875rem] text-[#63665F]">
            Sjekk tilkoblingen din og pr�v igjen.
          </Text>
          <View className="mt-4">
            <Button label="Pr�v igjen" onPress={() => refetch()} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
