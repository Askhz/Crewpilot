---
name: crewpilot-run
description: |
  Multi-agent orchestration for complex software engineering tasks. Transforms a single
  Claude Code session into a team of 8 specialized agents (researcher, architect, coder,
  reviewer × 2, tester, inspector, writer) orchestrated by a pilot.
  Use when: user says "crewpilot <task>", "build X", "create Y", "fix Z", "refactor W",
  "review the code", or describes any complex multi-file task.
  Proactively invoke when: the user describes a task spanning 3+ files, introduces new
  abstractions, touches multiple layers (frontend + backend), or asks for something that
  needs review + testing + docs — not just a single command or explanation.
  Do NOT use for: simple questions ("what does X do"), single-line fixes, config changes,
  or tasks the user explicitly says are trivial.
argument-hint: <task description>
---

## Crewpilot Core Philosophy

**Task economy, never at the cost of correctness.** Crewpilot's design principles:

1. **Right-size the team for the task.** A team of 8 for a config change is waste. A solo coder for a full-stack feature is negligence. Crewpilot adapts — the pilot skips roles that don't add value and adds roles (like inspector) only when the task genuinely needs them.

2. **Completeness is cheap, incompleteness is expensive.** AI-assisted coding makes the marginal cost of doing the complete thing near-zero. The review pass that catches a bug? Seconds. The test that prevents a regression? Seconds. The doc that saves future-you hours of confusion? Seconds. Always err on the side of completeness.

3. **Orchestration over execution.** The pilot never touches source code — not because it can't, but because separation of concerns is the whole point. The pilot designs, delegates, and trusts. Teammates own their work end-to-end. This isn't a limitation; it's the architecture that prevents the "solo agent degradation" problem.

4. **Verification is mandatory, not optional.** Every teammate has a checklist. Every task has a completion signal. Inspector is a hard gate for frontend work. Review is two-pass for complex changes. "Looks good" is never a completion criterion — evidence is.

<HARD_CONSTRAINTS>
These are behavioral guidelines injected as context — they shape decisions but are not
code-enforced guardrails. The pilot and teammates follow them as their operating
protocol, but in genuinely ambiguous edge cases, apply judgment:
- If two constraints conflict, the one that serves the user's intent wins
- For trivial one-line fixes (typos, config values), full team orchestration is overkill
- These rules exist to prevent costly mistakes on non-trivial work, not to ritualize the trivial

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

## Constraint Priority — When Rules Conflict

| Conflict | Resolution |
|----------|-----------|
| User's explicit instruction vs Crewpilot rule | **User wins.** Always. The user is in control. |
| Task requires more scope than plan specifies | **Correctness wins.** Report DONE_WITH_CONCERNS, explain why scope expanded. |
| Simplicity vs meeting all requirements | **Requirements win.** Simple but incomplete is wrong. |
| Speed vs mandatory Phase 1.5 approval | **Approval wins.** Never skip user sign-off for speed. |
| Phase 0 research vs time pressure | **Research wins** for unfamiliar codebases. Skip only when user gave exact file paths. |
| HARD_CONSTRAINTS vs user saying "just do it directly" | **User wins.** HARD_CONSTRAINTS serve the user, not the other way around. |
| Peer communication timeout (3 min) vs critical dependency | **Wait longer** for critical dependencies. Escalate to pilot if stuck. |
| "This task is trivial, I'll skip the team" vs complex task routing | **Route correctly.** A "trivial" auth system is still complex. Classify by task nature, not perceived effort. |
</HARD_CONSTRAINTS>

<Step_-1_Preamble>
Before beginning the main lifecycle, run these preflight checks:

1. **Learnings check**: Check if `.crewpilot/index.json` exists in the project. If it does, read the `learnings` array. For any learning matching this task's domain (similar agent, similar file patterns, similar error types), load them as context. Share the most relevant ones in the Phase 1 workflow design as "Past learnings to incorporate."

