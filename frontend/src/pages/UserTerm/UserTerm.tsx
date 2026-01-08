export default function JobbloUserTerm() {
  const sections = [
    {
      id: 1,
      title: "Din bruk av Jobblo",
      content: `Jobblo er en digital markedsplass som kobler arbeidsgivere og jobbsøkere. Som bruker har du tilgang til å legge ut og søke på jobber, kommunisere med andre brukere og benytte deg av de verktøyene som er tilgjengelige på plattformen.

      Funksjonalitet på plattformen:
      • Filtrering og sortering: Til venstre på siden finner du et filtreringspanel der du kan sortere jobber basert på kategori, lokasjon, pris og hvor mye det haster. Dette filteret lar deg tilpasse visningen av jobber i hovedvinduet.
      • Jobbvisning: Hoveddelen av siden viser en liste over jobber som matcher dine filtervalg. Du kan sortere disse jobbene etter pris, publiseringsdato og hastegrad.
      • Brukerkonto: For å kunne legge ut jobber eller søke på dem, må du opprette en brukerkonto. Du er ansvarlig for å holde kontoinformasjonen din oppdatert og sikker.`,
    },
    {
      id: 2,
      title: "Generelle forpliktelser",
      content: `Ved å bruke Jobblo, godtar du følgende:
      • Du er ansvarlig for all aktivitet som skjer på din brukerkonto.
      • Du må ikke bruke plattformen til ulovlige eller upassende formål.
      • Du må ikke legge ut innhold som er villedende, støtende, ærekrenkende eller som bryter andres rettigheter.
      • Du må ikke forsøke å tilegne deg uautorisert tilgang til plattformen, andre brukeres kontoer eller informasjon.
      • Du er ansvarlig for å sikre at informasjonen du legger ut er korrekt og sannferdig.`,
    },
    {
      id: 3,
      title: "Publisering av jobber og innhold",
      content: `• Ansvar for innhold: Du er fullt ut ansvarlig for innholdet i jobbene du legger ut, inkludert beskrivelser, bilder og priser. Jobblo AS har rett til å fjerne eller endre innhold som vurderes å bryte disse vilkårene, uten forvarsel.
      
      • Bilder og tekst: Du må kun bruke bilder og tekst du har rettighetene til. Vær spesielt oppmerksom på personvern dersom du bruker bilder av enkeltpersoner.
      • Pris og hastegrad: Alle jobber skal ha en relevant pris og hastegrad. Disse opplysningene er viktige for at filterfunksjonene skal fungere som tiltenkt.
      • Kommunikasjon: All kommunikasjon mellom brukere skal foregå på en saklig og respektfull måte.`,
    },
    {
      id: 4,
      title: "Ansvarsfraskrivelse og ansvarsbegrensning",
      content: `• Tjenestens tilgjengelighet: Jobblo AS garanterer ikke at tjenesten vil være uten avbrudd eller feilfri. Vi vil imidlertid gjøre vårt ytterste for å rette opp feil og mangler så raskt som mulig.
      • Transaksjoner og avtaler: Jobblo AS er kun en plattform som fasiliterer kontakt mellom brukere. Enhver avtale som inngås mellom en arbeidsgiver og en jobbsøker er en avtale mellom disse partene alene. Jobblo AS er ikke ansvarlig for eventuelle brudd på avtaler, kvaliteten på arbeidet som utføres, eller betalingsoppgjør.
      • Erstatningsansvar: Under ingen omstendigheter vil Jobblo AS være ansvarlig for tap eller skade som oppstår som følge av bruk av plattformen, med mindre tapet skyldes grov uaktsomhet fra vår side.`,
    },
    {
      id: 5,
      title: "Immaterielle rettigheter",
      content: `Alt innhold på Jobblo, inkludert design, tekst og grafikk, er beskyttet av opphavsrett og annen immaterialrett som tilhører Jobblo AS. Du har ikke lov til å kopiere, endre eller distribuere innhold fra plattformen uten skriftlig samtykke fra Jobblo AS.`,
    },
    {
      id: 6,
      title: "Endringer i vilkårene",
      content: `Jobblo AS forbeholder seg retten til å endre disse vilkårene når som helst. Vesentlige endringer vil bli varslet på plattformen eller via e-post. Din fortsatte bruk av tjenesten etter at endringene er publisert, anses som en aksept av de nye vilkårene.`,
    },
    {
      id: 7,
      title: "Kontaktinformasjon",
      content: `Har du spørsmål om disse brukervilkårene, kan du kontakte Jobblo AS med organisasjonsnummer 931684930.`,
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.mainTitle}>Brukervilkår – Jobblo</h1>

        <p style={styles.lastUpdated}>Last updated: 2026-01-08</p>

        <div style={styles.introText}>
          <p style={styles.paragraph}>
            Disse brukervilkårene ("vilkårene") regulerer din bruk av
            Jobblo-plattformen, som eies og drives av Jobblo AS,
            organisasjonsnummer 931684930. Ved å bruke plattformen, godtar du å
            være bundet av disse vilkårene. Hvis du ikke godtar vilkårene, må du
            ikke bruke tjenesten.
          </p>
        </div>

        {sections.map((section) => (
          <div
            key={section.id}
            id={`section-${section.id}`}
            style={styles.section}
          >
            <h3 style={styles.sectionTitle}>
              {section.id}. {section.title}
            </h3>
            <p style={styles.sectionContent}>{section.content}</p>
          </div>
        ))}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Dette dokumentet er utformet for å være i samsvar med norsk
            lovgivning og beste praksis.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    padding: "40px 20px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  content: {
    maxWidth: "900px",
    margin: "0 auto",
  },
  mainTitle: {
    fontSize: "48px",
    fontWeight: "700",
    marginBottom: "30px",
    lineHeight: "1.2",
  },
  lastUpdated: {
    fontSize: "18px",
    marginBottom: "30px",
  },
  selectContainer: {
    marginBottom: "40px",
  },
  selectLabel: {
    fontSize: "18px",
    marginRight: "10px",
  },
  select: {
    padding: "8px 12px",
    fontSize: "16px",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
  },
  introText: {
    marginBottom: "40px",
  },
  paragraph: {
    fontSize: "18px",
    lineHeight: "1.6",
    marginBottom: "20px",
  },
  sectionHeading: {
    fontSize: "24px",
    fontWeight: "600",
    marginBottom: "20px",
    marginTop: "40px",
  },
  tocList: {
    listStyle: "none",
    padding: "0",
    marginBottom: "40px",
  },
  tocItem: {
    marginBottom: "12px",
  },
  tocLink: {
    textDecoration: "underline",
    fontSize: "18px",
    transition: "color 0.3s",
  },
  sectionTitle: {
    fontSize: "28px",
    fontWeight: "600",
    marginBottom: "15px",
  },
  sectionContent: {
    fontSize: "18px",
    lineHeight: "1.6",
    whiteSpace: "pre-line",
  },
  footer: {
    marginTop: "60px",
    paddingTop: "30px",
  },
  footerText: {
    fontSize: "16px",
    fontStyle: "italic",
    lineHeight: "1.6",
  },
};
