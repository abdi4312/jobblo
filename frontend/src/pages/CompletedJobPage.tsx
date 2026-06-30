import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  Calendar,
  FileText,
  MessageSquare,
  CreditCard,
  Download,
  Clock,
} from "lucide-react";
import mainLink from "../api/mainURLs";
import { useUserStore } from "../stores/userStore";
import { Button } from "../components/Ui/button/Button";
import SafePaySteps from "../components/SafePay/SafePaySteps";

interface TimelineItem {
  action: string;
  timestamp: string;
  userId: any;
  data?: any;
}

export default function CompletedJobPage() {
  const { orderId } = useParams<{ orderId?: string }>();
  const [searchParams] = useSearchParams();
  const serviceIdParam = searchParams.get("serviceId");
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "timeline" | "chat" | "payment" | "images" | "attachments"
  >("timeline");

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("no-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const downloadInvoice = () => {
    alert("Invoice download coming soon!");
  };

  const downloadReceipt = () => {
    alert("Receipt download coming soon!");
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (orderId) {
          // Case 1: We have an order ID
          const response = await mainLink.get(
            `/api/orders/${orderId}/completed-details`,
          );
          setData(response.data);
        } else if (serviceIdParam) {
          // Case 2: We only have a service ID
          const serviceRes = await mainLink.get(
            `/api/services/${serviceIdParam}`,
          );
          setData({
            service: serviceRes.data,
            order: null,
            customer: null,
            provider: null,
            payment: null,
            chat: null,
            transactions: [],
            timeline: [],
          });
        } else {
          navigate(-1);
        }
      } catch (err) {
        console.error("Failed to fetch completed job details:", err);
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [orderId, serviceIdParam, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Laster...</div>
      </div>
    );
  }
  if (!data) return null;

  const { service, order, customer, provider, payment, chat, timeline } = data;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full hover:bg-gray-100"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{service.title}</h1>
            <p className="text-sm text-gray-500">
              {order
                ? `Fullført ${formatDate(order.updatedAt)}`
                : "Fullført oppdrag"}
            </p>
          </div>
        </div>
      </div>

      {/* Steps (if we have an order) */}
      {order && (
        <div className="max-w-5xl mx-auto px-4 py-4">
          <SafePaySteps
            currentStep={4}
            orderId={order._id}
            serviceId={order.serviceId._id || service._id}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Job Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-6 items-start justify-between">
            {customer && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Kunde</p>
                <div className="flex items-center gap-3">
                  <img
                    src={
                      customer.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        customer.name,
                      )}&background=2f7e47&color=fff`
                    }
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.email}</p>
                  </div>
                </div>
              </div>
            )}
            {provider && (
              <div>
                <p className="text-sm text-gray-500 mb-1">Utfører</p>
                <div className="flex items-center gap-3">
                  <img
                    src={
                      provider.avatarUrl ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        provider.name,
                      )}&background=2f7e47&color=fff`
                    }
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-gray-500">{provider.email}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Total pris</p>
              <p className="text-2xl font-bold text-custom-green">
                {service.price.toLocaleString()} kr
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex gap-4 px-6">
              {[
                {
                  id: "timeline",
                  label: "Tidslinje",
                  icon: <Calendar size={16} />,
                },
                {
                  id: "chat",
                  label: "Samtale",
                  icon: <MessageSquare size={16} />,
                },
                {
                  id: "payment",
                  label: "Betaling",
                  icon: <CreditCard size={16} />,
                },
                {
                  id: "images",
                  label: "Før/Etter",
                  icon: <FileText size={16} />,
                },
                {
                  id: "attachments",
                  label: "Vedlegg",
                  icon: <FileText size={16} />,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(
                      tab.id as "timeline" | "chat" | "payment" | "images",
                    )
                  }
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-custom-green text-custom-green"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "timeline" && (
              <div className="space-y-6">
                {timeline && timeline.length > 0 ? (
                  <div className="relative border-l border-gray-200 pl-6 ml-3">
                    {timeline.map((item: TimelineItem, index: number) => (
                      <div key={index} className="mb-6 relative">
                        <div className="absolute -left-[30px] w-4 h-4 bg-custom-green rounded-full border-2 border-white shadow-sm" />
                        <div className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{item.action}</span>
                            <span className="text-xs text-gray-500">
                              {formatDate(item.timestamp)}
                            </span>
                          </div>
                          {item.data && (
                            <p className="text-sm text-gray-600">
                              {typeof item.data === "string"
                                ? item.data
                                : JSON.stringify(item.data)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock size={48} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Ingen hendelser å vise</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "chat" && (
              <div className="space-y-4">
                {chat && chat.messages && chat.messages.length > 0 ? (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {chat.messages.map((msg: any, index: number) => (
                      <div
                        key={index}
                        className={`flex ${
                          msg.senderId === user?._id
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs rounded-2xl px-4 py-2 ${
                            msg.senderId === user?._id
                              ? "bg-custom-green text-white"
                              : "bg-gray-100 text-gray-900"
                          }`}
                        >
                          <p className="text-sm">{msg.text}</p>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {msg.attachments.map(
                                (attachment: string, attIndex: number) => (
                                  <a
                                    key={attIndex}
                                    href={attachment}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                                      msg.senderId === user?._id
                                        ? "bg-white/20 hover:bg-white/30"
                                        : "bg-white hover:bg-gray-50"
                                    }`}
                                  >
                                    <FileText size={16} />
                                    <span className="truncate">
                                      Vedlegg {attIndex + 1}
                                    </span>
                                  </a>
                                ),
                              )}
                            </div>
                          )}
                          {msg.createdAt && (
                            <p
                              className={`text-xs opacity-70 text-right mt-1 ${
                                msg.senderId === user?._id
                                  ? "text-white"
                                  : "text-gray-500"
                              }`}
                            >
                              {formatDate(msg.createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MessageSquare
                      size={48}
                      className="mx-auto text-gray-300 mb-4"
                    />
                    <p className="text-gray-500">Ingen meldinger å vise</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "payment" && (
              <div className="space-y-4">
                {payment ? (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Betalingsstatus</p>
                        <p className="font-medium capitalize">
                          {payment.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Beløp</p>
                        <p className="font-bold text-lg">
                          {payment.amount.toLocaleString()} kr
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <Button
                        label="Last ned faktura"
                        variant="default"
                        className="flex items-center gap-2"
                        onClick={downloadInvoice}
                      >
                        <Download size={16} />
                        Last ned faktura
                      </Button>

                      <Button
                        label="Last ned kvittering"
                        variant="default"
                        className="flex items-center gap-2"
                        onClick={downloadReceipt}
                      >
                        <Download size={16} />
                        Last ned kvittering
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard
                      size={48}
                      className="mx-auto text-gray-300 mb-4"
                    />
                    <p className="text-gray-500">
                      Ingen betalingsinformasjon tilgjengelig
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "images" && (
              <div className="space-y-8">
                {/* Before images */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Før jobben</h3>
                  {order &&
                  order.beforeImages &&
                  order.beforeImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {order.beforeImages.map((img: string, index: number) => (
                        <div
                          key={index}
                          className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square"
                        >
                          <img
                            src={img}
                            alt={`Før ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <FileText
                        size={48}
                        className="mx-auto text-gray-300 mb-4"
                      />
                      <p className="text-gray-500">
                        Ingen "før"-bilder lastet opp
                      </p>
                    </div>
                  )}
                </div>

                {/* After images */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Etter jobben</h3>
                  {order &&
                  order.afterImages &&
                  order.afterImages.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {order.afterImages.map((img: string, index: number) => (
                        <div
                          key={index}
                          className="relative rounded-lg overflow-hidden border border-gray-200 aspect-square"
                        >
                          <img
                            src={img}
                            alt={`Etter ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <FileText
                        size={48}
                        className="mx-auto text-gray-300 mb-4"
                      />
                      <p className="text-gray-500">
                        Ingen "etter"-bilder lastet opp
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "attachments" && (
              <div className="space-y-4">
                {order && order.attachments && order.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {order.attachments.map(
                      (attachment: string, index: number) => (
                        <a
                          key={index}
                          href={attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <FileText size={24} className="text-custom-green" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              Vedlegg {index + 1}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {attachment}
                            </p>
                          </div>
                          <Download size={16} className="text-gray-400" />
                        </a>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText
                      size={48}
                      className="mx-auto text-gray-300 mb-4"
                    />
                    <p className="text-gray-500">Ingen vedlegg lastet opp</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
