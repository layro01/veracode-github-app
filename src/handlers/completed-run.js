const { 
  updateChecksForCompletedSCAScan 
} = require('../services/completed-run-services/completed-sca-scan');
const { updateChecksForCompletedPipelineScan } = 
  require('../services/completed-run-services/completed-pipeline-scan');
const { handleCompletedCompilation } = 
  require('../services/completed-run-services/completed-local-compilation');
const { 
  updateChecksForCompletedPolicyScan, 
} = require('../services/completed-run-services/completed-policy-scan');

const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const { artifact_folder } = require('../utils/constants');

async function handleCompletedRun(app, context) {
  if (!context.payload.workflow_run.id) return;

  // Get information on the artifacts associated with the workflow.
  // TODO: Should probably download all the artifacts associated with the workflow in one go.
  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;
  const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/artifacts`
  let artifactRequest = await context.octokit.request(url);

  let retry = 20;
  while (artifactRequest.data.total_count === 0 && retry > 0) {
    retry--;
    await sleep(5000);
    console.log(`Workflow artifacts not found, retrying... Remaining retries: ${retry}`);
    artifactRequest = await context.octokit.request(url);
  }

  if (retry === 0 && artifactRequest.data.total_count === 0) {
    updateChecks(run, context, {
      annotations: [],
      title: 'Workflow Metadata Fetch',
      summary: 'Failed to fetch workflow artifact data.'
    });
    return;
  }

  // look for the artifact containing the metadata.json file.
  const artifacts = artifactRequest.data;
  let resultsUrl = '';
  for (const artifact of artifacts.artifacts) {
    if (artifact.name !== "workflow-metadata") {
      continue;
    }

    // Get the metadata.json archive file into a tmp directory.
    const timestamp = new Date().toISOString();
    const artifactName = `${context.payload.repository.owner.login}-${context.payload.repository.name}-${timestamp}`;
    const artifactFilename = `${artifact_folder}/${artifactName}.zip`;
    const destination = `${artifact_folder}/${artifactName}`;

    // Make the tmp directory if it does not exist.
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    // Get the archive and extract it.
    const artifactData = await context.octokit.request(`GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/artifacts/${artifact.id}/zip`);
    await fs.writeFileSync(artifactFilename, Buffer.from(artifactData.data));
    const zip = new AdmZip(artifactFilename);
    zip.extractAllTo(`${destination}`, /*overwrite*/true);

    // Read and parse the metadata file.
    const metadata = fs.readFileSync(
      `${destination}/workflow-metadata.json`, 
      'utf8'
    );
    const run = JSON.parse(metadata);

    // We should now have the necessary checks run information!
    if (!run) return
    app.log.info(run);

    // Update the checks run based on the metadata.
    if (run.check_run_type.substring(0, 26) === 'veracode-local-compilation') 
      handleCompletedCompilation(run, context);
    else if (run.check_run_type === 'veracode-sca-scan' || run.check_run_type === 'veracode-container-security-scan')
      updateChecksForCompletedSCAScan(run, context);
    else if (run.check_run_type === 'veracode-sast-policy-scan')
      updateChecksForCompletedPolicyScan(run, context);
    else
      updateChecksForCompletedPipelineScan(run, context);

    // Remove the tmp files from the file system.
    fs.rm(destination, { recursive: true });
    fs.rm(artifactFilename);

    // There should only be one metadata file per workflow run, so bail after processing it.
    break;
  }

}

module.exports = {
  handleCompletedRun,
}