import scheduler from 'node-schedule';

import logger from './logger/index.js';

import { release } from './index.js';

(async () => {
  const args = process.argv.slice(2);
  const shouldPublish = args.includes('--publish');
  const shouldRemoveLocalCopy = args.includes('--remove-local-copy');
  const shouldSchedule = args.includes('--schedule');
  const argsWithoutOptions = args.filter(arg => !arg.startsWith('--'));
  const [fileName] = argsWithoutOptions;

  if (!shouldSchedule) {
    return release({ shouldPublish, shouldRemoveLocalCopy, fileName });
  }

  logger.info('Release will be created every Monday at 03h30');

  scheduler.scheduleJob({ hour: 3, minute: 30, dayOfWeek: 1 }, async () => release({ shouldPublish, shouldRemoveLocalCopy, fileName }));
})();
