export default function AboutPage() {
  const sections = [
    {
      id: 1,
      title: 'JOBBLO \u2014 JOBBMARKEDSPLASSEN SOM GJ\u00D8R DET ENKLERE \u00C5 FINNE RIKTIG MATCH',
      content:
        'Jobblo ble startet med en enkel id\u00E9: \u00E5 gj\u00F8re veien mellom jobb\u00F8kere og arbeidsgivere kortere, tydeligere og mer menneskelig.\n\nVi mener jobb\u00F8king ikke trenger \u00E5 v\u00E6re tungvint \u2014 verken for deg som leter etter din neste jobb, eller for deg som skal finne riktig kandidat til teamet ditt.\n\njobblo.no er en norsk jobbmarkedsplass hvor arbeidsgivere kan publisere stillingsannonser, og jobb\u00F8kere kan finne, s\u00F8ke p\u00E5 og f\u00F8lge opp jobber de er interessert i \u2014 alt p\u00E5 ett sted.',
    },
    {
      id: 2,
      title: 'HVA VI TILBYR',
      content:
        'For jobb\u00F8kere:\nBla gjennom relevante stillinger, bygg en profil som viser hvem du er, og s\u00F8k direkte gjennom plattformen. Du kan kommunisere med arbeidsgivere gjennom v\u00E5rt meldingssystem og holde oversikt over s\u00F8knadene dine underveis.\n\nFor arbeidsgivere:\nPubliser stillingsannonser, n\u00E5 ut til aktuelle kandidater, og administrer s\u00F8knader og samtaler samlet p\u00E5 ett sted \u2014 uten un\u00F8dvendig friksjon.',
    },
    {
      id: 3,
      title: 'V\u00C5R TILN\u00C6RMING',
      content:
        'Vi bygger Jobblo iterativt og med tett \u00F8re til brukerne v\u00E5re. Det betyr at vi kontinuerlig forbedrer plattformen \u2014 fra s\u00F8keopplevelsen til meldingssystemet \u2014 basert p\u00E5 faktisk bruk og tilbakemeldinger, ikke antakelser.',
    },
    {
      id: 4,
      title: 'TEAMET',
      content:
        'Jobblo drives av et lite, dedikert team med bakgrunn fra teknologi og produktutvikling. Vi liker \u00E5 bygge ting selv, teste raskt, og forbedre kontinuerlig.',
    },
    {
      id: 5,
      title: 'KONTAKT OSS',
      content:
        'Har du sp\u00F8rsm\u00E5l, tilbakemeldinger, eller \u00F8nsker \u00E5 samarbeide med oss? Ta gjerne kontakt.\n\nJobblo AS\nOrg. nr 931 684 930\nMartin Johansens veg 60\n2070 R\u00E5holt\nNorge',
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.mainTitle}>Om oss</h1>

        <p style={styles.lastUpdated}>Sist oppdatert: 2026-01-08</p>

        <div style={styles.introText}>
          <p style={styles.paragraph}>
            Jobblo \u2014 jobbmarkedsplassen som gj\u00F8r det enklere \u00E5 finne riktig match.
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.id} id={`section-${section.id}`} style={{ marginBottom: '40px' }}>
            <h3 style={styles.sectionTitle}>
              {section.id}. {section.title}
            </h3>
            <p style={styles.sectionContent}>{section.content}</p>
          </div>
        ))}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Takk for at du bruker Jobblo. Vi jobber hver dag for \u00E5 gj\u00F8re plattformen bedre for deg.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '40px 20px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  content: {
    maxWidth: '920px',
    margin: '0 auto',
  },
  mainTitle: {
    fontSize: '48px',
    fontWeight: '700',
    marginBottom: '30px',
    lineHeight: '1.2',
  },
  lastUpdated: {
    fontSize: '18px',
    marginBottom: '30px',
  },
  introText: {
    marginBottom: '40px',
  },
  paragraph: {
    fontSize: '18px',
    lineHeight: '1.6',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '15px',
  },
  sectionContent: {
    fontSize: '18px',
    lineHeight: '1.6',
    whiteSpace: 'pre-line' as const,
  },
  footer: {
    marginTop: '60px',
    paddingTop: '30px',
    borderTop: '1px solid #444444',
  },
  footerText: {
    fontSize: '16px',
    fontStyle: 'italic',
    lineHeight: '1.6',
  },
};
