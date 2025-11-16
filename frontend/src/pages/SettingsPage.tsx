import styles from '../styles/SettingsPage.module.css';
import { BackNavigation } from '../components/profile/BackNavigation/BackNavigation';
import { SettingsHeader } from '../components/settings/SettingsHeader/SettingsHeader';
import { SettingsMenuItem } from '../components/settings/SettingsMenuItem/SettingsMenuItem';
import { NotificationSettings } from '../components/settings/NotificationSettings/NotificationSettings';
import CashIcon from '../assets/icons/cash.svg?react';

// Accessibility icon component (inline SVG since not available in assets)
const AccessibilityIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.0008 6.00001C11.4508 6.00001 10.9801 5.80434 10.5888 5.41301C10.1974 5.02167 10.0014 4.55067 10.0008 4.00001C10.0001 3.44934 10.1961 2.97867 10.5888 2.58801C10.9814 2.19734 11.4521 2.00134 12.0008 2.00001C12.5494 1.99867 13.0204 2.19467 13.4138 2.58801C13.8071 2.98134 14.0028 3.45201 14.0008 4.00001C13.9988 4.54801 13.8031 5.01901 13.4138 5.41301C13.0244 5.80701 12.5534 6.00267 12.0008 6.00001ZM9.00077 21V9.00001C8.1841 8.93334 7.35911 8.84167 6.52577 8.72501C5.69244 8.60834 4.87577 8.45834 4.07577 8.27501C3.79244 8.20834 3.56344 8.05001 3.38877 7.80001C3.21411 7.55001 3.16811 7.28334 3.25077 7.00001C3.33344 6.71667 3.50844 6.50834 3.77577 6.37501C4.04311 6.24167 4.32644 6.20834 4.62577 6.27501C5.79244 6.52501 7.0051 6.70834 8.26377 6.82501C9.52244 6.94167 10.7681 7.00001 12.0008 7.00001C13.2334 7.00001 14.4794 6.94167 15.7388 6.82501C16.9981 6.70834 18.2104 6.52501 19.3758 6.27501C19.6758 6.20834 19.9591 6.24167 20.2258 6.37501C20.4924 6.50834 20.6674 6.71667 20.7508 7.00001C20.8341 7.28334 20.7884 7.55001 20.6138 7.80001C20.4391 8.05001 20.2098 8.20834 19.9258 8.27501C19.1258 8.45834 18.3091 8.60834 17.4758 8.72501C16.6424 8.84167 15.8174 8.93334 15.0008 9.00001V21C15.0008 21.2833 14.9051 21.521 14.7138 21.713C14.5224 21.905 14.2848 22.0007 14.0008 22C13.7168 21.9993 13.4794 21.9033 13.2888 21.712C13.0981 21.5207 13.0021 21.2833 13.0008 21V16H11.0008V21C11.0008 21.2833 10.9048 21.521 10.7128 21.713C10.5208 21.905 10.2834 22.0007 10.0008 22C9.7181 21.9993 9.48077 21.9033 9.28877 21.712C9.09677 21.5207 9.00077 21.2833 9.00077 21Z" fill="#2D6640"/>
  </svg>
);

export default function SettingsPage() {
  const handlePaymentClick = () => {
    console.log('Navigate to payment settings');
  };

  const handlePrivacyClick = () => {
    console.log('Navigate to privacy settings');
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.navigationSection}>
          <BackNavigation text="Tilbake til Min Side" />
        </div>
        
        <div className={styles.headerSection}>
          <SettingsHeader title="Instillinger" />
        </div>
        
        <div className={styles.menuSection}>
          <SettingsMenuItem
            icon={<CashIcon />}
            text="Betalingsmåte"
            onClick={handlePaymentClick}
            showDivider={true}
          />
          
          <SettingsMenuItem
            icon={<AccessibilityIcon />}
            text="Personvern"
            onClick={handlePrivacyClick}
            showDivider={true}
          />
          
          <NotificationSettings />
        </div>
      </div>
    </div>
  );
}
