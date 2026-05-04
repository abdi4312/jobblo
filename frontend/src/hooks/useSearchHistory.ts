import { useState, useEffect } from "react";

export interface HistoryItem {
  id: string;
  type: "query" | "user" | "category";
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  iconName?: string;
}

export const useSearchHistory = () => {
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const history = localStorage.getItem("search_history_v2");
    if (history) {
      try {
        setSearchHistory(JSON.parse(history));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
  }, []);

  const saveToHistory = (item: HistoryItem) => {
    const newHistory = [
      item,
      ...searchHistory.filter((h) => h.id !== item.id),
    ].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem("search_history_v2", JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("search_history_v2");
  };

  return { searchHistory, saveToHistory, clearHistory, setSearchHistory };
};
