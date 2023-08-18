const fs = require("fs-extra");
const AdmZip = require("adm-zip");
const { artifact_folder } = require('../../utils/constants');
const { updateChecks } = require('./checks');

async function updateChecksForCompletedSastScan(run, context, scanConfig) {
  const workflow_reopo_owner = context.payload.repository.owner.login;
  const workflow_repo_name = context.payload.repository.name;
  const workflow_repo_run_id = context.payload.workflow_run.id;

  const url = `GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/runs/${workflow_repo_run_id}/artifacts`
  let artifactRequest = await context.octokit.request(url);

  let retry = 20;
  while (artifactRequest.data.total_count === 0 && retry > 0) {
    retry--;
    await sleep(5000);
    console.log(`Artifact not found, retrying. remaining retries: ${retry}`);
    artifactRequest = await context.octokit.request(url);
  }

  if (retry === 0 && artifactRequest.data.total_count === 0) {
    updateChecks(run, context, {
      annotations: [],
      title: scanConfig.title,
      summary: 'Failed to fetch results artifacts.'
    });
    return;
  }

  let annotations = []
  const artifacts = artifactRequest.data;
  let resultsUrl = '';

  for (const artifact of artifacts.artifacts) {
    if (artifact.name !== scanConfig.artifactName) {
      continue;
    }
    const timestamp = new Date().toISOString();
    const repository_owner = context.payload.repository.owner.login;
    const repository_name = run.repository_name;
    const artifactName = `${repository_owner}-${repository_name}-${timestamp}`;
    const artifactFilename = `${artifact_folder}/${artifactName}.zip`;
    const destination = `${artifact_folder}/${artifactName}`;

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const artifactData = await context.octokit.request(`GET /repos/${workflow_reopo_owner}/${workflow_repo_name}/actions/artifacts/${artifact.id}/zip`);
    await fs.writeFileSync(artifactFilename, Buffer.from(artifactData.data));
    const zip = new AdmZip(artifactFilename);
    zip.extractAllTo(`${destination}`, /*overwrite*/true);

    if (scanConfig.resultsUrlFileName !== null) {
      resultsUrl = fs.readFileSync(
        `${destination}/${scanConfig.resultsUrlFileName}`, 
        'utf8'
      );
    }
    if (scanConfig.findingFileName !== null) {
      const data = fs.readFileSync(`${destination}/${scanConfig.findingFileName}`)
      const json = JSON.parse(data);
      annotations = scanConfig.getAnnotations(json);
    }
    fs.rm(destination, { recursive: true });
    fs.rm(artifactFilename);
  }

  if (annotations.length === 0) {
    updateChecks(run, context, {
      annotations: [],
      title: scanConfig.title,
      summary: `<pre>${resultsUrl}</pre>`
    });
    return;
  }

  const maxNumberOfAnnotations = 50;

  for (let index = 0; index < annotations.length / maxNumberOfAnnotations; index++) {
    const annotationBatch = annotations.slice(
      index * maxNumberOfAnnotations, 
      (index + 1) * maxNumberOfAnnotations
    );
    if (annotationBatch !== []) {
      const data = {
        owner: context.payload.repository.owner.login,
        repo: run.repository_name,
        check_run_id: run.check_run_id,
        status: context.payload.workflow_run?.status,
        conclusion: context.payload.workflow_run?.conclusion,
        output: {
          annotations: annotationBatch,
          title: 'Veracode Static Analysis',
          summary: resultsUrl === '' ? 
            'Here\'s the summary of the check result.' : 
            `Here\'s the summary of the check result, the full report can be found [here](${resultsUrl}).`
        }
      }

      await context.octokit.checks.update(data);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  updateChecksForCompletedSastScan,
}