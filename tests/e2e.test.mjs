import assert from 'node:assert';
import { describe, it, before, after } from 'node:test';
import { spawn } from 'node:child_process';
import path from 'node:path';

let serverProc;

const GATEWAY_URL = 'http://localhost:4000/api/v1';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(endpoint, options = {}) {
  const url = `${GATEWAY_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json();
  return { status: res.status, data };
}

describe('StoryBabe Microservices Architecture & Rules E2E Suite', () => {
  before(async () => {
    console.log('Starting microservices for test suite...');
    const scriptPath = path.resolve(process.cwd(), 'scripts/dev-services.mjs');
    serverProc = spawn('node', [scriptPath], { stdio: 'inherit' });

    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://localhost:4000/health');
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {}
      await wait(500);
    }
    if (!ready) throw new Error('Gateway failed to start within timeout');
  });

  after(() => {
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  });

  it('1. Gateway Health & Service Discovery checks online microservices', async () => {
    const res = await fetch('http://localhost:4000/health');
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.gateway, 'ONLINE');
    assert.strictEqual(data.services['auth-service'], 'ONLINE');
    assert.strictEqual(data.services['story-service'], 'ONLINE');
    assert.strictEqual(data.services['social-service'], 'ONLINE');
    assert.strictEqual(data.services['moderation-service'], 'ONLINE');
    assert.strictEqual(data.services['worker-service'], 'ONLINE');
  });

  let elenaToken = '';
  let elenaId = '';
  let testUserToken = '';
  let testUserId = '';

  it('2. Auth Service: Authenticate pre-seeded author and verify private email protection', async () => {
    const loginRes = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername: 'elena_v', password: 'password123' })
    });

    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.success, true);
    assert.strictEqual(loginRes.data.data.user.username, 'elena_v');
    assert.strictEqual(loginRes.data.data.user.email, 'elena@storybabe.internal');
    elenaToken = loginRes.data.data.tokens.accessToken;
    elenaId = loginRes.data.data.user.id;

    const publicProfile = await fetchJson('/auth/users/elena_v');
    assert.strictEqual(publicProfile.status, 200);
    assert.strictEqual(publicProfile.data.data.email, undefined);
    assert.strictEqual(publicProfile.data.data.username, 'elena_v');
  });

  it('3. Auth Service: Enforce 1 free username change then 30-day cooldown', async () => {
    const uniqueSuffix = Date.now();
    const regRes = await fetchJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `tester_${uniqueSuffix}@example.com`,
        username: `tester_${uniqueSuffix}`,
        displayName: 'Test Author',
        password: 'password123'
      })
    });

    assert.strictEqual(regRes.status, 201);
    testUserToken = regRes.data.data.tokens.accessToken;
    testUserId = regRes.data.data.user.id;

    const firstChangeRes = await fetchJson('/auth/username', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({ username: `tester_renamed_${uniqueSuffix}` })
    });

    assert.strictEqual(firstChangeRes.status, 200);
    assert.strictEqual(firstChangeRes.data.data.username, `tester_renamed_${uniqueSuffix}`);
    assert.strictEqual(firstChangeRes.data.data.usernameChangesCount, 1);

    const secondChangeRes = await fetchJson('/auth/username', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({ username: `tester_blocked_${uniqueSuffix}` })
    });

    assert.strictEqual(secondChangeRes.status, 400);
    assert.strictEqual(secondChangeRes.data.error.code, 'USERNAME_COOLDOWN_ACTIVE');
  });

  it('3b. Auth Service: 6-Digit OTP Email Verification Flow & Password Reset', async () => {
    const uniqueSuffix = Date.now();
    const otpEmail = `otp_author_${uniqueSuffix}@example.com`;
    const otpUsername = `otp_author_${uniqueSuffix}`;

    // Step 1: Send registration OTP
    const sendOtpRes = await fetchJson('/auth/register/send-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: otpEmail,
        username: otpUsername,
        displayName: 'OTP Verified Author',
        password: 'SecurePassword123'
      })
    });

    assert.strictEqual(sendOtpRes.status, 200);
    assert.strictEqual(sendOtpRes.data.success, true);
    assert.ok(sendOtpRes.data.data.devOtp, 'Development OTP should be returned in test/dev mode');
    const registrationCode = sendOtpRes.data.data.devOtp;

    // Step 2: Verify registration OTP & create user
    const verifyOtpRes = await fetchJson('/auth/register/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        email: otpEmail,
        code: registrationCode
      })
    });

    assert.strictEqual(verifyOtpRes.status, 201);
    assert.strictEqual(verifyOtpRes.data.success, true);
    assert.strictEqual(verifyOtpRes.data.data.user.emailVerified, true);
    assert.ok(verifyOtpRes.data.data.tokens.accessToken);

    // Step 3: Request forgot password OTP
    const forgotOtpRes = await fetchJson('/auth/forgot-password/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email: otpEmail })
    });

    assert.strictEqual(forgotOtpRes.status, 200);
    assert.strictEqual(forgotOtpRes.data.success, true);
    const resetCode = forgotOtpRes.data.data.devOtp;

    // Step 4: Reset password with code
    const resetRes = await fetchJson('/auth/forgot-password/reset', {
      method: 'POST',
      body: JSON.stringify({
        email: otpEmail,
        code: resetCode,
        newPassword: 'BrandNewPassword456'
      })
    });

    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.data.success, true);

    // Step 5: Verify login with new password
    const newLoginRes = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        emailOrUsername: otpEmail,
        password: 'BrandNewPassword456'
      })
    });

    assert.strictEqual(newLoginRes.status, 200);
    assert.strictEqual(newLoginRes.data.success, true);
    assert.strictEqual(newLoginRes.data.data.user.emailVerified, true);
  });

  let createdStoryId = '';

  it('4. Story Service: AI Poster Generator and Active Authors Tray endpoints', async () => {
    // Test Suggest Prompt endpoint
    const suggestRes = await fetchJson('/stories/suggest-prompt', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Late Night Train Home',
        summary: 'Sitting alone by the window as Lisbon drifted past in the rain.',
        tags: ['solitude', 'night', 'rain']
      })
    });
    assert.strictEqual(suggestRes.status, 200);
    assert.ok(suggestRes.data.data.suggestedPrompt.includes('35mm'));
    assert.ok(Array.isArray(suggestRes.data.data.styleModifiers));

    // Test AI Poster Generator endpoint with prompt and modifiers
    const aiPosterRes = await fetchJson('/stories/generate-poster', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Late Night Train Home',
        summary: 'Sitting alone by the window as Lisbon drifted past in the rain.',
        prompt: suggestRes.data.data.suggestedPrompt,
        modifiers: ['35mm Film Grain', 'Golden Hour Warmth'],
        tags: ['solitude', 'night', 'rain']
      })
    });
    assert.strictEqual(aiPosterRes.status, 200);
    assert.ok(aiPosterRes.data.data.posterUrl);
    assert.ok(aiPosterRes.data.data.oneliner);

    // Test Active Authors endpoint
    const authorsRes = await fetchJson('/stories/active-authors');
    assert.strictEqual(authorsRes.status, 200);
    assert.ok(Array.isArray(authorsRes.data.data));
    assert.ok(authorsRes.data.data.length > 0);
  });

  it('5. Story Service: Create Story with Poster, Oneliner & Safety Flags', async () => {
    const createRes = await fetchJson('/stories', {
      method: 'POST',
      headers: { Authorization: `Bearer ${elenaToken}` },
      body: JSON.stringify({
        title: 'The Rain on Michigan Avenue',
        summary: 'A quiet reflection on leaving intensive care medicine after eight years.',
        oneliner: 'Leaving intensive care medicine felt like stepping into an unfamiliar silence.',
        posterUrl: 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?auto=format&fit=crop&w=1000&q=80',
        posterStyle: 'bottom-gradient',
        posterType: 'PRESET',
        content: 'The hospital corridors at dawn were the only place in the city where silence felt heavy. Every monitor beep was etched into my muscle memory. When I finally handed over my badge, the security guard wished me a good morning without looking up.',
        type: 'SINGLE',
        status: 'ONGOING',
        safetyFlags: ['DEATH_LOSS', 'MENTAL_HEALTH_CRISIS'],
        tags: ['career', 'growth', 'grief']
      })
    });

    assert.strictEqual(createRes.status, 201);
    assert.strictEqual(createRes.data.data.type, 'SINGLE');
    assert.strictEqual(createRes.data.data.oneliner, 'Leaving intensive care medicine felt like stepping into an unfamiliar silence.');
    assert.ok(createRes.data.data.posterUrl);
    assert.deepStrictEqual(createRes.data.data.safetyFlags, ['DEATH_LOSS', 'MENTAL_HEALTH_CRISIS']);
    createdStoryId = createRes.data.data.id;

    const safetyRes = await fetchJson('/safety-resources');
    assert.strictEqual(safetyRes.status, 200);
    assert.ok(safetyRes.data.data.resources.length > 0);
    assert.ok(safetyRes.data.data.disclaimer.includes('not a crisis service'));
  });

  it('6. Story Service: Interactive Views Tracking & Likes Resonance Toggle', async () => {
    const viewRes = await fetchJson(`/stories/${createdStoryId}/view`, { method: 'POST' });
    assert.strictEqual(viewRes.status, 200);

    const likeRes1 = await fetchJson(`/stories/${createdStoryId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${elenaToken}` }
    });
    assert.strictEqual(likeRes1.status, 200);
    assert.strictEqual(likeRes1.data.data.isLiked, true);
    assert.strictEqual(likeRes1.data.data.likesCount, 1);

    const likeRes2 = await fetchJson(`/stories/${createdStoryId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${elenaToken}` }
    });
    assert.strictEqual(likeRes2.status, 200);
    assert.strictEqual(likeRes2.data.data.isLiked, false);
    assert.strictEqual(likeRes2.data.data.likesCount, 0);
  });

  it('7. Story Service: Update Status to On Hold with One-line Reason', async () => {
    const updateRes = await fetchJson(`/stories/${createdStoryId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${elenaToken}` },
      body: JSON.stringify({
        status: 'ON_HOLD',
        onHoldReason: 'Taking a 3-week writing break during travel.'
      })
    });

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.data.status, 'ON_HOLD');
    assert.strictEqual(updateRes.data.data.onHoldReason, 'Taking a 3-week writing break during travel.');
  });

  it('8. Social Service: Comments enabled by default and disabled per story', async () => {
    const commentRes = await fetchJson(`/comments/stories/${createdStoryId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        content: 'This was deeply resonant and relatable.'
      })
    });

    assert.strictEqual(commentRes.status, 201);
    assert.strictEqual(commentRes.data.data.content, 'This was deeply resonant and relatable.');

    await fetchJson(`/stories/${createdStoryId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${elenaToken}` },
      body: JSON.stringify({ allowComments: false })
    });

    const blockedCommentRes = await fetchJson(`/comments/stories/${createdStoryId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({ content: 'Trying to post when disabled.' })
    });

    assert.strictEqual(blockedCommentRes.status, 403);
    assert.strictEqual(blockedCommentRes.data.error.code, 'COMMENTS_DISABLED');
  });

  it('9. Moderation Service: NO_CONSENT report is prioritized to HIGH priority queue', async () => {
    const noConsentReport = await fetchJson('/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${testUserToken}` },
      body: JSON.stringify({
        storyId: createdStoryId,
        category: 'NO_CONSENT',
        reason: 'This story mentions identifiable details about a former colleague without consent.'
      })
    });

    assert.strictEqual(noConsentReport.status, 201);
    assert.strictEqual(noConsentReport.data.data.priority, 'HIGH');
    assert.strictEqual(noConsentReport.data.data.category, 'NO_CONSENT');

    const modLogin = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrUsername: 'storybabe_mod', password: 'password123' })
    });
    const modToken = modLogin.data.data.tokens.accessToken;

    const priorityList = await fetchJson('/reports?queue=priority', {
      headers: { Authorization: `Bearer ${modToken}` }
    });
    assert.strictEqual(priorityList.status, 200);
    assert.ok(priorityList.data.data.some((r) => r.id === noConsentReport.data.data.id));

    const actionRes = await fetchJson(`/reports/${noConsentReport.data.data.id}/action`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${modToken}` },
      body: JSON.stringify({
        actionType: 'WARNING',
        targetType: 'STORY',
        targetId: createdStoryId,
        notes: 'Reviewed case: contacted author to anonymize hospital and colleague names.'
      })
    });

    assert.strictEqual(actionRes.status, 200);
    assert.strictEqual(actionRes.data.success, true);
  });
});
