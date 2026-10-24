import mainLink from './mainURLs';
import type { ApiResponse, Pagination } from '../types/admin';

// ─── Shared ──────────────────────────────────────────────────────────────────
export type RangeKey = '1h' | '24h' | '7d' | '30d';
export interface RangeQuery {
  range?: RangeKey;
  from?: string;
  to?: string;
}
export type Query = RangeQuery & Record<string, string | number | undefined>;
export interface RangeInfo {
  from: string;
  to: string;
  bucketMs: number;
}

const get = async <T>(url: string, query?: Query) => {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== '') params.set(k, String(v));
  });
  const res = await mainLink.get<ApiResponse<T>>(`/api/developer${url}${params.size ? `?${params}` : ''}`);
  return { ...res.data.data, pagination: res.data.pagination as Pagination | null };
};

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ApiTotals {
  count: number;
  failed: number;
  successRate: number | null;
  errorRate: number | null;
  avgMs: number | null;
  p95: number | null;
  p99: number | null;
  rps: number;
  live?: LiveSnapshot;
}
export interface LiveSnapshot {
  activeRequests: number;
  rps: number;
  requestsLastMin: number;
  errorsLastMin: number;
  p95LastMin: number;
}
export interface Disk {
  total: number;
  free: number;
  used: number;
  percent: number | null;
}
export interface SchedulerJob {
  name: string;
  everyMs: number;
  runs: number;
  failures: number;
  avgMs: number | null;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastError: string | null;
  lastDurationMs: number | null;
  nextRunAt: string | null;
  status: 'healthy' | 'failing' | 'missed' | 'idle' | 'disabled';
}
export interface Actor {
  _id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface Overview {
  range: RangeInfo;
  healthScore: number;
  deductions: { reason: string; points: number }[];
  users: { total: number; new: number; active: number; activeSessions: number };
  jobs: { listings: number; orders: number; active: number; completed: number; cancelled: number; disputed: number };
  api: ApiTotals & { live: LiveSnapshot };
  errors: { inRange: number; openCritical: number };
  server: { cpuPercent: number | null; ramPercent: number; disk: Disk | null; uptime: number; processUptime: number };
  integrations: {
    mongo: { ok: boolean; ms: number | null };
    stripeWebhook: { status: string; mode: string | null; lastDeliveryAt: string | null };
    webhookEvents: { pending: number; failed: number };
    safePay: { total: number };
  };
  scheduler: { enabled: boolean; jobs: number; failing: number };
  recentActivity: { _id: string; action: string; description: string; createdAt: string; adminId?: Actor }[];
  trafficSeries: { t: string; requests: number; errors: number }[];
}

export interface EndpointStat {
  method: string;
  route: string;
  count: number;
  failed: number;
  successRate: number;
  avgMs: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
  rps: number;
  codes: Record<'400' | '401' | '403' | '404' | '429' | '500', number>;
  lastSeen: string;
}
export interface ApiClient {
  ip: string;
  requests: number;
  failed: number;
  endpoints?: number;
  lastSeen: string;
}
export interface IpActivity {
  ip: string;
  range: RangeInfo;
  endpoints: { method: string; route: string; requests: number; failed: number; lastSeen: string }[];
  series: { t: string; requests: number; failed: number }[];
  security: Record<string, number>;
}
export interface ApiMetrics {
  range: RangeInfo;
  clients: ApiClient[];
  totals: ApiTotals & { live: LiveSnapshot };
  endpoints: EndpointStat[];
  series: { t: string; requests: number; errors: number; avgMs: number; p95: number }[];
}
export interface Trace {
  _id: string;
  referenceId: string;
  requestId: string | null;
  statusCode: number | null;
  message: string;
  httpMethod: string;
  route: string;
  createdAt: string;
  severity: string;
}

export type ErrorStatus = 'open' | 'investigating' | 'resolved' | 'reopened';
export type Severity = 'info' | 'warning' | 'error' | 'critical';
export interface ErrorGroup {
  id: string;
  errorCode: string;
  route: string | null;
  message: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  status: ErrorStatus;
  severity: Severity;
  source: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  affectedUsers: number;
  assignee: Actor | null;
}
export interface ErrorDetail {
  error: {
    _id: string;
    referenceId: string;
    errorCode: string;
    message: string;
    technicalMessage: string | null;
    stack: string | null;
    source: string | null;
    route: string | null;
    httpMethod: string | null;
    statusCode: number | null;
    requestId: string | null;
    environment: string;
    status: ErrorStatus;
    severity: Severity;
    metadata: Record<string, unknown>;
    assignee: Actor | null;
    resolvedBy: Actor | null;
    resolvedAt: string | null;
    createdAt: string;
  };
  location: { fn: string; file: string; line: number; column: number } | null;
  occurrences: { _id: string; referenceId: string; requestId: string | null; userId: string | null; statusCode: number | null; createdAt: string; environment: string }[];
  timeline: { t: string; count: number }[];
  notes: { by?: { name: string }; text: string; at: string }[];
}

export interface ServerInfo {
  host: { hostname: string; environment: string; platform: string; release: string; type: string; arch: string; cpus: number; cpuModel: string | null; uptime: number };
  cpu: { percent: number | null; loadavg: number[] };
  memory: { total: number; free: number; used: number };
  disk: Disk | null;
  process: { pid: number; nodeVersion: string; uptime: number; rss: number; heapUsed: number; heapTotal: number; external: number; pm2: { id: string; name: string | null; restarts: number } | null };
  network: { name: string; family: string }[];
  sockets: number | null;
  live: LiveSnapshot;
}

export interface MongoCollection {
  name: string;
  count: number | null;
  size?: number | null;
  storageSize?: number | null;
  indexSize?: number | null;
  indexes?: number | null;
}
export interface MongoInfo {
  connected: boolean;
  ping: { ok: boolean; ms: number | null };
  database?: { name: string; version: string | null };
  stats?: { collections: number; objects: number; dataSize: number; storageSize: number; indexSize: number; indexes: number };
  connections?: { current: number; available: number; totalCreated: number } | null;
  opcounters?: Record<string, number> | null;
  replicaSet?: { set: string; members: { name: string; state: string; health: number }[] } | null;
  collections?: MongoCollection[];
}

export interface SchedulerRun {
  _id: string;
  job: string;
  startedAt: string;
  durationMs: number;
  ok: boolean;
  error: string | null;
  result: unknown;
  trigger: string;
}
export interface SchedulerInfo {
  enabled: boolean;
  startedAt: string | null;
  jobs: SchedulerJob[];
  runs: SchedulerRun[];
}

export interface WebhookEvent {
  _id: string;
  eventId: string;
  type: string;
  status: 'processing' | 'processed';
  derivedStatus: 'processed' | 'failed' | 'pending';
  attempts: number;
  objectId: string | null;
  processedAt: string | null;
  lastError: string | null;
  durationMs: number | null;
  createdAt: string;
}
export interface WebhookInfo {
  range: RangeInfo;
  readiness: { status: string; mode: string | null; ready?: boolean; reason?: string; lastVerifiedAt?: string | null; lastDeliveryAt?: string | null; lastFailureAt?: string | null; lastFailureCode?: string | null };
  summary: { total: number; processed: number; processing: number; failed: number; retried: number; avgMs: number | null };
  types: { type: string; count: number }[];
  series: { t: string; received: number; failed: number }[];
  events: WebhookEvent[];
}

export interface AuditLog {
  _id: string;
  action: string;
  description: string;
  severity: string;
  targetModel: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip?: string;
  httpMethod?: string;
  createdAt: string;
  adminId?: Actor | null;
}

export interface Check {
  key: string;
  label: string;
  ok: boolean | null;
  ms?: number;
  detail?: string;
  error?: string;
  status?: string;
  skipped?: string;
  [k: string]: unknown;
}
export interface ChecksResult {
  ranAt: string;
  checks: Check[];
  env: { name: string; present: boolean }[];
}
export interface TraceResult {
  id: string;
  errors: (ErrorDetail['error'] & { createdAt: string })[];
  activity: AuditLog[];
  webhooks: WebhookEvent[];
}

// ─── Phase 2: money & diagnostics ───────────────────────────────────────────
export type Sev = 'critical' | 'high' | 'medium' | 'low';
export interface Issue {
  code: string;
  severity: Sev;
  detail: string;
}
export interface NamedRef {
  _id: string;
  name: string;
}
export interface PaymentRow {
  _id: string;
  status: string;
  amount: number;
  capturedAmountMinor?: number;
  refundStatus: string;
  refundedAmountMinor?: number;
  stripePaymentIntentId?: string;
  stripeSessionId?: string;
  stripeRefundId?: string;
  stripeLivemode: boolean | null;
  createdAt: string;
  orderId?: { _id: string; status: string; paymentStatus: string; agreedPrice?: number; customerId?: NamedRef; providerId?: NamedRef } | null;
}
export interface FinancialOp {
  _id: string;
  operationKey: string;
  type: string;
  status: string;
  orderId?: string;
  stripeMode: string;
  amount: number;
  currency: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  attemptedAt?: string;
  createdAt?: string;
  updatedAt: string;
}
export interface PaymentsInfo {
  summary: { byStatus: Record<string, number>; byRefund: Record<string, number>; mode: { live: number; test: number; unknown: number }; gross: number; refunded: number; count: number };
  incidents: { kind: string; status: string; count: number }[];
  failedOperations: FinancialOp[];
  payments: PaymentRow[];
}
export interface SafePayRecord {
  _id: string;
  orderId: string;
  serviceTitle: string;
  customerId?: NamedRef;
  providerId?: NamedRef;
  amounts: { agreedPrice: number; fee: number; tax: number; totalCustomer: number; netProvider: number };
  status: string;
  refundStatus: string;
  providerConnectStatus?: string;
  stripeLivemode?: boolean;
  createdAt: string;
}
export interface StuckOrder {
  orderId: string;
  status: string;
  paymentStatus: string;
  updatedAt: string;
  issues: Issue[];
}
export interface SafePayInfo {
  summary: {
    byStatus: Record<string, number>;
    byRefund: Record<string, number>;
    timeoutStates: Record<string, number>;
    amounts: { customer: number; provider: number; fee: number; tax: number; refunded: number } | null;
  };
  stuck: StuckOrder[];
  rules: { autoReleaseDays: number; abandonedOrderHours: number };
  records: SafePayRecord[];
}
export interface TimelineEvent {
  at: string;
  source: string;
  title: string;
  detail?: string | null;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  by?: string;
}
export type Doc = Record<string, unknown>;
export interface ImpactNumbers {
  label: string;
  from: string;
  to: string;
  occurrences: number;
  sampled: boolean;
  unattributed: number;
  users: number;
  usersDirect: number;
  usersViaJob: number;
  jobs: number;
  payments: number;
  jobValueNok: number;
  capturedNok: number;
}
export interface ImpactDetail extends ImpactNumbers {
  kind: 'error' | 'incident' | 'release' | 'window';
  id: string | null;
  people: { id: string; name: string; role: string; email: string; how: 'direct' | 'via job'; hits: number }[];
  jobRows: { id: string; status: string; paymentStatus?: string; valueNok: number; createdAt: string }[];
  paymentRows: { id: string; orderId: string; status: string; refundStatus?: string; amountNok: number; createdAt: string }[];
}
export interface ImpactOverview {
  days: number;
  errors: { id: string; errorCode: string; route: string | null; message: string; severity: string; occurrences: number; last: string; users: number; jobs: number }[];
  incidents: { id: string; title: string; severity: string; status: string; startedAt: string; impact: ImpactNumbers | null }[];
  releases: { id: string; version: string; commit?: string; deployedAt: string; impact: ImpactNumbers | null }[];
}
export type MarketVerdict = 'healthy' | 'thin' | 'undersupplied' | 'oversupplied' | 'low_conversion';
export interface MarketSegment {
  key: string;
  posted: number;
  applications: number;
  providers: number;
  hires: number;
  unanswered: number;
  applicantRate: number | null;
  appsPerJob: number;
  hireRate: number | null;
  medianFirstAppHours: number | null;
  medianPrice: number | null;
  verdict: MarketVerdict;
}
export interface MarketplaceInfo {
  days: number;
  bucketMs: number;
  total: MarketSegment | null;
  categories: MarketSegment[];
  regions: MarketSegment[];
  emptyCategories: string[];
  concentration: { providersHired: number; topShare: number | null; top3Share: number | null };
  series: { t: string; posted: number; applications: number; hires: number }[];
  unanswered: { id: string; title: string; category: string | null; region: string; price: number; createdAt: string }[];
}
export interface EventCheck {
  key: string;
  area: 'webhook' | 'job' | 'payment' | 'notification';
  kind: 'missing' | 'duplicate' | 'out_of_order';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  why: string;
  ms: number;
  count: number;
  checked?: number | null;
  skipped?: string | null;
  error?: string;
  samples: { ref: string; link?: 'job' | 'user'; detail: string; at: string }[];
}
export interface EventConsistencyInfo {
  days: number;
  at: string;
  checks: EventCheck[];
}
export interface MigrationsInfo {
  at: string;
  migrations: { script: string; title: string; kind: 'data' | 'index'; reversible: boolean; destructive?: boolean; run: string; pending: boolean | null; detail: string }[];
  unregistered: string[];
  indexChanges: { collection: string; key: string; problem: 'missing' | 'not_unique'; unique: boolean; severity: string }[];
  undeclaredIndexes: { collection: string; key: string; name?: string; unique: boolean }[];
  schema: { model: string; collection: string; path: string; rule: 'enum' | 'required'; count: number; sampleId: string; value: string | null; allowed?: string[] }[];
  clients: { version: string; platform: string; firstSeen: string; lastSeen: string; sessions7d: number; breakingSince: number; routes: string[] }[];
  rollback: { key: string; label: string; state: 'pass' | 'warn' | 'fail'; detail: string }[];
}
export interface ExternalService {
  key: string;
  name: string;
  usedFor: string;
  configured: boolean;
  probe?: boolean;
  status: 'off' | 'idle' | 'throttled' | 'degraded' | 'healthy';
  calls: number;
  errors: number;
  rateLimited: number;
  clientErrors: number;
  errorRate: number | null;
  avgMs: number | null;
  p95: number | null;
  maxMs: number;
  lastError: string | null;
  lastErrorAt: string | null;
  series: { t: string; calls: number; errors: number; rateLimited: number; p95: number | null }[];
  ops: { op: string; calls: number; failed: number; rateLimited: number; avgMs: number | null; p95: number | null }[];
  quota: { label: string; used: number; limit: number; unit: string; pct: number | null } | null;
}
export interface ExternalServicesInfo {
  hours: number;
  bucketMs: number;
  services: ExternalService[];
}
export type CheckState = 'pass' | 'warn' | 'fail' | 'error';
export type RunbookApproval = 'none' | 'operations' | 'step-up' | 'change-request' | 'human';
export interface RunbookStep {
  kind: 'investigate' | 'recover';
  text: string;
  link?: string;
  manual?: string;
  endpoint?: 'backup_run' | 'synthetic_run';
  approval?: RunbookApproval;
}
export interface Runbook {
  key: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  alerts: string[];
  symptoms: string;
  checks: { key: string; title: string }[];
  steps: RunbookStep[];
  lastRun?: { at: string; state: CheckState; runs: number } | null;
  openIncidents?: number;
}
export interface RunbookRunRow {
  _id: string;
  runbook: string;
  incidentId: { _id: string; title: string; status: string } | null;
  startedBy: { _id: string; name: string } | null;
  state: 'pass' | 'warn' | 'fail';
  checks: { key: string; title: string; state: CheckState; detail: string; ms: number }[];
  steps: { index: number; doneBy: { _id: string; name: string } | null; doneAt: string; note?: string }[];
  closedAt: string | null;
  outcome: string | null;
  createdAt: string;
}
export interface RunbooksInfo {
  runbooks: Runbook[];
  incidents: { _id: string; title: string; fingerprint: string | null; severity: string; status: string; startedAt: string; runbooks: string[] }[];
}
export interface PrivacyInfo {
  at: string;
  retention: { collection: string; personal: string; purpose: string; retentionDays: number | null; legal?: boolean; count: number; ttlDays: number | null; overdue: number; oldest: string | null; state: 'pass' | 'warn' | 'fail'; note: string }[];
  deletions: { id: string; deletedAt: string | null; role: string; method: 'anonymised' | 'soft-deleted'; fields: string[]; linked: string[]; clean: boolean }[];
  requests: { id: string; subject: string; status: string; createdAt: string; userId: string | null; kind: 'deletion' | 'access/export'; dueAt: string; daysLeft: number | null; overdue: boolean }[];
  consent: { currentVersion: string; active: number; onCurrent: number; versions: { version: string | null; users: number; current: boolean; lastActive: string | null }[]; newsletterSubscribers: number; cookieConsent: string };
}
export interface SearchHealthInfo {
  days: number;
  bucketMs: number;
  listings: { public: number; findable: number };
  issues: { key: string; title: string; why: string; count: number; samples: { issue: string; id: string; title: string; city?: string | null; coordinates?: number[] | null; detail?: string }[] }[];
  geoIndex: { name: string; key: string } | null;
  search: {
    total: number;
    zeroResults: number;
    zeroRate: number | null;
    p50: number | null;
    p95: number | null;
    withText: number;
    withRadius: number;
    withRegion: number;
    byKind: Record<'list' | 'nearby', { searches: number; zeroRate: number | null }>;
    topZero: { query: string; n: number }[];
    radius: { k: string; n: number }[];
    series: { t: string; searches: number; zero: number }[];
  };
  endpoints: { route: string; requests: number; c5xx: number; slowShare: number | null; p95: number | null }[];
}
export type SessionProblemKind = 'js_error' | 'render' | 'not_found' | 'chunk' | 'api' | 'console';
export interface SessionsInfo {
  days: number;
  sessions: number;
  affectedSessions: number;
  problemFree: number | null;
  kinds: Partial<Record<SessionProblemKind, { events: number; sessions: number }>>;
  list: { sessionId: string; first: string; last: string; problems: number; kinds: SessionProblemKind[]; pages: string[]; device: string; browser: string | null; release: string | null; lastMessage: string | null }[];
  groups: { fingerprint: string; kind: SessionProblemKind; message: string; n: number; sessions: number; pages: string[]; last: string; sampleSession: string }[];
}
export interface SessionReplay {
  sessionId: string;
  device: string;
  browser: string | null;
  connection: string | null;
  release: string | null;
  started: string;
  ended: string;
  timeline: { at: string; type: 'view' | 'click' | 'api' | 'console' | 'error' | 'problem'; kind?: SessionProblemKind; page: string; label: string | null; status?: number | null; ms?: number | null; source?: string | null }[];
}
export type MobileReleaseStatus = 'latest' | 'previous' | 'outdated' | 'unsupported';
export interface MobileReleasesInfo {
  days: number;
  bucketMs: number;
  repoVersion: string | null;
  minVersion: { ios: string | null; android: string | null };
  platforms: { platform: 'ios' | 'android'; latest: string | null; installs: number; onLatest: number | null; outdated: number | null; unsupported: number | null; minVersion: string | null }[];
  versions: { platform: string; version: string; latest: string; behind: number; status: MobileReleaseStatus; installs: number; share: number | null; sessions: number; crashFree: number | null; apiFailuresPer100: number | null; firstSeen: string | null; lastSeen: string | null; breakingSince: number; breakingRoutes: string[] }[];
  adoption: Record<string, { latest: string | null; series: { t: string; share: number }[] }>;
  os: { platform: string; os: string; installs: number }[];
}
export interface QualityRunRow {
  _id: string;
  at: string;
  suite: string;
  source: 'ci' | 'local';
  branch: string | null;
  sha: string | null;
  ciUrl: string | null;
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number | null;
  coverage?: { lines?: number; statements?: number; functions?: number; branches?: number };
  failures: number;
}
export interface QualityInfo {
  days: number;
  mainBranch: string;
  ingestEnabled: boolean;
  verdict: 'clear' | 'warning' | 'blocked';
  blocking: string[];
  gates: { key: string; label: string; blocking: boolean; state: 'pass' | 'warn' | 'fail'; detail: string }[];
  suites: { suite: string; latest: QualityRunRow & { slowest?: { file: string; durationMs: number }[] }; runs: number; passRate: number; coverageDelta: number | null }[];
  runs: QualityRunRow[];
  failing: { id: string; suite: string; file: string; title: string; message: string | null; count: number; lastAt: string; branches: string[] }[];
  flaky: { id: string; suite: string; flips: number; lastAt: string; shas: string[] }[];
  coverage: { t: string; suite: string; lines: number; branches?: number; functions?: number }[];
  ci: { configured: boolean; reason: string | null; successRate: number | null; reruns: number; runs: { id: number; name: string; title: string; branch: string; sha: string; event: string; status: string; conclusion: string | null; createdAt: string; durationMs: number | null; url: string; attempt: number }[] };
}
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  factors: { key: string; points: number; why: string; mitigate?: string }[];
  mitigations: string[];
  subject?: string;
  diff?: { source: 'git' | 'github' | null; error: string | null; files: number; lines: number; sample: { path: string; added: number; deleted: number }[] };
  ci?: { conclusion: string; url: string } | null;
}
export interface RiskOverview {
  now: RiskAssessment;
  requests: (Pick<ChangeRequestRow, '_id' | 'type' | 'summary' | 'status' | 'createdAt' | 'requestedBy' | 'reviewedBy'> & { risk: RiskAssessment })[];
}
export type VitalRating = 'good' | 'needs-improvement' | 'poor';
export interface RumInfo {
  days: number;
  bucketMs: number;
  sessions: number;
  views: number;
  errorCount: number;
  crashFreeSessions: number | null;
  metrics: { metric: 'LCP' | 'INP' | 'CLS' | 'FCP' | 'TTFB'; p75: number | null; rating: VitalRating | null; samples: number; goodShare: number | null; poorShare: number | null; thresholds: [number, number] }[];
  pages: { page: string; views: number; errors: number; vitals: Record<string, { p75: number; samples: number }>; worst: VitalRating | null }[];
  errors: { fingerprint: string; n: number; sessions: number; message: string; source: string | null; pages: string[]; browsers: string[]; last: string; first: string }[];
  devices: Record<string, number>;
  browsers: Record<string, number>;
  series: { t: string; views: number; errors: number }[];
}
export type TxStage = 'posted' | 'first_bid' | 'accepted' | 'paid' | 'started' | 'delivered' | 'completed' | 'paid_out' | 'reviewed';
export interface TxTrace {
  serviceId: string;
  title: string | null;
  serviceStatus: string | null;
  orderId: string | null;
  chatId: string | null;
  steps: { key: TxStage; label: string; optional: boolean; at: string | null; afterMs: number | null; skipped: boolean; detail: string | null }[];
  current: TxStage | null;
  branch: 'cancelled' | 'refunded' | 'disputed' | 'declined' | null;
  skipped: TxStage[];
  waitingMs: number | null;
  stuck: boolean;
  totalMs: number | null;
  bids: { provider: string; status: string; at: string }[];
  attempts: { orderId: string; status: string; paymentStatus: string; at: string; reason: string | null }[];
  disputes: { id: string; status: string; title: string; at: string; outcome: string | null }[];
  refund: number | null;
}
export interface TxJourneys {
  days: number;
  jobs: number;
  funnel: { key: TxStage; label: string; reached: number; share: number | null }[];
  steps: { from: TxStage; to: TxStage; label: string; count: number; p50: number | null; p90: number | null }[];
  branches: Record<string, number>;
  stuck: { serviceId: string; title: string; stage: TxStage; waitingMs: number; orderId: string | null }[];
  stuckAfter: Record<string, number>;
}
export interface LedgerIssue {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
}
export interface OrderLedger {
  orderId: string;
  title: string | null;
  status: string;
  paymentStatus: string;
  createdAt: string;
  agreed: number;
  charged: number;
  refunded: number;
  paidOut: number;
  customerFee: number;
  providerFee: number;
  kept: number;
  held: number;
  issues: LedgerIssue[];
}
export interface LedgerInfo {
  generatedAt: string;
  period: string;
  orders: number;
  totals: { charged: number; refunded: number; paidOut: number; customerFees: number; providerFees: number; kept: number; held: number };
  balanced: boolean;
  escrow: { orders: number; held: number; oldestDays: number };
  issues: (LedgerIssue & { orderId: string; title: string | null; status: string; at: string })[];
  issueCounts: Record<string, number>;
  ledgers: OrderLedger[];
}
export interface OrderJournal extends OrderLedger {
  entries: { at: string | null; label: string; amount: number; balance: number; ref: string | null }[];
}
export interface ConnectIssue {
  code: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
}
export interface ConnectProviderRow {
  userId: string;
  name: string;
  email: string;
  accountId: string;
  db: { payoutEnabled: boolean; status: string; lastRefreshed: string | null };
  stripe: { ready: boolean; status: string; payoutsEnabled: boolean; transfersEnabled: boolean; chargesEnabled: boolean; disabledReason: string | null; currentlyDue: number; pastDue: number; pendingVerification: number; currentDeadline: string | null; country: string; created: string | null } | null;
  heldNok: number;
  heldOrders: number;
  issues: ConnectIssue[];
  worst: ConnectIssue['severity'] | null;
}
export interface ConnectHealthInfo {
  generatedAt: string;
  mode: 'test' | 'live';
  stripeError: string | null;
  providers: ConnectProviderRow[];
  withoutAccount: { userId: string; name: string; email: string; orders: number; heldNok: number }[];
  orphanAccounts: { id: string; email: string | null; jobbloUserId: string | null; created: string | null; ready: boolean }[];
  failedPayouts: { _id: string; orderId: string; providerId: { _id: string; name: string; email: string } | null; status: string; failureCode?: string; failureReason?: string; netProviderAmount: number; updatedAt: string }[];
  bankFailures: { _id: string; stripeAccountId: string; providerId: { _id: string; name: string } | null; amount: number; currency: string; failureCode?: string; failureMessage?: string; createdAt: string }[];
  summary: { accounts: number; ready: number; restricted: number; pending: number; missing: number; staleFlags: number; blockedNok: number; failedPayouts: number; bankFailures: number };
}
export interface ConnectProviderDetail {
  mode: string;
  user: { _id: string; name: string; email: string; accountId: string | null; db: { payoutEnabled: boolean; status: string; chargesEnabled: boolean; detailsSubmitted: boolean; lastRefreshed: string | null; connectedAt: string | null } };
  stripeError: string | null;
  stripe: {
    ready: boolean;
    payoutOnboardingStatus: string;
    payoutEnabled: boolean;
    transfersEnabled: boolean;
    chargesEnabled: boolean;
    detailsSubmitted: boolean;
    disabledReason: string | null;
    currentlyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
    eventuallyDue: string[];
    currentDeadline: string | null;
    errors: { requirement: string; code: string; reason: string }[];
    capabilities: Record<string, string>;
    country: string;
    defaultCurrency: string;
    businessType: string | null;
    payoutSchedule: { interval: string; delay_days: number } | null;
    externalAccounts: { bank: string; last4: string; currency: string; status: string }[];
  } | null;
  issues: ConnectIssue[];
  payouts: { _id: string; orderId: string; status: string; netProviderAmount: number; stripeTransferId?: string; failureCode?: string; failureReason?: string; createdAt: string }[];
  bankPayouts: { _id: string; amount: number; currency: string; status: string; arrivalDate?: string; failureMessage?: string; createdAt: string }[];
  heldOrders: { _id: string; status: string; agreedPrice: number; createdAt: string }[];
}
export interface ContractEventRow {
  _id: string;
  at: string;
  method: string;
  route: string;
  status: string;
  kind: 'removed' | 'type_changed' | 'added';
  breaking: boolean;
  path: string;
  detail: string | null;
  version: string | null;
  commit: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: { name: string } | null;
  note: string | null;
}
export interface ContractEndpoint {
  _id: string;
  method: string;
  route: string;
  status: string;
  samples: number;
  firstSeen: string;
  lastSeen: string;
  variants: number;
  openBreaking: number;
  stable: number | null;
}
export interface ContractsInfo {
  generatedAt: string;
  endpoints: ContractEndpoint[];
  events: ContractEventRow[];
  docs: { documented: number; used: number; undocumented: { key: string; n: number }[]; unused: string[] };
  summary: { endpoints: number; samples: number; openBreaking: number; additive7d: number; undocumented: number };
}
export interface ContractDetail {
  method: string;
  route: string;
  status: string;
  samples: number;
  firstSeen: string;
  lastSeen: string;
  fields: { path: string; types: string[]; presence: number; required: boolean }[];
  variants: { sig: string; count: number; firstSeen: string; lastSeen: string; version: string | null; commit: string | null; fieldCount: number }[];
  events: ContractEventRow[];
}
export type FraudStatus = 'open' | 'investigating' | 'confirmed' | 'dismissed';
export interface FraudHit {
  userId: string;
  rule: string;
  weight: number;
  evidence: string;
  related?: string[];
  refs?: { type: 'order' | 'chat'; id: string }[];
}
export interface FraudFlag {
  userId: string;
  user: { name: string; email: string; role: string; accountStatus: string; createdAt: string; avatarUrl?: string } | null;
  score: number;
  level: 'high' | 'medium' | 'low';
  rules: string[];
  status: FraudStatus;
  reopened: boolean;
  review: { note: string | null; by: string | null; at: string | null; scoreAtReview: number | null } | null;
  topEvidence: string[];
}
export interface FraudInfo {
  generatedAt: string;
  sessionsScanned: number;
  flagged: FraudFlag[];
  ruleStats: { key: string; title: string; category: string; users: number; error: string | null }[];
  summary: { high: number; medium: number; investigating: number; confirmed: number; dismissed: number };
}
export interface FraudCaseDetail extends Omit<FraudFlag, 'topEvidence' | 'rules'> {
  hits: FraudHit[];
  rules: { key: string; title: string; category: string }[];
  related: { _id: string; name: string; email: string; role: string; accountStatus: string; createdAt: string; flagged: boolean }[];
  history: { at: string; by: { name: string } | null; status: FraudStatus; note: string | null; score: number | null }[];
}
export type FaultType = 'http_latency' | 'http_error' | 'stripe' | 'email' | 'push' | 'stripe_webhook' | 'scheduler';
export interface FailureExperiment {
  _id: string;
  type: FaultType;
  label: string;
  target: string | null;
  latencyMs: number | null;
  errorRate: number | null;
  statusCode: number | null;
  reason: string;
  startedBy: { name: string } | null;
  stoppedBy: { name: string } | null;
  startedAt: string;
  endsAt: string;
  stoppedAt: string | null;
  status: 'running' | 'ended' | 'stopped';
  impact: {
    window: { from: string; to: string };
    api: { during: { requests: number; c5xx: number; p95: number | null }; before: { requests: number; c5xx: number; p95: number | null } };
    incidents: { _id: string; title: string; service: string; severity: string; startedAt: string }[];
    detected: boolean;
    detectionSeconds: number | null;
    deliveryFailures: Record<string, number>;
    schedulerFailures: number;
    syntheticFailures: number;
  };
}
export interface FailuresInfo {
  availability: { enabled: boolean; reasons: string[] };
  types: Record<FaultType, { label: string; needsTarget?: boolean }>;
  maxMinutes: number;
  schedulerJobs: string[];
  experiments: FailureExperiment[];
}
export interface StartFailureInput {
  type: FaultType;
  target?: string;
  latencyMs?: number;
  errorRate?: number;
  statusCode?: number;
  durationMinutes: number;
  reason: string;
}
export interface DriftChange {
  area: 'runtime' | 'env' | 'packages' | 'globalConfig';
  key: string;
  change: 'added' | 'removed' | 'changed' | 'set' | 'unset' | 'declared' | 'undeclared';
  from?: string | null;
  to?: string | null;
}
export interface PolicyCheck {
  key: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  ok: boolean | null;
  detail: string;
  prodOnly: boolean;
}
export interface ConfigDriftInfo {
  generatedAt: string;
  environment: string;
  current: { digest: string; nodeVersion: string; version: string; commit: string | null; envDeclared: number; envSet: number; packages: number; globalConfigKeys: number };
  baseline: { at: string; by: string | null; note: string | null; digest: string; matches: boolean } | null;
  baselineDiff: DriftChange[] | null;
  history: { at: string; host: string | null; version: string | null; commit: string | null; changes: DriftChange[] | null }[];
  policies: PolicyCheck[];
  dependencies: { name: string; wanted: string; installed: string | null; problem: 'missing' | 'out_of_range' }[];
  unsetEnv: string[];
  stripeWebhooks: { ok: boolean; error?: string; handled: number; missing: string[]; unhandled: string[]; endpoints: { id: string; url: string; status: string; events: string[] }[] };
  summary: { driftFromBaseline: number | null; policyFailures: number; criticalOrHigh: number; dependencyProblems: number; webhookGaps: number };
}
export type ForecastConfidence = 'high' | 'medium' | 'low' | 'estimated' | 'insufficient';
export interface Forecast {
  current: number | null;
  perDay: number | null;
  in30: number | null;
  in90: number | null;
  daysToLimit: number | null;
  confidence: ForecastConfidence;
  points: number;
}
export interface CapacityResource extends Forecast {
  key: string;
  name: string;
  unit: 'bytes';
  limit: number | null;
  limitLabel: string | null;
  series: { t: string; value: number | null }[];
}
export interface CapacityInfo {
  generatedAt: string;
  snapshots: { days: number; latestAt: string | null };
  resources: CapacityResource[];
  traffic: Forecast & { maxRps: number | null; headroom: number | null; requestsPerDay: Forecast; series: { t: string; requests: number; peakRps: number }[] };
  host: { cpus: number; loadPerCpu: number | null; totalMem: number };
  collections: { name: string; documents: number; bytes: number; storage: number; avgObjSize: number; addedLast90d: number; docsPerDay: number | null; bytesPerDay: number | null; docsIn90: number | null; confidence: ForecastConfidence }[];
}
export interface CostLine {
  key: string;
  category: string;
  name: string;
  kind: 'measured' | 'metered' | 'fixed';
  nok: number;
  projectedNok: number;
  metered: boolean;
  excluded?: boolean;
  detail: string;
}
export interface CostConfig {
  monthlyBudgetNok: number | null;
  fixed: { name: string; category: string; monthlyNok: number }[];
  prices: { usdToNok: number; bankIdPerAuthNok: number; emailPerSendNok: number; blobPerGbMonthNok: number; aiModels: Record<string, [number, number]> };
}
export interface CostInfo {
  month: string;
  complete: boolean;
  lines: CostLine[];
  byCategory: Record<string, number>;
  totalNok: number;
  projectedNok: number;
  budgetNok: number | null;
  income: { platformFeesNok: number; payouts: number };
  units: { ordersCompleted: number; activeUsers: number; costPerOrder: number | null; costPerActiveUser: number | null };
  database: { dataBytes: number; storageBytes: number; indexBytes: number } | null;
  config: CostConfig;
  previous: { month: string; totalNok: number; byCategory: Record<string, number>; income: { platformFeesNok: number } };
}
export type ImpactVerdict = 'regression' | 'warning' | 'healthy' | 'improved' | 'insufficient';
export interface ImpactWindow {
  requests: number;
  c5xx: number;
  p95: number | null;
  slowShare: number | null;
}
export interface ApiRelease {
  kind: 'api';
  id: string;
  version: string;
  commit: string | null;
  branch: string | null;
  environment: string | null;
  host: string | null;
  deployedAt: string;
  boots: number;
  current: boolean;
  windowHours: number;
  before: ImpactWindow;
  after: ImpactWindow;
  newErrors: number;
  verdict: ImpactVerdict;
  reasons: string[];
}
export interface MobileRelease {
  kind: 'mobile';
  id: string;
  version: string;
  platform: string | null;
  deployedAt: string;
  sessions: number;
  installs: number;
  crashFree: number | null;
  verdict: ImpactVerdict;
}
export interface ImpactInfo {
  hours: number;
  current: { version: string; commit: string | null; branch: string | null };
  api: ApiRelease[];
  mobile: MobileRelease[];
}
export interface ImpactDetail {
  deployment: { _id: string; version: string; commit: string | null; branch: string | null; deployedAt: string; host: string | null; boots: number; previous: { version: string; commit: string | null; deployedAt: string } | null };
  next: { deployedAt: string; version: string } | null;
  bucketMs: number;
  windowHours: number;
  before: ImpactWindow;
  after: ImpactWindow;
  verdict: ImpactVerdict;
  reasons: string[];
  newErrors: { id: string; errorCode: string; route: string | null; message: string; firstSeen: string; count: number }[];
  synthetic: { before: { runs: number; failed: number }; after: { runs: number; failed: number } };
  routes: { route: string; before: { requests: number; c5xx: number; p95: number | null } | null; after: { requests: number; c5xx: number; p95: number | null }; errorDelta: number; latencyDelta: number | null; isNew: boolean }[];
  series: { t: string; requests: number; errors: number; p95: number | null }[];
}
export type SloStatus = 'ok' | 'at_risk' | 'fast_burn' | 'breached' | 'no_data';
export interface Slo {
  key: string;
  name: string;
  description: string;
  target: number;
  defaultTarget: number;
  windowDays: number;
  sli: number | null;
  total: number;
  bad: number;
  budget: number;
  remaining: number | null;
  burn1h: number | null;
  burn6h: number | null;
  status: SloStatus;
  series: { t: string; sli: number | null; remaining: number | null }[];
}
export interface SloInfo {
  windowDays: number;
  fastBurn: number;
  slowBurn: number;
  slos: Slo[];
}
export type DepStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'off';
export interface DepNode {
  id: string;
  name: string;
  group: 'client' | 'edge' | 'core' | 'data' | 'external';
  status: DepStatus;
  metrics: Record<string, string | number>;
  impact: string;
}
export interface DependencyInfo {
  checkedAt: string;
  nodes: DepNode[];
  edges: { from: string; to: string }[];
}
export interface MobileErrorGroup {
  fingerprint: string;
  count: number;
  fatal: number;
  installs: number;
  versions: (string | null)[];
  platforms: (string | null)[];
  lastSeen: string;
  firstSeen: string;
  name: string;
  message: string;
  kind: string;
  screen: string | null;
}
export interface MobileInfo {
  range: { from: string; to: string; bucketMs: number };
  summary: { installs: number; users: number; sessions: number; errors: number; fatal: number; apiFailures: number; crashedSessions: number; crashFreeSessions: number | null };
  versions: { appVersion: string | null; build: string | null; platform: string | null; sessions: number; installs: number; lastSeen: string; firstSeen: string; crashedSessions: number; crashFree: number | null }[];
  platforms: { platform: string | null; osVersion: string | null; sessions: number; installs: number }[];
  devices: { device: string | null; sessions: number; installs: number }[];
  errorGroups: MobileErrorGroup[];
  api: { method: string | null; path: string; count: number; installs: number; lastSeen: string; codes: Record<string, number>; p50: number | null; p95: number | null }[];
  series: { t: string; sessions: number; errors: number; crashes: number }[];
  recentCrashes: { _id: string; at: string; name: string; message: string; screen: string | null; appVersion: string | null; build: string | null; platform: string | null; device: string | null; fingerprint: string }[];
}
export interface MobileErrorEvent {
  _id: string;
  at: string;
  name: string;
  message: string;
  stack: string | null;
  fatal: boolean;
  kind: string;
  screen: string | null;
  appVersion: string | null;
  build: string | null;
  platform: string | null;
  osVersion: string | null;
  device: string | null;
  installId: string;
  userId?: { _id: string; name: string; email: string } | null;
}
export interface SyntheticRunRow {
  _id?: string;
  key: string;
  name?: string;
  at: string;
  ok: boolean;
  latencyMs: number | null;
  status: number | null;
  error: string | null;
  steps?: { name: string; ok: boolean; status: number | null; ms: number; error?: string }[];
  trigger?: 'schedule' | 'manual';
}
export interface SyntheticCheckRow {
  key: string;
  name: string;
  describe: string;
  custom: boolean;
  state: 'up' | 'down' | 'pending';
  failingFor: number;
  lastRun: SyntheticRunRow | null;
  uptime24h: number | null;
  uptime7d: number | null;
  p50: number | null;
  p95: number | null;
  series: { at: string; ms: number | null; ok: boolean }[];
}
export interface SyntheticCustom {
  _id: string;
  name: string;
  url: string;
  method: 'GET' | 'HEAD';
  expectStatus: number;
  expectText: string | null;
  enabled: boolean;
  createdBy?: { _id: string; name: string } | null;
}
export type SyntheticCheckInput = Pick<SyntheticCustom, 'name' | 'url' | 'method' | 'expectStatus' | 'expectText' | 'enabled'>;
export interface SyntheticInfo {
  checks: SyntheticCheckRow[];
  customs: SyntheticCustom[];
  config: { api: string; web: string | null; loginJourney: boolean; intervalMin: number; enabled: boolean; allowedHosts: string[] };
}
export interface MachineState {
  status: string;
  count: number;
  terminal: boolean;
  next: string[];
}
export interface MachineViolation extends Issue {
  orderId: string;
  title: string | null;
  status: string;
  at: string;
}
export interface MachineInfo {
  states: MachineState[];
  unknownStates: { status: string; count: number }[];
  edges: { from: string; to: string; n: number; legal: boolean }[];
  companions: Record<string, { payment?: (string | null)[]; safePay?: (string | null)[]; payout?: (string | null)[] }>;
  scanned: number;
  scanLimit: number;
  affectedOrders: number;
  byCode: Record<string, number>;
  violations: MachineViolation[];
}
export interface OrderMachine {
  order: { _id: string; title: string | null; status: string; paymentStatus: string; agreedPrice: number; createdAt: string; updatedAt: string };
  path: { at: string | null; action: string; from: string | null; to: string; legal: boolean | null }[];
  next: string[];
  companions: { model: string; actual: string | null; expected: (string | null)[] | null }[];
  issues: Issue[];
  timeline: TimelineEvent[];
}
export interface BackupRunRow {
  _id: string;
  kind: 'backup' | 'drill';
  status: 'running' | 'succeeded' | 'failed';
  trigger: 'cron' | 'dashboard';
  by?: { _id: string; name: string } | null;
  host: string | null;
  database: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  error: string | null;
  file: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  collections?: { name: string; count: number }[];
  offsite?: { status: 'not_configured' | 'succeeded' | 'failed'; at?: string; error?: string };
  deletedAt: string | null;
  backupId: string | null;
  restoredDb: string | null;
  mismatches?: { name: string; expected: number; actual: number }[];
}
export interface AtlasSnapshot {
  id: string;
  createdAt: string;
  expiresAt: string | null;
  status: string;
  type: string;
  frequency: string | null;
  sizeBytes: number | null;
}
export interface BackupInfo {
  config: {
    configured: boolean;
    dir: string | null;
    database: string | null;
    retentionDays: number;
    maxAgeHours: number;
    scheduleHours: number | null;
    offsite: boolean;
    tools: { mongodump: string | null; mongorestore: string | null };
  };
  rpo: { lastBackupAt: string | null; ageHours: number | null; ok: boolean };
  lastDrill: BackupRunRow | null;
  storage: { retained: number; bytes: number; disk: { freeBytes: number; totalBytes: number } | null };
  runs: BackupRunRow[];
  atlas: { configured: boolean; cluster?: string; snapshots: AtlasSnapshot[]; error?: string };
}
export type IntegritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export interface IntegrityCheck {
  key: string;
  category: 'duplicate' | 'orphan' | 'invariant';
  severity: Exclude<IntegritySeverity, 'info'>;
  entity: string;
  title: string;
  why: string;
  count: number | null;
  samples: Record<string, unknown>[];
  ok: boolean;
  ms: number;
  error?: string;
}
export interface IndexDrift {
  collection: string;
  key: string;
  problem: 'missing' | 'not_unique' | 'undeclared';
  unique: boolean;
  severity: IntegritySeverity;
  name?: string;
}
export interface IntegrityInfo {
  generatedAt: string;
  durationMs: number;
  scanLimit: number;
  running: boolean;
  summary: { checks: number; passing: number; failing: number; affected: number; indexProblems: number; bySeverity: Record<string, number> };
  checks: IntegrityCheck[];
  indexes: IndexDrift[];
  indexError: string | null;
}
export type InvestigateKind = 'objectId' | 'stripe' | 'ip' | 'email' | 'reference';
export interface InvestigateMatch {
  type: 'user' | 'service' | 'payment' | 'payout' | 'dispute' | 'incident' | 'ticket' | 'error' | 'approval' | 'subscription' | 'webhook' | 'ip' | 'audit';
  id: string;
  label: string;
  detail?: string | null;
  status?: string | null;
  at?: string | null;
  orderId?: string | null;
  userId?: string | null;
}
export interface InvestigateOrder {
  _id: string;
  title: string;
  status: string;
  paymentStatus: string;
  agreedPrice: number;
  customer: { _id: string; name: string } | null;
  provider: { _id: string; name: string } | null;
  safePay: string | null;
  payout: string | null;
  issues: Issue[];
  timeline: TimelineEvent[];
}
export interface InvestigateResult {
  q: string;
  kind: InvestigateKind;
  matches: InvestigateMatch[];
  orders: InvestigateOrder[];
  moreOrders: number;
}
export interface JobDetail {
  order: Doc & {
    _id: string;
    status: string;
    paymentStatus: string;
    agreedPrice?: number;
    checkoutAmountMinor?: number;
    createdAt: string;
    cancellationReason?: string;
    providerConnectDeadlineAt?: string;
    providerConnectTimeout?: Doc;
    customer: { _id: string; name: string } | null;
    provider: { _id: string; name: string; connectAccount: boolean; payoutEnabled: boolean } | null;
    service: { _id: string; title: string; status: string } | null;
  };
  issues: Issue[];
  payment: Doc | null;
  payout: Doc | null;
  safePay: Doc | null;
  disputes: Doc[];
  operations: FinancialOp[];
  incidents: Doc[];
  transfers: Doc[];
  notifications: { _id: string; type: string; content: string; read: boolean; createdAt: string }[];
  errors: { _id: string; referenceId: string; errorCode: string; message: string; createdAt: string }[];
  timeline: TimelineEvent[];
}
export interface StripeState {
  available: boolean;
  reason?: string;
  stripe?: Doc;
  db?: Doc;
  diffs?: string[];
  matches?: boolean;
}
export interface JobRow {
  _id: string;
  status: string;
  paymentStatus: string;
  agreedPrice?: number;
  createdAt: string;
  updatedAt: string;
  serviceId?: { _id: string; title: string } | null;
  issues?: Issue[];
}
export interface SubscriptionRow {
  _id: string;
  userId?: { _id: string; name: string; email?: string };
  planId?: { _id: string; name: string; type: string; price: number };
  planType: string;
  status: string;
  stripeMode: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  autoRenew: boolean;
  currentPeriodEnd?: string;
  nextRenewalAt?: string;
  paymentRecoveryStatus: string;
  gracePeriodEndsAt?: string;
  pendingPlanChange?: { targetPlanId?: { name: string } | string; targetPlanType: string; effectiveAt: string; operationId: string };
  planHistory?: { planName: string; planPrice: number; changeType: string; effectiveAt: string; operationId?: string }[];
  recoveryHistory?: { invoiceId: string; action: string; at: string }[];
  cancellationEffectiveAt?: string;
  updatedAt: string;
}
export interface BillingOp {
  _id: string;
  operationId: string;
  operationType: string;
  status: string;
  stripeMode: string;
  userId?: NamedRef;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  lastFailureStage?: string;
  attempts: number;
  stripeInvoiceId?: string;
  createdAt?: string;
  updatedAt: string;
  targetPlanId?: { name: string };
}
export interface SubscriptionsInfo {
  summary: {
    byStatus: Record<string, number>;
    byRecovery: Record<string, number>;
    byPlan: { _id: string; n: number; name?: string; type?: string; price?: number }[];
    pendingChanges: number;
    autoRenewOff: number;
    renewingSoon: number;
  };
  operations: { byStatus: Record<string, number>; byType: Record<string, number>; problems: BillingOp[] };
  webhooks: { byStatus: Record<string, number>; failed: { _id: string; eventType: string; stripeEventId: string; lastErrorCode?: string; lastErrorMessage?: string; attempts: number; lastFailureAt?: string }[] };
  subscriptions: SubscriptionRow[];
}
export interface ReconIssue {
  category: string;
  severity: Sev;
  entity: string;
  id: string;
  orderId: string | null;
  detail: string;
  at: string;
}
export interface ReconInfo {
  generatedAt: string;
  total: number;
  bySeverity: Partial<Record<Sev, number>>;
  byCategory: Record<string, number>;
  issues: ReconIssue[];
  lastRuns: { job: string; startedAt: string; ok: boolean; durationMs: number; error: string | null; result: unknown }[];
}
export interface UserHit {
  _id: string;
  name: string;
  email: string;
  role: string;
  accountStatus: string;
  isDeleted?: boolean;
  createdAt: string;
  lastLogin?: string;
  avatarUrl?: string;
}
export interface UserDiag {
  user: UserHit & Doc;
  auth: {
    lastLogin: string | null;
    activeSessions: number;
    sessions: { _id: string; deviceName?: string; device?: string; browser?: string; os?: string; location?: string; lastUsed?: string; createdAt: string }[];
    oauth: string[];
    emailVerified: boolean;
    mfa: null;
    failedLogins: null;
  };
  jobs: { asCustomer: Record<string, number>; asProvider: Record<string, number> };
  subscription: (Omit<SubscriptionRow, 'planId'> & { planId?: { name: string; type: string; price: number } }) | null;
  billingOps: BillingOp[];
  paymentIssues: { kind: string; orderId: string; status: string; detail?: string; at: string }[];
  disputes: { _id: string; orderId: string; status: string; title: string; openedAt: string }[];
  errors: { _id: string; referenceId: string; errorCode: string; message: string; route?: string; createdAt: string }[];
  tickets: { _id: string; subject: string; status: string; orderId?: string; createdAt: string }[];
  roleChanges: { _id: string; description: string; createdAt: string; adminId?: NamedRef }[];
  timeline: TimelineEvent[];
}

