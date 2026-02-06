const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contact = await prisma.familyContact.findFirst({ 
    where: { email: 'sarah.campbell@email.com' },
    include: { user: true }
  });
  
  if (!contact) {
    console.log('No family contact found');
    return;
  }
  
  console.log('Family Contact:', contact.name, '| Resident:', contact.user?.firstName);
  
  const existing = await prisma.adminUser.findUnique({ where: { email: 'sarah.campbell@email.com' } });
  if (existing) {
    console.log('AdminUser already exists with role:', existing.role);
    return;
  }
  
  const adminUser = await prisma.adminUser.create({
    data: {
      email: 'sarah.campbell@email.com',
      name: contact.name,
      role: 'FAMILY_B2B',
      cognitoSub: '2662c254-e0d1-70b7-98ca-36e0e225f1d3',
      linkedResidentId: contact.userId
    }
  });
  
  console.log('Created AdminUser for Sarah:', adminUser.id, 'Role:', adminUser.role);
}

main().catch(console.error).finally(() => prisma.$disconnect());
