# Crewpilot

> Turn one Claude Code session into a team of specialized agents. Research, plan, code, review, test, inspect, document — all orchestrated, all automatic.

<p align="center">
  <b>English</b> · <a href="README_zh.md">中文</a>
</p>

---

### The Problem

You ask a coding agent to "build user authentication." It opens a file, writes some code, maybe adds a test, and calls it done. But what actually happened?

- It never researched how your existing auth middleware works — so it duplicated half of it
- It didn't have an architect think through session management — so refresh tokens silently break after 15 minutes
- Nobody reviewed the code before it shipped — SQL injection in the password reset flow
- The "test" it wrote only checks the happy path — empty passwords crash the validator
- There's no documentation — good luck to whoever maintains this next month
- And nobody opened a browser to check if the login page actually renders

**Solo agents skip steps.** Not because they're bad — because they lose context. After file #5, they forget what file #1 needed. After 20 tool calls, their attention degrades. The result: code that looks right but crumbles under real use.

### The Difference

| Without Crewpilot | With Crewpilot |
|---|---|
| One agent, one thread, no memory | A team of specialists, isolated context, structured handoffs |
| Skips research — dives straight into code | Researcher maps the codebase before anyone writes a line |
| No architecture review | Architect designs at file/function level with risk assessment |
| Tests come last (if at all) | RED-GREEN-REFACTOR — test first, every task, every time |
| "Looks good" is the review | Two-pass review: spec compliance then code quality |
| Frontend? Hope it works | Inspector opens a real browser, checks every page, every state |
| No docs | Writer produces docs that actually match the code |
| Same model reviews itself | Dedicated reviewer agent with fresh eyes, fresh context |

Crewpilot gives you what a senior engineering team does: research, design, implementation, review, testing, visual QA, and documentation — all in one command.

---

## Quick Install

```bash
git clone https://github.com/Askhz/Crewpilot
cd Crewpilot && node scripts/install.mjs
```

Then in your project:

```bash
node /path/to/Crewpilot/scripts/init-project.mjs
```

Restart Claude Code. That's it. No API keys. No external services. Runs entirely within Claude Code.

```bash
# Full team orchestration
/crewpilot:run build a user authentication system with login and registration

# Plan first, review the workflow before executing
/crewpilot:plan add dark mode toggle to settings
```

### Standalone Mode (No Plugin)

Don't want a full plugin? Crewpilot's orchestration rules work standalone:

```bash
cat /path/to/Crewpilot/CLAUDE.md >> your-project/CLAUDE.md
```

### Uninstall

```bash
node /path/to/Crewpilot/scripts/uninstall.mjs
```

---

## What You Get

**Automatic task classification.** Don't remember commands — just describe what you need. Crewpilot classifies intent and routes accordingly:

| You say | What happens |
|---------|-------------|
| `/crewpilot:run build a login page` | Full team: research → architect → coder → reviewer × 2 → tester → writer |
| `/crewpilot:run fix the auth bug` | Targeted team: research → architect → coder → tester |
| `/crewpilot:run build a dashboard UI` | Frontend team: same as above + inspector opens real browser, loops with coder |
| `/crewpilot:plan review the API changes` | Plan only — pilot presents workflow for your approval, no execution |
| `/crewpilot:run refactor the database layer` | Refactor team: research → architect → coder → tester → reviewer |
| `review the API changes` | Auto-detected as code review: researcher → reviewer (spec) ∥ reviewer (quality) |
| `explain how routing works` | Single agent — no team needed |
| `list all endpoints` | Direct tool use — no agents at all |

**Right-sized for the task.** Simple change to one file? Crewpilot skips the architect, writer, and extra reviewer. Full-stack feature across 15 files? Every agent you need in the chain. No team-wide mobilization for a typo fix, no solo coder for a production system.

**Before anything runs, you approve.** The pilot presents the full workflow plan — which agents, what order, what dependencies — and you confirm or revise. Nothing executes without your sign-off.

**Agents that talk to each other.** The architect asks the researcher for missing context. The coder and tester align on test behavior. The inspector sends ISSUE signals to the coder, coder fixes, inspector re-verifies — continuous loop until every page is clean. The pilot stays out of peer conversations.

