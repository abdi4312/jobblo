import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Deep-link alias. SafePay and older links can land on /safepay/success/<orderId>,
 * while the real screen reads the id from a query param, so this forwards instead of
 * duplicating the screen.
 */
export default function SafePaySuccessOrderRedirect() {
  const params = useLocalSearchParams<{ orderId: string | string[] }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;

  if (!orderId?.trim()) {
    return <Redirect href="/(app)/safepay/success" />;
  }

  return <Redirect href={{ pathname: '/(app)/safepay/success', params: { orderId } }} />;
}
