import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, CheckCircle2, Mail, Search, Send, ShieldCheck, MessageSquare } from 'lucide-react-native';
import { useCreateTicket, useMyTickets } from '../../../src/hooks/useSupport';
import type { SupportTicket, SupportTicketStatus } from '../../../src/services/support.service';
import { Button } from '../../../src/components/ui/Button';
import { LoadingIndicator } from '../../../src/components/ui/LoadingIndicator';

const SUPPORT_EMAIL = 'support@jobblo.no';

type FAQ = { id: number; question: string; answer: string; search: string };

const FAQ_ITEMS: FAQ[] = [
  { id: 1, question: 'Hvordan registrerer jeg meg?', answer: 'Klikk på «Registrer deg», fyll inn nødvendig informasjon og bekreft e-postadressen din. Deretter kan du fullføre profilen og begynne å bruke Jobblo.', search: 'registrere konto opprette bruker' },
  { id: 2, question: 'Hvordan publiserer jeg et oppdrag?', answer: 'Trykk på «Legg ut oppdrag», velg oppdragstype og legg inn beskrivelse, budsjett og ønsket tidsplan før du publiserer.', search: 'publisere oppdrag legge ut jobb' },
  { id: 3, question: 'Er det trygt å betale gjennom Jobblo?', answer: 'Ja. Betalinger håndteres via SafePay og Stripe. Pengene holdes i escrow til jobben er godkjent — du betaler aldri for noe du ikke er fornøyd med.', search: 'betaling trygt sikker safepay stripe' },
  { id: 4, question: 'Hvordan fungerer vurderingssystemet?', answer: 'Etter et fullført oppdrag kan begge parter legge igjen en vurdering. Dette bidrar til trygghet og bedre valg for hele Jobblo-fellesskapet.', search: 'anmeldelser vurderinger review' },
  { id: 5, question: 'Hva koster det å bruke Jobblo?', answer: 'Det er gratis å komme i gang. Du kan oppgradere til et medlemskap for flere kontakter, bedre synlighet og ekstra funksjoner.', search: 'pris koste medlemskap planer' },
  { id: 6, question: 'Hvordan sier jeg opp abonnementet?', answer: 'Gå til Innstillinger → Abonnementer og velg å si opp. Tilgangen varer ut perioden du allerede har betalt for, og du blir ikke belastet igjen.', search: 'si opp abonnement kansellere' },
];

const STATUS_LABEL: Record<SupportTicketStatus, string> = {
  open: 'Åpen',
  in_progress: 'Behandles',
  resolved: 'Løst',
  closed: 'Lukket',
};

const STATUS_CLASS: Record<SupportTicketStatus, string> = {
  open: 'bg-[#F4F6F0] text-[#63665F]',
  in_progress: 'bg-[#FFF6E8] text-[#A36A1C]',
  resolved: 'bg-[#EAF1E9] text-[#2E6641]',
  closed: 'border border-[#E6E7E1] bg-white text-[#9B9E96]',
};

function getErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  const serverMsg = anyErr?.response?.data?.error;
  return typeof serverMsg === 'string' && serverMsg.length > 0 ? serverMsg : fallback;
}

