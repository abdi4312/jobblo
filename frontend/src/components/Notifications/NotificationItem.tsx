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
  Shield,
  ShieldOff,
} from "lucide-react";
import type { AlertType } from "../../features/notifications/types";
import { dateFormatter } from "../../utils/dateFormatter";
import { timeFormatter } from "../../utils/timeFormatter";
import { Button } from "../../components/Ui/button/Button";
import { useUpdateJobRequestStatusMutation } from "../../features/jobDetail/hook";

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
  const updateStatusMutation = useUpdateJobRequestStatusMutation();

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
  const isRequestNotification = alert.type === "order" && alert.requestId;

  // Check if request is already handled
  const requestStatus =
    typeof alert.requestId === "object" && alert.requestId !== null
      ? (alert.requestId as any).status
      : "pending";

  const isHandled = requestStatus !== "pending";

  const handleStatusUpdate = async (status: string) => {
    if (!alert.requestId) return;
    const requestId =
      typeof alert.requestId === "string"
        ? alert.requestId
        : alert.requestId._id;

    try {
      await updateStatusMutation.mutateAsync({
        requestId,
        status,
      });
      toast.success(status === "accepted" ? "Godkjent!" : "Avvist");
      onMarkAsRead(alert._id);

      // Auto-navigation removed as per user request
      // if (status === "accepted" && res.conversationId) {
      //   onNavigate(`/messages/${res.conversationId}`);
      // }
    } catch (error) {
      toast.error("Kunne ikke oppdatere status");
    }
  };

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
              <h2 className="text-[18px] font-bold text-custom-black">
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

            <p className="text-[16px] font-medium text-custom-black leading-6">
              {alert.content}
            </p>

            <div className="inline-block">
              <span className="bg-[#2F7E471A] text-custom-green text-[14px] font-medium px-4 py-1 rounded-full">
                {alert.type}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[#6A7282] font-normal text-[14px] pt-1">
              <Clock4 size={14} />
              <span>{formatNotificationTime(alert.createdAt)}</span>
            </div>
          </div>

          {/* Desktop Actions & Button */}
          <div className="flex flex-col justify-between items-end min-w-30 gap-4">
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

            {isRequestNotification ? (
              <div className="flex gap-2">
                {isHandled ? (
                  <span
                    className={`text-[14px] font-bold px-4 py-1.5 rounded-full ${
                      requestStatus === "accepted"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {requestStatus === "accepted" ? "Godkjent" : "Avvist"}
                  </span>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate("declined");
                      }}
                      disabled={updateStatusMutation.isPending}
                    >
                      Avvis
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-custom-green hover:bg-custom-green/90 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusUpdate("accepted");
                      }}
                      disabled={updateStatusMutation.isPending}
                    >
                      Godkjenn
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="default"
                onClick={(e) => {
                  e.stopPropagation();
                  if (alert.requestId) {
                    const reqId = alert.requestId as any;
                    if (reqId.serviceId) {
                      const serviceId = typeof reqId.serviceId === 'object' ? reqId.serviceId._id : reqId.serviceId;
                      onNavigate(`/job-applicants/${serviceId}`);
                    }
                  } else if (isClickable && alert.senderId?._id) {
                    onNavigate(`/profile/${alert.senderId._id}`);
                  }
                }}
              >
                {isClickable ? "Se profil" : alert.requestId ? "Se søknad" : "Se varsel"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
