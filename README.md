# Crewpilot

> Team-based multi-agent orchestration for Claude Code. Turn one AI into a team of eight.

When you ask a coding agent to "build a feature", it jumps in alone — reads files, writes code, runs tests, all in a single thread. For simple tasks this works fine. But when the task spans 5+ files, touches multiple layers, and needs review, testing, and docs — a solo agent gets sloppy. It skips steps. It loses context. It ships bugs.

**Crewpilot fixes this.** It transforms Claude Code into a coordinated team of specialized agents — researcher, architect, coder, reviewer, tester, writer — each focused on their role, each in their own sandbox, orchestrated by a pilot that manages the entire mission. You describe what you want, the strategist designs the workflow, the pilot dispatches teammates, and you get back a fully reviewed, tested, documented result.

Built on Claude Code's [TeamCreate API](https://claude.ai/code), Crewpilot is a plugin — not a framework, not a new tool, not something you have to learn. Install it, say `crewpilot <task>`, and your AI agent becomes a team.

## Quick Install

```bash
git clone https://github.com/Askhz/Crewpilot
cd Crewpilot
node scripts/install.mjs
```

This registers Crewpilot as a Claude Code plugin and copies the agents, skills, and config into `~/.claude/plugins/`. Then in your project:

```bash
node /path/to/Crewpilot/scripts/init-project.mjs   # creates .crewpilot/ in your project
```

Restart Claude Code, and you're ready. No API keys to configure, no external services — Crewpilot runs entirely within Claude Code's existing infrastructure.

**Uninstall:**

```bash
node /path/to/Crewpilot/scripts/uninstall.mjs
```

## The Team

Crewpilot gives you eight specialized agents. Each has a defined role, tool access, and output contract — no ambiguity, no drift.

| Agent | Role | Tools |
|-------|------|-------|
| **pilot** | Team-lead orchestrator, runs the 5-phase lifecycle | TeamCreate, Agent, SendMessage, Task tools |
| **strategist** | Task analyzer, designs optimal multi-agent workflow per task | Read, Grep, Glob — workflow design only |
| **researcher** | Read-only codebase exploration, gathers context | Read, Glob, Grep, WebSearch, WebFetch |
| **architect** | Designs implementation plans at file/function level | Read, Glob, Grep — plans only, never edits |
| **coder** | Implements code changes following the architect's plan | Full tool access, constrained by prompt |
| **reviewer** | Two-stage review: spec-compliance then code-quality | Read, Grep, Glob — read-only |
| **tester** | Writes and runs tests for correctness and edge cases | Read, Edit, Write, Bash — test files only |
| **writer** | Documentation, README updates, inline comments | Read, Edit, Write, Glob — docs only |

Every agent communicates via a structured signal protocol: PROGRESS for milestones, COMPLETE when done, BLOCKED when stuck. The pilot routes signals and manages dependencies — it never reads your source code or second-guesses a teammate's work.

## How It Works

### The 5-Phase Pilot Lifecycle

```
/crewpilot-run (main session = pilot)
  ├── Phase 1: Strategize — plain sub-agent designs the workflow
  ├── Phase 2: TeamCreate — register the crew, pilot becomes team-lead
  ├── Phase 3: Plan — parse strategy table into TaskCreate chains with blocking deps
  ├── Phase 4: Execute — task-driven loop, spawn ≤5 teammates in parallel
  │     ├── Agent(team, name="researcher", subagent_type="Explore")
  │     ├── Agent(team, name="architect", subagent_type="Plan")
  │     ├── Agent(team, name="coder", subagent_type="general-purpose")
  │     ├── Agent(team, name="reviewer", subagent_type="general-purpose") ×2
  │     ├── Agent(team, name="tester", subagent_type="general-purpose")
  │     └── Agent(team, name="writer", subagent_type="general-purpose")
  └── Phase 5: Shutdown — summarize results, shutdown teammates
```

The pilot doesn't write code. It doesn't read your source files. It doesn't verify your teammate's output. It manages the process — spawning agents in dependency order, routing signals, and ensuring every task gate is met before the next step begins.

### IntentGate — Automatic Task Classification

You don't need to remember commands. Crewpilot classifies your intent from what you type and routes accordingly:

