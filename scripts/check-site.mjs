import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  contentFiles,
  readAndValidateContent,
  readAndValidateSchedule,
  scheduleFiles,
  validateReferencedImages
} from './validate-content.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function collectFiles(directory, extensions) {
  const results = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(absolutePath, extensions));
    } else if (extensions.has(path.extname(entry.name))) {
      results.push(absolutePath);
    }
  }
  return results;
}

function checkJavaScript(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: rootDir,
    encoding: 'utf8'
  });
  assert(result.status === 0, result.stderr || `JavaScript syntax check failed: ${filePath}`);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkHtml(filePath) {
  const html = await readFile(filePath, 'utf8');
  const relativeName = path.relative(rootDir, filePath);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert(new Set(ids).size === ids.length, `${relativeName} contains duplicate id attributes.`);
  assert(!/\son[a-z]+\s*=/i.test(html), `${relativeName} contains an inline event handler.`);
  assert(!/(?:href|src)="#"/.test(html), `${relativeName} contains an empty fragment link.`);

  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)?.[1];
  if (canonical) {
    assert(canonical.startsWith('https://www.stayup-ai.com/'), `${relativeName} canonical must use www.stayup-ai.com.`);
  }

  const references = [...html.matchAll(/\s(?:src|href)="([^"]+)"/g)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|mailto:|tel:|data:|#)/.test(reference)) continue;
    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!cleanReference || cleanReference === '/') continue;
    const shouldValidate = /\.(?:css|js|html|json|webp|png|jpe?g|gif|ico)$/i.test(cleanReference)
      || cleanReference.endsWith('/');
    if (!shouldValidate) continue;
    let target = cleanReference.startsWith('/')
      ? path.join(rootDir, cleanReference.slice(1))
      : path.resolve(path.dirname(filePath), cleanReference);
    if (target.endsWith(path.sep)) target = path.join(target, 'index.html');
    const targetStats = await stat(target).catch(() => null);
    if (targetStats?.isDirectory()) target = path.join(target, 'index.html');
    assert(await pathExists(target), `${relativeName} references missing file: ${reference}`);
  }

  if (relativeName === 'index.html') {
    assert(/class="hero-field"/.test(html), 'index.html must lead with a real field image.');
    assert(!/portal-directory/.test(html), 'index.html must not keep the non-interactive portal directory.');
    assert(/id="latest-activities"/.test(html), 'index.html must include the latest activities section.');
    assert(/id="latest-activities-list"/.test(html), 'index.html must expose a latest activities render target.');
    assert(/class="service-grid"/.test(html), 'index.html must separate available services from the roadmap.');
    assert((html.match(/class="service-card/g) || []).length === 1,
      'index.html must expose only the verified available service.');
    assert(!html.includes('https://www.stayup-ai.com/rfid-read'),
      'index.html must not link to the unavailable RFID route.');
    assert(/class="project-roadmap"/.test(html), 'index.html must include a compact project roadmap.');
    assert(/class="roadmap-code"[^>]*>RFID<\/span>/.test(html),
      'index.html must describe the unavailable RFID service as roadmap work.');
    assert(/<nav class="footer-nav"/.test(html), 'index.html footer must include navigation links.');
    assert(/id="visitorOverview"/.test(html), 'index.html footer must include the visitor overview.');
    assert(/id="visitorOverview" data-state="unavailable"/.test(html),
      'index.html visitor overview must fail safely when JavaScript does not run.');
    assert(/id="visitorStats" aria-busy="false"/.test(html),
      'index.html visitor overview must not claim indefinite loading before JavaScript runs.');
    assert(/id="visitorToday"/.test(html) && /id="visitorTotal"/.test(html),
      'index.html visitor overview must expose today and total count targets.');
    assert(/브라우저 기준 추정 · 2026\.09부터/.test(html),
      'index.html must disclose the visitor counter basis and starting month.');

    const versionedAssets = [
      'css/style.css',
      'js/activity-data.js',
      'js/home-activity-helpers.js',
      'js/main.js'
    ].map((asset) => html.match(new RegExp(`(?:href|src)="${asset.replace('.', '\\.')}\\?v=([0-9]{8,12})"`)));
    assert(versionedAssets.every(Boolean), 'index.html must version its core CSS and JavaScript assets.');
    assert(new Set(versionedAssets.map((match) => match[1])).size === 1,
      'index.html core assets must share one version identifier.');
    const assetVersion = versionedAssets[0][1];
    const mainSource = await readFile(path.join(rootDir, 'js', 'main.js'), 'utf8');
    assert(mainSource.includes(`from './home-activity-helpers.js?v=${assetVersion}'`),
      'main.js must import the activity helpers with the current asset version.');

    const activityDataScript = versionedAssets[1].index;
    const activityHelpersScript = versionedAssets[2].index;
    const mainScript = versionedAssets[3].index;
    assert(activityDataScript !== -1 && activityHelpersScript !== -1
      && activityDataScript < activityHelpersScript && activityHelpersScript < mainScript,
    'index.html must load activity data and helpers before main.js.');
  }
}

async function checkMainStyles() {
  const css = await readFile(path.join(rootDir, 'css', 'style.css'), 'utf8');
  assert(/\.service-icon\s*\{[^}]*justify-self:\s*start;/s.test(css),
    'Mobile service icons must preserve their compact width instead of stretching.');
  assert(!/scroll-margin-top\s*:/.test(css),
    'Section anchors must not add scroll margin on top of the document scroll padding.');
  assert(/:focus-visible\s*\{[^}]*outline:\s*3px solid #ffffff;[^}]*box-shadow:\s*0 0 0 6px #8a3500;/s.test(css),
    'Keyboard focus must use a two-tone ring that remains visible on light and dark surfaces.');
  assert(/\.latest-activity-card:focus-within\s*\{[^}]*outline:\s*3px solid #ffffff;[^}]*box-shadow:\s*0 0 0 6px #8a3500,/s.test(css),
    'Activity card focus must be drawn on the unclipped parent card boundary.');
  assert(/\.visitor-count\s*\{[^}]*font-variant-numeric:\s*tabular-nums;/s.test(css),
    'Visitor counts must use stable tabular numerals.');
}

async function main() {
  for (const fileConfig of contentFiles) {
    const { content } = await readAndValidateContent(fileConfig);
    await validateReferencedImages(content);
  }
  for (const fileConfig of scheduleFiles) {
    await readAndValidateSchedule(fileConfig);
  }

  const scripts = await collectFiles(rootDir, new Set(['.js', '.mjs']));
  scripts.forEach(checkJavaScript);

  const htmlFiles = await collectFiles(rootDir, new Set(['.html']));
  for (const htmlFile of htmlFiles) await checkHtml(htmlFile);
  await checkMainStyles();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
