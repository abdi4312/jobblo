import { Redirect, useLocalSearchParams, type Href } from 'expo-router';

export default function SafePaySuccessOrderRedirect() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const href = orderId?.trim() ? `/safepay/success?orderId=${orderId}` : '/safepay/success';
  return <Redirect href={href as Href} />;
}
