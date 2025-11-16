import styles from "./Info.module.css";

import * as Icons from "../../../assets/icons";

export function Info() {
  return (
    <>
      <div className={styles.infoContainer}>
        <div className={styles.infoTitle}>
          <h2>Hva er </h2>
          <Icons.JobbloIcon className={styles.infoJobbloIcon} />
        </div>
        <div className={styles.textImageWrapper}>
          <div className={styles.infoTextContainer}>
            <p className={styles.infoText1}>
              Jobblo er en enkel plattfrom som tillatter trygg måte å finne,
              avtale og betale for småjobber og håndverkstjenester i hele Norge.
            </p>
            <p className={styles.infoText2}>
              Enten det gjelder plenklipping, barnepass, maling eller
              flyttehjelp, gjør vi det enkelt å finne folk du kan stole på, rett
              i nærheten. For privatpersoner, bedrifter og alle imellom.
            </p>
          </div>
          <img
            className={styles.womanGardening}
            src="src/assets/images/woman-gardening.png"
            alt="Person gardening"
          />
        </div>
      </div>
    </>
  );
}
