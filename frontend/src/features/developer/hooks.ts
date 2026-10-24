import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { devApi, type ErrorStatus, type Query, type RangeKey } from '../../api/developer';

/** Header-level preferences shared by every developer page. */
export const useDevPrefs = create<{ autoRefresh: boolean; setAutoRefresh: (v: boolean) => void }>()(
  persist((set) => ({ autoRefresh: true, setAutoRefresh: (autoRefresh) => set({ autoRefresh }) }), {
    name: 'jobblo-dev-prefs',
  })
);

const REFRESH_MS = 15_000;
const useInterval = (ms = REFRESH_MS) => {
  const autoRefresh = useDevPrefs((s) => s.autoRefresh);
  return autoRefresh ? ms : false;
};

/** URL-backed filters (?range=24h&status=…) so views are shareable and survive reloads. */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, params.get(k) ?? defaults[k]])
  ) as T;
  const set = (patch: Partial<Record<keyof T, string | undefined>>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => {
          if (v === undefined || v === '' || v === defaults[k]) next.delete(k);
          else next.set(k, v as string);
        });
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true }
    );
  return [values, set] as const;
}
export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const opts = { placeholderData: keepPreviousData, retry: 1 } as const;

export const useDevOverview = (q: Query) =>
  useQuery({ queryKey: ['dev', 'overview', q], queryFn: () => devApi.overview(q), refetchInterval: useInterval(), ...opts });
export const useDevApiMetrics = (q: Query) =>
  useQuery({ queryKey: ['dev', 'api', q], queryFn: () => devApi.apiMetrics(q), refetchInterval: useInterval(30_000), ...opts });
export const useDevApiTraces = (route?: string, method?: string) =>
  useQuery({ queryKey: ['dev', 'traces', route, method], queryFn: () => devApi.apiTraces({ route, method }), enabled: Boolean(route) });
export const useDevEndpointClients = (q: Query, enabled: boolean) =>
  useQuery({ queryKey: ['dev', 'endpoint-clients', q], queryFn: () => devApi.endpointClients(q), enabled });
export const useDevIpActivity = (q: Query) =>
  useQuery({ queryKey: ['dev', 'ip-activity', q], queryFn: () => devApi.ipActivity(q), enabled: Boolean(q.ip) });
export const useDevErrors = (q: Query) =>
  useQuery({ queryKey: ['dev', 'errors', q], queryFn: () => devApi.errors(q), refetchInterval: useInterval(), ...opts });
export const useDevErrorDetail = (id?: string) =>
  useQuery({ queryKey: ['dev', 'error', id], queryFn: () => devApi.errorDetail(id!), enabled: Boolean(id) });
export const useDevServer = () =>
  useQuery({ queryKey: ['dev', 'server'], queryFn: devApi.server, refetchInterval: useInterval(5_000), ...opts });
export const useDevMongo = () =>
  useQuery({ queryKey: ['dev', 'mongo'], queryFn: devApi.mongo, refetchInterval: useInterval(60_000), ...opts });
export const useDevMongoIndexes = (name?: string) =>
  useQuery({ queryKey: ['dev', 'mongo', 'indexes', name], queryFn: () => devApi.mongoIndexes(name!), enabled: Boolean(name) });
export const useDevScheduler = (q: Query) =>
  useQuery({ queryKey: ['dev', 'scheduler', q], queryFn: () => devApi.scheduler(q), refetchInterval: useInterval(30_000), ...opts });
export const useDevWebhooks = (q: Query) =>
  useQuery({ queryKey: ['dev', 'webhooks', q], queryFn: () => devApi.webhooks(q), refetchInterval: useInterval(), ...opts });
export const useDevAudit = (q: Query) =>
  useQuery({ queryKey: ['dev', 'audit', q], queryFn: () => devApi.audit(q), ...opts });
export const useDevDevelopers = () =>
  useQuery({ queryKey: ['dev', 'developers'], queryFn: devApi.developers, staleTime: 5 * 60_000 });
export const useDevTrace = (id?: string) =>
  useQuery({ queryKey: ['dev', 'trace', id], queryFn: () => devApi.trace(id!), enabled: Boolean(id) });

