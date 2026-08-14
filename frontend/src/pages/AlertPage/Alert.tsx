import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Check, Trash2, Clock, ClipboardCheck, MessageSquare, DollarSign, Star, Briefcase } from 'lucide-react';
import { useNotifications, useMarkAsRead, useMarkAllAsRead, useDeleteNotification, useDeleteAllNotifications, useUnreadCount } from '../../features/notifications/hooks';
import type { AlertType } from '../../features/notifications/types';
import { NotificationSkeleton } from '../../components/Loading/NotificationSkeleton';
import EmptyState from '../../components/Ui/EmptyState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/Ui/select';
import ConfirmDialog from '../../components/Ui/ConfirmDialog';
import { resolveOrderRoute } from '../../utils/orderRoute';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { useUserStore } from '../../stores/userStore';

const categories = [
  { key: 'all', label: 'Alle' },
  { key: 'application', label: 'Søknader', icon: <Briefcase size={14} /> },
  { key: 'payment', label: 'Betalinger', icon: <DollarSign size={14} /> },
  { key: 'message', label: 'Meldinger', icon: <MessageSquare size={14} /> },
  { key: 'review', label: 'Anmeldelser', icon: <Star size={14} /> },
  { key: 'job_update', label: 'Jobber', icon: <ClipboardCheck size={14} /> },
];

