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
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
