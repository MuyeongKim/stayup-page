import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

// Run the real editor/save functions with a small DOM and an in-memory GitHub boundary.
// These tests never authenticate, fetch from the network, or write repository data.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.value = '';
    this.checked = true;
    this.disabled = false;
    this.hidden = false;
    this.open = false;
    this.textContent = '';
    this.classList = { add() {}, toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this[name] = value; }
  removeAttribute(name) { delete this[name]; }
  addEventListener(name, handler) { this.listeners.set(name, handler); }
  click() { this.listeners.get('click')?.({ preventDefault() {} }); }
  querySelectorAll() { return []; }
  reportValidity() { return true; }
  reset() {} // openEditor assigns the input values; native reset does not reset disabled.
  focus() { this.focused = true; }
  close() { this.open = false; }
  showModal() { this.open = true; }
}

const source = (await readFile(new URL('../admin/admin.js', import.meta.url), 'utf8'))
  .replace('void restoreSession();', '');
const originalSchedule = {
  id: 'schedule-one', date: '2026-10-01', title: '기존 대회', location: '기존 장소',
  description: '기존 안내', order: 0, published: true,
};
const originalActivity = {
  id: 'activity-one', date: '2026-10-01', category: '훈련', title: '기존 활동',
  description: '기존 설명', image: '/images/example.webp', imageAlt: '기존 사진',
  imageWidth: 800, imageHeight: 600, order: 0, published: true,
};
const clone = value => JSON.parse(JSON.stringify(value));
const event = { preventDefault() {} };

function fixture(kind = 'schedule') {
  const selected = new Map();
  const backend = {
    head: 'a'.repeat(40), writes: 0,
    manifests: {
      'stayup-activities': { team: 'stayup', activities: [clone(originalActivity)] },
      'firehawks-activities': { team: 'firehawks', activities: [] },
      'firehawks-schedules': { team: 'firehawks', schedules: [clone(originalSchedule)] },
    },
  };
  const context = vm.createContext({
    console, URL, crypto: webcrypto, HTMLElement: Element,
    document: {
      querySelector(selector) {
        if (!selected.has(selector)) selected.set(selector, new Element());
        return selected.get(selector);
      },
      querySelectorAll() { return []; },
      createElement: tag => new Element(tag),
    },
    window: {
      setTimeout() {}, clearTimeout() {}, confirm: () => true,
      matchMedia: () => ({ matches: false }), innerWidth: 1200,
      sessionStorage: { removeItem() {} },
    },
  });
  vm.runInContext(`${source}\n
    renderManager = () => {};
    globalThis.editor = {
      state, elements, openEditor, closeEditor, openScheduleEditor,
      saveActivity, saveSchedule, processSelectedImage, syncSaveButtons,
      request: fn => { githubRequest = fn; },
      decode: fn => { decodeImage = fn; },
    };`, context, { filename: 'admin/admin.js' });
  const api = context.editor;
  Object.assign(api.state, {
    token: 'mock-only', user: { login: 'review-test' }, headSha: backend.head,
    selectedTeam: kind === 'schedule' ? 'firehawks' : 'stayup',
    manifests: {
      stayup: clone(backend.manifests['stayup-activities']),
      firehawks: clone(backend.manifests['firehawks-activities']),
    },
    scheduleManifest: clone(backend.manifests['firehawks-schedules']),
  });
  let pendingPayload;
  let pendingPath;
  api.request(async (path, options = {}) => {
    if (path.includes('/git/ref/heads/')) return { object: { sha: backend.head } };
    if (path.includes('/contents/')) {
      if (backend.failRefresh) throw new Error('검증용 연결 끊김');
      const name = path.split('/').at(-1).split('.json')[0];
      assert.ok(backend.manifests[name], `Unexpected fixture: ${path}`);
      return JSON.stringify(backend.manifests[name]);
    }
    if (path.includes('/git/commits/')) return { tree: { sha: 'base-tree' } };
    if (path.endsWith('/git/blobs')) {
      assert.equal(options.body.encoding, 'utf-8');
      pendingPayload = JSON.parse(options.body.content);
      return { sha: 'json-blob' };
    }
    if (path.endsWith('/git/trees')) {
      pendingPath = options.body.tree[0].path.split('/').at(-1).replace('.json', '');
      return { sha: 'new-tree' };
    }
    if (path.endsWith('/git/commits')) return { sha: 'c'.repeat(40) };
    if (path.includes('/git/refs/heads/')) {
      assert.equal(options.body.force, false);
      backend.manifests[pendingPath] = clone(pendingPayload);
      backend.head = options.body.sha;
      backend.writes += 1;
      return {};
    }
    assert.fail(`Unmocked network operation: ${path}`);
  });
  if (kind === 'schedule') api.openScheduleEditor(api.state.scheduleManifest.schedules[0]);
  else api.openEditor(api.state.manifests.stayup.activities[0]);
  return { api, backend };
}