export default function Alert() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const navigate = useNavigate();
  const userId = useUserStore((state) => state.user?._id);
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useNotifications(activeCategory === 'all' ? undefined : activeCategory);
  const { data: unreadCountData } = useUnreadCount();
  const markAsReadMutation = useMarkAsRead();
  const markAllMutation = useMarkAllAsRead();
  const deleteMutation = useDeleteNotification();
  const deleteAllMutation = useDeleteAllNotifications();

  const all: AlertType[] = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => (Array.isArray(p) ? p : p?.data || []));
  }, [data]);
  const filtered = useMemo(() => showUnreadOnly ? all.filter((a) => !a.read) : all, [all, showUnreadOnly]);
  const unreadCount = (unreadCountData as any)?.count || 0;

  const handleMarkAll = () =>
    markAllMutation
      .mutateAsync()
      .then(() => toast.success('Alle varsler er merket som lest.'))
      .catch((err) => toast.error(getErrorMessage(err, 'Kunne ikke merke varslene som lest.')));

  // These two used to await with no catch: on failure the promise rejected
  // unhandled, the confirm dialog never closed, and the user saw nothing at all.
  const handleDeleteAll = async () => {
    try {
      await deleteAllMutation.mutateAsync();
      toast.success('Alle varsler er slettet.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Kunne ikke slette varslene.'));
    } finally {
      setShowDeleteAllConfirm(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteMutation.mutateAsync(deleteTargetId);
      toast.success('Varselet er slettet.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Kunne ikke slette varselet.'));
    } finally {
      setDeleteTargetId(null);
    }
  };

  /**
   * "Se" used to navigate to /provider/orders/:id for *every* notification with
   * an orderId, so a customer told "Din forespørsel er godkjent" landed on the
   * provider's work page. It also never marked the notification as read.
   */
  const handleOpen = (n: AlertType) => {
    if (!n.read) {
      markAsReadMutation
        .mutateAsync(n._id)
        .catch(() => {/* navigation matters more than the read flag */});
    }

    if (n.orderId) {
      const route = resolveOrderRoute(n.orderId, userId);
      // Null when the order was deleted (populate returns null) or when we can't
      // tell which side the viewer is on — previously this produced a literal
      // navigate('/provider/orders/null').
      if (route) navigate(route);
      else toast.error('Denne ordren er ikke tilgjengelig lenger.');
      return;
    }

    if (n.requestId) {
      const r = n.requestId as { serviceId?: string | { _id?: string } };
      const sid = typeof r.serviceId === 'object' ? r.serviceId?._id : r.serviceId;
      if (sid) navigate(`/job-applicants/${sid}`);
      return;
    }

    if (n.senderId?._id) navigate(`/profile/${n.senderId._id}`);
  };

  const getIcon = (t: string) => {
    if (['ordre', 'order', 'payment'].includes(t)) return <DollarSign size={16} className="text-custom-green" />;
    if (t === 'application') return <Briefcase size={16} className="text-custom-green" />;
    if (t === 'message') return <MessageSquare size={16} className="text-custom-green" />;
    if (t === 'review') return <Star size={16} className="text-custom-green" />;
    return <ClipboardCheck size={16} className="text-custom-green" />;
  };
  const getTitle = (t: string) => ({ ordre: 'Bestilling', order: 'Bestilling', payment: 'Betaling', application: 'Søknad', message: 'Melding', review: 'Anmeldelse', job_update: 'Jobboppdatering' }[t] || 'Varsel');
  const fmtTime = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); if (m < 1) return 'Nå'; if (m < 60) return `${m} min`; if (m < 1440) return `${Math.floor(m / 60)}t`; if (m < 10080) return `${Math.floor(m / 1440)}d`; return new Date(d).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' }); };

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <div className="max-w-[680px] mx-auto px-4 py-6">

        {/* Header with shadcn Select */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-[22px] font-bold text-gray-900">Varsler</h1>
            {unreadCount > 0 && <p className="text-[12px] text-gray-500 mt-0.5">{unreadCount} uleste</p>}
          </div>
          <Select key={showUnreadOnly ? 'u' : 'a'} onValueChange={(v) => {
            if (v === 'mark_all') handleMarkAll();
            else if (v === 'unread_only') setShowUnreadOnly(true);
            else if (v === 'show_all') setShowUnreadOnly(false);
            else if (v === 'delete_all') setShowDeleteAllConfirm(true);
            else if (v.startsWith('cat_')) setActiveCategory(v.replace('cat_', ''));
          }} defaultValue={`cat_${activeCategory}`}>
            <SelectTrigger className="w-[170px] rounded-full border-black/10 bg-white text-[13px] font-medium h-9 focus:ring-custom-green">
              <SelectValue placeholder="Alternativer" />
            </SelectTrigger>
            <SelectContent className="rounded-xl min-w-[160px]">
              {/* Category filters */}
              <SelectItem value="cat_all">Alle varsler</SelectItem>
              <SelectItem value="cat_application">Søknader</SelectItem>
              <SelectItem value="cat_payment">Betalinger</SelectItem>
              <SelectItem value="cat_message">Meldinger</SelectItem>
              <SelectItem value="cat_review">Anmeldelser</SelectItem>
              <SelectItem value="cat_job_update">Jobboppdateringer</SelectItem>
              {/* Separator via styling */}
              <SelectItem value="mark_all" className="border-t border-black/5 mt-1 pt-1">Marker alle som lest</SelectItem>
              <SelectItem value={showUnreadOnly ? 'show_all' : 'unread_only'}>
                {showUnreadOnly ? 'Vis alle varsler' : 'Vis kun uleste'}
              </SelectItem>
              <SelectItem value="delete_all">Slett alle varsler</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter indicator */}
        {(showUnreadOnly || activeCategory !== 'all') && (
          <div className="flex items-center gap-2 mb-4 bg-[#f0faf0] border border-[#c6f0d8] rounded-xl px-3 py-2">
            <span className="text-[12px] text-[#166534] font-medium">
              {showUnreadOnly && activeCategory !== 'all'
                ? `Uleste · ${categories.find(c => c.key === activeCategory)?.label || ''}`
                : showUnreadOnly ? 'Kun uleste'
                  : `Filter: ${categories.find(c => c.key === activeCategory)?.label || ''}`}
            </span>
            <button onClick={() => { setShowUnreadOnly(false); setActiveCategory('all'); }} className="text-[12px] text-custom-green font-bold ml-auto hover:underline">Nullstill</button>
          </div>
        )}

        {/* Notifications */}
        {isLoading ? <NotificationSkeleton /> : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-black/5">
            <EmptyState type="notifications" title={showUnreadOnly ? 'Ingen uleste' : 'Ingen varsler'} />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <div key={n._id} className={`bg-white rounded-2xl border p-4 hover:shadow-sm transition-all ${!n.read ? 'border-custom-green/20 bg-[#fafff9]' : 'border-black/5'}`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#f0faf0] flex items-center justify-center shrink-0 overflow-hidden">
                    {n.senderId?.avatarUrl ? <img src={n.senderId.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : n.senderId?.name ? <span className="text-[12px] font-bold text-custom-green">{n.senderId.name.slice(0, 2).toUpperCase()}</span>
                        : getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-gray-900">{getTitle(n.type)}</p>
                        <p className="text-[12px] text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>
                      </div>
                      {!n.read && <div className="w-2 h-2 rounded-full bg-custom-green shrink-0 mt-1.5" />}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-gray-400 flex items-center gap-1"><Clock size={10} />{fmtTime(n.createdAt)}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleOpen(n)} className="px-3 py-1.5 bg-custom-green text-white rounded-full text-[11px] font-medium hover:bg-[#14532d]">Se</button>
                        {!n.read && <button onClick={() => markAsReadMutation.mutateAsync(n._id)} className="w-7 h-7 rounded-full hover:bg-[#f0faf0] flex items-center justify-center text-gray-400 hover:text-custom-green" title="Lest"><Check size={12} /></button>}
                        <button onClick={() => setDeleteTargetId(n._id)} className="w-7 h-7 rounded-full hover:bg-red-50 flex items-center justify-center text-gray-400 hover:text-red-500" title="Slett"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {hasNextPage && (
          <div className="flex justify-center mt-8">
            <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
              className="px-8 py-3 border-2 border-custom-green text-custom-green rounded-full font-bold hover:bg-custom-green hover:text-white transition-all disabled:opacity-50">
              {isFetchingNextPage ? 'Laster...' : 'Se flere'}
            </button>
          </div>
        )}

        {/* Delete All Confirm Dialog */}
        <ConfirmDialog
          title="Slett alle varsler?"
          description="Er du sikker på at du vil slette alle varsler? Denne handlingen kan ikke angres."
          confirmText="Ja, slett alle"
          cancelText="Avbryt"
          variant="destructive"
          onConfirm={handleDeleteAll}
          isOpen={showDeleteAllConfirm}
          onOpenChange={setShowDeleteAllConfirm}
        />

        {/* Delete Single Confirm Dialog */}
        <ConfirmDialog
          title="Slett varsel?"
          description="Er du sikker på at du vil slette dette varselet?"
          confirmText="Slett"
          cancelText="Avbryt"
          variant="destructive"
          onConfirm={handleDeleteSingle}
          isOpen={!!deleteTargetId}
          onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
        />
      </div>
    </div>
  );
}
