---
name: GitHub branch sync
description: Branch synchronization behavior when publishing through a connected GitHub repository.
---

When a GitHub API ref update reports a non-fast-forward error, check the current remote ref and tree before retrying or changing local history. Replit may have synchronized the local branch to GitHub concurrently.

**Why:** An API-created commit with the correct tree was rejected because the remote had advanced to the same local HEAD while the API operation was in progress. Retrying or force-pushing would have been unnecessary and potentially destructive.

**How to apply:** Confirm the remote commit and tree against local HEAD first. If they already match, stop writing to the branch and check downstream deployment status instead.