function findChild(root, predicate) {
  for (const child of root.children) {
    if (predicate(child)) return child;
    const found = findChild(child, predicate);
    if (found) return found;
  }
  return null;
}

{
  const { api, backend } = fixture();
  api.elements.scheduleTitle.value = 'A가 수정한 대회';
  backend.manifests['firehawks-schedules'].schedules[0].location = 'B가 수정한 장소';
  backend.head = 'b'.repeat(40);
  await api.saveSchedule(event);
  assert.equal(backend.writes, 0, '충돌을 복구하는 첫 요청은 저장하면 안 됩니다.');
  assert.equal(api.elements.scheduleEditorDialog.open, true);
  assert.equal(api.elements.scheduleTitle.value, 'A가 수정한 대회');
  assert.equal(api.elements.scheduleLocation.value, 'B가 수정한 장소');
  assert.equal(api.elements.scheduleEditorStatus.dataset.tone, 'warning');
  await api.saveSchedule(event);
  assert.equal(backend.writes, 1);
  assert.equal(backend.manifests['firehawks-schedules'].schedules[0].title, 'A가 수정한 대회');
  assert.equal(backend.manifests['firehawks-schedules'].schedules[0].location, 'B가 수정한 장소');
}

{
  const { api, backend } = fixture();
  api.elements.scheduleTitle.value = 'A의 제목';
  api.elements.scheduleDescription.value = 'A의 안내';
  Object.assign(backend.manifests['firehawks-schedules'].schedules[0], { title: 'B의 제목', location: 'B의 장소' });
  backend.head = 'b'.repeat(40);
  await api.saveSchedule(event);
  assert.equal(api.elements.saveScheduleButton.disabled, true);
  assert.equal(api.elements.scheduleTitle.value, 'A의 제목', '충돌한 입력을 먼저 지우면 안 됩니다.');
  assert.equal(api.elements.scheduleTitle.disabled, true, '비교하는 동안 초안이 바뀌면 안 됩니다.');
  await api.saveSchedule(event);
  assert.equal(backend.writes, 0, '재제출로 충돌 선택을 우회하면 안 됩니다.');
  const panel = api.elements.scheduleConflict;
  const apply = findChild(panel, child => child.tagName === 'BUTTON');
  apply.click();
  assert.ok(api.state.scheduleConflict, '선택 없이 충돌을 해제하면 안 됩니다.');
  findChild(panel, child => child.tagName === 'SELECT').value = 'latest';
  apply.click();
  assert.equal(api.state.scheduleConflict, null);
  assert.equal(api.elements.scheduleTitle.value, 'B의 제목');
  assert.equal(api.elements.scheduleDescription.value, 'A의 안내');
  assert.equal(api.elements.scheduleLocation.value, 'B의 장소');
  await api.saveSchedule(event);
  assert.equal(backend.manifests['firehawks-schedules'].schedules[0].title, 'B의 제목');
  assert.equal(backend.manifests['firehawks-schedules'].schedules[0].description, 'A의 안내');
}

{
  const { api, backend } = fixture('activity');
  api.elements.activityDescription.value = 'A의 설명';
  backend.manifests['stayup-activities'].activities[0].title = 'B의 활동 제목';
  backend.head = 'b'.repeat(40);
  await api.saveActivity(event);
  assert.equal(backend.writes, 0);
  assert.equal(api.elements.editorDialog.open, true);
  assert.equal(api.elements.activityDescription.value, 'A의 설명');
  assert.equal(api.elements.activityTitle.value, 'B의 활동 제목');
  await api.saveActivity(event);
  assert.equal(backend.writes, 1);
  assert.equal(backend.manifests['stayup-activities'].activities[0].title, 'B의 활동 제목');
}

