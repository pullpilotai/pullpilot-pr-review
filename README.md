# Pull Pilot Github Action 

This receives a diff and processes the various steps of review.

## Example usage

```yml
name: "Pull Pilot PR Reviewer"

on: pull_request
permissions: write-all
jobs:
  pullpilot:
    runs-on: ubuntu-latest
    steps:
      - name: Pull Pilot Review
        id: pr_review
        uses: pullpilotai/pullpilot-pr-review@main
        with:
            token: ${{ secrets.GITHUB_TOKEN }}
            pull_pilot_token: ${{ secrets.PULL_PILOT_KEY }}
```



