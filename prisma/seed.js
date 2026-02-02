const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Care Home
  const careHome = await prisma.careHome.create({
    data: {
      name: 'Sunny Gardens Care Home',
      address: '123 Rose Street, Edinburgh, EH1 2AB',
      phone: '0131 555 0123',
    },
  });
  console.log('✅ Care Home created:', careHome.name);

  // Create Elderly User (Resident)
  const elderlyUser = await prisma.user.create({
    data: {
      email: 'margaret@warda.test',
      userType: 'RESIDENT',
      resident: {
        create: {
          firstName: 'Margaret',
          lastName: 'Campbell',
          preferredName: 'Maggie',
          roomNumber: '12A',
          careHomeId: careHome.id,
          pin: '1234',
          language: 'en-GB',
          voicePreference: 'female',
        },
      },
    },
    include: { resident: true },
  });
  console.log('✅ Resident created:', elderlyUser.resident.firstName);

  // Create Family Member 1 - Daughter
  const daughter = await prisma.user.create({
    data: {
      email: 'sarah.campbell@email.com',
      userType: 'FAMILY',
      familyMember: {
        create: {
          firstName: 'Sarah',
          lastName: 'Campbell',
          phone: '07700 900123',
        },
      },
    },
    include: { familyMember: true },
  });
  console.log('✅ Family member created:', daughter.familyMember.firstName);

  // Create Family Member 2 - Son
  const son = await prisma.user.create({
    data: {
      email: 'james.campbell@email.com',
      userType: 'FAMILY',
      familyMember: {
        create: {
          firstName: 'James',
          lastName: 'Campbell',
          phone: '07700 900456',
        },
      },
    },
    include: { familyMember: true },
  });
  console.log('✅ Family member created:', son.familyMember.firstName);

  // Create Family Contacts (relationships)
  await prisma.familyContact.create({
    data: {
      residentId: elderlyUser.resident.id,
      familyMemberId: daughter.familyMember.id,
      relationship: 'Daughter',
      isPrimary: true,
      canViewMedications: true,
      canViewMood: true,
      canReceiveAlerts: true,
    },
  });

  await prisma.familyContact.create({
    data: {
      residentId: elderlyUser.resident.id,
      familyMemberId: son.familyMember.id,
      relationship: 'Son',
      isPrimary: false,
      canViewMedications: false,
      canViewMood: true,
      canReceiveAlerts: true,
    },
  });
  console.log('✅ Family contacts linked');

  // Create some messages
  await prisma.message.createMany({
    data: [
      {
        senderId: daughter.id,
        recipientId: elderlyUser.id,
        content: 'Hi Mum! The kids are so excited to see you today! 🎉',
        messageType: 'TEXT',
        status: 'READ',
      },
      {
        senderId: daughter.id,
        recipientId: elderlyUser.id,
        content: 'We will bring some of that cake you like',
        messageType: 'TEXT',
        status: 'READ',
      },
      {
        senderId: elderlyUser.id,
        recipientId: daughter.id,
        content: 'That sounds lovely dear! Cannot wait to see the wee ones',
        messageType: 'TEXT',
        status: 'DELIVERED',
        sentViaWarda: true,
      },
      {
        senderId: daughter.id,
        recipientId: elderlyUser.id,
        content: 'See you at 2! Love you 💕',
        messageType: 'TEXT',
        status: 'SENT',
      },
    ],
  });
  console.log('✅ Messages created');

  // Create medications
  await prisma.medication.create({
    data: {
      residentId: elderlyUser.resident.id,
      name: 'Aspirin',
      dosage: '75mg',
      instructions: 'Take with food - the small white tablet',
      times: ['08:00', '20:00'],
      isActive: true,
    },
  });

  await prisma.medication.create({
    data: {
      residentId: elderlyUser.resident.id,
      name: 'Vitamin D',
      dosage: '1000 IU',
      instructions: 'The yellow capsule - take in the morning',
      times: ['08:00'],
      isActive: true,
    },
  });
  console.log('✅ Medications created');

  // Create Staff Member
  const staff = await prisma.user.create({
    data: {
      email: 'nurse.helen@sunnygarderns.care',
      userType: 'STAFF',
      staffMember: {
        create: {
          firstName: 'Helen',
          lastName: 'MacLeod',
          role: 'NURSE',
          careHomeId: careHome.id,
        },
      },
    },
    include: { staffMember: true },
  });
  console.log('✅ Staff member created:', staff.staffMember.firstName);

  console.log('\n🎉 Seed completed successfully!\n');
  
  // Print summary
  console.log('📋 Test Accounts:');
  console.log('   Resident: margaret@warda.test (PIN: 1234)');
  console.log('   Daughter: sarah.campbell@email.com');
  console.log('   Son: james.campbell@email.com');
  console.log('   Staff: nurse.helen@sunnygarderns.care');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
