import { randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { acceptCurrentDraw, shouldDeleteTransient } from './guide-retention.js';
import { validateGuide } from './guide-validation.js';

const idPattern = /^[a-zA-Z0-9_-]{1,80}$/;
const recordPattern = /^\d{4}-\d{2}-\d{2}--[a-zA-Z0-9_-]{1,80}\.guide\.json$/;
const stagePattern = /^\.guide-stage-[0-9a-f-]{36}$/;
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
const maxPngBytes = 8 * 1024 * 1024;

function recordName(lotteryId, drawDate) {
  if (typeof lotteryId !== 'string' || !idPattern.test(lotteryId)) throw new Error('invalid_lottery_id');
  return `${drawDate}--${lotteryId}.guide.json`;
}

async function readRecord(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

// Use a dedicated transient directory on a filesystem that supports hard links.
// A single file publishes the guide and poster together and gives both one expiry.
export function createGuideStore(directory) {
  return {
    async publish({ lotteryId, drawDate, catalog, guide, png }, now = new Date()) {
      if (!acceptCurrentDraw(drawDate, now)) throw new Error('not_current_draw');
      const destination = join(directory, recordName(lotteryId, drawDate));
      const validation = validateGuide(guide, { lotteryId, drawDate, catalog });
      if (!validation.ok) throw new Error(validation.errors.join(','));
      const fetchedAt = Date.parse(validation.guide.fetchedAt);
      const guideTimestamp = { kind: 'external-guide', createdAt: validation.guide.fetchedAt };
      if (fetchedAt > now.getTime() || shouldDeleteTransient(guideTimestamp, now)) {
        throw new Error('invalid_guide_age');
      }
      if (!Buffer.isBuffer(png) || png.length <= pngSignature.length || png.length > maxPngBytes ||
          !png.subarray(0, pngSignature.length).equals(pngSignature)) throw new Error('invalid_png');

      const { sourceUrl, numbers } = validation.guide;
      const record = { ...guideTimestamp, lotteryId, drawDate,
        guide: { lotteryId, drawDate, fetchedAt: validation.guide.fetchedAt, sourceUrl, numbers },
        png: png.toString('base64') };
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const stage = join(directory, `.guide-stage-${randomUUID()}`);
      const file = await open(stage, 'wx', 0o600);
      try {
        try {
          await file.writeFile(JSON.stringify(record));
          await file.sync();
        } finally {
          await file.close();
        }
        try {
          await link(stage, destination);
          return 'published';
        } catch (linkError) {
          if (linkError.code !== 'EACCES') throw linkError;
          // Hard links are not supported on this filesystem: publish directly
          // to the destination with exclusive creation, then stage is removed.
          try {
            const dest = await open(destination, 'wx', 0o600);
            try {
              await dest.writeFile(JSON.stringify(record));
              await dest.sync();
            } finally {
              await dest.close();
            }
            return 'published';
          } catch (destError) {
            if (destError.code === 'EEXIST') return 'already_published';
            throw destError;
          }
        }
      } catch (error) {
        if (error.code === 'EEXIST') return 'already_published';
        throw error;
      } finally {
        await rm(stage, { force: true });
      }
    },

    async read(lotteryId, drawDate, now = new Date()) {
      if (!acceptCurrentDraw(drawDate, now)) return null;
      const record = await readRecord(join(directory, recordName(lotteryId, drawDate)));
      if (!record || shouldDeleteTransient(record, now)) return null;
      return { guide: record.guide, png: Buffer.from(record.png, 'base64') };
    },

    async purge(now = new Date()) {
      if (!Number.isFinite(now.getTime())) throw new Error('invalid_clock');
      let entries;
      try {
        entries = await readdir(directory, { withFileTypes: true });
      } catch (error) {
        if (error.code === 'ENOENT') return 0;
        throw error;
      }
      let deleted = 0;
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const file = join(directory, entry.name);
        let record;
        if (recordPattern.test(entry.name)) {
          record = await readRecord(file);
        } else if (stagePattern.test(entry.name)) {
          // A crash can leave an uncommitted staging file behind.
          const info = await stat(file).catch(error => {
            if (error.code === 'ENOENT') return null;
            throw error;
          });
          if (info) record = { kind: 'external-guide', createdAt: info.mtime.toISOString() };
        }
        if (!record || !shouldDeleteTransient(record, now)) continue;
        await rm(file, { force: true });
        deleted++;
      }
      return deleted;
    },
  };
}
