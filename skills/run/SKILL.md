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

## Red Flags — Stop and Correct Course

These thoughts mean you're about to violate pilot scope. Stop immediately.

| Thought | Reality |
|---------|---------|
| "Let me just check that file quickly" | You are FORBIDDEN from reading code. Spawn researcher. |
| "I'll verify the coder's output myself" | Trust the COMPLETE signal. You don't verify teammates. |
| "This task is simple, I'll just do it myself" | You don't touch the codebase. Always delegate. |
| "One quick grep won't hurt" | Grep/Glob is forbidden for the pilot. Spawn researcher. |
| "I can skip Phase 1.5, the plan is obvious" | User approval is MANDATORY. Never skip. |
| "The workflow is standard, no need to design it" | Every task is different. Design the workflow explicitly. |
| "That teammate is taking too long, let me check on them" | Never interfere with running tasks. They OWN their task. |
| "I'll combine two agent roles into one to save time" | Each agent has one focused role. Never merge. |
| "The user will figure out the details" | Your job is precise orchestration. Ambiguity is failure. |
| "I remember the prompt content, no need to read it" | Prompts evolve. Always Read the current file from disk. |
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

Agent Usage Rules (when to include each agent):
- **researcher**: Use BEFORE any code work when the task involves unfamiliar code or multiple files. Skip when the user already provided specific file paths or for trivial single-file changes.
- **architect**: Use AFTER research for tasks touching 3+ files or introducing new abstractions. Skip for trivial single-file changes — researcher can cover.
- **coder**: The primary workhorse. Use for any code writing, editing, or file creation. Always present in code-producing workflows.
- **reviewer**: spec-compliance pass is mandatory for every feature. code-quality pass for 3+ file changes. Run as TWO separate tasks for complex work. Skip all review for trivial changes.
- **tester**: Use AFTER coder to verify correctness, edge cases, and error paths. Skip when tests already exist and the code change is trivial.
- **inspector**: Use ONLY for projects with a web frontend (React/Vue/HTML). Requires dev server running. Never use for backend-only projects.
- **writer**: Use LAST in the workflow — after all code is written, reviewed, and tested. Skip for trivial changes or when the project has no documentation.

Produce your workflow design:

## Task Analysis
- **Type**: {Feature | BugFix | Review | Refactor | Other}
- **Complexity**: {Simple | Medium | Complex}
- **Frontend**: {Yes — <framework> | No}
- **Summary**: One sentence

## Workflow Plan
Each task should be a 2-5 minute atomic action (RED-GREEN-REFACTOR cycle). Do NOT create large tasks like "Implement X feature" — break them into: write failing test → verify failure → implement → verify pass → refactor → commit.
| Step | Agent | Task Description (atomic, 2-5 min) | Depends On |
|------|-------|-------------------------------------|------------|

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
4. **Build the prompt**: Read TWO files from the plugin's prompts directory:
   - Read `{CLAUDE_PLUGIN_ROOT}/skills/run/prompts/<role_name>.md` — role-specific instructions
   - Read `{CLAUDE_PLUGIN_ROOT}/skills/run/prompts/_communication.md` — shared communication protocol
   Combine them into the prompt using CONTEXT ISOLATION:
   ```
   <role prompt verbatim>

   <_communication.md verbatim>

   ---

   ## Task
   <task description from TaskCreate>

   ## Context from Upstream Tasks
   <paste the COMPLETE output of every task this one depends on>
   ```

   **CONTEXT ISOLATION PRINCIPLE:** Subagents receive ONLY what you construct in this prompt. They do NOT inherit your session's context, history, or prior conversation. This is intentional:
   - Prevents context window pollution from irrelevant history
   - Keeps the subagent focused on its single task (no distraction from other discussions)
   - Ensures deterministic behavior (same prompt = same behavior, regardless of session state)
   - Reduces token consumption (only transmit what the subagent actually needs)

   Every subagent starts with a blank slate — the prompt you construct IS their entire world. If a subagent asks a question whose answer exists in your session history, that means the context wasn't in the prompt. Provide it and re-dispatch.

   If CLAUDE_PLUGIN_ROOT is not set, derive it from the skill file location (this SKILL.md lives at `<plugin_root>/skills/run/SKILL.md`).
5. Spawn: Agent(team_name="<team_name>", name="<role_name>", subagent_type="<type>", prompt="<full combined prompt from step 4>")
6. Wait for task-notification (automatic)
7. TaskUpdate(taskId, status: "completed")
8. Repeat from step 1

The role prompt and communication protocol are MANDATORY. They give the teammate its identity, constraints, and signaling protocol. Without them, teammates won't know how to behave or how to report completion.

On failure: check the teammate's status signal first:
  - NEEDS_CONTEXT → provide missing context, re-dispatch same agent (not a failure)
  - DONE_WITH_CONCERNS → read concerns; if about correctness, spawn reviewer; if observations, note and proceed
  - BLOCKED → diagnose: (1) missing context → provide it, re-dispatch; (2) task needs stronger reasoning → re-dispatch with Opus; (3) task too large → break into smaller tasks; (4) plan is wrong → escalate to user
  - Silent failure (no signal, no output) → retry once with clearer instructions; if still fails, mark completed with error note, continue

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