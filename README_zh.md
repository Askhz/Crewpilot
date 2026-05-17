# Crewpilot

> 把一个 Claude Code 会话变成一个专业 Agent 团队。研究、设计、编码、审查、测试、检查、文档——全自动编排，一条命令搞定。

<p align="center">
  <a href="README.md">English</a> · <b>中文</b>
</p>

---

### 你遇到的问题

你让 AI 编码助手"帮我做一个用户登录系统"。它打开文件，写了一些代码，可能加了个测试，然后说做完了。但你不知道的是：

- 它根本没研究你现有的认证中间件是怎么写的——所以它造了个轮子，还跟现有一半逻辑冲突
- 没人设计会话管理方案——refresh token 在 15 分钟后静默失效
- 代码提交前没人审查——密码重置接口有 SQL 注入漏洞
- 它写的"测试"只测了正常路径——空密码直接让验证器崩溃
- 没写任何文档——下个月接手维护的人只能靠猜
- 更没人打开浏览器看看登录页到底能不能渲染

**单打独斗的 Agent 一定会跳步骤。** 不是因为它不行——是因为它会丢上下文。改到第 5 个文件时，它已经忘了第 1 个文件需要什么。20 次工具调用后，注意力严重退化。结果是：看起来正常的代码，一上线就炸。

### Crewpilot 怎么解决

| 不用 Crewpilot | 用 Crewpilot |
|---|---|
| 一个 Agent，单线程，无记忆 | 一组专家，上下文隔离，结构化交接 |
| 跳过研究——直接写代码 | Researcher 先摸清代码库，再让人动笔 |
| 没有架构设计 | Architect 做文件级/函数级方案，含风险评估 |
| 测试最后写（甚至不写） | 红-绿-重构——先写测试，每步一个任务，绝不跳过 |
| "看着没问题"就叫审查 | 两轮审查：先对需求合规，再审代码质量 |
| 前端？祈祷能跑吧 | Inspector 打开真实浏览器，每页每状态逐一检查 |
| 没文档 | Writer 写的文档跟代码行为完全一致 |
| 同一个模型自己审自己 | 独立审查 Agent，全新上下文，全新视角 |

Crewpilot 给你的是一个资深工程团队的工作流——研究、设计、实现、审查、测试、UI 验证、文档——一行命令全搞定。

---

## 快速安装

```bash
git clone https://github.com/Askhz/Crewpilot
cd Crewpilot && node scripts/install.mjs
```

然后在你的项目里：

```bash
node /path/to/Crewpilot/scripts/init-project.mjs
```

重启 Claude Code 就行了。不需要 API Key，不需要外部服务，完全在 Claude Code 内部运行。

```bash
# 完整团队编排
/crewpilot:run 帮我做一个用户登录和注册系统

# 先看方案，确认后再执行
/crewpilot:plan 给设置页加个深色模式切换
```

### 免插件模式

不想装插件？Crewpilot 的编排规则也可以独立使用：

```bash
cat /path/to/Crewpilot/CLAUDE.md >> your-project/CLAUDE.md
```

### 卸载

```bash
node /path/to/Crewpilot/scripts/uninstall.mjs
```

---

## 你能得到什么

**自动意图分类。** 不用记命令——直接说你想要什么。Crewpilot 自动识别意图并路由：

| 你说的话 | Crewpilot 做的事 |
|---------|-----------------|
| `/crewpilot:run 帮我做一个登录页面` | 全团队：研究 → 架构设计 → 编码 → 两轮审查 → 测试 → 文档 |
| `/crewpilot:run 修一下这个认证 bug` | 精准团队：研究 → 架构设计 → 编码 → 测试 |
| `/crewpilot:run 帮我做个后台面板` | 前端全团队：同上 + Inspector 打开真实浏览器，跟 Coder 循环修复 |
| `/crewpilot:plan 审查一下 API 改动` | 仅出方案 — Pilot 展示工作流等你审批，不执行 |
| `/crewpilot:run 重构一下数据库层` | 重构团队：研究 → 架构设计 → 编码 → 测试 → 审查 |
| `审查一下 API 改动` | 自动识别为代码审查：研究 → 需求合规审查 ∥ 代码质量审查 |
| `路由系统是怎么工作的` | 单个 Agent 解释——不用上团队 |
| `列出所有接口` | 直接查——不用 Agent |

**按需匹配团队规模。** 改一行配置？Crewpilot 跳过 Architect、Writer 和额外 Reviewer。全栈功能跨越 15 个文件？所有需要的 Agent 全员上阵。不为改个 typo 全员出动，也不让一个 Coder 单挑生产系统。

