import React, { useState, useRef } from 'react';
import { X, Loader2, AlertTriangle, Upload, File } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import mainLink from '../../../api/mainURLs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../../Ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../Ui/select';
import { Input } from '../../Ui/Input';
import { Textarea } from '../../Ui/textarea';
import { Button } from '../../Ui/Button';
import { Checkbox } from '../../Ui/checkbox';

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
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const submitMutation = useMutation({
        mutationFn: async (payload: {
            scope: string; messageId?: string; reportType: string; title: string; description: string; evidence?: Array<{ fileUrl: string; fileType: string }>;
        }) => {
            const res = await mainLink.post(`/api/chats/${chatId}/reports`, payload);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Rapport sendt inn. Admin vil gjennomgå den snart.');
            handleClose();
        },
        onError: (err: { response?: { data?: { message?: string } } }) => {
            toast.error(err?.response?.data?.message ?? 'Kunne ikke sende rapport.');
        },
    });

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
            setIsUploading(true);
            try {
                const formData = new FormData();
                for (const ef of evidenceFiles) {
                    formData.append('files', ef.file);
                }
                const uploadRes = await mainLink.post(`/api/chats/${chatId}/reports/evidence`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                evidence = (uploadRes.data.files || []).map((f: { fileUrl: string; fileType: string }) => ({
                    fileUrl: f.fileUrl,
                    fileType: f.fileType,
                }));
            } catch {
                toast.error('Kunne ikke laste opp vedlegg.');
                setIsUploading(false);
                return;
            }
            setIsUploading(false);
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
                <DialogHeader className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-orange-500" />
                        <DialogTitle className="text-lg font-bold text-gray-900">
                            {scope === 'message' ? 'Rapporter melding' : 'Rapporter chat'}
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Rapporttype *</label>
                        <Select value={reportType} onValueChange={setReportType}>
                            <SelectTrigger className="w-full bg-white border-gray-200 rounded-xl">
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kort tittel *</label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={200}
                            className="rounded-xl border-gray-200"
                            placeholder="Beskriv problemet kort..."
                        />
                        <p className="text-[10px] text-gray-300 mt-1">{title.length}/200</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Beskrivelse *</label>
                        <Textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={2000}
                            className="rounded-xl border-gray-200 resize-none"
                            placeholder="Gi en detaljert beskrivelse av problemet..."
                        />
                        <p className="text-[10px] text-gray-300 mt-1">{description.length}/2000</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vedlegg (valgfritt)</label>
                        <input ref={fileInputRef} type="file" multiple accept="image/*,application/pdf"
                            onChange={handleFileSelect} className="hidden" />
                        <button type="button" onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-gray-500 border border-dashed border-gray-300 rounded-xl hover:border-gray-400 hover:text-gray-700 transition-colors">
                            <Upload size={14} /> Last opp skjermbilder eller PDF (maks 5 filer)
                        </button>
                        {evidenceFiles.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                                {evidenceFiles.map((ef, i) => (
                                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 rounded-lg text-xs">
                                        {ef.preview ? (
                                            <img src={ef.preview} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                                        ) : (
                                            <File size={14} className="text-gray-400 shrink-0" />
                                        )}
                                        <span className="truncate flex-1 text-gray-600">{ef.file.name}</span>
                                        <button onClick={() => removeFile(i)} className="p-0.5 hover:bg-gray-200 rounded">
                                            <X size={12} className="text-gray-400" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer">
                        <Checkbox checked={confirmed} onCheckedChange={(c) => setConfirmed(c === true)}
                            className="mt-0.5" />
                        <span className="text-xs text-gray-500">
                            Jeg bekrefter at informasjonen er nøyaktig og at denne rapporten sendes i god tro.
                        </span>
                    </label>
                </div>

                <DialogFooter className="p-5 border-t border-gray-100 flex flex-row justify-end gap-2">
                    <Button variant="outline" onClick={handleClose}
                        className="rounded-xl text-gray-600 border-gray-200">
                        Avbryt
                    </Button>
                    <Button onClick={handleSubmit} disabled={!canSubmit}
                        className="rounded-xl bg-[#2d4a3e] hover:bg-[#233b31] text-white disabled:opacity-50">
                        {(isUploading || submitMutation.isPending) && <Loader2 size={14} className="animate-spin" />}
                        {isUploading ? 'Laster opp...' : submitMutation.isPending ? 'Sender...' : 'Send rapport'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
