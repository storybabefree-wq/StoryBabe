/**
 * StoryBabe Transactional Email Service
 * Supports:
 * 1. Gmail SMTP (100% Free with Google App Password - no custom domain needed)
 * 2. Resend API (via RESEND_API_KEY)
 * 3. Automatic development console fallback
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

  // Option A: Gmail SMTP / Custom SMTP (Free with Gmail App Password - Sends to ANY email recipient!)
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass.replace(/\s+/g, '') // remove spaces from 16-letter app password
        }
      });

      await transporter.sendMail({
        from: `StoryBabe <${smtpUser}>`,
        to,
        subject,
        html: htmlContent
      });

      console.log(`[Gmail SMTP] OTP email sent successfully to ${to} (${type})`);
      return { success: true };
    } catch (err: any) {
      console.error('[Gmail SMTP Error]:', err.message);
    }
  }

  // Option B: Resend API (when RESEND_API_KEY is configured)
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'StoryBabe <onboarding@resend.dev>';

  if (apiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html: htmlContent
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Resend API Error]:', errorData);
        console.log(`\n========================================\n[AUTH DEV OTP] Email to: ${to}\n[AUTH DEV OTP] Action: ${type}\n[AUTH DEV OTP] Code: ${code}\n========================================\n`);
        return { success: true, isDevFallback: true };
      }

      console.log(`[Resend] OTP email sent successfully to ${to} (${type})`);
      return { success: true };
    } catch (err: any) {
      console.error('[Email Dispatch Error]:', err.message);
      console.log(`\n========================================\n[AUTH DEV OTP] Email to: ${to}\n[AUTH DEV OTP] Action: ${type}\n[AUTH DEV OTP] Code: ${code}\n========================================\n`);
      return { success: true, isDevFallback: true };
    }
  }

  // Option C: Local Testing Fallback
  console.log(`\n========================================\n[AUTH DEV OTP] Email to: ${to}\n[AUTH DEV OTP] Action: ${type}\n[AUTH DEV OTP] Code: ${code}\n========================================\n`);
  return { success: true, isDevFallback: true };
}
