import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

  for (const dataFile of ['stayup-activities.json', 'firehawks-activities.json']) {
    const content = JSON.parse(await readFile(path.join(distDir, 'data', dataFile), 'utf8'));
    assert(Array.isArray(content.activities), `${dataFile} activities must be an array.`);
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
  const htmlFiles = await collectFiles(distDir, '.html');
  for (const htmlFile of htmlFiles) await checkBuiltHtml(htmlFile);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
