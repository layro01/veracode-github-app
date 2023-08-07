<!-- markdownlint-disable MD005 -->
<!-- markdownlint-disable MD029 -->
# veracode-github-app

> A GitHub App built with [Probot](https://github.com/probot/probot) A Probot app

## Building and Running the App

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Docker

```sh
# 1. Build container
docker build -t veracode-github-app .

# 2. Start container
docker run -e APP_ID=<app-id> -e PRIVATE_KEY=<pem-value> veracode-github-app
```

## Debugging Locally via VS Code

The following explains how to debug locally on MacOS or in Windows WSL2.

### Prerequisites

- Install the following:
  - VS Code ([link](https://code.visualstudio.com/download))
  - Docker Desktop ([link](https://docs.docker.com/desktop/install))
  - ngrok ([link](https://dashboard.ngrok.com/get-started/setup)) - note you will need to create an account
- Create the `veracode-github-app` in a GitHub organization:
  - You must have a GitHub account to install the Veracode GitHub App into that contains at least one Maven or Gradle based Java repository that compiles successfully and produces a `.jar`, `.war` or `.ear` file. You can use [jtsmith2020/verademo-java](https://github.com/jtsmith2020/verademo-java) if you do not already have a Java application to test against.
  - Make sure you can build and run the `veracode-github-app` using the steps in [Building and Running the App](#building-and-running-the-app).
  - Once the `veracode-github-app` is running, navigate to [http://localhost:3000](http://localhost:3000).
  - If this is the first time you have run the app, you should see a **Getting Started** page. Follow the steps documented in the Probot [Configuring a GitHub App](https://probot.github.io/docs/development/#configuring-a-github-app) documentation to install the app into the default Organization associated with your GitHub account.
  - Setup the necessary GitHub actions to trigger workflows that scan your Java application:
    - Fork the [vincentdeng-veracode/veracode](https://github.com/vincentdeng-veracode/veracode) repo into your GitHub Organization.
    - In your forked `veracode` repository, navigate to **_Actions_** and make sure that actions are enabled for this repository.
    - Next, navigate to **_Settings/Secrets and Variables/Actions_** and set the following three Repository secrets:
      - `API_ID`: A Veracode API ID associated with an account that can perform Static scans.
      - `API_KEY`: A Veracode API Secret Key associated with an account that can perform Static scans.
      - `SRCCLR_API_TOKEN`: A Veracode SCA Agent token associated with the SCA Workspace you wish to perform scans against.

### Debug Setup Steps

1. From a terminal, enter the following to start an ngrok local tunnel:

  ```bash
  ngrok http 3000
  ```

2. Look for the **Forwarding** public ngrok URL in the output of the above command (this should be something like [https://abc0-123-456-78-910.ngrok.io](https://abc0-123-456-78-910.ngrok.io)). Copy this URL into the `ngrok` constant in [src/utils/constants.js](https://github.com/vincent-deng/veracode-github-app/blob/a61fb3b58083a4df7a307a6d04c6199591a1dd9b/src/utils/constants.js#L3).

3. You need to run a local DynamDB instance to store state information on running scan workflows. To do this, first install dynamodb-admin using the following command:

  ```bash
  npm install -g dynamodb-admin
  ```
  Then start DynamoDB locally using the following command:

  ```bash
  docker run -d -p 8000:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb
  ```

  Finally, navigate to the dynamodb-admin console using one of the following commands.

  On Mac / Linux:

  ```bash
  dynamodb-admin
  ```

  On Windows:

  ```bash
  DYNAMO_ENDPOINT=http://localhost:8000 dynamodb-admin
  ```

4. Navigate to the DynamoDB console at [http://localhost:8000](http://localhost:8000) and add select **_Create Table_** to add a scan state table with the following settings and select **_Submit_**:

   - **Table Name:** `veracode-github-app`
   - **Hash Attribute Name:** `run_id`
   - **Hash Attribute Type:** Number

  You will need to do this each time you restart the database. Nice.

5. In your [GitHub Developer App Settings](https://github.com/settings/apps), select the `veracode-github-app` you installed in the prerequisites and make sure that the following entries match your local configuration values:
   - **App ID:** number listed on this page matches the `APP_ID` value in your local `.env` file.
   - **Webhook URL:** matches the `ngrok` forwarding URL in [/src/utils/constants.js](https://github.com/vincent-deng/veracode-github-app/blob/aws-ecs-dynamodb/src/utils/constants.js). **This value will change each time you restart the ngrok proxy, so you'll need to pay attention to this value and make sure it matches the value you used in step 2**.

6. Select **_Run and Debug > Launch Probot_** to start a debug session for the Probot app. Some useful first breakpoints are on the webhook routes located in [/src/index.js](https://github.com/vincent-deng/veracode-github-app/blob/main/src/index.js).

7. Clone your Maven or Gradle based Java repository and start to make some changes to see everything working. The basic development flow you should follow is:

   1. Create a new branch for your Java project.
   2. Make some changes in the branch, commit and push them.
   3. In GitHub, create a PR for the changes, you should find that breakpoints are triggered as the webhook associated with the GitHub events are fired.
   4. Repeat steps 2 and 3 over and over.

### Debugging Hints

- Set breakpoints at the entry points for the webhooks that are triggered on veracode-github-app. These are located in [/src/index.js](https://github.com/vincent-deng/veracode-github-app/blob/main/src/index.js). Specifically, you should look at adding these against the `push`, `workflow_run.completed` and `register` hooks.

## Contributing

If you have suggestions for how veracode-github-app could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

[ISC](LICENSE) © 2023 Vincent Deng
