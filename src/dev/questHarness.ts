import type Phaser from 'phaser';
import { QUESTS } from '../data/quests';
import { REGION_ROUTE } from '../data/regionRoute';
import { CONTINENT_DEFS } from '../scenes/WorldMapScene';
import portsData from '../data/ports';

// Dev-only quest test harness. Installed under import.meta.env.DEV in main.ts and excluded
// from production via a dynamic import. Exposes `window.__qtest` for deterministic,
// repeatable test-case (TC) execution through preview_eval. It grows each development step;
// Step 0 establishes the plumbing (deterministic fixtures + a runTC scaffold).

interface Fixture {
  ports?: string[];
  continents?: string[]; // east_asia is always included implicitly
  specialties?: string[];
  quizPassed?: string[];
  completed?: string[];
}

const FIXTURES: Record<string, Fixture> = {
  FX_START: { ports: [], continents: [] },
  FX_SEA3: { ports: ['singapore', 'bangkok', 'jakarta'], continents: ['southeast_asia'] },
  FX_OLD_SAVE: { ports: ['seoul', 'tokyo'], continents: [] }, // no quest fields → migration test
};

export function installQuestHarness(game: Phaser.Game): void {
  const w = window as unknown as Record<string, unknown>;

  // Ensure WorldMapScene is the active scene (tests run against it). start() is async, so the
  // first call right after boot may return a scene whose create() hasn't run yet — callers
  // re-invoke next tick (snapshot/fixture report ready:false until then).
  const getScene = (): any => {
    if (!game.scene.isActive('WorldMapScene')) {
      game.scene.start('WorldMapScene', { character: 'jun' });
    }
    return game.scene.getScene('WorldMapScene') as any;
  };

  const snapshot = (): unknown => {
    const s = getScene();
    if (!s || !s.discoveredPorts) return { ready: false };
    return {
      ready: !!s.ship,
      ports: [...s.discoveredPorts],
      continents: [...s.discoveredContinents],
      specialties: s.collectedSpecialties.size,
      quizPassed: s.quizPassedPorts ? [...s.quizPassedPorts] : null,
      completed: s.completedQuests ? [...s.completedQuests] : null,
    };
  };

  // Inject a deterministic game state. Returns a fresh snapshot (or {ready:false} pre-create()).
  const fixture = (nameOrState: string | Fixture): unknown => {
    const fx: Fixture = typeof nameOrState === 'string' ? FIXTURES[nameOrState] ?? {} : nameOrState;
    const s = getScene();
    if (!s || !s.ship) return { ready: false, reason: 'scene not ready — call again next tick' };
    s.discoveredPorts = new Set(fx.ports ?? []);
    s.discoveredContinents = new Set(['east_asia', ...(fx.continents ?? [])]);
    s.collectedSpecialties = new Set(fx.specialties ?? []);
    if (s.quizPassedPorts !== undefined) s.quizPassedPorts = new Set(fx.quizPassed ?? []);
    if (s.completedQuests !== undefined) s.completedQuests = new Set(fx.completed ?? []);
    // R4: reset banner-queue fields so test cases don't cross-contaminate
    if (Array.isArray(s.pendingQuestBanners)) s.pendingQuestBanners = [];
    if (Array.isArray(s._questBannerLog)) s._questBannerLog = [];
    if (s.pendingFromPort !== undefined) s.pendingFromPort = false;
    if (Array.isArray(s._questBannerShown)) s._questBannerShown = [];
    s.fogDirty = true;
    if (typeof s.rebuildFog === 'function') s.rebuildFog();
    if (typeof s.updateHUD === 'function') s.updateHUD();
    return snapshot();
  };

  // Real-path simulators (each wired in a later step; harmless no-ops until then).
  const sim = {
    discoverPort: (id: string): unknown => {
      const s = getScene();
      return typeof s.simDiscoverPort === 'function' ? s.simDiscoverPort(id) : 'wired in Step 2';
    },
    recordQuizPass: (id: string, ok: boolean): unknown => {
      const s = getScene();
      return typeof s.recordQuizPass === 'function' ? s.recordQuizPass(id, ok) : 'wired in Step 3';
    },
    enterContinent: (id: string): unknown => {
      const s = getScene();
      return typeof s.revealContinent === 'function' ? s.revealContinent(id, true) : 'n/a';
    },
  };

  const q = (id: string): unknown => {
    const s = getScene();
    return typeof s.questProgress === 'function' ? s.questProgress(id) : null; // wired Step 1/2
  };

  const banners = (): unknown[] => {
    const s = getScene();
    return Array.isArray(s._questBannerLog) ? [...s._questBannerLog] : [];
  };

  const shown = (): unknown[] => {
    const s = getScene();
    return Array.isArray(s._questBannerShown) ? [...s._questBannerShown] : [];
  };

  // Region-gate observation hooks (read-only views of the scene's derived gate helpers).
  const gate = {
    ROUTE: REGION_ROUTE,
    canEnter: (lon: number, lat: number): unknown => getScene().canSailTo(lon, lat),
    enterable: (id: string): boolean => !!getScene().isContinentEnterable(id),
    complete: (id: string): boolean => !!getScene().isContinentComplete(id),
    prereq: (id: string): unknown => getScene().routePrereq(id),
    frontier: (): unknown => getScene().currentFrontierContinent(),
    routeWarnings: (): unknown[] => {
      const s = getScene();
      return Array.isArray(s._routeBootWarnings) ? [...s._routeBootWarnings] : ['_routeBootWarnings missing'];
    },
  };

  // TC registry — each step appends its cases here.
  const TCS: Record<string, () => unknown> = {
    '0': () => {
      const results: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      results.push({ id: 'TC0a', pass: typeof (w.__qtest as any)?.runTC === 'function', detail: 'harness api present' });
      const snap = fixture('FX_START') as any;
      const pass0b = snap.ready === true && snap.ports.length === 0
        && JSON.stringify(snap.continents) === JSON.stringify(['east_asia']);
      results.push({ id: 'TC0b', pass: pass0b, detail: snap });
      return { pass: results.every((r) => r.pass), results };
    },
    '1': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      const warns = Array.isArray(s._questBootWarnings) ? s._questBootWarnings : ['_questBootWarnings missing'];
      r.push({ id: 'TC1b', pass: warns.length === 0, detail: warns });
      fixture('FX_START');
      const a = s.questProgress('q_first_voyage');
      const b = s.questProgress('q_three_continents');
      const c = s.questProgress('q_quiz_3');
      const ok = a && a.current === 0 && a.target === 1 && !a.done
        && b && b.current === 1 && b.target === 3 && !b.done
        && c && c.current === 0 && c.target === 3 && !c.done;
      r.push({ id: 'TC1c', pass: !!ok, detail: { a, b, c } });
      return { pass: r.every((x) => x.pass), results: r };
    },
    '2': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      // TC2a: discover one east_asia port → q_first_voyage completes, HUD tracker advances
      fixture('FX_START');
      const before = s.questProgress('q_first_voyage');
      (w.__qtest as any).sim.discoverPort('seoul');
      const after = s.questProgress('q_first_voyage');
      const completed = [...s.completedQuests];
      const tracker = s.questText ? s.questText.text : '';
      r.push({
        id: 'TC2a',
        pass: before.done === false && after.done === true
          && completed.includes('q_first_voyage') && tracker.includes('동아시아 완전정복'),
        detail: { before, after, completed, tracker },
      });
      // TC2b: re-discover the same port → no new completion / no new banner-log entry (idempotent)
      const log1 = s._questBannerLog.length;
      const sz1 = s.completedQuests.size;
      (w.__qtest as any).sim.discoverPort('seoul');
      r.push({
        id: 'TC2b',
        pass: s._questBannerLog.length === log1 && s.completedQuests.size === sz1,
        detail: { logBefore: log1, logAfter: s._questBannerLog.length },
      });
      // TC2c: sail into undiscovered continents → discoverContinents progresses immediately (E4)
      fixture('FX_START');
      const cBefore = s.questProgress('q_three_continents');
      (w.__qtest as any).sim.enterContinent('southeast_asia');
      (w.__qtest as any).sim.enterContinent('south_asia');
      const cAfter = s.questProgress('q_three_continents');
      r.push({
        id: 'TC2c',
        pass: cBefore.current === 1 && cAfter.current === 3 && cAfter.done === true,
        detail: { cBefore, cAfter },
      });
      return { pass: r.every((x) => x.pass), results: r };
    },
    // Cross-cutting regression gate — re-run at the end of every step.
    regress: () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      const ranks = [s.getRank(0), s.getRank(6), s.getRank(16), s.getRank(31)];
      r.push({
        id: 'rank-thresholds',
        pass: ranks[0].includes('견습') && ranks[1].includes('탐험가')
          && ranks[2].includes('항해사') && ranks[3].includes('달인'),
        detail: ranks,
      });
      fixture('FX_START');
      const pct = typeof s.explorationPercent === 'function' ? s.explorationPercent() : -1;
      r.push({ id: 'exploration%', pass: pct >= 0 && pct <= 100, detail: pct });
      r.push({ id: 'win-condition-intact', pass: typeof s.collectedSpecialties?.size === 'number', detail: s.collectedSpecialties?.size });
      return { pass: r.every((x) => x.pass), results: r };
    },
    '3': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      const sim = (w.__qtest as any).sim;
      // TC3a: 3 distinct correct quizzes → q_quiz_3 completes
      fixture('FX_START');
      ['seoul', 'tokyo', 'beijing'].forEach((id) => sim.recordQuizPass(id, true));
      const q3 = s.questProgress('q_quiz_3');
      r.push({ id: 'TC3a', pass: q3.current === 3 && q3.done === true, detail: q3 });
      // TC3b: progress derived from quizPassedCount
      r.push({ id: 'TC3b', pass: s.quizPassedPorts.size === 3, detail: [...s.quizPassedPorts] });
      // TC3c-1: idempotent (same id twice → size unchanged, 2nd call ok:false)
      fixture('FX_START');
      const first = sim.recordQuizPass('seoul', true);
      const dup = sim.recordQuizPass('seoul', true);
      r.push({ id: 'TC3c-1', pass: first.ok === true && dup.ok === false && s.quizPassedPorts.size === 1, detail: { first, dup } });
      // TC3c-2: wrong answer ignored
      fixture('FX_START');
      const wrong = sim.recordQuizPass('seoul', false);
      r.push({ id: 'TC3c-2', pass: wrong.ok === false && s.quizPassedPorts.size === 0, detail: wrong });
      // TC3d: 10 correct → q_quiz_3 + q_quiz_10 both done, current clamped to target
      fixture('FX_START');
      ['seoul', 'tokyo', 'beijing', 'shanghai', 'hongkong', 'singapore', 'bangkok', 'jakarta', 'hanoi', 'mumbai']
        .forEach((id) => sim.recordQuizPass(id, true));
      const q3b = s.questProgress('q_quiz_3');
      const q10 = s.questProgress('q_quiz_10');
      r.push({ id: 'TC3d', pass: q3b.done && q3b.current === 3 && q10.done && q10.current === 10, detail: { q3b, q10 } });
      // TC3e: empty id does not crash
      fixture('FX_START');
      let crashed = false;
      try { sim.recordQuizPass('', true); } catch { crashed = true; }
      r.push({ id: 'TC3e', pass: !crashed, detail: { crashed } });
      // negative: wrong + dup add nothing to the banner-log delta
      fixture('FX_START');
      const log0 = s._questBannerLog.length;
      sim.recordQuizPass('seoul', false);
      sim.recordQuizPass('seoul', true);
      sim.recordQuizPass('seoul', true);
      r.push({ id: 'TC3-neg', pass: s._questBannerLog.length === log0, detail: { log0, after: s._questBannerLog.length } });
      return { pass: r.every((x) => x.pass), results: r };
    },
    '4': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      const sim = (w.__qtest as any).sim;
      const shownLen = () => (Array.isArray(s._questBannerShown) ? s._questBannerShown.length : -1);
      // TC4a: port discovery defers banner → flush on resume
      fixture('FX_SEA3');
      const a0 = shownLen();
      sim.discoverPort('hanoi'); // 4th SE-asia port → q_southeast_asia completes (port source)
      const aDeferred = shownLen();
      const aQueued = s.pendingQuestBanners.length;
      s.events.emit('resume');
      r.push({
        id: 'TC4a',
        pass: aDeferred === a0 && aQueued >= 1 && shownLen() === a0 + 1
          && s.pendingFromPort === false && s.pendingQuestBanners.length === 0,
        detail: { a0, aDeferred, aQueued, afterResume: shownLen() },
      });
      // TC4b (B2 negative): resume with pendingFromPort=false → NO flush, even with a stale queue
      fixture('FX_START');
      s.pendingQuestBanners.push({ id: 'stale', kind: 'discoverContinents', target: 99, titleKo: 's', clearJun: 'j', clearAra: 'a' });
      s.pendingFromPort = false;
      const b0 = shownLen();
      s.events.emit('resume');
      s.events.emit('resume');
      r.push({
        id: 'TC4b',
        pass: shownLen() === b0 && s.pendingQuestBanners.length === 1, // gate is the cause, not an empty queue
        detail: { b0, after: shownLen(), queueStill: s.pendingQuestBanners.length },
      });
      // TC4c (E2): one call completes q_quiz_3 + q_quiz_10 → 2 banners on resume
      fixture({ quizPassed: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'], completed: [] });
      const c0 = shownLen();
      sim.recordQuizPass('p10', true);
      const cQueued = s.pendingQuestBanners.length;
      s.events.emit('resume');
      r.push({
        id: 'TC4c',
        pass: cQueued === 2 && shownLen() === c0 + 2 && s.pendingQuestBanners.length === 0,
        detail: { cQueued, shownDelta: shownLen() - c0 },
      });
      // TC4d: character-flavoured dialogue (jun vs ara)
      fixture('FX_SEA3'); s.character = 'jun';
      sim.discoverPort('hanoi'); s.events.emit('resume');
      const jShown = s._questBannerShown[s._questBannerShown.length - 1];
      fixture('FX_SEA3'); s.character = 'ara';
      sim.discoverPort('hanoi'); s.events.emit('resume');
      const aShown = s._questBannerShown[s._questBannerShown.length - 1];
      r.push({
        id: 'TC4d',
        pass: !!jShown && !!aShown && jShown.text !== aShown.text
          && jShown.character === 'jun' && aShown.character === 'ara',
        detail: { jText: jShown && jShown.text, aText: aShown && aShown.text },
      });
      // TC4e (immediate): sailing into the 3rd continent shows the banner now (no resume)
      fixture('FX_START'); s.character = 'jun';
      const e0 = shownLen();
      sim.enterContinent('southeast_asia');
      sim.enterContinent('south_asia'); // 3 continents → q_three_continents (immediate source)
      r.push({
        id: 'TC4e',
        pass: shownLen() === e0 + 1 && s.pendingFromPort === false,
        detail: { e0, after: shownLen(), pendingFromPort: s.pendingFromPort },
      });
      return { pass: r.every((x) => x.pass), results: r };
    },
    '5': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      const sim = (w.__qtest as any).sim;
      const KEY = 'worldExplorer_slot_99';
      const setSlot = (st: any) => localStorage.setItem(KEY, JSON.stringify(st));
      // TC5a: round-trip completedQuests + quizPassedPorts
      fixture('FX_SEA3'); sim.discoverPort('hanoi'); s.events.emit('resume'); // q_southeast_asia
      sim.recordQuizPass('seoul', true); sim.recordQuizPass('tokyo', true);
      const cBefore = [...s.completedQuests].sort(); const qBefore = [...s.quizPassedPorts].sort();
      setSlot(s.buildCurrentGameState());
      fixture('FX_START'); s.loadGameState(99);
      const cAfter = [...s.completedQuests].sort(); const qAfter = [...s.quizPassedPorts].sort();
      r.push({
        id: 'TC5a',
        pass: cBefore.includes('q_southeast_asia') && cAfter.join() === cBefore.join() && qAfter.join() === qBefore.join(),
        detail: { cBefore, cAfter, qBefore, qAfter },
      });
      // TC5b: serialized payload carries both keys as arrays
      const payload = s.buildCurrentGameState();
      r.push({ id: 'TC5b', pass: Array.isArray(payload.completedQuests) && Array.isArray(payload.quizPassedPorts), detail: { cq: payload.completedQuests, qp: payload.quizPassedPorts } });
      // TC5c (E3): load fires NO banner and absorbs already-met quests
      fixture('FX_SEA3'); sim.discoverPort('hanoi'); s.events.emit('resume');
      setSlot(s.buildCurrentGameState());
      fixture('FX_START');
      const cLog0 = s._questBannerLog.length, cShown0 = s._questBannerShown.length;
      s.loadGameState(99);
      r.push({
        id: 'TC5c',
        pass: s._questBannerLog.length === cLog0 && s._questBannerShown.length === cShown0
          && s.pendingFromPort === false && s.pendingQuestBanners.length === 0 && s.completedQuests.has('q_southeast_asia'),
        detail: { logDelta: s._questBannerLog.length - cLog0, shownDelta: s._questBannerShown.length - cShown0, pendingFromPort: s.pendingFromPort },
      });
      // TC5d: old save (no quest fields) → absorb, next discovery does NOT re-fire (banners()=_questBannerLog)
      fixture('FX_SEA3'); sim.discoverPort('hanoi');
      const oldState = s.buildCurrentGameState();
      delete oldState.completedQuests; delete oldState.quizPassedPorts;
      setSlot(oldState);
      fixture('FX_START'); s.loadGameState(99);
      const absorbed = s.completedQuests.has('q_southeast_asia');
      const dLog0 = s._questBannerLog.length;
      sim.discoverPort('seoul'); // east_asia 1st → q_first_voyage genuine new
      const newIds = s._questBannerLog.slice(dLog0).map((e: any) => e.id);
      r.push({ id: 'TC5d', pass: absorbed && !newIds.includes('q_southeast_asia') && newIds.includes('q_first_voyage'), detail: { absorbed, newIds } });
      // TC5e: quizPassedPorts restore; old save (no field) → 0
      fixture('FX_START'); sim.recordQuizPass('a', true); sim.recordQuizPass('b', true);
      setSlot(s.buildCurrentGameState());
      fixture('FX_START'); s.loadGameState(99);
      const eRestored = s.quizPassedPorts.size;
      const oldQ = s.buildCurrentGameState(); delete oldQ.quizPassedPorts;
      setSlot(oldQ); fixture('FX_START'); s.loadGameState(99);
      r.push({ id: 'TC5e', pass: eRestored === 2 && s.quizPassedPorts.size === 0, detail: { eRestored, oldRestored: s.quizPassedPorts.size } });
      // TC5f: new-save idempotent (no double-add, no banner)
      fixture('FX_SEA3'); sim.discoverPort('hanoi'); s.events.emit('resume');
      setSlot(s.buildCurrentGameState());
      fixture('FX_START');
      const fLog0 = s._questBannerLog.length;
      s.loadGameState(99);
      r.push({ id: 'TC5f', pass: s.completedQuests.has('q_southeast_asia') && s._questBannerLog.length === fLog0, detail: { size: s.completedQuests.size } });
      // TC5g: corrupt save → no crash
      localStorage.setItem(KEY, '{not valid json');
      let crashed = false;
      try { s.loadGameState(99); } catch { crashed = true; }
      r.push({ id: 'TC5g', pass: !crashed, detail: { crashed } });
      localStorage.removeItem(KEY);
      return { pass: r.every((x) => x.pass), results: r };
    },
    '6': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      // TC6a: numerator source — fixture-injected completedQuests is exactly what LogbookScene receives
      fixture({ completed: ['q_first_voyage', 'q_quiz_3'] });
      r.push({ id: 'TC6a', pass: s.completedQuests.size === 2, detail: [...s.completedQuests] });
      // TC6b: denominator canary (QUESTS.length===8 — trips deliberately if quests are added) + every id resolvable
      const allResolvable = QUESTS.every((def) => s.questProgress(def.id) != null);
      r.push({ id: 'TC6b', pass: QUESTS.length === 8 && allResolvable, detail: { len: QUESTS.length, allResolvable } });
      // TC6c: old-path fallback — LogbookScene.init without completedQuests defaults to [] (init is a pure assign; safe to call)
      const lb: any = game.scene.getScene('LogbookScene');
      lb.init({ discoveredPorts: [], collectedSpecialties: [], character: 'jun' });
      const fb0 = Array.isArray(lb.completedQuests) && lb.completedQuests.length === 0;
      lb.init({ discoveredPorts: [], collectedSpecialties: [], character: 'jun', completedQuests: ['x', 'y'] });
      const fb1 = lb.completedQuests.length === 2;
      r.push({ id: 'TC6c', pass: fb0 && fb1, detail: { fb0, fb1 } });
      // TC6d: win-condition + quest-state sentinels intact (cumulative all-green is the gate, not nested here)
      r.push({
        id: 'TC6d',
        pass: typeof s.collectedSpecialties?.size === 'number' && s.completedQuests instanceof Set,
        detail: { sp: s.collectedSpecialties?.size },
      });
      return { pass: r.every((x) => x.pass), results: r };
    },
    // Region gate R1 — data + derived helpers (RG1 route integrity / RG2 enterable transitions / RG3 KILLER canSailTo).
    'gate': () => {
      const s = getScene();
      const r: Array<{ id: string; pass: boolean; detail: unknown }> = [];
      const portCoord = (id: string): { lon: number; lat: number } | null => {
        const p = (portsData as any).ports.find((x: any) => x.id === id);
        return p ? p.coords : null;
      };

      // RG1: route boot-guard clean + shape (1:1 cover, starts at east_asia)
      const warns = Array.isArray(s._routeBootWarnings) ? s._routeBootWarnings : ['_routeBootWarnings missing'];
      r.push({
        id: 'RG1',
        pass: warns.length === 0 && REGION_ROUTE.length === CONTINENT_DEFS.length && REGION_ROUTE[0] === 'east_asia',
        detail: { warns, routeLen: REGION_ROUTE.length, defsLen: CONTINENT_DEFS.length },
      });

      // RG2: enterable transitions — start always enterable; next locked until prereq complete; unlock on completion
      fixture('FX_START');
      const eaStart = s.isContinentEnterable('east_asia');         // start → true
      const seaLocked = s.isContinentEnterable('southeast_asia');  // prereq east_asia incomplete → false
      const saLocked = s.isContinentEnterable('south_asia');       // → false
      ['seoul', 'tokyo', 'beijing', 'shanghai', 'hongkong'].forEach((p) => sim.discoverPort(p)); // complete east_asia
      const seaUnlocked = s.isContinentEnterable('southeast_asia'); // → true
      const saStill = s.isContinentEnterable('south_asia');         // southeast_asia not complete → still false
      r.push({
        id: 'RG2',
        pass: eaStart && !seaLocked && !saLocked && seaUnlocked && !saStill,
        detail: { eaStart, seaLocked, saLocked, seaUnlocked, saStill },
      });

      // RG3 (KILLER): canSailTo OR-over-boxes
      fixture('FX_START');
      const ocean = s.canSailTo(-160, 0);            // 3a open ocean (no box) → ok
      const locked = s.canSailTo(78, 18.5);          // 3b locked single box (south_asia center) → blocked
      // 3c own-port reachability: for every continent, once it's enterable, ALL its own ports are
      //    reachable — even where boxes overlap. (Naive first-match/any-locked impls block 2~7 ports.)
      const ownPortFails: string[] = [];
      for (const def of CONTINENT_DEFS) {
        fixture({ continents: [def.id] }); // discoveredContinents = {east_asia, def.id} → def.id enterable
        for (const portId of def.ports) {
          const c = portCoord(portId);
          if (!c) { ownPortFails.push(`${portId}(no-coord)`); continue; }
          if (!s.canSailTo(c.lon, c.lat).ok) ownPortFails.push(`${def.id}:${portId}`);
        }
      }
      r.push({
        id: 'RG3',
        pass: ocean.ok === true && locked.ok === false && locked.blockedId === 'south_asia' && ownPortFails.length === 0,
        detail: { ocean, locked, ownPortFails },
      });

      return { pass: r.every((x) => x.pass), results: r };
    },
  };

  const runTC = (step: string | number): unknown => {
    try { game.sound.mute = true; } catch { /* no-op */ } // tests always run muted (owner pref)
    const fn = TCS[String(step)];
    return fn ? fn() : { pass: false, results: [{ id: 'missing', pass: false, detail: `no TC for step ${step}` }] };
  };

  w.__qtest = { fixture, snapshot, sim, q, banners, shown, gate, runTC, FIXTURES };
}
