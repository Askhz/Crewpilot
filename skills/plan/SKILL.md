---
name: crewpilot-plan
description: "Use when the user wants to plan a task without executing it. Triggers on keywords: cp-plan, crewpilot-plan"
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
     - Task breakdown with dependencies (blockedBy chains)
     - Review strategy (which review passes are needed)
     - Key risks or special considerations

  3. **Ask user for confirmation** via AskUserQuestion:
     - "Approve" → trigger crewpilot-run to execute the plan
     - "Revise" → adjust based on feedback, re-present
     - "Cancel" → stop, nothing saved

  4. **On approval**: trigger crewpilot-run with the approved plan
</Execution_Policy>

<Agent_Reference>
  Available agents and their subagent_type mapping:
  - strategist: subagent_type="general-purpose" — task analysis and workflow design
  - researcher: subagent_type="Explore" — read-only codebase exploration
  - architect: subagent_type="Plan" — design implementation plans
  - coder: subagent_type="general-purpose" — implement code changes
  - reviewer: subagent_type="general-purpose" — two-stage review (spec-compliance + code-quality)
  - tester: subagent_type="general-purpose" — write and run tests
  - writer: subagent_type="general-purpose" — documentation updates

  Workflow patterns by task type:
  - Feature: researcher → architect → coder → reviewer(spec) → reviewer(quality) → tester → writer
  - Bug Fix: researcher → architect → coder → tester (± reviewer for complex fixes)
  - Review: researcher → reviewer(spec) → reviewer(quality)
  - Refactor: researcher → architect → coder → tester → reviewer(quality)
  - Simple/small: skip writer, merge steps where possible

  Peer-to-peer communication: All teammates can SendMessage directly to each
  other by role name. The team-lead does NOT relay. Key collaboration patterns:
  - Architect ⇄ Researcher (context questions, design clarification)
  - Coder ⇄ Architect (plan clarification, design questions)
  - Coder ⇄ Tester (behavior alignment, integration test coordination)
  - Coder ⇄ Coder (API contract coordination for parallel frontend+backend)
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