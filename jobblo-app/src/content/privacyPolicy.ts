/**
 * Source: frontend/src/pages/CookiePolicyPage/CookiePolicyPage.tsx
 * Web route: /cookies
 *
 * Despite the file name the web source covers full GDPR privacy topics —
 * behandlingsansvarlig, data use, rights, purposes, categories, retention,
 * login, sharing, authorities, EU/EEA transfers, security, children,
 * cookies, and contact. The mobile page is therefore titled
 * "Personvern og informasjonskapsler".
 *
 * DO NOT rewrite legal content. Mirror the source faithfully.
 * Stale product language is documented at the bottom of this file.
 */

export type PrivacySection = {
    id: number;
    title: string;
    content: string;
};

export const privacyPolicy = {
    title: 'Personvern og informasjonskapsler',
    lastUpdated: '2026-01-08',
    lastUpdatedDisplay: '8. januar 2026',
    intro:
        'Dette dokumentet gir et sammendrag av hvilke data vi samler inn, hvorfor vi samler dem inn, hvem de kan deles med, og hvordan du får tilgang til dine rettigheter knyttet til dine personopplysninger.',
    sections: [
        {
            id: 1,
            title: 'BEHANDLINGSANSVARLIG',
            content:
                'Jobblo AS («Jobblo») er behandlingsansvarlig for dine personopplysninger.\n\nHos Jobblo AS gir vi deg mulighet til å finne relevante jobber og dyktige kandidater gjennom vår nettbaserte jobbmarkedsplass jobblo.no. Vi tilbyr nettsted og tilhørende tjenester for jobbøkere og arbeidsgivere, og bruker data for å levere disse tjenestene under kontroll og ansvar av Jobblo AS.\n\nDet er viktig for oss å håndtere personopplysninger på en sikker måte, slik at vi kan motta og opprettholde brukernes tillit til oss og tjenesten vår. Vi verdsetter brukernes personvern.',
        },
        {
            id: 2,
            title: 'HVORDAN VI BRUKER DATA',
            content:
                'Vi bruker data for å utvikle, designe og optimalisere tjenesten vi tilbyr deg, basert på brukernes faktiske bruk av jobblo.no. Vi bruker også data for å tilpasse og øke relevansen til Jobblos markedsføringsaktiviteter.\n\nVi er transparente om vår behandling av personopplysninger, og forplikter oss til alltid å søke den rette balansen mellom personvern og kommersielle interesser.',
        },
        {
            id: 3,
            title: 'DINE RETTIGHETER SOM BRUKER OG DATASUBJEKT',
            content:
                'I henhold til europeisk (GDPR) og nasjonal personvernlovgivning har brukere juridisk definerte rettigheter knyttet til sine personopplysninger. Jobblo er fullt ut forpliktet til å støtte brukere i å få tilgang til og bruke disse rettighetene:\n\n• Retten til å bli informert — om hvordan vi behandler dine personopplysninger.\n• Retten til innsyn / retten til dataoverføring — du kan be om en kopi av personopplysningene vi har lagret om deg, i et strukturert og maskinlesbart format.\n• Retten til retting — du kan be oss rette unøyaktige eller ufullstendige opplysninger.\n• Retten til sletting — du kan be om at vi sletter opplysningene dine, med de begrensninger som følger av lovpålagte forpliktelser.\n• Retten til å begrense behandling og retten til å nekte behandling — samt til å trekke tilbake samtykke der behandlingen er basert på dette.\n• Retten til å hindre automatiske avgjørelser som har juridiske eller lignende følger for deg.\n\nDu kan styre en del behandlingsaktiviteter direkte i din brukerkonto på jobblo.no, blant annet å slå av og på e-postvarsler og administrere hvilke opplysninger som vises i din offentlige profil.\n\nJobblo har som mål å svare på alle forespørsler knyttet til disse rettighetene så raskt som mulig, og alltid innen 30 kalenderdager.',
        },
        {
            id: 4,
            title: 'FORMÅLENE JOBBLO BRUKER DINE PERSONOPPLYSNINGER TIL',
            content:
                'Hos Jobblo er vi forpliktet til å tilby en sikker og effektiv jobbmarkedsplass til brukerne våre. For å levere denne tjenesten behandler vi personopplysninger på en måte som balanserer forretningsmessig nødvendighet med databeskyttelse og enkeltpersoners personvern.\n\n1. Generell tjenestelevering — opprette og drifte brukerkonto, publisere og administrere stillingsannonser, matche jobbøkere med relevante stillinger.\n2. Kundeservice og support — besvare henvendelser fra jobbøkere og arbeidsgivere.\n3. Kommunikasjon mellom bruker og arbeidsgiver — meldingssystemet på jobblo.no, søknader og oppfølging av disse.\n4. Administrasjon av din Jobblo-konto — pålogging, profilinformasjon og kontoinnstillinger.\n5. Betaling for annonser og tjenester — fakturering og betalingsbehandling for arbeidsgivere som kjøper stillingsannonser eller tilleggstjenester.\n6. Produktforbedring og analyse — innsamling og analyse av bruksmønstre for å forbedre jobblo.no.\n7. Markedsføring — informere brukere om Jobblos egne tjenester via e-post eller andre kanaler, med mulighet for å reservere seg.\n8. Sikkerhet og svindelforebygging — beskytte tjenesten mot misbruk, falske annonser og uautorisert tilgang.\n9. Overholdelse av juridiske forpliktelser — som bokføring og skatterapportering.\n10. Visning av annonser — jobblo.no kan vise annonser fra tredjepartsnettverk for delvis å finansiere den gratis tjenesten.',
        },
        {
            id: 5,
            title: 'KATEGORIER AV PERSONOPPLYSNINGER OG OPPBEVARING',
            content:
                'Jobblo opererer med den generelle regelen om at vi kun oppbevarer brukernes personopplysninger så lenge som nødvendig for å oppfylle formålene dataene ble samlet inn for.\n\nKategorier av personopplysninger vi behandler:\n• Grunnleggende profildata — navn, e-postadresse, telefonnummer, CV-innhold, jobbønsker.\n• Kontodata — påloggingsinformasjon, kontoinnstillinger.\n• Betalingsinformasjon — for arbeidsgivere som kjøper annonser (behandles av vår betalingsleverandør).\n• Brukergenererte data — stillingsannonser, søknader, meldinger sendt via plattformen.\n• Atferdsmessige og tekniske data — IP-adresse, enhetsinformasjon, bruksmønstre på nettstedet.\n• Utledede data — for eksempel anbefalinger basert på tidligere søk og visninger.\n\nOppbevaringsprinsipper:\n• Kontoprofil og tilhørende data lagres så lenge kontoen er aktiv. Konti som har vært inaktive i 3 år eller mer, vil bli slettet etter forutgående varsel.\n• Stillingsannonser arkiveres eller slettes normalt 6 måneder etter at annonsen er avsluttet.\n• Atferdsmessig og teknisk data for produktforbedring og sikkerhetslogger lagres i inntil 18 måneder.\n• Betalings- og fakturainformasjon lagres så lenge kontoen er aktiv og videre i henhold til bokføringsloven (normalt 5 år).\n• Data knyttet til informasjonskapsler for annonsevisning lagres i 30 dager eller mindre.',
        },
        {
            id: 6,
            title: 'INNLOGGING PÅ JOBBLO-KONTO',
            content:
                'Vi tilbyr innlogging via e-post og/eller tredjepartsinnlogging. Der vi bruker engangskoder sendt på e-post, brukes disse utelukkende til verifisering av én økt og oppbevares ikke lenger enn nødvendig.',
        },
        {
            id: 7,
            title: 'HVORDAN DINE PERSONOPPLYSNINGER DELES MED ANDRE',
            content:
                'Når Jobblo behandler personopplysninger, deler vi noen ganger opplysningene med andre parter:\n\nDatabehandlere — selskaper som opererer under databehandleravtaler med Jobblo:\n• Infrastruktur og drift — hosting av jobblo.no (VPS-leverandør).\n• Betaling — betalingsformidler for kjøp av annonser og tjenester (f.eks. Stripe).\n• Analyse — verktøy for å forstå bruken av tjenesten.\n\nBehandlingsansvarlige — uavhengige selskaper som tar fullt ansvar for hvordan de bruker dataene dine:\n• Arbeidsgivere — når du søker på en stilling, deles søknaden og relevant profilinformasjon med arbeidsgiveren bak annonsen.\n• Annonsenettverk — jobblo.no kan vise annonser levert via tredjepartsnettverk (f.eks. Google AdSense).',
        },
        {
            id: 8,
            title: 'DELING MED OFFENTLIGE MYNDIGHETER',
            content:
                'Vi kan dele personopplysninger med offentlige myndigheter, som skattemyndigheter, politi eller andre offentlige organer, når det er påkrevd ved lov eller for å beskytte samfunnet vårt. Dette inkluderer:\n\n• Juridisk samsvar — rapportering av transaksjonsverdier til skattemyndighetene der det er lovpålagt.\n• Sikkerhet og svindelbekjempelse — deling av data for å forhindre svindel, falske annonser eller annen kriminell aktivitet.\n• Tvisteløsning — bistå brukere i tvister knyttet til stillingsannonser eller søknader.',
        },
        {
            id: 9,
            title: 'OVERFØRING AV DATA UTENFOR EU/EØS',
            content:
                'Der Jobblo benytter databehandlere lokalisert utenfor EU/EØS, gjør vi det kun der:\n\n• Vi anser mottakerlandet for å være tilfredsstillende i henhold til reglene fastsatt i GDPR, eller\n• Overføringen skjer i henhold til standard kontraktsklausuler definert av EU-kommisjonen, og vi har gjort en risikovurdering.',
        },
        {
            id: 10,
            title: 'INFORMASJONSSIKKERHET',
            content:
                'Vi tar egnede tekniske og organisatoriske tiltak for å holde et sikkerhetsnivå som er tilpasset risikoen, i tråd med artikkel 32 i GDPR. Dette inkluderer kryptering av data under overføring, tilgangskontroll, regelmessig testing av sikkerhetstiltak og effektiv avvikshåndtering.',
        },
        {
            id: 11,
            title: 'BARNS PERSONVERN',
            content:
                'Vi ønsker ikke å samle inn eller på annen måte behandle personopplysninger om barn under 15 år. Hvis barn under 15 år har gitt oss personopplysninger, vil vi slette informasjonen så snart vi blir oppmerksomme på situasjonen.',
        },
        {
            id: 12,
            title: 'VÅR BRUK AV INFORMASJONSKAPSLER',
            content:
                'Når du besøker jobblo.no kan vi og våre partnere bruke informasjonskapsler og lignende teknologier for å lagre informasjon for analyse, statistikk, ytelsesmåling, personalisering og eventuell annonsevisning.\n\nKategorier av informasjonskapsler vi bruker:\n• Strengt nødvendige — nødvendige for at nettstedet og innloggingen skal fungere.\n• Analyse og produktutvikling — for å forstå hvordan besøkende bruker jobblo.no.\n• Personalisering — for å huske dine preferanser.\n• Annonsering — dersom vi viser annonser via tredjepartsnettverk.\n\nVi innhenter samtykke til informasjonskapsler ved ditt første besøk. Du kan når som helst endre preferansene dine under innstillinger for informasjonskapsler.',
        },
        {
            id: 13,
            title: 'KONTAKT OG KLAGE',
            content:
                'Jobblo tar personvernet til våre brukere på alvor. Hvis du har et spørsmål eller ønsker å klage på hvordan vi behandler dine personopplysninger, kan du kontakte oss på personvern@jobblo.no.\n\nVi forplikter oss til å svare på henvendelser så raskt som mulig, og senest innen 30 dager.\n\nHvis du fortsatt ikke er fornøyd med vår behandling av personopplysninger, kan du når som helst henvende deg til Datatilsynet i Norge.',
        },
        {
            id: 14,
            title: 'KONTAKTINFORMASJON',
            content:
                'Jobblo AS\nOrg. nr 931 684 930\nMartin Johansens veg 60\n2070 Råholt\nNorge\n\nE-post: personvern@jobblo.no',
        },
    ] as PrivacySection[],
    footer:
        'Denne personvernerklæringen er utformet i samsvar med GDPR og norsk personvernlovgivning.',
};

