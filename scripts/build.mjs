import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  contentFiles,
  readAndValidateContent,
  readAndValidateSchedule,
  scheduleFiles,
  validateReferencedImages
} from './validate-content.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, 'dist');
const uploadDir = path.join(rootDir, 'images', 'activity-uploads');
const optimizedPublicDir = '/images/activity-optimized';
const optimizedOutputDir = path.join(outputDir, optimizedPublicDir.slice(1));
const maxUploadBytes = 15 * 1024 * 1024;
const maxInputPixels = 40_000_000;
const allowedUploadFormats = new Set(['jpeg', 'png', 'webp']);

const staticEntries = [
  'index.html',
  'latest_version.json',
  'robots.txt',
  'sitemap.xml',
  'css',
  'js',
  'images/optimized',
  'stayup',
  'firehawks',
  'activities',
  'admin'
];

function safeBaseName(filename) {
  return path.basename(filename, path.extname(filename))
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'activity';
}

async function copyStaticFiles() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const entry of staticEntries) {
    const source = path.join(rootDir, entry);
    const destination = path.join(outputDir, entry);
    await cp(source, destination, {
      recursive: true,
      filter: (sourcePath) => !sourcePath.startsWith(uploadDir)
    });
  }
}

async function optimizeUploadedImage(publicPath) {
  const relativePath = publicPath.replace(/^\//, '');
  const sourcePath = path.join(rootDir, relativePath);
  const [resolvedUploadDir, resolvedSourcePath, sourceStats] = await Promise.all([
    realpath(uploadDir),
    realpath(sourcePath),
    stat(sourcePath)
  ]);
  if (!resolvedSourcePath.startsWith(`${resolvedUploadDir}${path.sep}`)) {
    throw new Error(`Activity image is outside the upload directory: ${publicPath}`);
  }
  if (!sourceStats.isFile() || sourceStats.size < 1 || sourceStats.size > maxUploadBytes) {
    throw new Error(`Activity image must be a regular file up to 15MB: ${publicPath}`);
  }

  const sourceBuffer = await readFile(sourcePath);
  const sharpOptions = {
    failOn: 'error',
    limitInputPixels: maxInputPixels
  };
  const metadata = await sharp(sourceBuffer, sharpOptions).metadata();
  if (!allowedUploadFormats.has(metadata.format)) {
    throw new Error(`Activity image format must be JPEG, PNG, or WebP: ${publicPath}`);
  }
  const digest = createHash('sha256').update(sourceBuffer).digest('hex').slice(0, 10);
  const outputName = `${safeBaseName(sourcePath)}-${digest}.webp`;
  const outputPath = path.join(optimizedOutputDir, outputName);

  await mkdir(optimizedOutputDir, { recursive: true });
  const result = await sharp(sourceBuffer, sharpOptions)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(outputPath);

  return {
    image: `${optimizedPublicDir}/${outputName}`,
    imageWidth: result.width,
    imageHeight: result.height
  };
}

async function buildContent() {
  await mkdir(path.join(outputDir, 'data'), { recursive: true });

  for (const fileConfig of contentFiles) {
    const { content } = await readAndValidateContent(fileConfig);
    await validateReferencedImages(content);

    const builtActivities = [];
    for (const activity of content.activities.filter(item => item.published === true)) {
      if (activity.image.startsWith('/images/activity-uploads/')) {
        const optimized = await optimizeUploadedImage(activity.image);
        builtActivities.push({ ...activity, ...optimized });
      } else {
        builtActivities.push(activity);
      }
    }

    const outputContent = { ...content, activities: builtActivities };
    const outputPath = path.join(outputDir, fileConfig.path);
    await writeFile(outputPath, `${JSON.stringify(outputContent, null, 2)}\n`);
  }

  for (const fileConfig of scheduleFiles) {
    const { content } = await readAndValidateSchedule(fileConfig);
    const outputContent = {
      ...content,
      schedules: content.schedules.filter(item => item.published === true)
    };
    const outputPath = path.join(outputDir, fileConfig.path);
    await writeFile(outputPath, `${JSON.stringify(outputContent, null, 2)}\n`);
  }
}

async function main() {
  await copyStaticFiles();
  await buildContent();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
