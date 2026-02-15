// ============================================================
// WARDA - Email Service
// Uses IONOS SMTP via nodemailer for sending transactional emails
// ============================================================

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ionos.co.uk',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'hello@meetwarda.com',
    pass: process.env.SMTP_PASS
  },
  tls: { rejectUnauthorized: false }
});

const FROM_EMAIL = process.env.SMTP_USER || 'hello@meetwarda.com';
const FROM_NAME = 'Meet Warda';

// ─── Base Email Sender ─────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const mailOptions = {
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '')
  };
  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent via IONOS SMTP:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('SMTP email error:', error.message);
    return { success: false, error: error.message };
  }
}

// ─── Email Header/Footer Templates ─────────────────────────────
const emailHeader = (title) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px;">🌹 Meet Warda</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">You're Never Alone</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
`;

const emailFooter = `
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 40px; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">
                Tweed Wellness Ltd · Made with ❤️ in Scotland
              </p>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 11px;">
                Questions? Contact us at <a href="mailto:hello@meetwarda.com" style="color: #0D9488;">hello@meetwarda.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

// ─── 3.2 Welcome Email (with PIN, temp password) ───────────────
async function sendWelcomeEmail({ to, residentName, pin, tempPassword, familyName, portalUrl = 'https://portal.meetwarda.com' }) {
  const subject = `Welcome to Warda - Login Details for ${residentName}`;
  
  const html = emailHeader('Welcome to Warda') + `
    <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 22px;">Welcome to the Warda Family! 🌹</h2>
    
    <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
      Dear ${familyName || 'Family Member'},
    </p>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      We're delighted to welcome <strong>${residentName}</strong> to Meet Warda, the AI companion designed to bring joy, connection, and support to their daily life.
    </p>
    
    <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="margin: 0 0 16px; color: #0D9488; font-size: 16px;">📱 Tablet Login Details</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">PIN Code:</td>
          <td style="padding: 8px 0; color: #0f172a; font-size: 20px; font-weight: 700; font-family: monospace;">${pin}</td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; color: #64748b; font-size: 12px;">
        This PIN is used to unlock the tablet and access Warda.
      </p>
    </div>
    
    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="margin: 0 0 16px; color: #92400e; font-size: 16px;">👨‍👩‍👧 Family Portal Access</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; color: #78716c; font-size: 14px;">Portal:</td>
          <td style="padding: 8px 0;"><a href="${portalUrl}" style="color: #0D9488; font-weight: 600;">${portalUrl}</a></td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #78716c; font-size: 14px;">Email:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${to}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #78716c; font-size: 14px;">Temporary Password:</td>
          <td style="padding: 8px 0; color: #0f172a; font-size: 16px; font-weight: 700; font-family: monospace;">${tempPassword}</td>
        </tr>
      </table>
      <p style="margin: 16px 0 0; color: #78716c; font-size: 12px;">
        Please change your password after first login.
      </p>
    </div>
    
    <h3 style="margin: 24px 0 12px; color: #1e293b; font-size: 16px;">What's Next?</h3>
    <ol style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
      <li>Set up the tablet in a comfortable spot for ${residentName}</li>
      <li>Help them log in with the PIN above</li>
      <li>Log into the Family Portal to track their wellbeing</li>
      <li>Warda will learn their preferences and provide companionship</li>
    </ol>
    
    <p style="margin: 24px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
      If you have any questions, we're here to help!
    </p>
    
    <p style="margin: 24px 0 0; color: #475569; font-size: 15px;">
      Warm regards,<br>
      <strong style="color: #0D9488;">The Warda Team</strong>
    </p>
  ` + emailFooter;

  return sendEmail({ to, subject, html });
}

// ─── 3.3 Payment Link Email ────────────────────────────────────
async function sendPaymentLinkEmail({ to, residentName, familyName, amount, paymentUrl, planName = 'Warda Companion' }) {
  const subject = `Complete Your Warda Subscription for ${residentName}`;
  
  const html = emailHeader('Payment Required') + `
    <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 22px;">Complete Your Subscription 💳</h2>
    
    <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
      Dear ${familyName || 'Family Member'},
    </p>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      Thank you for choosing Warda as a companion for <strong>${residentName}</strong>. To activate the service, please complete your payment below.
    </p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Plan:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${planName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Amount:</td>
          <td style="padding: 8px 0; color: #0D9488; font-size: 24px; font-weight: 700;">£${(amount / 100).toFixed(2)}/month</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">For:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${residentName}</td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        Complete Payment →
      </a>
    </div>
    
    <p style="margin: 24px 0 0; color: #94a3b8; font-size: 13px; text-align: center;">
      This link will expire in 7 days. Secure payment powered by Stripe.
    </p>
  ` + emailFooter;

  return sendEmail({ to, subject, html });
}

