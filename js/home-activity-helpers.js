const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;
const TEAMS = Object.freeze({
    stayup: { label: 'Stay-Up', className: 'team-stayup' },
    firehawks: { label: 'FireHawks', className: 'team-firehawks' }
});

function formatDate(value) {
    const match = DATE_PATTERN.exec(value || '');
    if (!match) throw new TypeError('activity date must use YYYY, YYYY-MM or YYYY-MM-DD.');
    if (!match[2]) return match[1];
    if (!match[3]) return `${match[1]}. ${match[2]}`;
    return `${match[1]}. ${match[2]}. ${match[3]}`;
}

function endOfPeriodTimestamp(value) {
    const match = DATE_PATTERN.exec(value || '');
    if (!match) throw new TypeError('activity date must use YYYY, YYYY-MM or YYYY-MM-DD.');

    const year = Number(match[1]);
    const month = match[2] ? Number(match[2]) : 12;
    const day = match[3]
        ? Number(match[3])
        : new Date(Date.UTC(year, month, 0)).getUTCDate();
    const timestamp = Date.UTC(year, month - 1, day, 23, 59, 59);
    const parsed = new Date(timestamp);

    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
        throw new TypeError('activity date is invalid.');
    }

    return timestamp;
}

export function selectLatestActivities(sources, limit = 3) {
    if (!Array.isArray(sources)) throw new TypeError('sources must be an array.');
    if (!Number.isInteger(limit) || limit < 0) throw new TypeError('limit must be a non-negative integer.');

    const activities = sources.flatMap((source) => {
        if (!source || typeof source.team !== 'string' || !source.team.trim()) {
            throw new TypeError('source team must be a non-empty string.');
        }
        if (!Array.isArray(source.activities)) throw new TypeError('source activities must be an array.');

        return source.activities.map((activity) => ({ ...activity, team: source.team }));
    });

    const compareActivities = (left, right) => {
        const dateDifference = endOfPeriodTimestamp(right.endDate || right.date)
            - endOfPeriodTimestamp(left.endDate || left.date);
        if (dateDifference !== 0) return dateDifference;

        const orderDifference = (Number(right.order) || 0) - (Number(left.order) || 0);
        if (orderDifference !== 0) return orderDifference;
        return String(left.id || '').localeCompare(String(right.id || ''), 'ko');
    };

    const sortedActivities = activities.sort(compareActivities);
    const representedTeams = [...new Set(sortedActivities.map((activity) => activity.team))];
    if (limit < representedTeams.length) return sortedActivities.slice(0, limit);

    const selected = representedTeams.map((team) => sortedActivities.find((activity) => activity.team === team));
    const selectedSet = new Set(selected);
    for (const activity of sortedActivities) {
        if (selected.length >= limit) break;
        if (!selectedSet.has(activity)) {
            selected.push(activity);
            selectedSet.add(activity);
        }
    }

    return selected.sort(compareActivities).slice(0, limit);
}

export function createActivityViewModel(activity) {
    if (!activity || !TEAMS[activity.team]) throw new TypeError('activity team is invalid.');

    const team = TEAMS[activity.team];
    const dateLabel = activity.displayDate || (activity.endDate
        ? `${formatDate(activity.date)} — ${formatDate(activity.endDate)}`
        : formatDate(activity.date));

    return {
        id: activity.id,
        team: activity.team,
        teamLabel: team.label,
        teamClass: team.className,
        dateLabel,
        dateTime: activity.date,
        category: activity.category,
        title: activity.title,
        description: activity.description,
        image: activity.image,
        imageAlt: activity.imageAlt,
        imageWidth: activity.imageWidth,
        imageHeight: activity.imageHeight,
        archiveHref: `/activities/?team=${activity.team}&year=${activity.date.slice(0, 4)}`
    };
}
