import { useState } from 'react';
import { useAuth } from '../../../features/auth/hook/useAuth';
import { Monitor, Smartphone, Tablet, XCircle, Clock, MapPin, ShieldAlert } from 'lucide-react';

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
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (isLoadingSessions) {
    return (
      <div className="flex justify-center p-10 font-medium text-gray-400">
        Laster økter...
      </div>
    );
  }

  const otherSessionsCount = sessions?.filter((s: Session) => !s.isCurrent).length ?? 0;

  const getDeviceIcon = (device: string) => {
    const d = device?.toLowerCase() ?? '';
    if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) {
      return <Smartphone size={22} className="text-orange-500" />;
    }
    if (d.includes('tablet') || d.includes('ipad')) {
      return <Tablet size={22} className="text-orange-500" />;
    }
    return <Monitor size={22} className="text-orange-500" />;
  };

  const handleRevoke = (sessionId: string) => {
    if (!window.confirm('Er du sikker på at du vil logge ut denne enheten?')) return;
    setRevokingId(sessionId);
    revokeSession(sessionId, {
      onSettled: () => setRevokingId(null),
    });
  };

  const handleRevokeAll = () => {
    if (!window.confirm('Er du sikker på at du vil logge ut alle andre enheter?')) return;
    revokeOthers();
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('nb-NO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Aktive økter</h2>
          <p className="text-sm text-gray-500">
            Administrer dine aktive innlogginger på forskjellige enheter og nettlesere.
          </p>
        </div>
        {otherSessionsCount > 0 && (
          <button
            onClick={handleRevokeAll}
            disabled={isRevokingOthers}
            className="shrink-0 self-start text-xs px-4 py-2 h-auto border border-red-200 hover:bg-red-50 text-red-600 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isRevokingOthers ? 'Logger ut...' : `Logg ut alle andre (${otherSessionsCount})`}
          </button>
        )}
      </div>

      {/* Sessions list */}
      <div className="space-y-3">
        {!sessions?.length ? (
          <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <p className="text-gray-500 text-sm">Ingen aktive økter funnet.</p>
          </div>
        ) : (
          sessions.map((session: Session) => (
            <div
              key={session._id}
              className={[
                'flex flex-col sm:flex-row items-start sm:items-center justify-between',
                'p-4 bg-white border rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 gap-4',
                session.isCurrent ? 'border-green-200 bg-green-50/30' : 'border-gray-100',
              ].join(' ')}
            >
              {/* Device info */}
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${session.isCurrent ? 'bg-green-100' : 'bg-orange-50'}`}>
                  {getDeviceIcon(session.device)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">
                      {session.browser} · {session.os}
                    </span>
                    {session.isCurrent && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full tracking-wide">
                        Nåværende
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <div className="flex items-center gap-1" title={session.ip}>
                      <MapPin size={12} className="text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">
                        {session.location || 'Ukjent sted'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        ({session.ip === '::1' ? 'Localhost' : session.ip})
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {formatDate(session.lastUsed)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revoke button */}
              {!session.isCurrent && (
                <button
                  onClick={() => handleRevoke(session._id)}
                  disabled={revokingId === session._id || isRevokingOthers}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 transition-colors rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={13} />
                  <span>{revokingId === session._id ? 'Logger ut...' : 'Logg ut'}</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Security note */}
      <div className="flex gap-3 p-4 bg-amber-50 rounded-2xl border border-amber-100">
        <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Sikkerhetsmerknad:</strong> Hvis du ser en enhet eller et sted du ikke
          kjenner igjen, bør du logge ut økten umiddelbart og endre passordet ditt.
        </p>
      </div>

    </div>
  );
};
