/**
 * Push Notification Service
 * Sends web push notifications to family members
 */
const webpush = require('web-push');
const prisma = require('../lib/prisma');

// Configure VAPID
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:hello@meetwarda.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send push notification to all subscriptions for a user
 */
async function sendPushToUser(userId, payload) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });
    if (subscriptions.length === 0) return { sent: 0 };

    const notification = JSON.stringify({
      title: payload.title || 'Warda',
      body: payload.body || '',
      icon: payload.icon || '/warda-icon-192.png',
      badge: '/warda-badge-72.png',
      tag: payload.tag || 'warda-notification',
      data: payload.data || {},
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, notification);
        sent++;
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
          console.log('Removed expired push subscription:', sub.id);
        } else {
          console.error('Push send error:', err.statusCode, err.message);
        }
      }
    }
    return { sent, total: subscriptions.length };
  } catch (err) {
    console.error('sendPushToUser error:', err);
    return { sent: 0, error: err.message };
  }
}

/**
 * Send push to all family members of a resident
 */
async function sendPushToFamily(residentId, payload) {
  try {
    const familyMembers = await prisma.familyContact.findMany({
      where: { userId: residentId },
      select: { id: true, name: true }
    });
    let totalSent = 0;
    for (const member of familyMembers) {
      const result = await sendPushToUser(member.id, payload);
      totalSent += result.sent;
    }
    return { sent: totalSent, familyMembers: familyMembers.length };
  } catch (err) {
    console.error('sendPushToFamily error:', err);
    return { sent: 0, error: err.message };
  }
}

module.exports = { sendPushToUser, sendPushToFamily };