export const useDevUserImpact = (days: number) => useQuery({ queryKey: ['dev', 'user-impact', days], queryFn: () => devApi.userImpact(days), refetchInterval: useInterval(60_000), ...opts });
export const useDevUserImpactScope = (q: Query, enabled: boolean) => useQuery({ queryKey: ['dev', 'user-impact-scope', q], queryFn: () => devApi.userImpactScope(q), enabled, ...opts });
export const useDevMarketplace = (days: number) => useQuery({ queryKey: ['dev', 'marketplace', days], queryFn: () => devApi.marketplace(days), refetchInterval: useInterval(120_000), ...opts });
export const useDevEventConsistency = (days: number) => useQuery({ queryKey: ['dev', 'event-consistency', days], queryFn: () => devApi.eventConsistency(days), refetchInterval: useInterval(300_000), ...opts });
export const useDevMigrations = () => useQuery({ queryKey: ['dev', 'migrations'], queryFn: () => devApi.migrations(), ...opts });
export const useDevExternalServices = (hours: number, enabled = true) => useQuery({ queryKey: ['dev', 'external-services', hours], queryFn: () => devApi.externalServices(hours), enabled, refetchInterval: useInterval(60_000), ...opts });
export const useDevRunbooks = () => useQuery({ queryKey: ['dev', 'runbooks'], queryFn: () => devApi.runbooks(), refetchInterval: useInterval(60_000), ...opts });
export const useDevRunbook = (key: string) => useQuery({ queryKey: ['dev', 'runbook', key], queryFn: () => devApi.runbook(key), enabled: Boolean(key), ...opts });
export const useDevPrivacy = () => useQuery({ queryKey: ['dev', 'privacy'], queryFn: () => devApi.privacy(), ...opts });
export const useDevSearchHealth = (days: number) => useQuery({ queryKey: ['dev', 'search-health', days], queryFn: () => devApi.searchHealth(days), refetchInterval: useInterval(120_000), ...opts });
export const useDevSessions = (days: number, kind: string) => useQuery({ queryKey: ['dev', 'sessions', days, kind], queryFn: () => devApi.sessions(days, kind), refetchInterval: useInterval(60_000), ...opts });
export const useDevSessionReplay = (id: string) => useQuery({ queryKey: ['dev', 'session', id], queryFn: () => devApi.sessionReplay(id), enabled: Boolean(id), ...opts });
export const useDevMobileReleases = (days: number, enabled = true) => useQuery({ queryKey: ['dev', 'mobile-releases', days], queryFn: () => devApi.mobileReleases(days), enabled, refetchInterval: useInterval(300_000), ...opts });
export const useDevQuality = (days: number) => useQuery({ queryKey: ['dev', 'quality', days], queryFn: () => devApi.quality(days), refetchInterval: useInterval(120_000), ...opts });
export const useDevRisk = () => useQuery({ queryKey: ['dev', 'risk'], queryFn: () => devApi.risk(), refetchInterval: useInterval(60_000), ...opts });
export const useDevRum = (days: number) => useQuery({ queryKey: ['dev', 'rum', days], queryFn: () => devApi.rum(days), refetchInterval: useInterval(60_000), ...opts });
export const useDevJourneys = (days: number) => useQuery({ queryKey: ['dev', 'journeys', days], queryFn: () => devApi.journeys(days), staleTime: 60_000, ...opts });
export const useDevTxTrace = (id?: string) => useQuery({ queryKey: ['dev', 'trace-tx', id], queryFn: () => devApi.txTrace(id!), enabled: Boolean(id), retry: false });
export const useDevLedger = (month?: string) => useQuery({ queryKey: ['dev', 'ledger', month || 'all'], queryFn: () => devApi.ledger(month), staleTime: 60_000, ...opts });
export const useDevLedgerOrder = (orderId?: string) =>
  useQuery({ queryKey: ['dev', 'ledger', 'order', orderId], queryFn: () => devApi.ledgerOrder(orderId!), enabled: Boolean(orderId), retry: false });
export const useDevConnectHealth = () => useQuery({ queryKey: ['dev', 'connect'], queryFn: () => devApi.connectHealth(), staleTime: 5 * 60_000, ...opts });
export const useDevConnectProvider = (userId?: string) =>
  useQuery({ queryKey: ['dev', 'connect', userId], queryFn: () => devApi.connectProvider(userId!), enabled: Boolean(userId), retry: false });
export const useDevContracts = () => useQuery({ queryKey: ['dev', 'contracts'], queryFn: () => devApi.contracts(), refetchInterval: useInterval(60_000), ...opts });
export const useDevContract = (key: { method: string; route: string; status: string } | null) =>
  useQuery({ queryKey: ['dev', 'contracts', key], queryFn: () => devApi.contract(key!.method, key!.route, key!.status), enabled: Boolean(key), retry: false });
export const useDevFraud = () => useQuery({ queryKey: ['dev', 'fraud'], queryFn: () => devApi.fraud(), refetchInterval: useInterval(120_000), ...opts });
export const useDevFraudCase = (userId?: string) =>
  useQuery({ queryKey: ['dev', 'fraud', userId], queryFn: () => devApi.fraudCase(userId!), enabled: Boolean(userId), retry: false });
export const useDevFailures = () =>
  useQuery({ queryKey: ['dev', 'failures'], queryFn: devApi.failures, refetchInterval: (q) => (q.state.data?.experiments.some((e) => e.status === 'running') ? 5000 : 30_000), ...opts });
