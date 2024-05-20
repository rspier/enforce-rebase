const core = require('@actions/core');
const { exec } = require('child_process');

const runShellCmd = async (command, failureMessage) => {
    return exec(command, (error, stdout, stderr) => {
      let errorMessage = '';
      if (error)
        errorMessage += `${failureMessage}: ${error.message}`;
      if (stderr)
        errorMessage += `\nStandard Error: ${stderr}`;
      if (error || errorMessage)
        core.setFailed(errorMessage);
      console.log(stdout);
    });
}

const run = async () => {
  const BRANCH = core.getInput('default-branch');
  const MERGES_FAILURE = "Pull requests have no merge commits";
  const BASE_FAILURE = `Pull request must be rebased on ${BRANCH}`;


  // Typical use of this action:
  //  steps:
  //  - name: Check out code
  //    uses: actions/checkout@v4
  //    with:
  //      fetch-depth: 0
  //  - name: Is Rebased on master?
  //    uses: cyberark/enforce-rebase@onyx-24026-fix-merge-detection
  //
  // checkout@v2 checks out the pull request merged into the target branch by
  // default. This confuses the merge commit detection logic as there is always
  // a merge commit on the branch.
  // This step could be done as part of the checkout action configuration
  // see: https://github.com/actions/checkout#checkout-pull-request-head-commit-instead-of-merge-commit
  // However we checkout the head of the pull request branch here to avoid having to change
  // the configuration of all users of this action.

  let noMergesCmd = `merges="\$(git log --oneline origin/${BRANCH}...HEAD --merges )"; \
  echo "--- Merges ---\\n\${merges}"; [ -z "\${merges}" ]`
  if(process.env.GITHUB_EVENT_NAME == "pull_request"){
    console.log("PR Detected, checking out PR Branch head before checking for merge commits");
    noMergesCmd = `git checkout "${ process.env.GITHUB_HEAD_REF }" 2>&1 && `
                  + noMergesCmd;
  } else {
    console.log("PR Not detected, skipping checkout");
  }
  console.log(`Command for checking for merge commits is ${noMergesCmd}`)

  let correctBaseCmd =
    `[ "$(git merge-base origin/${BRANCH} HEAD)" = "$(git rev-parse origin/${BRANCH})" ]`;

  try {
    let results = Array();
    results.push(await runShellCmd(noMergesCmd, MERGES_FAILURE));
    results.push(await runShellCmd(correctBaseCmd, BASE_FAILURE));

    results.forEach(result => {
      result.on('exit', code => {
        if (code != 0)
          core.setFailed('Invalid return code for message');
      });
    });
  } catch (error) {
    core.setFailed(error)
  }
}

run()
