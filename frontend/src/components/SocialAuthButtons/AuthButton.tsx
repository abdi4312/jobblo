import styles from "./AuthButton.module.css";

export default function SocialAuthButtons() {
  const handleGoogle = () => {
    window.location.href = `${import.meta.env.VITE_MAIN_URL}/api/auth/google`;
  };

  const handleVipps = () => {
    window.location.href = `${import.meta.env.VITE_MAIN_URL}/api/auth/vipps`;
  }

  return (
    <div className={styles.socialAuth}>
      <button className={styles.authBtn} onClick={handleGoogle}>
        <svg width="16" height="16" data-view-component="true">
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            data-view-component="true"
            className="octicon color-fg-default"
          >
            <g clipPath="url(#clip0_643_9687)">
              <path
                d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z"
                fill="#EA4335"
              ></path>
              <path
                d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z"
                fill="#4285F4"
              ></path>
              <path
                d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z"
                fill="#FBBC05"
              ></path>
              <path
                d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z"
                fill="#34A853"
              ></path>
            </g>
            <defs>
              <clipPath id="clip0_643_9687">
                <rect width="16" height="16" fill="white"></rect>
              </clipPath>
            </defs>
          </svg>
        </svg>

        <span>Continue with Google</span>
      </button>

      <button className={styles.authBtn} onClick={handleVipps}>
        <span className={styles.appleIcon}>
          {/* <img alt="vipps mobilepay logo" src={vippsLogo}></img> */}
        </span>
        <span>Continue with Vipps</span>
      </button>
    </div>
  );
}
