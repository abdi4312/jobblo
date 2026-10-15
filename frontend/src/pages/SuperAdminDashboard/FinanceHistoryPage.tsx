import { AdminPageHeader } from '../../components/admin';
import FinanceHistoryTabs from '../../components/SafePay/FinanceHistoryTabs';

export default function FinanceHistoryPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Stripe-økonomihistorikk"
        description="Se overføringer til providerkontoer og Stripe-utbetalinger til bank."
      />
      <FinanceHistoryTabs admin />
    </div>
  );
}
