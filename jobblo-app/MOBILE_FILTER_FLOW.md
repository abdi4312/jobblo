# Jobblo Mobile - Filter Implementation & Architecture

## Overview

Complete search/filter system for Jobblo mobile app (Expo React Native + TypeScript). All filters match the responsive web implementation exactly.

## Filter Features

### 1. Search Text
- **Type**: String
- **Default**: Empty
- **Behavior**: Real-time, updates query key immediately
- **API Param**: `search`

### 2. Categories (Multi-Select)
- **Type**: String array
- **Default**: Empty array (all categories)
- **Selection**: Toggle to add/remove categories
- **Display**: Grid of category chips in header + filter sheet
- **API Param**: `categories` (comma-separated in query string)
- **UI**: CategoryChip component with icons

### 3. Price Range (Interactive)
- **Type**: minPrice (number), maxPrice (number)
- **Default**: 0 - 100000 kr
- **Input**: Two TextInput fields (Fra/Til)
- **Display**: 
  - "Fra (minimum)" field: shows 0 at default, empty field, or entered value
  - "Til (maksimum)" field: shows empty (∞) at default, or entered value
  - Summary display: "0–∞ kr" → "5 000–50 000 kr" with Norwegian formatting
- **Formatting**: Norwegian locale (toLocaleString('nb-NO')) with space thousands separator
- **Currency**: "kr" suffix
- **Reset**: Both fields back to defaults (0 - 100000)
- **Active Chip**: Shown only when not at defaults, format: "5 000–∞ kr"
- **API Params**: `minPrice`, `maxPrice`
- **Component**: PriceRangeFilter

### 4. Urgent Flag
- **Type**: Boolean
- **Default**: false
- **Behavior**: Checkbox to filter for haste jobs only
- **Display**: Toggle in filter sheet
- **API Param**: `urgent`
- **Component**: UrgentFilter

### 5. Location Filter (Hierarchical)
- **Structure**: County → Municipality → Area (3 levels)
- **Type**: Three string arrays (selectedCountyCodes, selectedMunicipalityCodes, selectedAreaCodes)
- **Default**: All empty
- **Smart Logic**: 
  - If specific municipalities selected under a county, don't pass the broad county code
  - If specific areas selected under a municipality, don't pass the broad municipality code
  - Prevents API overshooting
- **UI**:
  - Each level has expand/collapse chevron
  - Checkboxes for selection
  - Hierarchical indentation
  - Smart expand on selection
- **Expand/Collapse State**: 
  - expandedCounties: array of county codes that are expanded
  - expandedMunicipalities: array of municipality codes that are expanded
- **Removal Logic**: 
  - Remove county → also remove its municipalities and areas
  - Remove municipality → also remove its areas
  - Remove area → only remove that area
- **API Params**: `countyCodes`, `municipalityCodes`, `areaCodes` (all comma-separated)
- **Data Source**: TanStack Query via useLocationTree hook
- **Component**: LocationFilter

### 6. Current Location (Radius Search)
- **Type**: { lat: number, lng: number } | null
- **Default**: null (no location-based search)
- **Permission**: requestForegroundPermissionsAsync() from expo-location
- **Accuracy**: Location.Accuracy.Balanced
- **Radius**: 5 km (5000 meters)
- **Display**: Button that shows state (off → locating → active)
- **Button States**:
  - "Bruk min posisjon" (gray, not active)
  - "Henter din posisjon…" (disabled while locating)
  - "Bruk min posisjon (aktivt)" (green, active)
- **API Params**: `lat`, `lng`, `radius` (only sent when location is active)
- **Component**: SearchFilterSheet (button integrated), Expo Location API

### 7. Sort Order
- **Type**: String
- **Default**: 'newest'
- **Options**:
  - `newest`: "Nyeste først"
  - `price_low`: "Pris – lavest først"
  - `price_high`: "Pris – høyest først"
  - `relevant`: "Mest relevant"
- **Display**: Dropdown menu in results header
- **API Param**: `sort`
- **Component**: SearchResultsHeader

