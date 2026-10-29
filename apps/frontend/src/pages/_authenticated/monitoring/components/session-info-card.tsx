import { ArrowDownToLine, ArrowUpFromLine, Clock, Fingerprint, Globe, Router, Tag, User, Wifi } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { SessionResponse } from '@/hooks/useMonitoring';
import { formatBytes, formatUptime } from './format';

interface Field {
  label: string;
  value: string | undefined;
  Icon: LucideIcon;
}

/** Kartu "Sesi Aktif": semua informasi sesi dalam kisi dua kolom yang rapi. */
export function SessionInfoCard({ data, isHotspot }: { data: SessionResponse; isHotspot: boolean }) {
  const s = data.session;
  if (!s) return null;

  const uptime = formatUptime(s.uptime);

  const fields: Field[] = isHotspot
    ? [
        { label: 'Username', value: data.username, Icon: User },
        { label: 'IP Address', value: s.address, Icon: Globe },
        { label: 'MAC Address', value: s.macAddress, Icon: Fingerprint },
        { label: 'Uptime', value: uptime, Icon: Clock },
        { label: 'Profile', value: data.hotspotProfile, Icon: Tag },
        { label: 'Mikrotik', value: data.mikrotikName, Icon: Router },
        // bytes-in / bytes-out di MikroTik dihitung dari sisi router: masuk = upload pelanggan
        { label: 'Upload', value: formatBytes(s.bytesIn), Icon: ArrowUpFromLine },
        { label: 'Download', value: formatBytes(s.bytesOut), Icon: ArrowDownToLine },
      ]
    : [
        { label: 'Username', value: data.username, Icon: User },
        { label: 'IP Address', value: s.address, Icon: Globe },
        { label: 'Uptime', value: uptime, Icon: Clock },
        { label: 'Caller ID', value: s.callerId, Icon: Fingerprint },
        { label: 'Mikrotik', value: data.mikrotikName, Icon: Router },
      ];

  return (
    <section
      aria-label="Sesi Aktif"
      style={{
        background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}
      >
        <span
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700,
            color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}
        >
          <Wifi size={14} aria-hidden="true" />
          Sesi Aktif
        </span>
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
            color: '#10B981', background: 'rgba(16,185,129,0.12)', borderRadius: 99, padding: '3px 10px',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
          Online
        </span>
      </div>

      <dl className="grid-stats-2" style={{ gap: 10, padding: 14, margin: 0 }}>
        {fields.map(({ label, value, Icon }, i) => (
          <div
            key={label}
            style={{
              minWidth: 0, padding: '10px 12px', borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              // jumlah ganjil: kotak terakhir memanjang penuh agar tidak ada lubang
              gridColumn: fields.length % 2 === 1 && i === fields.length - 1 ? '1 / -1' : undefined,
            }}
          >
            <dt
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
                color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em',
              }}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
            </dt>
            <dd
              style={{
                margin: '4px 0 0', fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                overflowWrap: 'anywhere',
              }}
            >
              {value || '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
