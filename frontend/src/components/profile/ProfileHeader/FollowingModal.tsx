import { X, Bell } from "lucide-react";

interface FollowingModalProps {
    user: any;
    isOpen: boolean;
    onClose: () => void;
    isNotifyEnabled: boolean;
    onToggleNotify: () => void;
    onUnfollow: () => void;
    isPending: boolean;
}

export function FollowingModal({
    user,
    isOpen,
    onClose,
    isNotifyEnabled,
    onToggleNotify,
    onUnfollow,
    isPending
}: FollowingModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-[420px] relative z-10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-8">
                        <div className="w-6" />
                        <h3 className="text-[18px] font-bold text-gray-900 tracking-tight">
                            @{user?.name.toLowerCase().replace(/\s+/g, '')}
                        </h3>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X size={24} className="text-gray-500" />
                        </button>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center shrink-0 border border-gray-100">
                            <Bell size={24} className="text-gray-900" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-[16px] font-bold text-gray-900 leading-tight mb-1">Notify me</h4>
                            <p className="text-[14px] text-gray-500 font-medium leading-snug">
                                Get notification when {user?.name.toLowerCase().replace(/\s+/g, '')} posts a new job
                            </p>
                        </div>
                        <button
                            onClick={onToggleNotify}
                            className={`w-14 h-8 rounded-full transition-all duration-300 relative ${isNotifyEnabled ? 'bg-[#2F7E47]' : 'bg-gray-200'}`}
                        >
                            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all duration-300 shadow-sm ${isNotifyEnabled ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>

                    <button
                        onClick={onUnfollow}
                        disabled={isPending}
                        className="w-full py-4 rounded-2xl border-2 border-gray-200 text-[16px] font-bold text-gray-900 hover:bg-gray-50 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {isPending ? 'Unfollowing...' : `Unfollow @${user?.name.toLowerCase().replace(/\s+/g, '')}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