export const useDevConfigDrift = () => useQuery({ queryKey: ['dev', 'config-drift'], queryFn: () => devApi.configDrift(), staleTime: 5 * 60_000, ...opts });
export const useDevCapacity = () => useQuery({ queryKey: ['dev', 'capacity'], queryFn: () => devApi.capacity(), staleTime: 5 * 60_000, ...opts });
export const useDevCosts = (month?: string) => useQuery({ queryKey: ['dev', 'costs', month || 'current'], queryFn: () => devApi.costs(month), staleTime: 5 * 60_000, ...opts });
export const useDevImpact = (hours: number) => useQuery({ queryKey: ['dev', 'impact', hours], queryFn: () => devApi.impact(hours), refetchInterval: useInterval(120_000), ...opts });
export const useDevImpactDetail = (id: string, hours: number) =>
  useQuery({ queryKey: ['dev', 'impact', id, hours], queryFn: () => devApi.impactDetail(id, hours), enabled: Boolean(id), ...opts });
export const useDevSlo = (window: number) => useQuery({ queryKey: ['dev', 'slo', window], queryFn: () => devApi.slo(window), refetchInterval: useInterval(120_000), ...opts });
export const useDevDependencies = () => useQuery({ queryKey: ['dev', 'dependencies'], queryFn: () => devApi.dependencies(), refetchInterval: useInterval(60_000), ...opts });
export const useDevMobile = (q: Query) => useQuery({ queryKey: ['dev', 'mobile', q], queryFn: () => devApi.mobile(q), refetchInterval: useInterval(60_000), ...opts });
export const useDevMobileError = (fp?: string) =>
  useQuery({ queryKey: ['dev', 'mobile', 'error', fp], queryFn: () => devApi.mobileError(fp!), enabled: Boolean(fp) });
export const useDevSynthetic =() => useQuery({ queryKey: ['dev', 'synthetic'], queryFn: devApi.synthetic, refetchInterval: useInterval(60_000), ...opts });
export const useDevSyntheticRuns = (key?: string) =>
  useQuery({ queryKey: ['dev', 'synthetic', 'runs', key], queryFn: () => devApi.syntheticRuns(key!), enabled: Boolean(key) });
export const useDevSafePayMachine =() => useQuery({ queryKey: ['dev', 'safepay-machine'], queryFn: devApi.safepayMachine, refetchInterval: useInterval(120_000), ...opts });
export const useDevSafePayOrderMachine = (id?: string) =>
  useQuery({ queryKey: ['dev', 'safepay-machine', id], queryFn: () => devApi.safepayOrderMachine(id!), enabled: Boolean(id), retry: false });

/** Polls fast while a backup or drill is running. */
export const useDevBackups = () =>
  useQuery({
    queryKey: ['dev', 'backups'],
    queryFn: devApi.backups,
    refetchInterval: (q) => (q.state.data?.runs.some((r) => r.status === 'running') ? 3000 : 60_000),
    ...opts,
  });
export const useDevIntegrity =() => useQuery({ queryKey: ['dev', 'integrity'], queryFn: devApi.integrity, staleTime: 60_000, ...opts });
export const useDevInvestigate =(q?: string) =>
  useQuery({ queryKey: ['dev', 'investigate', q], queryFn: () => devApi.investigate(q!), enabled: Boolean(q) });

// Phase 2
export const useDevPayments = (q: Query) =>
  useQuery({ queryKey: ['dev', 'payments', q], queryFn: () => devApi.payments(q), refetchInterval: useInterval(60_000), ...opts });
export const useDevSafePay = (q: Query) =>
  useQuery({ queryKey: ['dev', 'safepay', q], queryFn: () => devApi.safePay(q), refetchInterval: useInterval(60_000), ...opts });
export const useDevSubscriptions = (q: Query) =>
  useQuery({ queryKey: ['dev', 'subscriptions', q], queryFn: () => devApi.subscriptions(q), refetchInterval: useInterval(60_000), ...opts });
export const useDevSubscription = (id?: string) =>
  useQuery({ queryKey: ['dev', 'subscription', id], queryFn: () => devApi.subscription(id!), enabled: Boolean(id) });
export const useDevReconciliation = () =>
  useQuery({ queryKey: ['dev', 'reconciliation'], queryFn: devApi.reconciliation, refetchInterval: useInterval(120_000), ...opts });
export const useDevJobs = (q: Query) => useQuery({ queryKey: ['dev', 'jobs', q], queryFn: () => devApi.jobs(q), ...opts });
export const useDevJob = (id?: string) => useQuery({ queryKey: ['dev', 'job', id], queryFn: () => devApi.job(id!), enabled: Boolean(id) });
export const useDevStripeState = (id: string | undefined, enabled: boolean) =>
  useQuery({ queryKey: ['dev', 'stripe-state', id], queryFn: () => devApi.stripeState(id!), enabled: Boolean(id) && enabled, retry: false });
