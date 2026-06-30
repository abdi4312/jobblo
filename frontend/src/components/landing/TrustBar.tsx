import { ShieldCheck, FileText, Star, Clock } from 'lucide-react';

export function TrustBar() {
  const trustItems = [
    { icon: ShieldCheck, text: 'Trygg betaling med SafePay' },
    { icon: FileText, text: 'Automatisk digital kontrakt' },
    { icon: Star, text: 'Verifiserte anmeldelser' },
    { icon: Clock, text: 'Kom i gang på under 2 min' },
  ];

  return (
    <div className="bg-white border-y border-black/5 py-4 px-12 flex flex-wrap items-center justify-center gap-10">
      {trustItems.map((item, index) => (
        <div key={index} className="flex items-center gap-2 text-[13px] text-custom-black/70">
          <item.icon className="w-[18px] h-[18px] text-custom-green" />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}
