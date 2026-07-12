/**
 * FireHawks page enhancements.
 * Navigation behavior is shared through common.js.
 */

function createFireHawksRecordCard(activity) {
    const article = document.createElement('article');
    const titleId = `firehawks-record-title-${activity.id}`;
    article.className = 'record-card';
    article.dataset.activityId = activity.id;
    article.setAttribute('aria-labelledby', titleId);

    const imageContainer = document.createElement('div');
    imageContainer.className = 'record-image';

    const image = document.createElement('img');
    image.src = activity.image;
    image.alt = activity.imageAlt;
    image.width = activity.imageWidth;
    image.height = activity.imageHeight;
    image.loading = 'lazy';
    image.decoding = 'async';
    imageContainer.append(image);

    if (activity.badge) {
        const badge = document.createElement('span');
        badge.className = activity.badgeTone === 'muted' ? 'record-badge record-badge-muted' : 'record-badge';
        badge.textContent = activity.badge;
        imageContainer.append(badge);
    }

    const body = document.createElement('div');
    body.className = 'record-body';

    const time = document.createElement('time');
    time.dateTime = activity.endDate || activity.date;
    time.textContent = window.ActivityDataStore.getDateLabel(activity);

    const title = document.createElement('h3');
    title.id = titleId;
    title.textContent = activity.title;

    const description = document.createElement('p');
    description.textContent = activity.description;
    body.append(time, title, description);

    article.append(imageContainer, body);
    return article;
}

function showFireHawksRecordStatus(container, message, state) {
    const status = document.createElement('p');
    status.className = 'record-load-status';
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
    container.replaceChildren(status);
    container.dataset.loadState = state;
    container.setAttribute('aria-busy', 'false');
}

async function initFireHawksRecords() {
    const container = document.getElementById('firehawks-records-list');
    if (!container) return;
    if (!window.ActivityDataStore) {
        showFireHawksRecordStatus(container, '대회 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        return;
    }

    try {
        const activities = await window.ActivityDataStore.loadActivities('/data/firehawks-activities.json', 'firehawks');
        const configuredLimit = Number.parseInt(container.dataset.activityLimit, 10);
        const visibleActivities = Number.isInteger(configuredLimit) && configuredLimit > 0
            ? activities.slice(0, configuredLimit)
            : activities;

        if (visibleActivities.length === 0) {
            showFireHawksRecordStatus(container, '현재 게시된 대회 기록이 없습니다.', 'empty');
            return;
        }

        const fragment = document.createDocumentFragment();
        visibleActivities.forEach((activity) => {
            fragment.append(createFireHawksRecordCard(activity));
        });

        container.replaceChildren(fragment);
        container.dataset.loadState = 'ready';
        container.setAttribute('aria-busy', 'false');
    } catch (error) {
        console.error('[FireHawks] 대회 기록을 표시하지 못했습니다.', error);
        showFireHawksRecordStatus(container, '대회 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentYear = String(new Date().getFullYear());
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = currentYear;
    });

    initFireHawksRecords();
});
