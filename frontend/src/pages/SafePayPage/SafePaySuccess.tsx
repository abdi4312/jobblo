import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "../../components/Ui/button/Button";
import SafePaySteps from "../../components/SafePay/SafePaySteps";
import { toast } from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import mainLink from "../../api/mainURLs";

const SafePaySuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const sessionId = searchParams.get("session_id");

  // Check payment status
  const { isLoading, error } = useQuery({
    queryKey: ["safepay-status", sessionId],
    queryFn: async () => {
      if (!sessionId) return;
      const res = await mainLink.get(`/api/safepay-checkout/status/${sessionId}`);
      return res.data;
    },
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (error) {
      toast.error("Kunne ikke bekrefte betalingen");
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f5f0e8] font-sans flex flex-col items-center py-12 px-6">
      <div className="max-w-[1024px] w-full mb-12">
        <SafePaySteps 
          currentStep={3} 
          orderId={orderId || undefined}
        />
      </div>

      <div className="max-w-[500px] w-full bg-white rounded-3xl p-8 text-center shadow-sm border border-black/5">
        <div className="w-20 h-20 bg-[#f0faf0] rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} className="text-custom-green" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Betaling bekreftet!
        </h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          Takk for din betaling. Pengene er nå trygt lagret hos SafePay og vil
          bli utbetalt til søkeren når jobben er utført og godkjent av deg.
        </p>

        <div className="bg-[#f9f9f7] rounded-2xl p-4 mb-8 flex items-center gap-3 text-left">
          <ShieldCheck size={24} className="text-custom-green shrink-0" />
          <div>
            <div className="text-[13px] font-bold text-gray-900">
              SafePay Beskyttelse
            </div>
            <div className="text-[11px] text-gray-500">
              Jobblo holder beløpet sikkert frem til godkjenning.
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            onClick={() => navigate(`/safepay/approval/${orderId}`)}
            label="Godkjenn jobb og utbetal"
            className="w-full bg-custom-green text-white rounded-full py-3.5 font-bold hover:bg-[#14532d]"
          />
          <Button
            variant="outline"
            onClick={() => navigate("/home")}
            label="Tilbake til forsiden"
            className="w-full border-black/10 text-gray-600 rounded-full py-3.5 font-bold hover:bg-gray-50"
          />
        </div>
      </div>
    </div>
  );
};

export default SafePaySuccess;
