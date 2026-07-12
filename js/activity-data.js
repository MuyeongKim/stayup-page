(function initializeActivityDataStore(windowObject) {
    'use strict';

    const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
    const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;
    const IMAGE_PATTERN = /^\/images\/[^?#]+\.(?:avif|gif|jpe?g|png|webp)$/i;
    const BADGE_TONES = new Set(['default', 'muted']);

    function isPlainObject(value) {
        return Object.prototype.toString.call(value) === '[object Object]';
    }

    function readString(value, fieldName, maxLength, options = {}) {
        if (typeof value !== 'string') {
            if (options.optional && (value === undefined || value === null || value === '')) return '';
            throw new TypeError(`${fieldName} 항목은 문자열이어야 합니다.`);
        }

        const normalized = value.trim();
        if (!normalized && !options.optional) {
            throw new TypeError(`${fieldName} 항목이 비어 있습니다.`);
        }
        if (normalized.length > maxLength) {
            throw new TypeError(`${fieldName} 항목이 너무 깁니다.`);
        }

        return normalized;
    }

    function parseDate(value, usePeriodEnd = false) {
        const match = DATE_PATTERN.exec(value);
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

        const timestamp = Date.UTC(year, month - 1, day, usePeriodEnd ? 23 : 0, usePeriodEnd ? 59 : 0, usePeriodEnd ? 59 : 0);
        const parsed = new Date(timestamp);
        if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
            throw new TypeError('유효하지 않은 날짜입니다.');
        }

        return timestamp;
    }

    function validateImagePath(value) {
        const image = readString(value, 'image', 300);
        if (!IMAGE_PATTERN.test(image) || image.includes('\\') || image.split('/').includes('..')) {
            throw new TypeError('image 항목은 /images/ 아래의 이미지 경로여야 합니다.');
        }
        return image;
    }

    function readDimension(value, fieldName) {
        const number = Number(value);
        if (!Number.isInteger(number) || number < 1 || number > 10000) {
            throw new TypeError(`${fieldName} 항목은 1부터 10000 사이의 정수여야 합니다.`);
        }
        return number;
    }

    function validateActivity(rawActivity) {
        if (!isPlainObject(rawActivity)) throw new TypeError('활동 항목은 객체여야 합니다.');
        if (rawActivity.published === false) return null;
        if (rawActivity.published !== true) throw new TypeError('published 항목은 true 또는 false여야 합니다.');

        const id = readString(rawActivity.id, 'id', 80);
        if (!ID_PATTERN.test(id)) throw new TypeError('id 항목은 영문 소문자, 숫자와 하이픈만 사용할 수 있습니다.');

        const date = readString(rawActivity.date, 'date', 10);
        parseDate(date);

        const endDate = readString(rawActivity.endDate, 'endDate', 10, { optional: true });
        if (endDate) {
            parseDate(endDate);
            if (parseDate(endDate, true) < parseDate(date, false)) {
                throw new TypeError('endDate는 date보다 빠를 수 없습니다.');
            }
        }

        const displayDate = readString(rawActivity.displayDate, 'displayDate', 40, { optional: true });
        const badge = readString(rawActivity.badge, 'badge', 50, { optional: true });
        const badgeTone = readString(rawActivity.badgeTone, 'badgeTone', 20, { optional: true }) || 'default';
        if (!BADGE_TONES.has(badgeTone)) throw new TypeError('badgeTone 항목이 올바르지 않습니다.');

        const order = rawActivity.order === undefined || rawActivity.order === null || rawActivity.order === ''
            ? 0
            : Number(rawActivity.order);
        if (!Number.isInteger(order) || order < 0 || order > 9999) {
            throw new TypeError('order 항목은 0부터 9999 사이의 정수여야 합니다.');
        }

        return {
            id,
            date,
            endDate,
            displayDate,
            category: readString(rawActivity.category, 'category', 60),
            title: readString(rawActivity.title, 'title', 140),
            description: readString(rawActivity.description, 'description', 600),
            image: validateImagePath(rawActivity.image),
            imageAlt: readString(rawActivity.imageAlt, 'imageAlt', 180),
            imageWidth: readDimension(rawActivity.imageWidth, 'imageWidth'),
            imageHeight: readDimension(rawActivity.imageHeight, 'imageHeight'),
            badge,
            badgeTone,
            order,
            published: true
        };
    }

    function sortActivities(activities) {
        return [...activities].sort((left, right) => {
            const dateDifference = parseDate(right.endDate || right.date, true) - parseDate(left.endDate || left.date, true);
            if (dateDifference !== 0) return dateDifference;
            if (right.order !== left.order) return right.order - left.order;
            return left.id.localeCompare(right.id, 'ko');
        });
    }

    function validatePayload(payload, expectedTeam) {
        if (!isPlainObject(payload) || payload.team !== expectedTeam || !Array.isArray(payload.activities)) {
            throw new TypeError('활동 데이터의 최상위 형식이 올바르지 않습니다.');
        }

        const activities = [];
        let invalidCount = 0;
        let unpublishedCount = 0;

        payload.activities.forEach((rawActivity, index) => {
            try {
                const activity = validateActivity(rawActivity);
                if (activity) {
                    activities.push(activity);
                } else {
                    unpublishedCount += 1;
                }
            } catch (error) {
                invalidCount += 1;
                console.warn(`[활동 데이터] ${expectedTeam}의 ${index + 1}번째 항목을 건너뜁니다.`, error);
            }
        });

        if (payload.activities.length > 0 && activities.length === 0 && invalidCount > 0 && unpublishedCount === 0) {
            throw new TypeError('게시 가능한 활동 데이터가 모두 유효하지 않습니다.');
        }

        return sortActivities(activities);
    }

    async function loadActivities(url, expectedTeam) {
        const response = await fetch(url, {
            cache: 'no-cache',
            headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`활동 데이터를 불러오지 못했습니다. (${response.status})`);
        }

        const payload = await response.json();
        return validatePayload(payload, expectedTeam);
    }

    function formatDate(date) {
        const match = DATE_PATTERN.exec(date);
        if (!match) return date;
        if (!match[2]) return match[1];
        if (!match[3]) return `${match[1]}. ${match[2]}`;
        return `${match[1]}. ${match[2]}. ${match[3]}`;
    }

    function getDateLabel(activity) {
        if (activity.displayDate) return activity.displayDate;
        if (!activity.endDate) return formatDate(activity.date);
        return `${formatDate(activity.date)} — ${formatDate(activity.endDate)}`;
    }

    windowObject.ActivityDataStore = Object.freeze({
        formatDate,
        getDateLabel,
        loadActivities,
        sortActivities,
        validatePayload
    });
}(window));
