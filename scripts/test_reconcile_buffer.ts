import { reconcileDay } from '../src/services/reconcile/reconcile.ts';
import type { Activity, TripDay } from '../src/types.ts';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, e = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' :: ' + e : ''}`); };
const A = (o: any): Activity => o as Activity;
const min = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

// [A(60) , 連接卡(11, generated) , B(60)]，全部 time 08:00 讓 cursor 主導骨牌
const day: TripDay = { day: 1, activities: [
  A({ id: 'a', type: 'sightseeing', time: '08:00', title: 'A', description: '', durationMin: 60 }),
  A({ id: 'c', type: 'transport', source: 'generated', time: '08:00', title: '移動 (預估)', description: '', durationMin: 11 }),
  A({ id: 'b', type: 'sightseeing', time: '08:00', title: 'B', description: '', durationMin: 60 }),
] } as TripDay;
const r = reconcileDay(day, { bufferMin: 30, dayStartMin: 8 * 60, dayEndMin: 27 * 60 });
const acts = r.day.activities;
const aEnd = min(acts.find(x => x.id === 'a')!.time) + 60;
const bStart = min(acts.find(x => x.id === 'b')!.time);
const cT = min(acts.find(x => x.id === 'c')!.time);
ok('連接卡不吃buffer：A結束→B開始 = buffer30 + 移動11 = 41', bStart - aEnd === 41, `gap=${bStart - aEnd}`);
ok('連接卡時間介於 A 結束與 B 開始之間', cT >= aEnd && cT <= bStart);

// 對照：兩真站相鄰、無連接卡 → 仍加 buffer 30
const day2: TripDay = { day: 1, activities: [
  A({ id: 'a', type: 'sightseeing', time: '08:00', title: 'A', description: '', durationMin: 60 }),
  A({ id: 'b', type: 'sightseeing', time: '08:00', title: 'B', description: '', durationMin: 60 }),
] } as TripDay;
const r2 = reconcileDay(day2, { bufferMin: 30, dayStartMin: 8 * 60, dayEndMin: 27 * 60 });
const a2 = r2.day.activities;
ok('無連接卡：相鄰真站仍加 buffer 30', min(a2.find(x => x.id === 'b')!.time) - (min(a2.find(x => x.id === 'a')!.time) + 60) === 30);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
