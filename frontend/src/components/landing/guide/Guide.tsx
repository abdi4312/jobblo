import styles from "./Guide.module.css";
import { GuideStep } from "./guideSteps/GuideStep.tsx";

export function Guide() {
  return (
    <>
      <div className={styles.guideContainer}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          <h2>Slik Fungerer Jobblo</h2>
          <div className={styles.guideStepContainer}>
            <GuideStep
              title={"1. Last ned Jobblo"}
              subtitle={"Last ned jobblo for å starte eventyret!"}
            />
            <GuideStep
              title={"2. Start å søke"}
              subtitle={
                "Gjennom jobblo vil du få muligheten til å se gjennom tusenavis av jobbannonser!"
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
