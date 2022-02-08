import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';
import scheduler from 'node-schedule';

import Archivist from './archivist/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import GitAdapter from './storage-adapters/git/index.js';
import MongoAdapter from './storage-adapters/mongo/index.js';
import Tracker from './tracker/index.js';

const args = process.argv.slice(2);
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');
const extraArgs = args.filter(arg => !arg.startsWith('--'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async function startOpenTermsArchive() {
  const { versionsStorageAdapter, snapshotsStorageAdapter } = initStorageAdapters();

  const archivist = new Archivist({
    storage: {
      versions: versionsStorageAdapter,
      snapshots: snapshotsStorageAdapter,
    },
  });

  archivist.attach(logger);

  await archivist.initialize();

  logger.info('Start Open Terms Archive\n');

  let serviceIds;

  if (extraArgs.length) {
    serviceIds = extraArgs.filter(serviceId => {
      const isServiceDeclared = archivist.serviceDeclarations[serviceId];

      if (!isServiceDeclared) {
        logger.warn(`Parameter "${serviceId}" was interpreted as a service ID to update, but no matching declaration was found. It will be ignored.`);
      }

      return isServiceDeclared;
    });
  }

  await archivist.refilterAndRecord(serviceIds);

  if (refilterOnly) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    archivist.attach(new Notifier(archivist.serviceDeclarations));
  }

  if (process.env.GITHUB_TOKEN) {
    archivist.attach(new Tracker());
  }

  await archivist.trackChanges(serviceIds);

  if (!schedule) {
    return;
  }

  logger.info('The scheduler is running…');
  logger.info('Documents will be tracked at minute 30 past every 6 hours.');
  scheduler.scheduleJob('30 */6 * * *', async () => {
    await archivist.trackChanges(serviceIds);
  });
}());

function initStorageAdapters() {
  let versionsStorageAdapter;

  if (config.has('recorder.versions.storage.git')) {
    versionsStorageAdapter = new GitAdapter({
      ...config.get('recorder.versions.storage.git'),
      path: path.resolve(__dirname, '../', config.get('recorder.versions.storage.git.path')),
      fileExtension: 'md',
    });
  }

  if (config.has('recorder.versions.storage.mongo')) {
    versionsStorageAdapter = new MongoAdapter(config.get('recorder.versions.storage.mongo'));
  }

  let snapshotsStorageAdapter;

  if (config.has('recorder.snapshots.storage.git')) {
    snapshotsStorageAdapter = new GitAdapter({
      ...config.get('recorder.snapshots.storage.git'),
      path: path.resolve(__dirname, '../', config.get('recorder.snapshots.storage.git.path')),
      fileExtension: 'html',
    });
  }

  if (config.has('recorder.snapshots.storage.mongo')) {
    snapshotsStorageAdapter = new MongoAdapter(config.get('recorder.snapshots.storage.mongo'));
  }

  return {
    versionsStorageAdapter,
    snapshotsStorageAdapter,
  };
}