### 8. Active Filter Chips
- **Display**: Row of removable chips showing all applied filters
- **Format Examples**:
  - Category: "Maling"
  - Price: "5 000–∞ kr"
  - Urgent: "Kun haster"
  - County: "Oslo"
  - Municipality: "Groruddalen"
  - Location: "Min posisjon (5 km)"
- **Removal**: Individual chip removal resets only that filter category
- **Component**: ActiveFiltersDisplay

## API Integration

### Query Parameter Format
```
GET /api/services?
  search=maling
  &categories=Maling,Snekring
  &minPrice=5000
  &maxPrice=50000
  &urgent=true
  &countyCodes=NO.county.01
  &municipalityCodes=NO.county.01.municipality.0101
  &areaCodes=NO.county.01.municipality.0101.area.0101A
  &sort=newest
  &lat=59.9139
  &lng=10.7522
  &radius=5000
  &page=1
  &limit=16
```

### Backend Contract
**Endpoint**: `GET /api/services`

**Supported Parameters** (from serviceController.js):
- `search`: String search term
- `categories`: Comma-separated category names
- `minPrice`: Minimum price (integer, kr)
- `maxPrice`: Maximum price (integer, kr)
- `urgent`: Boolean for haste jobs
- `countyCodes`: Comma-separated county codes
- `municipalityCodes`: Comma-separated municipality codes  
- `areaCodes`: Comma-separated area codes
- `lat`, `lng`, `radius`: Geolocation with radius in meters
- `sort`: Sort value (newest, price_low, price_high, relevant)
- `page`: Page number (starting from 1)
- `limit`: Results per page

**Response**:
```typescript
{
  data: Job[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

## State Management Architecture

### useSearchFilters Hook
**Location**: `src/hooks/useSearchFilters.ts`

**Purpose**: Centralized filter state management for entire Explore screen.

**State Shape**:
```typescript
interface SearchFiltersState {
  searchText: string;
  selectedCategories: string[];
  minPrice: number;
  maxPrice: number;
  isUrgent: boolean;
  selectedCountyCodes: string[];
  selectedMunicipalityCodes: string[];
  selectedAreaCodes: string[];
  expandedCounties: string[];
  expandedMunicipalities: string[];
  userLocation: { lat: number; lng: number } | null;
  isLocating: boolean;
  sortValue: string;
}
```

**Provided Functions**:
- `setSearchText(text)`
- `setSelectedCategories(cats)`
- `toggleCategory(cat)`
- `setMinPrice(price)`
- `setMaxPrice(price)`
- `resetPrice()`
- `setIsUrgent(urgent)`
- `setSelectedCountyCodes(codes)`
- `toggleCounty(code)`
- `toggleExpandCounty(code)`
- `setSelectedMunicipalityCodes(codes)`
- `toggleMunicipality(code)`
- `toggleExpandMunicipality(code)`
- `setSelectedAreaCodes(codes)`
- `toggleArea(code)`
- `resetLocation()`
- `setUserLocation(location)`
- `setIsLocating(locating)`
- `setSortValue(sort)`
- `resetAll()`

### useInfiniteJobs Hook
**Location**: `src/hooks/useInfiniteJobs.ts`

**Purpose**: TanStack Query infinite pagination with all filter params.

**Key Behavior**:
- Query key includes ALL filter parameters
- Any filter change → new query key → cache miss → refetch from page 1
- Automatic pagination with `getNextPageParam` logic
- Returns pages array (not flattened by hook)

**Query Key Format**:
```typescript
['jobs', 'infinite', {
  limit,
  categories,
  countyCodes,
  municipalityCodes,
  areaCodes,
  search,
  sort,
  urgent,
  minPrice,
  maxPrice,
  lat,
  lng,
  radius
}]
```

### useLocationTree Hook
**Location**: `src/hooks/useLocationTree.ts`

**Purpose**: Fetch and cache location tree (counties → municipalities → areas).

**API Endpoint**: `GET /api/location-filter/tree`

**Cache**: 1 hour stale time

**Returns**: LocationNode[] representing the hierarchy

## Component Hierarchy

```
app/(app)/explore.tsx (343 lines)
├── State: useSearchFilters, useInfiniteJobs, useCategories, useLocationTree
│
├── SearchHeader
│   ├── SearchInput
│   └── Filter button with active count badge
│
├── SearchResultsHeader
│   ├── Total results count
│   └── Sort dropdown menu
│
├── ActiveFiltersDisplay
│   └── ActiveFilterChip[] (removable chips)
│
├── Category chips (quick selection in header)
│   └── CategoryChip[]
│
├── SearchFilterSheet (bottom sheet)
│   ├── PriceRangeFilter
│   │   ├── TextInput (Fra)
│   │   ├── TextInput (Til)
│   │   └── Summary display
│   ├── UrgentFilter
│   │   └── Checkbox
│   ├── LocationFilter
│   │   ├── County expandable list
│   │   ├── Municipality expandable list
│   │   └── Area list
│   ├── Current location button
│   └── Reset all filters button
│
└── FlatList (infinite jobs)
    ├── ListHeaderComponent: render all above
    ├── renderItem: JobCard
    ├── ListEmptyComponent: "No jobs found"
    ├── ListFooterComponent: Loading spinner
    └── onEndReached: fetchNextPage
