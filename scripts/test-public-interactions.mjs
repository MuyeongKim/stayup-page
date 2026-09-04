import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createActivityViewModel, selectLatestActivities } from '../js/home-activity-helpers.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const deferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));
const activity = (team, id, date = '2026-06-19') => ({
    id, date, category: '훈련', title: `${team} ${id}`, description: '첫째 줄\n둘째 줄',
    image: '/images/test.webp', imageAlt: '훈련 사진', imageWidth: 960, imageHeight: 720,
    published: true, order: 0
});
const payload = (team, items) => ({ team, activities: items });
const response = (value) => ({ ok: true, json: async () => value });

// A small DOM harness exercises the real scripts, source completion order,
// retained HTML, focus and retry handlers without an additional dependency.
function environment(url = 'https://example.test/activities/') {
    const timers = new Map();
    const requests = [];
    let timerId = 0;
    const document = { activeElement: null };
    function matches(element, selector) {
        const direct = selector.split(' > ');
        if (direct.length === 2) return matches(element, direct[1]) && element.parentNode && matches(element.parentNode, direct[0]);
        const attr = selector.match(/\[([^\]^=]+)(\^?=)?(?:"([^"]*)")?\]/);
        const plain = selector.replace(/\[[^\]]+\]/g, '');
        const tag = plain.match(/^[a-z][a-z0-9-]*/i)?.[0];
        if (tag && element.tagName !== tag.toUpperCase()) return false;
        for (const token of plain.matchAll(/\.([a-z0-9_-]+)/gi)) if (!element.classList.contains(token[1])) return false;
        if (attr) {
            const value = element.getAttribute(attr[1]);
            if (value === null) return false;
            if (attr[2] === '=' && value !== attr[3]) return false;
            if (attr[2] === '^=' && !value.startsWith(attr[3])) return false;
        }
        return true;
    }
    class Element {
        constructor(tag = 'div') {
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.parentNode = null;
            this.dataset = {};
            this.attributes = {};
            this.listeners = {};
            this.className = '';
            this._text = '';
            this.hidden = false;
            this.disabled = false;
            this.scrollCalls = 0;
            this.focusCalls = 0;
            this.classList = {
                contains: (name) => this.className.split(/\s+/).includes(name),
                add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
                remove: (...names) => { this.className = this.className.split(/\s+/).filter((name) => !names.includes(name)).join(' '); },
                toggle: (name, force) => { const enabled = force ?? !this.classList.contains(name); this.classList[enabled ? 'add' : 'remove'](name); return enabled; }
            };
        }
        set textContent(value) { this._text = String(value); this.children.forEach((child) => { child.parentNode = null; }); this.children = []; }
        get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
        append(...children) {
            children.forEach((child) => {
                if (typeof child === 'string') { const text = new Element('#text'); text.textContent = child; child = text; }
                if (child.tagName === '#FRAGMENT') { this.append(...[...child.children]); return; }
                child.remove();
                this.children.push(child);
                child.parentNode = this;
            });
        }
        replaceChildren(...children) { this.textContent = ''; this.append(...children); }
        remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; } }
        setAttribute(name, value) {
            this.attributes[name] = String(value);
            if (name === 'tabindex') this.tabIndex = Number(value);
            if (name === 'disabled') this.disabled = true;
        }
        getAttribute(name) {
            if (name.startsWith('data-')) return this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] ?? null;
            if (name === 'class') return this.className;
            if (name === 'datetime') return this.dateTime ?? null;
            return this.attributes[name] ?? this[name] ?? null;
        }
        hasAttribute(name) { return this.getAttribute(name) !== null; }
        querySelectorAll(selector) {
            const selectors = selector.split(',').map((item) => item.trim());
            const found = [];
            const walk = (node) => node.children.forEach((child) => { if (selectors.some((item) => matches(child, item))) found.push(child); walk(child); });
            walk(this);
            return found;
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
        closest(selector) { return matches(this, selector) ? this : this.parentNode?.closest(selector) || null; }
        contains(child) { return child === this || this.children.some((node) => node.contains(child)); }
        focus() { document.activeElement = this; this.focusCalls += 1; }
        scrollIntoView() { this.scrollCalls += 1; }
        addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
        emit(type, data = {}) {
            const event = { type, target: this, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...data };
            (this.listeners[type] || []).forEach((callback) => callback(event));
            return event;
        }
    }
    const root = new Element('html');
    document.documentElement = root;
    document.body = new Element('body');
    root.append(document.body);
    document.createElement = (tag) => new Element(tag);
    document.createDocumentFragment = () => new Element('#fragment');
    document.createTextNode = (value) => { const node = new Element('#text'); node.textContent = value; return node; };
    document.getElementById = (id) => root.querySelectorAll('[id]').find((element) => element.id === id) || null;
    document.querySelector = (selector) => root.querySelector(selector);
    document.querySelectorAll = (selector) => root.querySelectorAll(selector);
    document.listeners = {};
    document.addEventListener = Element.prototype.addEventListener;
    document.emit = Element.prototype.emit;
    const window = {
        location: new URL(url), listeners: {},
        setTimeout: (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; },
        clearTimeout: (id) => timers.delete(id),
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        addEventListener: Element.prototype.addEventListener,
        emit: Element.prototype.emit,
        requestAnimationFrame: (callback) => callback(),
        history: { pushState: (_, __, next) => { window.location = new URL(next, window.location); } }
    };
    const context = vm.createContext({
        window, document, URLSearchParams, AbortController,
        console: { warn() {}, error() {}, log() {} },
        fetch: (requestUrl, options) => {
            const result = deferred();
            requests.push({ url: requestUrl, options, ...result });
            return result.promise;
        },
        createActivityViewModel, selectLatestActivities
    });
    const run = (file) => vm.runInContext(read(file).replace(/^import .*;\n/, ''), context, { filename: file });
    const add = (tag, id, parent = document.body) => { const element = new Element(tag); if (id) element.id = id; parent.append(element); return element; };
    run('js/activity-data.js');
    return { window, document, context, requests, timers, run, add };
}

