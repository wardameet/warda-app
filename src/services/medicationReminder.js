/**
 * Medication Reminder Service
 * Checks every 15 minutes for due medications and notifies tablets
 */
const prisma = require('../lib/prisma');
const { textToSpeech, VOICES } = require('./voice');

const TIME_MAP = {
  'Morning': { hour: 8, label: 'morning' },
  'Noon': { hour: 12, label: 'noon' },
  'Afternoon': { hour: 14, label: 'afternoon' },
  'Evening': { hour: 18, label: 'evening' },
  'Bedtime': { hour: 21, label: 'bedtime' }
};

// Track which reminders we've already sent today
const sentReminders = new Map(); // key: `${medId}-${timeOfDay}-${dateStr}`

function getSentKey(medId, timeSlot) {
  const dateStr = new Date().toISOString().split('T')[0];
  return `${medId}-${timeSlot}-${dateStr}`;
}

async function checkMedicationReminders(io) {
  const now = new Date();
  const currentHour = now.getUTCHours(); // Server is UTC
  const currentMin = now.getUTCMinutes();

  try {
    const activeMeds = await prisma.medication.findMany({
      where: { isActive: true },
      include: { user: { select: { id: true, firstName: true, preferredName: true, careHomeId: true } } }
    });

    for (const med of activeMeds) {
      for (const timeSlot of med.timeOfDay) {
        const mapped = TIME_MAP[timeSlot];
        if (!mapped) continue;

        const dueHour = mapped.hour;
        // Trigger if current time is within 15 min window of due time
        if (currentHour === dueHour && currentMin < 15) {
          const key = getSentKey(med.id, timeSlot);
          if (sentReminders.has(key)) continue;

          const name = med.user.preferredName || med.user.firstName;
          const message = `${name}, dear, it's time for your ${mapped.label} medication: ${med.name}${med.dosage ? ' (' + med.dosage + ')' : ''}. ${med.notes || ''}`.trim();

          try {
            const audio = await textToSpeech(message, VOICES.female);
            
            if (io) {
              io.to(`tablet:${med.user.id}`).emit('medication:reminder', {
                medicationId: med.id,
                name: med.name,
                dosage: med.dosage,
                timeSlot,
                text: message,
                audio: audio.audio,
                contentType: audio.contentType
              });
            }

            // Also notify staff
            if (io && med.user.careHomeId) {
              io.to(`care_home:${med.user.careHomeId}`).emit('medication:due', {
                residentId: med.user.id,
                residentName: name,
                medication: med.name,
                dosage: med.dosage,
                timeSlot
              });
            }

            sentReminders.set(key, true);
            console.log(`[MedReminder] Sent: ${name} - ${med.name} (${timeSlot})`);
          } catch (err) {
            console.error(`[MedReminder] TTS failed for ${med.name}:`, err.message);
          }
        }
      }
    }

    // Clean old entries (keep only today's)
    const today = new Date().toISOString().split('T')[0];
    for (const [key] of sentReminders) {
      if (!key.includes(today)) sentReminders.delete(key);
    }
  } catch (err) {
    console.error('[MedReminder] Check failed:', err);
  }
}

function startMedicationReminders(io) {
  console.log('[MedReminder] Scheduler started (every 15 min)');
  // Check every 15 minutes
  setInterval(() => checkMedicationReminders(io), 15 * 60 * 1000);
  // First check after 2 minutes
  setTimeout(() => checkMedicationReminders(io), 2 * 60 * 1000);
}

module.exports = { startMedicationReminders, checkMedicationReminders };
