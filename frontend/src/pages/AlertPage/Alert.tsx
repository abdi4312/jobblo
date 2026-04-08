import { useState } from "react";
import { useUserStore } from "../../stores/userStore";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { nb } from "date-fns/locale";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Clock4,
  Info,
  MessageSquare,
  RefreshCcw,
  ShoppingBag,
  Tag,
  Trash2,
} from "lucide-react";
import { useNotifications } from "../../features/notifications/hooks";
import { NotificationSkeleton } from "../../components/Loading/NotificationSkeleton";
import { useNavigate } from "react-router-dom";

interface Alert {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  } | null;
  senderId?: {
    _id: string;
    name: string;
    lastName?: string;
    avatarUrl?: string;
  } | null;
  type: string;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

const formatNotificationTime = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Ujent dato";
    const timeAgo = formatDistanceToNow(date, { addSuffix: true, locale: nb });
    let datePart = "";
    if (isToday(date)) {
      datePart = "i dag";
    } else if (isYesterday(date)) {
      datePart = "i går";
    } else {
      datePart = format(date, "d. MMM", { locale: nb });
    }
    const exactTime = format(date, "HH:mm");
    return `${timeAgo} • ${datePart} kl. ${exactTime}`;
  } catch (error) {
    console.log(error);
    return "Akkurat nå";
  }
};

export default function Alert() {
  const [activeTab, setActiveTab] = useState("Alle");
  const user = useUserStore((state) => state.user);
  const userId = user?._id;
  const navigate = useNavigate();

  // --- TanStack Query Logic ---
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: queryLoading,
  } = useNotifications(userId);

  // TanStack ke pages ko single array mein convert karna
  const alerts: Alert[] = data?.pages.flatMap((page) => page.data) || [];

  const tabs = [
    { id: "Alle", label: "Alle" },
    { id: "Uleste", label: "Uleste" },
  ];

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

  const nyheter = alerts.filter((alert) => !alert.read);
  const lagrede = alerts.filter((alert) => alert.read);

  const renderAlerts = (dataList: Alert[]) => {
    return (
      <div className="bg-[#FFFFFF1A] shadow p-2 md:p-6 rounded-xl">
        {dataList.map((alert) => {
          const config =
            notificationConfig[alert.type as keyof typeof notificationConfig] ||
            notificationConfig.general;

          const handleNotificationClick = () => {
            if (alert.type === "follow" && alert.senderId?._id) {
              navigate(`/profile/${alert.senderId._id}`);
            } else if (alert.type === "favorite" && alert.senderId?._id) {
              navigate(`/profile/${alert.senderId._id}`);
            }
          };

          return (
            <div
              key={alert._id}
              onClick={handleNotificationClick}
              className={`bg-white border border-gray-100 rounded-2xl p-4 shadow-sm mx-auto my-2 transition-all ${
                alert.type === "follow" || alert.type === "favorite"
                  ? "cursor-pointer hover:bg-gray-50"
                  : ""
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                  <div
                    className={`w-14 h-14 ${config.bg || "bg-gray-100"} rounded-full flex items-center justify-center ${config.color || "text-gray-500"} shrink-0 overflow-hidden border border-gray-100`}
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
                <div className="flex-1 flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between sm:justify-start">
                      <h2 className="text-[18px] font-bold text-[#0A0A0A]">
                        {config.title}
                      </h2>
                      <div className="flex gap-3 sm:hidden text-gray-400">
                        <Check
                          size={18}
                          className="text-green-600 cursor-pointer"
                        />
                        <Trash2
                          size={18}
                          className="text-red-500 cursor-pointer"
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
                  <div className="flex flex-col justify-between items-end min-w-[120px]">
                    <div className="hidden sm:flex gap-4 items-center">
                      <Check
                        size={20}
                        className="text-green-600 cursor-pointer hover:opacity-70 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Trash2
                        size={20}
                        className="text-red-500 cursor-pointer hover:opacity-70 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <button
                      className="bg-[#3F8F6B] text-white text-[14px] font-semibold px-6 py-2.5 rounded-2xl hover:bg-[#367a5b] transition-all self-end mt-4 sm:mt-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          (alert.type === "follow" ||
                            alert.type === "favorite") &&
                          alert.senderId?._id
                        ) {
                          navigate(`/profile/${alert.senderId._id}`);
                        }
                      }}
                    >
                      {alert.type === "follow" || alert.type === "favorite"
                        ? "Se profil"
                        : "Se søknad"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-300 mx-auto">
      <div>
        <div className="flex justify-between items-center">
          <h1 className="text-[#101828] text-[40px] font-bold">Varsler</h1>
          <p className="flex text-[16px] text-[#2F7E47] font-normal cursor-pointer">
            <span>
              <CheckCheck size={20} />
            </span>{" "}
            Mark alle som lest
          </p>
        </div>

        <div className={`flex w-fit gap-6 my-8`}>
          {tabs.map((tab) => (
            <p
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-[16px] font-medium text-[#212121] py-1.5 px-3 rounded-[14px] shadow-sm cursor-pointer ${activeTab === tab.id ? "bg-[#2F7E4740]" : "bg-[#ffff]"}`}
            >
              {tab.label}
            </p>
          ))}
        </div>

        {/* Updated Loading Condition */}
        {queryLoading ? (
          <NotificationSkeleton />
        ) : (
          <div>
            {activeTab === "Alle" ? (
              nyheter.length === 0 ? (
                <p>Ingen nyheter ennå</p>
              ) : (
                renderAlerts(nyheter)
              )
            ) : lagrede.length === 0 ? (
              <p>Ingen lagrede varsler</p>
            ) : (
              renderAlerts(lagrede)
            )}

            {/* LOAD MORE BUTTON logic updated for TanStack */}
            {hasNextPage && (
              <div className="flex justify-center w-full mt-6 mb-10">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-fit px-8 py-3 bg-transparent border border-[#2F7E47] text-[#2F7E47] rounded-lg cursor-pointer font-bold hover:bg-[#2F7E47] hover:text-white transition-all shadow-sm"
                >
                  {isFetchingNextPage ? "Laster..." : "Se mer"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
