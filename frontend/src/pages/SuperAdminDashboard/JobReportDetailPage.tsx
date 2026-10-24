import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserCheck, Briefcase, CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
    fetchAdminJobReportById,
    assignJobReport,
    updateJobReportStatus,
} from '../../api/admin/jobReports';
import { AdminStatusBadge, AdminLoadingSkeleton, AdminErrorState, AdminPageHeader, AdminConfirmDialog } from '../../components/admin';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 border-b border-border pb-2">{title}</h3>
            {children}
        </div>
    );
}

function Row({ label, value, badge }: { label: string; value?: React.ReactNode; badge?: string }) {
    return (
        <div className="flex items-start justify-between py-1.5 gap-4">
            <span className="text-xs text-muted-foreground shrink-0 w-40">{label}</span>
            <span className="text-sm text-foreground text-right flex items-center gap-1 min-w-0">
                {badge ? <AdminStatusBadge status={badge} /> : (value ?? <span className="text-muted-foreground/60">â€“</span>)}
            </span>
        </div>
    );
}

export default function JobReportDetailPage() {
    const { reportId } = useParams<{ reportId: string }>();
    const qc = useQueryClient();
    const [resolveNote, setResolveNote] = useState('');
    const [dismissNote, setDismissNote] = useState('');
    const [showResolve, setShowResolve] = useState(false);
    const [showDismiss, setShowDismiss] = useState(false);

    const { data: report, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin-job-report-detail', reportId],
        queryFn: () => fetchAdminJobReportById(reportId!),
        enabled: !!reportId,
        staleTime: 30_000,
    });

    const inv = () => qc.invalidateQueries({ queryKey: ['admin-job-report-detail', reportId] });

    const assignMut = useMutation({
        mutationFn: () => assignJobReport(reportId!),
        onSuccess: () => { toast.success('Rapport tildelt.'); inv(); },
        onError: () => toast.error('Tildeling mislyktes.'),
    });
    const resolveMut = useMutation({
        mutationFn: () => updateJobReportStatus(reportId!, 'resolved', resolveNote),
        onSuccess: () => { toast.success('Rapport markert som lÃ¸st.'); setShowResolve(false); setResolveNote(''); inv(); },
        onError: () => toast.error('Kunne ikke lÃ¸se rapporten.'),
    });
    const dismissMut = useMutation({
        mutationFn: () => updateJobReportStatus(reportId!, 'dismissed', dismissNote),
        onSuccess: () => { toast.success('Rapport avvist.'); setShowDismiss(false); setDismissNote(''); inv(); },
        onError: () => toast.error('Kunne ikke avvise rapporten.'),
    });
    const reopenMut = useMutation({
        mutationFn: () => updateJobReportStatus(reportId!, 'under_review'),
        onSuccess: () => { toast.success('Rapport gjenÃ¥pnet.'); inv(); },
        onError: () => toast.error('Kunne ikke gjenÃ¥pne rapporten.'),
    });

    if (isLoading) return <div className="space-y-4"><AdminLoadingSkeleton rows={4} /><AdminLoadingSkeleton rows={6} /></div>;
    if (isError || !report) return <AdminErrorState onRetry={refetch} title="Rapport ikke funnet" />;

    const service = report.serviceId;
    const isClosed = ['resolved', 'dismissed'].includes(report.status);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Link to="/dashboard/job-reports" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft size={16} /> Tilbake til rapporter
                </Link>
            </div>

            <AdminPageHeader
                title={`Rapport: ${service?.title ?? 'Slettet annonse'}`}
                description={report.reportType.replace(/_/g, ' ')}
                actions={
                    service ? (
                        <Link
                            to={`/job-listing/${service._id}`}
                            target="_blank"
                            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-md transition-colors"
                        >
                            <Briefcase size={15} /> Se annonse
                        </Link>
                    ) : undefined
                }
            />

            <div className="flex flex-wrap gap-3 bg-card rounded-lg border border-border p-4 items-center">
                <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Status:</span><AdminStatusBadge status={report.status} /></div>
                {report.assignedAdminId && (
                    <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">Tildelt:</span>
                        <span className="text-xs text-foreground">{report.assignedAdminId.name}</span>
                    </div>
                )}
                <div className="flex-1" />
                {!report.assignedAdminId && !isClosed && (
                    <button
                        onClick={() => assignMut.mutate()}
                        disabled={assignMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors disabled:opacity-50"
                    >
                        <UserCheck size={14} /> Ta saken
                    </button>
                )}
                {!isClosed ? (
                    <>
                        <button
                            onClick={() => setShowDismiss(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                        >
                            <XCircle size={14} /> Avvis
                        </button>
                        <button
                            onClick={() => setShowResolve(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md transition-colors"
                        >
                            <CheckCircle2 size={14} /> LÃ¸s
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => reopenMut.mutate()}
                        disabled={reopenMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
                    >
                        <RotateCcw size={14} /> GjenÃ¥pne
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <Section title="Rapportdetaljer">
                        <Row label="Rapport-ID" value={<span className="font-mono text-xs">{report._id}</span>} />
                        <Row label="Type" value={report.reportType.replace(/_/g, ' ')} />
                        <Row label="Beskrivelse" value={<span className="text-xs leading-relaxed">{report.description}</span>} />
                        <Row label="Opprettet" value={new Date(report.createdAt).toLocaleString('nb-NO')} />
                        <Row label="Sist oppdatert" value={new Date(report.updatedAt).toLocaleString('nb-NO')} />
                        {report.resolvedAt && <Row label="LÃ¸st dato" value={new Date(report.resolvedAt).toLocaleString('nb-NO')} />}
                        {report.resolutionNote && <Row label="LÃ¸sningsnotat" value={<span className="text-xs leading-relaxed">{report.resolutionNote}</span>} />}
                        {report.resolvedBy && <Row label="LÃ¸st av" value={report.resolvedBy.name} />}
                    </Section>

                    <Section title="Annonseinformasjon">
                        {service ? (
                            <>
                                <Row label="Tittel" value={service.title} />
                                {service.price != null && <Row label="Pris" value={`${service.price.toLocaleString('nb-NO')} kr`} />}
                                <Row label="Status" badge={service.status} />
                                <Row label="Opprettet" value={new Date(service.createdAt ?? report.createdAt).toLocaleDateString('nb-NO')} />
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground">Annonsen er slettet.</p>
                        )}
                    </Section>
                </div>

                <div className="space-y-4">
                    <Section title="Rapportert av">
                        {report.reportedBy ? (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">{report.reportedBy.name}</p>
                                <p className="text-xs text-muted-foreground">{report.reportedBy.email}</p>
                                <div className="flex items-center gap-2">
                                    <AdminStatusBadge status={report.reportedBy.role ?? 'user'} />
                                    <AdminStatusBadge status={report.reportedBy.accountStatus ?? 'active'} />
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">Bruker slettet</p>
                        )}
                    </Section>

                    <Section title="Rapportert bruker">
                        {report.reportedUser ? (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground">{report.reportedUser.name}</p>
                                <p className="text-xs text-muted-foreground">{report.reportedUser.email}</p>
                                <div className="flex items-center gap-2">
                                    <AdminStatusBadge status={report.reportedUser.role ?? 'user'} />
                                    <AdminStatusBadge status={report.reportedUser.accountStatus ?? 'active'} />
                                </div>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">Bruker slettet</p>
                        )}
                    </Section>
                </div>
            </div>

            <AdminConfirmDialog
                title="LÃ¸s rapporten?"
                description="Marker denne rapporten som lÃ¸st. Du kan legge til et notat for journalfÃ¸ring."
                confirmText="Ja, lÃ¸s"
                cancelText="Avbryt"
                variant="default"
                isOpen={showResolve}
                onOpenChange={setShowResolve}
                onConfirm={() => resolveMut.mutate()}
            >
                <textarea
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    placeholder="Notat (valgfritt)"
                    rows={3}
                    className="mt-3 w-full px-4 py-3 border border-border rounded-md text-sm text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-transparent resize-none transition-all"
                />
            </AdminConfirmDialog>

            <AdminConfirmDialog
                title="Avvis rapporten?"
                description="Marker denne rapporten som avvist. Du kan legge til et notat for journalfÃ¸ring."
                confirmText="Ja, avvis"
                cancelText="Avbryt"
                variant="destructive"
                isOpen={showDismiss}
                onOpenChange={setShowDismiss}
                onConfirm={() => dismissMut.mutate()}
            >
                <textarea
                    value={dismissNote}
                    onChange={(e) => setDismissNote(e.target.value)}
                    placeholder="Notat (valgfritt)"
                    rows={3}
                    className="mt-3 w-full px-4 py-3 border border-border rounded-md text-sm text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none transition-all"
                />
            </AdminConfirmDialog>
        </div>
    );
}
