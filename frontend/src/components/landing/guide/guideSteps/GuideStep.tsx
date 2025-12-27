import styles from "./guideStep.module.css";

export function GuideStep({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <>
      <div className={styles.guideStepContainer}>
        <div className={styles.stepImage}>
          <span className="material-symbols-outlined" style={{ fontSize: '80px', color: 'var(--color-cta)' }}>
            {icon}
          </span>
        </div>
        <div className={styles.stepText}>
          <p className={styles.stepTextTitle}>{title}</p>
          <p className={styles.stepTextSubtitle}>{subtitle}</p>
        </div>
      </div>
    </>
  );
}
