import React from "react";
import { Clock, Bell } from "lucide-react";

interface NotificationHistoryProps {
  history: any[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  notificationTypes: any[];
}

const NotificationHistory: React.FC<NotificationHistoryProps> = ({
  history,
  loading,
  page,
  totalPages,
  onPageChange,
  notificationTypes,
}) => {
  return (
    <div className="mt-12">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-gray-400" />
        <h3 className="text-lg font-bold text-gray-700">Broadcast History</h3>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Laster historikk...</p>
      ) : history.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Ingen historikk funnet.</p>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <div key={item._id} className="bg-white p-5 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm hover:border-gray-200 transition-colors">
              <div className="flex gap-4 items-center">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${notificationTypes.find(x => x.id === item.type)?.color || "bg-gray-100"}`}>
                  {notificationTypes.find(x => x.id === item.type)?.icon || <Bell size={16}/>}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 line-clamp-1">{item.content}</p>
                  <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-[10px] font-bold bg-green-50 px-3 py-1 rounded-full text-green-600">
                SENT
              </div>
            </div>
          ))}

          <div className="flex justify-center gap-2 mt-8">
            <button 
              disabled={page === 1}
              onClick={() => onPageChange(page - 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-30 text-xs font-bold hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="flex items-center text-xs font-bold px-4 text-gray-500">Page {page} of {totalPages}</span>
            <button 
              disabled={page === totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-4 py-2 rounded-xl border border-gray-200 disabled:opacity-30 text-xs font-bold hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationHistory;