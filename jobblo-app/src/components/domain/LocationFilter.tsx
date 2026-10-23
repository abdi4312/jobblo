import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Check, ChevronDown, ChevronRight } from 'lucide-react-native';
import type { LocationNode } from '../../services/location.service';
import { TC, tc } from '../../theme/colors';

interface LocationFilterProps {
  locationTree: LocationNode[];
  selectedCountyCodes: string[];
  selectedMunicipalityCodes: string[];
  selectedAreaCodes: string[];
  expandedCounties: string[];
  expandedMunicipalities: string[];
  onToggleCounty: (code: string) => void;
  onToggleMunicipality: (code: string) => void;
  onToggleArea: (code: string) => void;
  onToggleCountyExpand: (code: string) => void;
  onToggleMunicipalityExpand: (code: string) => void;
  onReset: () => void;
}

const Checkbox = ({ checked }: { checked: boolean }) => (
  <View
    className={`flex size-5 items-center justify-center rounded-[0.3rem] border ${
      checked
        ? 'border-brand-text bg-brand'
        : 'border-[#D4D6CD] bg-surface'
    }`}
  >
    {checked && <Check size={12} color="white" strokeWidth={3} />}
  </View>
);

/**
 * Location tree filter for county/municipality/area selection.
 * Displays a nested hierarchy with expand/collapse behavior.
 * Smart filtering: if a specific municipality is selected under a county,
 * the broad county filter is not applied to avoid overly broad results.
 */
export function LocationFilter({
  locationTree,
  selectedCountyCodes,
  selectedMunicipalityCodes,
  selectedAreaCodes,
  expandedCounties,
  expandedMunicipalities,
  onToggleCounty,
  onToggleMunicipality,
  onToggleArea,
  onToggleCountyExpand,
  onToggleMunicipalityExpand,
  onReset,
}: LocationFilterProps) {
  const hasLocationFilter =
    selectedCountyCodes.length > 0 ||
    selectedMunicipalityCodes.length > 0 ||
    selectedAreaCodes.length > 0;

  return (
    <View className="border-b border-line py-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-[0.9375rem] font-semibold text-ink">
          Område
        </Text>
        {hasLocationFilter && (
          <Text
            onPress={onReset}
            className="text-[0.8125rem] font-medium text-brand-text underline"
          >
            Nullstill
          </Text>
        )}
      </View>

      <ScrollView className="max-h-96">
        {locationTree.map((county) => (
          <View key={county.code}>
            {/* County Row */}
            <Pressable
              onPress={() => onToggleCounty(county.code)}
              className={`flex-row items-center gap-2.5 rounded-lg px-2.5 py-2 ${selectedCountyCodes.includes(county.code) ? 'bg-tint' : ''}`}
            >
              <Checkbox checked={selectedCountyCodes.includes(county.code)} />
              <Text className="flex-1 text-[0.875rem] font-medium text-ink">
                {county.name}
              </Text>
              {typeof county.count === 'number' ? <Text className="text-[0.8125rem] text-subtle">{county.count}</Text> : null}
              {county.children && county.children.length > 0 && (
                <Pressable onPress={() => onToggleCountyExpand(county.code)}>
                  {expandedCounties.includes(county.code) ? (
                    <ChevronDown size={16} color={tc('#63665F', 'muted')} strokeWidth={2} />
                  ) : (
                    <ChevronRight size={16} color={tc('#63665F', 'muted')} strokeWidth={2} />
                  )}
                </Pressable>
              )}
            </Pressable>

            {/* Municipalities */}
            {expandedCounties.includes(county.code) &&
              county.children &&
              county.children.map((municipality) => (
                <View key={municipality.code}>
                  <Pressable
                    onPress={() => onToggleMunicipality(municipality.code)}
                    className={`ml-8 flex-row items-center gap-2.5 rounded-lg px-2.5 py-1.5 ${selectedMunicipalityCodes.includes(municipality.code) ? 'bg-tint' : ''}`}
                  >
                    <Checkbox
                      checked={selectedMunicipalityCodes.includes(
                        municipality.code
                      )}
                    />
                    <Text className="flex-1 text-[0.8125rem] text-muted">
                      {municipality.name}
                    </Text>
                    {typeof municipality.count === 'number' ? <Text className="text-[0.8125rem] text-subtle">{municipality.count}</Text> : null}
                    {municipality.children &&
                      municipality.children.length > 0 && (
                        <Pressable
                          onPress={() =>
                            onToggleMunicipalityExpand(municipality.code)
                          }
                        >
                          {expandedMunicipalities.includes(
                            municipality.code
                          ) ? (
                            <ChevronDown
                              size={14}
                              color={tc('#9B9E96', 'subtle')}
                              strokeWidth={2}
                            />
                          ) : (
                            <ChevronRight
                              size={14}
                              color={tc('#9B9E96', 'subtle')}
                              strokeWidth={2}
                            />
                          )}
                        </Pressable>
                      )}
                  </Pressable>

                  {/* Areas */}
                  {expandedMunicipalities.includes(municipality.code) &&
                    municipality.children &&
                    municipality.children.map((area) => (
                      <Pressable
                        key={area.code}
                        onPress={() => onToggleArea(area.code)}
                        className={`ml-16 flex-row items-center gap-2.5 rounded-lg px-2.5 py-1 ${selectedAreaCodes.includes(area.code) ? 'bg-tint' : ''}`}
                      >
                        <Checkbox
                          checked={selectedAreaCodes.includes(area.code)}
                        />
                        <Text className="flex-1 text-[0.8125rem] text-subtle">
                          {area.name}
                        </Text>
                        {typeof area.count === 'number' ? <Text className="text-[0.8125rem] text-subtle">{area.count}</Text> : null}
                      </Pressable>
                    ))}
                </View>
              ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
