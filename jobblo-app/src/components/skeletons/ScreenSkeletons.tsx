import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from '../ui/Skeleton';

/**
 * Loading skeletons that mirror each screen's loaded layout: same header, cards, rows,
 * paddings and radii (measured from the screens), so loading → loaded does not jump.
 * Building blocks first (mirroring the shared ui components), then one export per screen.
 */

// ── Building blocks ────────────────────────────────────────────────────────────

/** Skeleton that takes the remaining width in a row. */
function Grow({ className }: { className: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Skeleton className={`w-full ${className}`} />
    </View>
  );
}

/** ScreenHeader: back pill, icon tile, 24px title, 14px subtitle lines. */
export function SkScreenHeader({ back = true, icon = true, subLines = 1 }: { back?: boolean; icon?: boolean; subLines?: number }) {
  return (
    <View className="mb-5">
      {back ? <Skeleton className="mb-4 h-[30px] w-[108px] rounded-full" /> : null}
      <View className="flex-row items-center gap-3">
        {icon ? <Skeleton className="h-11 w-11 rounded-2xl" /> : null}
        <View style={{ flex: 1 }} className="gap-2">
          <Skeleton className="h-6 w-1/2" />
          {Array.from({ length: subLines }).map((_, i) => (
            <Skeleton key={i} className={`h-3.5 ${i === subLines - 1 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** 56px top bar: Avbryt / title / Lagre. */
function SkTopBar() {
  return (
    <View className="h-14 flex-row items-center justify-between border-b border-line bg-page px-4">
      <Skeleton className="h-4 w-14" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-12" />
    </View>
  );
}

function SkSectionLabel({ w = 'w-24' }: { w?: string }) {
  return <Skeleton className={`mb-2 ml-1 h-3 ${w}`} />;
}

function SkCard({ className = 'rounded-3xl', children }: { className?: string; children: React.ReactNode }) {
  return <View className={`overflow-hidden border border-line bg-surface ${className}`}>{children}</View>;
}

/** ListRow: 36px tile, label + description, chevron. */
function SkListRow({ divider }: { divider?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-line' : ''}`}>
      <Skeleton className="h-9 w-9 rounded-xl" />
      <View style={{ flex: 1 }} className="gap-2">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </View>
      <Skeleton className="h-4 w-2.5" />
    </View>
  );
}

/** FormRow: small label above the value line. */
function SkFormRow({ divider, tall }: { divider?: boolean; tall?: boolean }) {
  return (
    <View className={`px-4 py-3 ${divider ? 'border-t border-line-soft' : ''}`}>
      <Skeleton className="h-3 w-20" />
      <Skeleton className={`mt-2.5 w-3/5 ${tall ? 'h-16' : 'h-4'}`} />
    </View>
  );
}

function SkLines({ widths, h = 'h-3.5', gap = 'gap-2', className = '' }: { widths: string[]; h?: string; gap?: string; className?: string }) {
  return (
    <View className={`${gap} ${className}`}>
      {widths.map((w, i) => (
        <Skeleton key={i} className={`${h} ${w}`} />
      ))}
    </View>
  );
}

function SkChips({ widths, className = '' }: { widths: string[]; className?: string }) {
  return (
    <View className={`flex-row gap-2 ${className}`}>
      {widths.map((w, i) => (
        <Skeleton key={i} className={`h-9 rounded-full ${w}`} />
      ))}
    </View>
  );
}

/** SafePayProgressSteps: four circles with a label under each. */
function SkProgressSteps() {
  return (
    <View className="mb-6 flex-row">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flex: 1 }} className="items-center gap-2">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-3 w-14" />
        </View>
      ))}
    </View>
  );
}

/** 2-column job cards (JobCard compact). */
export function SkJobGrid({ count = 4 }: { count?: number }) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-5">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: '48%' }} className="gap-2">
          <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: 4 / 5 }} />
          <Skeleton className="mt-0.5 h-4 w-4/5" />
          <Skeleton className="h-3 w-1/2" />
        </View>
      ))}
    </View>
  );
}

const pad = 'p-4';

// ── Screens ────────────────────────────────────────────────────────────────────

