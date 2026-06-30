import styles from './TeamPage.module.css';
import { ProfileTitleWrapper } from '../../components/layout/body/profile/ProfileTitleWrapper';
import { useEffect } from 'react';

export default function TeamPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title="Møt teamet" buttonText="Tilbake" />
      <div className={styles.hero}>
        <h1>Møt teamet</h1>
        <p className={styles.subtitle}>Menneskene som gjør Jobblo til virkelighet</p>
      </div>

      <div className={styles.content}>
        <section className={styles.intro}>
          <p>
            Vi er et dedikert team av utviklere, designere og forretningsutviklere som brenner for å
            skape den beste plattformen for tjenester i Norge. Vår mangfoldige bakgrunn og
            ekspertise gjør at vi kan tilby en helhetlig og brukervennlig opplevelse.
          </p>
        </section>

        <div className={styles.team}>
          <div className={styles.memberCard}>
            <div className={styles.avatar}>👨‍💼</div>
            <h3>Ola Nordmann</h3>
            <p className={styles.role}>CEO & Grunnlegger</p>
            <p className={styles.bio}>
              Med 10 års erfaring innen tech-bransjen, leder Ola visjonen for Jobblo mot fremtiden.
            </p>
          </div>

          <div className={styles.memberCard}>
            <div className={styles.avatar}>👩‍💻</div>
            <h3>Kari Hansen</h3>
            <p className={styles.role}>CTO</p>
            <p className={styles.bio}>
              Kari sørger for at vår tekniske plattform alltid er sikker, skalerbar og
              brukervennlig.
            </p>
          </div>

          <div className={styles.memberCard}>
            <div className={styles.avatar}>👨‍🎨</div>
            <h3>Erik Johnsen</h3>
            <p className={styles.role}>Design Lead</p>
            <p className={styles.bio}>
              Erik skaper de vakre og intuitive designene som gjør Jobblo lett å bruke.
            </p>
          </div>

          <div className={styles.memberCard}>
            <div className={styles.avatar}>👩‍💼</div>
            <h3>Line Andreassen</h3>
            <p className={styles.role}>Customer Success</p>
            <p className={styles.bio}>
              Line sørger for at alle våre brukere får en fantastisk opplevelse på Jobblo.
            </p>
          </div>
        </div>

        <section className={styles.joinUs}>
          <h2>Vil du bli med på laget?</h2>
          <p>
            Vi er alltid på utkikk etter talentfulle mennesker som vil være med på å bygge
            fremtidens plattform for tjenester.
          </p>
          <button className={styles.joinButton}>Se ledige stillinger</button>
        </section>
      </div>
    </div>
  );
}
