/**
 * StoryBabe Transactional Email Service
 * Production Cloud Architecture:
 * 1. Resend HTTPS REST API (Port 443 - 100% Cloud Firewall Proof, Sub-second delivery on Render)
 * 2. Gmail SMTP (For environments where outbound SMTP ports are unblocked)
 */

// @ts-ignore
import nodemailer from 'nodemailer';

interface SendOtpOptions {
  to: string;
  code: string;
  type: 'REGISTRATION' | 'PASSWORD_RESET';
  displayName?: string;
}

export async function sendOtpEmail(options: SendOtpOptions): Promise<{ success: boolean; isDevFallback?: boolean; error?: string }> {
  const { to, code, type, displayName = 'StoryBabe Author' } = options;

  const isRegistration = type === 'REGISTRATION';
  const subject = isRegistration
    ? `${code} is your StoryBabe email verification code`
    : `${code} is your StoryBabe password reset code`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0c0f17;
      color: #e2e8f0;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #151a28;
      border: 1px solid #232d42;
      border-radius: 12px;
      padding: 36px 32px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #f8fafc;
      margin-bottom: 24px;
      display: inline-block;
    }
    .brand span {
      color: #3b82f6;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      color: #f8fafc;
      margin: 0 0 12px 0;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #94a3b8;
      margin: 0 0 20px 0;
    }
    .code-box {
      background: #090c14;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 18px 24px;
      text-align: center;
      margin: 28px 0;
    }
    .code {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #60a5fa;
      font-family: 'Courier New', Courier, monospace;
    }
    .footer {
      border-top: 1px solid #232d42;
      padding-top: 20px;
      margin-top: 32px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">Story<span>Babe</span></div>
    <h1>${isRegistration ? 'Verify your email address' : 'Reset your password'}</h1>
    <p>Hello ${displayName},</p>
    <p>${
      isRegistration
        ? 'Please use the verification code below to confirm your email and activate your StoryBabe account:'
        : 'We received a request to reset your StoryBabe account password. Enter the code below to proceed:'
    }</p>
    
    <div class="code-box">
      <div class="code">${code}</div>
    </div>
    
    <p>This verification code will expire in <strong>10 minutes</strong>. If you did not request this code, you can safely ignore this email.</p>
    
    <div class="footer">
      This is an automated security email from StoryBabe. Please do not reply directly to this message.
    </div>
  </div>
</body>
</html>
  `.trim();

  const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
  const resendFromEmail = (process.env.RESEND_FROM_EMAIL || 'StoryBabe <onboarding@resend.dev>').trim();
  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim().toLowerCase();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/[^a-zA-Z0-9]/g, '');

  let lastError = '';

  // 1. Primary for Cloud / Render: Resend HTTPS REST API (Port 443 - Never Blocked by Cloud Firewalls)
  if (resendApiKey) {
    try {
      console.log(`[Resend HTTPS] Dispatching OTP email via Port 443 to ${to}...`);
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: resendFromEmail,
          to: [to],
          subject,
          html: htmlContent
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('[Resend API Error]:', data);
        const errMsg = data.message || data.error?.message || 'Resend API rejected the email.';
        lastError = `Resend delivery failed: ${errMsg}`;
      } else {
        console.log(`[Resend HTTPS] OTP email delivered successfully to ${to} (${type}) - ID: ${data.id}`);
        return { success: true };
      }
    } catch (err: any) {
      console.error('[Resend Dispatch Error]:', err.message);
      lastError = `Resend HTTPS error: ${err.message}`;
    }
  }

  // 2. Secondary: Gmail SMTP (For unblocked environments)
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: smtpUser,
          pass: smtpPass
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 5000
      });

      const info = await transporter.sendMail({
        from: `StoryBabe <${smtpUser}>`,
        to,
        subject,
        html: htmlContent
      });

      console.log(`[Gmail SMTP 587] OTP email sent successfully to ${to} (${type}) - MessageId: ${info.messageId}`);
      return { success: true };
    } catch (err: any) {
      console.warn(`[Gmail SMTP 587 error]: ${err.message}`);
      lastError = `Gmail SMTP error: ${err.message}. (Note: Cloud hosts like Render block raw SMTP ports; please configure RESEND_API_KEY in Render).`;
    }
  }

  // 3. Final Production Response
  if (process.env.NODE_ENV === 'production') {
    return {
      success: false,
      error: lastError || 'Email service not configured. Please set RESEND_API_KEY in Render environment variables.'
    };
  }

  console.log(`\n========================================\n[AUTH DEV OTP] Email to: ${to}\n[AUTH DEV OTP] Action: ${type}\n[AUTH DEV OTP] Code: ${code}\n========================================\n`);
  return { success: true, isDevFallback: true };
}
