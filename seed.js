const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Create Care Home
  const careHome = await prisma.careHome.create({
    data: {
      name: 'Sunny Gardens Care Home',
      address: '42 Rose Street',
      city: 'Edinburgh',
      postcode: 'EH2 3AT',
      phone: '0131 555 0123',
      status: 'PILOT',
    }
  });
  console.log('✅ Care Home:', careHome.name, careHome.id);

  // 2. Create Resident (Hafsa)
  const hafsa = await prisma.user.create({
    data: {
      firstName: 'Hafsa',
      lastName: 'Ahmed',
      preferredName: 'Hafsa',
      roomNumber: '12',
      pin: '1234',
      careHomeId: careHome.id,
      status: 'ACTIVE',
      accountType: 'B2B',
    }
  });
  console.log('✅ Resident:', hafsa.firstName, hafsa.id);

  // 3. Create Device Code linked to Hafsa
  const device = await prisma.deviceCode.create({
    data: {
      code: 'SUNNY-TEST-2026-LIVE',
      careHomeId: careHome.id,
      assignedUserId: hafsa.id,
      deviceName: 'Hafsa Tablet',
      status: 'ACTIVE',
      activatedAt: new Date(),
    }
  });
  console.log('✅ Device Code:', device.code, '→', hafsa.firstName);

  // 4. Create Family Member (Abid)
  const abid = await prisma.familyContact.create({
    data: {
      firstName: 'Abid',
      lastName: 'Ahmed',
      relationship: 'Son',
      email: 'abid@meetwarda.com',
      phone: '07700 900123',
      userId: hafsa.id,
      isPrimary: true,
      accessLevel: 'FULL',
      inviteStatus: 'ACCEPTED',
    }
  });
  console.log('✅ Family:', abid.firstName, '(' + abid.relationship + ')');

  // 5. Create Super Admin
  const admin = await prisma.adminUser.create({
    data: {
      email: 'admin@meetwarda.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      careHomeId: careHome.id,
    }
  });
  console.log('✅ Super Admin:', admin.email);

  console.log('\n🌹 Seed complete! Device code: SUNNY-TEST-2026-LIVE');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
