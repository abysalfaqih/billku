import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { RADIUS_DB } from '../../database/radius-database.module';
import type { RadiusClient } from '../../database/radius-database.module';
import { radcheck, radreply, radgroupreply, radusergroup, nas } from '../../database/radius-schema';

@Injectable()
export class RadiusService {
  private readonly logger = new Logger(RadiusService.name);

  constructor(@Inject(RADIUS_DB) private db: RadiusClient) {}

  // ─── User Management ─────────────────────────────────────────────────

  async createUser(
    username: string,
    password: string,
    groupName: string,
    speedDownload: number,
    speedUpload: number,
  ) {
    await this.db.insert(radcheck).values({
      username,
      attribute: 'Cleartext-Password',
      op: ':=',
      value: password,
    });

    // Rate limit per-user
    await this.db.insert(radreply).values({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: ':=',
      value: `${speedDownload}M/${speedUpload}M`,
    });

    // BARU — ini yang sebelumnya hilang.
    // Mikrotik-Group memberitahu Mikrotik PPP Profile mana yang dipakai,
    // yang di dalamnya sudah ada referensi ke IP Pool yang benar.
    await this.db.insert(radreply).values({
      username,
      attribute: 'Mikrotik-Group',
      op: ':=',
      value: groupName,
    });

    await this.db.insert(radusergroup).values({
      username,
      groupname: groupName,
      priority: 1,
    });

    this.logger.log(
      `✅ FreeRADIUS: user '${username}' dibuat → Mikrotik-Group '${groupName}' ` +
      `rate ${speedDownload}M/${speedUpload}M`,
    );
  }

  async disableUser(username: string) {
    const [existing] = await this.db
      .select({ id: radcheck.id })
      .from(radcheck)
      .where(and(eq(radcheck.username, username), eq(radcheck.attribute, 'Auth-Type')))
      .limit(1);

    if (!existing) {
      await this.db.insert(radcheck).values({
        username, attribute: 'Auth-Type', op: ':=', value: 'Reject',
      });
    }

    this.logger.log(`🔴 FreeRADIUS: user '${username}' dinonaktifkan`);
  }

  async enableUser(username: string) {
    await this.db
      .delete(radcheck)
      .where(and(eq(radcheck.username, username), eq(radcheck.attribute, 'Auth-Type')));

    this.logger.log(`🟢 FreeRADIUS: user '${username}' diaktifkan`);
  }

  async deleteUser(username: string) {
    await this.db.delete(radcheck).where(eq(radcheck.username, username));
    await this.db.delete(radreply).where(eq(radreply.username, username));
    await this.db.delete(radusergroup).where(eq(radusergroup.username, username));

    this.logger.log(`🗑️ FreeRADIUS: user '${username}' dihapus`);
  }

  async updateUserRateLimit(username: string, speedDownload: number, speedUpload: number) {
    const rateLimit = `${speedDownload}M/${speedUpload}M`;

    const [existing] = await this.db
      .select({ id: radreply.id })
      .from(radreply)
      .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Rate-Limit')))
      .limit(1);

    if (existing) {
      await this.db
        .update(radreply)
        .set({ value: rateLimit })
        .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Rate-Limit')));
    } else {
      await this.db.insert(radreply).values({
        username, attribute: 'Mikrotik-Rate-Limit', op: ':=', value: rateLimit,
      });
    }

    this.logger.log(`🔄 FreeRADIUS: rate limit '${username}' → ${rateLimit}`);
  }

  async changeUserGroup(username: string, newGroupName: string) {
    await this.db.delete(radusergroup).where(eq(radusergroup.username, username));
    await this.db.insert(radusergroup).values({ username, groupname: newGroupName, priority: 1 });

    // BARU — sinkronkan juga Mikrotik-Group, supaya saat ganti paket
    // pelanggan langsung pindah ke PPP Profile/IP Pool yang baru.
    const [existing] = await this.db
      .select({ id: radreply.id })
      .from(radreply)
      .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Group')))
      .limit(1);

    if (existing) {
      await this.db
        .update(radreply)
        .set({ value: newGroupName })
        .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Group')));
    } else {
      await this.db.insert(radreply).values({
        username, attribute: 'Mikrotik-Group', op: ':=', value: newGroupName,
      });
    }

    this.logger.log(`🔄 FreeRADIUS: '${username}' pindah ke Mikrotik-Group '${newGroupName}'`);
  }

  // ─── Group Management ────────────────────────────────────────────────

  async createGroup(groupName: string) {
    const [existing] = await this.db
      .select({ id: radgroupreply.id })
      .from(radgroupreply)
      .where(eq(radgroupreply.groupname, groupName))
      .limit(1);

    if (!existing) {
      await this.db.insert(radgroupreply).values({
        groupname: groupName, attribute: 'Fall-Through', op: '=', value: 'Yes',
      });
      this.logger.log(`✅ FreeRADIUS: group '${groupName}' dibuat`);
    }
  }

  async deleteGroup(groupName: string) {
    await this.db.delete(radgroupreply).where(eq(radgroupreply.groupname, groupName));
    this.logger.log(`🗑️ FreeRADIUS: group '${groupName}' dihapus`);
  }

  // ─── NAS Management ──────────────────────────────────────────────────