// ─── Phase 3: operations ─────────────────────────────────────────────────────
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export interface LogRow {
  id: string;
  at: string;
  level: LogLevel;
  service: string;
  message: string;
  traceId?: string | null;
  userId?: string | null;
  data: Doc;
}
export interface LogsInfo {
  logs: LogRow[];
  nextBefore: string | null;
  services: string[];
  levels: LogLevel[];
  unavailable: string[];
}
export interface LiveInfo {
  at: string;
  traffic: LiveSnapshot;
  sessions: { online: number; loggedInUsers: number };
  sockets: number | null;
  lastTwoMinutes: { orders: number; payments: number; signups: number; errors: number; security: number };
  events: { at: string; type: 'job' | 'payment' | 'error' | 'security'; title: string; ref: string | null }[];
  onlineHistory: { t: string; sessions: number | null; rps: number }[];
}
export interface SecurityEventRow {
  _id: string;
  at: string;
  type: string;
  ip: string | null;
  method: string | null;
  route: string | null;
  status: number | null;
  code: string | null;
  email: string | null;
  userAgent: string | null;
}
export interface IpRow {
  ip: string;
  requests: number;
  failed: number;
  endpoints: number;
  firstSeen: string | null;
  lastSeen: string | null;
  security: Record<string, number>;
  securityTotal: number;
  accounts: number;
  blocked: boolean;
  isYou: boolean;
  risk: 'normal' | 'suspicious' | 'high' | 'blocked';
  reasons: string[];
}
export interface IpsInfo {
  range: { from: string; to: string };
  yourIp: string | null;
  summary: { total: number; requests: number; blocked: number; high: number; suspicious: number; activeBlocks: number };
  ips: IpRow[];
}
export interface IpBlockRow {
  _id: string;
  target: string;
  reason: string;
  createdBy?: NamedRef;
  expiresAt: string | null;
  createdAt: string;
  blockedRequests: number;
  lastBlockedAt: string | null;
}
export interface SecurityInfo {
  range: RangeInfo;
  byType: Record<string, number>;
  series: ({ t: string } & Record<string, number | string>)[];
  topIps: { ip: string; count: number; types: string[]; last: string; routes: string[] }[];
  alerts: { severity: Sev; title: string; detail: string }[];
  recent: SecurityEventRow[];
  roleChanges: { _id: string; description: string; createdAt: string; adminId?: NamedRef & { role?: string } }[];
  developerActions: { _id: string; description: string; createdAt: string; adminId?: NamedRef & { role?: string } }[];
}
export interface FlagRow {
  key: string;
  enabled: boolean;
  rawValue?: unknown;
  description: string | null;
  updatedAt: string | null;
  lastChange: { description: string; createdAt: string; adminId?: NamedRef } | null;
}
export interface FlagsInfo {
  environment: string;
  flags: FlagRow[];
  history: { _id: string; description: string; createdAt: string; metadata?: Doc; adminId?: NamedRef & { role?: string } }[];
}
export interface OpStat {
  key: string;
  count: number;
  avgMs: number;
  p95: number;
  maxMs: number;
}
export interface PerfInfo {
  enabled: boolean;
  eventLoop: { p50: number; p99: number; max: number; mean: number } | null;
  heap: { used: number; total: number; limit: number; external: number };
  gc: { lastMinuteCount: number; lastMinuteMs: number; byKindSinceStart: Record<string, number> };
  db: OpStat[];
  stripe: OpStat[];
  stripeErrors: number;
  slowQueries: { at: string; command: string; collection: string; ms: number; failed: boolean; shape: unknown }[];
  slowQueryMs: number;
  history: { t: string; loopP50: number | null; loopP99: number | null; loopMax: number | null; heapUsed: number; rss: number; cpu: number; gcCount: number; gcMs: number; rps: number; sessionsOnline: number | null }[];
  process: { uptime: number; pid: number; node: string; rss: number };
  live: LiveSnapshot;
  slowestEndpoints: { method: string; route: string; count: number; p95: number; maxMs: number }[];
  unavailable: Record<string, string>;
}
export interface DeliveryRow {
  _id: string;
  at: string;
  channel: 'email' | 'push';
  template: string | null;
  status: 'sent' | 'partial' | 'failed' | 'skipped';
  to: string | null;
  latencyMs: number | null;
  error: string | null;
  errorCode: string | null;
}
export interface NotificationsInfo {
  range: RangeInfo;
  totals: Partial<Record<'email' | 'push', { sent: number; partial: number; failed: number; skipped: number }>>;
  latency: { email: { avg: number; p95: number } | null; push: { avg: number; p95: number } | null };
  health: { channel: string; lastSuccess: string | null; lastFailure: string | null; lastError: string | null; status: string }[];
  templates: { channel: string; template: string | null; count: number; failed: number }[];
  series: { t: string; sent: number; failed: number }[];
  failures: { channel: string; code: string | null; count: number; last: string; example: string | null }[];
  recent: DeliveryRow[];
  inApp: { byType: Record<string, number>; readRate: number | null; total: number };
  pushTokens: number;
  notConfigured: Record<string, string>;
}

