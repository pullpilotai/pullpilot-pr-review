/* eslint-disable @typescript-eslint/no-explicit-any */

import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {HttpClient, HttpClientResponse} from "@actions/http-client";
import * as Http from "http";
import {IncomingHttpHeaders, IncomingMessage} from "http";
import {Context} from "@actions/github/lib/context";
import {TypedResponse} from '@actions/http-client/lib/interfaces'
import {clearInterval} from "timers";

type Format = "space-delimited" | "csv" | "json";

interface PullPilotResponseData {
  text: string,
  cost?: Number,
  tokens?: Number
}

interface PullPilotJobResponseData {
  job_uuid: string
}

async function run(): Promise<void> {
  try {
    // Create GitHub client with the API token.
    const github_token = core.getInput("token", { required: true })
    const pull_pilot_token = core.getInput("pull_pilot_token", { required: true});
    const pull_pilot_retry_seconds = core.getInput("pull_pilot_retry", { required: false }) || 20;

    //const baseUrl = "https://api.pullpilot.ai";
    const baseUrl = "https://1011-2001-4bb8-190-6e43-8078-c8f9-bf1e-2293.eu.ngrok.io"

    const client = getOctokit(github_token);

    // Get event name.
    const eventName = context.eventName;

    switch (eventName) {
      case "pull_request":
      case "push":
        break;
      default:
        core.setFailed(
          `This action only supports pull requests and pushes, ${context.eventName} events are not supported. ` +
            "Please submit an issue on this action's GitHub repo if you believe this in correct."
        );
    }
    const response = await client.rest.pulls.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: context.payload.pull_request?.number || 0,
      mediaType: {
        format: "diff"
      }
    });

    // Ensure that the request was successful.
    if (response.status !== 200) {
      core.setFailed(
        `The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200. ` +
          "Please submit an issue on this action's GitHub repo."
      );
    }

    let content = false;
    const gitignoreResponse = await client.rest.repos.getContent({
      owner: context.repo.owner,
      repo: context.repo.repo,
      path: '.gitignore',
    }).then(result => {
      // @ts-ignore
      content = result.data?.content || 'NOOO';
    });

    console.log(content);
    return;

    // The diff received from the pull request.
    const diff = response.data;

    const http: HttpClient = new HttpClient('pullpilot-ga');
    const jobUri = `${baseUrl}/recommend`;

    if (JSON.stringify(diff).length / 2.5 > 5000) {
      core.info("Pull Pilot: This is a pretty large diff file. It might take a good few minutes for this run to complete.");
    }

    // First we will add the recommendation job to the queue.
    const pullpilotJobResponse = await http.postJson<PullPilotJobResponseData>(jobUri, {
      diff: diff,  // The actual diff to run in the PR review
      pr_number: context.payload.pull_request?.number,  // Optional PR number.
      repo: context.payload.repository.name  // Optional Repository Name.
    }, {
      "X_PULLPILOT_KEY": `${pull_pilot_token}`
    });

    /**
     * This is the response from the job call. It should contain
     * the values listed in the `PullPilotJobResponseData` interface.
     */
    const body = pullpilotJobResponse.result;
    if (!body.job_uuid) {
      core.setFailed(
          "Pull Pilot didn't receive a recommendation job so " +
          "you haven't been charged and the PR review has been aborted. " +
          "Please try re-running this job."
      );
    }

    const jobUuid = body.job_uuid;
    const checkUri = `${baseUrl}/recommend/${jobUuid}`;

    /**
     * Then we will be polling to figure out whether
     * the job has started or finished already.
     *
     * This is important for the internal mechanics of Github Actions
     * as well as the deployment server which kill idle connections after
     * 60 seconds.
     *
     * Usage:
     *   In your action definition, you can pass: pull_pilot_retry: 10
     */
    const pollSeconds = Number(pull_pilot_retry_seconds);

    /**
     * Let the user know if it fails, we should get to here.
     */
    core.info(
        `Pull Pilot: In case of failure, the Pull Pilot team can help ` +
        `if you give them the recommendation job id: ${jobUuid}`
    );

    const poll = setInterval(async () => {
      let pullPilotResponse;
      try {
        pullPilotResponse = await http.getJson<PullPilotResponseData>(checkUri, {
          "X_PULLPILOT_KEY": `${pull_pilot_token}`
        });
      } catch (e) {
        core.setFailed(
            `Pull Pilot encountered an error. Please try to re-run this job. ` +
            `If this continues, the Pull Pilot team can help you. Give them "${jobUuid}"`
        );
        clearInterval(poll);
        return;
      }

      /**
       * 404 is returned when the job is processing.
       */
      if (pullPilotResponse.statusCode === 404) {
        core.info(`Pull Pilot is still running on this Pull Request. Checking again in ${pollSeconds} seconds.`);
        return;
      }

      /**
       * This is returned when the API key doesn't work, OR possibly if the user making get requests
       * is using a different key than the one used to POST to the /recommend endpoint.
       *
       * It should never happen here but we may as well handle the case.
       */
      if (pullPilotResponse.statusCode === 403) {
        core.setFailed(
            `Pull Pilot is attempting to request a job-id with an invalid/different key.`
        );
        clearInterval(poll);
        return;
      }

      /**
       * Check if the API returns a 503. This happens when OpenAI is down, encounters rate limits or any exception.
       */
      if (pullPilotResponse.statusCode === 503) {
        core.setFailed(
            `Pull Pilot encountered a problem processing this PR\n${pullPilotResponse.statusMessage}\nPlease try again.`
        );
        clearInterval(poll);
        return;
      }

      let jobResponse  = pullPilotResponse.result;

      await client.rest.issues.createComment({
        ...context.repo,
        issue_number: context.payload.pull_request.number,
        body: `${jobResponse.text}`
      });

      core.setOutput("feedback", `${jobResponse.text}`);
      clearInterval(poll)
    }, pollSeconds * 1000);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
