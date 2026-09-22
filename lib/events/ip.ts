/** Address classification for server-side fetches of user-supplied URLs (SSRF protection). */

function parseIpv4(addr: string): number[] | null {
  const parts = addr.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.every((o) => Number.isInteger(o) && o >= 0 && o <= 255) ? octets : null;
}

/** Expands an IPv6 address (optionally with a dotted IPv4 tail or zone id) to 8 hextets. */
function parseIpv6(raw: string): number[] | null {
  let addr = raw.split('%')[0].toLowerCase();
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    const v4 = parseIpv4(tail);
    if (!v4) return null;
    addr = `${addr.slice(0, lastColon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const toHextets = (s: string): number[] | null => {
    if (s === '') return [];
    const out = s.split(':').map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
    return out.every((n) => !Number.isNaN(n)) ? out : null;
  };
  const head = toHextets(halves[0]);
  const rest = halves.length === 2 ? toHextets(halves[1]) : [];
  if (!head || !rest) return null;
  if (halves.length === 1) return head.length === 8 ? head : null;
  const fill = 8 - head.length - rest.length;
  if (fill < 1) return null;
  return [...head, ...new Array<number>(fill).fill(0), ...rest];
}

function isNonPublicIpv4([a, b]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8 (unspecified / "this network")
    a === 10 || // 10/8
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    a === 127 || // loopback
    (a === 169 && b === 254) || // link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    a >= 224 // multicast and reserved
  );
}

/**
 * True when the address must not be fetched: loopback, private, link-local, unspecified,
 * CGNAT, ULA, multicast, IPv4-mapped/compatible forms of those, or anything unparseable.
 */
export function isNonPublicAddress(address: string): boolean {
  const v4 = parseIpv4(address);
  if (v4) return isNonPublicIpv4(v4);
  const h = parseIpv6(address);
  if (!h) return true;
  const firstFiveZero = h.slice(0, 5).every((x) => x === 0);
  if (firstFiveZero && (h[5] === 0xffff || h[5] === 0)) {
    // ::ffff:a.b.c.d (mapped), ::a.b.c.d (compatible), :: and ::1
    return isNonPublicIpv4([h[6] >> 8, h[6] & 0xff, h[7] >> 8, h[7] & 0xff]);
  }
  return (
    (h[0] & 0xfe00) === 0xfc00 || // fc00::/7 ULA
    (h[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (h[0] & 0xff00) === 0xff00 // ff00::/8 multicast
  );
}
