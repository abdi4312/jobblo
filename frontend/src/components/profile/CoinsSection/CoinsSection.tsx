import styles from "./CoinsSection.module.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "antd";

interface Level {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  gradient: string;
}

const levels: Level[] = [
  { name: "Ny på Jobblo", minPoints: 0, maxPoints: 9, color: "#808080", gradient: "linear-gradient(180deg, #A0A0A0 0%, #606060 100%)" },
  { name: "Aktiv", minPoints: 10, maxPoints: 24, color: "#10B981", gradient: "linear-gradient(180deg, #34D399 0%, #059669 100%)" },
  { name: "Pålitelig", minPoints: 25, maxPoints: 49, color: "#3B82F6", gradient: "linear-gradient(180deg, #60A5FA 0%, #2563EB 100%)" },
  { name: "Profesjonell", minPoints: 50, maxPoints: 99, color: "#A855F7", gradient: "linear-gradient(180deg, #C084FC 0%, #9333EA 100%)" },
  { name: "Ekspert", minPoints: 100, maxPoints: 199, color: "#F97316", gradient: "linear-gradient(180deg, #FB923C 0%, #EA580C 100%)" },
  { name: "Mester", minPoints: 200, maxPoints: Infinity, color: "#FFD700", gradient: "linear-gradient(180deg, #FDE047 0%, #FACC15 100%)" },
];

function getLevelInfo(points: number): Level {
  return levels.find(level => points >= level.minPoints && points <= level.maxPoints) || levels[0];
}

