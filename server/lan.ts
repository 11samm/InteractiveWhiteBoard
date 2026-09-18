import os from 'node:os';
import { isIP } from 'node:net';

function isPrivateIPv4(address: string): boolean {
  if (address.startsWith('192.168.')) return true;
  if (address.startsWith('10.')) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(address);
}

/** First suitable LAN IPv4 for guest join links (not loopback). */
export function getPrimaryLanIPv4(): string | null {
  // Machines with a VPN or multiple adapters can choose the wrong address.
  // The host can set LAN_IPV4 to the address reachable by guests.
  const override = process.env.LAN_IPV4?.trim();
  if (override && isIP(override) === 4 && !override.startsWith('127.')) return override;

  const candidates: string[] = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (String(addr.family) !== 'IPv4') continue;
      if (addr.internal) continue;
      candidates.push(addr.address);
    }
  }
  return candidates.find(isPrivateIPv4) ?? candidates[0] ?? null;
}
