import logger from '../utils/logger.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

/**
 * Send an OTP via SMS.
 * Uses Fast2SMS by default. Set SMS_PROVIDER=msg91 to use MSG91.
 *
 * @param {string} phone - 10-digit mobile number
 * @param {string} otp   - The OTP to send
 */
export async function sendOtpSms(phone, otp) {
    const apiKey = process.env.SMS_API_KEY;
    const provider = process.env.SMS_PROVIDER || 'fast2sms';

    if (IS_TEST) {
        logger.debug(`[SMS TEST MOCK] Suppressed real SMS to ${phone}`);
        return { ok: true, mocked: true };
    }

    if (!apiKey) {
        if (!IS_PROD) {
            logger.debug(`[SMS SIM] OTP for ${phone}: ${otp}`);
            return { ok: true, simulated: true };
        }
        logger.error('SMS_API_KEY not set in production. OTP not sent!');
        throw new Error('SMS service not configured.');
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            let response;

            if (provider === 'msg91') {
                // MSG91 provider
                response = await fetch('https://api.msg91.com/api/v5/otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'authkey': apiKey },
                    body: JSON.stringify({
                        otp,
                        mobile: `91${phone}`,
                        sender: process.env.SMS_SENDER_ID || 'LFHSID',
                        template_id: process.env.MSG91_TEMPLATE_ID || '',
                    })
                });
            } else {
                // Fast2SMS
                // Use DLT (transactional) route if template ID configured, else quick route
                const templateId = process.env.FAST2SMS_TEMPLATE_ID;
                const payload = templateId
                    ? {
                        route: 'dlt',
                        sender_id: process.env.SMS_SENDER_ID || 'LFHSID',
                        message: templateId,
                        variables_values: `${otp}|`,
                        flash: 0,
                        numbers: phone,
                    }
                    : {
                        route: 'q',
                        message: `Your LifeSe OTP is ${otp}. Valid 5 mins. Do NOT share.`,
                        language: 'english',
                        flash: 0,
                        numbers: phone,
                    };

                response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'authorization': apiKey,
                    },
                    body: JSON.stringify(payload)
                });
            }


            if (!response.ok) {
                const errBody = await response.text();
                throw new Error(`SMS API error (${response.status}): ${errBody}`);
            }

            logger.info('OTP SMS sent', { phone, provider });
            return { ok: true };
        } catch (err) {
            logger.warn(`SMS attempt ${attempt} failed`, { phone, error: err.message });
            if (attempt === 2) throw err;
        }
    }
}
