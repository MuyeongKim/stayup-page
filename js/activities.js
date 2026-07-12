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
    const state = { activities: [], team: 'all', year: 'all' };
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

    function isObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function isText(value, maxLength) {
        return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
    }

    function isValidDate(value) {
        if (typeof value !== 'string' || !/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value)) return false;
        const parts = value.split('-').map(Number);
        const [year, month, day] = parts;
        if (year < 1900 || year > 2200) return false;
        if (parts.length === 1) return true;
        if (month < 1 || month > 12) return false;
        if (parts.length === 2) return true;
        return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
    }

    function sortDate(value) {
        const parts = value.split('-').map(Number);
        const year = parts[0];
        const month = parts[1] || 12;
        const day = parts[2] || new Date(Date.UTC(year, month, 0)).getUTCDate();
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function isSafeImagePath(value) {
        return typeof value === 'string'
            && value.startsWith('/images/')
            && !value.includes('..')
            && /\.(?:avif|webp|png|jpe?g)$/i.test(value);
    }

    function validateActivity(entry, team) {
        if (!isObject(entry) || entry.published !== true) return null;
        if (!isText(entry.id, 100) || !/^[a-z0-9][a-z0-9-]*$/.test(entry.id)) return null;
        if (!isValidDate(entry.date)) return null;
        if (entry.endDate != null && !isValidDate(entry.endDate)) return null;
        if (entry.endDate && sortDate(entry.endDate) < sortDate(entry.date)) return null;
        if (!isText(entry.category, 60) || !isText(entry.title, 180) || !isText(entry.description, 1200)) return null;
        if (!isSafeImagePath(entry.image) || !isText(entry.imageAlt, 320)) return null;
        if (!Number.isInteger(entry.imageWidth) || entry.imageWidth <= 0 || entry.imageWidth > 10000) return null;
        if (!Number.isInteger(entry.imageHeight) || entry.imageHeight <= 0 || entry.imageHeight > 10000) return null;
        if (entry.displayDate !== undefined && !isText(entry.displayDate, 80)) return null;
        if (entry.badge !== undefined && !isText(entry.badge, 80)) return null;

        return {
            id: entry.id,
            team,
            date: entry.date,
            endDate: entry.endDate || null,
            displayDate: entry.displayDate || null,
            category: entry.category.trim(),
            title: entry.title.trim(),
            description: entry.description.trim(),
            image: entry.image,
            imageAlt: entry.imageAlt.trim(),
            imageWidth: entry.imageWidth,
            imageHeight: entry.imageHeight,
            badge: entry.badge ? entry.badge.trim() : null,
            badgeTone: entry.badgeTone === 'muted' ? 'muted' : 'default',
            order: Number.isFinite(entry.order) ? entry.order : 0,
            year: entry.date.slice(0, 4),
            sortDate: sortDate(entry.endDate || entry.date)
        };
    }

    function readInitialFilters() {
        const params = new URLSearchParams(window.location.search);
        const requestedTeam = params.get('team');
        const requestedYear = params.get('year');
        if (requestedTeam === 'stayup' || requestedTeam === 'firehawks') state.team = requestedTeam;
        if (/^\d{4}$/.test(requestedYear || '')) state.year = requestedYear;
    }

    function syncFilterControls() {
        ui.teamButtons.forEach((button) => {
            const active = button.dataset.teamFilter === state.team;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    function syncFilterUrl() {
        const params = new URLSearchParams();
        if (state.team !== 'all') params.set('team', state.team);
        if (state.year !== 'all') params.set('year', state.year);
        const query = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }

    async function loadSource(source) {
        const response = await fetch(source.url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Activity request failed: ${response.status}`);
        const payload = await response.json();
        if (!isObject(payload) || payload.team !== source.team || !Array.isArray(payload.activities)) {
            throw new Error('Unexpected activity data shape');
        }

        const items = [];
        let invalidCount = 0;
        payload.activities.forEach((entry) => {
            if (isObject(entry) && entry.published !== true) return;
            const activity = validateActivity(entry, source.team);
            if (activity) items.push(activity);
            else invalidCount += 1;
        });
        return { items, invalidCount };
    }

    function formatDate(value) {
        const parts = value.split('-');
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return `${parts[0]}. ${parts[1]}`;
        return `${parts[0]}. ${parts[1]}. ${parts[2]}`;
    }

    function appendActivityDate(container, activity) {
        const start = document.createElement('time');
        start.dateTime = activity.date;
        start.textContent = activity.displayDate || formatDate(activity.date);
        container.append(start);
        if (!activity.endDate) return;

        const separator = document.createElement('span');
        separator.textContent = ' — ';
        separator.setAttribute('aria-hidden', 'true');
        const end = document.createElement('time');
        end.dateTime = activity.endDate;
        end.textContent = formatDate(activity.endDate);
        container.append(separator, end);
    }

    function createCard(activity) {
        const team = TEAMS[activity.team];
        const article = document.createElement('article');
        const titleId = `activity-title-${activity.team}-${activity.id}`;
        article.className = `activity-card ${team.className}`;
        article.dataset.activityId = activity.id;
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
        appendActivityDate(date, activity);
        const title = document.createElement('h3');
        title.id = titleId;
        title.textContent = activity.title;
        const description = document.createElement('p');
        description.className = 'activity-description';
        description.textContent = activity.description;
        content.append(date, title, description);
        article.append(media, content);
        return article;
    }

    function visibleActivities() {
        return state.activities.filter((activity) => (
            (state.team === 'all' || activity.team === state.team)
            && (state.year === 'all' || activity.year === state.year)
        ));
    }

    function render() {
        const activities = visibleActivities();
        const fragment = document.createDocumentFragment();
        activities.forEach((activity) => fragment.append(createCard(activity)));
        ui.grid.replaceChildren(fragment);
        ui.empty.hidden = activities.length !== 0;
        const teamLabel = state.team === 'all' ? '전체 팀' : TEAMS[state.team].label;
        const yearLabel = state.year === 'all' ? '전체 연도' : `${state.year}년`;
        ui.result.textContent = `${teamLabel} · ${yearLabel} 활동 ${activities.length}건`;
    }

    function populateYears() {
        const years = [...new Set(state.activities.map((activity) => activity.year))]
            .sort((a, b) => b.localeCompare(a));
        const fragment = document.createDocumentFragment();
        const all = document.createElement('option');
        all.value = 'all';
        all.textContent = '전체 연도';
        fragment.append(all);
        years.forEach((year) => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = `${year}년`;
            fragment.append(option);
        });
        ui.year.replaceChildren(fragment);
        if (!years.includes(state.year)) state.year = 'all';
        ui.year.value = state.year;
    }

    function setLoading(loading) {
        ui.loading.hidden = !loading;
        ui.grid.setAttribute('aria-busy', String(loading));
        ui.teamButtons.forEach((button) => { button.disabled = loading; });
        ui.year.disabled = loading;
        if (loading) {
            ui.error.hidden = true;
            ui.warning.hidden = true;
            ui.empty.hidden = true;
            ui.result.textContent = '활동 기록을 불러오는 중입니다.';
        }
    }

    async function loadActivities() {
        setLoading(true);
        const results = await Promise.allSettled(SOURCES.map(loadSource));
        const successful = results.filter((result) => result.status === 'fulfilled');
        if (successful.length === 0) {
            state.activities = [];
            ui.grid.replaceChildren();
            ui.total.textContent = '0';
            setLoading(false);
            ui.error.hidden = false;
            ui.result.textContent = '활동 기록을 불러오지 못했습니다.';
            return;
        }

        const seen = new Set();
        const combined = [];
        let invalidCount = 0;
        successful.forEach((result) => {
            invalidCount += result.value.invalidCount;
            result.value.items.forEach((activity) => {
                const key = `${activity.team}:${activity.id}`;
                if (seen.has(key)) invalidCount += 1;
                else {
                    seen.add(key);
                    combined.push(activity);
                }
            });
        });
        combined.sort((a, b) => (
            b.sortDate.localeCompare(a.sortDate)
            || b.order - a.order
            || a.title.localeCompare(b.title, 'ko')
        ));

        state.activities = combined;
        populateYears();
        ui.total.textContent = String(combined.length);
        ui.warning.hidden = successful.length === SOURCES.length && invalidCount === 0;
        setLoading(false);
        render();
    }

    ui.teamButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const team = button.dataset.teamFilter;
            if (team !== 'all' && !TEAMS[team]) return;
            state.team = team;
            syncFilterControls();
            syncFilterUrl();
            render();
        });
    });
    ui.year.addEventListener('change', () => {
        state.year = ui.year.value;
        syncFilterUrl();
        render();
    });
    ui.retry.addEventListener('click', loadActivities);
    document.querySelectorAll('[data-current-year]').forEach((element) => {
        element.textContent = String(new Date().getFullYear());
    });
    readInitialFilters();
    syncFilterControls();
    loadActivities();
}());
