# Crewpilot

> Team-based multi-agent orchestration for Claude Code. Turn one AI into a team of eight.

When you ask a coding agent to "build a feature", it jumps in alone — reads files, writes code, runs tests, all in a single thread. For simple tasks this works fine. But when the task spans 5+ files, touches multiple layers, and needs review, testing, and docs — a solo agent gets sloppy. It skips steps. It loses context. It ships bugs.

**Crewpilot fixes this.** It transforms Claude Code into a coordinated team of specialized agents — researcher, architect, coder, reviewer, tester, inspector, writer — each focused on their role, each in their own sandbox, orchestrated by a pilot that manages the entire mission. You describe what you want, the pilot designs the workflow and dispatches teammates, and you get back a fully reviewed, tested, documented result.

Built on Claude Code's [TeamCreate API](https://claude.ai/code), Crewpilot is a plugin — not a framework, not a new tool, not something you have to learn. Install it, say `crewpilot <task>`, and your AI agent becomes a team.

## Quick Install

```bash
git clone https://github.com/Askhz/Crewpilot
cd Crewpilot
node scripts/install.mjs
```

### Standalone Mode (No Plugin)

Don't want a full plugin? Crewpilot's orchestration rules in `CLAUDE.md` work standalone. Merge them into your project's CLAUDE.md for the agent directory, delegation protocol, and communication rules — without the plugin system:

```bash
cat /path/to/Crewpilot/CLAUDE.md >> your-project/CLAUDE.md
```

> The `/crewpilot-run` skill won't be available in standalone mode — you'll invoke crewpilot by saying "crewpilot <task>" which the IntentGate routing in CLAUDE.md auto-detects.

### Plugin Install

This registers Crewpilot as a Claude Code plugin and copies the skills and config into `~/.claude/plugins/`. Then in your project:

```bash
node /path/to/Crewpilot/scripts/init-project.mjs   # creates .crewpilot/ in your project
```

Restart Claude Code, and you're ready. No API keys to configure, no external services — Crewpilot runs entirely within Claude Code's existing infrastructure.

**Uninstall:**

```bash
node /path/to/Crewpilot/scripts/uninstall.mjs
```

## Usage

Once installed, Crewpilot activates automatically. Just describe your task:

```bash
# Full team orchestration
crewpilot build a user authentication system with login and registration

# Plan first, review the workflow before executing
crewpilot-plan add dark mode toggle to settings

# The pilot classifies intent automatically — you don't need keywords for obvious tasks
fix the token refresh bug in auth.ts
review the API error handling
refactor the database connection pool
```

**How intent classification works:**

| You say | Crewpilot does |
|---------|---------------|
| `crewpilot <task>` | Full team orchestration (research → strategize → execute) |
| `crewpilot-plan <task>` | Generate workflow plan for review, no execution |
| `build / create / implement ...` | Auto-detected as feature development, triggers full team |
| `fix / debug / repair ...` | Auto-detected as bug fix, triggers targeted team |
| `review / check / inspect ...` | Auto-detected as code review |
| `refactor / optimize ...` | Auto-detected as refactoring |
| `explain / what / how ...` | Single agent, no team needed |
| `list / show / find ...` | Direct tool use, no agents |

**When the team runs**, you'll see the pilot design the workflow, then spawn agents one by one in dependency order — researcher explores the codebase, architect plans the implementation, coder writes the code, reviewer checks it, tester verifies it, and writer documents it. Each agent reports progress and completion. For frontend projects, the inspector uses agent-browser to visually verify every page.

**Frontend projects** need `agent-browser` for the inspector agent:

```bash
npm install -g agent-browser
agent-browser install
```

## The Team

Crewpilot gives you eight specialized agents. Each has a defined role, tool access, and output contract — no ambiguity, no drift.

| Agent | Role | Tools |
|-------|------|-------|
| **pilot** | Team-lead orchestrator + workflow designer, runs the 6-phase lifecycle | TeamCreate, Agent, SendMessage, Task tools |
| **researcher** | Read-only codebase exploration, gathers context | Read, Glob, Grep, WebSearch, WebFetch |
| **architect** | Designs implementation plans at file/function level | Read, Glob, Grep — plans only, never edits |
| **coder** | Implements code changes following the architect's plan | Full tool access, constrained by prompt |
| **reviewer** | Two-stage review: spec-compliance then code-quality | Read, Grep, Glob — read-only |
| **tester** | Writes and runs tests for correctness and edge cases | Read, Edit, Write, Bash — test files only |
| **inspector** | Frontend UI inspection with agent-browser, loops with coder to fix issues | Read, Bash, Glob — agent-browser for inspection, never edits source |
| **writer** | Documentation, README updates, inline comments | Read, Edit, Write, Glob — docs only |

