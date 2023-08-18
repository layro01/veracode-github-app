async function updateChecks(run, context, output) {
  const data = {
    owner: context.payload.repository.owner.login,
    repo: run.repository_name,
    check_run_id: run.check_run_id,
    status: context.payload.workflow_run?.status,
    conclusion: context.payload.workflow_run?.conclusion,
    output: {
      annotations: output.annotations,
      title: output.title,
      summary: output.summary
    }
  }
  await context.octokit.checks.update(data);
}

module.exports = {
  updateChecks,
}