import { createActivityViewModel, selectLatestActivities } from './home-activity-helpers.js?v=2026090501';

/**
 * Entry page enhancements.
 * Core navigation and content remain available without JavaScript.
 */

const ACTIVITY_SOURCES = Object.freeze([
    { url: '/data/stayup-activities.json', team: 'stayup' },
    { url: '/data/firehawks-activities.json', team: 'firehawks' }
]);

function setCurrentYear() {
    const year = document.getElementById('currentYear');
    if (year) {
        year.textContent = String(new Date().getFullYear());
    }
}

function initHeaderState() {
    const header = document.getElementById('siteHeader');
    if (!header) return;

    let ticking = false;

    const updateHeader = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 12);
        ticking = false;
    };

    const requestUpdate = () => {
        if (ticking) return;
        window.requestAnimationFrame(updateHeader);
        ticking = true;
    };

    updateHeader();
    window.addEventListener('scroll', requestUpdate, { passive: true });
}

async function initVisitorOverview() {
    const overview = document.getElementById('visitorOverview');
    const stats = document.getElementById('visitorStats');
    const today = document.getElementById('visitorToday');
    const total = document.getElementById('visitorTotal');
    const status = document.getElementById('visitorStatus');
    if (!overview || !stats || !today || !total || !status) return;

    overview.dataset.state = 'loading';
    stats.setAttribute('aria-busy', 'true');
    status.textContent = '방문 현황을 집계하는 중입니다.';

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch('/api/visitors', {
            method: 'POST',
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal
        });
        if (!response.ok) throw new Error('visitor_counter_unavailable');

        const counts = await response.json();
        if (
            !Number.isSafeInteger(counts.today)
            || !Number.isSafeInteger(counts.total)
            || counts.today < 0
            || counts.total < counts.today
        ) {
            throw new Error('invalid_visitor_counts');
        }

        const formatter = new Intl.NumberFormat('ko-KR');
        today.textContent = formatter.format(counts.today);
        total.textContent = formatter.format(counts.total);
        overview.dataset.state = 'ready';
        stats.setAttribute('aria-busy', 'false');
        status.textContent = `오늘 방문 약 ${formatter.format(counts.today)}명, 누적 방문 약 ${formatter.format(counts.total)}명입니다. 브라우저 기준 추정치입니다.`;
    } catch {
        today.textContent = '—';
        total.textContent = '—';
        overview.dataset.state = 'unavailable';
        stats.setAttribute('aria-busy', 'false');
        status.textContent = '방문 현황을 불러오지 못했습니다.';
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function createLatestActivityCard(activity) {
    if (activity.staticElement) return activity.staticElement;
    const view = createActivityViewModel(activity);
    const article = document.createElement('article');
    const titleId = `latest-title-${view.team}-${view.id}`;
    article.className = `latest-activity-card ${view.teamClass}`;
    article.dataset.activityId = view.id;
    article.dataset.team = activity.team;
    article.dataset.date = activity.date;
    article.dataset.endDate = activity.endDate || '';
    article.dataset.order = activity.order;
    article.setAttribute('aria-labelledby', titleId);

    const link = document.createElement('a');
    link.className = 'latest-activity-link';
    link.href = view.archiveHref;

    const media = document.createElement('div');
    media.className = 'latest-activity-media';
    const image = document.createElement('img');
    image.src = view.image;
    image.alt = view.imageAlt;
    image.width = view.imageWidth;
    image.height = view.imageHeight;
    image.loading = 'lazy';
    image.decoding = 'async';
    media.append(image);

    const body = document.createElement('div');
    body.className = 'latest-activity-body';
    const meta = document.createElement('div');
    meta.className = 'latest-activity-meta';
    const team = document.createElement('span');
    team.className = 'latest-team-label';
    team.textContent = view.teamLabel;
    const date = document.createElement('time');
    date.dateTime = view.dateTime;
    date.textContent = view.dateLabel;
    meta.append(team, date);

    const category = document.createElement('p');
    category.className = 'latest-activity-category';
    category.textContent = view.category;
    const title = document.createElement('h3');
    title.id = titleId;
    title.textContent = view.title;
    const description = document.createElement('p');
    description.className = 'latest-activity-description';
    description.textContent = view.description;
    const more = document.createElement('span');
    more.className = 'latest-activity-more';
    more.textContent = '관련 기록 보기 →';

    body.append(meta, category, title, description, more);
    link.append(media, body);
    article.append(link);
    return article;
}

function createActivityStatus(message, className = 'activity-load-status') {
    const status = document.createElement('p');
    status.className = className;
    status.setAttribute('role', 'status');
    status.textContent = message;
    return status;
}

function initLatestActivities() {
    const container = document.getElementById('latest-activities-list');
    if (!container) return;
    const store = window.ActivityDataStore;
    if (!store?.loadActivitiesDetailed) return;
    const initial = store.readRenderedActivities(container);
    const sourceItems = new Map(ACTIVITY_SOURCES.map(({ team }) => [team, initial.filter((activity) => activity.team === team)]));
    const pending = new Set();
    const failed = new Set();
    const invalidCounts = new Map();
    const teamName = (team) => team === 'stayup' ? 'Stay-Up' : 'FireHawks';

    const render = () => {
        const focusedId = document.activeElement?.closest?.('.latest-activity-card')?.dataset.activityId;
        const activities = selectLatestActivities(ACTIVITY_SOURCES.map(({ team }) => ({ team, activities: sourceItems.get(team) })), 3);
        const cards = activities.map(createLatestActivityCard);
        const messages = [];
        if (failed.size) {
            const retained = [...failed].some((team) => sourceItems.get(team).length > 0);
            messages.push(`${[...failed].map(teamName).join(', ')} 최신 기록을 불러오지 못했습니다.${retained ? ' 저장된 기본 기록을 함께 표시합니다.' : ''}`);
        }
        const invalid = [...invalidCounts.values()].reduce((sum, count) => sum + count, 0);
        if (invalid) messages.push(`형식이 올바르지 않은 기록 ${invalid}건은 제외했습니다.`);
        if (pending.size) messages.push(`${[...pending].map(teamName).join(', ')} 최신 기록을 확인하고 있습니다.`);
        if (!activities.length && !pending.size && !failed.size) messages.push('현재 공개된 활동 기록이 없습니다.');
        if (messages.length) {
            const status = createActivityStatus(messages.join(' '), activities.length ? 'activity-partial-warning' : 'activity-load-status');
            if (failed.size) {
                const retry = document.createElement('button');
                retry.type = 'button';
                retry.className = 'activity-retry-button';
                retry.textContent = '실패한 기록 다시 불러오기';
                retry.addEventListener('click', () => ACTIVITY_SOURCES.filter((source) => failed.has(source.team)).forEach(loadSource));
                status.append(retry);
            }
            cards.push(status);
        }
        container.replaceChildren(...cards);
        if (focusedId) {
            const focusedCard = Array.from(container.querySelectorAll('article[data-activity-id]'))
                .find((card) => card.dataset.activityId === focusedId);
            focusedCard?.querySelector('a')?.focus({ preventScroll: true });
        }
        container.setAttribute('aria-busy', String(pending.size > 0 && activities.length === 0));
    };

    const loadSource = async (source) => {
        if (pending.has(source.team)) return;
        pending.add(source.team);
        failed.delete(source.team);
        render();
        try {
            const result = await store.loadActivitiesDetailed(source.url, source.team);
            if (result.activities.length === 0 && result.invalidCount > 0) throw new Error('유효한 활동 기록이 없습니다.');
            sourceItems.set(source.team, result.activities);
            invalidCounts.set(source.team, result.invalidCount);
        } catch (error) {
            console.warn(`[최근 활동] ${source.team} 갱신에 실패했습니다.`, error);
            failed.add(source.team);
        } finally {
            pending.delete(source.team);
            render();
        }
    };
    ACTIVITY_SOURCES.forEach(loadSource);
}

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    initHeaderState();
    initLatestActivities();
    initVisitorOverview();
});
