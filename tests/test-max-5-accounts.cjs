const API_BASE = 'http://127.0.0.1:4000/api/v1';

async function testMaxAccounts() {
  console.log('--- Testing Maximum 5 Accounts Per Email Enforcement ---');

  const testEmail = `persona_${Date.now()}@domain.com`;
  const password = 'Password123!';

  // Test creating 5 accounts with same email
  for (let i = 1; i <= 5; i++) {
    const username = `persona_${Date.now()}_${i}`;
    console.log(`\n[Account ${i}] Requesting OTP for username: ${username} with email: ${testEmail}`);

    const sendRes = await fetch(`${API_BASE}/auth/register/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        username,
        displayName: `Author Persona ${i}`,
        password
      })
    });

    const sendData = await sendRes.json();
    if (!sendRes.ok || !sendData.success) {
      throw new Error(`Failed on account ${i} send OTP: ` + JSON.stringify(sendData));
    }

    const devOtp = sendData.data.devOtp;
    const verifyRes = await fetch(`${API_BASE}/auth/register/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        code: devOtp
      })
    });

    const verifyData = await verifyRes.json();
    if (!verifyRes.ok || !verifyData.success) {
      throw new Error(`Failed on account ${i} verify OTP: ` + JSON.stringify(verifyData));
    }
    console.log(`Account ${i} successfully created: @${username}`);
  }

  // Test 6th account creation attempt (Must be rejected)
  const username6 = `persona_${Date.now()}_6`;
  console.log(`\n[Account 6 Attempt] Requesting OTP for 6th account: @${username6} with email: ${testEmail}`);
  const sixthRes = await fetch(`${API_BASE}/auth/register/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      username: username6,
      displayName: 'Author Persona 6',
      password
    })
  });

  const sixthData = await sixthRes.json();
  console.log('6th Account Attempt Status:', sixthRes.status, sixthData.error?.code, sixthData.error?.message);

  if (sixthRes.status === 409 && sixthData.error?.code === 'MAX_ACCOUNTS_EXCEEDED') {
    console.log('\n SUCCESS: 6th account was correctly blocked with MAX_ACCOUNTS_EXCEEDED!');
  } else {
    throw new Error('Expected 409 MAX_ACCOUNTS_EXCEEDED but got: ' + JSON.stringify(sixthData));
  }

  console.log('\n=============================================================');
  console.log('MAX 5 ACCOUNTS PER EMAIL LIMIT VERIFIED SUCCESSFULLY!');
  console.log('=============================================================\n');
}

testMaxAccounts().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