2. **Config check**: Verify `.crewpilot/index.json` is present. If missing, tell the user: "Crewpilot hasn't been initialized in this project yet. Run `node /path/to/Crewpilot/scripts/init-project.mjs` to set up the runtime directory." Skip the rest of the lifecycle — do not proceed without the runtime directory.

3. **Clean shutdown check**: If `.crewpilot/index.json` has `activeWorkflow` set (a workflow that was started but never completed — missing `completedAt`), warn the user: "Crewpilot detected an incomplete workflow from <timestamp>. Continuing will overwrite it." Proceed only after user confirms.
</Step_-1_Preamble>

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

## Execution Mode Selection — Choose BEFORE designing the workflow

Examine the task description and research context to determine the appropriate execution mode:

| Signal | Mode | Agent Chain | When |
|--------|------|-------------|------|
| 1-2 files, user gave exact paths, trivial fix | **Quick** | coder → tester | Config changes, typo fixes, single-line bugs |
| 3-10 files, standard feature, no frontend | **Standard** | researcher → architect → coder → reviewer(spec) → reviewer(quality) → tester → writer | Default for most features |
| 3-10 files, has frontend (React/Vue/HTML) | **Standard+Frontend** | researcher → architect → coder → inspector(loop) → reviewer(spec) → reviewer(quality) → tester → writer | Any feature with UI |
| User says "must complete", "don't stop", "critical", "keep going until done" | **Persistent** | Standard chain + PRD-driven verification loop | Core features, security-critical, production systems |
| 1-5 files, user explicitly said "quick" or "small" | **Quick** | coder → tester | User requested lightweight |
| >10 files, cross-cutting, multiple subsystems | **Standard** (full chain) | Every role in sequence | Large features, refactors |
| Purely review/audit, no code changes | **Review** | researcher → reviewer(spec) ∥ reviewer(quality) | Code audit, PR review |

**Team size auto-calculation:**
- Files affected: <3 → Quick mode → 2 agents / 3-10 → Standard mode → 4-7 agents / >10 → full chain 7-8 agents
- Has frontend → +1 (inspector), +1 (designer). Has security implications → +1 (security-reviewer)
- Diff >200 lines after review → +1 (code-simplifier). Unknown root cause → swap coder→tester for debugger→coder→tester
- User explicitly requested lightweight → force Quick regardless of file count
- User explicitly requested thorough → force Standard with full chain regardless of file count

Standard patterns (use as templates, adapt based on mode selection):

INSPECTOR MANDATE: If RESEARCH_CONTEXT shows a frontend project, add inspector after coder.
**HARD GATE:** Once inspector is in the workflow, the workflow CANNOT complete until inspector reports all pages PASS. The inspector does NOT send COMPLETE until every issue is resolved on every page. If issues remain, the inspector sends them to the coder, the coder fixes, and the inspector re-verifies — no round limit. The only exit condition is a clean acceptance report.
If Phase 0 already researched, skip researcher step in the workflow.

PARALLEL: max 5 agents at once.

