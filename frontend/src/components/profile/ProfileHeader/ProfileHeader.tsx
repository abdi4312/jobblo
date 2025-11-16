import styles from "./ProfileHeader.module.css";
import { useUserStore } from "../../../stores/userStore";

export function ProfileHeader() {
  const user = useUserStore((state) => state.user);

  // Format join date if available
  const memberSince = user?._id ? "2024" : "N/A"; // You can add a joinedAt field to the user type later

  return (
    <div className={styles.container}>
      <div className={styles.profileImageContainer}>
        <img 
          src="https://api.builder.io/api/v1/image/assets/TEMP/7278bc40eaffee1b3010ad41c4d262b59215cbf6?width=332" 
          alt="Profile" 
          className={styles.profileImage}
        />
      </div>
      <div className={styles.profileInfo}>
        <div className={styles.nameAndEmail}>
          <span className={styles.name}>{user?.name || "Guest"}</span>
          <span className={styles.email}>{user?.email || "Not logged in"}</span>
        </div>
        <div className={styles.ratingContainer}>
          <svg className={styles.starIcon} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.0003 17.2742L7.85033 19.7742C7.667 19.8909 7.47533 19.9409 7.27533 19.9242C7.07533 19.9076 6.90033 19.8409 6.75033 19.7242C6.60033 19.6076 6.48366 19.4619 6.40033 19.2872C6.317 19.1126 6.30033 18.9166 6.35033 18.6992L7.45033 13.9742L3.77533 10.7992C3.60866 10.6492 3.50466 10.4782 3.46333 10.2862C3.422 10.0942 3.43433 9.90689 3.50033 9.72422C3.56633 9.54155 3.66633 9.39155 3.80033 9.27422C3.93433 9.15689 4.11766 9.08189 4.35033 9.04922L9.20033 8.62422L11.0753 4.17422C11.1587 3.97422 11.288 3.82422 11.4633 3.72422C11.6387 3.62422 11.8177 3.57422 12.0003 3.57422C12.183 3.57422 12.362 3.62422 12.5373 3.72422C12.7127 3.82422 12.842 3.97422 12.9253 4.17422L14.8003 8.62422L19.6503 9.04922C19.8837 9.08255 20.067 9.15755 20.2003 9.27422C20.3337 9.39089 20.4337 9.54089 20.5003 9.72422C20.567 9.90755 20.5797 10.0952 20.5383 10.2872C20.497 10.4792 20.3927 10.6499 20.2253 10.7992L16.5503 13.9742L17.6503 18.6992C17.7003 18.9159 17.6837 19.1119 17.6003 19.2872C17.517 19.4626 17.4003 19.6082 17.2503 19.7242C17.1003 19.8402 16.9253 19.9069 16.7253 19.9242C16.5253 19.9416 16.3337 19.8916 16.1503 19.7742L12.0003 17.2742Z" 
              fill="var(--color-campaign)" 
              stroke="var(--color-bg-dark)" 
              strokeOpacity="0.62"
            />
          </svg>
          <span className={styles.rating}>4.3</span>
        </div>
        <div className={styles.memberSince}>medlem siden {memberSince}</div>
      </div>
    </div>
  );
}
