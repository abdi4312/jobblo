import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { useAdminReviews, useDeleteAdminReview } from '../../hooks/admin';
import type { AdminReviewsQuery, AdminReview } from '../../api/admin';
import {
    AdminDataTable,
    AdminFilterSelect,
    AdminConfirmDialog,
    AdminPageHeader,
} from '../../components/admin';
import type { ColumnDef } from '../../components/admin/AdminDataTable';

const RATING_OPTIONS = [
    { label: '⭐ 1', value: '1' },
    { label: '⭐⭐ 2', value: '2' },
    { label: '⭐⭐⭐ 3', value: '3' },
    { label: '⭐⭐⭐⭐ 4', value: '4' },
    { label: '⭐⭐⭐⭐⭐ 5', value: '5' },
];

function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5" aria-label={`${rating} av 5 stjerner`}>
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={14}
                    className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}
                />
            ))}
            <span className="ml-1 text-xs text-gray-500">{rating}/5</span>
        </div>
    );
}

export default function ReviewsPage() {
    const [page, setPage] = useState(1);
    const [ratingFilter, setRatingFilter] = useState('');
    const [deleteTarget, setDeleteTarget] = useState<AdminReview | null>(null);

    const query: AdminReviewsQuery = {
        page,
        limit: 15,
        ...(ratingFilter && { rating: parseInt(ratingFilter, 10) }),
        sortOrder: 'desc',
    };

    const { data, isLoading, isError, refetch } = useAdminReviews(query);
    const deleteMutation = useDeleteAdminReview();

    const columns: ColumnDef<AdminReview>[] = [
        {
            key: 'reviewer',
            header: 'Anmelder',
            render: (r) => (
                <div className="flex items-center gap-2.5">
                    <img
                        src={
                            r.reviewerId?.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(r.reviewerId?.name ?? 'U')}&background=2d4a3e&color=fff&size=40`
                        }
                        alt={r.reviewerId?.name ?? 'Bruker'}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                            {r.reviewerId?.name ?? '–'}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{r.reviewerId?.email ?? ''}</p>
                    </div>
                </div>
            ),
        },
        {
            key: 'reviewee',
            header: 'Mottaker',
            render: (r) => (
                <span className="text-sm text-gray-600">{r.revieweeId?.name ?? '–'}</span>
            ),
        },
        {
            key: 'service',
            header: 'Tjeneste',
            render: (r) => (
                <span className="text-sm text-gray-600 truncate max-w-[120px] block">
                    {r.serviceId?.title ?? '–'}
                </span>
            ),
        },
        {
            key: 'rating',
            header: 'Vurdering',
            render: (r) => <StarRating rating={r.rating} />,
        },
        {
            key: 'comment',
            header: 'Kommentar',
            render: (r) => (
                <span className="text-sm text-gray-600 truncate max-w-[200px] block">
                    {r.comment ?? <span className="text-gray-300 italic">Ingen kommentar</span>}
                </span>
            ),
        },
        {
            key: 'date',
            header: 'Dato',
            render: (r) =>
                new Date(r.createdAt).toLocaleDateString('nb-NO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                }),
        },
        {
            key: 'actions',
            header: 'Handlinger',
            render: (r) => (
                <button
                    onClick={() => setDeleteTarget(r)}
                    className="px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                    aria-label="Slett vurdering"
                >
                    Slett
                </button>
            ),
        },
    ];

    return (
        <div className="space-y-6">
            <AdminPageHeader
                title="Vurderinger"
                description="Moderer alle bruker- og tjenesevurderinger"
            />

            <AdminDataTable
                columns={columns}
                data={data?.reviews ?? []}
                keyExtractor={(r) => r._id}
                loading={isLoading}
                error={isError}
                onRetry={refetch}
                emptyTitle="Ingen vurderinger"
                emptyDescription="Det finnes ingen vurderinger ennå."
                pagination={data?.pagination}
                onPageChange={setPage}
                toolbar={
                    <div className="flex flex-wrap gap-3 w-full">
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Star size={16} />
                            <span>{data?.pagination.total ?? 0} vurderinger totalt</span>
                        </div>
                        <div className="ml-auto">
                            <AdminFilterSelect
                                value={ratingFilter}
                                onChange={(v) => { setRatingFilter(v); setPage(1); }}
                                options={RATING_OPTIONS}
                                placeholder="Alle vurderinger"
                            />
                        </div>
                    </div>
                }
            />

            <AdminConfirmDialog
                title="Slett vurdering?"
                description="Denne vurderingen vil bli permanent slettet og kan ikke gjenopprettes."
                confirmText="Ja, slett"
                cancelText="Avbryt"
                variant="destructive"
                isOpen={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                onConfirm={async () => {
                    if (!deleteTarget) return;
                    await deleteMutation.mutateAsync(deleteTarget._id);
                    setDeleteTarget(null);
                }}
            />
        </div>
    );
}
