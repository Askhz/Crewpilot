---
name: crewpilot-run
description: "Use when the user wants to execute a complex task using multi-agent orchestration. Triggers on keywords: crewpilot"
argument-hint: <task description>
---

<HARD_CONSTRAINTS>
YOU MUST FOLLOW THESE STEPS IN ORDER. DO NOT DEVIATE.

YOU ARE THE PILOT. You are NOT spawning a "pilot agent" — you ARE the orchestrator.
As the main session, you have full access to TeamCreate, Agent (to spawn teammates),
SendMessage, and Task tools. Use them directly.

RESEARCH FIRST, THEN STRATEGIZE: The pilot first decides whether codebase research is needed.
If yes, spawn researcher as plain sub-agent, get findings, then pass them to the strategist.
If no (simple task, user already gave context), skip researcher, go straight to strategist.
Only AFTER the strategist returns do you create the team and start executing.

FORBIDDEN:
- DO NOT write code yourself (no Edit, Write, Bash for code creation)
- DO NOT spawn a "pilot" agent — you are the pilot
- DO NOT call Skill() again inside this skill
- DO NOT wrap TeamCreate/Agent calls inside another Agent()

If you feel tempted to write code yourself — STOP. Spawn a teammate instead.
</HARD_CONSTRAINTS>

<Step_0_Research>
First, discover all available agents. Read the agents/ directory to get the full list.

DECIDE whether research is needed. Does the task involve an unfamiliar codebase? Would codebase context (file structure, dependencies, existing patterns) help the strategist design a better workflow?

If YES:
  Spawn researcher as PLAIN sub-agent:
  Agent(name="researcher", subagent_type="general-purpose", prompt="Research this task in the codebase. DO NOT edit files. YOUR ENTIRE RESPONSE MUST BE ONLY: ## Research Report\n### Relevant Files\n### Key Findings (with file:line)\n### Dependencies\n### Points of Attention\n\nTask: <full user input>")

  Wait for task-notification. Save output as RESEARCH_CONTEXT.

If NO (purely planning, review-only, user already provided specifics, trivial task):
  Skip this step. RESEARCH_CONTEXT = "No research was needed for this task."
</Step_0_Research>

<Step_1_Strategize>
Spawn the strategist as a PLAIN sub-agent (no team_name). Pass the research context:

Agent(name="strategist", subagent_type="general-purpose", prompt="Analyze this task and design the optimal multi-agent workflow. DO NOT read source code or explore the codebase — use the provided research context.

Task: <full user input>

RESEARCH CONTEXT:
<RESEARCH_CONTEXT>

CURRENTLY AVAILABLE AGENTS:
<list all found agents: name, subagent_type, one-line description>

RULES: Explore/Plan agents cannot edit files. general-purpose agents need prompt constraints. Parallel steps: max 5 agents at once.

YOUR ENTIRE RESPONSE MUST BE ONLY:
## Task Analysis (Type, Complexity, Summary)
## Workflow Plan (| Step | Agent | Task Description | Depends On |)
## Review Strategy
## Missing Agents (agents you need that don't exist, with suggested name/subagent_type/allowedTools/role. Write 'None' if all exist)
## Key Considerations")

The strategist returns a structured table via task-notification. Parse it immediately.

IMPORTANT: If ## Missing Agents is not empty/None, create those agent files. Write agents/{name}.md for each, following YAML frontmatter + Agent_Prompt XML format.
</Step_1_Strategize>

<Step_2_Create_Team>
Now create the team based on the strategist's plan:

TeamCreate(team_name="crew-<short-task-slug>", description="<user task summary>", agent_type="pilot")

Generate a short descriptive team_name (e.g. "crew-add-login", "crew-fix-auth").
</Step_2_Create_Team>

<Step_3_Plan_Tasks>
Parse the strategist's table. Create a TaskCreate for each step:

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
  - Researcher fails: if essential context is missing, report to user. If optional, proceed to strategist with note that research was unavailable.
  - TeamCreate fails: check if another team is already active, report error
  - Strategist returns unusable plan: retry with clearer task description or re-run research
  - Teammate repeatedly fails: mark task failed, report to user, continue if possible
</Escalation>