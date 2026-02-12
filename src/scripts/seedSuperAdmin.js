const prisma = require('../lib/prisma');

async function main() {
  const admin = await prisma.adminUser.upsert({
    where: { email: 'admin@meetwarda.com' },
    update: {},
    create: {
      email: 'admin@meetwarda.com',
      name: 'Warda Super Admin',
      role: 'SUPER_ADMIN',
      careHomeId: null,
      isActive: true
    }
  });
  console.log('Super Admin:', admin.email, '|', admin.role);

  const careHome = await prisma.careHome.create({
    data: {
      name: 'Sunny Gardens Care Home',
      address: '42 Rose Street',
      city: 'Edinburgh',
      postcode: 'EH2 3JD',
      country: 'UK',
      phone: '0131 555 0123',
      managerName: 'Sarah MacLeod',
      managerEmail: 'sarah@sunnygardens.co.uk',
      subscriptionTier: 'PILOT',
      status: 'PILOT',
      maxResidents: 30
    }
  });
  console.log('Care Home:', careHome.name, '|', careHome.city);

  const manager = await prisma.adminUser.create({
    data: {
      email: 'sarah@sunnygardens.co.uk',
      name: 'Sarah MacLeod',
      role: 'MANAGER',
      careHomeId: careHome.id,
      isActive: true
    }
  });
  console.log('Manager:', manager.email);

  const resident = await prisma.user.create({
    data: {
      firstName: 'Margaret',
      lastName: 'Campbell',
      preferredName: 'Maggie',
      dateOfBirth: new Date('1940-03-15'),
      roomNumber: '12A',
      status: 'ACTIVE',
      accountType: 'B2B',
      careHomeId: careHome.id
    }
  });
  console.log('Resident:', resident.firstName, resident.lastName, '| Room:', resident.roomNumber);

  await prisma.residentProfile.create({
    data: {
      residentId: resident.id,
      questionnaireStep: 0,
      questionnaireComplete: false
    }
  });
  console.log('Profile: created (empty, ready for questionnaire)');

  await prisma.familyContact.create({
    data: {
      name: 'Sarah Campbell',
      relationship: 'Daughter',
      email: 'sarah.campbell@email.com',
      phone: '07700 900123',
      isPrimary: true,
      accessLevel: 'FULL',
      inviteStatus: 'PENDING',
      userId: resident.id
    }
  });
  console.log('Family: Sarah Campbell (Daughter)');

  console.log('\nSeed complete!');
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