/** Varsler: rows under the real header (the header is already on screen). */
export function AlertsSkeleton() {
  return (
    <View>
      <Skeleton className="mx-4 mb-2 mt-3 h-3 w-16" />
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} className="mx-4 mb-2 flex-row items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <Skeleton className="h-11 w-11 rounded-full" />
          <View style={{ flex: 1 }}>
            <View className="flex-row justify-between gap-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-3 w-10" />
            </View>
            <SkLines widths={['w-full', 'w-3/4']} className="mt-2.5" />
          </View>
          <Skeleton className="h-8 w-8 rounded-full" />
        </View>
      ))}
    </View>
  );
}

/** Meldinger list. */
export function MessagesSkeleton() {
  return (
    <View className={pad}>
      <View className="mb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-8 w-44" />
      </View>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} className="mb-3 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <View style={{ flex: 1 }}>
            <View className="flex-row justify-between gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-10" />
            </View>
            <Skeleton className="mt-2 h-3 w-1/3" />
            <Skeleton className="mt-2 h-3 w-3/4" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Chat: header bar, pinned job, bubbles, input bar. */
export function ChatSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      <View className="flex-row items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Skeleton className="h-5 w-5 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <Grow className="h-4 w-1/2" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </View>
      <View className="border-b border-line bg-page px-4 pt-3">
        <View className="mb-3 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <View style={{ flex: 1 }} className="gap-1.5">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-16" />
          </View>
          <Skeleton className="h-6 w-16 rounded-full" />
        </View>
      </View>
      <View style={{ flex: 1 }} className="gap-2 p-4">
        {(
          [
            ['self-start', 'w-3/5', 'h-14'],
            ['self-end', 'w-1/2', 'h-14'],
            ['self-start', 'w-2/3', 'h-20'],
            ['self-end', 'w-2/5', 'h-14'],
            ['self-start', 'w-1/2', 'h-14'],
          ] as const
        ).map(([align, width, height], i) => (
          <View key={i} className={`${align} ${width}`}>
            <Skeleton className={`${height} w-full rounded-2xl`} />
          </View>
        ))}
      </View>
      <View className="flex-row items-end gap-2 border-t border-line bg-surface px-4 py-3">
        <Grow className="h-11 rounded-2xl" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </View>
    </View>
  );
}

/** Anbefalte oppdragstakere. */
export function TaskersSkeleton() {
  return (
    <View className={pad}>
      <SkScreenHeader />
      <Skeleton className="mb-3 h-12 w-full rounded-full" />
      <Skeleton className="mb-3 ml-1 h-3 w-24" />
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="rounded-2xl border border-line bg-surface p-4">
            <View className="flex-row gap-3">
              <Skeleton className="h-14 w-14 rounded-full" />
              <View style={{ flex: 1 }} className="gap-2 pt-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </View>
              <View className="items-end gap-1.5 pt-1">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-3 w-10" />
              </View>
            </View>
            <View className="mt-3 flex-row gap-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </View>
            <View className="mt-3 flex-row justify-between border-t border-line-soft pt-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function SkMenuRow({ divider }: { divider?: boolean }) {
  return (
    <View className="flex-row items-center pl-4">
      <View style={{ width: 28, alignItems: 'center' }}>
        <Skeleton className="h-6 w-6 rounded-md" />
      </View>
      <View style={{ marginLeft: 20, flex: 1 }} className={`flex-row items-center justify-between py-4 pr-4 ${divider ? 'border-t border-line' : ''}`}>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-2.5" />
      </View>
    </View>
  );
}

/** Min Jobblo (FINN layout). */
export function MinJobbloSkeleton() {
  return (
    <View>
      <View className="items-center py-3.5">
        <Skeleton className="h-4 w-24" />
      </View>
      <View className="mx-4 mt-2 flex-row items-center gap-4 rounded-2xl bg-surface p-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <View style={{ flex: 1 }} className="gap-2">
          <Skeleton className="h-6 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
          <Skeleton className="h-4 w-4/5" />
        </View>
      </View>
      <View className="mt-6">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkMenuRow key={i} divider={i > 0} />
        ))}
      </View>
      <View className="mt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkMenuRow key={i} divider={i > 0} />
        ))}
      </View>
    </View>
  );
}