  async registerNas(nasname: string, shortname: string, secret: string) {
    const [existing] = await this.db
      .select({ id: nas.id })
      .from(nas)
      .where(eq(nas.nasname, nasname))
      .limit(1);

    if (existing) {
      await this.db.update(nas).set({ secret, shortname }).where(eq(nas.nasname, nasname));
    } else {
      await this.db.insert(nas).values({
        nasname, shortname, type: 'other', secret, description: `Mikrotik - ${shortname}`,
      });
    }

    this.logger.log(`✅ FreeRADIUS: NAS '${nasname}' didaftarkan`);
  }

  async removeNas(nasname: string) {
    await this.db.delete(nas).where(eq(nas.nasname, nasname));
    this.logger.log(`🗑️ FreeRADIUS: NAS '${nasname}' dihapus`);
  }

  async userExists(username: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: radcheck.id })
      .from(radcheck)
      .where(
        and(
          eq(radcheck.username, username),
          eq(radcheck.attribute, 'Cleartext-Password'),
        ),
      )
      .limit(1);

    return !!row;
  }

  async createUserBasic(username: string, password: string): Promise<void> {
    await this.db.insert(radcheck).values({
      username, attribute: 'Cleartext-Password', op: ':=', value: password,
    });
    this.logger.log(`✅ RADIUS basic: '${username}' dibuat`);
  }

  async syncUserFromMigration(
    username: string,
    password: string,
    groupName: string | null,
    speedDownload: number,
    speedUpload: number,
  ): Promise<void> {
    // 1. Password
    await this.db.insert(radcheck).values({
      username,
      attribute: 'Cleartext-Password',
      op: ':=',
      value: password,
    });

    // 2. Rate limit
    await this.db.insert(radreply).values({
      username,
      attribute: 'Mikrotik-Rate-Limit',
      op: ':=',
      value: `${speedDownload}M/${speedUpload}M`,
    });

    // 3. Mikrotik-Group (kalau ada nama paket)
    if (groupName) {
      await this.db.insert(radreply).values({
        username,
        attribute: 'Mikrotik-Group',
        op: ':=',
        value: groupName,
      });

      // 4. radusergroup
      await this.db.insert(radusergroup).values({
        username,
        groupname: groupName,
        priority: 1,
      });
    }

    this.logger.log(
      `✅ RADIUS migration sync: '${username}' ` +
      `group='${groupName ?? '-'}' rate=${speedDownload}M/${speedUpload}M`
    );
  }

  async updatePassword(username: string, newPassword: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: radcheck.id })
      .from(radcheck)
      .where(and(
        eq(radcheck.username, username),
        eq(radcheck.attribute, 'Cleartext-Password'),
      ))
      .limit(1);

    if (existing) {
      await this.db
        .update(radcheck)
        .set({ value: newPassword })
        .where(and(
          eq(radcheck.username, username),
          eq(radcheck.attribute, 'Cleartext-Password'),
        ));
    } else {
      await this.db.insert(radcheck).values({
        username, attribute: 'Cleartext-Password', op: ':=', value: newPassword,
      });
    }
    this.logger.log(`🔑 RADIUS: password '${username}' diperbarui`);
  }

  async updateRateLimitAndGroup(
    username: string,
    speedDownload: number,
    speedUpload: number,
    groupName: string,
  ): Promise<void> {
    const rateLimit = `${speedDownload}M/${speedUpload}M`;

    // Update atau insert Mikrotik-Rate-Limit
    const [existRate] = await this.db
      .select({ id: radreply.id })
      .from(radreply)
      .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Rate-Limit')))
      .limit(1);

    if (existRate) {
      await this.db.update(radreply)
        .set({ value: rateLimit })
        .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Rate-Limit')));
    } else {
      await this.db.insert(radreply).values({
        username, attribute: 'Mikrotik-Rate-Limit', op: ':=', value: rateLimit,
      });
    }

    // Update atau insert Mikrotik-Group
    const [existGroup] = await this.db
      .select({ id: radreply.id })
      .from(radreply)
      .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Group')))
      .limit(1);

    if (existGroup) {
      await this.db.update(radreply)
        .set({ value: groupName })
        .where(and(eq(radreply.username, username), eq(radreply.attribute, 'Mikrotik-Group')));
    } else {
      await this.db.insert(radreply).values({
        username, attribute: 'Mikrotik-Group', op: ':=', value: groupName,
      });
    }

    // Update radusergroup
    await this.db.delete(radusergroup).where(eq(radusergroup.username, username));
    await this.db.insert(radusergroup).values({ username, groupname: groupName, priority: 1 });

    this.logger.log(`🔄 RADIUS: '${username}' → rate ${rateLimit}, group '${groupName}'`);
  }

  async renameUser(oldUsername: string, newUsername: string): Promise<void> {
    const passwords = await this.db.select().from(radcheck).where(eq(radcheck.username, oldUsername));
    const replies    = await this.db.select().from(radreply).where(eq(radreply.username, oldUsername));
    const groups     = await this.db.select().from(radusergroup).where(eq(radusergroup.username, oldUsername));

    for (const r of passwords) {
      await this.db.insert(radcheck).values({ username: newUsername, attribute: r.attribute, op: r.op, value: r.value });
    }
    for (const r of replies) {
      await this.db.insert(radreply).values({ username: newUsername, attribute: r.attribute, op: r.op, value: r.value });
    }
    for (const r of groups) {
      await this.db.insert(radusergroup).values({ username: newUsername, groupname: r.groupname, priority: r.priority });
    }

    await this.deleteUser(oldUsername);
    this.logger.log(`🔄 RADIUS: rename '${oldUsername}' → '${newUsername}'`);
  }
}