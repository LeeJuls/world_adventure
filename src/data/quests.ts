// Quest definitions + pure derived evaluation. Quests are an OPTIONAL layer over the existing
// progression (port discovery, continent discovery, quizzes, specialty collection). They never
// change the win condition. All quest text lives here as data (no hardcoded strings in scenes).

export type QuestKind =
  | 'discoverPortsInContinent' // discover N ports within a continent
  | 'discoverContinents'       // discover N continents
  | 'quizCorrect'              // answer N first-visit quizzes correctly
  | 'collectSpecialties';      // collect N specialties (chain finale = win condition)

export interface QuestDef {
  id: string;
  kind: QuestKind;
  target: number;
  continentId?: string;        // required for 'discoverPortsInContinent'
  titleKo: string;
  introJun?: string; introAra?: string; // quest-give line, per character
  clearJun?: string; clearAra?: string; // completion line, per character
  rewardTitleKo?: string;      // flavour title text only (does NOT add a rank tier)
}

// State the pure evaluator needs. The scene supplies it from its own Sets + continent map,
// so this module has no dependency on WorldMapScene internals or CONTINENT_DEFS.
export interface QuestState {
  discoveredPortCount: number;
  discoveredContinentCount: number;
  collectedSpecialtyCount: number;
  quizPassedCount: number;
  portsInContinent: (continentId: string) => number; // discovered ports in that continent
}

export interface QuestProgress {
  id: string;
  current: number;
  target: number;
  done: boolean;
}

export const QUESTS: QuestDef[] = [
  {
    id: 'q_first_voyage', kind: 'discoverPortsInContinent', continentId: 'east_asia', target: 1,
    titleKo: '첫 항해',
    introJun: '선장님, 가까운 항구부터 가볼까요? 뭐가 있을지 궁금해요!',
    introAra: '선장! 첫 항구를 향해 출발이다!',
    clearJun: '우와, 첫 항구 발견! 항해가 시작됐어요!',
    clearAra: '좋아, 첫 발자국을 찍었어! 다음은 어디로?',
  },
  {
    id: 'q_east_asia', kind: 'discoverPortsInContinent', continentId: 'east_asia', target: 5,
    titleKo: '동아시아 완전정복',
    introJun: '동아시아 항구들을 전부 찾아봐요. 우리 이웃 나라들이에요!',
    introAra: '동아시아 5개 항구, 전부 내 지도에 새기겠어!',
    clearJun: '동아시아를 다 알게 됐어요! 한국, 일본, 중국…',
    clearAra: '동아시아 정복 완료! 진짜 탐험가 같지?',
  },
  {
    id: 'q_southeast_asia', kind: 'discoverPortsInContinent', continentId: 'southeast_asia', target: 4,
    titleKo: '동남아 향신료 길',
    introJun: '남쪽 따뜻한 바다, 동남아 항구들이 궁금하지 않아요?',
    introAra: '동남아 4개 항구! 더 멀리 가보자!',
    clearJun: '동남아 항구를 다 찾았어요! 향신료 냄새가 나는 것 같아요.',
    clearAra: '동남아 정복! 우리가 점점 멀리 가고 있어!',
  },
  {
    id: 'q_three_continents', kind: 'discoverContinents', target: 3,
    titleKo: '세 대륙의 탐험가',
    introJun: '서로 다른 대륙 3곳을 밟아봐요. 세상은 넓어요!',
    introAra: '대륙 3개 발견에 도전! 할 수 있어!',
    clearJun: '벌써 세 대륙이나! 세계가 점점 보여요.',
    clearAra: '세 대륙 정복! 우린 멈추지 않아!',
  },
  {
    id: 'q_seven_continents', kind: 'discoverContinents', target: 7,
    titleKo: '일곱 바다의 주인',
    introJun: '대륙 7곳까지 가볼 수 있을까요? 정말 대단할 거예요!',
    introAra: '대륙 7개! 진짜 세계 일주의 시작이야!',
    clearJun: '일곱 대륙 발견! 우리 정말 멀리 왔어요.',
    clearAra: '일곱 대륙 정복! 이제 못 갈 곳이 없어!',
  },
  {
    id: 'q_quiz_3', kind: 'quizCorrect', target: 3,
    titleKo: '특산품 견습생',
    introJun: '특산품 퀴즈를 맞혀봐요. 알아가는 게 재밌어요!',
    introAra: '퀴즈 3개 정답! 머리도 탐험이다!',
    clearJun: '퀴즈 3개 정답! 특산품 박사가 되어가요.',
    clearAra: '퀴즈 3연승! 똑똑한 탐험가지?',
  },
  {
    id: 'q_quiz_10', kind: 'quizCorrect', target: 10,
    titleKo: '특산품 박사',
    introJun: '퀴즈 10개를 맞히면 진짜 특산품 박사예요!',
    introAra: '퀴즈 10개 정답에 도전! 기록을 세우자!',
    clearJun: '퀴즈 10개 정답! 이제 특산품 박사님이에요!',
    clearAra: '퀴즈 10개 격파! 내가 바로 특산품 박사!',
    rewardTitleKo: '🎓 특산품 박사',
  },
  {
    id: 'q_world_master', kind: 'collectSpecialties', target: 150,
    titleKo: '세계 일주의 달인',
    introJun: '세계의 특산품을 전부 모으는 게 우리의 꿈이에요!',
    introAra: '특산품 150개 전부! 세계 일주의 마지막 도전!',
    clearJun: '전 세계 특산품을 다 모았어요! 우리가 해냈어요!',
    clearAra: '150개 완성! 우리가 진짜 세계 일주의 달인이야!',
    rewardTitleKo: '🌍 세계 일주의 달인',
  },
];

export function computeProgress(def: QuestDef, st: QuestState): QuestProgress {
  let current = 0;
  switch (def.kind) {
    case 'discoverContinents': current = st.discoveredContinentCount; break;
    case 'discoverPortsInContinent': current = def.continentId ? st.portsInContinent(def.continentId) : 0; break;
    case 'quizCorrect': current = st.quizPassedCount; break;
    case 'collectSpecialties': current = st.collectedSpecialtyCount; break;
  }
  current = Math.min(current, def.target);
  return { id: def.id, current, target: def.target, done: current >= def.target };
}

export function evaluateQuests(st: QuestState): QuestProgress[] {
  return QUESTS.map((def) => computeProgress(def, st));
}

// Boot-time guard: every 'discoverPortsInContinent' quest must reference a real continent id.
// Returns warning strings (empty = valid). Prevents future silent-fail on a typo'd continentId.
export function validateQuests(validContinentIds: Set<string>): string[] {
  const warnings: string[] = [];
  for (const def of QUESTS) {
    if (def.kind === 'discoverPortsInContinent') {
      if (!def.continentId || !validContinentIds.has(def.continentId)) {
        warnings.push(`quest "${def.id}" references unknown continentId "${def.continentId}"`);
      }
    }
  }
  return warnings;
}
