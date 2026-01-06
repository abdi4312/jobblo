import styles from "./SupportPage.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { useEffect } from "react";

export default function SupportPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title="Support" buttonText="Tilbake" />
      <div className={styles.hero}>
        <h1>Support</h1>
        <p className={styles.subtitle}>Vi er her for å hjelpe deg</p>
      </div>

      <div className={styles.content}>
        <section className={styles.faq}>
          <h2>Ofte stilte spørsmål</h2>

          <div className={styles.faqItem}>
            <h3>Hvordan registrerer jeg meg?</h3>
            <p>
              Klikk på "Registrer deg" øverst på siden og fyll ut skjemaet med
              din informasjon. Du vil motta en bekreftelse på e-post når
              registreringen er fullført.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Hvordan publiserer jeg et oppdrag?</h3>
            <p>
              Når du er logget inn, klikk på "+" ikonet i headeren. Fyll ut
              informasjon om oppdraget, legg til bilder, og publiser. Du vil
              starte å motta tilbud fra kvalifiserte tjenesteleverandører.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Er det trygt å betale gjennom Jobblo?</h3>
            <p>
              Ja! Vi bruker Vipps for sikker betaling. Pengene holdes i
              deponering til jobben er fullført og godkjent av deg. Dette
              beskytter både deg som kunde og tjenesteleverandøren.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Hvordan fungerer anmeldelsessystemet?</h3>
            <p>
              Etter at et oppdrag er fullført, kan både kunde og
              tjenesteleverandør gi hverandre anmeldelser. Disse anmeldelsene
              er verifiserte og hjelper andre brukere med å ta informerte
              beslutninger.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Hva koster det å bruke Jobblo?</h3>
            <p>
              Det er gratis å registrere seg og browse tjenester. Vi tar en
              liten provisjon (10%) på fullførte oppdrag for å dekke
              plattformens kostnader og sikkerhet.
            </p>
          </div>

          <div className={styles.faqItem}>
            <h3>Hvordan kontakter jeg support?</h3>
            <p>
              Du kan sende oss en e-post til support@jobblo.no eller bruke
              kontaktskjemaet nedenfor. Vi svarer som regel innen 24 timer.
            </p>
          </div>
        </section>

        <section className={styles.contact}>
          <h2>Kontakt oss</h2>
          <p>Fant du ikke svar på spørsmålet ditt? Ta kontakt med oss!</p>

          <form className={styles.contactForm}>
            <div className={styles.formGroup}>
              <label>Navn</label>
              <input type="text" placeholder="Ditt navn" />
            </div>

            <div className={styles.formGroup}>
              <label>E-post</label>
              <input type="email" placeholder="din@epost.no" />
            </div>

            <div className={styles.formGroup}>
              <label>Emne</label>
              <input type="text" placeholder="Hva gjelder det?" />
            </div>

            <div className={styles.formGroup}>
              <label>Melding</label>
              <textarea rows={6} placeholder="Beskriv ditt spørsmål..."></textarea>
            </div>

            <button type="submit" className={styles.submitButton}>
              Send melding
            </button>
          </form>

          <div className={styles.contactInfo}>
            <h3>Annen kontaktinformasjon</h3>
            <p>📧 E-post: support@jobblo.no</p>
            <p>📞 Telefon: +47 123 45 678</p>
            <p>🕐 Åpningstider: Man-Fre 09:00-17:00</p>
          </div>
        </section>
      </div>
    </div>
  );
}
