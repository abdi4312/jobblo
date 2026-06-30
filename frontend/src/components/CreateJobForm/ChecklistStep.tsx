import { Plus, Trash2, ArrowUp, ArrowDown, ListChecks } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ChecklistItem {
  id: string;
  text: string;
}

interface ChecklistStepProps {
  checklistItems: ChecklistItem[];
  setChecklistItems: (items: ChecklistItem[]) => void;
  currentCategory?: string;
}

export const ChecklistStep = ({
  checklistItems,
  setChecklistItems,
  currentCategory,
}: ChecklistStepProps) => {
  const [newItemText, setNewItemText] = useState('');

  // Add new item
  const addItem = () => {
    if (newItemText.trim() && checklistItems.length < 10) {
      setChecklistItems([
        ...checklistItems,
        {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          text: newItemText.trim(),
        },
      ]);
      setNewItemText('');
    }
  };

  // Update item text
  const updateItem = (id: string, newText: string) => {
    setChecklistItems(
      checklistItems.map((item) => (item.id === id ? { ...item, text: newText } : item))
    );
  };

  // Delete item
  const deleteItem = (id: string) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  // Move item up
  const moveItemUp = (index: number) => {
    if (index > 0) {
      const newItems = [...checklistItems];
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      setChecklistItems(newItems);
    }
  };

  // Move item down
  const moveItemDown = (index: number) => {
    if (index < checklistItems.length - 1) {
      const newItems = [...checklistItems];
      [newItems[index + 1], newItems[index]] = [newItems[index], newItems[index + 1]];
      setChecklistItems(newItems);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className={`box-card-custom rounded-[14px] p-4 md:p-6 border transition-colors`}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D]">
            <ListChecks size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-custom-black">
              Legg til sjekkliste
              <span className="text-gray-500 font-normal"> (valgfritt)</span>
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Opprett en dynamisk sjekkliste for jobben (1-10 elementer)
            </p>
          </div>
        </div>

        {/* Add new item */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addItem()}
            placeholder="Legg til sjekklisteelement..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#2D7A4D]"
            disabled={checklistItems.length >= 10}
          />
          <button
            onClick={addItem}
            disabled={!newItemText.trim() || checklistItems.length >= 10}
            className="px-4 py-3 bg-[#2D7A4D] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#25633a] transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        {/* Checklist items */}
        <div className="space-y-3">
          {checklistItems.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveItemUp(index)}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-[#2D7A4D] disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => moveItemDown(index)}
                  disabled={index === checklistItems.length - 1}
                  className="p-1 text-gray-400 hover:text-[#2D7A4D] disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
              </div>
              <input
                type="text"
                value={item.text}
                onChange={(e) => updateItem(item.id, e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#2D7A4D]"
              />
              <button
                onClick={() => deleteItem(item.id)}
                className="p-2 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>

        {checklistItems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            Ingen sjekklisteelementer lagt til ennå
          </div>
        )}
      </div>
    </div>
  );
};
