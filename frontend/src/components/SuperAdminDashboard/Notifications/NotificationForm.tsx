import React from "react";
import { Send, X, Info, AlertTriangle, Tag, Bell } from "lucide-react";

interface NotificationFormProps {
  formData: { type: string; content: string };
  setFormData: (data: any) => void;
  handleSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  notificationTypes: any[];
}

const NotificationForm: React.FC<NotificationFormProps> = ({
  formData,
  setFormData,
  handleSubmit,
  loading,
  notificationTypes,
}) => {
  return (
    <div className="animate-in slide-in-from-top duration-500 bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100 mb-10">
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-4 block">
            Select Notification Type
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {notificationTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFormData({ ...formData, type: t.id })}
                className={`flex items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all active:scale-95
                  ${formData.type === t.id 
                    ? "border-[#2d4a3e] bg-[#2d4a3e]/5 text-[#2d4a3e] font-bold" 
                    : "border-gray-50 bg-gray-50 text-gray-400 font-medium hover:border-gray-200"}`}
              >
                {t.icon}
                <span className="text-sm">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">
            Notification Message
          </label>
          <textarea
            required
            rows={5}
            placeholder="Type your message here..."
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="w-full bg-gray-50 border border-gray-100 rounded-3xl p-5 text-gray-700 outline-none focus:border-[#2d4a3e] transition-all resize-none"
          />
        </div>

        <div className="bg-gray-50/50 rounded-3xl p-6 border border-dashed border-gray-200">
          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-tighter">Live Preview</h4>
          <div className="flex gap-4 bg-white p-4 rounded-2xl shadow-sm max-w-sm border border-gray-50">
            <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${notificationTypes.find(x => x.id === formData.type)?.color}`}>
              {notificationTypes.find(x => x.id === formData.type)?.icon}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-800 capitalize">{formData.type.replace('_', ' ')}</p>
              <p className="text-xs text-gray-500 line-clamp-2">
                {formData.content || "Your message will appear here..."}
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !formData.content}
          className="w-full bg-[#2d4a3e] text-white py-5 rounded-3xl font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-[#1e332a] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
        >
          {loading ? <span className="animate-pulse">Creating Broadcast...</span> : <><Send size={20} /><span>Broadcast to All Users</span></>}
        </button>
      </form>
    </div>
  );
};

export default NotificationForm;