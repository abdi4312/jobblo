import mainLink from '../mainURLs';
import type { JobDetail } from '../developer';

/* Admin detail views: one user, one order. */

type Ref = { _id: string; name: string; avatarUrl?: string } | null;

export interface AdminUserOverview {
  user: {
    _id: string;
    name: string;
    lastName?: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    bio?: string;
    role: string;
    companyName?: string;
    orgNumber?: string;
    website?: string;
    address?: string;
    postNumber?: string;
    postSted?: string;
    country?: string;
    locations?: string[];
    skills?: string[];
    planType?: string;
    verified?: boolean;
    isTrusted?: boolean;
    termsVersion?: string | null;
    termsAcceptedAt?: string | null;
    lastLogin?: string;
    mfaEnabledAt?: string | null;
    createdAt: string;
    accountStatus?: string;
    deactivatedAt?: string | null;
    isDeleted?: boolean;
    deletedAt?: string | null;
    averageRating?: number;
    reviewCount?: number;
    completedJobs?: number;
    pointsBalance?: number;
    payoutOnboardingStatus?: string;
    payoutEnabled?: boolean;
    chargesEnabled?: boolean;
    payoutMethod?: string;
    oauthProviders?: { provider: string }[];
    identityVerification?: { provider?: string; verifiedAt?: string; assuranceLevel?: string };
  };
  stats: {
    asCustomer: { count: number; completed: number; cancelled: number; active: number; paidValue: number };
    asProvider: { count: number; completed: number; cancelled: number; active: number; paidValue: number };
    services: number;
    reviewsReceived: number;
    reviewsGiven: number;
    averageRating: number | null;
    chats: number;
    disputes: number;
    paidOut: number;
    payoutsFailed: number;
    activeSessions: number;
  };
  orders: { _id: string; title: string | null; role: 'customer' | 'provider'; counterpart: Ref; status: string; paymentStatus: string; agreedPrice?: number; chatId: string | null; createdAt: string }[];
  services: { _id: string; title: string; status: string; price?: number; createdAt: string; images?: string[] }[];
  reviews: { _id: string; rating: number; comment?: string; createdAt: string; reviewerId: Ref; orderId?: string }[];
  chats: { _id: string; counterpart: Ref; role: 'customer' | 'provider'; service: string | null; orderId: string | null; status: string; lastMessage: string | null; updatedAt: string }[];
  payouts: { _id: string; orderId: string; status: string; grossAmount: number; netProviderAmount: number; releaseSource?: string; createdAt: string; transferCompletedAt?: string; failureReason?: string }[];
  disputes: { _id: string; orderId: string; status: string; title: string; priority?: string; openedAt?: string; openedBy?: string }[];
  sessions: { _id: string; deviceName?: string; device?: string; browser?: string; os?: string; location?: string; ip?: string; lastUsed?: string; createdAt: string; expiresAt?: string }[];
  tickets: { _id: string; subject: string; status: string; priority?: string; orderId?: string; createdAt: string }[];
  activity: { _id: string; action: string; description: string; createdAt: string; adminId?: { name: string } | null }[];
  subscription: { status: string; planType?: string; autoRenew?: boolean; currentPeriodEnd?: string; nextRenewalAt?: string; cancellationEffectiveAt?: string; planId?: { name: string; price: number } | null } | null;
}

type AdminOrderDetail = JobDetail & {
  order: JobDetail['order'] & {
    chatId?: string | null;
    customer: { _id: string; name: string; email?: string; phone?: string; avatarUrl?: string } | null;
    provider: { _id: string; name: string; email?: string; phone?: string; avatarUrl?: string; connectAccount: boolean; payoutEnabled: boolean } | null;
  };
};

export const fetchUserOverview = async (id: string) => (await mainLink.get(`/api/admin/users/${id}/overview`)).data.data as AdminUserOverview;
export const fetchOrderDetail = async (id: string) => (await mainLink.get(`/api/admin/orders/${id}/details`)).data.data as AdminOrderDetail;