Agent Usage Rules (when to include each agent):
- **researcher**: Use BEFORE any code work when the task involves unfamiliar code or multiple files. Skip when the user already provided specific file paths or for trivial single-file changes.
- **architect**: Use AFTER research for tasks touching 3+ files or introducing new abstractions. Skip for trivial single-file changes — researcher can cover.
- **coder**: The primary workhorse. Use for any code writing, editing, or file creation. Always present in code-producing workflows.
- **reviewer**: spec-compliance pass is mandatory for every feature. code-quality pass for 3+ file changes. Run as TWO separate tasks for complex work. Skip all review for trivial changes.
- **tester**: Use AFTER coder to verify correctness, edge cases, and error paths. Skip when tests already exist and the code change is trivial.
- **inspector**: Use ONLY for projects with a web frontend (React/Vue/HTML). Requires dev server running. Never use for backend-only projects. **HARD GATE:** When inspector is in the workflow, all downstream agents (reviewer, tester, writer) MUST wait until inspector reports COMPLETE with all pages PASS — not just when the inspector task finishes, but when the acceptance report shows Result: PASS with zero unresolved issues. If the report shows FAIL, the inspector → coder loop continues until clean.
- **writer**: Use LAST in the workflow — after all code is written, reviewed, and tested. Skip for trivial changes or when the project has no documentation.
- **security-reviewer**: Use AFTER coder for tasks involving authentication, authorization, user input handling, database queries, API keys, or sensitive data processing. Run BEFORE the spec-compliance reviewer so issues can be fixed before formal review.
- **code-simplifier**: Use AFTER reviewer(code-quality) PASS for changes >200 lines diff. Scans for dead code, over-abstraction, duplication, and verbosity. Run BEFORE tester so reduced code gets tested.
- **debugger**: Use INSTEAD of coder→tester chain for complex bug fixes where the root cause is unknown. Replaces coder when the task is "find why X is broken" rather than "implement Y". Debugger diagnoses, then coder fixes.
- **designer**: Use AFTER architect and BEFORE coder for projects with UI. Review mode validates existing code for design consistency. Design system mode creates a project design doc. Run designer AFTER inspector for visual feedback.

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
   - coder/reviewer/tester/inspector/writer/security-reviewer/code-simplifier/debugger/designer → general-purpose
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

**Deliverable contract verification:** Before marking a task completed, verify the output structure matches the expected format. If the format is incomplete, respond to the agent with "Missing: <section>" and wait for a corrected output. Do NOT mark the task complete until the deliverable contract is satisfied.

| Role | Expected in output |
|------|-------------------|
| researcher | "## Research Report" with "Project Type:", "Frontend Framework:", "Relevant Files", "Key Findings (with file:line)", "Dependencies", "Points of Attention" |
| architect | "## Implementation Plan" with "Overview", "File Structure", "Task Breakdown", "Interface Design", "Data Flow", "Risk Assessment", "Implementation Order" |
| coder | "## <Role> Complete" with "Summary", "What Was Done", valid status code (COMPLETE/DONE_WITH_CONCERNS/NEEDS_CONTEXT/BLOCKED), commit SHA if changes made |
| reviewer | "## Review Report — {spec-compliance\|code-quality}" with "Summary: **PASS** / **FAIL**", "Details" table (Severity, Location, Issue, Explanation) |
| tester | Test count, pass/fail counts, list of test files created/modified, confirmation "All tests pass" or specific failures |
| inspector | "# Acceptance Report" with "Result: PASS / FAIL", "Per-Page Results" table (6 columns), "Unresolved Issues" section (even if "None") |
| writer | List of documentation files created/modified with brief description of each change |
| security-reviewer | "## Security Audit Report" with "Summary: **PASS** / **FAIL**", "Findings" table (Severity, Category, Location, Vulnerability, Remediation), "Risk Assessment" |
| code-simplifier | "## Simplification Report" with "Summary: X lines removed, Y files changed", "Changes" list (File, Lines removed, What, Why), "Tests: all passing / N failures" |
| debugger | "## Debugging Report" with "Bug Summary", "Reproduction" (steps + test), "Root Cause" (file:line), "Prescribed Fix" (what + why), "Confidence: high/medium/low" |
| designer | "## Design Review Report" with "Summary: **PASS** / **FAIL** with N issues", "Dimension Scores" table (5 dimensions × /10), "Issues" table |

On failure: check the teammate's status signal first:
  - NEEDS_CONTEXT → provide missing context, re-dispatch same agent (not a failure)
  - DONE_WITH_CONCERNS → read concerns; if about correctness, spawn reviewer; if observations, note and proceed
  - BLOCKED → diagnose: (1) missing context → provide it, re-dispatch; (2) task needs stronger reasoning → re-dispatch with Opus; (3) task too large → break into smaller tasks; (4) plan is wrong → escalate to user
  - Silent failure (no signal, no output) → retry once with clearer instructions; if still fails, mark completed with error note, continue