/**
 * STALE PRODUCT LANGUAGE — for legal/product review, NOT silently corrected
 * ──────────────────────────────────────────────────────────────────────────
 * The policy as mirrored above contains terminology from an older product
 * definition. The following mismatches were identified. Do not edit legal
 * copy without explicit legal/product sign-off.
 *
 * 1. "jobbmarkedsplass" / "stillingsannonser" / "jobbøkere" / "arbeidsgivere"
 *    Current mobile product uses: customers, providers, tasks/services.
 *    The old employment-marketplace framing does not reflect current UX.
 *
 * 2. Section 4 purpose 1 — "publisere og administrere stillingsannonser,
 *    matche jobbøkere med relevante stillinger"
 *    Current product: customers post tasks, providers apply and are hired.
 *
 * 3. Section 4 purpose 5 — "Betaling for annonser og tjenester — fakturering
 *    og betalingsbehandling for arbeidsgivere som kjøper stillingsannonser"
 *    Current product: SafePay escrow, Stripe subscriptions, Stripe Connect
 *    payouts. No "job ad purchase" flow exists.
 *
 * 4. Section 5 — "Stillingsannonser arkiveres eller slettes normalt 6 måneder"
 *    These are now task/service listings, not job advertisements.
 *
 * 5. Section 7 — "Arbeidsgivere — når du søker på en stilling"
 *    Current flow: providers apply to customer-posted tasks via SafePay.
 *
 * ACCOUNT-CONTROL CLAIMS vs ACTUAL PRODUCT (Section 3)
 * ─────────────────────────────────────────────────────
 * Policy states: "Du kan styre en del behandlingsaktiviteter direkte i din
 * brukerkonto på jobblo.no, blant annet å slå av og på e-postvarsler og
 * administrere hvilke opplysninger som vises i din offentlige profil."
 *
 * Current mobile status:
 * - E-postvarsler: no mobile UI or backend preference toggle exists.
 *   Backend stores notificationsEnabled etc. in userStore but no mobile
 *   settings screen surfaces e-mail toggle.
 * - Offentlig profil synlighet: "Søkemotorsynlighet" row in Settings is
 *   disabled ("Kommer"). No visibility preference is wired.
 * This claim is currently only partially true on web and not functional
 * on mobile.
 *
 * SAFEPAY / STRIPE POLICY GAPS
 * ────────────────────────────
 * Current product uses SafePay (escrow) and Stripe Connect for provider
 * payouts. The policy references "Stripe" only as a payment processor for
 * ad purchases. SafePay escrow, Stripe Connect onboarding, and payout
 * flows are not described. Policy appears incomplete for these data flows.
 *
 * PUSH / DEVICE DATA GAPS
 * ───────────────────────
 * Mobile stores push tokens on the backend (pushNotifications.service.ts,
 * backend User model). Policy does not explicitly mention push notification
 * tokens or device registration data. "Atferdsmessige og tekniske data —
 * IP-adresse, enhetsinformasjon" may partially cover this but push tokens
 * are not named. Gap for legal review.
 *
 * LOCATION / GOOGLE MAPS GAPS
 * ───────────────────────────
 * Addresses screen uses expo-location (foreground device location) and
 * Google Maps for reverse geocoding. Policy mentions no location data
 * processing, no Google as a third-party processor. Gap for legal review.
 */
