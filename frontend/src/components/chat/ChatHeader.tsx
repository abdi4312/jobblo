import { ReceiptText } from "lucide-react";
import { useNavigate } from "react-router-dom";

function ChatHeader({
    isMobile,
    otherUser,
    activeChat,
    contract,
    setShowCreateContract
}: any) {
    const navigate = useNavigate();

    return (
        <>
            <div className="p-4 sm:px-5 flex bg-[#FFFFFFB2] justify-between items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Back button for mobile */}
                    {isMobile && (
                        <button
                            className="p-2 hover:bg-[#f5f5f5] hover:text-[#ea7e15] rounded-full transition-all shrink-0 text-[#666]"
                            onClick={() => navigate("/messages")}
                            aria-label="Tilbake til samtaler"
                        >
                            <span className="material-symbols-outlined text-[24px]">
                                arrow_back
                            </span>
                        </button>
                    )}

                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-white font-semibold text-base shrink-0 overflow-hidden">
                        {otherUser?.avatarUrl ? (
                            <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <span>{otherUser?.name?.charAt(0) || "?"}</span>
                        )}
                    </div>
                    <div className="min-w-0 flex flex-col gap-1">
                        <h3 className="m-0 text-[20px] font-semibold text-[#1a1a1a] truncate">
                            {otherUser?.name || "Chat"}
                        </h3>
                        {activeChat?.serviceId && (
                            <p className="font-normal text-[12px] text-[#6A7282] truncate">
                                Angående: {activeChat.serviceId.title || "Jobb"}
                            </p>
                        )}
                    </div>
                </div>

                {/* Send Contract Button */}
                {!contract?._id && (
                    <button
                        className="flex items-center bg-[#E08835] rounded-[10px] p-3 gap-2 text-white"
                        onClick={() => setShowCreateContract(true)}
                    >
                        <span className="">
                            <ReceiptText size={16} />
                        </span>
                        <span className="text-[14px] font-semibold">Send Contract</span>
                    </button>
                )}
            </div>
        </>
    )
}

export default ChatHeader;