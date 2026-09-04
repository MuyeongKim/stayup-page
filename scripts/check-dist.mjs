import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectLatestActivities } from '../js/home-activity-helpers.js';
import { createStaticCollections, escapeHtml } from './render-static-content.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(directory, extension) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await collectFiles(absolutePath, extension));
    else if (path.extname(entry.name) === extension) results.push(absolutePath);
  }
  return results;
}

async function resolveReference(htmlPath, reference) {
  const cleanReference = reference.split(/[?#]/, 1)[0];
  let target = cleanReference.startsWith('/')
    ? path.join(distDir, cleanReference.slice(1))
    : path.resolve(path.dirname(htmlPath), cleanReference);
  const targetStats = await stat(target).catch(() => null);
  if (targetStats?.isDirectory() || cleanReference.endsWith('/')) target = path.join(target, 'index.html');
  return target;
}

async function checkBuiltHtml(filePath) {
  const html = await readFile(filePath, 'utf8');
  const relativeName = path.relative(distDir, filePath);
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (canonical) assert(canonical.startsWith('https://www.stayup-ai.com/'), `${relativeName} has a non-www canonical.`);

  const references = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|data:|#)/.test(reference)) continue;
    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!cleanReference || cleanReference === '/') continue;
    const shouldValidate = /\.(?:css|js|html|json|webp|png|jpe?g|gif|ico)$/i.test(cleanReference)
      || cleanReference.endsWith('/');
    if (!shouldValidate) continue;
    const target = await resolveReference(filePath, reference);
    assert(await exists(target), `${relativeName} references missing build output: ${reference}`);
  }
}

function staticCardKeys(html) {
  return [...html.matchAll(/<article\b([^>]*\bdata-activity-id="[^"]+"[^>]*)>/g)].map(match => {
    const attributes = match[1];
    const team = attributes.match(/\bdata-team="([^"]+)"/)?.[1];
    const id = attributes.match(/\bdata-activity-id="([^"]+)"/)?.[1];
    return `${team}:${id}`;
  });
}

async function checkStaticContent(sources) {
  const count = sources.reduce((total, source) => total + source.activities.length, 0);
  const all = selectLatestActivities(sources, count);
  const pages = [
    ['index.html', 'latest-activities-list', selectLatestActivities(sources, 3)],
    ['stayup/stayup-landing.html', 'stayup-activities-list', selectLatestActivities(sources.filter(source => source.team === 'stayup'), 3)],
    ['firehawks/firehawks-landing.html', 'firehawks-records-list', selectLatestActivities(sources.filter(source => source.team === 'firehawks'), 3)],
    ['activities/index.html', 'activities-grid', all],
  ];
  for (const [page, containerId, expected] of pages) {
    const html = await readFile(path.join(distDir, page), 'utf8');
    const opening = html.match(new RegExp(`<div\\b[^>]*\\bid="${containerId}"[^>]*>`))?.[0] || '';
    assert(opening.includes('data-static-content="true"') && opening.includes('aria-busy="false"'), `${page} must expose ready static content.`);
    const actualKeys = staticCardKeys(html);
    const expectedKeys = expected.map(activity => `${activity.team}:${activity.id}`);
    assert(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), `${page} static cards differ from the public manifest.`);
    assert(!html.includes('/images/activity-uploads/'), `${page} must not expose source upload paths.`);
    for (const activity of expected) {
      assert(html.includes(escapeHtml(activity.title)), `${page} must include the activity title without JavaScript: ${activity.id}`);
      if (page === 'index.html' || page === 'activities/index.html') {
        const href = `/activities/?team=${activity.team}&year=${activity.date.slice(0, 4)}#activity-${activity.team}-${activity.id}`;
        assert(html.includes(`href="${escapeHtml(href)}"`), `${page} must link to the exact activity: ${activity.id}`);
      }
      if (page === 'activities/index.html') {
        assert(html.includes(`id="activity-${activity.team}-${activity.id}"`), `Missing stable archive target: ${activity.id}`);
      }
    }
    if (page === 'activities/index.html') {
      assert(/<div\b[^>]*id="loading-state"[^>]*\bhidden(?:\s|>)/.test(html), 'The static archive must not show indefinite loading.');
      assert(html.includes(`전체 팀 · 전체 연도 활동 ${count}건`), 'The static archive must include its result count.');
    }
  }
  const firehawks = await readFile(path.join(distDir, 'firehawks/firehawks-landing.html'), 'utf8');
  assert(/id="firehawks-schedule-content"[^>]*data-static-content="true"/.test(firehawks), 'The schedule must include a static fallback.');
}

