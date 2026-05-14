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

```
/crewpilot-run (main session = pilot)
  ├── Agent(name="strategist", subagent_type="general-purpose")  → plain sub-agent, designs workflow
  ├── TeamCreate(team_name, agent_type="pilot")  → becomes team-lead
  ├── TaskCreate × N  → task chain with blockedBy
  ├── Agent(team_name, name="researcher", subagent_type="Explore")
  ├── Agent(team_name, name="architect", subagent_type="Plan")
  ├── Agent(team_name, name="coder", subagent_type="general-purpose")
  ├── Agent(team_name, name="reviewer", subagent_type="general-purpose")  × 2
  ├── Agent(team_name, name="tester", subagent_type="general-purpose")
  ├── Agent(team_name, name="writer", subagent_type="general-purpose")
  └── SendMessage({to: "*", message: {type: "shutdown_request"}})
```

**NEVER** wrap the pilot inside `Agent()` or `Task()` — the skill IS the pilot.

### Delegation Protocol
- **Simple task**: select the most appropriate single Agent and delegate directly
- **Complex task**: run /crewpilot-run skill → main session executes 5-phase pilot lifecycle
- **Pilot lifecycle**: Strategize (plain sub-agent) → TeamCreate → Plan(TaskCreate chain) → Execute(Task-driven loop, max 5 parallel) → Shutdown
- **Pilot uses**: TeamCreate, Agent(team_name, name, subagent_type), SendMessage, TaskCreate/TaskList/TaskUpdate
- **Teammate questions**: All teammates can call AskUserQuestion (core tool, always available). When a teammate asks a question, it routes to the pilot. Do NOT mark their task complete — answer the question and the teammate resumes.
- **Peer-to-peer communication**: All teammates can SendMessage directly to each other by role name. The team-lead does NOT relay messages. Teammates coordinate autonomously on API contracts, implementation rationale, test coordination, and context questions. The team-lead only receives INFO copies for visibility.

### Agent Directory
| Agent | subagent_type | Role |
|-------|--------------|------|
| *pilot* | — (main session) | Team-lead orchestrator, executes the 5-phase lifecycle |
| strategist | general-purpose | Task analyzer, designs optimal multi-agent workflow per task |
| researcher | Explore | Read-only codebase exploration |
| architect | Plan | Design implementation plans |
| coder | general-purpose | Implement code changes |
| reviewer | general-purpose | Two-stage code review (spec-compliance + code-quality) |
| tester | general-purpose | Write and run tests |
| writer | general-purpose | Documentation updates |

> *pilot* is the main session — NOT a spawned agent. All other agents are spawned as teammates via `Agent(team_name, name, subagent_type, prompt)`. The strategist decides the workflow dynamically per task.