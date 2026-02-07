const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const ch = await prisma.careHome.findFirst();
  await prisma.careHome.update({
    where: { id: ch.id },
    data: { address: '12 Station Road, Newmachar', city: 'Newmachar', postcode: 'AB21 0RJ' }
  });
  console.log('✅ Care home location updated to Newmachar');
}
main().catch(console.error).finally(() => prisma.$disconnect());
