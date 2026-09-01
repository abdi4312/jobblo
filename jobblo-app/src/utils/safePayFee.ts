export const safePayFee = (price: number): number => Math.round((Number(price) || 0) * 0.03);

export const safePayNetToProvider = (price: number): number => {
  const gross = Number(price) || 0;
  return gross - safePayFee(gross);
};