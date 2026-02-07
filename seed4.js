const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const careHome = await prisma.careHome.findFirst();
  const admin = await prisma.adminUser.create({
    data: {
      name: 'Super Admin',
      email: 'admin@meetwarda.com',
      role: 'SUPER_ADMIN',
      careHomeId: careHome.id,
    }
  });
  console.log('✅ Super Admin:', admin.email);
  console.log('\n🌹 All seed data complete!');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
