import React from "react";
import {
  Check,
  CheckCheck,
  Trash2,
  Clock4,
  MessageSquare,
  ShoppingBag,
  Info,
  Tag,
  AlertTriangle,
  RefreshCcw,
  Bell,
} from "lucide-react";
import type { AlertType } from "../../features/notifications/types";
import { dateFormatter } from "../../utils/dateFormatter";
import { timeFormatter } from "../../utils/timeFormatter";

interface NotificationItemProps {
  alert: AlertType;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (path: string) => void;
}

/**
 * Formats notification timestamp into a readable relative time and exact time
 */
const formatNotificationTime = (dateString: string) => {
  try {
    const timeAgo = dateFormatter.toRelative(dateString);
    const datePart = dateFormatter.format(dateString, "d. MMM");
    const exactTime = timeFormatter.toShortTime(dateString);
    return `${timeAgo} • ${datePart} kl. ${exactTime}`;
  } catch (error) {
    console.error("Date formatting error:", error);
    return "Akkurat nå";
  }
};

/**
 * Configuration for different notification types (icons, colors, titles)
 */
const notificationConfig = {
  message: {
    title: "Ny melding",
    icon: <MessageSquare size={20} />,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  order: {
    title: "Bestilling oppdatert",
    icon: <ShoppingBag size={20} />,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  system_update: {
    title: "Systemvarsel",
    icon: <Info size={20} />,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  promotion: {
    title: "Spesialtilbud til deg",
    icon: <Tag size={20} />,
    color: "text-orange-600",
    bg: "bg-orange-100",
  },
  alert: {
    title: "Viktig varsel",
    icon: <AlertTriangle size={20} />,
    color: "text-red-600",
    bg: "bg-red-100",
  },
  system: {
    title: "App-oppdatering",
    icon: <RefreshCcw size={20} />,
    color: "text-orange-600",
    bg: "bg-orange-50",
  },
  general: {
    title: "Informasjon",
    icon: <Bell size={20} />,
    color: "text-cyan-600",
    bg: "bg-cyan-50",
  },
  follow: {
    title: "Ny følger",
    icon: <Bell size={20} />,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  favorite: {
    title: "Lagt til i liste",
    icon: <Tag size={20} />,
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
};

export const NotificationItem: React.FC<NotificationItemProps> = ({
  alert,
  onMarkAsRead,
  onDelete,
  onNavigate,
}) => {
  const config =
    notificationConfig[alert.type as keyof typeof notificationConfig] ||
    notificationConfig.general;

  const handleCardClick = () => {
    if (
      (alert.type === "follow" || alert.type === "favorite") &&
      alert.senderId?._id
    ) {
      onNavigate(`/profile/${alert.senderId._id}`);
    }
  };

  const isClickable = alert.type === "follow" || alert.type === "favorite";

  return (
    <div
      onClick={handleCardClick}
      className={`bg-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white rounded-2xl p-4 mx-auto my-2 transition-all ${
        isClickable ? "cursor-pointer hover:bg-gray-50" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Icon/Avatar Section */}
        <div className="relative shrink-0">
          <div
            className={`w-14 h-14 ${config.bg} rounded-full flex items-center justify-center ${config.color} shrink-0 overflow-hidden border border-gray-100`}
          >
            {alert.senderId?.avatarUrl ? (
              <img
                src={alert.senderId.avatarUrl}
                alt={alert.senderId.name}
                className="w-full h-full object-cover"
              />
            ) : (
              config.icon
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 flex flex-col sm:flex-row justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between sm:justify-start">
              <h2 className="text-[18px] font-bold text-[#0A0A0A]">
                {config.title}
              </h2>

              {/* Mobile Actions */}
              <div className="flex gap-3 sm:hidden text-gray-400">
                {alert.read ? (
                  <CheckCheck size={18} className="text-green-600" />
                ) : (
                  <Check
                    size={18}
                    className="cursor-pointer hover:text-green-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMarkAsRead(alert._id);
                    }}
                  />
                )}
                <Trash2
                  size={18}
                  className="text-red-500 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(alert._id);
                  }}
                />
              </div>
            </div>

            <p className="text-[16px] font-medium text-[#0A0A0A] leading-6">
              {alert.content}
            </p>

            <div className="inline-block">
              <span className="bg-[#2F7E471A] text-[#2F7E47] text-[14px] font-medium px-4 py-1 rounded-full">
                {alert.type}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[#6A7282] font-normal text-[14px] pt-1">
              <Clock4 size={14} />
              <span>{formatNotificationTime(alert.createdAt)}</span>
            </div>
          </div>

          {/* Desktop Actions & Button */}
          <div className="flex flex-col justify-between items-end min-w-[120px]">
            <div className="hidden sm:flex gap-4 items-center">
              {alert.read ? (
                <CheckCheck size={20} className="text-green-600" />
              ) : (
                <Check
                  size={20}
                  className="text-gray-400 cursor-pointer hover:text-green-600 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkAsRead(alert._id);
                  }}
                />
              )}
              <Trash2
                size={20}
                className="text-red-500 cursor-pointer hover:opacity-70 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(alert._id);
                }}
              />
            </div>

            <button
              className="bg-[#3F8F6B] text-white text-[14px] font-semibold px-6 py-2.5 rounded-2xl hover:bg-[#367a5b] transition-all self-end mt-4 sm:mt-0"
              onClick={(e) => {
                e.stopPropagation();
                if (isClickable && alert.senderId?._id) {
                  onNavigate(`/profile/${alert.senderId._id}`);
                }
              }}
            >
              {isClickable ? "Se profil" : "Se søknad"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
