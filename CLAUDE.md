## Crewpilot Orchestration Rules

### IntentGate Classification
Every user turn is independently classified into one of 6 intents (Turn-Local Reset — intent does not carry over between turns):

| Intent | Keyword Signals | Routing |
|--------|----------------|---------|
| implement | build, create, implement, add | complex → /crewpilot-run |
| fix | fix, bug, repair, debug | complex → /crewpilot-run |
| explain | explain, what, how, describe | simple → single Agent |
| review | review, check, inspect, audit | complex → /crewpilot-run |
| refactor | refactor, optimize, improve, restructure | complex → /crewpilot-run |
| other | list, show, find, query, search | simple → direct tool use |

> Query/management operations (list/show/find/query) are classified as `other`.

### Routing Keywords (priority order)
| Keyword | Priority | Trigger Mode |
|---------|----------|-------------|
| cp-plan / crewpilot-plan | 10 (highest) | Plan only, do not execute |
| crewpilot | 5 (default) | Execute task |

### Architecture: Main Session IS the Pilot

The main Claude Code session is the team-lead / pilot. This is required because sub-agents
(spawned without `team_name`) do NOT have the Agent tool — they cannot spawn teammates.
Only the main session can call `TeamCreate` and `Agent(team_name, ...)`.

**Pilot scope**: The pilot orchestrates AND designs workflows — spawn teammates, route signals, manage task status, classify tasks, assign agents.
The pilot NEVER reads source code, searches the project, runs commands, writes files, or
"verifies" teammate work. Everything that touches the codebase is delegated to teammates.

```
/crewpilot-run (main session = pilot)
  ├── Phase 0 (optional): Agent(name="researcher", subagent_type="general-purpose") → codebase context
  ├── Phase 1: Pilot designs the multi-agent workflow (with research context)
  ├── Phase 1.5 (MANDATORY): AskUserQuestion → user approves/rejects workflow
  ├── TeamCreate(team_name, agent_type="pilot")  → becomes team-lead
  ├── TaskCreate × N  → task chain with blockedBy
  ├── Agent(team_name, name="researcher", subagent_type="general-purpose")
  ├── Agent(team_name, name="architect", subagent_type="Plan")
  ├── Agent(team_name, name="coder", subagent_type="general-purpose")
  ├── Agent(team_name, name="reviewer", subagent_type="general-purpose")  × 2
  ├── Agent(team_name, name="tester", subagent_type="general-purpose")
  ├── Agent(team_name, name="writer", subagent_type="general-purpose")
  ├── Cleanup: Verify all test servers, watchers, browser sessions terminated
  └── SendMessage({to: "*", message: {type: "shutdown_request"}})
```

**NEVER** wrap the pilot inside `Agent()` or `Task()` — the skill IS the pilot.

### Delegation Protocol
- **Simple task**: select the most appropriate single Agent and delegate directly
- **Complex task**: run /crewpilot-run skill → main session executes 6-phase pilot lifecycle
- **Pilot lifecycle**: Research (optional) → Strategize (pilot designs workflow) → User Approval (MANDATORY AskUserQuestion) → TeamCreate → Plan (TaskCreate chain) → Execute (Task-driven loop, max 5 parallel) → Cleanup (terminate all running processes) → Shutdown
- **Pilot uses**: TeamCreate, Agent(team_name, name, subagent_type), SendMessage, TaskCreate/TaskList/TaskUpdate
- **Teammate questions**: All teammates can call AskUserQuestion (core tool, always available). When a teammate asks a question, it routes to the pilot. Do NOT mark their task complete — answer the question and the teammate resumes.
- **Peer-to-peer communication**: All teammates can SendMessage directly to each other by role name. The team-lead does NOT relay messages. Teammates coordinate autonomously on API contracts, implementation rationale, test coordination, and context questions. The team-lead only receives INFO copies for visibility.

### Agent Directory
| Agent | subagent_type | Role |
|-------|--------------|------|
| *pilot* | — (main session) | Team-lead orchestrator + workflow designer, executes the 6-phase lifecycle |
| researcher | general-purpose | Read-only codebase exploration |
| architect | Plan | Design implementation plans |
| coder | general-purpose | Implement code changes |
| reviewer | general-purpose | Two-stage code review (spec-compliance + code-quality) |
| tester | general-purpose | Write and run tests |
| inspector | general-purpose | Frontend UI inspection with agent-browser, loops with coder to fix issues |
| writer | general-purpose | Documentation updates |
| security-reviewer | general-purpose | OWASP Top 10 + STRIDE security audit, vulnerability detection |
| code-simplifier | general-purpose | Reduce code without reducing functionality — dead code, over-abstraction, duplication |
| debugger | general-purpose | 4-phase root cause analysis — reproduce, isolate, diagnose, prescribe. No fixes, diagnosis only |
| designer | general-purpose | UI/UX design review — visual consistency, interaction, responsive, accessibility, states |

> *pilot* is the main session — NOT a spawned agent. All other agents are spawned as teammates via `Agent(team_name, name, subagent_type, prompt)`. The pilot designs the workflow dynamically per task.