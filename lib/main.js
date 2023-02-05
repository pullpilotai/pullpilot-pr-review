var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as core from "@actions/core";
import { context, GitHub } from "@actions/github";
function run() {
    var _a, _b, _c, _d, _e;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = new GitHub(core.getInput("token", { required: true }));
            const format = core.getInput("format", { required: true });
            const myToken = core.getInput("token");
            if (format !== "space-delimited" && format !== "csv" && format !== "json") {
                core.setFailed(`Format must be one of 'string-delimited', 'csv', or 'json', got '${format}'.`);
            }
            core.debug(`Payload keys: ${Object.keys(context.payload)}`);
            core.info(myToken);
            const eventName = context.eventName;
            let base;
            let head;
            switch (eventName) {
                case "pull_request":
                    base = (_b = (_a = context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.base) === null || _b === void 0 ? void 0 : _b.sha;
                    head = (_d = (_c = context.payload.pull_request) === null || _c === void 0 ? void 0 : _c.head) === null || _d === void 0 ? void 0 : _d.sha;
                    break;
                case "push":
                    base = context.payload.before;
                    head = context.payload.after;
                    break;
                default:
                    core.setFailed(`This action only supports pull requests and pushes, ${context.eventName} events are not supported. ` +
                        "Please submit an issue on this action's GitHub repo if you believe this in correct.");
            }
            core.info(`Base commit: ${base}`);
            core.info(`Head commit: ${head}`);
            if (!base || !head) {
                core.setFailed(`The base and head commits are missing from the payload for this ${context.eventName} event. ` +
                    "Please submit an issue on this action's GitHub repo.");
                base = "";
                head = "";
            }
            core.info(JSON.stringify(context.payload.pull_request));
            const response = yield client.pulls.get({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: ((_e = context.payload.pull_request) === null || _e === void 0 ? void 0 : _e.number) || 0,
                mediaType: {
                    format: "diff"
                }
            });
            core.info(JSON.stringify(response.data));
            if (response.status !== 200) {
                core.setFailed(`The GitHub API for comparing the base and head commits for this ${context.eventName} event returned ${response.status}, expected 200. ` +
                    "Please submit an issue on this action's GitHub repo.");
            }
            core.setOutput("feedback", "Awesome");
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();
//# sourceMappingURL=main.js.map