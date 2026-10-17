const nodemailer = require('nodemailer');

/**
 * Creates and returns a configured nodemailer transporter.
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const RECOVERY_COPY = {
  payment_failed: {
    subject: 'Betalingen for Jobblo-abonnementet mislyktes',
    heading: 'Vi kunne ikke behandle betalingen',
    body: 'Stripe vil forsøke å behandle betalingen på nytt. Oppdater betalingsmåten din før fristen for å beholde abonnementet.',
  },
  reminder_day_3: {
    subject: 'Påminnelse: oppdater betalingsmåten din',
    heading: 'Betalingen venter fortsatt',
    body: 'Abonnementet ditt er fortsatt i betalingsperioden for gjenoppretting. Oppdater betalingsmåten før fristen for å beholde de betalte fordelene.',
  },
  reminder_day_6: {
    subject: 'Siste påminnelse om Jobblo-abonnementet',
    heading: 'Fristen nærmer seg',
    body: 'Hvis betalingen ikke er løst innen fristen, blir abonnementet kansellert og betalte fordeler avsluttes.',
  },
  payment_recovered: {
    subject: 'Betalingen for Jobblo-abonnementet er bekreftet',
    heading: 'Betalingen er gjenopprettet',
    body: 'Stripe har bekreftet betalingen. Abonnementet fortsetter, og betalingspåminnelsene er stoppet.',
  },
  subscription_canceled: {
    subject: 'Jobblo-abonnementet er kansellert',
    heading: 'Abonnementet er kansellert',
    body: 'Betalingen ble ikke gjenopprettet innen fristen. Betalte abonnementsfordeler er avsluttet. Kontohistorikken din er beholdt.',
  },
};

async function sendSubscriptionRecoveryEmail({
  to,
  name,
  kind,
  gracePeriodEndsAt,
  frontendUrl,
}) {
  const copy = RECOVERY_COPY[kind] || (/^reminder_day_[1-6]$/.test(kind) ? {
    subject: 'Påminnelse: oppdater betalingsmåten din',
    heading: 'Betalingen venter fortsatt',
    body: 'Abonnementet ditt er fortsatt i betalingsperioden for gjenoppretting. Oppdater betalingsmåten før fristen for å beholde de betalte fordelene.',
  } : null);
  if (!copy) throw new Error('Unknown subscription recovery email type');
  let origin;
  try {
    origin = new URL(frontendUrl);
    if (!['http:', 'https:'].includes(origin.protocol)) throw new Error('invalid scheme');
  } catch {
    throw new Error('FRONTEND_URL must be a valid http(s) URL for recovery emails');
  }
  const billingUrl = new URL('/profile/settings/subscriptions', origin).toString();
  const deadline = gracePeriodEndsAt instanceof Date && Number.isFinite(gracePeriodEndsAt.getTime())
    ? new Intl.DateTimeFormat('nb-NO', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(gracePeriodEndsAt) + ' UTC'
    : null;
  const paragraph = deadline
    ? `<p>Betalingsfristen er <strong>${escapeHtml(deadline)}</strong>.</p>`
    : '';
  const transporter = createTransporter();

  await transporter.sendMail({
    from: `"Jobblo" <${process.env.SMTP_USER}>`,
    to,
    subject: copy.subject,
    text: [
      `Hei ${name || 'der'},`,
      '',
      copy.body,
      deadline ? `Betalingsfrist: ${deadline}.` : '',
      `Betalingsinnstillinger: ${billingUrl}`,
    ].filter(Boolean).join('\n'),
    html: `<!doctype html><html lang="no"><meta charset="utf-8"><body>
      <h1>${escapeHtml(copy.heading)}</h1>
      <p>Hei ${escapeHtml(name || 'der')},</p>
      <p>${escapeHtml(copy.body)}</p>
      ${paragraph}
      <p><a href="${escapeHtml(billingUrl)}">Åpne abonnementsinnstillinger</a></p>
      <p>Ikke svar med kortopplysninger på denne e-posten.</p>
    </body></html>`,
  });
}

/**
 * Sends a 6-digit OTP email for password reset.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} userName - Recipient's name
 */
const sendOtpEmail = async (toEmail, otp, userName) => {
  const transporter = createTransporter();

  // Split OTP into individual digits for styled boxes
  const digits = otp.split('');

  const digitBoxStyle =
    'display:inline-block;width:48px;height:56px;line-height:56px;text-align:center;' +
    'font-size:28px;font-weight:700;color:#111827;background:#f3f4f6;' +
    'border-radius:10px;margin:0 4px;letter-spacing:0;';

  const digitBoxesHtml = digits
    .map((d) => `<span style="${digitBoxStyle}">${d}</span>`)
    .join('');

  const mailOptions = {
    from: `"Jobblo" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: 'Din verifiseringskode – Jobblo',
    html: `
      <!DOCTYPE html>
      <html lang="no">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
        <title>Verifiseringskode</title>
      </head>
      <body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="520" cellpadding="0" cellspacing="0"
                style="background:#ffffff;border-radius:16px;overflow:hidden;
                       box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                <!-- Header -->
                <tr>
                  <td style="background:#000;padding:28px 40px;text-align:center;">
                    <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;
                               letter-spacing:-0.5px;">Jobblo</h1>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:40px 40px 32px;">
                    <h2 style="color:#111827;font-size:20px;font-weight:700;
                               margin:0 0 8px;">Hei, ${userName || 'der'}!</h2>
                    <p style="color:#6B7280;font-size:15px;line-height:1.6;margin:0 0 32px;">
                      Vi mottok en forespørsel om å tilbakestille passordet ditt.
                      Bruk koden nedenfor. Den er gyldig i <strong>10 minutter</strong>.
                    </p>

                    <!-- OTP Boxes -->
                    <div style="text-align:center;margin-bottom:32px;">
                      ${digitBoxesHtml}
                    </div>

                    <p style="color:#9CA3AF;font-size:13px;line-height:1.6;margin:0;">
                      Hvis du ikke ba om dette, kan du trygt ignorere denne e-posten.
                      Passordet ditt forblir uendret.
                    </p>
                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background:#f9fafb;padding:18px 40px;
                             border-top:1px solid #e5e7eb;text-align:center;">
                    <p style="color:#9CA3AF;font-size:12px;margin:0;">
                      © ${new Date().getFullYear()} Jobblo. Alle rettigheter forbeholdt.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOtpEmail, sendSubscriptionRecoveryEmail };
