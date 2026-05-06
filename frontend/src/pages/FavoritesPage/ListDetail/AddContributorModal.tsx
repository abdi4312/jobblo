import React, { useState } from "react";
import { X, Search, UserPlus } from "lucide-react";
import mainLink from "../../../api/mainURLs";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

interface User {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface AddContributorModalProps {
  listId: string;
  isOpen: boolean;
  onClose: () => void;
}

const AddContributorModal: React.FC<AddContributorModalProps> = ({
  listId,
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);

  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim().length < 2) return;

    setIsSearching(true);
    try {
      const response = await mainLink.get(
        `/api/users/search?query=${encodeURIComponent(searchQuery.trim())}`,
      );
      setSearchResults(response.data);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleUserSelection = (user: User) => {
    setSelectedUsers((prev) => {
      const isAlreadySelected = prev.some((u) => u._id === user._id);
      if (isAlreadySelected) {
        return prev.filter((u) => u._id !== user._id);
      } else {
        if (prev.length >= 10) {
          toast.error("Du kan velge opptil 10 brukere om gangen");
          return prev;
        }
        return [...prev, user];
      }
    });
  };

  const handleAddContributors = async () => {
    if (selectedUsers.length === 0) return;

    try {
      const userIds = selectedUsers.map((u) => u._id);
      await mainLink.post(`/api/lists/${listId}/contributors`, { userIds });

      queryClient.invalidateQueries({
        queryKey: ["favoriteLists", "user", listId],
      });
      toast.success(`${selectedUsers.length} bidragsytere lagt til`);

      onClose();
      // Reset state
      setSearchQuery("");
      setSearchResults([]);
      setSelectedUsers([]);
    } catch {
      toast.error("Kunne ikke legge til bidragsytere");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center p-6 border-b border-gray-100">
          <h2 className="text-custom-black font-bold text-lg">
            Legg til bidragsyter
          </h2>
          <button
            onClick={onClose}
            className="absolute right-6 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 min-h-[500px] flex flex-col">
          {/* Search Bar Row */}
          <form onSubmit={handleSearch} className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                size={20}
              />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Søk..."
                className="w-full pl-12 pr-4 py-3.5 bg-gray-100/80 rounded-[20px] border-none outline-none text-gray-700 placeholder-gray-400 font-medium"
              />
            </div>
            <button
              type="submit"
              className="px-8 py-3.5 bg-custom-green text-white font-bold rounded-[20px] hover:bg-custom-green transition-all"
            >
              Søk
            </button>
          </form>

          {/* User List Section */}
          <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
            {isSearching ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin w-8 h-8 border-4 border-gray-100 border-t-[#2F7E47] rounded-full" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => {
                const isSelected = selectedUsers.some(
                  (u) => u._id === user._id,
                );
                return (
                  <button
                    key={user._id}
                    onClick={() => toggleUserSelection(user)}
                    className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            className="w-full h-full object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-custom-green bg-[#2F7E4711]">
                            <UserPlus size={24} />
                          </div>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-custom-black text-lg leading-tight">
                          {user.name} {user.lastName}
                        </p>
                        <p className="text-sm text-gray-400 font-medium">
                          {user.name[0]}
                          {user.lastName ? user.lastName[0] : ""}
                        </p>
                      </div>
                    </div>

                    {/* Selection Circle */}
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "border-[#2F7E47] bg-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-custom-green" />
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              searchQuery.length >= 2 &&
              !isSearching && (
                <p className="text-center py-10 text-gray-400">
                  Ingen brukere funnet
                </p>
              )
            )}
          </div>

          {/* Bottom Action Button */}
          <button
            onClick={handleAddContributors}
            disabled={selectedUsers.length === 0}
            className="w-full py-4.5 bg-custom-green text-white font-bold rounded-[22px] hover:bg-custom-green disabled:bg-custom-green/40 disabled:text-gray-500 transition-all shadow-md active:scale-[0.98] text-lg mt-4"
          >
            Legg til bidragsyter{" "}
            {selectedUsers.length > 0 && `(${selectedUsers.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddContributorModal;
