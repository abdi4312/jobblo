import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function OAuthSuccess() {
  const navigate = useNavigate();
  const { fetchProfile, setTokens } = useUserStore((state) => state);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const initOAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
          // Store token first so fetchProfile interceptor can use it if needed
          setTokens({ accessToken: token });
          // Scrub it from the URL immediately. The backend already sets the auth
          // cookies on this same redirect, so the query param is redundant — and
          // leaving it there persists a live JWT in browser history and in
          // document.referrer for anything the page loads.
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Vipps/Google failure redirects carry ?error=... and were never read, so
        // a failed login landed on a blank form with no explanation.
        const oauthError = urlParams.get('error');
        if (oauthError) {
          setStatus('error');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        await fetchProfile();
        setStatus('success');

        // Premium feel: Give user 2 seconds to see the success state
        setTimeout(() => {
          navigate('/home');
        }, 2000);
      } catch (error) {
        console.error('OAuth Profile Fetch Error:', error);
        setStatus('error');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    initOAuth();
  }, [fetchProfile, navigate, setTokens]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F7F7F7] overflow-hidden font-['Inter',sans-serif]">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100/50 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-[100px] animate-pulse" />

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/80 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] text-center transition-all duration-500 transform hover:scale-[1.02]">
          <div className="flex flex-col items-center">
            {status === 'loading' && (
              <div className="relative mb-6">
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin" strokeWidth={1.5} />
                <div className="absolute inset-0 w-16 h-16 bg-blue-600/10 rounded-full blur-xl" />
              </div>
            )}

            {status === 'success' && (
              <div className="relative mb-6 icon-success-appearance">
                <div className="bg-green-500 rounded-full p-4 shadow-lg shadow-green-500/20">
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                </div>
                {/* Micro-animation of particles */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-green-500/40 rounded-full animate-ping pointer-events-none" />
              </div>
            )}

            {status === 'error' && (
              <div className="relative mb-6 bg-red-100 text-red-600 rounded-full p-4">
                <span className="font-bold text-2xl">!</span>
              </div>
            )}

            <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
              {status === 'loading' && 'Logger deg inn ...'}
              {status === 'success' && 'Velkommen tilbake!'}
              {status === 'error' && 'Innloggingen mislyktes'}
            </h2>

            <p className="text-gray-500 text-sm leading-relaxed">
              {status === 'loading' && 'Vi henter profilen din.'}
              {status === 'success' && 'Kontoen er bekreftet. Sender deg videre.'}
              {status === 'error' && 'Vi fikk ikke bekreftet kontoen din. Sender deg tilbake til innlogging.'}
            </p>

            {/* Progress indicator */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full mt-8 overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-in-out ${
                  status === 'success'
                    ? 'w-full bg-green-500'
                    : 'w-1/3 bg-blue-600 animate-loading-bar-pulse'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .animate-loading-bar-pulse {
          animation: loading-bar 2s infinite ease-in-out;
        }
        .icon-success-appearance {
          animation: success-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
        }
        @keyframes success-pop {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
