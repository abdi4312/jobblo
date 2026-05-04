import React from "react";
import { X, Copy, Code, MessageCircle} from "lucide-react";
import { toast } from "react-hot-toast";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  url,
  title,
}) => {
  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Lenke kopiert!");
    } catch (err) {
      toast.error("Kunne ikke kopiere lenke");
    }
  };

  const shareOptions = [
    {
      name: "Embed",
      icon: <Code size={24} />,
      color: "bg-white text-gray-600",
      action: () => {
        const embedCode = `<iframe src="${url}" width="100%" height="500"></iframe>`;
        navigator.clipboard.writeText(embedCode);
        toast.success("Embed-kode kopiert!");
      },
    },
    {
      name: "Messages",
      icon: <MessageCircle size={24} fill="currentColor" />,
      color: "bg-blue-500 text-white",
      action: () => window.open(`sms:?&body=${encodeURIComponent(title + " " + url)}`),
    },
    {
      name: "WhatsApp",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      color: "bg-[#25D366] text-white",
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(title + " " + url)}`),
    },
    {
      name: "Facebook",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      ),
      color: "bg-[#1877F2] text-white",
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
    },
    {
      name: "X",
      icon: (
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
          <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.494h2.039L6.486 3.24H4.298l13.311 17.407z" />
        </svg>
      ),
      color: "bg-black text-white",
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`),
    },
  ];

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#1a1a1a] text-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Share</h2>
            <button
              title="Close"
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Social Icons Row */}
          <div className="relative flex items-center mb-8">
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 scroll-smooth">
              {shareOptions.map((option) => (
                <div key={option.name} className="flex flex-col items-center gap-2 min-w-17.5">
                  <button
                    onClick={option.action}
                    className={`${option.color} w-14 h-14 rounded-full flex items-center justify-center hover:opacity-90 transition-all shadow-lg`}
                  >
                    {option.icon}
                  </button>
                  <span className="text-xs text-gray-400 font-medium">{option.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* URL Copy Section */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-2 flex items-center gap-3">
            <div className="flex-1 px-3 overflow-hidden">
              <p className="text-sm text-gray-400 truncate font-mono">
                {url}
              </p>
            </div>
            <button
              title="Copy URL"
              onClick={handleCopy}
              className="bg-white text-black px-5 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop Close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
};
