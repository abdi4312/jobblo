import React from "react";
import { Send } from "lucide-react";
import Button from "../../component/button/SuperAdminCreate";

interface NotificationType {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
}

interface NotificationFormData {
  type: string;
  content: string;
}

interface NotificationFormProps {
  formData: NotificationFormData;
  setFormData: (data: NotificationFormData) => void;
  handleSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  notificationTypes: NotificationType[];
}

const NotificationForm: React.FC<NotificationFormProps> = ({
  formData,
  setFormData,
  handleSubmit,
  loading,
  notificationTypes,
}) => {
  const selectedType = notificationTypes.find((x) => x.id === formData.type);

  return (
    <div className="animate-in slide-in-from-top duration-500 bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-gray-100 mb-10">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Notification Type */}
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
                  ${
                    formData.type === t.id
                      ? "border-[#2d4a3e] bg-[#2d4a3e]/5 text-[#2d4a3e] font-bold"
                      : "border-gray-50 bg-gray-50 text-gray-400 font-medium hover:border-gray-200"
                  }`}
              >
                {t.icon}
                <span className="text-sm">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Notification Content */}
        <div className="relative">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">
            Notification Message
          </label>
          <textarea
            required
            rows={5}
            placeholder="Type your message here..."
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            className="w-full bg-gray-50 border border-gray-100 rounded-3xl p-5 text-gray-700 outline-none focus:border-[#2d4a3e] transition-all resize-none"
          />
        </div>

        {/* Live Preview */}
        <div className="bg-gray-50/50 rounded-3xl p-6 border border-dashed border-gray-200">
          <h4 className="text-[10px] font-black text-gray-400 uppercase mb-4 tracking-tighter">
            Live Preview
          </h4>
          <div className="flex gap-4 bg-white p-4 rounded-2xl shadow-sm max-w-sm border border-gray-50">
            <div
              className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${
                selectedType?.color
              }`}
            >
              {selectedType?.icon}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-800 capitalize">
                {selectedType?.label || "Type"}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2">
                {formData.content || "Your message will appear here..."}
              </p>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          isSubmitting={loading}
          disabled={!formData.content}
        >
          <Send size={20} />
          <span>Broadcast to All Users</span>
        </Button>
      </form>
    </div>
  );
};

export default NotificationForm;
