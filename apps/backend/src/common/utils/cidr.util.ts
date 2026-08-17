// Hitung gateway, IP start, IP end dari CIDR
// Contoh: 192.168.10.0/24 →
//   gateway  : 192.168.10.1
//   ipStart  : 192.168.10.2
//   ipEnd    : 192.168.10.254
export function parseCidr(cidr: string): {
  gateway: string;
  ipStart: string;
  ipEnd: string;
} {
  const [network, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);

  const parts = network.split('.').map(Number);
  const networkNum =
    (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];

  const totalHosts = Math.pow(2, 32 - prefix);
  const broadcastNum = networkNum + totalHosts - 1;

  return {
    gateway: toIpString(networkNum + 1),
    ipStart: toIpString(networkNum + 2),
    ipEnd: toIpString(broadcastNum - 1),
  };
}

function toIpString(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

export function isValidCidr(cidr: string): boolean {
  const regex = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[1-2]\d|3[0-2])$/;
  if (!regex.test(cidr)) return false;

  const [ip, prefix] = cidr.split('/');
  const parts = ip.split('.').map(Number);
  if (parts.some(p => p > 255)) return false;

  const prefixNum = parseInt(prefix);
  return prefixNum >= 8 && prefixNum <= 30; // Min /8, max /30
}