// ─── 3.4 Invoice Email ─────────────────────────────────────────
async function sendInvoiceEmail({ to, careHomeName, invoiceNumber, amount, dueDate, lineItems, invoiceUrl }) {
  const subject = `Invoice ${invoiceNumber} from Meet Warda`;
  
  const itemsHtml = lineItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 14px; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; text-align: right; font-weight: 600;">£${(item.total / 100).toFixed(2)}</td>
    </tr>
  `).join('');
  
  const html = emailHeader('Invoice') + `
    <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 22px;">Invoice 📄</h2>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      Dear ${careHomeName} Team,
    </p>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      Please find your invoice below for Warda services.
    </p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table style="width: 100%;">
        <tr>
          <td style="color: #64748b; font-size: 13px;">Invoice Number</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${invoiceNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-size: 13px; padding-top: 8px;">Due Date</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; padding-top: 8px;">${new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
        </tr>
      </table>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
      <thead>
        <tr style="background-color: #f1f5f9;">
          <th style="padding: 12px; text-align: left; color: #64748b; font-size: 12px; text-transform: uppercase;">Description</th>
          <th style="padding: 12px; text-align: center; color: #64748b; font-size: 12px; text-transform: uppercase;">Qty</th>
          <th style="padding: 12px; text-align: right; color: #64748b; font-size: 12px; text-transform: uppercase;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 16px 12px; text-align: right; color: #0f172a; font-weight: 700; font-size: 16px;">Total Due:</td>
          <td style="padding: 16px 12px; text-align: right; color: #0D9488; font-weight: 700; font-size: 20px;">£${(amount / 100).toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${invoiceUrl || '#'}" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
        View Invoice Online
      </a>
    </div>
    
    <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 24px 0;">
      <p style="margin: 0; color: #92400e; font-size: 13px;">
        <strong>Payment Details:</strong><br>
        Bank: Barclays<br>
        Account: Tweed Wellness Ltd<br>
        Sort Code: XX-XX-XX<br>
        Account Number: XXXXXXXX<br>
        Reference: ${invoiceNumber}
      </p>
    </div>
  ` + emailFooter;

  return sendEmail({ to, subject, html });
}

// ─── 3.5 Family Invitation Email ───────────────────────────────
async function sendFamilyInvitationEmail({ to, inviterName, residentName, careHomeName, inviteUrl }) {
  const subject = `You've been invited to connect with ${residentName} on Warda`;
  
  const html = emailHeader('Family Invitation') + `
    <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 22px;">You're Invited! 👨‍👩‍👧</h2>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      Hello,
    </p>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      <strong>${inviterName}</strong> has invited you to connect with <strong>${residentName}</strong> on Meet Warda.
    </p>
    
    <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 24px; margin: 24px 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">🌹</div>
      <h3 style="margin: 0 0 8px; color: #0D9488; font-size: 18px;">${residentName}</h3>
      <p style="margin: 0; color: #64748b; font-size: 14px;">${careHomeName || 'Home Care'}</p>
    </div>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      As a family member, you'll be able to:
    </p>
    
    <ul style="margin: 0 0 24px; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
      <li>See how ${residentName} is doing each day</li>
      <li>View mood and wellbeing updates</li>
      <li>Send messages and photos</li>
      <li>Stay connected even from afar</li>
    </ul>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        Accept Invitation
      </a>
    </div>
    
    <p style="margin: 24px 0 0; color: #94a3b8; font-size: 13px; text-align: center;">
      This invitation expires in 14 days.
    </p>
  ` + emailFooter;

  return sendEmail({ to, subject, html });
}

// ─── 3.6 Dispatch/Tracking Email ───────────────────────────────
async function sendDispatchEmail({ to, residentName, familyName, trackingNumber, carrier = 'Royal Mail', estimatedDelivery }) {
  const subject = `Your Warda Tablet is on its way! 📦`;
  
  const trackingUrl = carrier === 'Royal Mail' 
    ? `https://www.royalmail.com/track-your-item#/tracking-results/${trackingNumber}`
    : `https://www.parcelforce.com/track-trace?trackNumber=${trackingNumber}`;
  
  const html = emailHeader('Order Dispatched') + `
    <h2 style="margin: 0 0 20px; color: #1e293b; font-size: 22px;">Your Tablet is On Its Way! 📦</h2>
    
    <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
      Dear ${familyName || 'Family Member'},
    </p>
    
    <p style="margin: 0 0 20px; color: #475569; font-size: 15px; line-height: 1.6;">
      Great news! The Warda tablet for <strong>${residentName}</strong> has been dispatched and is on its way.
    </p>
    
    <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 24px; margin: 24px 0;">
      <h3 style="margin: 0 0 16px; color: #0D9488; font-size: 16px;">📍 Tracking Information</h3>
      <table style="width: 100%;">
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Carrier:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${carrier}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tracking Number:</td>
          <td style="padding: 8px 0; color: #0f172a; font-weight: 600; font-family: monospace;">${trackingNumber}</td>
        </tr>
        ${estimatedDelivery ? `
        <tr>
          <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Estimated Delivery:</td>
          <td style="padding: 8px 0; color: #0D9488; font-weight: 600;">${new Date(estimatedDelivery).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="${trackingUrl}" style="display: inline-block; background: linear-gradient(135deg, #0D9488 0%, #14B8A6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600;">
        Track Your Parcel →
      </a>
    </div>
    
    <h3 style="margin: 24px 0 12px; color: #1e293b; font-size: 16px;">What's in the Box?</h3>
    <ul style="margin: 0; padding-left: 20px; color: #475569; font-size: 14px; line-height: 1.8;">
      <li>Pre-configured Warda tablet</li>
      <li>Charging cable and adapter</li>
      <li>Quick start guide</li>
      <li>Tablet stand</li>
    </ul>
    
    <p style="margin: 24px 0 0; color: #475569; font-size: 15px; line-height: 1.6;">
      Once the tablet arrives, simply plug it in, connect to WiFi, and ${residentName} can start chatting with Warda using their PIN!
    </p>
  ` + emailFooter;

  return sendEmail({ to, subject, html });
}

// ─── Export all functions ──────────────────────────────────────
module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPaymentLinkEmail,
  sendInvoiceEmail,
  sendFamilyInvitationEmail,
  sendDispatchEmail
};

// sendEmailSafe - direct passthrough (IONOS SMTP)
async function sendEmailSafe({ to, subject, html, text }) {
  return sendEmail({ to, subject, html, text });
}
module.exports.sendEmailSafe = sendEmailSafe;