/** Jobbprofil: cover, overlapping identity card, switch, BankID, tabs, a panel. */
export function JobProfileSkeleton() {
  return (
    <View>
      <Skeleton className="h-[190px] w-full rounded-none" />
      <View className="px-4">
        <View className="-mt-16 items-center rounded-3xl border border-line bg-surface px-5 pb-5">
          <View className="-mt-12 rounded-full border-4 border-surface bg-surface">
            <Skeleton className="h-24 w-24 rounded-full" />
          </View>
          <Skeleton className="mt-3 h-6 w-40" />
          <Skeleton className="mt-2 h-3.5 w-48" />
          <View className="mt-4 w-full flex-row gap-2.5">
            <Grow className="h-11 rounded-full" />
            <Skeleton className="h-11 w-11 rounded-full" />
          </View>
          <View className="mt-4 flex-row gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </View>
        </View>
        <Skeleton className="mt-4 h-12 w-full rounded-full" />
        <View className="mt-4 rounded-3xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-2/5" />
          <SkLines widths={['w-full', 'w-4/5']} className="mt-3" />
          <Skeleton className="mt-4 h-12 w-full rounded-full" />
        </View>
        <View className="mt-5 flex-row gap-2">
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="h-10 w-28 rounded-full" />
        </View>
        <View className="mt-4 rounded-3xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-1/3" />
          <SkLines widths={['w-full', 'w-5/6', 'w-2/3']} className="mt-3" />
        </View>
      </View>
    </View>
  );
}

