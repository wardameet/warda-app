/**
 * SES Email Auto-Verifier
 * While in SES sandbox mode, automatically sends verification emails
 * to any new email address so they can receive Warda emails.
 * 
 * When SES is in production mode, this becomes a no-op.
 */
const { SESClient, VerifyEmailIdentityCommand, GetIdentityVerificationAttributesCommand, ListIdentitiesCommand, GetSendQuotaCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.AWS_REGION || 'eu-west-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Cache verified emails to avoid repeated API calls
let verifiedCache = new Set();
let isProductionMode = null; // null = unknown, true/false

/**
 * Check if SES is in production mode
 */
async function checkProductionMode() {
  if (isProductionMode !== null) return isProductionMode;
  try {
    const quota = await ses.send(new GetSendQuotaCommand({}));
    isProductionMode = quota.Max24HourSend > 200;
    console.log(`[SES] Mode: ${isProductionMode ? 'PRODUCTION' : 'SANDBOX (200/day)'}`);
    return isProductionMode;
  } catch (e) {
    console.error('[SES] Could not check mode:', e.message);
    return false;
  }
}

/**
 * Load all currently verified emails into cache
 */
async function loadVerifiedEmails() {
  try {
    const result = await ses.send(new ListIdentitiesCommand({ IdentityType: 'EmailAddress', MaxItems: 100 }));
    const emails = result.Identities || [];
    
    if (emails.length > 0) {
      const attrs = await ses.send(new GetIdentityVerificationAttributesCommand({ Identities: emails }));
      for (const [email, status] of Object.entries(attrs.VerificationAttributes || {})) {
        if (status.VerificationStatus === 'Success') {
          verifiedCache.add(email.toLowerCase());
        }
      }
    }
    console.log(`[SES] Loaded ${verifiedCache.size} verified emails`);
    return verifiedCache;
  } catch (e) {
    console.error('[SES] Load verified error:', e.message);
    return verifiedCache;
  }
}

/**
 * Check if an email is verified
 */
async function isEmailVerified(email) {
  if (!email) return false;
  email = email.toLowerCase().trim();
  
  // If production mode, all emails are sendable
  if (await checkProductionMode()) return true;
  
  // Check cache first
  if (verifiedCache.has(email)) return true;
  
  // Check SES
  try {
    const attrs = await ses.send(new GetIdentityVerificationAttributesCommand({ Identities: [email] }));
    const status = attrs.VerificationAttributes?.[email]?.VerificationStatus;
    if (status === 'Success') {
      verifiedCache.add(email);
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Send verification email to an address (SES sandbox requirement)
 * AWS will send them an email with a verification link to click
 */
async function verifyEmail(email) {
  if (!email) return { success: false, error: 'No email provided' };
  email = email.toLowerCase().trim();
  
  // Skip if production mode
  if (await checkProductionMode()) {
    return { success: true, message: 'Production mode - no verification needed' };
  }
  
  // Skip if already verified
  if (verifiedCache.has(email)) {
    return { success: true, message: 'Already verified', alreadyVerified: true };
  }
  
  try {
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: email }));
    console.log(`[SES] Verification sent to: ${email}`);
    return { success: true, message: `Verification email sent to ${email}` };
  } catch (e) {
    console.error(`[SES] Verify error for ${email}:`, e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Verify multiple emails at once
 */
async function verifyEmails(emails) {
  if (await checkProductionMode()) return { success: true, message: 'Production mode' };
  
  const results = [];
  for (const email of emails) {
    if (email) {
      const result = await verifyEmail(email);
      results.push({ email, ...result });
      // Small delay to avoid throttling
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return results;
}

/**
 * Get verification status summary
 */
async function getVerificationStatus() {
  const production = await checkProductionMode();
  if (production) return { mode: 'production', verified: 'all', count: 'unlimited' };
  
  await loadVerifiedEmails();
  return {
    mode: 'sandbox',
    maxPerDay: 200,
    verified: [...verifiedCache],
    count: verifiedCache.size
  };
}

// Initialize on load
loadVerifiedEmails().catch(console.error);
checkProductionMode().catch(console.error);

module.exports = { verifyEmail, verifyEmails, isEmailVerified, loadVerifiedEmails, getVerificationStatus, checkProductionMode };