Every agent communicates via a structured signal protocol: PROGRESS for milestones, COMPLETE when done, BLOCKED when stuck. **Teammates can also SendMessage directly to each other by role name** — the architect asks the researcher for missing context, the coder coordinates API contracts with parallel coders, the inspector loops with the coder to fix UI issues. The pilot routes task signals but never relays peer messages; teammates collaborate autonomously.

## How It Works

### The 6-Phase Pilot Lifecycle

```
/crewpilot-run (main session = pilot)
  ├── Phase 0 (optional): Research — spawn researcher to explore codebase, gather context
  ├── Phase 1: Strategize — pilot designs the workflow (with research context if available)
  ├── Phase 1.5 (MANDATORY): User Approval — AskUserQuestion, user approves or revises workflow
  ├── Phase 2: TeamCreate — register the crew, pilot becomes team-lead
  ├── Phase 3: Plan — parse strategy table into TaskCreate chains with blocking deps
  ├── Phase 4: Execute — task-driven loop, spawn ≤5 teammates in parallel
  │     ├── Agent(team, name="researcher", subagent_type="general-purpose")
  │     ├── Agent(team, name="architect", subagent_type="Plan")
  │     ├── Agent(team, name="coder", subagent_type="general-purpose")
  │     ├── Agent(team, name="reviewer", subagent_type="general-purpose") ×2
  │     ├── Agent(team, name="tester", subagent_type="general-purpose")
  │     ├── Agent(team, name="inspector", subagent_type="general-purpose")
  │     └── Agent(team, name="writer", subagent_type="general-purpose")
  └── Phase 5: Shutdown — summarize results, shutdown teammates
```

Before any team is created, the pilot presents the workflow plan for your approval. If multiple valid approaches exist (e.g., frontend-first vs backend-first), you'll see them as options. Nothing executes until you confirm.

### IntentGate — Automatic Task Classification

You don't need to remember commands. Crewpilot classifies your intent from what you type and routes accordingly:

| You say | Crewpilot classifies as | What happens |
|---------|------------------------|--------------|
| "build a login page" | `implement` | research(codebase) → pilot designs workflow → architect → coder → reviewer → tester → writer |
| "fix the auth bug" | `fix` | research(codebase) → pilot designs workflow → architect → coder → tester |
| "build a dashboard UI" | `implement` (frontend) | research → pilot designs workflow → architect → coder → inspector (loop) → reviewer → tester → writer |
| "explain how routing works" | `explain` | single Agent (no team needed) |
| "review the API changes" | `review` | research → pilot designs workflow → reviewer (spec) → reviewer (quality) |
| "refactor the database layer" | `refactor` | research → pilot designs workflow → architect → coder → tester → reviewer |
| "list all endpoints" | `other` | direct tool use |

For complex tasks, just include the word `crewpilot` in your prompt to trigger the full team. Use `crewpilot-plan` or `cp-plan` to generate a plan first and review it before executing.

### Workflow Patterns

The pilot adapts the agent chain to the task — no hardcoded pipelines:

**Feature Development** (7 agents, chain)
```
researcher → architect → coder → reviewer(spec) → reviewer(quality) → tester → writer
```

**Feature Development — Frontend** (8 agents, inspector loop)
```
researcher → architect → coder → inspector(loop with coder) → reviewer(spec) → reviewer(quality) → tester → writer
```
The inspector uses agent-browser to check layout, content, interactions, console errors, and network requests. It sends ISSUE signals to the coder, who fixes and replies, and the inspector re-verifies — looping up to 3 rounds until every issue is resolved.

**Bug Fix** (4 agents, chain, +inspector for UI fixes)
```
researcher → architect → coder → tester
```

**Code Review Only** (3 agents, parallelizable after research)
```
researcher → reviewer(spec) ∥ reviewer(quality)
```

