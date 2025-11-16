import styles from "./Subscription.module.css";
import { Radio } from "antd";

export function Subscription() {
  return (
    <>
      <div className={styles.subscriptionContainer}>
        <div className={styles.upperContainerBg}>
          <div className={styles.upperContainer}>
            <h3>Abonner slik at oppdragene dine blir gjort effektivt.</h3>
            <div className={styles.radioContainer}>
              <Radio.Group buttonStyle={"solid"} defaultValue={"a"}>
                <Radio.Button value={"a"}>Måndelig</Radio.Button>
                <Radio.Button value={"b"}>Årlig</Radio.Button>
              </Radio.Group>
            </div>
          </div>
        </div>
        <div className={styles.lowerContainer}>
          <h3>Abonement</h3>
          <div className={styles.listContainer}>
            <ul>
              <li>Økt antall visninger</li>
              <li>Økt antall kontakt oppretting</li>
              <li>Økt maks grense for intekt</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
