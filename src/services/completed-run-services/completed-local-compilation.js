const { createDispatchEvent } = require('../dispatch-event-services/dispatch');
const appConfig = require('../../app-config');

async function handleCompletedCompilation (run, context) {
  const data = {
    owner: context.payload.repository.owner.login,
    repo: run.repository_name,
    check_run_id: context.payload.workflow_run.check_suite_id,
    status: context.payload.workflow_run?.status,
    conclusion: context.payload.workflow_run?.conclusion,
  }

  const repoId = context.payload.repository.id;
  const installationId = context.payload.installation.id;

  const api = context.octokit;

  const token = await api.apps.createInstallationAccessToken({
    installation_id: installationId,
    repository_ids: [repoId]
  })

  await context.octokit.checks.update(data);

  if (data.conclusion === 'failure') return;

  const dispatchEventData = {
    context,
    payload: {
      token: token.data.token,
      sha: run.sha,
      branch: run.branch,
      profile_name: context.payload.repository.full_name, 
      run_id: run.run_id,
      repository: {
        owner: context.payload.repository.owner.login,
        name: context.payload.repository.name,
        full_name: context.payload.repository.full_name,
      }
    }
  }

  const subsequentScanType = run.check_run_type.substring(27);
  const dispatchEvents = [{
    event_type: subsequentScanType,
    repository: appConfig().defaultOrganisationRepository,
    event_trigger: `binary-ready-${subsequentScanType}`
  }]

  let requests = dispatchEvents.map(event => createDispatchEvent(event, dispatchEventData));
  await Promise.all(requests);
}

module.exports = {
  handleCompletedCompilation,
}