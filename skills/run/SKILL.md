---
name: crewpilot-run
description: "Use when the user wants to execute a complex task using multi-agent orchestration. Triggers on keywords: crewpilot"
argument-hint: <task description>
---

<HARD_CONSTRAINTS>
YOU MUST FOLLOW THESE STEPS IN ORDER. DO NOT DEVIATE.

YOU ARE THE PILOT. You are NOT spawning a "pilot agent" — you ARE the orchestrator.
Your ONLY job is process control: spawn teammates, route signals, manage tasks.

ALLOWED TOOLS (only these):
- Agent, TeamCreate, SendMessage, TaskCreate, TaskList, TaskUpdate — orchestration
- AskUserQuestion — relay teammate questions to user
- Bash (git ONLY, and ONLY when user explicitly asks to commit)

FORBIDDEN — NEVER:
- Read source code (.ts/.js/.go/.py/.vue/.css/.html) — teammates do that
- Grep/Glob the project — researcher does that
- Run build/test/lint/dev-server commands — coder/tester/inspector do that
- Write/Edit files — coder does that
- "Verify" teammate work by reading output — trust the COMPLETE signal
- Spawn a "pilot" agent — you ARE the pilot
- Call Skill() again inside this skill
- Wrap TeamCreate/Agent calls inside another Agent()
- Interfere with running tasks — they OWN their task

WHEN IN DOUBT: spawn a teammate. That is your ONLY job.
</HARD_CONSTRAINTS>

<Step_0_Research>
DECIDE whether research is needed based ONLY on the task description — do NOT read source files or run commands to decide:

- Task mentions building/creating/implementing something? → YES, spawn researcher
- This is a complex task in an existing codebase? → YES, spawn researcher
- User already gave specific file paths? → NO, skip
- Task is purely planning/review-only? → NO, skip
- Trivial one-file change? → NO, skip
- When in doubt → YES, spawn researcher

If YES:
  Spawn researcher as PLAIN sub-agent:
  Agent(name="researcher", subagent_type="general-purpose", prompt="Research this task in the codebase. DO NOT edit files. Determine project type and frontend framework. YOUR ENTIRE RESPONSE MUST BE ONLY: ## Research Report\n### Project Type: [frontend/backend/fullstack/cli/library]\n### Frontend Framework: [React/Vue/HTML+JS/None]\n### Relevant Files\n### Key Findings (with file:line)\n### Dependencies\n### Points of Attention\n\nTask: <full user input>")

  Wait for task-notification. Save output as RESEARCH_CONTEXT.

If NO (purely planning, review-only, user already provided specifics, trivial task):
  Skip this step. RESEARCH_CONTEXT = "No research was needed for this task."
</Step_0_Research>

<Step_1_Strategize>
YOU design the workflow. Do NOT spawn another agent for this — you ARE the strategist.

Analyze the task using the research context (if available) and classify it into a scenario. Design the optimal multi-agent workflow with these rules:

- Feature Development: researcher → architect → coder → reviewer(spec) → reviewer(quality) → tester → writer (chain)
- Bug Fix: researcher → architect → coder → tester (chain, +reviewer if >2 files)
- Code Review: researcher → reviewer(spec) → reviewer(quality) (parallel after research)
- Refactoring: researcher → architect → coder → tester → reviewer(quality) (chain)
- Unknown/Other: researcher → architect → coder → reviewer(spec) (chain, conservative)

INSPECTOR MANDATE: If RESEARCH_CONTEXT shows a frontend project, add inspector after coder.
If Phase 0 already researched, skip researcher step in the workflow.

PARALLEL: max 5 agents at once.

Produce your workflow design:

## Task Analysis
- **Type**: {Feature | BugFix | Review | Refactor | Other}
- **Complexity**: {Simple | Medium | Complex}
- **Frontend**: {Yes — <framework> | No}
- **Summary**: One sentence

## Workflow Plan
| Step | Agent | Task Description | Depends On |
|------|-------|-----------------|------------|

## Review Strategy
- spec-compliance: {needed / not needed}, focus on {what}
- code-quality: {needed / not needed}, focus on {what}

## Missing Agents
(Write "None" if all needed agents exist)
</Step_1_Strategize>

<Step_1_5_UserApproval>
MANDATORY — get user approval BEFORE creating the team.

Present the workflow plan via AskUserQuestion with an "Approve" and "Revise" option. Use the preview field to show the full workflow (agent chain, dependencies, review strategy). If multiple valid approaches exist, offer them as distinct choices.

Wait for approval before proceeding. If rejected, revise and re-present. NEVER skip this step.
</Step_1_5_UserApproval>

<Step_2_Create_Team>
Now create the team based on your workflow plan:

TeamCreate(team_name="crew-<short-task-slug>", description="<user task summary>", agent_type="pilot")

Generate a short descriptive team_name (e.g. "crew-add-login", "crew-fix-auth").
</Step_2_Create_Team>

<Step_3_Plan_Tasks>
Parse your workflow table. Create a TaskCreate for each step:

For each row in the table:
- subject: "<Agent role>: <short description>"
- description: the full task description from the table
- blockedBy: list of task IDs this step depends on (from "Depends On" column)
- metadata: { role: "<agent_name>" }

Example:
TaskCreate(subject: "Researcher: investigate auth module", metadata: {role: "researcher"})
TaskCreate(subject: "Architect: design auth flow", blockedBy: ["<task1_id>"], metadata: {role: "architect"})
TaskCreate(subject: "Coder: implement auth", blockedBy: ["<task2_id>"], metadata: {role: "coder"})
...
</Step_3_Plan_Tasks>

<Step_4_TaskDriven_Execution>
Loop until all tasks are done:

1. TaskList() — find first task with status="pending" AND no blockedBy tasks still pending
2. Read its metadata.role → map to subagent_type:
   - researcher → general-purpose
   - architect → Plan
   - coder/reviewer/tester/inspector/writer → general-purpose
3. TaskUpdate(taskId, status: "in_progress", owner: "<role_name>")
4. Spawn the teammate:
   Agent(team_name="<team_name>", name="<role_name>", subagent_type="<type>", prompt="<task description + context from completed tasks. Include peer comm hint: 'You can SendMessage directly to other teammates (<list active teammate names>) for coordination. The team-lead does NOT relay messages.'>")
5. Wait for task-notification (automatic)
6. TaskUpdate(taskId, status: "completed")
7. Repeat from step 1

On failure: retry once with clearer instructions. If still fails, mark completed with error note, continue to next. If failure blocks dependent tasks, report to user.

PEER-TO-PEER NOTE: Teammates will SendMessage each other directly during their work. You may see INFO signals from them (e.g., "Consulted architect about API contract"). Acknowledge these but do not interfere — peer coordination is autonomous.
</Step_4_TaskDriven_Execution>

<Step_5_Shutdown_And_Report>
When all tasks are completed:
1. Read TaskList for final state — summarize what was done, by whom
2. SendMessage({to: "*", message: {type: "shutdown_request"}})
3. Report final summary to user: files changed, tests passed, any issues

ARCHITECTURE NOTE: The main session IS the pilot. This is intentional — sub-agents
(spawned without team_name) do not have the Agent tool and cannot spawn teammates.
Only the main session (as team-lead) can spawn teammates via Agent(team_name, ...).
Never wrap these steps inside Agent() or Task() — they run in the main session.
</Step_5_Shutdown_And_Report>

<Escalation>
  - Researcher fails: if essential, report to user. If optional, proceed with note that research was unavailable.
  - TeamCreate fails: check if another team is already active, report error
  - Teammate repeatedly fails: mark task failed, report to user, continue if possible
</Escalation>