// ═══════════════════════════════════════════════════════════════
// WARDA DATABASE RESET & SEED SCRIPT (FIXED)
// Run on EC2: cd ~/warda-app && node warda_reset_seed.js
// ═══════════════════════════════════════════════════════════════

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetAndSeed() {
  console.log('\n🗑️  STEP 1: Wiping all existing data...\n');

  const deletions = [
    ['invoice', prisma.invoice],
    ['subscription', prisma.subscription],
    ['calendarEvent', prisma.calendarEvent],
    ['healthLog', prisma.healthLog],
    ['medication', prisma.medication],
    ['alert', prisma.alert],
    ['message', prisma.message],
    ['conversation', prisma.conversation],
    ['familyContact', prisma.familyContact],
    ['residentProfile', prisma.residentProfile],
    ['adminUser', prisma.adminUser],
    ['user', prisma.user],
    ['careHome', prisma.careHome],
  ];

  for (const [name, model] of deletions) {
    try {
      const result = await model.deleteMany();
      console.log('  ✓ ' + name + ': deleted ' + result.count + ' records');
    } catch (e) {
      console.log('  ⚠ ' + name + ': ' + e.message.slice(0, 80));
    }
  }

  console.log('\n🌱 STEP 2: Creating fresh data...\n');

  // ── 1. Care Home (matches actual Prisma schema) ──
  const careHome = await prisma.careHome.create({
    data: {
      name: 'Sunny Gardens Care Home',
      address: '42 Rose Lane, Edinburgh EH1 2AB',
      city: 'Edinburgh',
      postcode: 'EH1 2AB',
      country: 'Scotland',
      phone: '+44 131 555 0100',
      managerName: 'Hafsa Rguib',
      managerEmail: 'hafsa@meetwarda.com',
      subscriptionTier: 'STANDARD',
      status: 'ACTIVE',
      maxResidents: 50,
    }
  });
  console.log('  ✅ Care Home: ' + careHome.name + ' (' + careHome.id + ')');

  // ── 2. Super Admin (no passwordHash field in schema) ──
  const superAdmin = await prisma.adminUser.create({
    data: {
      email: 'hafsa@meetwarda.com',
      name: 'Hafsa Rguib',
      role: 'SUPER_ADMIN',
      phone: '+44 7700 900001',
      isActive: true,
    }
  });
  console.log('  ✅ Super Admin: ' + superAdmin.name + ' (' + superAdmin.email + ')');

  // ── 3. Staff Manager ──
  const staff = await prisma.adminUser.create({
    data: {
      email: 'staff@sunnygardens.care',
      name: 'Emma MacLeod',
      role: 'MANAGER',
      careHomeId: careHome.id,
      phone: '+44 131 555 0101',
      isActive: true,
    }
  });
  console.log('  ✅ Staff: ' + staff.name + ' (' + staff.email + ')');

  // ── 4. Resident ──
  const resident = await prisma.user.create({
    data: {
      firstName: 'Margaret',
      lastName: 'Campbell',
      preferredName: 'Maggie',
      dateOfBirth: new Date('1940-03-15'),
      roomNumber: '12A',
      pin: '1234',
      status: 'ACTIVE',
      accountType: 'B2B',
      careHomeId: careHome.id,
    }
  });
  console.log('  ✅ Resident: ' + resident.preferredName + ' ' + resident.lastName + ' (PIN: 1234)');

  // ── 5. Resident Profile ──
  const profile = await prisma.residentProfile.create({
    data: {
      residentId: resident.id,
      birthplace: 'Glasgow, Scotland',
      career: 'Primary school teacher for 35 years',
      hobbies: ['Gardening', 'Baking shortbread', 'Knitting', 'Reading'],
      favouriteMusic: 'Scottish folk music, hymns, Frank Sinatra',
      favouriteFoods: 'Shortbread, tablet, Sunday roast',
      faithType: 'Church of Scotland',
      culturalBackground: 'Scottish',
      languagePreference: 'English',
      hearing: 'Mild hearing loss - speak clearly',
      vision: 'Reads with glasses',
      mobilityLevel: 'WITH_AID',
      communicationStyle: 'CHATTY',
      wardaBackstory: 'Warda speaks to Maggie like a warm, caring friend.',
      wardaTraits: ['Patient', 'Warm', 'Scottish-aware'],
      hardBoundaries: ['Avoid detailed talk about husband Robert illness'],
      questionnaireStep: 7,
      questionnaireComplete: true,
    }
  });
  console.log('  ✅ Profile: Questionnaire data seeded for ' + resident.preferredName);

  // ── 6. Family: Son ──
  const son = await prisma.familyContact.create({
    data: {
      userId: resident.id,
      name: 'James Campbell',
      relationship: 'Son',
      email: 'james.campbell@email.com',
      phone: '+44 7700 900010',
      isPrimary: true,
    }
  });
  console.log('  ✅ Family: ' + son.name + ' (Son) — ' + son.email);

  // ── 7. Family: Daughter ──
  const daughter = await prisma.familyContact.create({
    data: {
      userId: resident.id,
      name: 'Sarah Campbell',
      relationship: 'Daughter',
      email: 'sarah.campbell@email.com',
      phone: '+44 7700 900011',
      isPrimary: false,
    }
  });
  console.log('  ✅ Family: ' + daughter.name + ' (Daughter) — ' + daughter.email);

  // ── 8. Medication ──
  const med = await prisma.medication.create({
    data: {
      userId: resident.id,
      name: 'Paracetamol',
      dosage: '500mg',
      frequency: 'Twice daily',
      timeOfDay: ['Morning', 'Evening'],
      isActive: true,
    }
  });
  console.log('  ✅ Medication: ' + med.name + ' ' + med.dosage);

  // ── 9. Subscription ──
  const sub = await prisma.subscription.create({
    data: {
      careHomeId: careHome.id,
      email: 'hafsa@meetwarda.com',
      name: 'Sunny Gardens Care Home',
      planId: 'b2b_standard',
      planName: 'Care Home Standard',
      amount: 2500,
      residentCount: 1,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }
  });
  console.log('  ✅ Subscription: ' + sub.planName);

  // ═══ Summary ═══
  console.log('\n' + '='.repeat(60));
  console.log('  🌹 WARDA DATABASE RESET COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log('  Care Home:     ' + careHome.name);
  console.log('  Super Admin:   Hafsa Rguib — hafsa@meetwarda.com');
  console.log('  Staff:         Emma MacLeod — staff@sunnygardens.care');
  console.log('  Resident:      Maggie Campbell — PIN: 1234 — Room 12A');
  console.log('  Family (Son):  James Campbell — james.campbell@email.com');
  console.log('  Family (Girl): Sarah Campbell — sarah.campbell@email.com');
  console.log('');
  console.log('  Resident ID:   ' + resident.id);
  console.log('  Care Home ID:  ' + careHome.id);
  console.log('');

  await prisma.$disconnect();
  process.exit(0);
}

resetAndSeed().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
