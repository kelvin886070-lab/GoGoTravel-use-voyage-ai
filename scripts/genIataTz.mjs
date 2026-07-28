// scripts/genIataTz.mjs
// 生成 src/services/booking/iataTz.json（IATA → IANA 時區）。
// 不手打：資料來源＝airports（含 IATA＋座標）× tz-lookup（時區邊界多邊形）。
// 需 devDeps：npm i -D airports tz-lookup。重跑：node scripts/genIataTz.mjs
//
// 設計：重複 IATA 保留機場規模較大者（降低誤配）；查不到時區者略過（寧缺勿錯）。
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const airports = require('airports');
const tzlookup = require('tz-lookup');

const rank = { large: 3, medium: 2, small: 1 };
const chosen = {};
const out = {};
let ok = 0, bad = 0, dup = 0;

for (const a of airports) {
    const iata = (a.iata || '').trim().toUpperCase();
    if (!iata || iata.length !== 3) continue;
    const lat = parseFloat(a.lat), lon = parseFloat(a.lon);
    if (!isFinite(lat) || !isFinite(lon)) { bad++; continue; }
    let tz = null;
    try { tz = tzlookup(lat, lon); } catch { tz = null; }
    if (!tz) { bad++; continue; }
    const r = rank[a.size] || 1;
    if (chosen[iata]) { dup++; if (r <= chosen[iata]) continue; }
    chosen[iata] = r; out[iata] = tz; ok++;
}

const sorted = {};
for (const k of Object.keys(out).sort()) sorted[k] = out[k];
writeFileSync(new URL('../src/services/booking/iataTz.json', import.meta.url), JSON.stringify(sorted));
console.log(`iataTz.json: ${ok} entries, skippedBad ${bad}, dupResolved ${dup}`);
