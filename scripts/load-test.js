const BASE_URL = 'http://localhost:5001/api';
const TOTAL_USERS = 100;
const CONCURRENCY = 10;

async function simulateUser(id) {
    const phone = `9${Math.floor(100000000 + Math.random() * 900000000)}`;
    try {
        const res = await fetch(`${BASE_URL}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        return { status: res.status };
    } catch (err) {
        return { status: 500 };
    }
}

async function runTest() {
    let success = 0, limited = 0, failed = 0;
    for (let i = 0; i < TOTAL_USERS; i += CONCURRENCY) {
        const batch = await Promise.all(Array.from({ length: CONCURRENCY }, (_, idx) => simulateUser(i + idx)));
        batch.forEach(r => {
            if (r.status === 200) success++;
            else if (r.status === 429) limited++;
            else failed++;
        });
    }
    console.log(`REPORT_SUCCESS=${success}`);
    console.log(`REPORT_LIMITED=${limited}`);
    console.log(`REPORT_FAILED=${failed}`);
}
runTest();
