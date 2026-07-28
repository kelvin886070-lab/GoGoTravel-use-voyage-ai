import { estimateLeg, havKm } from '../src/services/routing.ts';
import { isAutoConnector, stripAutoConnectors, rebuildConnectorsInList } from '../src/services/reconcile/autoRoute.ts';
import { recalculateTimeline } from '../src/services/timeline.ts';
import type { Activity, TripDay } from '../src/types.ts';

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`); };
const A = (o: any): Activity => o as Activity;

const gbg = { lat: 37.5796, lng: 126.9770 };
const bukchon = { lat: 37.5826, lng: 126.9830 };
const gwangjang = { lat: 37.5701, lng: 126.9997 };
const busan = { lat: 35.1796, lng: 129.0756 };

// 1) estimateLeg
const l1 = estimateLeg(gbg, bukchon);
ok('近距→walk', l1.mode === 'walk', `${l1.km}km ${l1.minutes}分`);
ok('市內→transit', estimateLeg(gbg, gwangjang).mode === 'transit');
ok('跨城→intercity', estimateLeg(gbg, busan).mode === 'intercity');
ok('haversine 首爾-釜山≈325km', Math.abs(havKm(gbg, busan) - 325) < 20);

// 2) isAutoConnector
ok('generated→auto', isAutoConnector(A({ type: 'transport', source: 'generated', time: '', title: 'x', description: '' })));
ok('舊簽名→auto', isAutoConnector(A({ type: 'transport', time: '', title: '移動 (預估)', description: '' })));
ok('使用者交通→非auto', !isAutoConnector(A({ type: 'transport', time: '', title: '移動', description: '', transportDetail: { mode: 'bus', duration: '30 min', instruction: '搭乘交通工具' } })));
ok('航班→非auto', !isAutoConnector(A({ type: 'flight', time: '', title: 'BR170', description: '' })));

// 3) strip 保留使用者交通
const mixed: Activity[] = [
  A({ type: 'sightseeing', time: '09:00', title: 'A', description: '', lat: gbg.lat, lng: gbg.lng }),
  A({ type: 'transport', source: 'generated', time: '', title: '移動 (預估)', description: '' }),
  A({ type: 'transport', time: '', title: '移動', description: '', transportDetail: { mode: 'bus', duration: '30 min', instruction: '搭乘交通工具' } }),
  A({ type: 'sightseeing', time: '11:00', title: 'B', description: '', lat: bukchon.lat, lng: bukchon.lng }),
];
ok('strip 只去自動連接卡', stripAutoConnectors(mixed).length === 3 && stripAutoConnectors(mixed).some(a => a.title === '移動'));

// 4) rebuild 冪等 + 路由時長
const stops: Activity[] = [
  A({ type: 'sightseeing', time: '09:00', title: '景福宮', description: '', lat: gbg.lat, lng: gbg.lng }),
  A({ type: 'sightseeing', time: '11:00', title: '北村', description: '', lat: bukchon.lat, lng: bukchon.lng }),
];
const r1 = rebuildConnectorsInList(stops);
ok('rebuild 插入連接＋路由時長', r1.length === 3 && r1[1].type === 'transport' && r1[1].durationMin === l1.minutes, `dur=${r1[1].durationMin}`);
ok('rebuild 冪等', rebuildConnectorsInList(r1).filter(a => a.type === 'transport').length === 1);

// 5) 插入只重算兩側邊
const withC: Activity[] = [stops[0], A({ type: 'sightseeing', time: '10:00', title: '益善洞', description: '', lat: gwangjang.lat, lng: gwangjang.lng }), stops[1]];
ok('插入後 3 站→2 段連接', rebuildConnectorsInList(withC).filter(a => a.type === 'transport').length === 2);

// 6) 缺座標→沿用預設連接卡（不失連接、不路由）
const noCoord: Activity[] = [A({ type: 'sightseeing', time: '09:00', title: 'A', description: '' }), A({ type: 'sightseeing', time: '11:00', title: 'B', description: '' })];
const nc = rebuildConnectorsInList(noCoord);
ok('缺座標→仍有預設連接卡(15分/walk)', nc.length === 3 && nc[1].durationMin === 15 && nc[1].transportDetail?.mode === 'walk');

// 7) recalculateTimeline 端到端
const day: TripDay = { day: 1, activities: [stops[0], stops[1]] } as TripDay;
const d1 = recalculateTimeline(day);
ok('recalc 插入路由連接', d1.activities.length === 3 && d1.activities[1].type === 'transport' && d1.activities[1].durationMin === l1.minutes);
const d2 = recalculateTimeline(d1);
ok('recalc 冪等（不重複連接）', d2.activities.filter(a => a.type === 'transport').length === 1 && d2.activities.length === 3);
ok('recalc 時間遞增', (() => { const t = d1.activities.map(a => a.time); return t[0] <= t[1] && t[1] <= t[2]; })(), d1.activities.map(a=>a.time).join(' → '));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
