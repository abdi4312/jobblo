import styles from "./guideStep.module.css";

export function GuideStep({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <>
      <div className={styles.guideStepContainer}>
        <div className={styles.stepImage}></div>
        <div className={styles.stepText}>
          <p className={styles.stepTextTitle}>{title}</p>
          <p className={styles.stepTextSubtitle}>{subtitle}</p>
        </div>
      </div>
    </>
  );
}
