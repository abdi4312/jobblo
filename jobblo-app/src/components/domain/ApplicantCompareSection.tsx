import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { ApplicantApplication } from '../../types/Applicants';

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function ApplicantCompareSection({ applicants, onClear }: { applicants: ApplicantApplication[]; onClear: () => void }) {
  if (applicants.length === 0) return null;

  return (
    <View className="mb-5 rounded-2xl border border-[#E6E7E1] bg-white p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-[0.9375rem] font-bold text-[#0B0B0B]">Sammenlign søkere</Text>
        <Pressable onPress={onClear} className="flex-row items-center gap-1"><X size={14} color="#63665F" /><Text className="text-[0.75rem] text-[#63665F]">Fjern alle</Text></Pressable>
      </View>
      <View className="gap-3">
        {applicants.map(({ applicant }) => (
          <View key={applicant._id} className="rounded-xl border border-[#E6E7E1] p-3">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9]">
                {applicant.avatarUrl ? <Image source={{ uri: applicant.avatarUrl }} className="h-full w-full" /> : <Text className="font-medium text-[#122A1C]">{initials(applicant.name)}</Text>}
              </View>
              <View className="min-w-0 flex-1"><Text className="text-[0.875rem] font-medium text-[#0B0B0B]" numberOfLines={1}>{applicant.name}</Text><Text className="text-[0.75rem] text-[#63665F]" numberOfLines={1}>{applicant.skills.join(', ') || 'Generell hjelp'}</Text></View>
            </View>
            <View className="mt-3 flex-row flex-wrap gap-2">
              <View className="min-w-[30%] flex-1 rounded-lg bg-[#F4F6F0] p-2"><Text className="text-center text-[0.9375rem] font-bold text-[#0B0B0B]">{applicant.completedJobs}</Text><Text className="text-center text-[0.625rem] uppercase text-[#63665F]">Fullførte</Text></View>
              <View className="min-w-[30%] flex-1 rounded-lg bg-[#F4F6F0] p-2"><Text className="text-center text-[0.9375rem] font-bold text-[#0B0B0B]">{applicant.rating}★</Text><Text className="text-center text-[0.625rem] uppercase text-[#63665F]">Rating</Text></View>
              <View className="min-w-[30%] flex-1 rounded-lg bg-[#F4F6F0] p-2"><Text className="text-center text-[0.9375rem] font-bold text-[#0B0B0B]">{applicant.responseRate ?? '—'}</Text><Text className="text-center text-[0.625rem] uppercase text-[#63665F]">Svar%</Text></View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}