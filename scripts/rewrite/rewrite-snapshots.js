import async from 'async';
import { fileURLToPath, pathToFileURL } from 'url';
import config from 'config';
import path from 'path';
import * as initializer from './initializer/index.js';
import * as renamer from './renamer/index.js';

import nodeFetch from 'node-fetch';

import mime from 'mime';
import Git from '../../src/app/history/git.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');
export const SNAPSHOTS_SOURCE_PATH = path.resolve(
  ROOT_PATH,
  config.get('rewrite.snapshotsSourcePath')
);
export const SNAPSHOTS_TARGET_PATH = path.resolve(ROOT_PATH, config.get('history.snapshotsPath'));

const initialize = process.argv.includes('--init');

const COUNTERS = {
  rewritten: 0,
  skippedNoChanges: 0,
};

let history;
(async () => {
  console.time('Total time');
  console.log('Start rewritting history.');

  await renamer.loadRules();
  const sourceRepo = new Git(SNAPSHOTS_SOURCE_PATH);

  console.log('Waiting for git log… (this can take a while)');
  console.time('git-log');
  const commits = (await sourceRepo.log(['--stat=4096'])).sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  console.timeEnd('git-log');
  console.log(`Source repo contains ${commits.length} commits.\n`);

  if (initialize) {
    const targetRepo = await initializer.initTargetRepo(SNAPSHOTS_TARGET_PATH);
    const [readmeCommit] = commits;
    await initializer.initReadmeAndLicense(targetRepo, SNAPSHOTS_TARGET_PATH, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(ROOT_PATH, 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.
  await history.init();

  const filteredCommits = commits.filter(({ message }) =>
    message.match(/^(Start tracking|Update)/));


  console.log('filteredCommits', filteredCommits.length);
  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-continue */
  // for (const commit of filteredCommits) {

  const q = async.queue(async commit => handleCommit(commit), 20);

  const handleCommit = async (commit) => {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    const [{ file: relativeFilePath }] = commit.diff.files;

    let serviceId = path.dirname(relativeFilePath);
    let extension = path.extname(relativeFilePath);
    let documentType = path.basename(relativeFilePath, extension);


    ({ serviceId, documentType } = renamer.applyRules(serviceId, documentType));

    const body = await getCommitContent({sha: commit.hash, serviceId, documentType, extension: extension.replace('.', '')});

    const { id: snapshotId } = await history.recordSnapshot({
      serviceId,
      documentType,
      content: body,
      mimeType: mime.getType(extension),
      authorDate: commit.date,
      extraChangelogContent: commit.body,
      sha: commit.hash,
    });

    if (snapshotId) {
      COUNTERS.rewritten++;
    } else {
      COUNTERS.skippedNoChanges++;
    }
  }

  filteredCommits.forEach(async (commit) => {
    q.push(commit);
  });

  q.error(function(err, task) {
    console.error('task experienced an error', err, task);
    console.error('');
  });

  q.drain(function() {
    const totalTreatedCommits = Object.values(COUNTERS).reduce((acc, value) => acc + value, 0);
    console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
    console.log(`⌙ Commits rewritten: ${COUNTERS.rewritten}`);
    console.log(`⌙ Skipped not changed commits: ${COUNTERS.skippedNoChanges}`);
    console.timeEnd('Total time');

    if (totalTreatedCommits != filteredCommits.length) {
      console.error(
        '\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠'
      );
    }
  });


})();

async function getCommitContent({sha, serviceId, documentType, extension}) {
  console.time(sha);
  console.log(sha, serviceId, documentType, extension);
  const url = `https://raw.githubusercontent.com/ambanum/OpenTermsArchive-snapshots/${sha}/${encodeURI(serviceId)}/${encodeURI(documentType)}.${extension}`;
  console.log(url);
  const response = await nodeFetch(url);
  console.timeEnd(sha);

  return await response.text();
}
