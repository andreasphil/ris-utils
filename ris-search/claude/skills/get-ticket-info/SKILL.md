---
name: get-ticket-info
description: fetches the information about the work that should be done on the current branch. Use when the user tells you to "get the ticket info"
---

1. Determine the ticket number associated with the current branch; this will be a Jira ticket following this pattern: `risdev-\d+` at the beginning of the branch name.
2. If there is no ticket number, cancel.
3. If there is a ticket number, you can retrieve the description by running the following shell command: `acli jira workitem view <ticket-number>`
4. Use this information as additional context when planning work on a task on a given branch.
