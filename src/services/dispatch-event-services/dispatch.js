const appConfig = require('../../app-config');

const createDispatchEvent = async function (event, dispatchEventData) {
  context = dispatchEventData.context;
  await context.octokit.repos.createDispatchEvent({
    owner: context.payload.repository.owner.login,
    repo: event.repository,
    event_type: event.event_trigger,
    client_payload: {
      ...dispatchEventData.payload,
      event: context.payload,
      event_type: event.event_type
    }
  });
}

module.exports = {
  createDispatchEvent,
}