// ─── Phase 4: platform ───────────────────────────────────────────────────────
export type DevAccess = 'readonly' | 'operations' | 'superAdmin';
export type ActionType = 'ip_block' | 'ip_unblock' | 'flag_set' | 'thresholds_set' | 'slo_targets_set' | 'developer_access' | 'rate_limit_reset';
export interface ChangeRequestRow {
  _id: string;
  type: ActionType;
  summary: string;
  reason: string;
  status: 'pending' | 'executed' | 'rejected' | 'failed' | 'expired' | 'cancelled';
  requestedBy?: NamedRef & { role?: string };
  reviewedBy?: (NamedRef & { role?: string }) | null;
  reviewNote: string | null;
  error: string | null;
  environment: string;
  createdAt: string;
  reviewedAt: string | null;
  expiresAt: string;
  risk?: RiskAssessment | null;
}
export interface DevMe {
  _id: string;
  name: string;
  role: string;
  environment: string;
  access: DevAccess;
  can: { triage: boolean; request: boolean; execute: boolean; approve: boolean };
}
export interface QueueInfo {
  key: string;
  name: string;
  worker: string;
  retryPolicy: string;
  duplicatePrevention: string;
  counts: Record<string, number>;
  backlog: number;
  stuck: number;
  failed: number;
  deadLetter: number | null;
  oldestPendingAt: string | null;
  attempts: Record<string, number>;
  throughput: { t: string; done: number }[];
  recentFailures: Doc[];
}
export interface BrokerJob {
  id: string;
  name: string;
  data: Record<string, unknown> | null;
  attemptsMade: number;
  maxAttempts: number;
  failedReason: string | null;
  stack: string | null;
  createdAt: string | null;
  finishedAt: string | null;
}
export interface BrokerInfo {
  mode: 'redis' | 'inline';
  redis: { enabled: boolean; ok?: boolean; ms?: number; error?: string };
  redisState: { status: string; lastError: string | null; lastErrorAt: string | null };
  inline: { ran: number; failed: number; lastError: string | null };
  queues: {
    name: string;
    concurrency: number;
    attempts: number;
    counts: Record<'waiting' | 'active' | 'delayed' | 'completed' | 'failed' | 'paused' | 'prioritized', number> | null;
    isPaused?: boolean;
    workerHere: boolean;
    failed: BrokerJob[];
    schedulers?: { id: string; every: number | null; next: string | null }[];
  }[];
}
export interface QueuesInfo {
  broker: BrokerInfo;
  queues: QueueInfo[];
  scheduler: { enabled: boolean; jobs: { name: string; everyMs: number }[] };
  stuckAfterMinutes: number;
  note: string;
}
// ─── Redis management ───
/** Every Redis endpoint starts with this; when Redis is off or down, it is all there is. */
export interface RedisStatus {
  enabled: boolean;
  ok: boolean;
  error: string | null;
  ms: number | null;
  state: { status: string; lastError: string | null; lastErrorAt: string | null };
  prefix: string;
}
export interface RedisMemory {
  used: number | null;
  peak: number | null;
  rss: number | null;
  dataset: number | null;
  luaAndScripts: number | null;
  max: number | null;
  system: number | null;
  pct: number | null;
  policy: string | null;
  fragmentation: number | null;
  allocator: string | null;
  evictedKeys: number;
  expiredKeys: number;
}
export interface RedisConnection { label: string; status: string }
export interface RedisOverview extends RedisStatus {
  connections: RedisConnection[];
  server?: { version: string; mode: string; os: string; uptimeSec: number; port: number };
  clients?: { connected: number | null; blocked: number | null; maxclients: number | null };
  latency?: { min: number; avg: number; max: number };
  opsPerSec?: number | null;
  hitRate?: number | null;
  memory?: RedisMemory;
  keyspace?: Record<string, { keys: number; expires: number; avg_ttl: number }>;
  health?: { score: number; checks: { key: string; ok: boolean; label: string }[] };
}
export interface RedisKeyRow { key: string; type: string; ttlMs: number | null; bytes: number | null }
export interface RedisMemoryInfo extends RedisStatus {
  memory?: RedisMemory;
  groups?: { id: string; label: string; sampledKeys: number; complete: boolean; bytes: number }[];
  dbsize?: number;
}
export interface RedisCacheInfo extends RedisStatus {
  store: 'redis' | 'memory';
  localEntries: number;
  namespaces: { name: string; ttlSec: number; hits: number; misses: number; hitRate: number | null; keys: RedisKeyRow[] }[];
}
export interface RedisKeysInfo extends RedisStatus {
  group?: string;
  groups: { id: string; label: string; match: string }[];
  keys: RedisKeyRow[];
  cursor?: string;
  complete?: boolean;
  dbsize?: number;
}
export interface RedisPerformance extends RedisStatus {
  opsPerSec?: number | null;
  totalCommands?: number | null;
  inputKbps?: number | null;
  outputKbps?: number | null;
  connections?: { connected: number | null; blocked: number | null; received: number | null; rejected: number };
  keyspace?: { hits: number; misses: number };
  latency?: { min: number; avg: number; max: number };
  latencyEvents?: { event: string; at: string; lastMs: number; maxMs: number }[];
  commands?: { command: string; calls: number; usec: number; usecPerCall: number; failed: number }[];
  slowlog?: { id: number; at: string; ms: number; command: string; key: string | null; args: number; client: string | null; clientAddr: string | null }[];
}
export interface RedisConfigInfo extends RedisStatus {
  url: { scheme?: string; tls?: boolean; host?: string; port?: number; db?: number; user?: string | null; password?: string; invalid?: boolean } | null;
  environment: string;
  workersEnabled: boolean;
  settings: Record<string, string> | null;
  configError?: string | null;
  checks: { key: string; value: string | null; expected: string; ok: boolean; severity: 'ok' | 'info' | 'warning' | 'critical'; why: string }[];
}
export interface RedisRateLimits extends RedisStatus {
  store: 'redis' | 'memory';
  limiters: { name: string; windowMs: number; max: number | null; failedOnly: boolean }[];
  counters: { limiter: string; client: string; hits: number; max: number | null; resetInMs: number | null; blocked: boolean }[];
  complete: boolean;
  blocked: { total: number; byRoute: { route: string | null; n: number; last: string }[]; byIp: { ip: string | null; n: number; last: string }[] };
}
export interface RedisWorkerQueue {
  name: string;
  concurrency: number;
  attempts?: number;
  paused?: boolean;
  here: boolean;
  counts?: { waiting: number; active: number; delayed: number; failed: number };
  workers: { id: string; name: string; addr: string | null; ageSec: number; idleSec: number }[];
  lastHour?: { completed: number; failed: number; perMinute: number[] };
  total?: { completed: number | null; failed: number | null };
  avgMs?: number | null;
  maxMs?: number | null;
}
export interface RedisWorkers extends RedisStatus {
  mode: 'redis' | 'inline';
  inline: { ran: number; failed: number; lastError: string | null };
  queues: RedisWorkerQueue[];
}
export interface RedisRealtime extends RedisStatus {
  running: boolean;
  adapter?: 'redis' | 'memory';
  local?: { sockets: number; rooms: number; onlineUsers: number };
  cluster?: { servers: number | null; sockets: number | null; roundTripMs: number } | null;
  pubsub?: { channels: { channel: string; subscribers: number }[]; connections: RedisConnection[] } | null;
}
export interface RedisAlerts {
  enabled: boolean;
  metrics: { enabled: boolean; ok?: boolean; error?: string; memoryPct?: number | null; evictedKeys?: number; policy?: string; backlog?: { name: string; waiting: number }[] };
  rules: { key: string; label: string; severity: string; threshold: string; thresholdKey?: string; firing: string[] }[];
  incidents: { _id: string; title: string; severity: string; status: string; detail: string | null; fingerprint: string; startedAt: string; lastSeenAt: string; recoveredAt: string | null; occurrences: number }[];
}
export interface RedisAuditRow { _id: string; description: string; metadata: Doc; createdAt: string; ip?: string; adminId?: { name: string; email: string; role: string } | null }

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export interface TicketRow {
  _id: string;
  subject: string;
  email: string | null;
  status: TicketStatus;
  priority: Priority;
  escalated: boolean;
  assignee?: NamedRef | null;
  userId?: string | null;
  orderId?: string | null;
  relatedErrorRef?: string | null;
  incidentId?: string | null;
  createdAt: string;
  updatedAt: string;
  sla: { dueAt: string; breached: boolean; metAt: string | null };
}
export interface TicketsInfo {
  summary: { byStatus: Record<string, number>; byPriority: Record<string, number>; breached: number; escalated: number };
  slaHours: Record<Priority, number>;
  tickets: TicketRow[];
}
export interface TicketDetail {
  ticket: TicketRow & { message: string; userId?: { _id: string; name: string; role: string; accountStatus: string } | null; history: { at: string; by?: NamedRef; kind: string; text: string }[] };
  order: { _id: string; status: string; paymentStatus: string } | null;
  error: { referenceId: string; errorCode: string; message: string; route: string; createdAt: string; status: string } | null;
  incident: { _id: string; title: string; status: string; severity: string } | null;
}
export interface GithubRun {
  id: number;
  name: string;
  title: string;
  branch: string;
  sha: string;
  event: string;
  status: string;
  conclusion: string | null;
  actor: string | null;
  createdAt: string;
  durationMs: number | null;
  url: string;
}
export interface DeploymentsInfo {
  current: { environment: string; version: string; commit: string | null; branch: string | null; deployedAt: string; deployedAtSource: string; node: string; deliveredBy: string };
  comparison: { windowHours: number; before: { errors: number; requests: number; errorRate: number | null; p95: number | null }; after: { errors: number; requests: number; errorRate: number | null; p95: number | null } };
  newErrors: { id: string; errorCode: string; route: string | null; message: string; count: number; firstSeen: string; lastSeen: string }[];
  github: { configured: boolean; repo: string; reason?: string; error?: string; runs?: GithubRun[] };
  audit: Doc[];
  rollback: { available: boolean; reason: string };
}
export type IncidentStatus = 'open' | 'acknowledged' | 'resolved';
export interface IncidentRow {
  _id: string;
  title: string;
  severity: Sev;
  status: IncidentStatus;
  source: 'alert' | 'manual';
  service: string | null;
  detail: string | null;
  startedAt: string;
  lastSeenAt: string;
  occurrences: number;
  recoveredAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  assignee?: NamedRef | null;
  notifiedAt: string | null;
  fingerprint: string | null;
}
export interface IncidentsInfo {
  metrics: { open: number; acknowledged: number; mttaMinutes: number | null; mttrMinutes: number | null; resolved30d: number };
  repeats: { fingerprint: string; count: number; title: string }[];
  byService: Record<string, number>;
  incidents: IncidentRow[];
  notifications: { slack: boolean; email: boolean };
}
export interface IncidentDetail {
  incident: IncidentRow & {
    timeline: { at: string; by?: NamedRef | null; kind: string; text: string }[];
    resolutionNotes: string | null;
    postmortem: string | null;
    acknowledgedBy?: NamedRef | null;
    resolvedBy?: NamedRef | null;
  };
  relatedErrors: { id: string; errorCode: string; route: string | null; count: number; last: string }[];
  tickets: { _id: string; subject: string; status: string; priority: string; createdAt: string }[];
}
export interface ReportSection {
  title: string;
  kind: 'kv' | 'table';
  rows: Record<string, unknown>[];
}
export interface ReportInfo {
  type: string;
  title: string;
  generatedAt: string;
  range: { from: string; to: string };
  environment: string;
  sections: ReportSection[];
}
export interface SettingsInfo {
  me: { role: string; access: DevAccess };
  developers: { _id: string; name: string; email: string; role: string; access: DevAccess; lastLogin?: string; activeSessions: number; lastActive: string | null; accountStatus: string }[];
  thresholds: Record<string, number>;
  defaultThresholds: Record<string, number>;
  retention: { data: string; days: number | null }[];
  integrations: { key: string; label: string; configured: boolean; secrets: { name: string; present: boolean }[] }[];
  policies: { action: string; rule: string }[];
  accessAudit: { _id: string; description: string; createdAt: string; adminId?: NamedRef }[];
}

