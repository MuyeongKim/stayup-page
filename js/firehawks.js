/**
 * FireHawks page enhancements.
 * Navigation behavior is shared through common.js.
 */

const FIREHAWKS_SCHEDULE_DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const FIREHAWKS_SCHEDULE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
const FIREHAWKS_SCHEDULE_TIME_ZONE = 'Asia/Seoul';

function isPlainObject(value) {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function readScheduleString(value, fieldName, maxLength, optional = false) {
    if (optional && (value === undefined || value === null || value === '')) return '';
    if (typeof value !== 'string') {
        throw new TypeError(`${fieldName} 항목은 문자열이어야 합니다.`);
    }

    const normalized = value.trim();
    if (!normalized && !optional) throw new TypeError(`${fieldName} 항목이 비어 있습니다.`);
    if (normalized.length > maxLength) throw new TypeError(`${fieldName} 항목이 너무 깁니다.`);
    return normalized;
}

function parseScheduleDate(value, usePeriodEnd = false) {
    const match = FIREHAWKS_SCHEDULE_DATE_PATTERN.exec(value);
    if (!match) throw new TypeError('날짜는 YYYY, YYYY-MM 또는 YYYY-MM-DD 형식이어야 합니다.');

    const year = Number(match[1]);
    const hasMonth = Boolean(match[2]);
    const hasDay = Boolean(match[3]);
    const month = hasMonth ? Number(match[2]) : (usePeriodEnd ? 12 : 1);
    const day = hasDay
        ? Number(match[3])
        : (usePeriodEnd ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1);

    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        throw new TypeError('유효하지 않은 날짜입니다.');
    }

    const timestamp = Date.UTC(year, month - 1, day);
    const parsed = new Date(timestamp);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        throw new TypeError('유효하지 않은 날짜입니다.');
    }

    return {
        timestamp,
        precision: hasDay ? 'day' : (hasMonth ? 'month' : 'year'),
        year,
        month,
        day
    };
}

function validateSchedule(rawSchedule) {
    if (!isPlainObject(rawSchedule)) throw new TypeError('출전 일정 항목은 객체여야 합니다.');
    if (typeof rawSchedule.published !== 'boolean') {
        throw new TypeError('published 항목은 true 또는 false여야 합니다.');
    }

    const id = readScheduleString(rawSchedule.id, 'id', 80);
    if (!FIREHAWKS_SCHEDULE_ID_PATTERN.test(id)) {
        throw new TypeError('id 항목은 영문 소문자, 숫자와 하이픈만 사용할 수 있습니다.');
    }

    const date = readScheduleString(rawSchedule.date, 'date', 10);
    const startBoundary = parseScheduleDate(date, false);
    const defaultEndBoundary = parseScheduleDate(date, true);
    const endDate = readScheduleString(rawSchedule.endDate, 'endDate', 10, true);
    const endBoundary = endDate ? parseScheduleDate(endDate, true) : defaultEndBoundary;
    if (endBoundary.timestamp < startBoundary.timestamp) {
        throw new TypeError('endDate는 date보다 빠를 수 없습니다.');
    }

    const order = rawSchedule.order === undefined || rawSchedule.order === null || rawSchedule.order === ''
        ? 0
        : Number(rawSchedule.order);
    if (!Number.isInteger(order) || order < 0 || order > 9999) {
        throw new TypeError('order 항목은 0부터 9999 사이의 정수여야 합니다.');
    }

    return {
        id,
        date,
        endDate,
        displayDate: readScheduleString(rawSchedule.displayDate, 'displayDate', 40, true),
        title: readScheduleString(rawSchedule.title, 'title', 140),
        location: readScheduleString(rawSchedule.location, 'location', 120),
        division: readScheduleString(rawSchedule.division, 'division', 80, true),
        description: readScheduleString(rawSchedule.description, 'description', 600, true),
        order,
        published: rawSchedule.published,
        startBoundary,
        endBoundary
    };
}

function validateScheduleManifest(payload) {
    if (!isPlainObject(payload) || payload.team !== 'firehawks' || !Array.isArray(payload.schedules)) {
        throw new TypeError('출전 일정 데이터의 최상위 형식이 올바르지 않습니다.');
    }

    const ids = new Set();
    const schedules = payload.schedules.map((rawSchedule) => {
        const schedule = validateSchedule(rawSchedule);
        if (ids.has(schedule.id)) throw new TypeError(`중복된 출전 일정 ID가 있습니다: ${schedule.id}`);
        ids.add(schedule.id);
        return schedule;
    });
    return schedules;
}

function getKoreaToday() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: FIREHAWKS_SCHEDULE_TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
}

function formatScheduleDate(value) {
    const parsed = parseScheduleDate(value);
    if (parsed.precision === 'year') return `${parsed.year}년`;
    if (parsed.precision === 'month') return `${parsed.year}년 ${parsed.month}월`;
    return new Intl.DateTimeFormat('ko-KR', {
        timeZone: FIREHAWKS_SCHEDULE_TIME_ZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short'
    }).format(new Date(parsed.timestamp));
}