function checkStaticEscapingAndVisibility() {
  const activity = {
    id: 'public-example', published: true, date: '2026-09-01',
    category: '훈련', title: '<script>alert("title")</script>', description: '<img src=x onerror="alert(1)">',
    image: '/images/example.webp', imageAlt: '사진 "설명" & 정보', imageWidth: 100, imageHeight: 100,
  };
  const hiddenActivity = { ...activity, id: 'unpublished-example', published: false };
  const schedule = { id: 'ongoing-example', published: true, date: '2026-09-04', endDate: '2026-09-05', title: '<script>schedule</script>', location: '<행사장>' };
  const collections = createStaticCollections([
    { team: 'stayup', activities: [activity, hiddenActivity] },
    { team: 'firehawks', activities: [] },
  ], [
    { ...schedule, id: 'private-schedule', published: false },
    { ...schedule, id: 'past-schedule', date: '2026-09-03', endDate: '2026-09-04' },
    { ...schedule, id: 'later-schedule', date: '2026-10', endDate: '2026-10' },
    schedule,
  ], new Date('2026-09-04T15:00:00Z'));
  const rendered = [collections.home, collections.stayup, collections.firehawks, collections.archive, collections.schedule].join('');
  assert(!rendered.includes('unpublished-example') && !rendered.includes('private-schedule'), 'Static rendering must exclude unpublished activities and schedules.');
  assert(!rendered.includes('<script>') && !rendered.includes('<img src=x'), 'Static content must escape HTML from manifests.');
  assert(rendered.includes('&lt;script&gt;') && rendered.includes('&quot;설명&quot; &amp; 정보'), 'Static content must preserve escaped text and attributes.');
  assert(collections.schedule.includes('ongoing-example') && !collections.schedule.includes('past-schedule') && !collections.schedule.includes('later-schedule'), 'Static schedules must use Seoul dates and prefer an ongoing event.');
  assert(collections.count === 1, 'Static counts must exclude unpublished records.');
}

async function main() {
  const requiredFiles = [
    'index.html',
    'stayup/stayup-landing.html',
    'firehawks/firehawks-landing.html',
    'activities/index.html',
    'admin/index.html',
    'data/stayup-activities.json',
    'data/firehawks-activities.json',
    'data/firehawks-schedules.json',
    'robots.txt',
    'sitemap.xml'
  ];
  for (const relativePath of requiredFiles) {
    assert(await exists(path.join(distDir, relativePath)), `Missing required build output: ${relativePath}`);
  }

  const publicSources = [];
  for (const dataFile of ['stayup-activities.json', 'firehawks-activities.json']) {
    const content = JSON.parse(await readFile(path.join(distDir, 'data', dataFile), 'utf8'));
    publicSources.push(content);
    assert(Array.isArray(content.activities), `${dataFile} activities must be an array.`);
    const source = JSON.parse(await readFile(path.join(rootDir, 'data', dataFile), 'utf8'));
    assert(JSON.stringify(content.activities.map(activity => activity.id)) === JSON.stringify(source.activities.filter(activity => activity.published === true).map(activity => activity.id)), `${dataFile} must contain every public record and no unpublished record.`);
    for (const activity of content.activities) {
      assert(activity.published === true, `${dataFile} contains an unpublished activity.`);
      const imagePath = path.join(distDir, activity.image.replace(/^\//, ''));
      assert(await exists(imagePath), `${dataFile} references missing built image: ${activity.image}`);
    }
  }

  const scheduleContent = JSON.parse(
    await readFile(path.join(distDir, 'data', 'firehawks-schedules.json'), 'utf8')
  );
  assert(scheduleContent.team === 'firehawks', 'firehawks-schedules.json team must be firehawks.');
  assert(Array.isArray(scheduleContent.schedules), 'firehawks-schedules.json schedules must be an array.');
  for (const schedule of scheduleContent.schedules) {
    assert(schedule.published === true, 'firehawks-schedules.json contains an unpublished schedule.');
  }

  assert(!await exists(path.join(distDir, 'images', 'activity-uploads')), 'Raw activity uploads must not be published.');
  await checkStaticContent(publicSources);
  checkStaticEscapingAndVisibility();
  const htmlFiles = await collectFiles(distDir, '.html');
  for (const htmlFile of htmlFiles) await checkBuiltHtml(htmlFile);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
