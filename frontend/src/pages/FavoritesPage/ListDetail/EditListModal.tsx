import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useUpdateFavoriteList } from "../../../features/favoriteLists/hooks";

interface EditListModalProps {
  list: any;
  isOpen: boolean;
  onClose: () => void;
}

const EditListModal: React.FC<EditListModalProps> = ({ list, isOpen, onClose }) => {
  const updateListMutation = useUpdateFavoriteList();
  const [name, setName] = useState(list?.name || "");
  const [description, setDescription] = useState(list?.description || "");

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || "");
    }
  }, [list]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await updateListMutation.mutateAsync({
        listId: list._id,
        data: { name, description },
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[32px] overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative flex items-center justify-center p-6 border-b border-gray-100">
          <h2 className="text-[#0A0A0A] font-bold text-lg">
            Edit name and description
          </h2>
          <button
            onClick={onClose}
            className="absolute right-6 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="space-y-2">
            <div className="relative">
              <label className="absolute left-4 top-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                className="w-full px-4 pt-7 pb-3 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#FF8A71] outline-none transition-all font-medium"
              />
            </div>
            <p className="text-[11px] text-gray-400 ml-1">
              {name.length}/30 characters
            </p>
          </div>

          <div className="relative">
            <textarea
              placeholder="List description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#FF8A71] outline-none transition-all resize-none min-h-[120px]"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim() || updateListMutation.isPending}
            className="w-full py-4 bg-[#FF8A71] text-white font-bold rounded-2xl hover:bg-[#ff7659] disabled:opacity-50 transition-all shadow-md active:scale-[0.98] text-lg"
          >
            {updateListMutation.isPending ? "Saving..." : "Save"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditListModal;
