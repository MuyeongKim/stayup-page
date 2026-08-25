import { createActivityViewModel, selectLatestActivities } from './home-activity-helpers.js?v=2026082506';

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

function createLatestActivityCard(activity) {
    const view = createActivityViewModel(activity);
    const article = document.createElement('article');
    const titleId = `latest-title-${view.team}-${view.id}`;
    article.className = `latest-activity-card ${view.teamClass}`;
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

function renderActivityError(container) {
    const status = createActivityStatus('최근 활동을 불러오지 못했습니다. ', 'activity-load-status activity-load-error');
    const link = document.createElement('a');
    link.href = '/activities/';
    link.textContent = '전체 활동 기록 보기';
    status.append(link);
    container.replaceChildren(status);
    container.setAttribute('aria-busy', 'false');
}

async function loadActivitySource(source) {
    const activities = await window.ActivityDataStore.loadActivities(source.url, source.team);
    return { team: source.team, activities };
}

async function initLatestActivities() {
    const container = document.getElementById('latest-activities-list');
    if (!container) return;
    if (!window.ActivityDataStore?.loadActivities) {
        renderActivityError(container);
        return;
    }

    const results = await Promise.allSettled(ACTIVITY_SOURCES.map(loadActivitySource));
    const loadedSources = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value);

    try {
        const activities = selectLatestActivities(loadedSources, 3);
        if (activities.length === 0) {
            renderActivityError(container);
            return;
        }

        const cards = activities.map(createLatestActivityCard);
        if (results.some((result) => result.status === 'rejected')) {
            cards.push(createActivityStatus(
                '일부 팀의 기록을 불러오지 못해 확인 가능한 최신 활동만 표시합니다.',
                'activity-partial-warning'
            ));
        }
        container.replaceChildren(...cards);
        container.setAttribute('aria-busy', 'false');
    } catch (error) {
        console.error('[메인 활동 기록] 렌더링에 실패했습니다.', error);
        renderActivityError(container);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setCurrentYear();
    initHeaderState();
    initLatestActivities();
});
