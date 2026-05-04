import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import { useChatQueries } from "../../features/chat/hook";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { Trash2, EyeOff, Mail } from "lucide-react";
import { toast } from "react-hot-toast";

/**
 * Mobile-friendly messages page that displays a list of active conversations
 */
export function MessagesPage() {
  const { user } = useUserStore();
  const userId = user?._id;
  const navigate = useNavigate();

  // Fetch all chats using TanStack Query
  const { chatsQuery } = useChatQueries();
  const chats = chatsQuery.data || [];

  const handleDeleteChat = async (chatId: string) => {
    if (window.confirm("Er du sikker på at du vil slette denne samtalen for alle?")) {
      // Logic for deleting chat would go here
      toast.success("Samtale slettet");
    }
  };

  const handleHideChat = async (chatId: string) => {
    // Logic for hiding chat would go here
    toast.success("Samtale skjult");
  };

  return (
    <div className="max-w-300 mx-auto px-4 md:px-0 pb-20">
      <ProfileTitleWrapper title="Mine Meldinger" buttonText="Tilbake" />
      
      <div className="mt-8 space-y-4">
        {chatsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-[#2F7E47] rounded-full animate-spin mb-4" />
            <p className="font-medium">Laster meldinger...</p>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-gray-200">
            <div className="bg-gray-50 p-6 rounded-full mb-4">
              <Mail size={48} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium text-lg">Du har ingen meldinger ennå.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {chats.map((chat) => {
              const otherUser = chat.clientId?._id === userId ? chat.providerId : chat.clientId;
              
              return (
                <div 
                  key={chat._id} 
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <Link to={`/messages/${chat._id}`} className="flex-1 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-xl overflow-hidden border border-gray-50">
                      {otherUser?.avatarUrl ? (
                        <img src={otherUser.avatarUrl} alt={otherUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{otherUser?.name?.charAt(0) || "U"}</span>
                      )}
                    </div>
                    
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg truncate">{otherUser?.name || "Bruker"}</h3>
                      <p className="text-gray-500 text-sm truncate max-w-[200px] sm:max-w-md">
                        {chat.lastMessage || "Ingen meldinger ennå"}
                      </p>
                      {chat.serviceId && (
                        <span className="inline-block mt-1 text-[12px] font-bold text-[#2F7E47] bg-[#2F7E4710] px-2 py-0.5 rounded-md">
                          {chat.serviceId.title}
                        </span>
                      )}
                    </div>
                  </Link>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.preventDefault(); handleHideChat(chat._id); }}
                      className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-all"
                      title="Skjul"
                    >
                      <EyeOff size={20} />
                    </button>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleDeleteChat(chat._id); }}
                      className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      title="Slett"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
