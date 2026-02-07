const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hafsa = await prisma.user.findFirst({ where: { firstName: 'Hafsa' } });
  const careHome = await prisma.careHome.findFirst();

  await prisma.user.update({
    where: { id: hafsa.id },
    data: { lastName: 'Rguib' }
  });
  console.log('✅ Updated Resident: Hafsa Rguib');

  await prisma.careHome.update({
    where: { id: careHome.id },
    data: { name: 'Newmachar Care Home' }
  });
  console.log('✅ Updated Care Home: Newmachar Care Home');

  const abid = await prisma.familyContact.create({
    data: {
      name: 'Abid Kasem',
      firstName: 'Abid',
      lastName: 'Kasem',
      relationship: 'Son',
      email: 'abid@meetwarda.com',
      phone: '07700 900123',
      userId: hafsa.id,
      isPrimary: true,
      accessLevel: 'FULL',
      inviteStatus: 'ACCEPTED',
    }
  });
  console.log('✅ Family:', abid.name);

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

  console.log('\n🌹 Seed complete!');
  console.log('Care Home: Newmachar Care Home');
  console.log('Resident: Hafsa Rguib (Room 12, PIN: 1234)');
  console.log('Family: Abid Kasem (Son)');
  console.log('Device code: SUNNY-TEST-2026-LIVE');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