export const useDevUsers = (q: string) =>
  useQuery({ queryKey: ['dev', 'users', q], queryFn: () => devApi.users({ q }), enabled: q.length >= 2, ...opts });
export const useDevUser = (id?: string) => useQuery({ queryKey: ['dev', 'user', id], queryFn: () => devApi.user(id!), enabled: Boolean(id) });

// Phase 3
export const useDevLogs = (q: Query) => useQuery({ queryKey: ['dev', 'logs', q], queryFn: () => devApi.logs(q), refetchInterval: useInterval(), ...opts });
export const useDevLive = () => useQuery({ queryKey: ['dev', 'live'], queryFn: devApi.live, refetchInterval: useInterval(5_000), ...opts });
export const useDevSecurity = (q: Query) =>
  useQuery({ queryKey: ['dev', 'security', q], queryFn: () => devApi.security(q), refetchInterval: useInterval(30_000), ...opts });
export const useDevIps = (q: Query) => useQuery({ queryKey: ['dev', 'ips', q], queryFn: () => devApi.ips(q), refetchInterval: useInterval(30_000), ...opts });
export const useDevApprovals = (q: Query) => useQuery({ queryKey: ['dev', 'approvals', q], queryFn: () => devApi.approvals(q), refetchInterval: useInterval(30_000), ...opts });
export const useDevBlocks = () => useQuery({ queryKey: ['dev', 'blocks'], queryFn: devApi.blocks, refetchInterval: useInterval(30_000), ...opts });
export const useDevFlags = () => useQuery({ queryKey: ['dev', 'flags'], queryFn: devApi.flags, ...opts });
export const useDevPerformance = () => useQuery({ queryKey: ['dev', 'performance'], queryFn: devApi.performance, refetchInterval: useInterval(10_000), ...opts });
export const useDevNotifications = (q: Query) =>
  useQuery({ queryKey: ['dev', 'notifications', q], queryFn: () => devApi.notifications(q), refetchInterval: useInterval(60_000), ...opts });

// Phase 4
export const useDevMe = () => useQuery({ queryKey: ['dev', 'me'], queryFn: devApi.me, staleTime: 5 * 60_000 });
/** One Redis management section; `key` must include every parameter the request depends on. */
export const useDevRedis = <T,>(key: string, fn: () => Promise<T>, ms = 15_000) =>
  useQuery({ queryKey: ['dev', 'redis', key], queryFn: fn, refetchInterval: useInterval(ms), ...opts });
export const useDevQueues = () => useQuery({ queryKey: ['dev', 'queues'], queryFn: devApi.queues, refetchInterval: useInterval(30_000), ...opts });
export const useDevTickets = (q: Query) => useQuery({ queryKey: ['dev', 'tickets', q], queryFn: () => devApi.tickets(q), refetchInterval: useInterval(60_000), ...opts });
export const useDevTicket = (id?: string) => useQuery({ queryKey: ['dev', 'ticket', id], queryFn: () => devApi.ticket(id!), enabled: Boolean(id) });
export const useDevDeployments = () => useQuery({ queryKey: ['dev', 'deployments'], queryFn: devApi.deployments, refetchInterval: useInterval(60_000), ...opts });
export const useDevIncidents = (q: Query) => useQuery({ queryKey: ['dev', 'incidents', q], queryFn: () => devApi.incidents(q), refetchInterval: useInterval(), ...opts });
export const useDevIncident = (id?: string) => useQuery({ queryKey: ['dev', 'incident', id], queryFn: () => devApi.incident(id!), enabled: Boolean(id) });
export const useDevReportTypes = () => useQuery({ queryKey: ['dev', 'report-types'], queryFn: devApi.reportTypes, staleTime: Infinity });
export const useDevReport = (type: string | undefined, q: Query) =>
  useQuery({ queryKey: ['dev', 'report', type, q], queryFn: () => devApi.report(type!, q), enabled: Boolean(type) });
export const useDevSettings = () => useQuery({ queryKey: ['dev', 'settings'], queryFn: devApi.settings, ...opts });

/** One mutation hook for every Phase 4 write; invalidates the given query roots. */
export const useDevAction = <V,>(fn: (v: V) => Promise<unknown>, invalidate: string[]) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: ['dev', k] })) });
};

export const useDevRunChecks = () => useMutation({ mutationFn: devApi.runChecks });

export const useDevUpdateError = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: ErrorStatus; assignee?: string | null; note?: string }) =>
      devApi.updateError(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dev', 'errors'] });
      qc.invalidateQueries({ queryKey: ['dev', 'error'] });
    },
  });
};