function archive(env, initial = []) {
    for (const id of ['activities-grid', 'loading-state', 'error-state', 'partial-warning', 'empty-state', 'retry-button', 'year-filter', 'result-count', 'total-activity-count']) env.add(id === 'year-filter' ? 'select' : 'div', id);
    for (const team of ['all', 'stayup', 'firehawks']) { const button = env.add('button'); button.dataset.teamFilter = team; button.disabled = true; }
    initial.forEach(({ team, item }) => staticCard(env, env.document.getElementById('activities-grid'), team, item));
    env.run('js/activities.js');
}

function staticCard(env, container, team, item, className = 'activity-card') {
    const card = env.add('article', `activity-${team}-${item.id}`, container);
    card.className = className;
    card.dataset = { team, activityId: item.id, date: item.date, endDate: item.endDate || '', order: String(item.order), year: item.date.slice(0, 4) };
    const time = env.add('time', '', card); time.dateTime = item.date; time.textContent = item.date;
    const image = env.add('img', '', card); Object.assign(image, { src: item.image, alt: item.imageAlt, width: item.imageWidth, height: item.imageHeight });
    const title = env.add('h3', '', card); title.textContent = item.title;
    const description = env.add('p', '', card); description.className = 'activity-description'; description.textContent = item.description;
    const link = env.add('a', '', card); link.className = 'activity-share-link'; link.href = env.window.ActivityDataStore.getArchiveHref({ ...item, team });
    return card;
}

{
    const env = environment();
    const source = activity('stayup', 'month-range', '2026-06');
    source.endDate = '2026-06-19';
    source.displayDate = '2026년 6월 합동훈련';
    const result = env.window.ActivityDataStore.validatePayloadDetailed(payload('stayup', [source, { ...source }, { ...source, id: 'invalid', date: '2026-02-30' }, { ...source, id: 'hidden', published: false }]), 'stayup');
    assert.equal(result.activities.length, 1, '월 단위 시작일과 일 단위 종료일의 유효한 기간을 유지해야 합니다.');
    assert.equal(result.invalidCount, 2, '중복·잘못된 항목만 제외해야 합니다.');
    assert.equal(result.unpublishedCount, 1);
    assert.equal(env.window.ActivityDataStore.getDateLabel(source), source.displayDate, '사용자 지정 표시 날짜를 일관되게 사용해야 합니다.');
    const promise = env.window.ActivityDataStore.fetchJson('/pending');
    const rejected = assert.rejects(promise, { name: 'TimeoutError' });
    const timer = [...env.timers.values()][0];
    assert.equal(timer.ms, 8000);
    timer.callback();
    await rejected;
    assert.equal(env.requests[0].options.signal.aborted, true, '시간 초과 시 실제 요청도 중단해야 합니다.');
    assert.equal(env.timers.size, 0);
}