/** Someone else's profile: back row, tinted band, tab bar, cards. */
export function PublicProfileSkeleton() {
  return (
    <View>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Skeleton className="h-5 w-5 rounded-md" />
        <Skeleton className="h-4 w-16" />
      </View>
      <View className="items-center border-b border-line bg-tint px-5 pb-8 pt-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <Skeleton className="mt-4 h-6 w-40" />
        <Skeleton className="mt-2 h-3.5 w-20" />
        <Skeleton className="mt-3 h-3.5 w-28" />
        <View className="mt-6 flex-row gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </View>
      </View>
      <View className="flex-row border-b border-line bg-surface px-5">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="my-3.5 mr-6 h-4 w-16" />
        ))}
      </View>
      <View className="gap-4 px-4 pt-5">
        {[0, 1].map((i) => (
          <View key={i} className="rounded-3xl border border-line bg-surface p-5">
            <Skeleton className="h-4 w-1/3" />
            <SkLines widths={['w-full', 'w-4/5']} className="mt-3" />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Rediger profil. */
export function EditProfileSkeleton() {
  return (
    <View>
      <SkTopBar />
      <View className={pad}>
        <View className="mb-6 mt-2 items-center">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="mt-3 h-4 w-28" />
        </View>
        <SkSectionLabel w="w-12" />
        <View className="mb-6">
          <SkCard>
            <SkFormRow />
            <SkFormRow divider />
          </SkCard>
        </View>
        <SkSectionLabel w="w-16" />
        <View className="mb-6">
          <SkCard>
            <SkFormRow tall />
          </SkCard>
        </View>
        <SkSectionLabel w="w-24" />
        <View className="mb-6">
          <SkCard>
            <View className="flex-row gap-2 px-4 pt-4">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </View>
            <View className="flex-row items-center gap-3 px-4 py-3">
              <Grow className="h-4 w-1/2" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </View>
          </SkCard>
        </View>
        <SkSectionLabel w="w-36" />
        <SkCard>
          {[0, 1, 2, 3].map((i) => (
            <SkFormRow key={i} divider={i > 0} />
          ))}
        </SkCard>
      </View>
    </View>
  );
}

/** Medlemskap. */
export function MembershipSkeleton() {
  return (
    <View className={pad}>
      <Skeleton className="mb-5 mt-2 h-4 w-28" />
      <View className="mb-5 flex-row items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <View style={{ flex: 1 }} className="gap-2">
          <Skeleton className="h-6 w-2/5" />
          <Skeleton className="h-3.5 w-3/4" />
        </View>
      </View>
      <Skeleton className="h-12 w-60 rounded-full" />
      <View className="mt-5 gap-3">
        {[0, 1].map((i) => (
          <View key={i} className="rounded-3xl border border-line bg-surface p-5">
            <View className="flex-row items-start justify-between">
              <View className="gap-2">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-6 w-32" />
              </View>
              <Skeleton className="h-6 w-6 rounded-full" />
            </View>
            <SkLines widths={['w-3/4', 'w-2/3', 'w-4/5']} h="h-3" className="mt-4" />
          </View>
        ))}
      </View>
    </View>
  );
}

/** "Mine saker" rows inside the support card. */
export function SupportTicketsSkeleton() {
  return (
    <View>
      {[0, 1, 2].map((i) => (
        <View key={i}>
          {i > 0 ? <View className="mx-5 h-px bg-line" /> : null}
          <View className="flex-row gap-3 px-5 py-4">
            <View style={{ flex: 1 }}>
              <Skeleton className="h-4 w-3/5" />
              <SkLines widths={['w-full', 'w-4/5']} h="h-3" gap="gap-1.5" className="mt-2.5" />
              <Skeleton className="mt-2.5 h-2.5 w-16" />
            </View>
            <Skeleton className="h-5 w-16 rounded-full" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Adresser: top bar, map card, address rows. */
export function AddressesSkeleton() {
  return (
    <View>
      <SkTopBar />
      <View className={pad}>
        <SkLines widths={['w-full', 'w-3/4']} className="mb-5 px-1" />
        <SkSectionLabel w="w-28" />
        <View className="mb-6">
          <SkCard>
            <Skeleton className="h-[260px] w-full rounded-none" />
            <View className="flex-row items-center gap-3 border-t border-line-soft px-4 py-3">
              <Grow className="h-3 w-2/3" />
              <Skeleton className="h-9 w-28 rounded-full" />
            </View>
          </SkCard>
        </View>
        <SkSectionLabel w="w-16" />
        <SkCard>
          {[0, 1, 2].map((i) => (
            <SkFormRow key={i} divider={i > 0} />
          ))}
        </SkCard>
      </View>
    </View>
  );
}

/** Blokkerte brukere. */
export function BlockedUsersSkeleton() {
  return (
    <View>
      <View className="px-4 pt-2">
        <SkScreenHeader subLines={3} />
      </View>
      <View className={pad}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="mb-3 flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Grow className="h-4 w-1/2" />
            <Skeleton className="h-3 w-12" />
          </View>
        ))}
      </View>
    </View>
  );
}

/** E-post / Telefon / Lokasjon: header, one-field card, info card. */
export function SingleFieldSkeleton() {
  return (
    <View className={pad}>
      <SkScreenHeader />
      <View className="rounded-3xl border border-line bg-surface p-5">
        <Skeleton className="mb-2 h-3 w-28" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="mb-4 mt-2 h-3 w-2/3" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </View>
      <View className="mt-4 rounded-3xl border border-line bg-surface-2 p-4">
        <Skeleton className="h-3.5 w-1/3" />
        <SkLines widths={['w-full', 'w-full', 'w-4/5']} h="h-3" gap="gap-1.5" className="mt-3" />
      </View>
    </View>
  );
}

/** Utbetalinger (Stripe Connect). */
export function PayoutSkeleton() {
  return (
    <View className={pad}>
      <SkScreenHeader icon={false} subLines={2} />
      <View className="rounded-3xl border border-line bg-surface p-5">
        <View className="flex-row items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </View>
        <SkLines widths={['w-full', 'w-3/4']} h="h-3" className="mt-3" />
      </View>
      <View className="mt-3 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="mb-2 h-4 w-40" />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="flex-row justify-between border-t border-line py-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </View>
        ))}
      </View>
      <Skeleton className="mt-3 h-12 w-full rounded-xl" />
      <View className="mt-5 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-1/2" />
        {[0, 1, 2].map((i) => (
          <View key={i} className="mt-4 flex-row gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <SkLines widths={['w-1/2', 'w-full']} h="h-3" gap="gap-1.5" className="flex-1" />
          </View>
        ))}
      </View>
    </View>
  );
}

/** SafePay-historikk. */
export function SafePayHistorySkeleton() {
  return (
    <View className={pad}>
      <SkScreenHeader />
      <View className="mb-5">
        <SkCard className="rounded-2xl">
          {[0, 1].map((row) => (
            <View key={row} className={`flex-row ${row ? 'border-t border-line-soft' : ''}`}>
              {[0, 1].map((col) => (
                <View key={col} style={{ flex: 1 }} className={`gap-2 px-4 py-3.5 ${col ? 'border-l border-line-soft' : ''}`}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-16" />
                </View>
              ))}
            </View>
          ))}
        </SkCard>
      </View>
      <SkChips widths={['w-14', 'w-20', 'w-24']} className="mb-4" />
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <View key={i} className="flex-row items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <View style={{ flex: 1 }}>
              <View className="flex-row justify-between gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-14" />
              </View>
              <Skeleton className="mt-2 h-3 w-1/3" />
              <View className="mt-3 flex-row justify-between">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Jobbsøker-profil. */
export function SeekerSkeleton() {
  return (
    <View>
      <SkTopBar />
      <View className={pad}>
        <SkLines widths={['w-full', 'w-2/3']} className="mb-5 px-1" />
        <SkSectionLabel w="w-20" />
        <View className="mb-6">
          <SkCard>
            <SkFormRow tall />
          </SkCard>
        </View>
        <SkSectionLabel w="w-24" />
        <View className="mb-6">
          <SkCard>
            <View className="flex-row gap-2 px-4 pt-4">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </View>
            <View className="flex-row items-center gap-3 px-4 py-3">
              <Grow className="h-4 w-1/2" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </View>
          </SkCard>
        </View>
        {[0, 1].map((g) => (
          <View key={g} className="mb-6">
            <View className="mb-2 flex-row justify-between px-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-14" />
            </View>
            <SkCard>
              <View className="flex-row items-center gap-3 px-4 py-4">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Grow className="h-3 w-2/3" />
              </View>
            </SkCard>
          </View>
        ))}
      </View>
    </View>
  );
}

function SkSessionRow({ divider }: { divider?: boolean }) {
  return (
    <View className={`flex-row items-center gap-3 px-4 py-3.5 ${divider ? 'border-t border-line-soft' : ''}`}>
      <Skeleton className="h-11 w-11 rounded-2xl" />
      <SkLines widths={['w-2/5', 'w-1/2', 'w-1/3']} h="h-3" gap="gap-1.5" className="flex-1" />
    </View>
  );
}

/** Aktive økter. */
export function SessionsSkeleton() {
  return (
    <View className={pad}>
      <SkScreenHeader />
      <SkSectionLabel w="w-28" />
      <View className="mb-6">
        <SkCard>
          <SkSessionRow />
        </SkCard>
      </View>
      <View className="mb-2 flex-row justify-between px-1">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-20" />
      </View>
      <View className="mb-6">
        <SkCard>
          <SkSessionRow />
          <SkSessionRow divider />
        </SkCard>
      </View>
      <SkSectionLabel w="w-20" />
      <SkCard>
        <SkListRow />
      </SkCard>
    </View>
  );
}

/** Abonnement. */
export function SubscriptionSkeleton() {
  return (
    <View className={pad}>
      <SkScreenHeader />
      <SkSectionLabel w="w-28" />
      <Skeleton className="mb-6 h-[200px] w-full rounded-2xl" />
      <SkSectionLabel w="w-20" />
      <View className="mb-6 rounded-2xl border border-line bg-surface p-5">
        <View className="flex-row gap-2">
          <Grow className="h-16 rounded-xl" />
          <Grow className="h-16 rounded-xl" />
          <Grow className="h-16 rounded-xl" />
        </View>
        <Skeleton className="mt-4 h-3 w-1/2" />
        <Skeleton className="mt-2 h-2 w-full rounded-full" />
        <View className="mt-5 gap-2.5 border-t border-line pt-4">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-1/2" />
        </View>
      </View>
      <SkSectionLabel w="w-32" />
      <SkCard className="rounded-2xl">
        <SkListRow />
        <SkListRow divider />
      </SkCard>
    </View>
  );
}

/** Provider order (Mitt oppdrag). */
export function ProviderOrderSkeleton() {
  return (
    <View className={pad}>
      <Skeleton className="mb-5 h-4 w-20" />
      <Skeleton className="mb-4 h-[92px] w-full rounded-2xl" />
      <View className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-7 w-32 rounded-full" />
        <SkLines widths={['w-full', 'w-2/3']} className="mt-3" />
      </View>
      <View className="mb-4 flex-row gap-3">
        {[0, 1].map((i) => (
          <View key={i} style={{ flex: 1 }} className="items-center rounded-2xl bg-surface-2 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="mt-2 h-2.5 w-16" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </View>
        ))}
      </View>
      <View className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="mb-3 h-4 w-1/3" />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className={`py-2.5 ${i < 3 ? 'border-b border-line' : ''}`}>
            <Skeleton className="h-3 w-2/3" />
          </View>
        ))}
      </View>
      <Skeleton className="h-12 w-full rounded-full" />
    </View>
  );
}

/** Godkjenning (SafePay approval). */
export function ApprovalSkeleton() {
  return (
    <View className={pad}>
      <Skeleton className="mb-5 h-4 w-20" />
      <SkProgressSteps />
      <View className="mb-4 rounded-2xl bg-surface p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mt-3 h-16 w-full rounded-xl" />
      </View>
      <View className="mb-4 flex-row items-center gap-3 rounded-2xl bg-surface p-5">
        <Skeleton className="h-12 w-12 rounded-full" />
        <SkLines widths={['w-1/4', 'w-1/2', 'w-1/3']} h="h-3" className="flex-1" />
      </View>
      <View className="mb-4 rounded-2xl bg-surface p-5">
        <Skeleton className="h-4 w-1/3" />
        <View className="mt-4 flex-row justify-between">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" style={{ width: 96 }} />
          ))}
        </View>
      </View>
      <Skeleton className="h-12 w-full rounded-full" />
    </View>
  );
}

