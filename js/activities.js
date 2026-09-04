(function initializeActivityArchive() {
    'use strict';

    const SOURCES = [
        { url: '/data/stayup-activities.json', team: 'stayup' },
        { url: '/data/firehawks-activities.json', team: 'firehawks' }
    ];
    const TEAMS = {
        stayup: { label: 'Stay-Up', className: 'team-stayup' },
        firehawks: { label: 'FireHawks', className: 'team-firehawks' }
    };
    const store = window.ActivityDataStore;
    const ui = {
        grid: document.getElementById('activities-grid'),
        loading: document.getElementById('loading-state'),
        error: document.getElementById('error-state'),
        warning: document.getElementById('partial-warning'),
        empty: document.getElementById('empty-state'),
        retry: document.getElementById('retry-button'),
        year: document.getElementById('year-filter'),
        result: document.getElementById('result-count'),
        total: document.getElementById('total-activity-count'),
        teamButtons: Array.from(document.querySelectorAll('[data-team-filter]'))
    };
    if (!store || Object.values(ui).some((element) => !element)) return;
    document.documentElement.classList.add('has-archive-js');

    const initialActivities = store.readRenderedActivities(ui.grid);
    const state = {
        activities: initialActivities,
        sourceItems: new Map(SOURCES.map(({ team }) => [team, initialActivities.filter((activity) => activity.team === team)])),
        pending: new Set(),
        failures: new Set(),
        invalidCounts: new Map(),
        team: 'all', year: 'all', focusedHash: ''
    };

    function readFilters() {
        const params = new URLSearchParams(window.location.search);
        state.team = TEAMS[params.get('team')] ? params.get('team') : 'all';
        state.year = /^\d{4}$/.test(params.get('year') || '') ? params.get('year') : 'all';
    }

    function syncFilterControls() {
        ui.teamButtons.forEach((button) => {
            const active = button.dataset.teamFilter === state.team;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
            button.disabled = false;
        });
        const years = [...new Set(state.activities.map((activity) => activity.date.slice(0, 4)))];
        if (state.year !== 'all' && !years.includes(state.year)) years.push(state.year);
        years.sort((a, b) => b.localeCompare(a));
        const values = ['all', ...years];
        const currentValues = Array.from(ui.year.children).map((option) => option.value);
        if (values.join(',') !== currentValues.join(',')) {
            const fragment = document.createDocumentFragment();
            values.forEach((year) => {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year === 'all' ? '전체 연도' : `${year}년`;
                fragment.append(option);
            });
            ui.year.replaceChildren(fragment);
        }
        ui.year.value = state.year;
        ui.year.disabled = false;
    }

    function syncFilterUrl() {
        const params = new URLSearchParams();
        if (state.team !== 'all') params.set('team', state.team);
        if (state.year !== 'all') params.set('year', state.year);
        const query = params.toString();
        const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
        if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== url) {
            window.history.pushState(null, '', url);
        }
        state.focusedHash = '';
    }

    function createCard(activity) {
        if (activity.staticElement) return activity.staticElement;
        if (activity.renderedElement) return activity.renderedElement;
        const team = TEAMS[activity.team];
        const article = document.createElement('article');
        const titleId = `activity-title-${activity.team}-${activity.id}`;
        article.id = `activity-${activity.team}-${activity.id}`;
        article.className = `activity-card ${team.className}`;
        article.tabIndex = -1;
        article.dataset.activityId = activity.id;
        article.dataset.team = activity.team;
        article.dataset.year = activity.date.slice(0, 4);
        article.dataset.date = activity.date;
        article.dataset.endDate = activity.endDate;
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
        const labels = document.createElement('div');
        labels.className = 'activity-labels';
        const teamLabel = document.createElement('span');
        teamLabel.className = 'team-label';
        teamLabel.textContent = team.label;
        const category = document.createElement('span');
        category.className = 'category-label';
        category.textContent = activity.category;
        labels.append(teamLabel, category);
        media.append(image, labels);
        if (activity.badge) {
            const badge = document.createElement('span');
            badge.className = activity.badgeTone === 'muted' ? 'activity-badge is-muted' : 'activity-badge';
            badge.textContent = activity.badge;
            media.append(badge);
        }
        const content = document.createElement('div');
        content.className = 'activity-content';
        const date = document.createElement('p');
        date.className = 'activity-date';
        const time = document.createElement('time');
        time.dateTime = activity.date;
        time.textContent = store.getDateLabel(activity);
        date.append(time);
        const title = document.createElement('h3');
        title.id = titleId;
        title.textContent = activity.title;
        const description = document.createElement('p');
        description.className = 'activity-description';
        description.textContent = activity.description;
        const share = document.createElement('a');
        share.className = 'activity-share-link';
        share.href = store.getArchiveHref(activity);
        share.textContent = '이 활동 링크';
        share.setAttribute('aria-label', `${activity.title} 활동 링크`);
        content.append(date, title, description, share);
        article.append(media, content);
        activity.renderedElement = article;
        return article;
    }

    function focusLinkedActivity() {
        const hash = window.location.hash;
        ui.grid.querySelectorAll('.is-targeted').forEach((card) => card.classList.remove('is-targeted'));
        if (!hash || !/^#activity-(?:stayup|firehawks)-[a-z0-9-]+$/.test(hash)) return;
        const target = document.getElementById(hash.slice(1));
        if (!target || !ui.grid.contains(target)) return;
        target.classList.add('is-targeted');
        if (state.focusedHash === hash) return;
        state.focusedHash = hash;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }

    function renderStatus(visibleCount) {
        const hasRecords = state.activities.length > 0;
        const loading = state.pending.size > 0;
        const failedLabels = [...state.failures].map((team) => TEAMS[team].label);
        const invalid = [...state.invalidCounts.values()].reduce((sum, count) => sum + count, 0);
        ui.loading.hidden = !loading || hasRecords;
        ui.grid.setAttribute('aria-busy', String(loading && !hasRecords));
        ui.error.hidden = loading || hasRecords || state.failures.size === 0;
        ui.empty.hidden = visibleCount !== 0 || (!hasRecords && loading) || !ui.error.hidden;
        ui.total.textContent = !hasRecords && state.failures.size > 0 ? '—' : String(state.activities.length);
        ui.warning.replaceChildren();
        const messages = [];
        if (failedLabels.length) {
            const retained = [...state.failures].some((team) => state.sourceItems.get(team).length > 0);
            messages.push(`${failedLabels.join(', ')} 최신 기록을 불러오지 못했습니다.${retained ? ' 저장된 기본 기록을 함께 표시합니다.' : hasRecords ? ' 확인 가능한 팀의 기록을 표시합니다.' : ''}`);
        }
        if (invalid > 0) messages.push(`형식이 올바르지 않은 기록 ${invalid}건은 제외했습니다.`);
        if (loading && hasRecords) messages.push(`${[...state.pending].map((team) => TEAMS[team].label).join(', ')} 최신 기록을 확인하고 있습니다.`);
        const requestedId = window.location.hash.slice(1);
        if (!loading && /^activity-(?:stayup|firehawks)-[a-z0-9-]+$/.test(requestedId)
            && !state.activities.some((activity) => `activity-${activity.team}-${activity.id}` === requestedId)) {
            messages.push(state.failures.size > 0
                ? '링크의 활동을 확인하지 못했습니다. 기록을 다시 불러와 주세요.'
                : '링크의 활동이 없거나 공개되지 않았습니다. 다른 기록을 확인해 주세요.');
        }
        ui.warning.hidden = messages.length === 0;
        if (messages.length) ui.warning.append(document.createTextNode(messages.join(' ')));
        if (state.failures.size > 0 && hasRecords) {
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'activity-retry-button';
            retry.textContent = '실패한 기록 다시 불러오기';
            retry.addEventListener('click', retryFailedSources);
            ui.warning.append(retry);
        }
        const teamLabel = state.team === 'all' ? '전체 팀' : TEAMS[state.team].label;
        const yearLabel = state.year === 'all' ? '전체 연도' : `${state.year}년`;
        ui.result.textContent = !hasRecords && loading
            ? '활동 기록을 불러오는 중입니다.'
            : !ui.error.hidden ? '활동 기록을 불러오지 못했습니다.' : `${teamLabel} · ${yearLabel} 활동 ${visibleCount}건`;
    }

    function render() {
        state.activities = store.sortActivities([...state.sourceItems.values()].flat());
        const visible = state.activities.filter((activity) => (
            (state.team === 'all' || activity.team === state.team)
            && (state.year === 'all' || activity.date.slice(0, 4) === state.year)
        ));
        const focused = document.activeElement?.closest?.('.activity-card');
        const focusedId = focused?.id;
        const focusedShare = document.activeElement?.classList?.contains('activity-share-link');
        const fragment = document.createDocumentFragment();
        visible.forEach((activity) => fragment.append(createCard(activity)));
        ui.grid.replaceChildren(fragment);
        syncFilterControls();
        renderStatus(visible.length);
        if (focusedId) {
            const replacement = document.getElementById(focusedId);
            const focusTarget = focusedShare ? replacement?.querySelector('.activity-share-link') : replacement;
            focusTarget?.focus({ preventScroll: true });
        }
        focusLinkedActivity();
    }

    async function loadSource(source) {
        if (state.pending.has(source.team)) return;
        state.pending.add(source.team);
        state.failures.delete(source.team);
        render();
        try {
            const result = await store.loadActivitiesDetailed(source.url, source.team);
            if (result.activities.length === 0 && result.invalidCount > 0) throw new Error('유효한 활동 기록이 없습니다.');
            state.sourceItems.set(source.team, result.activities.map((activity) => ({ ...activity, team: source.team })));
            state.invalidCounts.set(source.team, result.invalidCount);
        } catch (error) {
            console.warn(`[활동 기록] ${source.team} 갱신에 실패했습니다.`, error);
            state.failures.add(source.team);
        } finally {
            state.pending.delete(source.team);
            render();
        }
    }

    function retryFailedSources() {
        SOURCES.filter((source) => state.failures.has(source.team)).forEach(loadSource);
    }

    ui.teamButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const team = button.dataset.teamFilter;
            if (team !== 'all' && !TEAMS[team]) return;
            state.team = team;
            syncFilterUrl();
            render();
        });
    });
    ui.year.addEventListener('change', () => {
        state.year = ui.year.value;
        syncFilterUrl();
        render();
    });
    ui.retry.addEventListener('click', retryFailedSources);
    window.addEventListener('popstate', () => {
        readFilters();
        state.focusedHash = '';
        render();
    });
    window.addEventListener('hashchange', focusLinkedActivity);
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = String(new Date().getFullYear());
    });
    readFilters();
    render();
    SOURCES.forEach(loadSource);
}());
