import type { RouterRole } from '@/types';

export const ROUTER_ROLE_LABEL: Record<RouterRole, string> = {
  pppoe: 'PPPoE saja',
  hotspot: 'Hotspot saja',
  both: 'Keduanya',
};

export const ROUTER_ROLE_OPTIONS: { value: RouterRole; label: string }[] = [
  { value: 'both', label: 'Keduanya (PPPoE & Hotspot)' },
  { value: 'pppoe', label: 'PPPoE saja' },
  { value: 'hotspot', label: 'Hotspot saja' },
];

// Peran yang belum dikirim (backend lama) dianggap "keduanya", sama dengan default di database.
export const servesHotspot = (role?: RouterRole | null) => role !== 'pppoe';
export const servesPppoe = (role?: RouterRole | null) => role !== 'hotspot';
