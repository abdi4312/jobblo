import styles from "./OmOssPage.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { useEffect } from "react";

export default function OmOssPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title="Om Jobblo" buttonText="Tilbake" />
      <div className={styles.hero}>
        <h1>Om Jobblo</h1>
        <p className={styles.subtitle}>
          Din plattform for å finne og tilby tjenester
        </p>
      </div>

      <div className={styles.content}>
        <section className={styles.section}>
          <h2>Vår historie</h2>
          <p>
            Jobblo ble etablert med en visjon om å gjøre det enklere for folk å
            finne og tilby tjenester i sitt lokalområde. Vi tror på å skape
            verdifulle forbindelser mellom de som trenger hjelp og de som kan
            tilby den.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Vår misjon</h2>
          <p>
            Vi ønsker å demokratisere tilgang til arbeid og tjenester ved å
            tilby en trygg, pålitelig og brukervennlig plattform som setter
            kvalitet og tillit i høysetet.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Våre verdier</h2>
          <div className={styles.values}>
            <div className={styles.valueCard}>
              <h3>Tillit</h3>
              <p>Vi bygger tillitsfulle relasjoner gjennom verifisering og anmeldelser</p>
            </div>
            <div className={styles.valueCard}>
              <h3>Kvalitet</h3>
              <p>Vi sikrer høy kvalitet på alle tjenester i vårt nettverk</p>
            </div>
            <div className={styles.valueCard}>
              <h3>Enkelhet</h3>
              <p>Vi gjør det enkelt å finne og tilby tjenester</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