**Refactoring** (5 agents, chain, tester before reviewer)
```
researcher → architect → coder → tester → reviewer(quality)
```

For simple tasks (1-2 files), the pilot skips unnecessary agents — no writer, no separate architect, tester merged into coder. Task economy built in.

## Architecture

The main Claude Code session IS the pilot. This is deliberate: sub-agents (spawned without `team_name`) don't have the `Agent` tool and can't spawn teammates. Only the main session can call `TeamCreate` and spawn teammates via `Agent(team_name, ...)`. The pilot decides if research is needed, designs the workflow, then orchestrates the team.

```
┌──────────────────────────────────────────────────┐
│                User Input                         │
│  "crewpilot add dark mode to settings"           │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│             IntentGate Classification             │
│       "add" → implement → /crewpilot-run         │
└──────────────────────┬───────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────┐
│              PILOT (Main Session)                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ Phase 0 (optional): Agent("researcher")       │ │
│  │ Phase 1: Pilot designs workflow (+ research)  │ │
│  │ Phase 2: TeamCreate("crew-dark-mode")        │ │
│  │ Phase 3: TaskCreate × N (with blockedBy)     │ │
│  │ Phase 4: Task-driven execution loop          │ │
│  │ Phase 5: Summarize + shutdown                │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬───────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │researcher│ │architect │ │  coder   │
    │ (Explore)│ │  (Plan)  │ │(general) │
    └──────────┘ └──────────┘ └──────────┘
          │            │            │
          └────────────┼────────────┘
                       ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │reviewer  │ │reviewer  │ │inspector │
    │  (spec)  │ │(quality) │ │(general) │
    └──────────┘ └──────────┘ └────┬─────┘
                       │           │
                       ▼           ▼ (loop)
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │  tester  │ │  writer  │ │  coder   │
    │(general) │ │(general) │ │  (fix)   │
    └──────────┘ └──────────┘ └──────────┘
```

## Project Structure

```
Crewpilot/
├── skills/                    # User-invocable skills
│   ├── run/
│   │   ├── SKILL.md           # /crewpilot-run — full orchestration lifecycle
│   │   └── prompts/           # Agent role prompts (injected at spawn time)
│   │       ├── researcher.md
│   │       ├── architect.md
│   │       ├── coder.md
│   │       ├── reviewer.md
│   │       ├── tester.md
│   │       ├── inspector.md
│   │       ├── writer.md
│   │       └── _communication.md  # Shared communication protocol
│   └── plan/SKILL.md          # /crewpilot-plan — plan preview, no execution
├── scripts/
│   ├── install.mjs            # npx crewpilot install
│   ├── init-project.mjs       # npx crewpilot init
│   └── uninstall.mjs          # npx crewpilot uninstall
├── .claude-plugin/            # Claude Code plugin manifest
│   ├── plugin.json
│   └── marketplace.json
├── CLAUDE.md                  # Project instructions (loaded into every session)
├── package.json
└── LICENSE
```

## Configuration

All routing and behavior rules are defined inline in [CLAUDE.md](CLAUDE.md) — IntentGate classification, keyword priority routing, and agent directory. No external config file is needed.

## Design Principles

- **Main session is the pilot.** No wrapping orchestration inside Agent() — the pilot designs workflows and delegates tasks directly.
- **Research first, strategize second.** The pilot decides if codebase research is needed. If yes, researcher runs first and findings inform workflow design.
- **Task-driven, not time-driven.** The pilot loops on task status, not timers. Each task has dependencies, owner, and explicit completion signals.
- **Teammates own their tasks.** The pilot never reads your code to "verify" work. It trusts the COMPLETE signal. Separation of orchestration from execution.
- **Teammates talk to each other.** Agents SendMessage directly by role name — no relay through the pilot. Architect asks researcher for context, coder⇄tester align on behavior, inspector⇄coder loop to fix UI issues. The pilot stays out of peer conversations.
- **Task economy.** For simple tasks (1-2 files), the pilot skips unnecessary agents. Don't spawn a team of 8 to change a config value.
- **YAGNI for agents.** Don't create agents for roles you don't need. The pilot only uses agents from the available directory, creating new ones only when genuinely required.

## License

MIT — see [LICENSE](LICENSE).
