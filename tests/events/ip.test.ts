import { describe, expect, it } from 'vitest';
import { isNonPublicAddress } from '@/lib/events/ip';

describe('isNonPublicAddress', () => {
  it.each([
    '0.0.0.0',
    '0.1.2.3',
    '10.1.2.3',
    '100.64.0.1',
    '100.127.255.255',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:10.0.0.1',
    '::ffff:a00:1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '0:0:0:0:0:ffff:a9fe:a9fe',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'fe80::1%eth0',
    'ff02::1',
    'garbage',
    '1.2.3',
  ])('blocks %s', (addr) => {
    expect(isNonPublicAddress(addr)).toBe(true);
  });

  it.each(['93.184.216.34', '8.8.8.8', '100.63.255.255', '100.128.0.1', '172.15.0.1', '172.32.0.1', '2606:2800:220:1:248:1893:25c8:1946', '::ffff:8.8.8.8'])(
    'allows public %s',
    (addr) => {
      expect(isNonPublicAddress(addr)).toBe(false);
    },
  );
});