/** Kontrakt og betaling (SafePay checkout). */
export function CheckoutSkeleton() {
  return (
    <View className="px-4 pt-5">
      <Skeleton className="mb-5 h-4 w-36" />
      <View className="mb-6">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-8 w-3/4" />
        <SkLines widths={['w-full', 'w-4/5']} className="mt-3" />
      </View>
      <SkProgressSteps />
      <View className="mb-4 rounded-3xl border border-line bg-surface p-5">
        <Skeleton className="mb-4 h-4 w-28" />
        <View className="flex-row items-center gap-2">
          {[0, 1].map((i) => (
            <React.Fragment key={i}>
              {i ? (
                <View className="w-12 items-center">
                  <Skeleton className="h-5 w-5 rounded-md" />
                </View>
              ) : null}
              <View style={{ flex: 1 }} className="items-center rounded-2xl bg-surface-2 p-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <Skeleton className="mt-2 h-2.5 w-16" />
                <Skeleton className="mt-1.5 h-3.5 w-20" />
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>
      <View className="mb-4 rounded-3xl border border-line bg-surface p-5">
        <Skeleton className="mb-4 h-4 w-32" />
        <View className="rounded-2xl bg-surface-2 px-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} className={`flex-row justify-between py-3 ${i < 4 ? 'border-b border-line' : ''}`}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </View>
          ))}
        </View>
      </View>
      <View className="rounded-3xl border border-line bg-surface p-5">
        <Skeleton className="mb-4 h-4 w-24" />
        <View className="flex-row justify-between border-b border-line py-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </View>
        <View className="flex-row justify-between pt-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-20" />
        </View>
        <Skeleton className="mt-5 h-12 w-full rounded-full" />
      </View>
    </View>
  );
}

