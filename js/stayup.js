/**
 * Stay-Up page accessibility enhancements.
 * The shared common.js owns the basic menu toggle; this file keeps its
 * accessible state in sync and handles page-specific navigation behavior.
 */

function initAccessibleMobileMenu() {
    const menuButton = document.querySelector('.mobile-menu-btn');
    const navMenu = document.querySelector('.nav-menu');

    if (!menuButton || !navMenu) return;

    const syncMenuState = () => {
        const isOpen = navMenu.classList.contains('active');
        menuButton.setAttribute('aria-expanded', String(isOpen));
        menuButton.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
    };

    const menuObserver = new MutationObserver(syncMenuState);
    menuObserver.observe(navMenu, {
        attributes: true,
        attributeFilter: ['class']
    });

    navMenu.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !navMenu.classList.contains('active')) return;

        window.requestAnimationFrame(() => {
            menuButton.focus();
        });
    }, true);

    const desktopQuery = window.matchMedia('(min-width: 921px)');
    const closeMenuOnDesktop = (event) => {
        if (event.matches) navMenu.classList.remove('active');
    };

    if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', closeMenuOnDesktop);
    } else {
        desktopQuery.addListener(closeMenuOnDesktop);
    }

    syncMenuState();
}

function initReducedMotionNavigation() {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    document.addEventListener('click', (event) => {
        if (!reducedMotion.matches) return;

        const link = event.target.closest('a[href^="#"]');
        if (!link) return;

        const targetId = link.getAttribute('href');
        if (!targetId || targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        document.querySelector('.nav-menu')?.classList.remove('active');
        target.scrollIntoView({ behavior: 'auto', block: 'start' });

        if (link.classList.contains('skip-link')) {
            target.focus({ preventScroll: true });
        }

        if (window.history && typeof window.history.pushState === 'function') {
            window.history.pushState(null, '', targetId);
        }
    }, true);
}

function appendActivityDate(container, activity) {
    if (!activity.endDate) {
        const time = document.createElement('time');
        time.dateTime = activity.date;
        time.textContent = window.ActivityDataStore.getDateLabel(activity);
        container.append(time);
        return;
    }

    const startTime = document.createElement('time');
    startTime.dateTime = activity.date;
    startTime.textContent = window.ActivityDataStore.formatDate(activity.date);

    const separator = document.createElement('span');
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = ' — ';

    const endTime = document.createElement('time');
    endTime.dateTime = activity.endDate;
    endTime.textContent = window.ActivityDataStore.formatDate(activity.endDate);

    container.append(startTime, separator, endTime);
}

function createStayUpActivityCard(activity, isFeatured) {
    const article = document.createElement('article');
    article.className = isFeatured ? 'activity-card activity-featured' : 'activity-card';
    article.dataset.activityId = activity.id;

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
    title.textContent = activity.title;

    const description = document.createElement('p');
    description.textContent = activity.description;
    content.append(title, description);

    article.append(media, content);
    return article;
}

function showStayUpActivityStatus(container, message, state) {
    const status = document.createElement('p');
    status.className = 'activity-load-status';
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
    container.replaceChildren(status);
    container.dataset.loadState = state;
    container.setAttribute('aria-busy', 'false');
}

async function initStayUpActivities() {
    const container = document.getElementById('stayup-activities-list');
    if (!container) return;
    if (!window.ActivityDataStore) {
        showStayUpActivityStatus(container, '활동 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
        return;
    }

    try {
        const activities = await window.ActivityDataStore.loadActivities('/data/stayup-activities.json', 'stayup');
        const configuredLimit = Number.parseInt(container.dataset.activityLimit, 10);
        const visibleActivities = Number.isInteger(configuredLimit) && configuredLimit > 0
            ? activities.slice(0, configuredLimit)
            : activities;

        if (visibleActivities.length === 0) {
            showStayUpActivityStatus(container, '현재 게시된 활동 내역이 없습니다.', 'empty');
            return;
        }

        const fragment = document.createDocumentFragment();
        visibleActivities.forEach((activity, index) => {
            fragment.append(createStayUpActivityCard(activity, index === 0));
        });

        container.replaceChildren(fragment);
        container.dataset.loadState = 'ready';
        container.setAttribute('aria-busy', 'false');
    } catch (error) {
        console.error('[Stay-Up] 활동 내역을 표시하지 못했습니다.', error);
        showStayUpActivityStatus(container, '활동 내역을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initAccessibleMobileMenu();
    initReducedMotionNavigation();
    initStayUpActivities();
});