function getScheduleDateLabel(schedule) {
    if (schedule.displayDate) return schedule.displayDate;
    if (!schedule.endDate) return formatScheduleDate(schedule.date);
    return `${formatScheduleDate(schedule.date)} — ${formatScheduleDate(schedule.endDate)}`;
}

function pickNextSchedule(schedules, today) {
    const eligible = schedules.filter(schedule => schedule.published && schedule.endBoundary.timestamp >= today);
    eligible.sort((left, right) => {
        const leftOngoing = left.startBoundary.timestamp <= today;
        const rightOngoing = right.startBoundary.timestamp <= today;
        if (leftOngoing !== rightOngoing) return leftOngoing ? -1 : 1;
        if (leftOngoing && left.endBoundary.timestamp !== right.endBoundary.timestamp) {
            return left.endBoundary.timestamp - right.endBoundary.timestamp;
        }
        if (left.startBoundary.timestamp !== right.startBoundary.timestamp) {
            return left.startBoundary.timestamp - right.startBoundary.timestamp;
        }
        if (right.order !== left.order) return right.order - left.order;
        return left.id.localeCompare(right.id, 'ko');
    });
    return eligible[0] || null;
}

function getScheduleStatusLabel(schedule, today) {
    if (schedule.startBoundary.precision !== 'day') return '출전 예정';
    if (schedule.startBoundary.timestamp <= today && schedule.endBoundary.timestamp >= today) {
        const isSingleDay = schedule.startBoundary.timestamp === schedule.endBoundary.timestamp;
        return isSingleDay ? '오늘 출전' : '진행 중';
    }
    const daysUntil = Math.round((schedule.startBoundary.timestamp - today) / 86_400_000);
    return `D-${daysUntil}`;
}

function showScheduleStatus(container, message, state) {
    const status = document.createElement('p');
    status.className = 'schedule-load-status';
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
    container.replaceChildren(status);
    container.dataset.loadState = state;
    container.setAttribute('aria-busy', 'false');
}

function createScheduleDetails(schedule, today) {
    const details = document.createElement('article');
    const titleId = `firehawks-schedule-title-${schedule.id}`;
    details.className = 'schedule-details';
    details.setAttribute('aria-labelledby', titleId);

    const statusRow = document.createElement('div');
    statusRow.className = 'schedule-status-row';
    const statusChip = document.createElement('span');
    statusChip.className = 'schedule-status-chip';
    statusChip.textContent = getScheduleStatusLabel(schedule, today);
    const date = document.createElement('time');
    date.className = 'schedule-date';
    date.dateTime = schedule.date;
    date.textContent = getScheduleDateLabel(schedule);
    statusRow.append(statusChip, date);

    const title = document.createElement('h3');
    title.id = titleId;
    title.textContent = schedule.title;

    const meta = document.createElement('dl');
    meta.className = 'schedule-meta';
    const locationRow = document.createElement('div');
    const locationTerm = document.createElement('dt');
    locationTerm.textContent = '장소';
    const locationValue = document.createElement('dd');
    locationValue.textContent = schedule.location || '추후 안내';
    locationRow.append(locationTerm, locationValue);
    meta.append(locationRow);

    if (schedule.division) {
        const divisionRow = document.createElement('div');
        const divisionTerm = document.createElement('dt');
        divisionTerm.textContent = '참가 부문';
        const divisionValue = document.createElement('dd');
        divisionValue.textContent = schedule.division;
        divisionRow.append(divisionTerm, divisionValue);
        meta.append(divisionRow);
    }

    details.append(statusRow, title, meta);
    if (schedule.description) {
        const description = document.createElement('p');
        description.className = 'schedule-description';
        description.textContent = schedule.description;
        details.append(description);
    }
    return details;
}

async function initFireHawksSchedule() {
    const container = document.getElementById('firehawks-schedule-content');
    if (!container) return;

    try {
        const response = await fetch('/data/firehawks-schedules.json', {
            cache: 'no-cache',
            headers: { Accept: 'application/json' }
        });
        if (!response.ok) throw new Error(`출전 일정을 불러오지 못했습니다. (${response.status})`);

        const schedules = validateScheduleManifest(await response.json());
        const today = getKoreaToday();
        const nextSchedule = pickNextSchedule(schedules, today);
        if (!nextSchedule) {
            const hasPublishedSchedule = schedules.some(schedule => schedule.published);
            showScheduleStatus(
                container,
                hasPublishedSchedule
                    ? '최근 출전 일정이 종료되었습니다. 다음 일정은 확정되는 대로 안내하겠습니다.'
                    : '현재 등록된 출전 일정이 없습니다. 공식 일정이 확정되는 대로 안내하겠습니다.',
                hasPublishedSchedule ? 'past' : 'empty'
            );
            return;
        }

        container.replaceChildren(createScheduleDetails(nextSchedule, today));
        container.dataset.loadState = 'ready';
        container.setAttribute('aria-busy', 'false');
    } catch (error) {
        console.error('[FireHawks] 출전 일정을 표시하지 못했습니다.', error);
        showScheduleStatus(container, '출전 일정을 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.', 'error');
    }
}

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
    initFireHawksSchedule();
});