// ─── Calls ───────────────────────────────────────────────────────────────────
export const devApi = {
  overview: (q: Query) => get<Overview>('/overview', q),
  apiMetrics: (q: Query) => get<ApiMetrics>('/api-metrics', q),
  apiTraces: (q: Query) => get<{ traces: Trace[] }>('/api-metrics/traces', q),
  endpointClients: (q: Query) => get<{ clients: ApiClient[] }>('/api-metrics/clients', q),
  ipActivity: (q: Query) => get<IpActivity>('/api-metrics/clients', q),
  errors: (q: Query) => get<{ groups: ErrorGroup[]; summary: { status: ErrorStatus; severity: Severity; count: number }[] }>('/errors', q),
  errorDetail: (id: string) => get<ErrorDetail>(`/errors/${id}`),
  updateError: (id: string, body: { status?: ErrorStatus; assignee?: string | null; note?: string }) =>
    mainLink.patch(`/api/developer/errors/${id}`, body),
  server: () => get<ServerInfo>('/server'),
  mongo: () => get<MongoInfo>('/mongo'),
  mongoIndexes: (name: string) =>
    get<{ indexes: { name: string; key: Record<string, number>; ops: number; since: string | null }[] }>(`/mongo/collections/${encodeURIComponent(name)}/indexes`),
  scheduler: (q: Query) => get<SchedulerInfo>('/scheduler', q),
  webhooks: (q: Query) => get<WebhookInfo>('/webhooks', q),
  audit: (q: Query) => get<{ logs: AuditLog[]; actions: string[] }>('/audit', q),
  developers: () => get<{ developers: Actor[] }>('/developers'),
  runChecks: async () => (await mainLink.post<ApiResponse<ChecksResult>>('/api/developer/tools/checks')).data.data,
  rum: (days: number) => get<RumInfo>('/rum', { days }),
  risk: () => get<RiskOverview>('/risk'),
  riskAssess: async (body: Doc) => (await mainLink.post<ApiResponse<RiskAssessment>>('/api/developer/risk/assess', body)).data.data,
  quality: (days: number) => get<QualityInfo>('/quality', { days }),
  mobileReleases: (days: number) => get<MobileReleasesInfo>('/mobile/releases', { days }),
  sessions: (days: number, kind?: string) => get<SessionsInfo>('/sessions', { days, kind: kind || undefined }),
  sessionReplay: (id: string) => get<SessionReplay>(`/sessions/${encodeURIComponent(id)}`),
  searchHealth: (days: number) => get<SearchHealthInfo>('/search-health', { days }),
  privacy: () => get<PrivacyInfo>('/privacy'),
  exportUserData: async (userId: string, reason: string, stepUp: string) =>
    (await mainLink.post<Record<string, unknown>>(`/api/developer/privacy/export/${userId}`, { reason }, { headers: { 'X-Step-Up-Token': stepUp } })).data,
  runbooks: () => get<RunbooksInfo>('/runbooks'),
  runbook: (key: string) => get<{ runbook: Runbook; runs: RunbookRunRow[] }>(`/runbooks/${encodeURIComponent(key)}`),
  startRunbook: async (key: string, incidentId?: string) => (await mainLink.post<ApiResponse<{ run: RunbookRunRow }>>(`/api/developer/runbooks/${encodeURIComponent(key)}/runs`, { incidentId })).data.data,
  updateRunbookRun: async (id: string, body: { step?: number; note?: string; close?: boolean; outcome?: string }) => (await mainLink.patch<ApiResponse<{ run: RunbookRunRow }>>(`/api/developer/runbooks/runs/${id}`, body)).data.data,
  externalServices: (hours: number) => get<ExternalServicesInfo>('/dependencies/external', { hours }),
  migrations: (refresh?: boolean) => get<MigrationsInfo>('/migrations', refresh ? { refresh: 'true' } : {}),
  eventConsistency: (days: number) => get<EventConsistencyInfo>('/event-consistency', { days }),
  marketplace: (days: number) => get<MarketplaceInfo>('/marketplace', { days }),
  userImpact: (days: number) => get<ImpactOverview>('/impact', { days }),
  userImpactScope: (q: Query) => get<ImpactDetail>('/impact/scope', q),
  journeys: (days: number) => get<TxJourneys>('/transactions', { days }),
  txTrace: (id: string) => get<TxTrace>(`/transactions/${encodeURIComponent(id)}`),
  ledger: (month?: string) => get<LedgerInfo>('/ledger', month ? { month } : undefined),
  ledgerOrder: (orderId: string) => get<OrderJournal>(`/ledger/${orderId}`),
  connectHealth: (refresh?: boolean) => get<ConnectHealthInfo>('/connect', refresh ? { refresh: 'true' } : undefined),
  connectProvider: (userId: string) => get<ConnectProviderDetail>(`/connect/${userId}`),
  connectResync: (userId: string) => mainLink.post(`/api/developer/connect/${userId}/resync`),
  contracts: (flush?: boolean) => get<ContractsInfo>('/contracts', flush ? { flush: 'true' } : undefined),
  contract: (method: string, route: string, status: string) => get<ContractDetail>('/contracts/endpoint', { method, route, status }),
  ackContract: (id: string, note: string) => mainLink.post(`/api/developer/contracts/events/${id}/ack`, { note }),
  fraud: (refresh?: boolean) => get<FraudInfo>('/fraud', refresh ? { refresh: 'true' } : undefined),
  fraudCase: (userId: string) => get<FraudCaseDetail>(`/fraud/${userId}`),
  updateFraudCase: (userId: string, status: FraudStatus, note: string) => mainLink.patch(`/api/developer/fraud/${userId}`, { status, note }),
  failures: () => get<FailuresInfo>('/failures'),
  startFailure: (body: StartFailureInput) => mainLink.post('/api/developer/failures', body),
  stopFailure: (id: string | 'all') => mainLink.post(`/api/developer/failures/${id}/stop`),
  configDrift: (refresh?: boolean) => get<ConfigDriftInfo>('/config-drift', refresh ? { refresh: 'true' } : undefined),
  acceptBaseline: (note: string) => mainLink.post('/api/developer/config-drift/baseline', { note }),
  capacity: (refresh?: boolean) => get<CapacityInfo>('/capacity', refresh ? { refresh: 'true' } : undefined),
  costs: (month?: string) => get<CostInfo>('/costs', month ? { month } : undefined),
  saveCostConfig: (body: Partial<Pick<CostConfig, 'monthlyBudgetNok' | 'fixed'>> & { prices?: Partial<CostConfig['prices']> }) => mainLink.put('/api/developer/costs/config', body),
  impact: (hours: number) => get<ImpactInfo>('/deployments/impact', { hours }),
  impactDetail: (id: string, hours: number) => get<ImpactDetail>(`/deployments/impact/${id}`, { hours }),
  slo: (window: number) => get<SloInfo>('/slo', { window }),
  dependencies: (refresh?: boolean) => get<DependencyInfo>('/dependencies', refresh ? { refresh: 'true' } : undefined),
  mobile: (q: Query) => get<MobileInfo>('/mobile', q),
  mobileError: (fp: string) => get<{ events: MobileErrorEvent[] }>(`/mobile/errors/${fp}`),
  synthetic: () => get<SyntheticInfo>('/synthetic'),
  syntheticRuns: (key: string) => get<{ runs: SyntheticRunRow[] }>(`/synthetic/${encodeURIComponent(key)}/runs`),
  syntheticRun: async (key?: string) => (await mainLink.post<ApiResponse<{ results: SyntheticRunRow[] }>>('/api/developer/synthetic/run', { key })).data.data,
  syntheticCreate: (body: SyntheticCheckInput) => mainLink.post('/api/developer/synthetic/checks', body),
  syntheticUpdate: (id: string, body: SyntheticCheckInput) => mainLink.patch(`/api/developer/synthetic/checks/${id}`, body),
  syntheticDelete: (id: string) => mainLink.delete(`/api/developer/synthetic/checks/${id}`),
  safepayMachine: () => get<MachineInfo>('/safepay/machine'),
  safepayOrderMachine: (id: string) => get<OrderMachine>(`/safepay/machine/${encodeURIComponent(id)}`),
  backups: () => get<BackupInfo>('/backups'),
  runBackup: async () => (await mainLink.post<ApiResponse<{ run: BackupRunRow }>>('/api/developer/backups/run')).data.data,
  runDrill: async (backupId: string | null, stepUp: string) =>
    (await mainLink.post<ApiResponse<{ run: BackupRunRow }>>('/api/developer/backups/drill', { backupId }, { headers: { 'X-Step-Up-Token': stepUp } })).data.data,
  integrity: () => get<IntegrityInfo>('/integrity'),
  runIntegrity: async () => (await mainLink.post<ApiResponse<IntegrityInfo>>('/api/developer/integrity/run')).data.data,
  investigate: (q: string) => get<InvestigateResult>('/investigate', { q }),
  trace: (id: string) => get<TraceResult>(`/tools/trace/${encodeURIComponent(id)}`),
  payments: (q: Query) => get<PaymentsInfo>('/payments', q),
  safePay: (q: Query) => get<SafePayInfo>('/safepay', q),
  subscriptions: (q: Query) => get<SubscriptionsInfo>('/subscriptions', q),
  subscription: (id: string) =>
    get<{ subscription: SubscriptionRow; operations: BillingOp[]; duplicates: { key: string; count: number }[] }>(`/subscriptions/${id}`),
  reconciliation: () => get<ReconInfo>('/reconciliation'),
  jobs: (q: Query) => get<{ orders: JobRow[]; stuck: JobRow[] }>('/jobs', q),
  job: (id: string) => get<JobDetail>(`/jobs/${id}`),
  stripeState: (id: string) => get<StripeState>(`/jobs/${id}/stripe-state`),
  users: (q: Query) => get<{ users: UserHit[] }>('/users', q),
  user: (id: string) => get<UserDiag>(`/users/${id}`),
  logs: (q: Query) => get<LogsInfo>('/logs', q),
  live: () => get<LiveInfo>('/live'),
  security: (q: Query) => get<SecurityInfo>('/security', q),
  blocks: () => get<{ yourIp: string | null; blocks: IpBlockRow[] }>('/security/blocks'),
  ips: (q: Query) => get<IpsInfo>('/ips', q),
  stepUpSend: async () => (await mainLink.post<ApiResponse<{ sentTo: string }>>('/api/developer/step-up/send')).data.data,
  stepUpVerify: async (code: string) => (await mainLink.post<ApiResponse<{ token: string; expiresAt: string }>>('/api/developer/step-up/verify', { code })).data.data,
  action: async (type: ActionType, input: Doc, reason: string, stepUp: string, acknowledgeRisk = false) =>
    (await mainLink.post<ApiResponse<{ executed: boolean; summary: string; requestId?: string; risk?: RiskAssessment | null }>>(`/api/developer/actions/${type}`, { input, reason, acknowledgeRisk }, { headers: { 'X-Step-Up-Token': stepUp } })).data.data,
  approvals: (q: Query) => get<{ pending: number; requests: ChangeRequestRow[] }>('/approvals', q),
  approve: (id: string, note: string, stepUp: string, acknowledgeRisk = false) => mainLink.post(`/api/developer/approvals/${id}/approve`, { note, acknowledgeRisk }, { headers: { 'X-Step-Up-Token': stepUp } }),
  reject: (id: string, note: string) => mainLink.post(`/api/developer/approvals/${id}/reject`, { note }),
  cancelRequest: (id: string) => mainLink.post(`/api/developer/approvals/${id}/cancel`),
  flags: () => get<FlagsInfo>('/flags'),
  performance: () => get<PerfInfo>('/performance'),
  notifications: (q: Query) => get<NotificationsInfo>('/notifications', q),
  me: () => get<DevMe>('/me'),
  queues: () => get<QueuesInfo>('/queues'),
  retryQueueJob: async (queue: string, id: string) => (await mainLink.post(`/api/developer/queues/${queue}/jobs/${encodeURIComponent(id)}/retry`)).data,
  removeQueueJob: async (queue: string, id: string) => (await mainLink.delete(`/api/developer/queues/${queue}/jobs/${encodeURIComponent(id)}`)).data,
  retryFailedJobs: async (queue: string) => (await mainLink.post(`/api/developer/queues/${queue}/retry-failed`)).data,
  redisOverview: () => get<RedisOverview>('/redis/overview'),
  redisMemory: () => get<RedisMemoryInfo>('/redis/memory'),
  redisCache: () => get<RedisCacheInfo>('/redis/cache'),
  redisKeys: (q: Query) => get<RedisKeysInfo>('/redis/keys', q),
  redisPerformance: () => get<RedisPerformance>('/redis/performance'),
  redisConfig: () => get<RedisConfigInfo>('/redis/config'),
  redisRateLimits: () => get<RedisRateLimits>('/redis/rate-limits'),
  redisWorkers: () => get<RedisWorkers>('/redis/workers'),
  redisRealtime: () => get<RedisRealtime>('/redis/realtime'),
  redisAlerts: () => get<RedisAlerts>('/redis/alerts'),
  redisAudit: () => get<{ logs: RedisAuditRow[] }>('/redis/audit'),
  invalidateCache: async (namespace: string) => (await mainLink.post(`/api/developer/redis/cache/${encodeURIComponent(namespace)}/invalidate`)).data,
  deleteCacheKey: async (key: string) => (await mainLink.post('/api/developer/redis/cache/delete-key', { key })).data,
  tickets: (q: Query) => get<TicketsInfo>('/tickets', q),
  ticket: (id: string) => get<TicketDetail>(`/tickets/${id}`),
  updateTicket: (id: string, body: Doc) => mainLink.patch(`/api/developer/tickets/${id}`, body),
  deployments: () => get<DeploymentsInfo>('/deployments'),
  incidents: (q: Query) => get<IncidentsInfo>('/incidents', q),
  incident: (id: string) => get<IncidentDetail>(`/incidents/${id}`),
  createIncident: (body: Doc) => mainLink.post('/api/developer/incidents', body),
  updateIncident: (id: string, body: Doc) => mainLink.patch(`/api/developer/incidents/${id}`, body),
  reportTypes: () => get<{ types: { key: string; title: string }[] }>('/reports'),
  report: (type: string, q: Query) => get<ReportInfo>(`/reports/${type}`, q),
  settings: () => get<SettingsInfo>('/settings'),
};
