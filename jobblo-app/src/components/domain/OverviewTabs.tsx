import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ClipboardList, Users } from 'lucide-react-native';

export type OverviewTabKey = 'mine-sokere' | 'mine-soknader';

export function OverviewTabs({
  activeTab,
  onChange,
  applicantCount,
  applicationCount,
}: {
  activeTab: OverviewTabKey;
  onChange: (tab: OverviewTabKey) => void;
  applicantCount?: number;
  applicationCount?: number;
}) {
  const tabs = [
    { key: 'mine-sokere' as const, label: 'Mine søkere', icon: Users, count: applicantCount },
    { key: 'mine-soknader' as const, label: 'Mine søknader', icon: ClipboardList, count: applicationCount },
  ];

  return (
    <View className="mb-5 flex-row rounded-full border border-[#E6E7E1] bg-white p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className={[
              'h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2',
              active ? 'bg-[#2E6641]' : 'bg-transparent',
            ].join(' ')}
          >
            <Icon size={15} color={active ? '#FFFFFF' : '#63665F'} />
            <Text className={active ? 'text-[0.75rem] font-semibold text-white' : 'text-[0.75rem] font-semibold text-[#63665F]'} numberOfLines={1}>
              {tab.label}
            </Text>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <View className={['rounded-full px-1.5', active ? 'bg-white/20' : 'bg-[#F4F6F0]'].join(' ')}>
                <Text className={active ? 'text-[0.625rem] font-bold text-white' : 'text-[0.625rem] font-bold text-[#63665F]'}>
                  {tab.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}