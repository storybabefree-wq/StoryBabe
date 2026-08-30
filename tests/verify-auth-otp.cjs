const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const API_BASE = 'http://127.0.0.1:4000/api/v1';

async function runTests() {
  console.log('--- Starting StoryBabe Authentication & OTP Verification Suite ---');

  const testEmail = `author_${Date.now()}@example.com`;
  const testUsername = `author_${Date.now()}`;
  const testPassword = 'Password123!';
  const newPassword = 'NewPassword456!';

  // Test 1: Send Registration OTP
  console.log('\n[Test 1] Sending Registration OTP for:', testEmail);
  const sendRes = await fetch(`${API_BASE}/auth/register/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      username: testUsername,
      displayName: 'Verified Author',
      password: testPassword
    })
  });

  const sendData = await sendRes.json();
  console.log('Send OTP Status:', sendRes.status, 'Response:', sendData);
  if (!sendRes.ok || !sendData.success) {
    throw new Error('Failed to send registration OTP: ' + JSON.stringify(sendData));
  }

  const devOtp = sendData.data.devOtp;
  console.log('Obtained OTP Code:', devOtp);

  // Test 2: Reject Incorrect OTP
  console.log('\n[Test 2] Testing Rejection of Incorrect OTP: 000000');
  const wrongOtpRes = await fetch(`${API_BASE}/auth/register/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: '000000'
    })
  });
  const wrongOtpData = await wrongOtpRes.json();
  console.log('Wrong OTP Response Status:', wrongOtpRes.status, wrongOtpData.error?.code);
  if (wrongOtpRes.status !== 400 || wrongOtpData.error?.code !== 'INVALID_OTP') {
    throw new Error('Expected 400 INVALID_OTP for wrong OTP code');
  }

  // Test 3: Verify Valid OTP & Create Account
  console.log('\n[Test 3] Verifying Valid OTP Code:', devOtp);
  const verifyRes = await fetch(`${API_BASE}/auth/register/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: devOtp
    })
  });

  const verifyData = await verifyRes.json();
  console.log('Verify OTP Status:', verifyRes.status, 'User Created:', verifyData.data?.user?.username);
  if (verifyRes.status !== 201 || !verifyData.success || !verifyData.data?.tokens?.accessToken) {
    throw new Error('Failed to complete registration with OTP');
  }
  const token = verifyData.data.tokens.accessToken;

  // Test 4: Login with Email
  console.log('\n[Test 4] Logging in with Email:', testEmail);
  const loginEmailRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailOrUsername: testEmail,
      password: testPassword
    })
  });
  const loginEmailData = await loginEmailRes.json();
  console.log('Login by Email Status:', loginEmailRes.status, 'User:', loginEmailData.data?.user?.email);
  if (!loginEmailRes.ok || !loginEmailData.success) {
    throw new Error('Failed to login by email');
  }

  // Test 5: Login with Username (Case-Insensitive)
  console.log('\n[Test 5] Logging in with Username:', testUsername.toUpperCase());
  const loginUserRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailOrUsername: testUsername.toUpperCase(),
      password: testPassword
    })
  });
  const loginUserData = await loginUserRes.json();
  console.log('Login by Username Status:', loginUserRes.status, 'User:', loginUserData.data?.user?.username);
  if (!loginUserRes.ok || !loginUserData.success) {
    throw new Error('Failed to login by username');
  }

  // Test 6: Authenticated /auth/me
  console.log('\n[Test 6] Fetching Authenticated Profile /auth/me');
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meData = await meRes.json();
  console.log('/auth/me Status:', meRes.status, 'EmailVerified:', meData.data?.emailVerified);
  if (!meRes.ok || !meData.data?.emailVerified) {
    throw new Error('Expected emailVerified to be true on /auth/me');
  }

  // Test 7: Send Forgot Password OTP
  console.log('\n[Test 7] Sending Forgot Password OTP');
  const forgotRes = await fetch(`${API_BASE}/auth/forgot-password/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });
  const forgotData = await forgotRes.json();
  console.log('Forgot Password Status:', forgotRes.status, 'Response:', forgotData);
  const resetOtp = forgotData.data?.devOtp;

  // Test 8: Reset Password with OTP
  console.log('\n[Test 8] Resetting Password with OTP:', resetOtp);
  const resetRes = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      code: resetOtp,
      newPassword: newPassword
    })
  });
  const resetData = await resetRes.json();
  console.log('Reset Password Status:', resetRes.status, resetData.message);
  if (!resetRes.ok || !resetData.success) {
    throw new Error('Failed to reset password: ' + JSON.stringify(resetData));
  }

  // Test 9: Login with New Password
  console.log('\n[Test 9] Logging in with New Password');
  const newLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailOrUsername: testEmail,
      password: newPassword
    })
  });
  const newLoginData = await newLoginRes.json();
  console.log('Login with New Password Status:', newLoginRes.status, 'Success:', newLoginData.success);
  if (!newLoginRes.ok || !newLoginData.success) {
    throw new Error('Failed to login with new password');
  }

  // Test 10: Verify SQLite Database Persistence
  console.log('\n[Test 10] Direct Database Check in SQLite');
  const dbPath = path.resolve(__dirname, '../data/storybabe.db');
  const db = new DatabaseSync(dbPath);
  const dbUser = db.prepare('SELECT id, email, username, displayName, emailVerified, emailVerifiedAt FROM users WHERE email = ?').get(testEmail);
  console.log('Database User Record:', dbUser);
  if (!dbUser || dbUser.emailVerified !== 1) {
    throw new Error('Database record missing or not marked verified in SQLite');
  }

  console.log('\n======================================================');
  console.log('ALL 10 AUTHENTICATION & OTP TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
