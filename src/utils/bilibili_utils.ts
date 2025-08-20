// reference: https://github.com/Prcuvu/bilibili-aid-bvid-converter

const XOR_CODE = 23442827791579n;
const MASK_CODE = 2251799813685247n;
const MAX_AID = 2251799813685248n;
const BASE = 58n;

const table = 'FcwAPNKTMug3GV5Lj7EJnHpWsx4tb8haYeviqBz6rkCy12mUSDQX9RdoZf';
const tr: { [key: string]: number } = {};
for (let i = 0; i < 58; i++) {
  tr[table[i]] = i;
}

/**
 * Convert BV number to AV number
 * Based on Bilibili's encoding algorithm
 */
export function bv2av(x: string): number {
  if (!x.startsWith('BV1') && !x.startsWith('bv1')) {
    throw new Error('BV id must start with BV1');
  }
  
  // Create mutable array from string
  const chars = x.split('');
  
  // Swap positions as in C code
  [chars[3], chars[9]] = [chars[9], chars[3]];
  [chars[4], chars[7]] = [chars[7], chars[4]];
  
  // Decode from base 58
  let aid = 0n;
  for (let i = 3; i < 12; i++) {  // Start from position 3, skip BV1 prefix
    aid = aid * BASE + BigInt(tr[chars[i]]);
  }
  
  // Apply mask and XOR as in C code
  aid = (aid & MASK_CODE) ^ XOR_CODE;
  
  return Number(aid);
}

/**
 * Convert AV number to BV number
 * Based on Bilibili's encoding algorithm
 */
export function av2bv(x: number): string {
  // Apply XOR and OR with MAX_AID as in C code
  let aid = (MAX_AID | BigInt(x)) ^ XOR_CODE;
  
  // Initialize result with BV1 prefix and placeholder chars
  const r = ['B', 'V', '1', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
  
  // Encode to base 58, filling from the end
  for (let i = 11; i > 2; i--) {  // Fill positions 11 down to 3
    r[i] = table[Number(aid % BASE)];
    aid = aid / BASE;
  }
  
  // Swap positions as in C code
  [r[3], r[9]] = [r[9], r[3]];
  [r[4], r[7]] = [r[7], r[4]];
  
  return r.join('');
}