{
  const { api, backend } = fixture();
  api.elements.scheduleTitle.value = 'A의 제목';
  backend.manifests['firehawks-schedules'].schedules[0].title = 'B의 제목';
  backend.head = 'b'.repeat(40);
  await api.saveSchedule(event);
  findChild(api.elements.scheduleConflict, child => child.tagName === 'SELECT').value = 'draft';
  findChild(api.elements.scheduleConflict, child => child.tagName === 'BUTTON').click();
  backend.manifests['firehawks-schedules'].schedules[0].title = 'C의 새 제목';
  backend.head = 'd'.repeat(40);
  await api.saveSchedule(event);
  assert.equal(backend.writes, 0, '충돌 선택 후 새 변경이 생겨도 이전 승인을 재사용하면 안 됩니다.');
  assert.equal(api.elements.scheduleTitle.value, 'A의 제목');
  assert.equal(api.state.scheduleConflict.latest.title, 'C의 새 제목');
}

{
  const { api, backend } = fixture();
  api.elements.scheduleTitle.value = '연결이 끊겨도 보관할 제목';
  backend.head = 'b'.repeat(40);
  backend.failRefresh = true;
  await api.saveSchedule(event);
  assert.equal(backend.writes, 0);
  assert.equal(api.elements.scheduleTitle.value, '연결이 끊겨도 보관할 제목');
  assert.equal(api.state.scheduleConflict.retry, true);
  backend.failRefresh = false;
  findChild(api.elements.scheduleConflict, child => child.tagName === 'BUTTON').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(api.state.scheduleConflict, null);
  assert.equal(api.elements.saveScheduleButton.disabled, false);
  await api.saveSchedule(event);
  assert.equal(backend.writes, 1);
}

{
  const { api, backend } = fixture();
  api.elements.scheduleTitle.value = '보관할 초안';
  backend.manifests['firehawks-schedules'].schedules = [];
  backend.head = 'b'.repeat(40);
  await api.saveSchedule(event);
  assert.equal(backend.writes, 0, '삭제된 항목에 저장 성공을 표시하면 안 됩니다.');
  assert.equal(api.elements.saveScheduleButton.disabled, true);
  findChild(api.elements.scheduleConflict, child => child.tagName === 'BUTTON').click();
  await api.saveSchedule(event);
  const [saved] = backend.manifests['firehawks-schedules'].schedules;
  assert.notEqual(saved.id, originalSchedule.id, '새 기록은 사용자의 선택 후 새 ID로 생성해야 합니다.');
  assert.equal(saved.title, '보관할 초안');
}

{
  const { api } = fixture('activity');
  let finishDecode;
  let cleanedUp = false;
  api.decode(() => new Promise(resolve => { finishDecode = resolve; }));
  const pending = api.processSelectedImage({ type: 'image/jpeg', size: 200 }, api.state.imageProcessVersion);
  assert.equal(api.elements.saveButton.disabled, true);
  assert.equal(api.elements.closeEditorButton.disabled, false);
  api.closeEditor();
  api.openEditor(api.state.manifests.stayup.activities[0]);
  assert.equal(api.state.imageProcessing, false);
  assert.equal(api.elements.saveButton.disabled, false, '이전 사진 변환을 취소해도 새 편집을 저장할 수 있어야 합니다.');
  finishDecode({ width: 800, height: 600, cleanup() { cleanedUp = true; } });
  await pending;
  assert.equal(cleanedUp, true);
  assert.equal(api.state.processedImage, null, '취소한 사진이 늦게 도착해 새 편집에 들어가면 안 됩니다.');
  assert.equal(api.elements.saveButton.disabled, false);
  api.elements.activityPublished.checked = false;
  api.syncSaveButtons();
  assert.equal(api.elements.saveButton.textContent, '숨김으로 저장');
  api.elements.activityPublished.checked = true;
  api.syncSaveButtons();
  assert.equal(api.elements.saveButton.textContent, '저장하고 공개');
}

console.log('관리자 복구 검증 통과: 일정·활동 병합, 반복 충돌 선택, 연결 복구, 삭제된 항목, 사진 변환 취소, 공개 상태 문구');
