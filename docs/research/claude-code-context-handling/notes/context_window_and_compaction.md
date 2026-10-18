# Context-window size, agent quality, and Claude Code's in-session context tools (as of Oct 2026)

Source-type legend: **[OFFICIAL]** = Anthropic docs/engineering/blog; **[RESEARCH]** = third-party technical report; **[PRACTITIONER]** = individual opinion/experience; **[SECONDARY]** = aggregator/AI summary (lower trust).

Note on currency: the Claude Code docs at code.claude.com were fetched on 2026-10-18 and reference versions up to v2.1.283 and models up to Opus 5.5 / Sonnet 5.5 / Fable 5.1, so they describe current behavior. The Anthropic engineering posts are from Sep and Nov 2025. Chroma's research is from Jul 2025 and tested Claude 4-era models, so it is roughly 15 months old and predates the 1M-window models.

## 1. Evidence that quality degrades well before the hard window limit, and whether ~120k is a reasonable working threshold

### Takeaway
Anthropic's official docs and engineering posts state plainly that performance degrades as context fills, as a gradient rather than a cliff. Chroma's 18-model study (Jul 2025) found degradation with input length on every experiment, including simple tasks. The ~120k "smart zone" figure is Matt Pocock's personal, anecdotal threshold. No benchmark validates it, and Anthropic's own MRCR claims for 1M models (self-reported) suggest retrieval holds up far beyond it. It works as a heuristic for keeping sessions short, not as a measured limit.

