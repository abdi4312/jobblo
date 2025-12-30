import { useState } from "react";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import styles from "./MinInntekt.module.css";
import { useUserStore } from "../../stores/userStore";

type TransactionType = "earned" | "spent";
type TimeFilter = "week" | "month" | "year";

interface Transaction {
  id: string;
  title: string;
  fromTo: string;
  amount: number;
  date: string;
  status: "pending" | "completed" | "paid";
  type: TransactionType;
}

// Dummy data
const DUMMY_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "pending",
    type: "earned"
  },
  {
    id: "2",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "pending",
    type: "earned"
  },
  {
    id: "3",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "completed",
    type: "earned"
  },
  {
    id: "4",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "completed",
    type: "earned"
  },
  {
    id: "5",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "pending",
    type: "spent"
  },
  {
    id: "6",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "pending",
    type: "spent"
  },
  {
    id: "7",
    title: "Stor lang vegg trengs maling",
    fromTo: "Jakob L.",
    amount: 1250,
    date: "2 sep",
    status: "completed",
    type: "spent"
  }
];

const MONTHLY_DATA_EARNED = [65, 80, 45, 100, 75]; // 5 weeks in a month
const MONTHLY_DATA_SPENT = [50, 75, 35, 60, 55]; // 5 weeks in a month

const WEEKLY_DATA_EARNED = [15, 25, 20, 30, 22, 35, 28]; // 7 days
const WEEKLY_DATA_SPENT = [10, 18, 15, 22, 12, 25, 20]; // 7 days

const YEARLY_DATA_EARNED = [300, 450, 380, 520, 410, 600, 550, 480, 530, 620, 580, 650]; // 12 months
const YEARLY_DATA_SPENT = [200, 300, 250, 380, 290, 420, 380, 320, 360, 410, 390, 450]; // 12 months

export default function MinInntekt() {
  const [activeTab, setActiveTab] = useState<TransactionType>("earned");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("month");
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const user = useUserStore((state) => state.user);

  const filteredTransactions = DUMMY_TRANSACTIONS.filter(t => t.type === activeTab);
  
  const totalEarned = user?.earnings || 0;
  const totalSpent = user?.spending || 0;

  const currentTotal = activeTab === "earned" ? totalEarned : totalSpent;
  
  // Get chart data based on time filter
  const getChartData = () => {
    if (timeFilter === "week") {
      return activeTab === "earned" ? WEEKLY_DATA_EARNED : WEEKLY_DATA_SPENT;
    } else if (timeFilter === "year") {
      return activeTab === "earned" ? YEARLY_DATA_EARNED : YEARLY_DATA_SPENT;
    } else {
      return activeTab === "earned" ? MONTHLY_DATA_EARNED : MONTHLY_DATA_SPENT;
    }
  };

  const chartData = getChartData();
  const maxValue = Math.max(...chartData);

  const getFilterLabel = () => {
    switch (timeFilter) {
      case "week":
        return "denne uken";
      case "month":
        return "denne måneden";
      case "year":
        return "dette året";
    }
  };

  const handleBarClick = (index: number) => {
    setSelectedBarIndex(index === selectedBarIndex ? null : index);
  };

  const handleFilterChange = (filter: TimeFilter) => {
    setTimeFilter(filter);
    setShowFilterMenu(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return { icon: "schedule", color: "#3b82f6" };
      case "completed":
        return { icon: "account_balance", color: "#22c55e" };
      case "paid":
        return { icon: "check_circle", color: "#22c55e" };
      default:
        return { icon: "help", color: "#9ca3af" };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Utbetaling behandles";
      case "completed":
        return "Utbetalt til konto";
      case "paid":
        return "Betalt";
      default:
        return "Ukjent";
    }
  };

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title="Inntekter" buttonText="Tilbake" />
      
      <div className={styles.content}>
        {/* Total Amount Section */}
        <div className={styles.totalSection}>
          <p className={styles.totalLabel}>
            {activeTab === "earned" ? "Tjent" : "Brukt"} {getFilterLabel()}
          </p>
          <p className={styles.totalAmount}>{currentTotal},-kr</p>
          
          <div className={styles.filterButtonWrapper}>
            <div 
              className={styles.filterButton}
              onClick={() => setShowFilterMenu(!showFilterMenu)}
            >
              Filtrer <span className="material-symbols-outlined">expand_more</span>
            </div>
            
            {showFilterMenu && (
              <div className={styles.filterMenu}>
                <div 
                  className={`${styles.filterOption} ${timeFilter === "week" ? styles.activeFilter : ""}`}
                  onClick={() => handleFilterChange("week")}
                >
                  Uke
                </div>
                <div 
                  className={`${styles.filterOption} ${timeFilter === "month" ? styles.activeFilter : ""}`}
                  onClick={() => handleFilterChange("month")}
                >
                  Måned
                </div>
                <div 
                  className={`${styles.filterOption} ${timeFilter === "year" ? styles.activeFilter : ""}`}
                  onClick={() => handleFilterChange("year")}
                >
                  År
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className={styles.chartContainer}>
          <div className={styles.chart}>
            {chartData.map((value, index) => {
              const isSelected = selectedBarIndex === index;
              
              return (
                <div 
                  key={index} 
                  className={styles.barWrapper}
                  onClick={() => handleBarClick(index)}
                  style={{ cursor: 'pointer' }}
                >
                  <div 
                    className={`${styles.bar} ${isSelected ? styles.selectedBar : ""}`}
                    style={{
                      height: `${(value / maxValue) * 100}%`,
                      backgroundColor: isSelected
                        ? (activeTab === "earned" ? "var(--color-accent)" : "#ef4444")
                        : (activeTab === "earned" 
                            ? "rgba(24, 58, 29, 0.4)" 
                            : "rgba(234, 126, 21, 0.4)"),
                      transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                    }}
                  />
                  {isSelected && (
                    <div className={styles.barTooltip}>
                      {value} kr
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "earned" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("earned")}
          >
            Utførte oppdrag
          </button>
          <button
            className={`${styles.tab} ${activeTab === "spent" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("spent")}
          >
            Utgitte oppdrag
          </button>
        </div>

        {/* History */}
        <div className={styles.historySection}>
          <h3 className={styles.historyTitle}>Historikk</h3>
          
          <div className={styles.transactionList}>
            {filteredTransactions.map((transaction) => {
              const statusInfo = getStatusIcon(transaction.status);
              
              return (
                <div key={transaction.id} className={styles.transactionItem}>
                  <div className={styles.transactionMain}>
                    <div className={styles.transactionInfo}>
                      <h4 className={styles.transactionTitle}>{transaction.title}</h4>
                      <p className={styles.transactionFrom}>
                        {activeTab === "earned" ? "Fra" : "Utført av"} {transaction.fromTo}
                      </p>
                    </div>
                    
                    <div className={styles.transactionRight}>
                      <p 
                        className={styles.transactionAmount}
                        style={{ color: activeTab === "earned" ? "#22c55e" : "#ef4444" }}
                      >
                        {activeTab === "earned" ? "+" : "-"} {transaction.amount},-kr
                      </p>
                      <p className={styles.transactionDate}>{transaction.date}</p>
                    </div>
                  </div>
                  
                  <div className={styles.transactionStatus}>
                    <span 
                      className="material-symbols-outlined" 
                      style={{ fontSize: "18px", color: statusInfo.color }}
                    >
                      {statusInfo.icon}
                    </span>
                    <span style={{ color: statusInfo.color }}>
                      {getStatusText(transaction.status)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
