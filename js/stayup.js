/** Stay-Up activities. Shared navigation is handled by common.js. */

function appendActivityDate(container, activity) {
    const time = document.createElement('time');
    time.dateTime = activity.date;
    time.textContent = window.ActivityDataStore.getDateLabel(activity);
    container.append(time);
}

function createStayUpActivityCard(activity) {
    const article = document.createElement('article');
    const titleId = `stayup-activity-title-${activity.id}`;
    article.className = 'activity-card';
    article.dataset.activityId = activity.id;
    article.dataset.team = 'stayup';
    article.dataset.date = activity.date;
    article.dataset.endDate = activity.endDate || '';
    article.dataset.order = activity.order;
    article.setAttribute('aria-labelledby', titleId);

    const media = document.createElement('div');
    media.className = 'activity-media';

    const image = document.createElement('img');
    image.src = activity.image;
    image.alt = activity.imageAlt;
    image.width = activity.imageWidth;
    image.height = activity.imageHeight;
    image.loading = 'lazy';
    image.decoding = 'async';

    const type = document.createElement('span');
    type.className = 'activity-type';
    type.textContent = activity.category;
    media.append(image, type);

    const content = document.createElement('div');
    content.className = 'activity-content';
    appendActivityDate(content, activity);

    const title = document.createElement('h3');
    title.id = titleId;
    title.textContent = activity.title;

    const description = document.createElement('p');
    description.textContent = activity.description;
    content.append(title, description);

    article.append(media, content);
    return article;
}

function showStayUpActivityStatus(container, message, state) {
    container.querySelectorAll('.activity-load-status').forEach((status) => status.remove());
    const status = document.createElement('p');
    status.className = 'activity-load-status';
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
    if (state === 'error') {
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'activity-retry-button';
        retry.textContent = '다시 불러오기';
        retry.addEventListener('click', initStayUpActivities);
        status.append(retry);
    }
    if (container.querySelector('article') && (state === 'error' || state === 'warning')) container.append(status);
    else container.replaceChildren(status);
    container.dataset.loadState = state;
    container.setAttribute('aria-busy', 'false');
}

async function initStayUpActivities() {
    const container = document.getElementById('stayup-activities-list');
    if (!container) return;
    if (container.dataset.refreshPending === 'true') return;
    if (!window.ActivityDataStore) {
        showStayUpActivityStatus(container, '활동 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        return;
    }

    container.dataset.refreshPending = 'true';
    container.querySelector('.activity-retry-button')?.setAttribute('disabled', '');
    try {
        const { activities, invalidCount } = await window.ActivityDataStore.loadActivitiesDetailed('/data/stayup-activities.json', 'stayup');
        if (activities.length === 0 && invalidCount > 0) throw new Error('유효한 활동 기록이 없습니다.');
        const configuredLimit = Number.parseInt(container.dataset.activityLimit, 10);
        const visibleActivities = Number.isInteger(configuredLimit) && configuredLimit > 0
            ? activities.slice(0, configuredLimit)
            : activities;

        if (visibleActivities.length === 0) {
            showStayUpActivityStatus(container, '현재 게시된 활동 내역이 없습니다.', 'empty');
            return;
        }

        const fragment = document.createDocumentFragment();
        visibleActivities.forEach((activity) => {
            fragment.append(createStayUpActivityCard(activity));
        });

        container.replaceChildren(fragment);
        container.dataset.loadState = 'ready';
        container.setAttribute('aria-busy', 'false');
        if (invalidCount > 0) showStayUpActivityStatus(container, `형식이 올바르지 않은 기록 ${invalidCount}건은 제외했습니다.`, 'warning');
    } catch (error) {
        console.error('[Stay-Up] 활동 내역을 표시하지 못했습니다.', error);
        const message = container.querySelector('article')
            ? '최신 활동을 확인하지 못해 기존 기록을 표시합니다.'
            : '활동 내역을 불러오지 못했습니다.';
        showStayUpActivityStatus(container, message, 'error');
    } finally {
        container.dataset.refreshPending = 'false';
        container.setAttribute('aria-busy', 'false');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initStayUpActivities();
});
