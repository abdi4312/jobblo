interface BlockModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  type: 'block' | 'unblock';
}

export function BlockModal({
  user,
  isOpen,
  onClose,
  onConfirm,
  isPending,
  type
}: BlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-[420px] relative z-10 overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <div className="p-10 flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-gray-50 shadow-sm bg-gray-100">
              <img
                src={user?.avatarUrl || "https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332"}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            {type === 'block' && (
              <div className="absolute bottom-0 right-0 bg-[#262626] w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                <div className="w-5 h-[2px] bg-white rotate-[45deg] relative">
                  <div className="absolute inset-0 border-2 border-white rounded-full scale-[2.5]" />
                </div>
              </div>
            )}
          </div>

          <h3 className="text-[22px] font-bold text-gray-900 leading-tight mb-4 px-4">
            Are you sure you want to {type} this user?
          </h3>

          <p className="text-[14px] text-gray-500 font-medium leading-relaxed mb-10 px-2">
            {type === 'block' 
              ? "This user will not be able to see or contact you on Jobblo. Remember that users that are not logged in will still be able to find your profile through our web page. (The user will not be notified)"
              : "This user will be able to see and contact you on Jobblo. (The user will not be notified)"
            }
          </p>

          <div className="grid grid-cols-2 w-full border-t border-gray-100 mt-2">
            <button
              onClick={onClose}
              className="py-5 text-[17px] font-bold text-black hover:bg-gray-50 transition-colors border-r border-gray-100"
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              onClick={onConfirm}
              className={`py-5 text-[17px] font-bold ${type === 'block' ? 'text-[#FF6B6B]' : 'text-[#FF6B6B]'} hover:bg-gray-50 transition-all disabled:opacity-50`}
            >
              {isPending ? '...' : (type === 'block' ? 'Block' : 'Unblock')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
