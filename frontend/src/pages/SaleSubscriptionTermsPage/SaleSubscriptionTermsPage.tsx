export default function JobbloTerms() {
  const sections = [
    {
      id: 1,
      title: "GENERELT",
      content:
        "Disse vilkårene regulerer all bruk av Jobblo, herunder kjøp av tjenester, abonnement, formidling av oppdrag og betaling.\n Ved å registrere seg eller benytte tjenesten, bekrefter brukeren å ha lest, forstått og akseptert vilkårene fullt ut.",
    },
    {
      id: 2,
      title: "DEFINISJONER",
      content:
        "Jobblo: Plattformen som eies og drives av Jobblo.\nKunde: Enhver person eller virksomhet som benytter Jobblo.\nForbruker: Privatperson som handler utenfor næringsvirksomhet.\nNæringskunde: Bedrift, organisasjon eller selvstendig næringsdrivende.\nUtførende: Tjenesteyter som tilbyr arbeid via Jobblo.",
    },
    {
      id: 3,
      title: "PARTENES ROLLER",
      content:
        "Jobblo er en ren formidler og er ikke part i avtalen mellom Kunde og Utførende.\n Utførende er fullt ansvarlig for tjenestens utførelse, kvalitet og lovlighet.",
    },
    {
      id: 4,
      title: "AVTALEINNGÅELSE",
      content:
        "Avtale anses inngått når Kunde fullfører bestilling og denne bekreftes i systemet. Avtalen er bindende.",
    },
    {
      id: 5,
      title: "PRISER OG BETALING",
      content:
        "Alle priser er i NOK. Betaling skjer via Jobblo sine betalingsløsninger. \n Ved forsinket betaling påløper renter og gebyrer.",
    },
    {
      id: 6,
      title: "ABONNEMENT",
      content:
        "Jobblo tilbyr abonnement for både forbrukere og næringskunder.\n Abonnement løper inntil det sies opp i henhold til vilkårene.",
    },
    {
      id: 7,
      title: "AUTOMATISK FORNYELSE",
      content:
        "Abonnement fornyes automatisk med mindre det sies opp innen oppsigelsesfristen.",
    },
    {
      id: 8,
      title: "OPPSIGELSE",
      content:
        "Forbrukere kan si opp abonnement når som helst etter eventuell bindingstid.\n Næringskunder må si opp minimum 30 dager før ny periode.",
    },
    {
      id: 9,
      title: "ANGRERETT – FORBRUKER",
      content:
        "Forbrukere har 14 dagers angrerett etter angrerettloven.\n Ved uttrykkelig samtykke til umiddelbar oppstart, bortfaller angreretten.",
    },
    {
      id: 10,
      title: "ANGRERETT – NÆRINGSKUNDER",
      content:
        "Angrerett gjelder ikke for næringskunder.\n Ved kjøp bekrefter næringskunden å fraskrive seg angreretten.",
    },
    {
      id: 11,
      title: "MINDREÅRIGE",
      content:
        "Tjenesten kan kun benyttes av personer over 18 år.\n Avtaler inngått av mindreårige er ugyldige.",
    },
    {
      id: 12,
      title: "RETUR OG KANSELLERING",
      content:
        "Jobblo formidler tjenester. Retur er ikke mulig.\n Kansellering kan medføre betalingsplikt.",
    },
    {
      id: 13,
      title: "REKLAMASJON OG KLAGE",
      content:
        "Reklamasjon må fremsettes uten ugrunnet opphold.\n Jobblo kan mekle, men er ikke ansvarlig for utført arbeid.",
    },
    {
      id: 14,
      title: "ANSVARSBEGRENSNING",
      content:
        "Jobblo er kun ansvarlig for grov uaktsomhet.\n Indirekte tap erstattes ikke.",
    },
    {
      id: 15,
      title: "ENDRINGER",
      content:
        "Jobblo kan endre vilkårene. Endringer publiseres på nettstedet.",
    },
    {
      id: 16,
      title: "LOVVALG OG VERNETING",
      content: "Norsk rett gjelder. Oslo tingrett er verneting.",
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.mainTitle}>Vilkår for bruk og abonnement – Jobblo</h1>

        <p style={styles.lastUpdated}>Last updated: 2026-01-08</p>

        <div style={styles.introText}>
          <p style={styles.paragraph}>
            Dette dokumentet utgjør fullstendige, bindende og juridisk gyldige
            salgs-, bruks- og abonnementsvilkår for bruk av Jobblo-plattformen.
          </p>
        </div>

        {sections.map((section) => (
          <div key={section.id} id={`section-${section.id}`}>
            <h3 style={styles.sectionTitle}>
              {section.id}. {section.title}
            </h3>
            <p style={styles.sectionContent}>{section.content}</p>
          </div>
        ))}

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Dette dokumentet er utformet for å være i samsvar med norsk
            lovgivning og beste praksis, og etterligner profesjonelle
            markedsplasser som Mittanbud i struktur og presisjon.
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
    maxWidth: "920px",
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
    color: "#000000",
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
    borderTop: "1px solid #444444",
  },
  footerText: {
    fontSize: "16px",
    fontStyle: "italic",
    lineHeight: "1.6",
  },
};
