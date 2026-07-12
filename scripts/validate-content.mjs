import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const contentFiles = [
  { path: 'data/stayup-activities.json', team: 'stayup' },
  { path: 'data/firehawks-activities.json', team: 'firehawks' }
];

const datePattern = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateDate(value, label, required = true) {
  if (!value && !required) return;
  assert(typeof value === 'string' && datePattern.test(value), `${label} must use YYYY, YYYY-MM, or YYYY-MM-DD.`);
  const [year, month = 1, day = 1] = value.split('-').map(Number);
  assert(year >= 1900 && year <= 2100, `${label} year is out of range.`);
  assert(month >= 1 && month <= 12, `${label} month is out of range.`);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  assert(
    day >= 1
      && parsed.getUTCFullYear() === year
      && parsed.getUTCMonth() === month - 1
      && parsed.getUTCDate() === day,
    `${label} is not a valid date.`
  );
}

function dateBoundary(value, usePeriodEnd) {
  const [year, rawMonth, rawDay] = value.split('-').map(Number);
  const month = rawMonth || (usePeriodEnd ? 12 : 1);
  const day = rawDay || (usePeriodEnd ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 1);
  return Date.UTC(year, month - 1, day);
}

function validateImagePath(value, label) {
  assert(typeof value === 'string' && value.startsWith('/images/'), `${label} must start with /images/.`);
  const decoded = decodeURIComponent(value);
  assert(!decoded.includes('..') && !decoded.includes('\\'), `${label} contains an unsafe path.`);
  assert(/\.(?:avif|gif|jpe?g|png|webp)$/i.test(value), `${label} must reference an image file.`);
  assert(value.length <= 300, `${label} is too long.`);
}

export async function readAndValidateContent(fileConfig) {
  const absolutePath = path.join(rootDir, fileConfig.path);
  const raw = await readFile(absolutePath, 'utf8');
  const content = JSON.parse(raw);

  assert(content && typeof content === 'object', `${fileConfig.path} must contain an object.`);
  assert(content.team === fileConfig.team, `${fileConfig.path} team must be ${fileConfig.team}.`);
  assert(Array.isArray(content.activities), `${fileConfig.path} activities must be an array.`);

  const ids = new Set();
  content.activities.forEach((activity, index) => {
    const label = `${fileConfig.path} activities[${index}]`;
    assert(activity && typeof activity === 'object', `${label} must be an object.`);

    assert(
      typeof activity.id === 'string' && /^[a-z0-9][a-z0-9-]{0,79}$/.test(activity.id),
      `${label}.id must use lowercase letters, numbers, and hyphens.`
    );
    assert(!ids.has(activity.id), `${label}.id must be unique.`);
    ids.add(activity.id);

    validateDate(activity.date, `${label}.date`);
    validateDate(activity.endDate, `${label}.endDate`, false);
    if (activity.endDate) {
      assert(
        dateBoundary(activity.endDate, true) >= dateBoundary(activity.date, false),
        `${label}.endDate cannot be before date.`
      );
    }

    ['category', 'title', 'description', 'image', 'imageAlt'].forEach((field) => {
      assert(typeof activity[field] === 'string' && activity[field].trim(), `${label}.${field} is required.`);
    });
    assert(activity.category.length <= 60, `${label}.category is too long.`);
    assert(activity.title.length <= 140, `${label}.title is too long.`);
    assert(activity.description.length <= 600, `${label}.description is too long.`);
    assert(activity.imageAlt.length <= 180, `${label}.imageAlt is too long.`);

    validateImagePath(activity.image, `${label}.image`);
    assert(typeof activity.published === 'boolean', `${label}.published must be true or false.`);

    const hasImageWidth = activity.imageWidth !== undefined && activity.imageWidth !== null && activity.imageWidth !== '';
    const hasImageHeight = activity.imageHeight !== undefined && activity.imageHeight !== null && activity.imageHeight !== '';
    if (hasImageWidth) {
      assert(Number.isInteger(activity.imageWidth) && activity.imageWidth > 0, `${label}.imageWidth must be a positive integer.`);
    }
    if (hasImageHeight) {
      assert(Number.isInteger(activity.imageHeight) && activity.imageHeight > 0, `${label}.imageHeight must be a positive integer.`);
    }
    assert(hasImageWidth === hasImageHeight, `${label}.imageWidth and imageHeight must be provided together.`);
    if (!activity.image.startsWith('/images/activity-uploads/')) {
      assert(hasImageWidth && hasImageHeight, `${label} must include imageWidth and imageHeight for an existing image.`);
    }
    if (activity.order !== undefined) {
      assert(Number.isInteger(activity.order) && activity.order >= 0, `${label}.order must be a non-negative integer.`);
    }
    if (activity.displayDate !== undefined) {
      assert(typeof activity.displayDate === 'string' && activity.displayDate.trim() && activity.displayDate.length <= 40, `${label}.displayDate must be a non-empty string up to 40 characters.`);
    }
    if (activity.badge !== undefined) {
      assert(typeof activity.badge === 'string' && activity.badge.trim() && activity.badge.length <= 50, `${label}.badge must be a non-empty string up to 50 characters.`);
    }
    if (activity.badgeTone !== undefined) {
      assert(['default', 'muted'].includes(activity.badgeTone), `${label}.badgeTone must be default or muted.`);
    }
  });

  return { absolutePath, content };
}

export async function validateReferencedImages(content) {
  const imagesRoot = await realpath(path.join(rootDir, 'images'));
  await Promise.all(content.activities.map(async (activity, index) => {
    const relativePath = activity.image.replace(/^\//, '');
    try {
      const resolvedPath = await realpath(path.join(rootDir, relativePath));
      const details = await stat(resolvedPath);
      assert(resolvedPath.startsWith(`${imagesRoot}${path.sep}`), `Image path escapes images directory: ${activity.image}`);
      assert(details.isFile(), `Image is not a regular file: ${activity.image}`);
      assert(details.size > 0 && details.size <= 15 * 1024 * 1024, `Image must be between 1 byte and 15MB: ${activity.image}`);
      const metadata = await sharp(resolvedPath, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata();
      assert(['jpeg', 'png', 'webp'].includes(metadata.format), `Unsupported image format: ${activity.image}`);
      assert(metadata.width && metadata.height, `Image dimensions are unavailable: ${activity.image}`);
      if (activity.imageWidth && activity.imageHeight) {
        assert(
          metadata.width === activity.imageWidth && metadata.height === activity.imageHeight,
          `Declared image dimensions do not match ${activity.image}`
        );
      }
    } catch (error) {
      throw new Error(`Invalid image for activities[${index}] (${activity.image}): ${error.message}`);
    }
  }));
}

async function main() {
  for (const fileConfig of contentFiles) {
    const { content } = await readAndValidateContent(fileConfig);
    await validateReferencedImages(content);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
