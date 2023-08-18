const { shouldRunForRepository } = require('../services/config-services/should-run');
const { getDispatchEvents } = require('../services/dispatch-event-services/get-dispatch-events');
const { createDispatchEvent } = require('../services/dispatch-event-services/dispatch');
const appConfig = require('../app-config');

async function handleEvents(app, context) {
  const { deleted, 
    repository: { id: repoId, name: repoName, archived, full_name: repoFullName, owner: { login } }, 
    installation: { id: installationId } 
  } = context.payload;

  // 1. handle branch deletion - will not trigger the process
  // 2. handle repository archiving - will not trigger the process
  //    although we should not expect to see push event from an archived repository
  if(deleted || archived) return;

  // 3. handle excluded repositories
  const excludedRepositories = [appConfig().defaultOrganisationRepository];
  if(!shouldRunForRepository(repoName, excludedRepositories))
    return;

  const branch = context.name === 'push' ? 
    context.payload.ref.replace('refs/heads/', '') : context.payload.pull_request.head.ref;

  // 4. handle veracode yml auto pr branch
  if (branch === appConfig().prBranch) return;

  const sha = context.name === 'push' ? context.payload.after : context.payload.pull_request.head.sha;

  const dispatchEvents = await getDispatchEvents(app, context, branch);

  const api = context.octokit;

  const token = await api.apps.createInstallationAccessToken({
    installation_id: installationId,
    repository_ids: [repoId]
  })

  const dispatchEventData = {
    context,
    payload: {
      sha,
      branch,
      token: token.data.token,
      // TODO: read veracode.yml to get profile name
      profile_name: repoFullName, 
      repository: {
        owner: login,
        name: repoName,
        full_name: repoFullName,
      }
    }
  }

  const requests = dispatchEvents.map(event => createDispatchEvent(event, dispatchEventData));
  await Promise.all(requests);
}

module.exports = {
  handleEvents,
}