---

## The Team

Crewpilot ships with a built-in roster of specialized agents, each with a defined role, tool access, and output contract. **These are a starting point, not a ceiling.** The pilot can create any agent role a task demands — not just the ones listed here. Need a security auditor for a sensitive feature? A database specialist for schema migrations? An API designer for new endpoints? The pilot designs the workflow around the task and creates whatever roles it needs.

| Agent | Role | Key Rule |
|-------|------|----------|
| **pilot** | Orchestrator — designs workflow, dispatches teammates, never touches code | Spawn, route, trust |
| **researcher** | Codebase explorer — finds relevant files, maps dependencies, identifies framework | Read-only, structured report |
| **architect** | Implementation designer — file/function level plans with risk assessment | YAGNI, no placeholders |
| **coder** | Implements code — follows architect's plan, self-reviews, reports status | RED-GREEN-REFACTOR |
| **reviewer** | Two-pass review — spec compliance then code quality, separate tasks | PASS/FAIL with evidence |
| **tester** | Writes and runs tests — critical paths, edge cases, error scenarios | Test files only |
| **inspector** | Frontend QA — opens real browser, checks every page, every state | Hard gate: no PASS, no proceed |
| **writer** | Documentation — README, comments, usage guides | Reads code before writing |
| **security-reviewer** | OWASP Top 10 security audit — injection, auth, XSS, secrets | CRITICAL findings block ship |
| **code-simplifier** | Reduce code without reducing function — dead code, abstraction, duplication | Every line removed is a future bug prevented |
| **debugger** | 4-phase root cause analysis — reproduce, isolate, diagnose, prescribe | No fix without evidence |
| **designer** | UI/UX design review — consistency, interaction, responsive, accessibility | 5 dimensions scored 0-10 |

Every agent has anti-rationalization Red Flags that counter the specific excuses it's most likely to make. The coder's prompt stops it from "just adding one small improvement." The inspector's prompt stops it from "fixing a small CSS issue myself." Role boundaries are enforced, not suggested.

**Beyond the built-ins.** The pilot is not limited to these roles. During Phase 1 (Strategize), the pilot analyzes the task and determines exactly which roles are needed — including ones not listed here. Need a security auditor? A database migration specialist? A DevOps engineer to configure CI/CD? The pilot designs the role, writes its prompt, and dispatches it like any other agent. The built-in roster covers the most common engineering workflows; the pilot covers everything else.

**Frontend projects** need `agent-browser`:

```bash
npm install -g agent-browser && agent-browser install
```

---

## Core Philosophy

**Task economy, never at the cost of correctness.** Crewpilot doesn't over-assemble for small tasks, and doesn't under-resource complex ones. The pilot picks the right team — and the right roles — for the job. A typo fix gets one agent. A full-stack feature gets the full chain. And when a task needs a role that doesn't exist yet, the pilot creates one.

**Completeness is cheap, incompleteness is expensive.** The review that catches a bug costs seconds. The test that prevents a regression costs seconds. The doc that saves future-you hours of confusion costs seconds. AI makes the marginal cost of completeness near-zero.

**Orchestration over execution.** The pilot never touches source code. This isn't a limitation — it's the architecture. Separation of concerns prevents the "solo agent degradation" problem.

**Verification is mandatory.** Every agent has a checklist. Every task has a completion signal. Inspector is a hard gate for frontend. Review is two-pass for complex changes. "Looks good" is never a completion criterion.

---

## Project Structure

```
Crewpilot/
├── skills/run/SKILL.md              # /crewpilot:run — full orchestration lifecycle
├── skills/run/prompts/              # Agent role prompts (injected at spawn time)
│   ├── researcher.md, architect.md
│   ├── coder.md, reviewer.md, tester.md
│   ├── inspector.md, writer.md
│   └── _communication.md           # Shared communication protocol
├── skills/plan/SKILL.md             # /crewpilot:plan — preview without execution
├── scripts/                         # install, init-project, uninstall
├── CLAUDE.md                        # IntentGate routing + agent directory
└── package.json
```

---

## License

MIT — see [LICENSE](LICENSE).
