import React, { useState } from "react";
import { X, Plus, ChevronRight, Check } from "lucide-react";
import { useFavoriteLists, useCreateFavoriteList, useAddServiceToFavoriteList, useRemoveServiceFromFavoriteList } from "../../../features/favoriteLists/hooks";
import type { Jobs } from "../../../types/Jobs";

interface AddToListModalProps {
  job: Jobs;
  isOpen: boolean;
  onClose: () => void;
}

const AddToListModal: React.FC<AddToListModalProps> = ({ job, isOpen, onClose }) => {
  const { data: lists = [], isLoading } = useFavoriteLists();
  const createListMutation = useCreateFavoriteList();
  const addToListMutation = useAddServiceToFavoriteList();
  const removeFromListMutation = useRemoveServiceFromFavoriteList();

  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newListName, setNewListName] = useState("");

  if (!isOpen) return null;

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      await createListMutation.mutateAsync({ name: newListName });
      setNewListName("");
      setShowCreateNew(false);
    } catch (err) {
      console.error(err);
    }
  };

  const isJobInList = (list: any) => {
    return list.services?.some((s: any) => (typeof s === 'string' ? s === job._id : s._id === job._id));
  };

  const handleToggleList = async (list: any) => {
    if (isJobInList(list)) {
      await removeFromListMutation.mutateAsync({ listId: list._id, serviceId: job._id });
    } else {
      await addToListMutation.mutateAsync({ listId: list._id, serviceId: job._id });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-between p-6 border-b border-gray-100">
          <button
            onClick={() => setShowCreateNew(true)}
            className="text-[#0A0A0A] font-semibold text-sm hover:opacity-70 transition-opacity"
          >
            New list
          </button>
          <h2 className="absolute left-1/2 -translate-x-1/2 text-[#0A0A0A] font-bold text-lg">
            Add to list
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[200px] max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[#2F7E47] rounded-full" />
            </div>
          ) : showCreateNew ? (
            <form onSubmit={handleCreateNew} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-500 ml-1">List Name</label>
                <input
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="E.g. Summer Jobs"
                  className="w-full px-4 py-3 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#2F7E47] outline-none transition-all"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateNew(false)}
                  className="flex-1 py-3 text-gray-600 font-semibold hover:bg-gray-100 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newListName.trim() || createListMutation.isPending}
                  className="flex-1 py-3 bg-[#2F7E47] text-white font-semibold rounded-2xl hover:bg-[#235e35] disabled:opacity-50 transition-all shadow-md active:scale-95"
                >
                  {createListMutation.isPending ? "Creating..." : "Create List"}
                </button>
              </div>
            </form>
          ) : lists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <p className="text-lg font-medium">You have no lists yet</p>
              <button
                onClick={() => setShowCreateNew(true)}
                className="mt-4 flex items-center gap-2 text-[#2F7E47] font-bold hover:underline"
              >
                <Plus size={20} /> Create your first list
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {lists.map((list: any) => (
                <button
                  key={list._id}
                  onClick={() => handleToggleList(list)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-gray-200 transition-colors">
                      {list.services?.[0]?.images?.[0] ? (
                        <img src={list.services[0].images[0]} className="w-full h-full object-cover rounded-xl" alt="" />
                      ) : (
                        <Plus size={20} />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-[#0A0A0A]">{list.name}</p>
                      <p className="text-sm text-gray-500">{list.services?.length || 0} items</p>
                    </div>
                  </div>
                  {isJobInList(list) ? (
                    <div className="w-6 h-6 bg-[#2F7E47] rounded-full flex items-center justify-center text-white">
                      <Check size={14} strokeWidth={3} />
                    </div>
                  ) : (
                    <ChevronRight size={20} className="text-gray-300 group-hover:text-gray-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddToListModal;
