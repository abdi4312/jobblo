import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { ApplicantApplication } from '../../types/Applicants';
import { TC, tc } from '../../theme/colors';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function ApplicantCompareSection({ applicants, onClear }: { applicants: ApplicantApplication[]; onClear: () => void }) {
  if (applicants.length === 0) return null;

  return (
    <View className="mb-5 rounded-2xl border border-line bg-surface p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-[0.9375rem] font-bold text-ink">Sammenlign søkere</Text>
        <Pressable onPress={onClear} className="flex-row items-center gap-1"><X size={14} color={tc('#63665F', 'muted')} /><Text className="text-[0.8125rem] text-muted">Fjern alle</Text></Pressable>
      </View>
      <View className="gap-3">
        {applicants.map(({ applicant }) => (
          <View key={applicant._id} className="rounded-xl border border-line p-3">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-tint">
                {applicant.avatarUrl ? <Image source={{ uri: applicant.avatarUrl }} className="h-full w-full" /> : <Text className="font-medium text-[#122A1C] dark:text-brand-text">{initials(applicant.name)}</Text>}
              </View>
              <View className="min-w-0 flex-1"><Text className="text-[0.875rem] font-medium text-ink" numberOfLines={1}>{applicant.name}</Text><Text className="text-[0.8125rem] text-muted" numberOfLines={1}>{applicant.skills.join(', ') || 'Generell hjelp'}</Text></View>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <View className="min-w-[30%] flex-1 rounded-lg bg-surface-2 p-2"><Text className="text-center text-[0.9375rem] font-bold text-ink">{applicant.completedJobs}</Text><Text className="text-center text-[0.6875rem] uppercase text-muted">Fullførte</Text></View>
              <View className="min-w-[30%] flex-1 rounded-lg bg-surface-2 p-2"><Text className="text-center text-[0.9375rem] font-bold text-ink">{applicant.rating ? Number(applicant.rating).toFixed(1) : '—'}★</Text><Text className="text-center text-[0.6875rem] uppercase text-muted">Vurdering</Text></View>
              <View className="min-w-[30%] flex-1 rounded-lg bg-surface-2 p-2"><Text className="text-center text-[0.9375rem] font-bold text-ink">{applicant.responseRate ?? '—'}</Text><Text className="text-center text-[0.6875rem] uppercase text-muted">Svarrate</Text></View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
