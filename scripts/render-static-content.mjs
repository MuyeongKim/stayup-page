import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createActivityViewModel, selectLatestActivities } from '../js/home-activity-helpers.js';

export const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const time = (date, label) => `<time datetime="${escapeHtml(date)}">${escapeHtml(label)}</time>`;
const formatDate = date => date.split('-').join('. ');
const dateLabel = activity => activity.displayDate || (activity.endDate
  ? `${formatDate(activity.date)} — ${formatDate(activity.endDate)}`
  : formatDate(activity.date));
const activityHref = activity => `/activities/?team=${activity.team}&year=${activity.date.slice(0, 4)}#activity-${activity.team}-${activity.id}`;
const image = activity => `<img src="${escapeHtml(activity.image)}" alt="${escapeHtml(activity.imageAlt)}" width="${escapeHtml(activity.imageWidth)}" height="${escapeHtml(activity.imageHeight)}" loading="lazy" decoding="async">`;

function periodBoundary(value, end = false) {
  const [year, rawMonth, rawDay] = value.split('-').map(Number);
  const month = rawMonth || (end ? 12 : 1);
  const day = rawDay || (end ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1);
  return Date.UTC(year, month - 1, day);
}

function activityDataAttributes(activity) {
  const attributes = {
    'data-team': activity.team,
    'data-activity-id': activity.id,
    'data-date': activity.date,
    'data-year': activity.date.slice(0, 4),
    'data-order': activity.order || 0,
    'data-sort-date': new Date(periodBoundary(activity.endDate || activity.date, true)).toISOString().slice(0, 10),
    'data-title': activity.title,
  };
  if (activity.endDate) attributes['data-end-date'] = activity.endDate;
  return Object.entries(attributes).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ');
}

function renderHomeCard(activity) {
  const view = createActivityViewModel(activity);
  const titleId = `latest-title-${activity.team}-${activity.id}`;
  return `<article class="latest-activity-card ${view.teamClass}" ${activityDataAttributes(activity)} aria-labelledby="${escapeHtml(titleId)}">
    <a class="latest-activity-link" href="${escapeHtml(activityHref(activity))}">
      <div class="latest-activity-media">${image(activity)}</div>
      <div class="latest-activity-body">
        <div class="latest-activity-meta"><span class="latest-team-label">${escapeHtml(view.teamLabel)}</span>${time(view.dateTime, view.dateLabel)}</div>
        <p class="latest-activity-category">${escapeHtml(view.category)}</p>
        <h3 id="${escapeHtml(titleId)}">${escapeHtml(view.title)}</h3>
        <p class="latest-activity-description">${escapeHtml(view.description)}</p>
        <span class="latest-activity-more">이 활동 보기 →</span>
      </div>
    </a>
  </article>`;
}

function renderStayUpCard(activity) {
  const titleId = `stayup-activity-title-${activity.id}`;
  return `<article class="activity-card" ${activityDataAttributes(activity)} aria-labelledby="${escapeHtml(titleId)}">
    <div class="activity-media">${image(activity)}<span class="activity-type">${escapeHtml(activity.category)}</span></div>
    <div class="activity-content">${time(activity.date, dateLabel(activity))}<h3 id="${escapeHtml(titleId)}">${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description)}</p></div>
  </article>`;
}

function renderFireHawksCard(activity) {
  const titleId = `firehawks-record-title-${activity.id}`;
  const badge = activity.badge ? `<span class="record-badge${activity.badgeTone === 'muted' ? ' record-badge-muted' : ''}">${escapeHtml(activity.badge)}</span>` : '';
  return `<article class="record-card" ${activityDataAttributes(activity)} aria-labelledby="${escapeHtml(titleId)}">
    <div class="record-image">${image(activity)}${badge}</div>
    <div class="record-body">${time(activity.endDate || activity.date, dateLabel(activity))}<h3 id="${escapeHtml(titleId)}">${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description)}</p></div>
  </article>`;
}

