import { Octokit } from 'octokit';
import nodeFetch from 'node-fetch';

const octokit = new Octokit();

(async () => {
  async function getCommitContent(sha) {
    console.time(sha);
    const result = await octokit.request(`GET /repos/ambanum/OpenTermsArchive-snapshots/commits/${sha}`, {
      owner: 'ambanum',
      repo: 'OpenTermsArchive-snapshots',
      commit_sha: sha
    })

    console.log(result.data.files[0].raw_url);

    const response = await nodeFetch(result.data.files[0].raw_url);
    console.log(await response.text().length);
    console.timeEnd(sha);
  }

  // const result = await octokit.rest.git.getCommit({
  //   owner: 'ambanum',
  //   repo: 'OpenTermsArchive-snapshots',
  //   commit_sha: '46fc5e6bf78b3beed35f5cef01da2588c4b1769c'
  // });

  const commitsArray = [
    '2aad875c3b17c3608f62b2dde77cdc856dbb196f',
    '580ad8e7469f59f99deda826865c5f89b99aa6a4',
    '8ed888541284ec267bd22b845f5564e411cd2977',
    'a078752e0a4b16f9f1a7e431d0d43d4149202895',
    '87a5974a9d4f1611b2b10335a10fae6f47932b4f',
    '68e2b5d3de19f9ca8088b50158736b1b2970db20',
    '354dd8731edcc05cce8a9f61d01817560e7a683c',
    '2c5f0072cafe2e29da192502f0c15bcce0602cb7',
    'd02aa2e979d0529d45d8f31d94209d1178e9b92f',
    '779f762edf9008b9412f39fa9408104db21151c8',
  ];

  const promises = commitsArray.map(getCommitContent);
  await Promise.all(promises);
})();
