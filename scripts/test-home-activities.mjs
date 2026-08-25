import assert from 'node:assert/strict';

let createActivityViewModel;
let selectLatestActivities;
try {
  ({ createActivityViewModel, selectLatestActivities } = await import('../js/home-activity-helpers.js'));
} catch (error) {
  assert.fail(`홈 활동 선택 모듈을 불러올 수 없습니다: ${error.code || error.message}`);
}

const result = selectLatestActivities([
  {
    team: 'stayup',
    activities: [
      { id: 'stayup-older', date: '2026-03-01', order: 0 },
      { id: 'stayup-latest', date: '2026-08-20', order: 0 }
    ]
  },
  {
    team: 'firehawks',
    activities: [
      { id: 'firehawks-period', date: '2026-04-01', endDate: '2026-09-02', order: 0 },
      { id: 'firehawks-same-day', date: '2026-08-20', order: 2 }
    ]
  }
], 3);

assert.deepEqual(
  result.map(({ id, team }) => ({ id, team })),
  [
    { id: 'firehawks-period', team: 'firehawks' },
    { id: 'firehawks-same-day', team: 'firehawks' },
    { id: 'stayup-latest', team: 'stayup' }
  ],
  '두 팀 활동을 종료일·날짜·정렬 순서 기준으로 합쳐 최신 세 건을 반환해야 합니다.'
);

assert.deepEqual(selectLatestActivities([], 3), [], '활동 데이터가 없으면 빈 배열을 반환해야 합니다.');
assert.throws(
  () => selectLatestActivities([{ team: '', activities: [] }], 3),
  /team/,
  '팀 식별자가 없는 소스는 거부해야 합니다.'
);

const balancedResult = selectLatestActivities([
  {
    team: 'stayup',
    activities: [
      { id: 'stayup-august', date: '2026-08-20', order: 0 },
      { id: 'stayup-july', date: '2026-07-20', order: 0 },
      { id: 'stayup-june', date: '2026-06-20', order: 0 }
    ]
  },
  {
    team: 'firehawks',
    activities: [
      { id: 'firehawks-april', date: '2026-04-25', order: 0 }
    ]
  }
], 3);

assert.deepEqual(
  balancedResult.map(({ id }) => id),
  ['stayup-august', 'stayup-july', 'firehawks-april'],
  '표시 공간이 충분하면 각 팀의 최신 활동을 최소 한 건씩 포함해야 합니다.'
);

assert.deepEqual(
  createActivityViewModel({
    id: 'search-2026',
    team: 'stayup',
    date: '2026-08-20',
    category: '수색동원',
    title: '완주 봉동일대 실종자수색',
    description: '드론 수색과 맵핑을 지원했습니다.',
    image: '/images/search.webp',
    imageAlt: '드론 수색 현장',
    imageWidth: 960,
    imageHeight: 720
  }),
  {
    id: 'search-2026',
    team: 'stayup',
    teamLabel: 'Stay-Up',
    teamClass: 'team-stayup',
    dateLabel: '2026. 08. 20',
    dateTime: '2026-08-20',
    category: '수색동원',
    title: '완주 봉동일대 실종자수색',
    description: '드론 수색과 맵핑을 지원했습니다.',
    image: '/images/search.webp',
    imageAlt: '드론 수색 현장',
    imageWidth: 960,
    imageHeight: 720,
    archiveHref: '/activities/?team=stayup&year=2026'
  },
  '최신 활동 카드에 필요한 팀·날짜·기록 링크 정보를 만들어야 합니다.'
);

assert.throws(
  () => createActivityViewModel({ team: 'unknown', date: '2026' }),
  /team/,
  '알 수 없는 팀의 활동은 카드로 만들지 않아야 합니다.'
);
