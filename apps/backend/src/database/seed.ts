import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { tenants, users, subscriptionPlans, tenantSubscriptions } from './schema';

dotenv.config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME,
  });

  const db = drizzle(connection, { mode: 'default' });

  // 1. Buat tenant utama (Tenjo Hotspot)
  const tenantId = randomUUID();
  await db.insert(tenants).values({
    id: tenantId,
    name: 'Tenjo Hotspot',
    slug: 'tenjo-hotspot',
    email: 'admin@tenjo.com',
    phone: '08123456789',
    address: 'Tenjo, Banten',
  });

  // 2. Buat super admin
  const hashedPassword = await bcrypt.hash('password123', 12);
  await db.insert(users).values({
    tenantId,
    name: 'Super Admin',
    email: 'admin@tenjo.com',
    password: hashedPassword,
    role: 'super_admin',
  });

  // 3. paket default
  const plans = [
    {
      name: 'Basic',
      description: 'Cocok untuk mitra kecil',
      priceMonthly: '150000',
      maxCustomers: 100,
      maxMikrotik: 1,
      maxIpPools: 5,
      maxUsers: 2,
      hasWhatsapp: false,
      hasReports: false,
    },
    {
      name: 'Standard',
      description: 'Untuk mitra menengah',
      priceMonthly: '300000',
      maxCustomers: 500,
      maxMikrotik: 3,
      maxIpPools: 20,
      maxUsers: 5,
      hasWhatsapp: true,
      hasReports: true,
    },
    {
      name: 'Premium',
      description: 'Untuk mitra besar, semua fitur',
      priceMonthly: '600000',
      maxCustomers: -1,     // Unlimited
      maxMikrotik: -1,
      maxIpPools: -1,
      maxUsers: -1,
      hasWhatsapp: true,
      hasApiAccess: true,
      hasReports: true,
    },
  ];

  await db.insert(subscriptionPlans).values(plans);

  // Beri Tenjo Hotspot (tenant pertama) langganan Premium unlimited
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 10); // 10 tahun

  const [premiumPlan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.name, 'Premium'))
    .limit(1);

  await db.insert(tenantSubscriptions).values({
    tenantId,
    planId: premiumPlan.id,
    status: 'active',
    startedAt: new Date(),
    expiresAt,
    durationMonths: 120,
    amountPaid: '0',
    notes: 'Akun pemilik platform - Premium lifetime',
  });

  console.log('✅ Seed berhasil!');
  console.log('   Tenant slug : tenjo-hotspot');
  console.log('   Email       : admin@tenjo.com');
  console.log('   Password    : password123');

  await connection.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed gagal:', err);
  process.exit(1);
});