/** Åpne tvist. */
export function DisputeCreateSkeleton() {
  return (
    <View className={pad}>
      <Skeleton className="mb-5 h-4 w-20" />
      <View className="mb-4 flex-row gap-3 rounded-2xl bg-danger-tint p-5">
        <Skeleton className="h-10 w-10 rounded-full" />
        <SkLines widths={['w-1/2', 'w-full', 'w-3/4']} h="h-3" className="flex-1" />
      </View>
      <View className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <SkLines widths={['w-2/3', 'w-1/4']} h="h-3" />
      </View>
      <View className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="mb-3 mt-2 h-3 w-1/2" />
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="mb-2 rounded-xl border border-line p-3">
            <Skeleton className="h-3 w-3/5" />
          </View>
        ))}
      </View>
      <View className="mb-4 rounded-2xl border border-line bg-surface p-5">
        <Skeleton className="mb-3 h-4 w-1/4" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="mt-3 h-28 w-full rounded-xl" />
      </View>
      <Skeleton className="h-12 w-full rounded-full" />
    </View>
  );
}

/** Tvist (one dispute): header bar, summary, messages, input. */
export function DisputeOrderSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      <View className="flex-row items-center gap-3 border-b border-line bg-surface px-4 py-3">
        <Skeleton className="h-5 w-5 rounded-md" />
        <Grow className="h-4 w-16" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </View>
      <View style={{ flex: 1 }} className={pad}>
        <View className="mb-4 rounded-2xl border border-line bg-surface p-5">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mb-3 mt-2 h-3 w-1/3" />
          <SkLines widths={['w-full', 'w-full', 'w-2/3']} h="h-3" gap="gap-1.5" />
        </View>
        <Skeleton className="mb-2 ml-1 h-3 w-28" />
        {(['self-start', 'self-end', 'self-start'] as const).map((align, i) => (
          <View key={i} className={`mb-3 w-3/4 ${align} rounded-2xl border border-line bg-surface p-3`}>
            <SkLines widths={['w-1/3', 'w-full', 'w-1/4']} h="h-3" gap="gap-1.5" />
          </View>
        ))}
      </View>
      <View className="flex-row items-end gap-2 border-t border-line bg-surface px-4 py-3">
        <Grow className="h-11 rounded-xl" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </View>
    </View>
  );
}