| You say | Crewpilot classifies as | What happens |
|---------|------------------------|--------------|
| "build a login page" | `implement` | strategist → architect → coder → reviewer → tester → writer |
| "fix the auth bug" | `fix` | researcher → architect → coder → tester |
| "explain how routing works" | `explain` | single Agent (no team needed) |
| "review the API changes" | `review` | researcher → reviewer (spec) → reviewer (quality) |
| "refactor the database layer" | `refactor` | researcher → architect → coder → tester → reviewer |
| "list all endpoints" | `other` | direct tool use |

For complex tasks, just include the word `crewpilot` in your prompt to trigger the full team. Use `crewpilot-plan` or `cp-plan` to generate a plan first and review it before executing.

### Workflow Patterns

The strategist adapts the agent chain to the task — no hardcoded pipelines:

**Feature Development** (7 agents, chain)
```
researcher → architect → coder → reviewer(spec) → reviewer(quality) → tester → writer
```

**Bug Fix** (4 agents, chain, optional reviewer for complex fixes)
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

For simple tasks (1-2 files), the strategist skips unnecessary agents — no writer, no separate architect, tester merged into coder. Task economy built in.

## Architecture

The main Claude Code session IS the pilot. This is deliberate: sub-agents (spawned without `team_name`) don't have the `Agent` tool and can't spawn teammates. Only the main session can call `TeamCreate` and spawn teammates via `Agent(team_name, ...)`. The pilot orchestrates, the teammates execute.

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
│  │ Phase 1: Agent("strategist", general-purpose)│ │
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
    │reviewer  │ │reviewer  │ │  tester  │
    │  (spec)  │ │(quality) │ │(general) │
    └──────────┘ └──────────┘ └──────────┘
                       │
                       ▼
                ┌──────────┐
                │  writer  │
                │(general) │
                └──────────┘
```

## Project Structure

```
Crewpilot/
├── agents/              # Agent definitions (YAML frontmatter + XML prompts)
│   ├── pilot.md         # Team-lead orchestrator protocol
│   ├── strategist.md    # Task analyzer, workflow designer
│   ├── researcher.md    # Codebase explorer (read-only)
│   ├── architect.md     # Implementation plan designer
│   ├── coder.md         # Code implementer
│   ├── reviewer.md      # Two-stage code reviewer
│   ├── tester.md        # Test writer and runner
│   └── writer.md        # Documentation writer
├── skills/              # User-invocable skills
│   ├── run/SKILL.md     # /crewpilot-run — full orchestration lifecycle
│   └── plan/SKILL.md    # /crewpilot-plan — plan preview, no execution
├── presets/
│   └── config.default.yaml  # IntentGate rules, keyword routing, model tiers
├── scripts/
│   ├── install.mjs      # npx crewpilot install
│   ├── init-project.mjs # npx crewpilot init
│   └── uninstall.mjs    # npx crewpilot uninstall
├── .claude-plugin/      # Claude Code plugin manifest
│   ├── plugin.json
│   └── marketplace.json
├── CLAUDE.md            # Project instructions (loaded into every session)
├── package.json
└── LICENSE
```

## Configuration

Crewpilot is configured through `presets/config.default.yaml`, copied to your project's `.crewpilot/config.yaml` on `init`:

- **IntentGate**: maps keywords (build, fix, explain, review, refactor, list) to routing (complex → team, simple → solo agent)
- **Keywords**: priority-based trigger patterns (`crewpilot-plan` at priority 10, `crewpilot` at priority 5)
- **Model Tiers**: maps agent roles to Claude model tiers (Haiku for writer, Sonnet for standard roles, Opus for thorough roles like architect and pilot)

## Design Principles

- **Main session is the pilot.** No wrapping orchestration inside Agent() — the pilot has direct access to TeamCreate and Agent tools.
- **Strategize first, execute second.** Every task gets a custom workflow from the strategist. No hardcoded pipelines.
- **Task-driven, not time-driven.** The pilot loops on task status, not timers. Each task has dependencies, owner, and explicit completion signals.
- **Teammates own their tasks.** The pilot never reads your code to "verify" work. It trusts the COMPLETE signal. Separation of orchestration from execution.
- **Task economy.** For simple tasks (1-2 files), the strategist skips unnecessary agents. Don't spawn a team of 7 to change a config value.
- **YAGNI for agents.** Don't create agents for roles you don't need. The strategist only uses agents from the available directory, requesting new ones only when genuinely required.

## License

MIT — see [LICENSE](LICENSE).
