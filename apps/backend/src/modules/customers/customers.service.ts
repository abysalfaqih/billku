import {
  Injectable, Inject, NotFoundException, ConflictException, Logger, BadRequestException,
} from '@nestjs/common';
import { eq, and, like, or, count, desc, isNotNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleClient } from '../../database/database.module';
import { customers, packages, ipPools, mikrotikConfigs, areas, bills, payments, whatsappLogs } from '../../database/schema';
import { RadiusService } from '../radius/radius.service';
import { MikrotikService } from '../mikrotik/mikrotik.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { WhatsappTemplatesService } from '../whatsapp-templates/whatsapp-templates.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { QueryCustomerDto } from './dto/query-customer.dto';

const DISCONNECTED = ['isolated', 'suspended', 'terminated'];

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleClient,
    private radiusService: RadiusService,
    private mikrotikService: MikrotikService,
    private whatsappService: WhatsAppService,
    private whatsappTemplatesService: WhatsappTemplatesService,
  ) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  async create(dto: CreateCustomerDto, user: AuthUser) {
    await this.validatePackageBelongsToTenant(dto.packageId, user.tenantId);
    await this.validateAreaBelongsToTenant(dto.areaId, user.tenantId);
    if (dto.usernamePppoe) await this.ensurePppoeUnique(dto.usernamePppoe, user.tenantId);

    const [result] = await this.db.insert(customers).values({
      tenantId: user.tenantId,
      packageId: dto.packageId,
      areaId: dto.areaId,
      connectionType: dto.connectionType ?? 'pppoe',
      mikrotikConfigId: dto.mikrotikConfigId ?? null,
      hotspotProfile: dto.hotspotProfile ?? null,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: dto.address,
      nik: dto.nik,
      usernamePppoe: dto.usernamePppoe,
      passwordPppoe: dto.passwordPppoe,
      pppoeProfile: dto.pppoeProfile,
      ipAddress: dto.ipAddress,
      billingDate: dto.billingDate,
      installationDate: dto.installationDate ? new Date(dto.installationDate) : undefined,
      notes: dto.notes,
      taxEnabled: dto.taxEnabled ?? false,
      taxPercent: dto.taxEnabled ? String(dto.taxPercent) : undefined,
    });

    const customer = await this.findOne(Number(result.insertId), user);

    // ── Sync ke Mikrotik / RADIUS ────────────────────────────────────────────
    if (dto.connectionType === 'hotspot') {
      await this.syncHotspotToMikrotik(customer, user.tenantId);
    } else {
      if (dto.usernamePppoe && dto.passwordPppoe) {
        await this.syncCustomerToRadius(dto.usernamePppoe, dto.passwordPppoe, dto.packageId);
      }
    }

    // WA notif
    if (dto.phone) {
      const [pkg] = await this.db
        .select({ name: packages.name })
        .from(packages)
        .where(eq(packages.id, dto.packageId))
        .limit(1);

      await this.whatsappService.queueNotification({
        tenantId: user.tenantId,
        phone: dto.phone,
        message: await this.whatsappTemplatesService.render(
          'registration',
          user.tenantId,
          {
            name: dto.name,
            packageName: pkg?.name ?? '-',
            username: dto.usernamePppoe ?? '-',
            billingDate: String(dto.billingDate),
          },
        ),
        trigger: 'registration',
        customerId: Number(result.insertId),
      });
    }

    return customer;
  }

  // ─── FindAll ───────────────────────────────────────────────────────────────

  async findAll(query: QueryCustomerDto, user: AuthUser) {
    const { page = 1, limit = 20, status, search, packageId, areaId } = query;
    const offset = (page - 1) * limit;

    let searchCondition: SQL | undefined;
    if (search) {
      searchCondition = or(
        like(customers.name, `%${search}%`),
        like(customers.phone, `%${search}%`),
        like(customers.email, `%${search}%`),
      );
    }

    const where = and(
      eq(customers.tenantId, user.tenantId),
      status ? eq(customers.status, status) : undefined,
      packageId ? eq(customers.packageId, packageId) : undefined,
      areaId ? eq(customers.areaId, areaId) : undefined,
      searchCondition,
    );

    const [data, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: customers.id, tenantId: customers.tenantId,
          packageId: customers.packageId, areaId: customers.areaId,
          areaName: areas.name,
          connectionType: customers.connectionType,
          mikrotikConfigId: customers.mikrotikConfigId,
          hotspotProfile: customers.hotspotProfile,
          name: customers.name, email: customers.email, phone: customers.phone,
          address: customers.address, nik: customers.nik,
          usernamePppoe: customers.usernamePppoe, passwordPppoe: customers.passwordPppoe,
          pppoeProfile: customers.pppoeProfile, ipAddress: customers.ipAddress,
          billingDate: customers.billingDate, installationDate: customers.installationDate,
          taxEnabled: customers.taxEnabled, taxPercent: customers.taxPercent,
          status: customers.status, notes: customers.notes,
          createdAt: customers.createdAt, updatedAt: customers.updatedAt,
        })
        .from(customers)
        .leftJoin(areas, eq(customers.areaId, areas.id))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(customers.name),
      this.db.select({ total: count() }).from(customers).where(where),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── FindOne ───────────────────────────────────────────────────────────────

  async findOne(id: number, user: AuthUser) {
    const [customer] = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId)))
      .limit(1);
    if (!customer) throw new NotFoundException(`Pelanggan #${id} tidak ditemukan`);
    return customer;
  }

  async findOneDetail(id: number, user: AuthUser) {
    const customer = await this.findOne(id, user);

    const [pkg] = customer.packageId
      ? await this.db
          .select({ id: packages.id, name: packages.name, speedDownload: packages.speedDownload, speedUpload: packages.speedUpload, price: packages.price })
          .from(packages).where(eq(packages.id, customer.packageId)).limit(1)
      : [null];

    const [area] = customer.areaId
      ? await this.db.select({ id: areas.id, name: areas.name }).from(areas).where(eq(areas.id, customer.areaId)).limit(1)
      : [null];

    const billList = await this.db.select().from(bills)
      .where(and(eq(bills.customerId, id), eq(bills.tenantId, user.tenantId)))
      .orderBy(desc(bills.createdAt)).limit(24);

    const paymentList = await this.db.select().from(payments)
      .where(and(eq(payments.customerId, id), eq(payments.tenantId, user.tenantId)))
      .orderBy(desc(payments.paidAt)).limit(24);

    const totalPaid   = paymentList.reduce((s, p) => s + Number(p.amount), 0);
    const totalUnpaid = billList
      .filter(b => b.status === 'unpaid' || b.status === 'overdue')
      .reduce((s, b) => s + Number(b.totalAmount), 0);

    return { customer, package: pkg, area, bills: billList, payments: paymentList, totalPaid, totalUnpaid };
  }

  // ─── Update ────────────────────────────────────────────────────────────────

  async update(id: number, dto: UpdateCustomerDto, user: AuthUser) {
    const existing = await this.findOne(id, user);

    if (dto.packageId) await this.validatePackageBelongsToTenant(dto.packageId, user.tenantId);
    if (dto.areaId)    await this.validateAreaBelongsToTenant(dto.areaId, user.tenantId);
    if (dto.usernamePppoe && dto.usernamePppoe !== existing.usernamePppoe) {
      await this.ensurePppoeUnique(dto.usernamePppoe, user.tenantId, id);
    }

    const { installationDate, taxPercent, ...rest } = dto;
    await this.db
      .update(customers)
      .set({
        ...rest,
        ...(installationDate !== undefined ? { installationDate: new Date(installationDate) } : {}),
        ...(taxPercent !== undefined ? { taxPercent: String(taxPercent) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId)));

    const updated = await this.findOne(id, user);

    // ── Sync Hotspot ──────────────────────────────────────────────────────────
    if (existing.connectionType === 'hotspot') {
      const mtk = await this.getHotspotMikrotikConfig(updated);

      // Password berubah
      if (dto.passwordPppoe && dto.passwordPppoe !== existing.passwordPppoe && mtk && updated.usernamePppoe) {
        try {
          await this.mikrotikService.createHotspotUser(
            mtk, updated.usernamePppoe, dto.passwordPppoe,
            updated.hotspotProfile ?? 'default',
          );
        } catch (err) {
          this.logger.error(`Hotspot update password '${updated.usernamePppoe}': ${err}`);
        }
      }

      // Status berubah
      if (dto.status && dto.status !== existing.status && mtk && updated.usernamePppoe) {
        try {
          if (dto.status === 'active') {
            await this.mikrotikService.enableHotspotUser(mtk, updated.usernamePppoe);
          } else {
            // Disable + kick session sekaligus
            await this.mikrotikService.disableHotspotUser(mtk, updated.usernamePppoe);
          }
        } catch (err) {
          this.logger.error(`Hotspot update status '${updated.usernamePppoe}': ${err}`);
        }
      }

      return updated;
    }

    // ── Sync PPPoE ke RADIUS + Mikrotik ───────────────────────────────────────
    const oldUsername = existing.usernamePppoe;
    const newUsername = dto.usernamePppoe ?? oldUsername;

    if (oldUsername) {
      // Rename username
      if (newUsername && newUsername !== oldUsername) {
        try {
          await this.radiusService.renameUser(oldUsername, newUsername);
          const mtk = await this.getPppoeMikrotikConfig(existing);
          if (mtk) await this.mikrotikService.renamePppoeSecret(mtk, oldUsername, newUsername);
        } catch (err) {
          this.logger.error(`Gagal rename '${oldUsername}' → '${newUsername}': ${err}`);
        }
      }

      const currentUsername = newUsername ?? oldUsername;

      // Password berubah
      if (dto.passwordPppoe && dto.passwordPppoe !== existing.passwordPppoe) {
        try {
          await this.radiusService.updatePassword(currentUsername, dto.passwordPppoe);
          const mtk = await this.getPppoeMikrotikConfig(existing);
          if (mtk) await this.mikrotikService.updatePppoeSecret(mtk, currentUsername, { password: dto.passwordPppoe });
        } catch (err) {
          this.logger.error(`Gagal update password '${currentUsername}': ${err}`);
        }
      }

      // Paket berubah
      if (dto.packageId && dto.packageId !== existing.packageId) {
        try {
          await this.updateRadiusRateLimit(currentUsername, dto.packageId);
          const mtk = await this.getPppoeMikrotikConfig(updated);
          if (mtk) {
            const [newPkg] = await this.db.select({ name: packages.name }).from(packages).where(eq(packages.id, dto.packageId)).limit(1);
            const profile = updated.pppoeProfile ?? newPkg?.name;
            if (profile) await this.mikrotikService.updatePppoeSecret(mtk, currentUsername, { profile });
          }
        } catch (err) {
          this.logger.error(`Gagal update paket '${currentUsername}': ${err}`);
        }
      }

      // Status berubah
      if (dto.status && dto.status !== existing.status) {
        const wasConnected    = !DISCONNECTED.includes(existing.status);
        const shouldConnect   = dto.status === 'active';
        try {
          if (shouldConnect && !wasConnected) {
            await this.radiusService.enableUser(currentUsername);
            this.logger.log(`🟢 PPPoE aktif: '${currentUsername}'`);
          } else if (!shouldConnect && wasConnected) {
            // Dipisah try/catch sendiri: kalau disableUser() di RADIUS gagal,
            // kickCustomerSession() tetap wajib jalan supaya sesi aktif di
            // Mikrotik tetap ikut diputus (begitu juga sebaliknya).
            try {
              await this.radiusService.disableUser(currentUsername);
            } catch (err) {
              this.logger.error(`Gagal disable RADIUS '${currentUsername}': ${err}`);
            }
            await this.kickCustomerSession(existing); // sudah self-catch di dalam
            this.logger.log(`🔴 PPPoE isolir: '${currentUsername}'`);
          }
        } catch (err) {
          this.logger.error(`Gagal update status PPPoE '${currentUsername}': ${err}`);
        }
      }
    }

    return updated;
  }

  // ─── Remove ────────────────────────────────────────────────────────────────

  async remove(id: number, user: AuthUser) {
    const customer = await this.findOne(id, user);

    // ── 1. Putus akses jaringan SEKARANG JUGA ──────────────────────────────
    // Best-effort: kalau router/RADIUS lagi tidak bisa dihubungi, tetap lanjut
    // ke penghapusan data (jangan sampai router down membuat data pelanggan
    // yang harusnya dihapus malah nyangkut selamanya). Errornya di-log saja.
    if (customer.connectionType === 'hotspot') {
      if (customer.usernamePppoe) {
        const mtk = await this.getHotspotMikrotikConfig(customer);
        if (mtk) {
          try {
            await this.mikrotikService.deleteHotspotUser(mtk, customer.usernamePppoe);
          } catch (err) {
            this.logger.error(`Gagal hapus Mikrotik Hotspot user '${customer.usernamePppoe}': ${err}`);
          }
        }
      }
    } else if (customer.usernamePppoe) {
      try {
        await this.radiusService.deleteUser(customer.usernamePppoe);
      } catch (err) {
        this.logger.error(`Gagal hapus RADIUS user '${customer.usernamePppoe}': ${err}`);
      }
      await this.kickCustomerSession(customer); // sudah self-catch di dalam

      try {
        const mtk = await this.getPppoeMikrotikConfig(customer);
        if (mtk) await this.mikrotikService.deletePppoeSecret(mtk, customer.usernamePppoe);
      } catch (err) {
        this.logger.error(`Gagal hapus Mikrotik PPPoE secret '${customer.usernamePppoe}': ${err}`);
      }
    }

    // ── 2. Hapus permanen dari database ────────────────────────────────────
    // Transaksi: semua-atau-tidak-sama-sekali. Urutan mengikuti arah foreign
    // key (payments → bills, whatsapp_logs → bills/customers, lalu customers)
    // supaya tidak menabrak constraint.
    await this.db.transaction(async (tx) => {
      await tx.delete(payments)
        .where(and(eq(payments.customerId, id), eq(payments.tenantId, user.tenantId)));

      await tx.delete(whatsappLogs)
        .where(and(eq(whatsappLogs.customerId, id), eq(whatsappLogs.tenantId, user.tenantId)));

      await tx.delete(bills)
        .where(and(eq(bills.customerId, id), eq(bills.tenantId, user.tenantId)));

      await tx.delete(customers)
        .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId)));
    });

    this.logger.log(
      `🗑️ Pelanggan #${id} '${customer.name}' dihapus permanen beserta seluruh ` +
      `tagihan & pembayaran terkait (mempengaruhi laporan pendapatan)`,
    );

    return { message: 'Pelanggan beserta seluruh data terkait (tagihan, pembayaran) berhasil dihapus permanen' };
  }

  // ─── Export CSV ────────────────────────────────────────────────────────────

  async exportCsv(user: AuthUser): Promise<string> {
    const all = await this.db
      .select({
        id: customers.id, name: customers.name, phone: customers.phone,
        email: customers.email, address: customers.address, nik: customers.nik,
        areaName: areas.name, status: customers.status,
        connectionType: customers.connectionType,
        billingDate: customers.billingDate, installationDate: customers.installationDate,
        usernamePppoe: customers.usernamePppoe, taxEnabled: customers.taxEnabled,
        taxPercent: customers.taxPercent, createdAt: customers.createdAt,
      })
      .from(customers)
      .leftJoin(areas, eq(customers.areaId, areas.id))
      .where(eq(customers.tenantId, user.tenantId))
      .orderBy(customers.name);

    const headers = [
      'ID','Nama','No HP','Email','Area','Alamat','NIK','Tipe Koneksi',
      'Username','Status','Tgl Tagihan','Tgl Instalasi','PPN Aktif','% PPN','Tgl Daftar',
    ];
    const rows = all.map(c => [
      String(c.id), c.name, c.phone, c.email ?? '', c.areaName ?? '',
      c.address ?? '', c.nik ?? '', c.connectionType, c.usernamePppoe ?? '',
      c.status, String(c.billingDate),
      c.installationDate ? new Date(c.installationDate).toLocaleDateString('id-ID') : '',
      c.taxEnabled ? 'Ya' : 'Tidak', c.taxPercent ?? '',
      new Date(c.createdAt).toLocaleDateString('id-ID'),
    ]);
    return this.buildCsv(headers, rows);
  }

  // ─── RADIUS Sync All ───────────────────────────────────────────────────────

  async syncAllToRadius(user: AuthUser) {
    const all = await this.db
      .select({
        id: customers.id, name: customers.name,
        usernamePppoe: customers.usernamePppoe, passwordPppoe: customers.passwordPppoe,
        pppoeProfile: customers.pppoeProfile, packageId: customers.packageId, status: customers.status,
        connectionType: customers.connectionType,
      })
      .from(customers)
      .where(and(eq(customers.tenantId, user.tenantId), isNotNull(customers.usernamePppoe)));

    let synced = 0, skipped = 0, errors = 0;

    for (const c of all) {
      // Skip hotspot — mereka tidak pakai RADIUS
      if (c.connectionType === 'hotspot') { skipped++; continue; }
      if (!c.usernamePppoe || !c.passwordPppoe) { skipped++; continue; }

      try {
        const exists = await this.radiusService.userExists(c.usernamePppoe);
        if (exists) { skipped++; continue; }

        let groupName: string | null = null;
        let speedDownload = 10, speedUpload = 10;

        if (c.packageId) {
          const [pkg] = await this.db
            .select({ name: packages.name, speedDownload: packages.speedDownload, speedUpload: packages.speedUpload })
            .from(packages).where(eq(packages.id, c.packageId)).limit(1);
          if (pkg) {
            groupName     = c.pppoeProfile ?? pkg.name;
            speedDownload = pkg.speedDownload;
            speedUpload   = pkg.speedUpload;
          }
        } else {
          groupName = c.pppoeProfile ?? null;
        }

        await this.radiusService.syncUserFromMigration(c.usernamePppoe, c.passwordPppoe, groupName, speedDownload, speedUpload);

        if (DISCONNECTED.includes(c.status)) {
          await this.radiusService.disableUser(c.usernamePppoe);
        }

        synced++;
      } catch (err: any) {
        errors++;
        this.logger.error(`RADIUS sync gagal '${c.usernamePppoe}': ${err.message}`);
      }
    }

    return { total: all.length, synced, skipped, errors, message: `Selesai: ${synced} synced, ${skipped} skipped, ${errors} errors` };
  }

  async resetPassword(id: number, newPassword: string, user: AuthUser) {
    if (!newPassword || newPassword.trim().length < 3) {
      throw new BadRequestException('Password minimal 3 karakter');
    }

    const customer = await this.findOne(id, user);

    // Update DB
    await this.db
      .update(customers)
      .set({ passwordPppoe: newPassword.trim(), updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.tenantId, user.tenantId)));

    if (customer.connectionType === 'hotspot') {
      // Hotspot → update di Mikrotik
      const mtk = await this.getHotspotMikrotikConfig(customer);
      if (mtk && customer.usernamePppoe) {
        try {
          await this.mikrotikService.createHotspotUser(
            mtk, customer.usernamePppoe, newPassword.trim(),
            customer.hotspotProfile ?? 'default',
          );
        } catch (err) {
          this.logger.error(`Reset password hotspot gagal: ${err}`);
        }
      }
    } else {
      // PPPoE → update RADIUS + Mikrotik secret
      if (customer.usernamePppoe) {
        try {
          await this.radiusService.updatePassword(customer.usernamePppoe, newPassword.trim());
        } catch (err) {
          this.logger.error(`Reset password RADIUS gagal: ${err}`);
        }
        try {
          const mtk = await this.getPppoeMikrotikConfig(customer);
          if (mtk) {
            await this.mikrotikService.updatePppoeSecret(
              mtk, customer.usernamePppoe, { password: newPassword.trim() }
            );
          }
        } catch (err) {
          this.logger.error(`Reset password Mikrotik PPPoE gagal: ${err}`);
        }
      }
    }

    return { message: 'Password berhasil direset' };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private async syncHotspotToMikrotik(
    customer: typeof customers.$inferSelect,
    tenantId: string,
  ) {
    if (!customer.usernamePppoe || !customer.passwordPppoe || !customer.mikrotikConfigId) return;

    const [config] = await this.db
      .select().from(mikrotikConfigs)
      .where(and(eq(mikrotikConfigs.id, customer.mikrotikConfigId), eq(mikrotikConfigs.tenantId, tenantId)))
      .limit(1);

    if (!config) {
      this.logger.warn(`Hotspot: Mikrotik id=${customer.mikrotikConfigId} tidak ditemukan`);
      return;
    }

    try {
      await this.mikrotikService.createHotspotUser(
        config,
        customer.usernamePppoe,
        customer.passwordPppoe,
        customer.hotspotProfile ?? 'default',
      );
    } catch (err) {
      this.logger.error(`Hotspot sync gagal untuk '${customer.usernamePppoe}': ${err}`);
    }
  }

  private async getHotspotMikrotikConfig(customer: { mikrotikConfigId: number | null }) {
    if (!customer.mikrotikConfigId) return null;
    const [config] = await this.db
      .select().from(mikrotikConfigs)
      .where(eq(mikrotikConfigs.id, customer.mikrotikConfigId))
      .limit(1);
    return config ?? null;
  }

  private async getPppoeMikrotikConfig(customer: { packageId: number | null }) {
    if (!customer.packageId) return null;
    const [pkg] = await this.db
      .select({ ipPoolId: packages.ipPoolId }).from(packages)
      .where(eq(packages.id, customer.packageId)).limit(1);
    if (!pkg?.ipPoolId) return null;
    const [pool] = await this.db
      .select({ mikrotikConfigId: ipPools.mikrotikConfigId }).from(ipPools)
      .where(eq(ipPools.id, pkg.ipPoolId)).limit(1);
    if (!pool) return null;
    const [config] = await this.db
      .select().from(mikrotikConfigs)
      .where(eq(mikrotikConfigs.id, pool.mikrotikConfigId)).limit(1);
    return config ?? null;
  }

  private async kickCustomerSession(customer: { packageId: number | null; usernamePppoe: string | null }) {
    if (!customer.usernamePppoe || !customer.packageId) return;
    const mtk = await this.getPppoeMikrotikConfig(customer);
    if (!mtk) return;
    try {
      await this.mikrotikService.kickSession(mtk, customer.usernamePppoe);
    } catch (err) {
      this.logger.warn(`Gagal kick session '${customer.usernamePppoe}': ${err}`);
    }
  }

  private async syncCustomerToRadius(username: string, password: string, packageId: number) {
    const [pkg] = await this.db
      .select({ speedDownload: packages.speedDownload, speedUpload: packages.speedUpload, ipPoolId: packages.ipPoolId })
      .from(packages).where(eq(packages.id, packageId)).limit(1);
    if (!pkg?.ipPoolId) return;
    const [pool] = await this.db
      .select({ name: ipPools.name }).from(ipPools)
      .where(eq(ipPools.id, pkg.ipPoolId)).limit(1);
    if (!pool) return;
    await this.radiusService.createUser(username, password, pool.name, pkg.speedDownload, pkg.speedUpload);
  }

  private async updateRadiusRateLimit(username: string, packageId: number) {
    const [pkg] = await this.db
      .select({ speedDownload: packages.speedDownload, speedUpload: packages.speedUpload, ipPoolId: packages.ipPoolId })
      .from(packages).where(eq(packages.id, packageId)).limit(1);
    if (!pkg) return;
    await this.radiusService.updateUserRateLimit(username, pkg.speedDownload, pkg.speedUpload);
    if (pkg.ipPoolId) {
      const [pool] = await this.db
        .select({ name: ipPools.name }).from(ipPools)
        .where(eq(ipPools.id, pkg.ipPoolId)).limit(1);
      if (pool) await this.radiusService.changeUserGroup(username, pool.name);
    }
  }

  private async validatePackageBelongsToTenant(packageId: number, tenantId: string) {
    const [pkg] = await this.db
      .select({ id: packages.id }).from(packages)
      .where(and(eq(packages.id, packageId), eq(packages.tenantId, tenantId), eq(packages.isActive, true)))
      .limit(1);
    if (!pkg) throw new NotFoundException('Paket tidak ditemukan atau tidak aktif');
  }

  private async validateAreaBelongsToTenant(areaId: number, tenantId: string) {
    const [area] = await this.db
      .select({ id: areas.id }).from(areas)
      .where(and(eq(areas.id, areaId), eq(areas.tenantId, tenantId), eq(areas.isActive, true)))
      .limit(1);
    if (!area) throw new NotFoundException('Area tidak ditemukan');
  }

  private async ensurePppoeUnique(username: string, tenantId: string, excludeId?: number) {
    const [existing] = await this.db
      .select({ id: customers.id }).from(customers)
      .where(and(eq(customers.usernamePppoe, username), eq(customers.tenantId, tenantId)))
      .limit(1);
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Username '${username}' sudah digunakan`);
    }
  }

  private buildCsv(headers: string[], rows: string[][]): string {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
  }
}