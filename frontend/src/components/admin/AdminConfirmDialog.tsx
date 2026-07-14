import * as React from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '../Ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminConfirmDialogProps {
    trigger?: React.ReactNode;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => void | Promise<void>;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AdminConfirmDialog({
    trigger,
    title,
    description,
    confirmText = 'Bekreft',
    cancelText = 'Avbryt',
    variant = 'default',
    onConfirm,
    isOpen: controlledOpen,
    onOpenChange: controlledOnOpenChange,
}: AdminConfirmDialogProps) {
    const [internalOpen, setInternalOpen] = React.useState(false);
    const [loading, setLoading] = React.useState(false);

    const isOpen = controlledOpen ?? internalOpen;
    const setIsOpen = controlledOnOpenChange ?? setInternalOpen;

    const handleConfirm = async () => {
        try {
            setLoading(true);
            await onConfirm();
            setIsOpen(false);
        } catch {
            // error handled by caller (mutation onError)
        } finally {
            setLoading(false);
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>{description}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        disabled={loading}
                        className={cn(
                            variant === 'destructive'
                                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                                : 'bg-[#2d4a3e] hover:bg-[#233b31]'
                        )}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 size={14} className="animate-spin" />
                                Venter...
                            </span>
                        ) : (
                            confirmText
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