{
    const env = environment();
    archive(env);
    env.requests[0].resolve(response(payload('stayup', [activity('stayup', 'ready')])));
    await flush();
    assert.equal(env.document.getElementById('activities-grid').querySelectorAll('article').length, 1, '다른 팀 요청이 진행 중이어도 완료된 기록을 즉시 표시해야 합니다.');
    assert.equal(env.document.getElementById('year-filter').disabled, false);
    env.requests[1].reject(new Error('network'));
    await flush();
    assert.match(env.document.getElementById('partial-warning').textContent, /FireHawks/);
    env.document.querySelector('.activity-retry-button').emit('click');
    assert.equal(env.requests.length, 3);
    assert.match(env.requests[2].url, /firehawks/, '실패한 팀만 재시도해야 합니다.');
    env.requests[2].resolve(response(payload('firehawks', [activity('firehawks', 'recovered')])));
    await flush();
    assert.equal(env.document.getElementById('activities-grid').querySelectorAll('article').length, 2);
    assert.equal(env.document.getElementById('partial-warning').hidden, true);
    assert.match(env.document.querySelector('.activity-share-link').href, /#activity-(stayup|firehawks)-/);
}

{
    const target = activity('stayup', 'linked');
    const env = environment('https://example.test/activities/?team=stayup&year=2026#activity-stayup-linked');
    archive(env, [{ team: 'stayup', item: target }, { team: 'firehawks', item: activity('firehawks', 'old') }]);
    const original = env.document.getElementById('activity-stayup-linked');
    assert.equal(original.scrollCalls, 1);
    env.requests[0].resolve(response(payload('stayup', [target])));
    await flush();
    const refreshed = env.document.getElementById('activity-stayup-linked');
    assert.equal(refreshed.scrollCalls, 0, '부분 갱신마다 딥링크로 스크롤을 빼앗으면 안 됩니다.');
    assert.equal(env.document.activeElement.id, refreshed.id);
    env.requests[1].reject(new Error('network'));
    await flush();
    assert.match(env.document.getElementById('partial-warning').textContent, /기본 기록/);
    const firehawksButton = env.document.querySelectorAll('[data-team-filter]').find((button) => button.dataset.teamFilter === 'firehawks');
    firehawksButton.emit('click');
    assert.equal(env.document.getElementById('activities-grid').querySelectorAll('article').length, 1, '실패한 팀의 정적 기록도 필터링되어야 합니다.');
    env.document.querySelector('.activity-retry-button').emit('click');
    env.requests[2].resolve(response(payload('firehawks', [])));
    await flush();
    assert.equal(env.document.getElementById('activities-grid').querySelectorAll('article').length, 0, '정상 빈 목록 응답은 기존 정적 기록을 제거해야 합니다.');
    env.window.location = new URL('https://example.test/activities/?team=stayup&year=2026#activity-stayup-linked');
    env.window.emit('popstate');
    assert.equal(env.document.getElementById('activities-grid').querySelectorAll('article').length, 1, '뒤로 가기로 필터와 선택 활동을 복원해야 합니다.');
}

{
    const env = environment('https://example.test/activities/?team=stayup&year=2026#activity-stayup-unpublished');
    archive(env);
    env.requests[0].reject(new Error('network'));
    env.requests[1].reject(new Error('network'));
    await flush();
    assert.equal(env.document.getElementById('error-state').hidden, false);
    assert.equal(env.document.getElementById('total-activity-count').textContent, '—', '집계 실패를 활동 0건으로 표시하면 안 됩니다.');
    env.document.getElementById('retry-button').emit('click');
    assert.equal(env.requests.length, 4);
    env.requests[2].resolve(response(payload('stayup', [])));
    env.requests[3].resolve(response(payload('firehawks', [])));
    await flush();
    assert.equal(env.document.getElementById('error-state').hidden, true);
    assert.match(env.document.getElementById('partial-warning').textContent, /없거나 공개되지 않았습니다/, '삭제·비공개된 개별 링크의 상태를 설명해야 합니다.');
}

{
    const env = environment('https://example.test/stayup/stayup-landing.html');
    const target = env.add('section', 'activities');
    const link = env.add('a'); link.href = '#activities';
    const menu = env.add('ul'); menu.className = 'nav-menu';
    const button = env.add('button'); button.className = 'mobile-menu-btn';
    env.run('js/common.js');
    env.document.emit('DOMContentLoaded');
    const event = link.emit('click');
    assert.equal(event.defaultPrevented, false, '기본 해시 이동과 방문 기록을 브라우저에 맡겨야 합니다.');
    assert.equal(env.document.activeElement, target, '키보드 초점을 목적지로 옮겨야 합니다.');
    const previousFocusCalls = target.focusCalls;
    link.emit('click', { ctrlKey: true });
    assert.equal(target.focusCalls, previousFocusCalls, '새 탭 수정키 클릭을 가로채면 안 됩니다.');
    assert.equal(env.document.documentElement.classList.contains('has-navigation-js'), true);
}

for (const [team, script, containerId] of [['stayup', 'js/stayup.js', 'stayup-activities-list'], ['firehawks', 'js/firehawks.js', 'firehawks-records-list']]) {
    const env = environment();
    const container = env.add('div', containerId);
    container.dataset.activityLimit = '3';
    staticCard(env, container, team, activity(team, 'existing'));
    env.run(script);
    env.document.emit('DOMContentLoaded');
    env.requests[0].reject(new Error('network'));
    await flush();
    assert.equal(container.querySelectorAll('article').length, 1, `${team} 갱신 실패 시 기본 기록을 보존해야 합니다.`);
    assert.match(container.textContent, /기존 기록/);
    container.querySelector('.activity-retry-button').emit('click');
    env.requests[1].resolve(response(payload(team, [])));
    await flush();
    assert.equal(container.querySelectorAll('article').length, 0, `${team} 정상 빈 응답은 기존 기록을 제거해야 합니다.`);
    assert.match(container.textContent, /현재 게시된/);
}

{
    const env = environment();
    const container = env.add('div', 'firehawks-schedule-content');
    const initial = env.add('article', '', container); initial.textContent = '등록된 출전 일정';
    env.run('js/firehawks.js');
    env.document.emit('DOMContentLoaded');
    env.requests[0].reject(new Error('network'));
    await flush();
    assert.equal(container.querySelectorAll('article').length, 1);
    assert.match(container.textContent, /기존 등록 일정/);
    container.querySelector('.activity-retry-button').emit('click');
    env.requests[1].resolve(response({ team: 'firehawks', schedules: [] }));
    await flush();
    assert.equal(container.querySelectorAll('article').length, 0);
    assert.match(container.textContent, /현재 등록된 출전 일정이 없습니다/);
}

{
    const env = environment('https://example.test/');
    const container = env.add('div', 'latest-activities-list');
    staticCard(env, container, 'firehawks', activity('firehawks', 'fallback'), 'latest-activity-card');
    env.run('js/main.js');
    env.document.emit('DOMContentLoaded');
    env.requests[0].resolve(response(payload('stayup', [activity('stayup', 'new')])));
    await flush();
    assert.equal(container.querySelectorAll('article').length, 2, '홈은 응답한 팀 기록과 대기 중인 팀의 정적 기록을 함께 표시해야 합니다.');
    env.requests[1].reject(new Error('network'));
    await flush();
    container.querySelector('.activity-retry-button').emit('click');
    assert.match(env.requests[2].url, /firehawks/);
    env.requests[2].resolve(response(payload('firehawks', [])));
    await flush();
    assert.equal(container.querySelectorAll('article').length, 1, '홈에서도 정상 빈 응답이 정적 기록을 제거해야 합니다.');
    assert.equal(container.querySelector('article').dataset.team, 'stayup');
}

console.log('Public interaction checks passed: bounded fetch, partial refresh/retry, fallback removal, shared dates, deep links, focus and native navigation.');
