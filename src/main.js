import scheduler from 'node-schedule';

import Archivist from './archivist/index.js';
import logger from './logger/index.js';
import Notifier from './notifier/index.js';
import Tracker from './tracker/index.js';

import { instantiateVersionsStorageAdapter, instantiateSnapshotsStorageAdapter } from './index.js';

const args = process.argv.slice(2);
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');
const extraArgs = args.filter(arg => !arg.startsWith('--'));

(async function startOpenTermsArchive() {
  const archivist = new Archivist({
    storage: {
      versions: instantiateVersionsStorageAdapter(),
      snapshots: instantiateSnapshotsStorageAdapter(),
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