/** Legg ut (edit mode): sticky stepper, title block, Smart-utfylling, first sections, action bar. */
export function CreateJobSkeleton() {
  return (
    <View style={{ flex: 1 }}>
      <View className="border-b border-line bg-page px-4 pb-3 pt-2">
        <View className="mb-2.5 flex-row justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </View>
        <View className="flex-row gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1 }} className="gap-1.5">
              <Skeleton className="h-1 w-full rounded-full" />
              <Skeleton className="h-3 w-3/4" />
            </View>
          ))}
        </View>
      </View>
      <View style={{ flex: 1 }} className={pad}>
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2 h-7 w-3/4" />
        <Skeleton className="mb-5 mt-2 h-3.5 w-2/3" />
        <View className="rounded-xl border border-line bg-surface p-4">
          <View className="flex-row gap-3">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <SkLines widths={['w-1/3', 'w-full', 'w-4/5']} h="h-3" className="flex-1" />
          </View>
        </View>
        <View className="mt-4 border-t border-line pt-5">
          <View className="mb-4 flex-row gap-3">
            <Skeleton className="h-5 w-5 rounded-md" />
            <SkLines widths={['w-1/4', 'w-2/3']} h="h-3.5" className="flex-1" />
          </View>
          <View className="flex-row gap-2">
            <Skeleton className="h-24 rounded-lg" style={{ width: 100 }} />
            <Skeleton className="h-24 rounded-lg" style={{ width: 100 }} />
          </View>
        </View>
        <View className="mt-4 border-t border-line pt-5">
          <View className="mb-4 flex-row gap-3">
            <Skeleton className="h-5 w-5 rounded-md" />
            <SkLines widths={['w-1/3', 'w-1/2']} h="h-3.5" className="flex-1" />
          </View>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-11 w-full rounded-lg" />
        </View>
      </View>
      <View className="flex-row items-center gap-2 border-t border-line bg-page px-4 py-3">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-11 w-28 rounded-lg" />
        <Grow className="h-11 rounded-lg" />
      </View>
    </View>
  );
}

/** Mine annonser cards (MyJobCard). */
export function MyJobCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
          <View className="p-4">
            <View className="flex-row justify-between">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </View>
            <Skeleton className="mt-3 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/3" />
            <View className="mt-3 flex-row gap-2">
              <Skeleton className="h-7 w-24 rounded-lg" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </View>
          </View>
          <View className="flex-row gap-2 border-t border-line bg-surface-2 px-4 py-3">
            <Grow className="h-10 rounded-lg" />
            <Grow className="h-10 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Oppdrag (job detail): full-bleed photo with round buttons, sheet, bottom CTA. */
export function JobDetailSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <View>
        <Skeleton className="w-full rounded-none" style={{ aspectRatio: 4 / 3 }} />
        <View className="absolute left-0 right-0 flex-row justify-between px-4" style={{ top: insets.top + 8 }}>
          <View className="h-10 w-10 rounded-full bg-surface" />
          <View className="flex-row gap-2.5">
            <View className="h-10 w-10 rounded-full bg-surface" />
            <View className="h-10 w-10 rounded-full bg-surface" />
          </View>
        </View>
      </View>
      <View className="px-4">
        <View className="mt-4 overflow-hidden rounded-[28px] bg-surface">
          <View className="px-5 pb-6 pt-5">
            <Skeleton className="h-7 w-4/5" />
            <Skeleton className="mt-2 h-7 w-1/2" />
            <Skeleton className="mt-3 h-3.5 w-2/5" />
            <View className="mt-6 border-t border-line pt-5">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="mt-2 h-6 w-20 rounded-full" />
            </View>
          </View>
          <View className="px-5 pb-6">
            <Skeleton className="h-32 w-full rounded-2xl" />
          </View>
        </View>
      </View>
      <View className="absolute inset-x-0 bottom-0 border-t border-line bg-surface px-4 pb-5 pt-3">
        <Skeleton className="h-12 w-full rounded-full" />
      </View>
    </View>
  );
}
