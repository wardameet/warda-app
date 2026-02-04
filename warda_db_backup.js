const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();
async function backup() {
  console.log('Starting database backup...');
  const data = {};
  const models = ['careHome','adminUser','user','residentProfile','staffMember','familyContact','tablet','conversation','message','medication','healthLog','alert','auditLog','pushSubscription','calendarEvent','subscription','invoice'];
  for (const m of models) {
    try { data[m] = await prisma[m].findMany(); console.log('  ' + m + ': ' + data[m].length); } catch(e) { data[m] = []; }
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fp = '/home/ec2-user/warda-db-backup-' + ts + '.json';
  fs.writeFileSync(fp, JSON.stringify({ backupDate: new Date().toISOString(), data }, null, 2));
  console.log('Saved: ' + fp + ' (' + (fs.statSync(fp).size / 1024).toFixed(1) + ' KB)');
  process.exit(0);
}
backup().catch(e => { console.error(e); process.exit(1); });