export function CoinsSection() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigate = useNavigate();
  const userPoints = 70; // This should come from user store
  const levelInfo = getLevelInfo(userPoints);

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleUseCoins = () => {
    navigate("/coins");
  };

  return (
    <div className={styles.container} style={{ background: levelInfo.gradient }}>
      <div className={styles.levelName}>{levelInfo.name}</div>
      <div className={styles.title}>Dine Coins</div>
      <div className={styles.coinsDisplay}>
        <div className={styles.coinIcon}>
          <svg width="61" height="60" viewBox="0 0 61 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <g filter="url(#filter0_f_866_7805)">
              <path d="M30.5 52C42.6503 52 52.5 42.1503 52.5 30C52.5 17.8497 42.6503 8 30.5 8C18.3497 8 8.5 17.8497 8.5 30C8.5 42.1503 18.3497 52 30.5 52Z" 
                fill={levelInfo.color} stroke={levelInfo.color} strokeWidth="2.5"/>
            </g>
            <path d="M30.5 48C40.4411 48 48.5 39.9411 48.5 30C48.5 20.0589 40.4411 12 30.5 12C20.5589 12 12.5 20.0589 12.5 30C12.5 39.9411 20.5589 48 30.5 48Z" 
              stroke="rgba(255, 255, 255, 0.4)" strokeWidth="1.5" strokeDasharray="3 3"/>
            <text fill="white" xmlSpace="preserve" style={{whiteSpace: 'pre'}} fontFamily="Nunito" fontSize="24" fontStyle="italic" fontWeight="bold" letterSpacing="0em">
              <tspan x="25.7461" y="37.896">J</tspan>
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
        <div className={styles.coinsAmount}>{userPoints.toLocaleString('nb-NO')}</div>
      </div>
      <button className={styles.useCoinsButton} onClick={handleUseCoins}>
        <span className={styles.buttonText}>Bruk Coins</span>
      </button>
      
      {/* Background decorative elements */}
      <div className={styles.backgroundCircle1}></div>
      <div className={styles.backgroundCircle2}></div>
      
      {/* Help icon */}
      <div className={styles.helpIcon} onClick={showModal}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.9173 30.0007C20.5007 30.0007 20.994 29.799 21.3973 29.3957C21.8007 28.9923 22.0018 28.4995 22.0007 27.9173C21.9995 27.3351 21.7984 26.8418 21.3973 26.4373C20.9962 26.0329 20.5029 25.8318 19.9173 25.834C19.3318 25.8362 18.839 26.0379 18.439 26.439C18.039 26.8401 17.8373 27.3329 17.834 27.9173C17.8307 28.5018 18.0323 28.9951 18.439 29.3973C18.8457 29.7995 19.3384 30.0007 19.9173 30.0007ZM18.4173 23.584H21.5007C21.5007 22.6673 21.6051 21.9451 21.814 21.4173C22.0229 20.8895 22.6129 20.1673 23.584 19.2507C24.3062 18.5284 24.8757 17.8407 25.2923 17.1873C25.709 16.534 25.9173 15.7495 25.9173 14.834C25.9173 13.2784 25.3479 12.084 24.209 11.2507C23.0701 10.4173 21.7229 10.0007 20.1673 10.0007C18.584 10.0007 17.2995 10.4173 16.314 11.2507C15.3284 12.084 14.6407 13.084 14.2507 14.2507L17.0007 15.334C17.1395 14.834 17.4523 14.2923 17.939 13.709C18.4257 13.1257 19.1684 12.834 20.1673 12.834C21.0562 12.834 21.7229 13.0773 22.1673 13.564C22.6118 14.0507 22.834 14.5851 22.834 15.1673C22.834 15.7229 22.6673 16.244 22.334 16.7307C22.0007 17.2173 21.584 17.6684 21.084 18.084C19.8618 19.1673 19.1118 19.9868 18.834 20.5423C18.5562 21.0979 18.4173 22.1118 18.4173 23.584ZM20.0007 36.6673C17.6951 36.6673 15.5284 36.2301 13.5007 35.3557C11.4729 34.4812 9.70899 33.2934 8.20899 31.7923C6.70899 30.2912 5.52176 28.5273 4.64732 26.5007C3.77288 24.474 3.3351 22.3073 3.33399 20.0007C3.33288 17.694 3.77065 15.5273 4.64732 13.5007C5.52399 11.474 6.71121 9.7101 8.20899 8.20899C9.70676 6.70788 11.4707 5.52066 13.5007 4.64733C15.5307 3.77399 17.6973 3.33622 20.0007 3.33399C22.304 3.33177 24.4707 3.76955 26.5007 4.64733C28.5307 5.5251 30.2945 6.71233 31.7923 8.20899C33.2901 9.70566 34.4779 11.4695 35.3557 13.5007C36.2334 15.5318 36.6707 17.6984 36.6673 20.0007C36.664 22.3029 36.2262 24.4695 35.354 26.5007C34.4818 28.5318 33.2945 30.2957 31.7923 31.7923C30.2901 33.289 28.5262 34.4768 26.5007 35.3557C24.4751 36.2345 22.3084 36.6718 20.0007 36.6673Z" 
            fill="var(--color-price)" 
            fillOpacity="0.8"
          />
        </svg>
      </div>

      <Modal
        title="Hva er Jobblo Coins?"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={handleCancel}
        footer={[
          <button
            key="close"
            onClick={handleOk}
            style={{
              padding: "10px 24px",
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Forstått
          </button>
        ]}
      >
        <div style={{ padding: "16px 0" }}>
          <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "12px" }}>
            🎁 Lojalitetsprogram
          </h3>
          <p style={{ marginBottom: "16px", lineHeight: "1.6" }}>
            Jobblo Coins er vårt lojalitetsprogram som belønner deg for å være en aktiv bruker på plattformen.
          </p>
          
          <h4 style={{ fontSize: "16px", fontWeight: "600", marginTop: "20px", marginBottom: "8px" }}>
            💰 Hvordan tjene coins:
          </h4>
          <ul style={{ paddingLeft: "20px", lineHeight: "1.8" }}>
            <li><strong>Små oppdrag:</strong> 1 poeng per fullført oppdrag</li>
            <li><strong>Store oppdrag:</strong> 5 poeng per fullført oppdrag</li>
            <li>Skriv kvalitetsanmeldelser etter fullført jobb</li>
            <li>Henvis venner til Jobblo</li>
            <li>Bli Premium medlem for ekstra bonuser</li>
          </ul>

          <h4 style={{ fontSize: "16px", fontWeight: "600", marginTop: "20px", marginBottom: "8px" }}>
            🎯 Bruk coins til:
          </h4>
          <ul style={{ paddingLeft: "20px", lineHeight: "1.8" }}>
            <li>Rabatter på tjenester og Premium abonnement</li>
            <li>Fremhev annonser for bedre synlighet</li>
            <li>Prioritert kundestøtte</li>
            <li>Eksklusive tilbud og fordeler</li>
          </ul>

          <div style={{
            marginTop: "20px",
            padding: "12px 16px",
            backgroundColor: "var(--color-surface)",
            borderRadius: "8px",
            borderLeft: "4px solid var(--color-primary)"
          }}>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: "500" }}>
              💡 Tips: Jo mer aktiv du er på Jobblo, jo flere coins tjener du!
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