```

## Search Components

**Location**: `src/components/search/`

### SearchHeader.tsx (40 lines)
- Search input + filter button
- Active filter count badge

### SearchResultsHeader.tsx (50 lines)
- Results count display
- Sort dropdown menu

### ActiveFiltersDisplay.tsx (130 lines)
- Renders all applied filter chips
- Handles individual chip removal
- Smart label formatting (price, location)

### SearchFilterSheet.tsx (200 lines)
- All filter controls
- Categories grid
- Price inputs
- Urgent checkbox
- Location tree
- Current location button
- Reset button
- Footer with submit button

## Filter Components

**Location**: `src/components/domain/`

### PriceRangeFilter.tsx (80 lines)
- Two TextInput fields (Fra/Til)
- Norwegian currency formatting
- Summary display
- Reset button

### UrgentFilter.tsx (30 lines)
- Checkbox for urgent/haste jobs

### LocationFilter.tsx (150 lines)
- Hierarchical tree view
- Expand/collapse per county and municipality
- Checkboxes with indentation
- Smart selection logic

### ActiveFilterChip.tsx (30 lines)
- Removable chip with X icon
- Shows filter label

## UI Primitives

**Location**: `src/components/ui/`

### SearchInput (existing)
- Text input with placeholder
- Right action support
- Clean styling

### Button (existing)
- Primary/secondary variants
- Disabled state support

### Sheet (existing)
- Modal bottom sheet
- Title + footer support
- Scrollable content

### RangeSlider.tsx (70 lines - created but not used in MVP)
- Visual range slider
- Touch-based dragging
- Track visualization

## Query Key Strategy

**Why All Filters in Key**:
- TanStack Query uses query key for cache identity
- Different filter = different key = different cache entry
- Filter change automatically triggers fresh fetch from page 1
- Prevents stale data from mixing with new filter results
- Manual pagination reset not needed

**Example Scenarios**:
1. User changes price: key changes → cache miss → page 1 refetch ✓
2. User adds category: key changes → cache miss → page 1 refetch ✓
3. User navigates to page 2, then changes price: key changes → starts over at page 1 ✓

## Smart Location Filtering Logic

**Problem**: Passing broad county codes + specific municipalities under it causes API to return too many results.

**Solution**: Client-side filtering before query:
```typescript
// Don't send county code if any of its municipalities are selected
if (selectedMunicipalityCodes includes municipality under this county) {
  exclude this county from query
}
```

**Implementation**:
- OnRemoveCounty callback: removes related municipalities + areas
- OnToggleMunicipality callback: removes related areas
- Smart expand: open municipality if selecting it under expanded county

## Price Display & Formatting

**Norwegian Locale Rules**:
- Thousands separator: space (not comma)
- 5000 → "5 000"
- 100000 → "100 000"
- ∞ symbol used for unlimited max

**Active Chip Examples**:
- `5000–50000` → `"5 000–50 000 kr"`
- `0–100000` → not shown (defaults, hidden)
- `0–50000` → `"0–50 000 kr"`
- `10000–100000` → `"10 000–∞ kr"`

## Regression Checks

All filters maintained from previous implementation:
- ✅ Search text
- ✅ Categories (now multi-select)
- ✅ Price (now interactive)
- ✅ Urgent checkbox
- ✅ County/municipality/area tree
- ✅ Current location (expo-location)
- ✅ Sort menu
- ✅ Active filter chips
- ✅ Individual filter removal
- ✅ Reset all filters
- ✅ Infinite pagination
- ✅ Error handling

## File Changes Summary

### New Files Created
- `src/hooks/useSearchFilters.ts` - Centralized filter state management
- `src/hooks/useLocationTree.ts` - Location tree TanStack Query hook
- `src/types/Location.ts` - LocationNode interface
- `src/components/ui/RangeSlider.tsx` - Range slider primitive (optional, not used in MVP)
- `src/components/search/SearchHeader.tsx` - Reusable search header
- `src/components/search/SearchResultsHeader.tsx` - Reusable results + sort
- `src/components/search/ActiveFiltersDisplay.tsx` - Active filter chips
- `src/components/search/SearchFilterSheet.tsx` - Complete filter sheet

### Updated Files
- `src/components/domain/PriceRangeFilter.tsx` - Rewrote as interactive with inputs
- `src/components/CategoryChip.tsx` - Updated type to accept { name: string }
- `app/(app)/explore.tsx` - Refactored from 557 to 343 lines using new components
- `src/hooks/useInfiniteJobs.ts` - Removed unused `locations` param
- `src/queryKeys.ts` - Complete filter set in infinite query key (no changes needed)

### Unchanged Files
- `src/services/jobs.service.ts` - Already supports all params
- `app/(app)/index.tsx` - Home screen (no changes)
- `app/(app)/jobs/[id].tsx` - Job Details (no changes)

## Performance Considerations

1. **Query Key Memoization**: useCallback ensures callbacks don't trigger unnecessary re-renders
2. **Component Memoization**: SearchHeader, SearchResultsHeader use React.memo where appropriate
3. **TanStack Query Cache**: Automatic cache management with 5-minute stale time
4. **Lazy Location Loading**: Location tree fetched on-demand via useLocationTree
5. **Infinite Pagination**: One API call per page, no re-fetching

## Known Limitations / Future Enhancements

1. **RangeSlider**: Created but not used in current MVP (TextInput version is simpler and more reliable)
2. **Slider Gestures**: Could add drag-based slider if needed for better UX
3. **Price Presets**: Could add quick buttons for common price ranges (e.g., "0-10k", "10-50k")
4. **Location Search**: Could add text search for location names (large tree might benefit)
5. **Filter Presets**: Could save/restore common filter combinations

## Testing Recommendations

1. **Filter Combinations**: Test all filter combinations don't break pagination
2. **Location Logic**: Verify county/municipality/area smart filtering (no double-counting)
3. **Price Formatting**: Test edge cases (0, 100000, large numbers)
4. **Chip Removal**: Each chip removal only affects its category
5. **Reset All**: Verify all filters clear and results reset to unfiltered
6. **Location Permission**: Test denied, granted, and already-granted states
7. **Infinite Scroll**: Test pagination with various filter combinations

## Code Quality

- ✅ TypeScript: Zero compilation errors
- ✅ Architecture: Clear separation of concerns (hooks, components, services)
- ✅ Reusability: All components in `src/components/search/` are reusable
- ✅ Naming: Consistent Norwegian labels + English code
- ✅ Comments: Key functions documented with JSDoc
- ✅ No Code Duplication: Smart location logic in one place (useSearchFilters + activeFiltersDisplay)
- ✅ Accessibility: Button labels, readable text sizes, clear visual hierarchy

## Scope Boundary

**This document covers Search Filters only.**

Apply flow (basket, payment, disputes, ratings) is NOT included.

See APPLY_FLOW.md (to be created) for Apply screen implementation.