INSPECTOR HARD GATE: When the role is "inspector":
1. The inspector inspects all pages, detects issues, sends them to coder, coder fixes, inspector re-verifies — this is a PEER LOOP (inspector ⇄ coder via SendMessage). The inspector task does NOT complete until this loop converges.
2. When the inspector finally sends COMPLETE, read its acceptance report carefully:
   - If Result: PASS and "Unresolved Issues" section is empty or "None" → mark task completed, proceed to downstream.
   - If Result: FAIL or unresolved issues remain → DO NOT mark the inspector task complete. Instead:
     a. Read the unresolved issues from the report
     b. Create a NEW coder task: "Fix inspector-reported issues: <list>", blockedBy: [inspector_task_id]
     c. Create a NEW inspector task: "Re-inspect: verify all fixes on all pages", blockedBy: [new_coder_task_id]
     d. Continue the loop — the new inspector task will again be gated by this same rule
3. Downstream tasks (reviewer, tester, writer) MUST be blocked by the LATEST inspector task — when you create new inspector re-inspect tasks, update downstream blockedBy to point to the new inspector task ID.
4. Only mark Step 5 (Shutdown) when the final inspector task is COMPLETE with PASS and zero unresolved issues.
5. NEVER skip the inspector gate. If inspector found issues and the coder claims to have fixed them, inspector MUST re-verify. No exceptions.

PEER-TO-PEER NOTE: Teammates will SendMessage each other directly during their work. You may see INFO signals from them (e.g., "Consulted architect about API contract"). Acknowledge these but do not interfere — peer coordination is autonomous.
</Step_4_TaskDriven_Execution>

<Step_5_Cleanup>
BEFORE shutting down the team, YOU MUST ensure all running processes are stopped.

1. Identify which teammates may have started long-running processes:
   - tester: may have started dev servers, test watchers, or background test runners
   - inspector: may have started dev servers and agent-browser sessions
   - coder: may have started dev servers for verification

2. For each such teammate, check their final COMPLETE output for a CLEANUP signal:
   - If CLEANUP was sent → proceed
   - If CLEANUP was NOT sent → SendMessage({to: "<role>", message: "CLEANUP DIRECTIVE: terminate all processes you started (dev servers, watchers, browser sessions). Report CLEANUP when done."})
   - Wait for the teammate's CLEANUP reply

3. Verify nothing is left running:
   - Read the teammate's CLEANUP message to confirm all processes were explicitly stopped
   - If a teammate is unresponsive or cannot clean up, note it in the final report

4. Only after ALL relevant teammates have sent CLEANUP, proceed to Step 6.

If no teammate started any long-running processes (e.g., pure documentation tasks, code review without tests), skip this step.
</Step_5_Cleanup>

<Step_6_Shutdown_And_Report>
When all tasks are completed and cleanup is confirmed:
1. Read TaskList for final state — summarize what was done, by whom
2. SendMessage({to: "*", message: {type: "shutdown_request"}})
3. Report final summary to user: files changed, tests passed, any issues
4. Record learnings: Append key observations to `.crewpilot/index.json` learnings array. For each agent that produced a notable outcome:
   - DONE_WITH_CONCERNS → record as a learning (category: "pitfall", severity: "important")
   - Repeated failures before success → record as a learning (category: "tip", severity: "critical")
   - Reviewer found critical issues → record as a learning (category: "pattern", severity: "critical")
   - Unexpected dependency discovered → record as a learning (category: "dependency", severity: "minor")
   Update `updatedAt` timestamp. Maximum 5 learnings per run — prioritize critical over minor.

ARCHITECTURE NOTE: The main session IS the pilot. This is intentional — sub-agents
(spawned without team_name) do not have the Agent tool and cannot spawn teammates.
Only the main session (as team-lead) can spawn teammates via Agent(team_name, ...).
Never wrap these steps inside Agent() or Task() — they run in the main session.
</Step_6_Shutdown_And_Report>

<Escalation>
  - Researcher fails: if essential, report to user. If optional, proceed with note that research was unavailable.
  - TeamCreate fails: check if another team is already active, report error
  - Teammate repeatedly fails: mark task failed, report to user, continue if possible
</Escalation>