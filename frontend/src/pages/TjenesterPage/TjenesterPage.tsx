import styles from "./TjenesterPage.module.css";

export default function TjenesterPage() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1>Våre tjenester</h1>
        <p className={styles.subtitle}>
          Alt du trenger for å finne eller tilby tjenester
        </p>
      </div>

      <div className={styles.content}>
        <div className={styles.services}>
          <div className={styles.serviceCard}>
            <div className={styles.icon}>🔍</div>
            <h3>Finn tjenester</h3>
            <p>
              Bla gjennom tusenvis av kvalifiserte tjenesteleverandører i ditt
              område. Bruk våre smarte filtre for å finne nøyaktig det du trenger.
            </p>
          </div>

          <div className={styles.serviceCard}>
            <div className={styles.icon}>💼</div>
            <h3>Tilby dine tjenester</h3>
            <p>
              Publiser dine tjenester og nå tusenvis av potensielle kunder.
              Bygg omdømme gjennom vårt anmeldelsessystem.
            </p>
          </div>

          <div className={styles.serviceCard}>
            <div className={styles.icon}>⭐</div>
            <h3>Anmeldelser og rating</h3>
            <p>
              Les ærlige anmeldelser fra tidligere kunder. Vårt verifiserte
              anmeldelsessystem sikrer kvalitet og tillit.
            </p>
          </div>

          <div className={styles.serviceCard}>
            <div className={styles.icon}>💳</div>
            <h3>Sikker betaling</h3>
            <p>
              Trygg og enkel betaling med Vipps. Vi holder pengene i deponering
              til jobben er fullført og godkjent.
            </p>
          </div>

          <div className={styles.serviceCard}>
            <div className={styles.icon}>💬</div>
            <h3>Meldinger</h3>
            <p>
              Kommuniser direkte med tjenesteleverandører gjennom vår sikre
              meldingsplattform. Hold alt på ett sted.
            </p>
          </div>

          <div className={styles.serviceCard}>
            <div className={styles.icon}>🛡️</div>
            <h3>Trygghet</h3>
            <p>
              Alle brukere er verifiserte. Vi tar trygghet på alvor og har
              systemer på plass for å beskytte både kunder og leverandører.
            </p>
          </div>
        </div>

        <section className={styles.cta}>
          <h2>Klar til å komme i gang?</h2>
          <p>Bli med Jobblo i dag og oppdag alle mulighetene</p>
          <button className={styles.ctaButton}>Registrer deg gratis</button>
        </section>
      </div>
    </div>
  );
}
