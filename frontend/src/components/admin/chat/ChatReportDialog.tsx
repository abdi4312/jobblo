import React, { useState, useRef } from 'react';
import { X, Loader2, AlertTriangle, Upload, File } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { postChatReport, uploadChatReportEvidence } from '../../../api/admin/chats';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../developer/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../developer/ui/select';
import { Input } from '../../developer/ui/input';
import { Textarea } from '../../developer/ui/textarea';
import { Button } from '../../developer/ui/button';
import { Checkbox } from '../../developer/ui/checkbox';

const REPORT_TYPES = [
    { label: 'Trakassering', value: 'harassment' },
    { label: 'Fornærmende språk', value: 'abusive_language' },
    { label: 'Trusler', value: 'threats' },
    { label: 'Spam', value: 'spam' },
    { label: 'Svindel eller bedrageri', value: 'scam_or_fraud' },
    { label: 'Betalingsproblem', value: 'payment_issue' },
    { label: 'SafePay-problem', value: 'safepay_issue' },
    { label: 'Arbeid ikke fullført', value: 'work_not_completed' },
    { label: 'Dårlig kvalitet', value: 'poor_quality' },
    { label: 'Avviker fra avtale', value: 'different_from_agreement' },
    { label: 'Upassende innhold', value: 'inappropriate_content' },
    { label: 'Falsk profil', value: 'fake_profile' },
    { label: 'Identitetsproblem', value: 'identity_issue' },
    { label: 'Mistenkelig lenke', value: 'suspicious_link' },
    { label: 'Personvernbrudd', value: 'privacy_violation' },
    { label: 'Betalingsforespørsel utenfor plattformen', value: 'off_platform_payment_request' },
    { label: 'Annet', value: 'other' },
];

interface EvidenceFile {
    file: File;
    preview?: string;
    uploading: boolean;
    url?: string;
    fileType: string;
}

interface ChatReportDialogProps {
    chatId: string;
    open: boolean;
    onClose: () => void;
    scope?: 'chat' | 'message';
    messageId?: string;
}

export function ChatReportDialog({ chatId, open, onClose, scope = 'chat', messageId }: ChatReportDialogProps) {
    const [reportType, setReportType] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const submitMutation = useMutation({
        mutationFn: (payload: Parameters<typeof postChatReport>[1]) => postChatReport(chatId, payload),
        onSuccess: () => {
            toast.success('Rapport sendt inn. Admin vil gjennomgå den snart.');
            handleClose();
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            toast.error(err?.response?.data?.message ?? 'Kunne ikke sende rapport.');
        },
    });

    const uploadMutation = useMutation({
        mutationFn: (formData: FormData) => uploadChatReportEvidence(chatId, formData),
    });
    const isUploading = uploadMutation.isPending;

    const handleClose = () => {
        setReportType('');
        setTitle('');
        setDescription('');
        setConfirmed(false);
        setEvidenceFiles([]);
        onClose();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const newFiles: EvidenceFile[] = files.map((f) => ({
            file: f,
            uploading: false,
            fileType: f.type,
            preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
        }));
        setEvidenceFiles((prev) => [...prev, ...newFiles].slice(0, 5));
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeFile = (idx: number) => {
        setEvidenceFiles((prev) => {
            const f = prev[idx];
            if (f?.preview) URL.revokeObjectURL(f.preview);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleSubmit = async () => {
        if (!reportType || !title.trim() || !description.trim() || !confirmed) return;

        let evidence: Array<{ fileUrl: string; fileType: string }> = [];

        if (evidenceFiles.length > 0) {
            try {
                const formData = new FormData();
                for (const ef of evidenceFiles) {
                    formData.append('files', ef.file);
                }
                const uploadRes = await uploadMutation.mutateAsync(formData);
                evidence = (uploadRes.files || []).map((f: { fileUrl: string; fileType: string }) => ({
                    fileUrl: f.fileUrl,
                    fileType: f.fileType,
                }));
            } catch {
                toast.error('Kunne ikke laste opp vedlegg.');
                return;
            }
        }

        submitMutation.mutate({
            scope,
            ...(scope === 'message' && messageId ? { messageId } : {}),
            reportType,
            title: title.trim(),
            description: description.trim(),
            ...(evidence.length > 0 && { evidence }),
        });
    };

    const canSubmit = reportType && title.trim() && description.trim() && confirmed && !submitMutation.isPending && !isUploading;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
            <DialogContent className="sm:max-w-md p-0 gap-0">
                <DialogHeader className="p-5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-orange-500" />
                        <DialogTitle className="text-lg font-bold text-foreground">
                            {scope === 'message' ? 'Rapporter melding' : 'Rapporter chat'}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Rapporttype *</label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger className="w-full bg-card border-border rounded-md">
                                <SelectValue placeholder="Velg type..." />
                            </SelectTrigger>
                            <SelectContent>
                                {REPORT_TYPES.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Kort tittel *</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={200}
                            className="rounded-md border-border"
                            placeholder="Beskriv problemet kort..."
                        />
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{title.length}/200</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Beskrivelse *</label>
                        <Textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={2000}
                            className="rounded-md border-border resize-none"
                            placeholder="Gi en detaljert beskrivelse av problemet..."
                        />
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{description.length}/2000</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Vedlegg (valgfritt)</label>
                        <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf"
                            onChange={handleFileSelect} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-muted-foreground border border-dashed border-border rounded-md hover:border-ring hover:text-foreground transition-colors">
                            <Upload size={14} /> Last opp skjermbilder eller PDF (maks 5 filer)
                        </button>
                        {evidenceFiles.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                {evidenceFiles.map((ef, i) => (
                                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-muted/50 rounded-lg text-xs">
                                        {ef.preview ? (
                                            <img src={ef.preview} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                                        ) : (
                                            <File size={14} className="text-muted-foreground shrink-0" />
                                        )}
                                        <span className="truncate flex-1 text-muted-foreground">{ef.file.name}</span>
                                        <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-accent rounded">
                                            <X size={12} className="text-muted-foreground" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer">
                        <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)}
                            className="mt-0.5" />
                        <span className="text-xs text-muted-foreground">
                            Jeg bekrefter at informasjonen er nøyaktig og at denne rapporten sendes i god tro.
                        </span>
                    </label>
                </div>

                <DialogFooter className="p-5 border-t border-border flex flex-row justify-end gap-2">
                    <Button variant="outline" onClick={handleClose}
                        className="rounded-md text-muted-foreground border-border">
                        Avbryt
                    </Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit}
                        className="rounded-md bg-primary hover:bg-primary/90 text-white disabled:opacity-50">
                        {(isUploading || submitMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                        {isUploading ? 'Laster opp...' : submitMutation.isPending ? 'Sender...' : 'Send rapport'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