### Cited Findings
**Anthropic, official**
- Best-practices doc: "Most best practices are based on one constraint: Claude's context window fills up fast, and performance degrades as it fills." When context is "getting full, Claude may start 'forgetting' earlier instructions or making more mistakes. The context window is the most important resource to manage." [OFFICIAL] — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- "Long sessions with irrelevant context can reduce performance," and "A clean session with a better prompt almost always outperforms a long session with accumulated corrections." [OFFICIAL] — [Claude Code best practices](https://code.claude.com/docs/en/best-practices)
- "Effective context engineering for AI agents" (Sep 29, 2025): as token count increases, "the model's ability to accurately recall information from that context decreases" ("context rot"). This is observed across all models, though some degrade more gently than others. [OFFICIAL] — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Same post: models have a finite "attention budget" that each new token depletes. Transformer attention creates n² pairwise relationships, so attention gets stretched as context grows. Models learn attention patterns mostly from shorter sequences, so they have less experience with context-wide dependencies. Degradation is "a performance gradient rather than a hard cliff": models stay capable but lose precision in retrieval and long-range reasoning. Context is "a finite resource with diminishing marginal returns." [OFFICIAL] — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- How Claude Code works: "As you work, context fills up. Claude compacts automatically, but instructions from early in the conversation can get lost. Put persistent rules in CLAUDE.md." [OFFICIAL] — [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)

**Chroma "Context Rot" technical report (Hong, Troynikov, Huber; Jul 14, 2025)** [RESEARCH] — [Chroma Research](https://www.trychroma.com/research/context-rot)
- Tested 18 LLMs, including Claude Opus 4, Sonnet 4, Sonnet 3.7, Sonnet 3.5 and Haiku 3.5; o3, GPT-4.1 (incl. mini/nano), GPT-4o, GPT-4 Turbo and GPT-3.5 Turbo; Gemini 2.5 Pro, 2.5 Flash and 2.0 Flash; and Qwen3 235B, 32B and 8B. Temperature 0, 8 input lengths × 11 needle positions, scored by a GPT-4.1 judge with >99% agreement with humans.
- Core finding: performance degraded as input length grew in every experiment. Models "do not use their context uniformly," even on simple tasks.
- Needle-question similarity: lower-similarity (less lexically obvious) pairs degraded faster with length. This means real tasks, where the relevant fact isn't a near-verbatim match, degrade faster than classic needle-in-a-haystack (NIAH) suggests.
- Distractors: a single distractor cut performance relative to the needle-only baseline, and four distractors cut it further. Claude models had the lowest hallucination rates. GPT models had the highest.
- Haystack structure: shuffled haystacks beat logically coherent ones in all 18 models ("structural coherence consistently hurts model performance").
- LongMemEval: every model scored higher on a ~300-token focused prompt than on the ~113k-token full prompt. Claude showed the largest gap, mainly from abstaining when uncertain rather than hallucinating.
- Repeated-words replication task: performance fell with length. Some models produced random output at a few hundred to a few thousand words.
- Caveat: these are Claude 4 / Sonnet 3.x-era models (mid-2025). They are not the 1M-window Opus 4.6+/Sonnet 5/Fable generation.

**Anthropic's 1M-context claims (counter-evidence, self-reported)**
- 1M context GA for Opus 4.6 and Sonnet 4.6 (Mar 13, 2026): Opus 4.6 scores 78.3% on MRCR v2 at 1M tokens, "the highest among frontier models at that context length." Both models "maintain accuracy across the full 1M window." [OFFICIAL, vendor benchmark] — [Claude blog: 1M context GA](https://claude.com/blog/1m-context-ga)
- A third-party blog says Opus 4.6 MRCR went from 71.9% at 128K to 78.3% at 1M, and that GPT-5.4 dropped from about 80% to 36.6%. I could not verify these figures against a primary source. [SECONDARY] — [themenonlab](https://themenonlab.blog/blog/claude-1m-context-rag-not-dead)
- Launch coverage gave 76% MRCR v2 for Opus 4.6 versus 18.5% for Sonnet 4.5. This is probably the launch figure, before the GA number. [SECONDARY] — [NYU Shanghai RITS](https://rits.shanghai.nyu.edu/ai/anthropic-releases-claude-opus-4-6-with-1m-token-context-window)
- The Claude Code model-config doc makes no measured claim about quality at long context. The closest it comes is a product description of Fable: "It holds long sessions without losing the thread." [OFFICIAL, marketing claim] — [Model configuration](https://code.claude.com/docs/en/model-config)

**The "smart zone" / ~120k idea**
- Matt Pocock (video transcript on /handoff): "you've only got about 120k to work with" for smart tasks, and "around the 120k token mark, I start to feel like I'm in the dumb zone." This is his personal experience, not a measurement. [PRACTITIONER, via AI-generated transcript summary] — [SozAI transcript: "/handoff is my new favourite skill"](https://sozai.app/transcript/handoff-new-favourite-skill/index.md)
- The AI Hero dictionary (Pocock) frames the smart zone / dumb zone as a result of attention degradation. As a session grows, each token's attention is spread over more competitors, and noise crowds out the signal. The model is unchanged; only the context grew. Its advice is to clear or compact when a session bloats. [PRACTITIONER] — [aihero.dev dictionary](https://www.aihero.dev/dictionary/smart-zone) (search-snippet only; the page returned 404 when fetched)
- Other practitioners give different boundaries. An opinion piece uses ~100k. Another source credits Dex Horthy with coining "Dumb Zone" and puts the inflection at about 40% context utilization. Some cite about 150k as a rule of thumb. [PRACTITIONER/SECONDARY] — [Feedbagel](https://feedbagel.com/post/dont-trust-large-context-windows); [daily.dev "What is the dumb zone?"](https://daily.dev/posts/what-is-the-dumb-zone--zlsk071dj)

### Inferences
- The direction of the effect (more context leads to lower precision and more missed instructions) is well supported by both official docs and independent research. The magnitude and the threshold depend on the model and the task. Chroma suggests messy agentic contexts (coherent text, many near-miss distractors such as similar files and failed attempts) are the worst case, and a coding session is exactly that kind of context.
- MRCR-style recall at 1M measures retrieval, not instruction-following or multi-step reasoning over a polluted history. So Anthropic's 1M recall claims don't refute the practitioner observation that agent judgment gets worse in long sessions. They do suggest the exact cutoff (120k) is soft and probably higher for 2026 models than for mid-2025 ones.
- ~120k is a reasonable, conservative trigger to wrap up or hand off a task, especially on a 200k-window model, where it is about 60% full. On a 1M-window model it is about 12%, so that framing shows how far the default auto-compact (~967K) sits above any "smart zone." Treat it as a habit, not a law.

### Gaps
- I found no independent (non-Anthropic) benchmark of 2026 Claude models (Opus 4.7+/5.x, Sonnet 5.x, Fable) showing where coding-agent quality degrades with context fill. No Chroma follow-up on these models turned up.
- I did not retrieve primary data from other long-context benchmarks (NoLiMa, Fiction.LiveBench, RULER, HELMET) for current Claude models. I make no claims about them here.
- I couldn't fetch Pocock's primary aihero.dev "smart zone" page (404). The 120k figure comes from an AI-generated transcript summary of his video.

## 2. What /compact (and auto-compaction) preserves versus loses, and when a written handoff beats compaction

### Takeaway
Compaction replaces the verbatim conversation with a structured summary. Startup content (system prompt, project-root CLAUDE.md, auto memory, plan file) reloads from disk, along with up to 5 recently modified files and the bodies of invoked skills (capped). Full tool outputs, intermediate reasoning, early detailed instructions, path-scoped rules and hook-injected context are summarized away. Anthropic's own long-running-agent work says "compaction isn't sufficient" and uses explicit progress files plus git for continuity across sessions. That is the same idea as a practitioner handoff file.

### Cited Findings
**What the summary keeps and loses**
- The summary keeps "your requests and intent, key technical concepts, files examined or modified with important code snippets, errors and how they were fixed, pending tasks, and current work. It replaces the verbatim conversation: full tool outputs and intermediate reasoning are gone… Claude can still reference the rest of the work but won't have the exact content." [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window)
- When context fills up, Claude Code "clears older tool outputs first, then summarizes the conversation if needed. Your requests and key code snippets are preserved; detailed instructions from early in the conversation may be lost." [OFFICIAL] — [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- Best practices: auto compaction "preserves important code and decisions," and "Claude summarizes what matters most, including code patterns, file states, and key decisions." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)

**What survives compaction, by mechanism (official table)** [OFFICIAL] — [Explore the context window: What survives compaction](https://code.claude.com/docs/en/context-window)
| Mechanism | After compaction |
|---|---|
| System prompt and output style | Still apply |
| Project-root CLAUDE.md and unscoped rules | Re-injected from disk |
| Auto memory (MEMORY.md) | Re-injected from disk |
| Git status snapshot | Fresh one read, if the session started with one |
| Plan-mode plan | Re-injected from disk |
| Rules with `paths:` frontmatter | Reloaded only on demand, when trigger files are touched again |
| Nested (subdirectory) CLAUDE.md | Reloaded only on demand |
| Files read or edited | Up to 5 re-read, most recently modified first. A file over 5,000 tokens comes back as a path reference only ("Referenced file") |
| Invoked skill bodies | Re-injected, capped at 5,000 tokens per skill and 25,000 total; oldest dropped first; truncation keeps the start of the file |
| Skill listing (descriptions) | NOT re-injected |
| Background commands and subagents | Keep running; Claude is reminded which are live |
| Context added earlier by hooks | Summarized with the rest of the conversation |
| SessionStart hooks matching the `compact` source | Run again; their output is added to the compacted context |
- "If a rule must persist across compaction, drop the `paths:` frontmatter or move it to the project-root CLAUDE.md." Put the most important skill instructions near the top of SKILL.md, because truncation keeps the start. [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window)
- Since v2.1.198, the summarization request inherits the session's extended-thinking setting. [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window)

**Steering compaction**
- `/compact <instructions>`, e.g. `/compact Focus on the API changes`. Running a focused compact before a long new task means "the summary keeps what you choose instead of what the automatic pass guesses is important." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices); [Explore the context window](https://code.claude.com/docs/en/context-window)
- CLAUDE.md instructions, e.g. "When compacting, always preserve the full list of modified files and any test commands." Alternatively, add a "Compact Instructions" section to CLAUDE.md. The costs doc shows a `# Compact instructions` heading example. [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices); [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works); [Manage costs](https://code.claude.com/docs/en/costs)
- Partial compaction: `/rewind` (or Esc Esc), select a message, then **Summarize from here** (condenses later messages and keeps earlier context intact) or **Summarize up to here** (condenses earlier messages and keeps recent ones in full). You can type optional focus instructions on the "add context (optional)" row. The original messages stay in the session transcript on disk. [OFFICIAL] — [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- You can re-inject critical context after compaction with a SessionStart hook on the `compact` source. [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window)

**When auto-compaction triggers**
- Default: compacts "when the conversation reaches the model's context limit." Models with a native 1M window (Fable, Sonnet 5+, Haiku 5.5, Opus 4.7+) compact "at about 967K tokens by default." Sonnet 4.6 and Opus 4.6 without extended context compact at the 200K boundary, and so does any model when `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` is set. Cloud sessions compact "as the conversation approaches the model's limit." [OFFICIAL] — [Model configuration](https://code.claude.com/docs/en/model-config)
- You can lower the trigger with `/autocompact 500k` (saved per model in user settings under `modelSettings`), the `autoCompactWindow` setting, the `--autocompact` launch flag, or the `CLAUDE_CODE_AUTO_COMPACT_WINDOW` env var, which takes precedence over all the others. Accepted range is 100K–1M tokens, capped at the model window. `/autocompact auto` restores the default. `DISABLE_COMPACT` also exists. [OFFICIAL] — [Model configuration](https://code.claude.com/docs/en/model-config)
- Thrashing guard: if a single huge file or tool output refills context right after each summary, Claude Code stops auto-compacting after a few attempts and shows an error. [OFFICIAL] — [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- Idle compaction also exists (`idleCompaction` setting). [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window)
- Cost: "`/compact` reads the conversation it summarizes, so compacting a large context is itself a large request. When you want a fresh start instead of continuity, `/clear` costs nothing." Compaction also forces a prompt-cache rebuild (shown as an "expected rebuild" in `/usage`). [OFFICIAL] — [Manage costs](https://code.claude.com/docs/en/costs)

**Compaction versus a handoff file**
- "Effective context engineering" warns that overly aggressive compaction can lose subtle context whose importance only appears later. For tuning, it says "Start by maximizing recall," then improve precision. It names three tools: compaction suits extensive back-and-forth, structured note-taking (e.g. NOTES.md, to-do lists) suits iterative work with milestones, and sub-agents suit parallel exploration. [OFFICIAL] — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- "Effective harnesses for long-running agents" (Nov 26, 2025): "However, compaction isn't sufficient." Compaction "doesn't always pass perfectly clear instructions to the next agent." Anthropic's harness instead has each new context window rebuild state from `claude-progress.txt`, git history, and a JSON feature list (chosen over Markdown because models are less likely to overwrite it). Each session ends by committing and updating progress notes. [OFFICIAL] — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- Best practices recommends this for big features: have Claude write a self-contained SPEC.md, then "start a fresh session to execute it. The new session has clean context focused entirely on implementation." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)
- Pocock: compact "is only really one session," and compacting to switch tasks would "clobber all of the progress." A /handoff markdown file lets side work start in a fresh session and "keep my current session pure." The file is portable to other agents (Codex, Copilot CLI), and he treats handoff files as disposable (OS temp dir, sensitive data redacted). [PRACTITIONER, via AI transcript summary] — [SozAI transcript](https://sozai.app/transcript/handoff-new-favourite-skill/index.md)

### Inferences
- Compaction is lossy on exactly the things that are hard to rebuild: verbatim tool output, nuanced early instructions, path-scoped rules, and the reasoning behind rejected approaches. It is good at "current task state." It is weaker than a deliberate handoff when (a) the next work is a different task, (b) the session is polluted with failed attempts (best practices says to `/clear` after two failed corrections), (c) continuity must survive across days or agents, or (d) you want a human-reviewable record. In those cases a written handoff, spec, or progress file plus `/clear` is better.
- Compaction is preferable when you are mid-task with valuable back-and-forth and want to keep going in the same thread. Steer it with `/compact <focus>` or Summarize-from/up-to-here, rather than letting auto-compact pick at ~967K on 1M models, which is long after any practitioner "smart zone."
- For the 1M-window default (auto-compact at ~967K), an explicit `/autocompact` value (e.g. 200k–300k) is the official lever for compacting earlier. The docs don't recommend a specific value.

### Gaps
- The docs don't publish the exact compaction prompt or summary template beyond the bullet list of kept categories.
- No official guidance gives a numeric `/autocompact` value for best quality. No official data compares compaction quality against a fresh-session handoff.

## 3. What Anthropic officially recommends about /clear, compaction, subagents, and token budgeting

### Takeaway
Official guidance: run `/clear` between unrelated tasks and after two failed corrections. Use subagents to keep exploration out of the main context. Keep CLAUDE.md short (under ~200 lines) and move situational content into on-demand skills. Use `/compact <focus>` or rewind-summarize for control. Use `/rename` plus `--continue`/`--resume` to treat sessions like branches. Checkpoints (`/rewind`) undo code and conversation but don't track Bash or subagent edits.

### Cited Findings
**/clear**
- "Use `/clear` frequently between tasks to reset the context window entirely." Failure pattern "kitchen sink session" → fix: `/clear` between unrelated tasks. "Correcting over and over" → "After two failed corrections, `/clear` and write a better initial prompt incorporating what you learned." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)
- Costs doc: "Use `/rename` before clearing so you can find the session later, then `/resume` to return to it." `/clear` resets `/usage` session totals (since v2.1.211). After a `/clear`, the rewind menu offers `/resume <session-id> (previous session)` until you exit the process. [OFFICIAL] — [Manage costs](https://code.claude.com/docs/en/costs); [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- Escape hatch: "Sometimes you should let context accumulate because you're deep in one complex problem and the history is valuable." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)

**Subagents and side questions**
- "Since context is your fundamental constraint, use subagents to keep research out of it." Subagents run in separate windows and report back summaries. A fork starts with a copy of the conversation, but its tool calls still stay out of your context. [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices); [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- Engineering post: sub-agents may use tens of thousands of tokens and return condensed summaries of about 1,000–2,000 tokens. [OFFICIAL] — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- `/btw` side questions: "The answer never enters conversation history." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)

**Token budgeting and startup footprint**
- CLAUDE.md is loaded every session. "Bloated CLAUDE.md files cause Claude to ignore your actual instructions!" "Aim to keep CLAUDE.md under 200 lines." Move workflow-specific instructions to skills, which load on demand. `disable-model-invocation: true` keeps a skill's description out of context entirely. [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices); [Manage costs](https://code.claude.com/docs/en/costs); [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works)
- Auto memory: the first 200 lines or 25KB of MEMORY.md load at session start. MCP tool schemas are deferred by default via tool search, so only names and server instructions cost context. Prefer CLI tools (`gh`, etc.) as more context-efficient than MCP. Use hooks to pre-filter verbose output (e.g. show only test failures). [OFFICIAL] — [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works); [Manage costs](https://code.claude.com/docs/en/costs)
- Cost dynamics: Claude Code sends the full conversation with each request. Cache lifetime is 1h on subscriptions and 5 min on API by default, and a cache miss after a break reprocesses the full context. [OFFICIAL] — [Manage costs](https://code.claude.com/docs/en/costs)

**/rewind and checkpoints**
- Every prompt that starts a turn creates a checkpoint. Snapshots are kept for the 100 most recent checkpoints and persist across resume. They are deleted by the retention sweep (~30 days, `cleanupPeriodDays`). Menu options: Restore code and conversation / Restore conversation / Restore code / Summarize from here / Summarize up to here. [OFFICIAL] — [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- Limitations: Bash-made file changes are not tracked, subagent edits are usually not restored (except foreground forked skills), external or concurrent-session edits are not tracked, and symlinked or hard-linked files are skipped. "Not a replacement for version control." [OFFICIAL] — [Checkpointing](https://code.claude.com/docs/en/checkpointing)
- For a different approach that leaves the original intact, use `/branch` or `claude --continue --fork-session` rather than rewind-summarize. [OFFICIAL] — [Checkpointing](https://code.claude.com/docs/en/checkpointing)

**Session resume**
- Sessions are saved as JSONL under `~/.claude/projects/`. `claude --continue` resumes the most recent session and `claude --resume` picks from a list. Both reopen the same session ID and append. `--fork-session` / `/branch` copies the history to a new ID. "Sessions are independent": a new session starts with a fresh window, and cross-session persistence comes from CLAUDE.md and auto memory. Name sessions with `/rename` "and treat them like branches." [OFFICIAL] — [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works); [Best practices](https://code.claude.com/docs/en/best-practices)

**API-level context management (for custom agents / SDK, not Claude Code CLI knobs)**
- Context editing (beta header `context-management-2025-06-27`). The `clear_tool_uses_20250919` strategy clears the oldest tool results past a `trigger` (default 100,000 input tokens), keeps `keep` recent pairs (default 3), and supports `clear_at_least`, `exclude_tools` and `clear_tool_inputs`. Cleared results become placeholder text. `clear_thinking_20251015` manages old thinking blocks. When combined with the memory tool (`memory_20250818`), Claude gets a warning near the threshold so it can save to memory first. Clearing invalidates the prompt cache. [OFFICIAL] — [Context editing docs](https://platform.claude.com/docs/en/build-with-claude/context-editing)
- "For most use cases, server-side compaction is the primary strategy." The edit type is `compact_20260112` in `context_management`. Anthropic "recommends server-side compaction over SDK compaction," and the SDK `compaction_control` parameter is deprecated (removed in Python SDK v1.0). [OFFICIAL] — [Context editing docs](https://platform.claude.com/docs/en/build-with-claude/context-editing)
- The engineering post calls tool-result clearing "one of the safest, lightest-touch forms of compaction." [OFFICIAL] — [Anthropic Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- Claude Code itself does a version of this automatically: it "clears older tool outputs first, then summarizes," and `/usage` counts "clearing old tool results" as an expected cache rebuild. [OFFICIAL] — [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works); [Manage costs](https://code.claude.com/docs/en/costs)

**How 1M-token models change the advice**
- Supported: Fable 5.1/5, Sonnet 5+, Haiku 5.5, Opus 4.6+, Sonnet 4.6. Default 1M (no `[1m]` suffix): Fable, Sonnet 5+, Haiku 5.5, Opus 4.7+. Opus 4.6 and Sonnet 4.6 need a `[1m]` variant, depending on plan. On the Anthropic API there's no premium above 200K, except Haiku 5.5 above 100K. Turn it off with `CLAUDE_CODE_DISABLE_1M_CONTEXT=1`. "Compaction works the same way at the larger limit." [OFFICIAL] — [Model configuration](https://code.claude.com/docs/en/model-config); [Explore the context window](https://code.claude.com/docs/en/context-window)
- The 1M GA blog mentions fewer compactions, with one customer citing a 15% drop in compaction events (testimonial, not a benchmark). [OFFICIAL, testimonial] — [Claude blog](https://claude.com/blog/1m-context-ga)
- The best-practices doc, which is current with 1M-default models, still opens with "performance degrades as it fills" and still recommends aggressive `/clear`. A larger window did not change the official advice. [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)

### Inferences
- A 1M window changes when you're forced to compact (~967K by default), not whether a long, polluted context hurts quality. Combined with Chroma's findings and Anthropic's own "gradient, not cliff" framing, the practical upshot is that you now have to impose discipline yourself (`/clear`, handoff files, or a lower `/autocompact`), because the harness won't force a reset until very late.
- The cost side reinforces this. Every turn re-sends the full context, so a 500K-token session costs about 5× a 100K one per turn even when cached.

### Gaps
- There's no official statement of a recommended context-fill percentage or token count to clear at. Anthropic gives qualitative guidance only.

## 4. How to monitor context usage in Claude Code

### Takeaway
Use `/context` for a live, categorized breakdown with optimization suggestions. A custom status line can show `context_window.used_percentage` all the time. `/usage` shows session tokens, cost and cache stats. The auto-compact warning shows when you're near the auto-compact window.

### Cited Findings
- `/context`: "a live breakdown by category with optimization suggestions, including which CLAUDE.md and auto memory files loaded." Best practices also uses it to confirm CLAUDE.md loaded. [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window); [Best practices](https://code.claude.com/docs/en/best-practices)
- Best practices: "Track context usage continuously with a custom status line." [OFFICIAL] — [Best practices](https://code.claude.com/docs/en/best-practices)
- Status line JSON fields: `context_window.used_percentage`, `context_window.remaining_percentage`, `context_window.context_window_size` (200000 default, 1000000 for extended), `context_window.total_input_tokens` / `total_output_tokens`, `context_window.current_usage` (per-category breakdown), and `exceeds_200k_tokens` (fixed 200k threshold regardless of window). `used_percentage` = input tokens only (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`), excluding output. `current_usage` is null before the first API call and right after `/compact`. Minimal example: `jq -r '"[\(.model.display_name)] \(.context_window.used_percentage // 0)% context"'`. [OFFICIAL] — [Status line docs](https://code.claude.com/docs/en/statusline)
- `/usage` Session block: tokens by model (input/output/cache read/write), estimated cost, and a "Prompt cache (main)" line with hit share, misses and expected rebuilds from compaction or tool-result clearing (v2.1.251+). On subscription plans it also flags "long context" when that accounts for 10% or more of recent usage. [OFFICIAL] — [Manage costs](https://code.claude.com/docs/en/costs)
- The spinner token count covers only the current turn's output, not context size. Verbose mode shows a context-size count. [OFFICIAL] — [Manage costs](https://code.claude.com/docs/en/costs)
- An interactive simulation of what loads at startup and what each file read costs is at the context-window docs page. Representative numbers include a system prompt of about 4,200 tokens on a 200K model. [OFFICIAL] — [Explore the context window](https://code.claude.com/docs/en/context-window)

### Inferences
- If you want an alert at ~120k regardless of window size, a status line script should compute from `context_window.total_input_tokens` (absolute), not `used_percentage`. On a 1M model, 120k shows as only ~12%.

### Gaps
- I did not verify whether the built-in footer shows a context percentage without a custom status line, or the exact text and threshold of the built-in auto-compact warning.
