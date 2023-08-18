const { handleCompletedRun } = require('./handlers/completed-run');
const { handleEvents } = require('./handlers/handler');

module.exports = async (app, { getRouter }) => {
  app.on(
    ["push", "pull_request"], 
    handleEvents.bind(null, app)
  );

  app.on(
    'workflow_run.completed', 
    handleCompletedRun.bind(null, app)
  );

  app.on('issues.opened', async context => {
    app.log.info(context);
  });

  const router = getRouter('');
  router.get('/health-check', (req, res) => {
    return res.status(200).send('Hello World');
  });
};