**所有操作先经你审批。** Pilot 会展示完整的工作流方案——涉及哪些 Agent、什么顺序、什么依赖——你确认或修改后再执行。未经你点头，不会创建任何一个 Agent。

**Agent 之间自己沟通。** Architect 缺上下文会自己找 Researcher 问。Coder 和 Tester 自己对齐测试行为。Inspector 发现问题直接发 ISSUE 信号给 Coder，Coder 修完，Inspector 再验——持续循环直到每一页都干净。Pilot 不介入同事之间的对话。

---

## 内置角色

Crewpilot 预置了一批专业 Agent，每个都有明确的角色、工具权限和输出契约。**这些是起点，不是上限。** Pilot 可以根据任务需求创建任意角色——不限于下面列出的这几个。需要安全审计员？数据库专员？API 设计师？Pilot 围绕任务设计工作流，需要什么角色就创建什么角色。

| Agent | 角色 | 核心约束 |
|-------|------|---------|
| **pilot** | 编排者——设计工作流、分派任务、从不碰代码 | 分派、路由、信任 |
| **researcher** | 代码库探索者——找关键文件、理清依赖关系、识别技术栈 | 只读、结构化报告 |
| **architect** | 实现方案设计师——文件级/函数级方案、评估风险 | YAGNI、不留占位符 |
| **coder** | 代码实现者——按方案编码、自审查、报告状态 | 红-绿-重构 |
| **reviewer** | 两轮审查——先审需求合规，再审代码质量，分成两个独立任务 | PASS/FAIL 必须有证据 |
| **tester** | 测试写手——主路径、边界条件、错误场景 | 只改测试文件 |
| **inspector** | 前端 QA——打开真实浏览器，逐页逐状态检查 | 硬门控：没有 PASS，不许继续 |
| **writer** | 文档写手——README、注释、使用说明 | 先读代码再动笔 |

每个 Agent 都有反借口的 Red Flags 表，精准针对该角色最可能出现的偷懒理由。Coder 的 prompt 会阻止它"顺手加个小优化"。Inspector 的 prompt 会阻止它"这个 CSS 小问题我自己改一下就行"。角色边界不是建议，是强制。

**内置角色之外。** Pilot 不受限于这些预置角色。在 Phase 1（策略设计）阶段，Pilot 分析任务后确定需要哪些角色——包括上表没有的。需要安全审计员？数据库迁移专家？配置 CI/CD 的 DevOps 工程师？Pilot 设计角色、编写 prompt、像其他 Agent 一样分派任务。内置角色覆盖最常见的工程工作流，Pilot 负责剩下的所有场景。

**前端项目**需要安装 `agent-browser`：

```bash
npm install -g agent-browser && agent-browser install
```

---

## 核心理念

**按需匹配，但不牺牲正确性。** Crewpilot 不会为小事过度起兵，也不会让复杂任务资源不足。Pilot 为每个任务选择对的人、对的角色。改 typo 一个人足矣，全栈功能全链出击，任务需要不存在的角色——Pilot 现场创建一个。

**完备性很便宜，不完备性很昂贵。** 抓到一个 bug 的审查只需要几秒。防止一次回归的测试只需要几秒。省下未来几小时困惑的文档只需要几秒。AI 让边际完备成本趋近于零——永远做完整的事。

**编排优于执行。** Pilot 从不碰源码。这不是限制——这是架构设计。关注点分离正是防止"单打独斗退化"的核心机制。

**验证不可跳过。** 每个 Agent 有 checklist。每个任务有 completion signal。Inspector 是前端的硬门控。审查是复杂改动必经的两轮关。"看着没问题"永远不是完成标准。

---

## 项目结构

```
Crewpilot/
├── skills/run/SKILL.md              # /crewpilot:run — 完整编排生命周期
├── skills/run/prompts/              # Agent 角色 Prompt（运行时注入）
│   ├── researcher.md, architect.md
│   ├── coder.md, reviewer.md, tester.md
│   ├── inspector.md, writer.md
│   └── _communication.md           # 共享通信协议
├── skills/plan/SKILL.md             # /crewpilot:plan — 仅预览方案，不执行
├── scripts/                         # install, init-project, uninstall
├── CLAUDE.md                        # IntentGate 路由 + Agent 目录
└── package.json
```

---

## License

MIT — 详见 [LICENSE](LICENSE).
