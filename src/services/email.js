import logger from '../utils/logger.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Send a transactional email via Resend.
 * Set RESEND_API_KEY in backend/.env to enable.
 * Falls back to a console log in dev.
 *
 * @param {object} opts - { to, subject, html }
 */
export async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (IS_TEST) {
    logger.debug(`[EMAIL TEST MOCK] Suppressed real email to ${to}`);
    return { ok: true, mocked: true };
  }

  if (!apiKey) {
    if (!IS_PROD) {
      logger.debug(`[EMAIL SIM] To: ${to} | Subject: ${subject}`);
      return { ok: true, simulated: true };
    }
    logger.error('RESEND_API_KEY not set in production. Email not sent!');
    return { ok: false, error: 'Email service not configured.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'LifeSe <noreply@lifese.health>',
        to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    logger.info('Email sent', { to, subject });
    return { ok: true };
  } catch (err) {
    logger.error('Failed to send email', { to, subject, error: err.message });
    return { ok: false, error: err.message };
  }
}

// ─── Email Templates ───────────────────────────────────────────────

export const emailTemplates = {
  welcomeCitizen: (name) => ({
    subject: 'Welcome to LifeSe — Your Health, Secured.',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto;">
        <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">LifeSe</h1>
          <p style="color: #a7f3d0; margin: 4px 0 0; font-size: 12px;">Your Lifelong Health Timeline</p>
        </div>
        <div style="padding: 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
          <h2 style="color: #0f172a;">Welcome, ${name}! 🎉</h2>
          <p style="color: #475569; line-height: 1.6;">
            Your LifeSe account is now active. Your health data is end-to-end encrypted and only you hold the keys.
          </p>
          <a href="https://lifese.health/citizen" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
            Go to Dashboard →
          </a>
          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
            If you didn't create this account, please contact us at support@lifese.health
          </p>
        </div>
      </div>
    `
  }),

  appointmentConfirmed: (patientName, doctorName, dateTime) => ({
    subject: `Appointment Confirmed — ${dateTime}`,
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f8fafc;">
        <h2 style="color: #0f172a;">Appointment Confirmed ✅</h2>
        <p style="color: #475569;">Hi ${patientName},</p>
        <p style="color: #475569;">Your appointment with <strong>Dr. ${doctorName}</strong> on <strong>${dateTime}</strong> is confirmed.</p>
        <a href="https://lifese.health/citizen/book" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          View Booking →
        </a>
      </div>
    `
  }),

  prescriptionReady: (patientName) => ({
    subject: 'Your Prescription is Ready',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f8fafc;">
        <h2 style="color: #0f172a;">New Prescription Available 💊</h2>
        <p style="color: #475569;">Hi ${patientName}, your doctor has issued a new prescription.</p>
        <a href="https://lifese.health/citizen/records" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          View Records →
        </a>
      </div>
    `
  }),

  doctorVerificationResult: (doctorName, status, reason) => ({
    subject: status === 'verified' ? 'Your LifeSe Credentials Have Been Verified ✅' : 'Verification Update Required',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f8fafc;">
        <h2 style="color: #0f172a;">Dr. ${doctorName}, an update on your credentials</h2>
        ${status === 'verified'
        ? `<p style="color: #059669; font-weight: bold;">✅ Congratulations! Your credentials have been verified. You can now access patient consultations.</p>`
        : `<p style="color: #dc2626; font-weight: bold;">❌ Your verification was not approved.</p><p style="color: #475569;">Reason: ${reason || 'Please re-submit your documents.'}</p>`
      }
        <a href="https://lifese.health/doctor" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 16px;">
          Go to Portal →
        </a>
      </div>
    `
  }),
};
