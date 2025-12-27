import styles from "./AnnonsereglerPage.module.css";

export default function AnnonsereglerPage() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1>Annonseregler</h1>
        <p className={styles.subtitle}>
          Retningslinjer for publisering på Jobblo
        </p>
      </div>

      <div className={styles.content}>
        <section className={styles.intro}>
          <p>
            For å sikre en trygg og kvalitativ plattform for alle våre brukere,
            har vi satt opp noen grunnleggende regler for publisering av
            oppdrag og tjenester på Jobblo.
          </p>
        </section>

        <div className={styles.rules}>
          <div className={styles.ruleSection}>
            <h2>📝 Innholdskrav</h2>
            <ul>
              <li>
                Annonser må inneholde klare og nøyaktige beskrivelser av
                tjenesten eller oppdraget
              </li>
              <li>
                Bilder må være relevante og av god kvalitet. Ingen
                villedende bilder
              </li>
              <li>
                Priser må være realistiske og i tråd med markedets
                standarder
              </li>
              <li>
                Kontaktinformasjon må være korrekt og oppdatert
              </li>
            </ul>
          </div>

          <div className={styles.ruleSection}>
            <h2>🚫 Forbudt innhold</h2>
            <ul>
              <li>Ulovlige tjenester eller aktiviteter</li>
              <li>Vold, trusler eller hatefulle ytringer</li>
              <li>Seksuelt eller upassende innhold</li>
              <li>Falsk informasjon eller svindel</li>
              <li>Spam eller massepublisering av identiske annonser</li>
              <li>Piratkopiering eller brudd på opphavsrett</li>
              <li>Salg av våpen, narkotika eller farlige stoffer</li>
            </ul>
          </div>

          <div className={styles.ruleSection}>
            <h2>✅ God praksis</h2>
            <ul>
              <li>Bruk tydelige og beskrivende titler</li>
              <li>Inkluder relevante detaljer som sted, tidspunkt og varighet</li>
              <li>Last opp høykvalitetsbilder som viser arbeidet ditt</li>
              <li>Vær rask med å svare på henvendelser</li>
              <li>Oppretthold profesjonell kommunikasjon</li>
              <li>Oppdater eller fjern annonsen når oppdraget er fullført</li>
            </ul>
          </div>

          <div className={styles.ruleSection}>
            <h2>⚖️ Rettigheter og ansvar</h2>
            <ul>
              <li>
                Du er ansvarlig for innholdet du publiserer
              </li>
              <li>
                Jobblo forbeholder seg retten til å fjerne annonser som bryter
                våre regler
              </li>
              <li>
                Gjentatte brudd kan føre til suspensjon eller utestengelse fra
                plattformen
              </li>
              <li>
                Du må ha nødvendige tillatelser og forsikringer for tjenester
                som krever det
              </li>
              <li>
                Personopplysninger må behandles i henhold til GDPR
              </li>
            </ul>
          </div>

          <div className={styles.ruleSection}>
            <h2>🛡️ Rapportering</h2>
            <ul>
              <li>
                Hvis du oppdager innhold som bryter våre regler, vennligst
                rapporter det umiddelbart
              </li>
              <li>
                Vi undersøker alle rapporter og tar nødvendige tiltak
              </li>
              <li>
                Falske rapporter kan føre til konsekvenser for rapportøren
              </li>
            </ul>
          </div>

          <div className={styles.ruleSection}>
            <h2>📄 Brukervilkår</h2>
            <p>
              Ved å publisere på Jobblo godtar du våre fullstendige{" "}
              <a href="#" className={styles.link}>brukervilkår</a> og{" "}
              <a href="#" className={styles.link}>personvernserklæring</a>.
              Vi oppdaterer våre regler jevnlig for å sikre best mulig
              opplevelse for alle brukere.
            </p>
          </div>
        </div>

        <section className={styles.footer}>
          <p>
            Har du spørsmål om våre annonseregler? Kontakt oss på{" "}
            <a href="mailto:support@jobblo.no" className={styles.link}>
              support@jobblo.no
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
