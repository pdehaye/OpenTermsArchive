import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import { InaccessibleContentError } from '../../src/archivist/errors.js';
import filter from '../../src/archivist/filter/index.js';
import Recorder from '../../src/archivist/recorder/index.js';
import * as services from '../../src/archivist/services/index.js';
import Git from '../../src/storage-adapters/git/git.js';
import GitAdapter from '../../src/storage-adapters/git/index.js';
import * as renamer from '../utils/renamer/index.js';

import * as initializer from './initializer/index.js';
import { loadFile } from './utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');

export const SNAPSHOTS_SOURCE_PATH = path.resolve(
  ROOT_PATH,
  config.get('rewrite.snapshotsSourcePath'),
);
export const VERSIONS_TARGET_PATH = path.resolve(ROOT_PATH, config.get('recorder.versions.storage.git.path'));

const initialize = process.argv.includes('--init');

const COUNTERS = {
  rewritten: 0,
  skippedNoChanges: 0,
  skippedInaccessibleContent: 0,
  skippedUnknownError: 0,
};

let recorder;

(async () => {
  console.time('Total time');
  console.log('Start rewritting history.');

  await renamer.loadRules();
  const servicesDeclarations = await services.loadWithHistory();
  const sourceRepo = new Git({ path: SNAPSHOTS_SOURCE_PATH, author: config.get('recorder.snapshots.storage.git.author') });

  await sourceRepo.initialize();

  console.log('Waiting for git log… (this can take a while)');
  const commits = (await sourceRepo.log(['--stat=4096'])).sort((a, b) => new Date(a.date) - new Date(b.date));

  console.log(`Source repo contains ${commits.length} commits.\n`);

  if (initialize) {
    const targetRepo = await initializer.initTargetRepo(VERSIONS_TARGET_PATH);
    const [readmeCommit] = commits;

    await initializer.initReadmeAndLicense(targetRepo, VERSIONS_TARGET_PATH, readmeCommit.date);
  }

  recorder = new Recorder({
    versionsStorageAdapter: new GitAdapter({
      ...config.get('recorder.versions.storage.git'),
      path: VERSIONS_TARGET_PATH,
      fileExtension: 'md',
    }),
    snapshotsStorageAdapter: new GitAdapter({
      ...config.get('recorder.snapshots.storage.git'),
      path: SNAPSHOTS_SOURCE_PATH,
      fileExtension: 'html',
    }),
  });

  await recorder.initialize();

  const filteredCommits = commits.filter(({ message }) =>
    message.match(/^(Start tracking|Update)/));

  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-continue */
  for (const commit of filteredCommits) {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    const [{ file: relativeFilePath }] = commit.diff.files;

    const { content, mimeType } = await loadFile(SNAPSHOTS_SOURCE_PATH, relativeFilePath);

    let serviceId = path.dirname(relativeFilePath);
    let documentType = path.basename(relativeFilePath, path.extname(relativeFilePath));

    ({ serviceId, documentType } = renamer.applyRules(serviceId, documentType));

    if (!servicesDeclarations[serviceId]) {
      console.log(`⌙ Skip unknown service "${serviceId}"`);
      continue;
    }

    const documentDeclaration = servicesDeclarations[serviceId].getDocumentDeclaration(
      documentType,
      commit.date,
    );

    if (!documentDeclaration) {
      console.log(`⌙ Skip unknown document type "${documentType}" for service "${serviceId}"`);
      continue;
    }

    if (documentDeclaration.validUntil) {
      console.log(`⌙ Use declaration valid until ${documentDeclaration.validUntil}`);
    }

    try {
      const document = await filter({
        content,
        mimeType,
        documentDeclaration,
      });

      const { id: versionId } = await recorder.recordVersion({
        serviceId,
        documentType,
        content: document,
        fetchDate: commit.date,
        snapshotId: commit.hash,
      });

      if (versionId) {
        COUNTERS.rewritten++;
      } else {
        COUNTERS.skippedNoChanges++;
      }
    } catch (error) {
      if (error instanceof InaccessibleContentError) {
        console.log('⌙ Skip inacessible content');
        COUNTERS.skippedInaccessibleContent++;
      } else {
        console.log('⌙ Unknown error:', error);
        COUNTERS.skippedUnknownError++;
      }
    }
  }

  const totalTreatedCommits = Object.values(COUNTERS).reduce((acc, value) => acc + value, 0);

  console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
  console.log(`⌙ Commits rewritten: ${COUNTERS.rewritten}`);
  console.log(`⌙ Skipped not changed commits: ${COUNTERS.skippedNoChanges}`);
  console.log(`⌙ Skipped inacessible content: ${COUNTERS.skippedInaccessibleContent}`);
  console.log(`⌙ Skipped unknown error: ${COUNTERS.skippedUnknownError}`);
  console.timeEnd('Total time');

  if (totalTreatedCommits != filteredCommits.length) {
    console.error('\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠');
  }

  if (COUNTERS.skippedUnknownError) {
    console.error('\n⚠ WARNING: Some unknown errors occured, check log! ⚠');
  }
})();