function renderArchiveCard(activity) {
  const view = createActivityViewModel(activity);
  const titleId = `activity-title-${activity.team}-${activity.id}`;
  const badge = activity.badge ? `<span class="activity-badge${activity.badgeTone === 'muted' ? ' is-muted' : ''}">${escapeHtml(activity.badge)}</span>` : '';
  return `<article id="activity-${escapeHtml(activity.team)}-${escapeHtml(activity.id)}" class="activity-card ${view.teamClass}" ${activityDataAttributes(activity)} tabindex="-1" aria-labelledby="${escapeHtml(titleId)}">
    <div class="activity-media">${image(activity)}<div class="activity-labels"><span class="team-label">${escapeHtml(view.teamLabel)}</span><span class="category-label">${escapeHtml(activity.category)}</span></div>${badge}</div>
    <div class="activity-content"><p class="activity-date">${time(activity.date, dateLabel(activity))}</p><h3 id="${escapeHtml(titleId)}">${escapeHtml(activity.title)}</h3><p class="activity-description">${escapeHtml(activity.description)}</p><a class="activity-share-link" href="${escapeHtml(activityHref(activity))}">이 활동 링크</a></div>
  </article>`;
}

function renderSchedule(schedules, now) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const parts = Object.fromEntries(today.map(part => [part.type, part.value]));
  const timestamp = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const upcoming = schedules.filter(schedule => periodBoundary(schedule.endDate || schedule.date, true) >= timestamp)
    .sort((left, right) => {
      const leftStart = periodBoundary(left.date);
      const rightStart = periodBoundary(right.date);
      const leftOngoing = leftStart <= timestamp;
      const rightOngoing = rightStart <= timestamp;
      if (leftOngoing !== rightOngoing) return leftOngoing ? -1 : 1;
      if (leftOngoing) {
        const endDifference = periodBoundary(left.endDate || left.date, true) - periodBoundary(right.endDate || right.date, true);
        if (endDifference) return endDifference;
      }
      return leftStart - rightStart || (right.order || 0) - (left.order || 0) || left.id.localeCompare(right.id, 'ko');
    });
  const schedule = upcoming[0];
  if (!schedule) return `<p class="schedule-load-status" role="status">${schedules.length
    ? '최근 출전 일정이 종료되었습니다. 다음 일정은 확정되는 대로 안내하겠습니다.'
    : '현재 등록된 출전 일정이 없습니다. 공식 일정이 확정되는 대로 안내하겠습니다.'}</p>`;
  const titleId = `firehawks-schedule-title-${schedule.id}`;
  const division = schedule.division ? `<div><dt>참가 부문</dt><dd>${escapeHtml(schedule.division)}</dd></div>` : '';
  const description = schedule.description ? `<p class="schedule-description">${escapeHtml(schedule.description)}</p>` : '';
  return `<article class="schedule-details" data-schedule-id="${escapeHtml(schedule.id)}" aria-labelledby="${escapeHtml(titleId)}">
    <div class="schedule-status-row"><span class="schedule-status-chip">등록된 출전 일정</span><time class="schedule-date" datetime="${escapeHtml(schedule.date)}">${escapeHtml(dateLabel(schedule))}</time></div>
    <h3 id="${escapeHtml(titleId)}">${escapeHtml(schedule.title)}</h3><dl class="schedule-meta"><div><dt>장소</dt><dd>${escapeHtml(schedule.location)}</dd></div>${division}</dl>${description}
  </article>`;
}

