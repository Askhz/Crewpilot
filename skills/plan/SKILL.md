---
name: crewpilot-plan
description: |
  Preview a multi-agent workflow before execution. Shows which agents will be involved,
  task breakdown, dependency chain, and review strategy — without spawning any teammates.
  Use when: user says "cp-plan <task>", "crewpilot-plan <task>", "show me the plan first",
  "just plan", "give me a proposal", or wants to review the approach before committing.
  Proactively invoke when: the user seems uncertain about scope, asks "how would you
  approach this", wants to compare alternatives, or says "what's the plan" before starting.
  Do NOT use for: tasks where the user clearly wants direct execution ("just do it",
  "build X now", "fix Y immediately"), or trivial questions.
argument-hint: <task description>
---

<Purpose>Plan only, no execution. Produce a task breakdown and team plan for user preview and approval.</Purpose>

<Use_When>
  - User input contains keywords: cp-plan or crewpilot-plan
  - User explicitly says "show me the plan first", "just plan", "give me a proposal"
  - User wants to preview the approach before committing to execution costs
</Use_When>

<Do_Not_Use_When>
  - User wants to execute the task directly (use crewpilot-run instead)
  - User is asking a simple informational question
</Do_Not_Use_When>

<Execution_Policy>
  YOU ARE THE ARCHITECT HERE. You are NOT spawning a "pilot" — you are doing the
  planning work directly in the main session.

  1. **Analyze the task**: Classify it (Feature, BugFix, Review, Refactor, Other)

  2. **Design the team plan**. Present to the user:
     - Team name proposal
     - Task type classification
     - Which agents will be involved, in what order, with what subagent_type
     - Task breakdown with dependencies (blockedBy chains) — each task a 2-5 min atomic action (RED-GREEN-REFACTOR: write test → fail → implement → pass → refactor → commit)
     - Review strategy (which review passes are needed)
     - Key risks or special considerations

  3. **Ask user for confirmation** via AskUserQuestion:
     - "Approve" → trigger crewpilot-run to execute the plan
     - "Revise" → adjust based on feedback, re-present
     - "Cancel" → stop, nothing saved

  4. **On approval**: trigger crewpilot-run with the approved plan
</Execution_Policy>

## Red Flags — Stop and Correct Course

| Thought | Reality |
|---------|---------|
| "This is simple enough, I'll skip the plan" | Every complex task needs a plan. That's why the user called cp-plan. |
| "I'll just list the agents, the details are obvious" | The plan must be specific enough for the user to evaluate. Vague plans waste their time. |
| "No need to specify dependencies, the pilot will figure it out" | blockBy chains prevent deadlocks. Define them explicitly. |
| "I'll merge two agent roles to keep the plan simple" | Each agent has one focused role. Merging creates confusion. |
| "The user doesn't need to see the review strategy" | The user MUST see what review is planned. It's part of the approval. |
| "This task is small, one big coder task is fine" | Break into 2-5 minute atomic RED-GREEN-REFACTOR steps. No large tasks. |
| "I remember the available agents, no need to check" | Agent directory evolves. Verify against the current list. |

<Agent_Reference>
  Available agents and their subagent_type mapping:
  - *pilot* (main session): orchestrator + workflow designer — classifies tasks, designs agent chains
  - researcher: subagent_type="general-purpose" — read-only codebase exploration
  - architect: subagent_type="Plan" — design implementation plans
  - coder: subagent_type="general-purpose" — implement code changes
  - reviewer: subagent_type="general-purpose" — two-stage review (spec-compliance + code-quality)
  - tester: subagent_type="general-purpose" — write and run tests
  - inspector: subagent_type="general-purpose" — frontend UI inspection with agent-browser, loops with coder
  - writer: subagent_type="general-purpose" — documentation updates

  Workflow patterns by task type:
  - Feature: researcher → architect → coder → reviewer(spec) → reviewer(quality) → tester → writer
  - Feature (frontend): researcher → architect → coder → inspector(loop with coder) → reviewer(spec) → reviewer(quality) → tester → writer
  - Bug Fix: researcher → architect → coder → tester (± reviewer for complex fixes, + inspector for UI fixes)
  - Review: researcher → reviewer(spec) → reviewer(quality)
  - Refactor: researcher → architect → coder → tester → reviewer(quality)
  - Simple/small: skip writer, merge steps where possible

  Peer-to-peer communication: All teammates can SendMessage directly to each
  other by role name. The team-lead does NOT relay. Key collaboration patterns:
  - Architect ⇄ Researcher (context questions, design clarification)
  - Coder ⇄ Architect (plan clarification, design questions)
  - Coder ⇄ Tester (behavior alignment, integration test coordination)
  - Coder ⇄ Coder (API contract coordination for parallel frontend+backend)
  - Inspector → Coder → Inspector (UI issue → fix → re-inspect loop, max 3 rounds)
  - Reviewer ⇄ Coder (implementation rationale)
  - Writer ⇄ Any (docs context)
</Agent_Reference>

<Escalation>
  None (planning phase has no execution risk, user always has confirmation control)
</Escalation>

<Final_Checklist>
  - Is the team plan clear about which agents are involved and their order?
  - Is the task breakdown specific with dependencies?
  - Are the review stages included for complex tasks?
  - Did the user explicitly approve before any execution?
</Final_Checklist>