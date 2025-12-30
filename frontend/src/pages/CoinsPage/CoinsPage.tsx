import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./CoinsPage.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";

interface Level {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  gradient: string;
}

const levels: Level[] = [
  { name: "Ny på Jobblo", minPoints: 0, maxPoints: 9, color: "#808080", gradient: "linear-gradient(135deg, #A0A0A0 0%, #606060 100%)" },
  { name: "Aktiv", minPoints: 10, maxPoints: 24, color: "#10B981", gradient: "linear-gradient(135deg, #34D399 0%, #059669 100%)" },
  { name: "Pålitelig", minPoints: 25, maxPoints: 49, color: "#3B82F6", gradient: "linear-gradient(135deg, #60A5FA 0%, #2563EB 100%)" },
  { name: "Profesjonell", minPoints: 50, maxPoints: 99, color: "#A855F7", gradient: "linear-gradient(135deg, #C084FC 0%, #9333EA 100%)" },
  { name: "Ekspert", minPoints: 100, maxPoints: 199, color: "#F97316", gradient: "linear-gradient(135deg, #FB923C 0%, #EA580C 100%)" },
  { name: "Mester", minPoints: 200, maxPoints: Infinity, color: "#FFD700", gradient: "linear-gradient(135deg, #FDE047 0%, #FACC15 100%)" },
];

function getLevelInfo(points: number): Level {
  return levels.find(level => points >= level.minPoints && points <= level.maxPoints) || levels[0];
}

export default function CoinsPage() {
  const navigate = useNavigate();
  const userCoins = 5431; // This should come from user store in real implementation
  const levelInfo = getLevelInfo(userCoins);

  const rewards = [
    {
      id: 1,
      title: "10% Rabatt på neste bestilling",
      description: "Få 10% rabatt på din neste tjeneste",
      coins: 500,
      category: "Rabatt"
    },
    {
      id: 2,
      title: "20% Rabatt på neste bestilling",
      description: "Få 20% rabatt på din neste tjeneste",
      coins: 1000,
      category: "Rabatt"
    },
    {
      id: 3,
      title: "Gratis Premium i 1 måned",
      description: "Få tilgang til premium funksjoner i 30 dager",
      coins: 2000,
      category: "Premium"
    },
    {
      id: 4,
      title: "50% Rabatt på Premium",
      description: "Få 50% rabatt på din neste Premium abonnement",
      coins: 1500,
      category: "Premium"
    },
    {
      id: 5,
      title: "Gratis annonse-fremheving",
      description: "Fremhev din annonse i 7 dager",
      coins: 800,
      category: "Synlighet"
    },
    {
      id: 6,
      title: "Prioritert kundestøtte",
      description: "Få prioritert hjelp fra vårt supportteam",
      coins: 300,
      category: "Service"
    }
  ];

  const handleRedeem = (rewardId: number, coinCost: number) => {
    if (userCoins >= coinCost) {
      // Handle redemption logic here
      alert(`Du har løst inn belønning #${rewardId}!`);
    } else {
      alert("Du har ikke nok coins for denne belønningen");
    }
  };

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title="Jobblo Coins" buttonText="Tilbake" />

      <div className={styles.coinsBalance} style={{ background: levelInfo.gradient }}>
        <div className={styles.coinIcon}>
          <svg width="80" height="80" viewBox="0 0 61 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g filter="url(#filter0_f_866_7805)">
              <path d="M30.5 52C42.6503 52 52.5 42.1503 52.5 30C52.5 17.8497 42.6503 8 30.5 8C18.3497 8 8.5 17.8497 8.5 30C8.5 42.1503 18.3497 52 30.5 52Z" 
                fill={levelInfo.color} stroke={levelInfo.color} strokeWidth="2.5"/>
            </g>
            <path d="M30.5 48C40.4411 48 48.5 39.9411 48.5 30C48.5 20.0589 40.4411 12 30.5 12C20.5589 12 12.5 20.0589 12.5 30C12.5 39.9411 20.5589 48 30.5 48Z" 
              stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.5" strokeDasharray="3 3"/>
            <text fill="white" xmlSpace="preserve" style={{whiteSpace: 'pre'}} fontFamily="Nunito" fontSize="32" fontStyle="italic" fontWeight="bold" letterSpacing="0em">
              <tspan x="23" y="38">J</tspan>
            </text>
            <defs>
              <filter id="filter0_f_866_7805" x="5.25" y="4.75" width="50.5" height="50.5" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
                <feGaussianBlur stdDeviation="1" result="effect1_foregroundBlur_866_7805"/>
              </filter>
            </defs>
          </svg>
        </div>
        <div className={styles.balanceInfo}>
          <p className={styles.levelBadge}>{levelInfo.name}</p>
          <p className={styles.balanceLabel}>Dine tilgjengelige coins</p>
          <p className={styles.balanceAmount}>{userCoins.toLocaleString('nb-NO')}</p>
        </div>
      </div>

      <div className={styles.infoBox}>
        <span className="material-symbols-outlined" style={{color: "var(--color-primary)"}}>info</span>
        <p>Tjen poeng ved å fullføre oppdrag: <strong>1 poeng for små jobber</strong> og <strong>5 poeng for store jobber</strong>!</p>
      </div>

      <h2 className={styles.sectionTitle}>Tilgjengelige belønninger</h2>

      <div className={styles.rewardsGrid}>
        {rewards.map((reward) => (
          <div key={reward.id} className={styles.rewardCard}>
            <div className={styles.rewardHeader}>
              <span className={styles.category}>{reward.category}</span>
              <div className={styles.coinCost}>
                <span className={styles.coinAmount}>{reward.coins}</span>
                <span className={styles.coinSymbol}>J</span>
              </div>
            </div>
            <h3 className={styles.rewardTitle}>{reward.title}</h3>
            <p className={styles.rewardDescription}>{reward.description}</p>
            <button
              onClick={() => handleRedeem(reward.id, reward.coins)}
              disabled={userCoins < reward.coins}
              className={styles.redeemButton}
            >
              {userCoins >= reward.coins ? "Løs inn" : "Ikke nok coins"}
            </button>
          </div>
        ))}
      </div>

      <div className={styles.earnCoinsSection}>
        <h2 className={styles.sectionTitle}>Hvordan tjene flere coins?</h2>
        <div className={styles.earnMethodsGrid}>
          <div className={styles.earnMethod}>
            <span className="material-symbols-outlined" style={{fontSize: "40px", color: "var(--color-primary)"}}>handyman</span>
            <h4>Små oppdrag</h4>
            <p>Tjen 1 poeng for hvert fullførte småjobb</p>
          </div>
          <div className={styles.earnMethod}>
            <span className="material-symbols-outlined" style={{fontSize: "40px", color: "var(--color-primary)"}}>construction</span>
            <h4>Store oppdrag</h4>
            <p>Tjen 5 poeng for hvert fullførte storjobb</p>
          </div>
          <div className={styles.earnMethod}>
            <span className="material-symbols-outlined" style={{fontSize: "40px", color: "var(--color-primary)"}}>rate_review</span>
            <h4>Skriv anmeldelser</h4>
            <p>Få ekstra poeng for å skrive kvalitetsanmeldelser</p>
          </div>
          <div className={styles.earnMethod}>
            <span className="material-symbols-outlined" style={{fontSize: "40px", color: "var(--color-primary)"}}>group_add</span>
            <h4>Henvis venner</h4>
            <p>Tjen bonus poeng når venner registrerer seg</p>
          </div>
        </div>
      </div>
    </div>
  );
}
