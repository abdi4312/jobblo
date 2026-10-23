import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ClipboardList, Users } from 'lucide-react-native';
import { TC, tc } from '../../theme/colors';

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
    <View className="mb-5 flex-row rounded-full border border-line bg-surface p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            className={[
              'h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-full px-2',
              active ? 'bg-brand' : 'bg-transparent',
            ].join(' ')}
          >
            <Icon size={15} color={active ? '#FFFFFF' : tc('#63665F', 'muted')} />
            <Text className={active ? 'text-[0.8125rem] font-semibold text-white' : 'text-[0.8125rem] font-semibold text-muted'} numberOfLines={1}>
              {tab.label}
            </Text>
            {typeof tab.count === 'number' && tab.count > 0 ? (
              <View className={['rounded-full px-1.5', active ? 'bg-white/20' : 'bg-surface-2'].join(' ')}>
                <Text className={active ? 'text-[0.6875rem] font-bold text-white' : 'text-[0.6875rem] font-bold text-muted'}>
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