export function createStaticCollections(sources, schedules, now = new Date()) {
  // Accept only the public records, even when called independently of the build.
  const publishedSources = sources.map(source => ({
    team: source.team,
    activities: source.activities.filter(activity => activity.published === true),
  }));
  const count = publishedSources.reduce((total, source) => total + source.activities.length, 0);
  const all = selectLatestActivities(publishedSources, count);
  const forTeam = team => selectLatestActivities(publishedSources.filter(source => source.team === team), 3);
  const cardsOrEmpty = (cards, className, message) => cards.join('\n') || `<p class="${className}" role="status">${message}</p>`;
  return {
    home: cardsOrEmpty(selectLatestActivities(publishedSources, 3).map(renderHomeCard), 'activity-load-status', '현재 게시된 활동 내역이 없습니다.'),
    stayup: cardsOrEmpty(forTeam('stayup').map(renderStayUpCard), 'activity-load-status', '현재 게시된 활동 내역이 없습니다.'),
    firehawks: cardsOrEmpty(forTeam('firehawks').map(renderFireHawksCard), 'record-load-status', '현재 게시된 대회 기록이 없습니다.'),
    archive: all.map(renderArchiveCard).join('\n'),
    schedule: renderSchedule(schedules.filter(schedule => schedule.published === true), now),
    count,
    years: [...new Set(all.map(activity => activity.date.slice(0, 4)))].sort().reverse(),
  };
}

function updateElement(html, id, content, attributes = {}) {
  const opening = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bid="${id}"[^>]*>`, 'i').exec(html);
  if (!opening) throw new Error(`Static content target is missing: ${id}`);
  const tag = opening[1];
  const tags = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tags.lastIndex = opening.index + opening[0].length;
  let depth = 1;
  let closing;
  while ((closing = tags.exec(html))) {
    depth += closing[0].startsWith('</') ? -1 : 1;
    if (depth === 0) break;
  }
  if (!closing) throw new Error(`Static content target is not closed: ${id}`);
  let openingTag = opening[0];
  for (const [name, value] of Object.entries(attributes)) {
    openingTag = openingTag.replace(new RegExp(`\\s${name}(?:="[^"]*")?(?=[\\s>])`, 'g'), '');
    if (value !== false) openingTag = openingTag.replace(/>$/, value === true ? ` ${name}>` : ` ${name}="${escapeHtml(value)}">`);
  }
  const inner = content === null ? html.slice(opening.index + opening[0].length, closing.index) : content;
  return html.slice(0, opening.index) + openingTag + inner + html.slice(closing.index);
}

export async function renderStaticContent(outputDir, now = new Date()) {
  // Read dist/data only: source uploads and unpublished records never reach HTML.
  const sources = await Promise.all(['stayup', 'firehawks'].map(async team => JSON.parse(
    await readFile(path.join(outputDir, 'data', `${team}-activities.json`), 'utf8'),
  )));
  const schedules = JSON.parse(await readFile(path.join(outputDir, 'data', 'firehawks-schedules.json'), 'utf8'));
  const collections = createStaticCollections(sources, schedules.schedules, now);
  const staticAttributes = { 'data-static-content': 'true', 'aria-busy': 'false' };
  const pages = [
    ['index.html', [['latest-activities-list', collections.home]]],
    ['stayup/stayup-landing.html', [['stayup-activities-list', collections.stayup]]],
    ['firehawks/firehawks-landing.html', [['firehawks-records-list', collections.firehawks], ['firehawks-schedule-content', collections.schedule]]],
    ['activities/index.html', [['activities-grid', collections.archive]]],
  ];
  for (const [file, targets] of pages) {
    const filePath = path.join(outputDir, file);
    let html = await readFile(filePath, 'utf8');
    for (const [id, content] of targets) html = updateElement(html, id, content, staticAttributes);
    if (file === 'activities/index.html') {
      html = updateElement(html, 'total-activity-count', String(collections.count));
      html = updateElement(html, 'result-count', `전체 팀 · 전체 연도 활동 ${collections.count}건`);
      html = updateElement(html, 'year-filter', '<option value="all">전체 연도</option>' + collections.years.map(year => `<option value="${year}">${year}년</option>`).join(''));
      html = updateElement(html, 'loading-state', null, { hidden: true });
      html = updateElement(html, 'empty-state', null, { hidden: collections.count > 0 });
    }
    await writeFile(filePath, html);
  }
}
