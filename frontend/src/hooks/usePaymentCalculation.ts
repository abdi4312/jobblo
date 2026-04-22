import { useState, useEffect } from "react";

/**
 * Custom hook to handle payment-related state and automatic price calculations
 * based on hourly rate and duration.
 */
export const usePaymentCalculation = (
  durationValue: string,
  durationUnit: string,
  initialData: any = {},
) => {
  const [price, setPrice] = useState(initialData?.price?.toString() || "");
  const [hourlyRate, setHourlyRate] = useState(
    initialData?.hourlyRate?.toString() || "",
  );
  const [paymentType, setPaymentType] = useState(
    initialData?.paymentType || "Fastpris",
  );
  const [urgent, setUrgent] = useState(initialData?.urgent || false);

  // Auto-calculate price based on duration and hourly rate
  useEffect(() => {
    const hRate = parseFloat(hourlyRate);
    const dValue = parseFloat(durationValue);

    if (!isNaN(hRate) && !isNaN(dValue)) {
      let calculatedPrice = 0;

      if (durationUnit === "hours") {
        calculatedPrice = hRate * dValue;
      } else if (durationUnit === "days") {
        calculatedPrice = hRate * 8 * dValue; // Assuming 8 hours per day
      } else if (durationUnit === "minutes") {
        calculatedPrice = (hRate / 60) * dValue;
      }

      if (calculatedPrice > 0) {
        setPrice(Math.round(calculatedPrice).toString());
      } else if (calculatedPrice === 0 && (hRate === 0 || dValue === 0)) {
        setPrice("0");
      }
    }
  }, [hourlyRate, durationValue, durationUnit, setPrice]);

  return {
    price,
    setPrice,
    hourlyRate,
    setHourlyRate,
    paymentType,
    setPaymentType,
    urgent,
    setUrgent,
  };
};
