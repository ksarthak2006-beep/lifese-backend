/**
 * LifeSe — API Key Integration Test
 * Run with: node scripts/test-integrations.js <your-phone-number>
 *
 * Tests Fast2SMS + Resend connectivity before going live.
 */

import dotenv from 'dotenv';
dotenv.config();

const phone = process.argv[2];
if (!phone || phone.length !== 10) {
    console.error('Usage: node scripts/test-integrations.js <10-digit-phone>');
    process.exit(1);
}

async function testFast2SMS() {
    console.log('\n📱 Testing Fast2SMS...');
    const apiKey = process.env.SMS_API_KEY;
    if (!apiKey) { console.log('  ⛔ SMS_API_KEY not set'); return; }

    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'authorization': apiKey },
        body: JSON.stringify({
            route: 'q',
            message: 'LifeSe integration test: this is a connectivity check.',
            language: 'english',
            flash: 0,
            numbers: phone,
        })
    });
    const data = await res.json();
    if (data.return === true) {
        console.log('  ✅ Fast2SMS WORKING — message dispatched to', phone);
    } else {
        console.log('  ❌ Fast2SMS FAILED:', JSON.stringify(data));
    }
}

async function testResend() {
    console.log('\n📧 Testing Resend email...');
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { console.log('  ⛔ RESEND_API_KEY not set'); return; }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            from: 'LifeSe Test <onboarding@resend.dev>',
            to: ['delivered@resend.dev'],  // Resend test inbox
            subject: 'LifeSe API Key Test',
            html: '<p>✅ <strong>Resend integration is working</strong> for LifeSe backend.</p>',
        })
    });

    if (res.ok) {
        const data = await res.json();
        console.log('  ✅ Resend WORKING — email id:', data.id);
    } else {
        const err = await res.text();
        console.log('  ❌ Resend FAILED:', err);
    }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🏥 LifeSe Integration Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

Promise.all([testFast2SMS(), testResend()])
    .then(() => { console.log('\n✅ All tests complete.\n'); })
    .catch((err) => { console.error('\n❌ Test error:', err.message); });
