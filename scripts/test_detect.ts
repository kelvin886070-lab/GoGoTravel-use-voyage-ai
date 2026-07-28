import { detectDayIssues } from '../src/services/reconcile/reconcile.ts';
import type { Activity, TripDay } from '../src/types.ts';
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, e = '') => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${e ? ' :: ' + e : ''}`); };
const A = (o: any): Activity => o as Activity;
const B0 = { bufferMin: 0 };

// 1) 排得下 → 無 issue
const okDay: TripDay = { day: 1, activities: [
  A({ id: 'a', type: 'sightseeing', time: '08:00', title: 'A', description: '', durationMin: 60 }),
  A({ id: 'b', type: 'sightseeing', time: '08:00', title: 'B', description: '', durationMin: 60 }),
] } as TripDay;
ok('排得下→無 issue', !detectDayIssues(okDay, B0).hasIssues);

// 2) 牆前塞不下（趕不上訂位）→ 標出 victim，buffer0 仍要報
const tight: TripDay = { day: 1, activities: [
  A({ id: 'big', type: 'sightseeing', time: '08:00', title: '大景點', description: '', durationMin: 180 }),
  A({ id: 'w', type: 'food', time: '10:00', title: '午餐訂位', description: '', durationMin: 60, movable: 'pinned', priority: 'must' }),
] } as TripDay;
const dTight = detectDayIssues(tight, B0);
ok('撞牆(趕不上訂位)→buffer0 仍報', dTight.hasIssues && dTight.overflowIds.includes('big'));

// 3) 深夜但排得下（到 ~01:15）→ buffer0 不報；buffer30 會誤報（證明 buffer 是假警報主因）
const lateNight: TripDay = { day: 1, activities: [
  A({ id: 'a', type: 'sightseeing', time: '20:00', title: 'A', description: '', durationMin: 60 }),
  A({ id: 'b', type: 'food', time: '21:15', title: 'B', description: '', durationMin: 60 }),
  A({ id: 'c', type: 'food', time: '22:30', title: 'C', description: '', durationMin: 60 }),
  A({ id: 'd', type: 'sightseeing', time: '23:45', title: '鴨川', description: '', durationMin: 90 }),
] } as TripDay;
ok('深夜排得下→buffer0 不報（假警報已解）', !detectDayIssues(lateNight, B0).hasIssues);
// 滿檔天：10×90分。buffer0 塞得下(900<1140)；buffer30 爆(900+270>1140) → 證明 buffer 是假警報主因
const packed: TripDay = { day: 1, activities: Array.from({ length: 10 }, (_, i) => A({ id: 'p' + i, type: 'sightseeing', time: '08:00', title: 'P' + i, description: '', durationMin: 90 })) } as TripDay;
ok('滿檔天 buffer0 塞得下→不報', !detectDayIssues(packed, B0).hasIssues);
ok('對照：同一天 buffer30 會爆（證明主因是 buffer）', detectDayIssues(packed, { bufferMin: 30 }).hasIssues);

// 4) 真的爆到凌晨3點後 → buffer0 仍報
const tooLate: TripDay = { day: 1, activities: [
  A({ id: 'x', type: 'sightseeing', time: '23:00', title: 'X', description: '', durationMin: 180 }),
  A({ id: 'y', type: 'sightseeing', time: '02:30', title: 'Y', description: '', durationMin: 180 }),  // 02:30+3h=05:30 超過 27:00
] } as TripDay;
ok('真的排到凌晨3點後→仍報', detectDayIssues(tooLate, B0).hasIssues);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
