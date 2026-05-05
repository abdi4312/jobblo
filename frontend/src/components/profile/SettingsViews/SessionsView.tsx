import { useAuth } from "../../../features/auth/hook/useAuth";
import { Monitor, Smartphone, Tablet, XCircle, Clock, MapPin } from "lucide-react";
import { Button } from "../../Ui/Button";

interface Session {
  _id: string;
  isCurrent: boolean;
  device: string;
  browser: string;
  os: string;
  location?: string;
  ip: string;
  lastUsed: string;
}

export const SessionsView = () => {
  const { sessions, isLoadingSessions, revokeSession, revokeOthers, isRevokingOthers } = useAuth();

  if (isLoadingSessions) {
    return <div className="flex justify-center p-10 font-medium text-gray-400">Laster økter...</div>;
  }

  const otherSessionsCount = sessions?.filter((s: Session) => !s.isCurrent).length || 0;

  const getDeviceIcon = (device: string) => {
    if (device?.toLowerCase().includes("mobile") || device?.toLowerCase().includes("android") || device?.toLowerCase().includes("iphone")) {
      return <Smartphone size={24} className="text-orange-custom" />;
    }
    if (device?.toLowerCase().includes("tablet") || device?.toLowerCase().includes("ipad")) {
      return <Tablet size={24} className="text-orange-custom" />;
    }
    return <Monitor size={24} className="text-orange-custom" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Aktive økter</h2>
          <p className="text-sm text-gray-500">Administrer dine aktive innlogginger på forskjellige enheter og nettlesere.</p>
        </div>
        {otherSessionsCount > 0 && (
          <Button
            onClick={() => {
              if (window.confirm("Er du sikker på at du vil avslutte alle andre økter?")) {
                revokeOthers();
              }
            }}
            variant="outline"
            className="text-xs py-1.5 h-auto border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold"
            disabled={isRevokingOthers}
          >
            Logg ut alle andre
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {sessions?.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500">Ingen aktive økter funnet.</p>
          </div>
        ) : (
          sessions?.map((session: Session) => (
            <div
              key={session._id}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 gap-4"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-50 rounded-xl">
                  {getDeviceIcon(session.device)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{session.browser} på {session.os}</span>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full">Nåværende</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-400">
                    <div className="flex items-center gap-1.5" title={session.ip}>
                      <MapPin size={13} className="text-orange-400" />
                      <span className="font-medium text-gray-600">{session.location || "Ukjent sted"}</span>
                      <span className="text-[10px] text-gray-400 opacity-70">({session.ip === "::1" ? "Localhost" : session.ip})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-gray-300" />
                      <span>Sist aktiv: {new Date(session.lastUsed).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <Button
                  onClick={() => revokeSession(session._id)}
                  className="w-full sm:w-auto px-4 py-2 border border-rose-100 text-rose-600 bg-rose-50/30 hover:bg-rose-50 transition-colors rounded-xl flex items-center justify-center gap-2 text-xs font-bold"
                  variant="secondary"
                >
                  <XCircle size={14} />
                  <span>Logg ut enhet</span>
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Sikkerhetsmerknad:</strong> Hvis du ser en enhet eller et sted du ikke kjenner igjen, bør du logge ut økten umiddelbart og endre passordet ditt.
        </p>
      </div>
    </div>
  );
};