export default function SupportScreen() {
  const router = useRouter();
  const createTicket = useCreateTicket();
  const { data: tickets, isLoading: ticketsLoading, isError: ticketsError, refetch: refetchTickets } = useMyTickets();

  const [openFaqId, setOpenFaqId] = useState<number | null>(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const filteredFaq = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    if (!q) return FAQ_ITEMS;
    return FAQ_ITEMS.filter((f) =>
      (f.question + ' ' + f.answer + ' ' + f.search).toLowerCase().includes(q),
    );
  }, [faqSearch]);

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0 && !createTicket.isPending;

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      setSubmitError('Fyll ut emne og melding.');
      return;
    }
    setSubmitError(null);
    try {
      await createTicket.mutateAsync({ subject, message });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Kunne ikke sende saken. Prøv igjen.'));
    }
  };

  const resetForm = () => {
    setSent(false);
    setSubmitError(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('nb-NO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          className="mb-3 flex-row items-center self-start py-2"
        >
          <ArrowLeft size={18} color="#63665F" />
          <Text className="ml-2 text-sm font-medium text-[#63665F]">Tilbake</Text>
        </Pressable>

        <Text className="text-2xl font-bold text-[#0B0B0B]">Kundesenter</Text>
        <Text className="mt-1 text-sm leading-5 text-[#63665F]">Hva kan vi hjelpe med?</Text>

        <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
          <View className="flex-row items-center gap-4 p-5">
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9]">
              <Mail size={18} color="#2E6641" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-bold text-[#0B0B0B]">E-post</Text>
              <Text className="text-xs text-[#63665F]">{SUPPORT_EMAIL}</Text>
            </View>
            <Pressable
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              className="shrink-0 rounded-full border border-[#E6E7E1] bg-white px-3.5 py-2"
            >
              <Text className="text-xs font-bold text-[#2E6641]">Send e-post</Text>
            </Pressable>
          </View>
          <View className="border-t border-[#E6E7E1] px-5 py-3.5">
            <View className="flex-row items-center gap-1.5">
              <ShieldCheck size={12} color="#2E6641" />
              <Text className="text-[11px] text-[#63665F]">Vi svarer normalt innen 24 timer på hverdager</Text>
            </View>
          </View>
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
          <View className="px-5 pb-4 pt-5">
            <Text className="mb-3 text-sm font-bold text-[#0B0B0B]">Ofte stilte spørsmål</Text>
            <View className="h-11 flex-row items-center rounded-full border border-[#E6E7E1] bg-[#EFF0EA] pl-3.5 pr-2">
              <Search size={15} color="#9B9E96" />
              <TextInput
                value={faqSearch}
                onChangeText={setFaqSearch}
                placeholder="Søk i FAQ..."
                placeholderTextColor="#9B9E96"
                className="ml-2 flex-1 text-sm text-[#0B0B0B]"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <View className="border-t border-[#E6E7E1]">
            {filteredFaq.length > 0 ? (
              filteredFaq.map((faq, idx) => {
                const open = openFaqId === faq.id;
                const isLast = idx === filteredFaq.length - 1;
                return (
                  <View key={faq.id}>
                    <Pressable
                      onPress={() => setOpenFaqId(open ? null : faq.id)}
                      className="flex w-full flex-row items-start justify-between gap-3 bg-white px-5 py-4 active:bg-[#F4F6F0]"
                    >
                      <Text className="flex-1 text-sm font-semibold text-[#0B0B0B] leading-5 pt-0.5">
                        {faq.question}
                      </Text>
                      <ChevronDown
                        size={15}
                        color={open ? '#2E6641' : '#9B9E96'}
                        style={{ transform: [{ rotate: open ? '180deg' : '0deg' }], marginTop: 4 }}
                      />
                    </Pressable>
                    {open ? (
                      <View className="border-t border-[#F4F6F0] bg-[#FBFCF8] px-5 pb-4 pt-3">
                        <Text className="text-sm leading-6 text-[#63665F]">{faq.answer}</Text>
                      </View>
                    ) : null}
                    {!isLast ? <View className="h-px bg-[#E6E7E1] mx-5" /> : null}
                  </View>
                );
              })
            ) : (
              <View className="py-8 px-5">
                <Text className="text-center text-sm text-[#63665F]">
                  Ingen treff for «{faqSearch}».
                </Text>
              </View>
            )}
          </View>
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white p-5">
          <Text className="text-sm font-bold uppercase tracking-[0.14em] text-[#2E6641]">
            Send en sak
          </Text>
          <View className="mt-2 flex-row items-center gap-1.5">
            <ShieldCheck size={12} color="#2E6641" />
            <Text className="text-[11px] text-[#63665F]">
              Vi svarer til e-postadressen på Jobblo-kontoen din.
            </Text>
          </View>

          {sent ? (
            <View className="items-center py-8">
              <CheckCircle2 size={36} color="#2E6641" />
              <Text className="mt-3 text-sm font-bold text-[#0B0B0B]">Saken din er registrert</Text>
              <Text className="mt-1 text-center text-xs leading-5 text-[#63665F]">
                {createTicket.data?.message || 'Vi svarer normalt innen 24 timer på hverdager.'}
              </Text>
              <Pressable onPress={resetForm} className="mt-5">
                <Text className="text-xs font-bold text-[#2E6641]">Send en ny sak</Text>
              </Pressable>
            </View>
          ) : (
            <View className="mt-4 space-y-4">
              <View>
                <Text className="mb-1.5 text-xs font-bold text-[#4B4D47]">Emne</Text>
                <TextInput
                  value={subject}
                  onChangeText={(v) => { setSubject(v); setSubmitError(null); }}
                  placeholder="Kort beskrivelse av problemet"
                  placeholderTextColor="#9B9E96"
                  maxLength={200}
                  className="rounded-xl border border-[#E6E7E1] bg-white px-3.5 py-3 text-sm text-[#0B0B0B] placeholder:text-[#9B9E96]"
                />
                <Text className="mt-1 text-[10px] text-right text-[#9B9E96]">
                  {subject.length}/200
                </Text>
              </View>
              <View>
                <Text className="mb-1.5 text-xs font-bold text-[#4B4D47]">Melding</Text>
                <TextInput
                  value={message}
                  onChangeText={(v) => { setMessage(v); setSubmitError(null); }}
                  placeholder="Beskriv problemet ditt i detalj..."
                  placeholderTextColor="#9B9E96"
                  multiline
                  maxLength={5000}
                  numberOfLines={6}
                  textAlignVertical="top"
                  className="min-h-[140px] rounded-xl border border-[#E6E7E1] bg-white px-3.5 py-3 text-sm leading-6 text-[#0B0B0B] placeholder:text-[#9B9E96]"
                />
                <Text className="mt-1 text-[10px] text-right text-[#9B9E96]">
                  {message.length}/5000
                </Text>
              </View>

              {submitError ? (
                <Text className="text-xs text-[#B4544A]">{submitError}</Text>
              ) : null}

              <Button
                label={createTicket.isPending ? 'Sender ...' : 'Send sak'}
                variant="primary"
                fullWidth
                disabled={!canSubmit}
                icon={createTicket.isPending ? null : <Send size={15} color="#FFFFFF" />}
                onPress={handleSubmit}
              />
              <Text className="text-center text-[11px] text-[#63665F]">
                Vi svarer normalt innen 24 timer på hverdager.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-5 overflow-hidden rounded-3xl border border-[#E6E7E1] bg-white">
          <View className="flex-row items-center gap-3 border-b border-[#E6E7E1] px-5 py-4">
            <MessageSquare size={18} color="#2E6641" />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-bold text-[#0B0B0B]">Mine saker</Text>
              <Text className="text-xs text-[#63665F]">Tidligere henvendelser du har sendt</Text>
            </View>
            {ticketsError ? (
              <Pressable onPress={() => void refetchTickets()} className="shrink-0 rounded-full border border-[#E6E7E1] bg-white px-3 py-1.5">
                <Text className="text-xs font-bold text-[#2E6641]">Prøv igjen</Text>
              </Pressable>
            ) : null}
          </View>

          {ticketsLoading ? (
            <View className="py-8">
              <LoadingIndicator message="Laster sakene dine..." />
            </View>
          ) : ticketsError ? (
            <View className="px-5 py-6">
              <Text className="text-sm text-[#63665F]">
                Kunne ikke hente sakene dine akkurat nå.
              </Text>
            </View>
          ) : !tickets || tickets.length === 0 ? (
            <View className="px-5 py-8">
              <Text className="text-sm text-[#63665F]">
                Du har ikke sendt noen saker ennå.
              </Text>
            </View>
          ) : (
            tickets.map((ticket: SupportTicket, idx: number) => {
              const isLast = idx === tickets.length - 1;
              return (
                <View key={ticket._id}>
                  <View className="px-5 py-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="min-w-0 flex-1">
                        <Text className="text-sm font-semibold text-[#0B0B0B] leading-5" numberOfLines={2}>
                          {ticket.subject}
                        </Text>
                        <Text className="mt-2 text-xs text-[#63665F] leading-5" numberOfLines={2}>
                          {ticket.message}
                        </Text>
                        <Text className="mt-2 text-[11px] text-[#9B9E96]">
                          {formatDate(ticket.createdAt)}
                        </Text>
                      </View>
                      <View
                        className={[
                          'self-start shrink-0 rounded-full px-2.5 py-1',
                          STATUS_CLASS[ticket.status],
                        ].join(' ')}
                      >
                        <Text className="text-[11px] font-semibold text-current">
                          {STATUS_LABEL[ticket.status]}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {!isLast ? <View className="h-px bg-[#E6E7E1] mx-5" /> : null}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
