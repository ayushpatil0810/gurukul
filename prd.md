# Product Requirements Document

## Adaptive Learning and Assessment Portal

**Sponsor:** TechSummitTrainers
**Document status:** Draft v1.0 (hackathon build)
**Date:** October 16, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals, Non-Goals and Success Metrics](#3-goals-non-goals-and-success-metrics)
4. [Users and Roles](#4-users-and-roles)
5. [Product Principles](#5-product-principles)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [System Architecture](#8-system-architecture)
9. [Data Model](#9-data-model)
10. [API Surface](#10-api-surface)
11. [Privacy, Ethics and Fairness](#11-privacy-ethics-and-fairness)
12. [Release Plan and Scope Cut Line](#12-release-plan-and-scope-cut-line)
13. [Demo Plan and Acceptance Criteria](#13-demo-plan-and-acceptance-criteria)
14. [Risks and Mitigations](#14-risks-and-mitigations)
15. [Open Questions](#15-open-questions)
16. [Glossary](#16-glossary)

---

## 1. Overview

Students in one batch learn at very different speeds, yet most training platforms push everyone through the same fixed sequence. At the same time, online coding assessments have lost much of their meaning, because a correct answer can be pasted from an AI tool in seconds.

The Adaptive Learning and Assessment Portal addresses both problems:

1. **It adapts to what each student actually knows.** The syllabus is modeled as a concept map with prerequisites. A knowledge-tracing model continuously estimates mastery of every concept, and the next question always targets the weakest ready prerequisite.
2. **It evaluates how a student arrives at an answer, not only the answer.** Every coding session is recorded as a complete, replayable timeline. Integrity signals are derived from that timeline and are presented as _evidence for human review_, never as an automatic verdict. After each submission, the student is asked to explain their own code, and the platform judges whether the explanation matches what the code does.

The core design principle is to **record the process, not just the product**. A single append-only event log feeds the replay, the integrity signals, the mastery updates and the explain-your-code questions.

---

## 2. Problem Statement

| Problem                                                 | Consequence                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| One fixed sequence for every student                    | Fast learners are bored; students with gaps in prerequisites fall behind and never recover      |
| Final-answer-only grading                               | A pasted or AI-generated answer is indistinguishable from an earned one                         |
| Trainers lack visibility into _why_ a student struggles | Reteaching targets the wrong topics                                                             |
| Naive proctoring produces accusations                   | False positives harm students and erode trust in the platform                                   |
| Running untrusted student code is dangerous             | Infinite loops, file access and network calls can take down infrastructure or leak hidden tests |

---

## 3. Goals, Non-Goals and Success Metrics

### 3.1 Goals

- **G1.** Give each student a visibly personalized learning path driven by a prerequisite-aware mastery model.
- **G2.** Safely execute student code in multiple languages against hidden test cases, including hostile submissions.
- **G3.** Capture a complete, tamper-evident, replayable timeline of every graded session.
- **G4.** Derive transparent integrity signals, each linked to its exact moment in the replay and framed as evidence for review.
- **G5.** Verify understanding by generating "explain your code" questions from the student's own solution and judging the explanation against the code's real behavior.
- **G6.** Show students and trainers a mastery dashboard that explains which concepts are solid, which are weak, and why.

### 3.2 Non-Goals

- Automatic cheating verdicts or automatic grade penalties. A human always decides.
- Webcam, microphone, screen-recording or other invasive proctoring.
- Detecting a second device or a person sitting beside the student. The platform states this limitation openly.
- Building a general-purpose LMS (content authoring suites, billing, SSO, certificates, forums).
- Training a deep-learning knowledge-tracing model. There is no dataset, and such a model is not explainable.

### 3.3 Success Metrics

**Hackathon demo metrics**

| Metric                                                                     | Target                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Two students starting the same module receive different question sequences | Demonstrated live, with a visible reason for each routing decision         |
| Hostile submissions contained                                              | 100% of the red-team suite stopped with no host impact                     |
| Every integrity signal links to a replay moment                            | 100% of signals                                                            |
| Explain-your-code judgment on seeded cases                                 | Correctly separates authentic from mismatched explanations on the demo set |
| End-to-end latency for Run                                                 | Under 3 seconds for typical submissions                                    |

**Product metrics (post-hackathon)**

| Metric                                                  | Intent                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Time to mastery per concept vs. fixed-sequence baseline | Adaptivity shortens or improves learning                                                        |
| Prerequisite-remediation rate                           | Share of students rerouted to a weaker prerequisite, and whether it improves subsequent success |
| Trainer review rate and dismissal rate of signals       | Signals are useful, and the false-positive rate is monitored                                    |
| Explanation-match rate vs. test-pass rate               | Gap analysis shows where passing code is not understood                                         |
| Mastery-prediction accuracy                             | Predicted correctness vs. observed correctness on the next attempt                              |

---

## 4. Users and Roles

### 4.1 Student

Learns through adaptive modules, writes and submits code, answers explain-your-code questions, and views their own mastery dashboard.

### 4.2 Trainer

Owns the syllabus and question bank for their batches, monitors mastery, reviews flagged sessions in the replay, records dispositions, and conducts vivas.

### 4.3 Institute Administrator

Sets up batches and users and configures institute-wide policies (consent text, retention period, default signal thresholds). This role is intentionally thin for the initial release. A reviewer for integrity cases is a permission on the trainer role, not a separate role.

### 4.4 Permission Summary

| Capability                                   | Student | Trainer     | Admin             |
| -------------------------------------------- | ------- | ----------- | ----------------- |
| Take adaptive modules and submit code        | Yes     | No          | No                |
| View own mastery and own session history     | Yes     | n/a         | n/a               |
| View batch mastery heatmap                   | No      | Own batches | All batches       |
| Edit concept map and question bank           | No      | Yes         | Yes               |
| Replay sessions and review integrity signals | No      | Own batches | All batches       |
| Record dispositions on signals               | No      | Yes         | Yes               |
| Configure thresholds                         | No      | Per batch   | Institute default |
| Manage users, batches and policies           | No      | No          | Yes               |

---

## 5. Product Principles

1. **Evidence, never verdict.** Integrity signals are framed as "worth reviewing," include context that cuts the other way, and never produce a single cheating score or an automatic penalty.
2. **Explainable adaptivity.** Every routing decision and every mastery number can be explained in plain language to both the student and the trainer.
3. **Transparency to the student.** Students know they are recorded, can see flags raised on their own sessions, and can add context.
4. **Defense in depth for code execution.** No single control is trusted to contain hostile code.
5. **One event spine.** All analysis is derived from the same append-only event log, so results are reproducible and thresholds can be re-tuned and re-run.
6. **Honest about limits.** Client-side telemetry cannot be perfect, and signals are heuristics. The product says so.

---

## 6. Functional Requirements

Priority key: **P0** = must ship for the demo; **P1** = should ship; **P2** = nice to have.

### 6.1 Identity, Tenancy and Roles

| ID   | Requirement                                                                                                                  | Priority |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | -------- |
| ID-1 | Users authenticate with email and password (or a simple OAuth provider) and hold exactly one role: student, trainer or admin | P0       |
| ID-2 | Data is organized as institute → batch → student, and every record carries `institute_id`                                    | P0       |
| ID-3 | Role-based access control is enforced server-side on every endpoint. Students can access only their own data                 | P0       |
| ID-4 | Admin can create batches and assign trainers and students, including by CSV import                                           | P1       |
| ID-5 | Admin can edit consent text, data retention period and default signal thresholds                                             | P1       |

### 6.2 Curriculum: Concept Map and Question Bank

**Concept map**

| ID   | Requirement                                                                                                                                                     | Priority |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CM-1 | The syllabus is modeled as a directed acyclic graph of concepts with prerequisite edges (for example: Classes and Objects → Inheritance → Dependency Injection) | P0       |
| CM-2 | Trainers can create, edit and delete concepts and prerequisite edges. Any edit that would create a cycle is rejected with an explanation                        | P0       |
| CM-3 | Concepts are grouped into modules. Each module has a goal concept and a mastery threshold (default 0.80)                                                        | P0       |
| CM-4 | The concept map is visualized as an interactive graph                                                                                                           | P0       |
| CM-5 | Trainers can import a syllabus from a structured file (JSON or CSV)                                                                                             | P2       |

**Question bank**

| ID   | Requirement                                                                                                                                                       | Priority |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| QB-1 | Each question has a statement, difficulty (1 to 5), one or more concept tags, allowed languages, starter code per language, visible sample tests and hidden tests | P0       |
| QB-2 | Hidden tests are stored server-side only and are never sent to the client                                                                                         | P0       |
| QB-3 | Trainers can generate draft questions with an LLM from a concept and difficulty. Drafts stay unpublished until a trainer approves them                            | P1       |
| QB-4 | Trainers can retire a question. Retired questions are no longer selected, but historical attempts remain intact                                                   | P1       |
| QB-5 | Each question is validated before publishing: a reference solution must pass all tests in every allowed language                                                  | P1       |
| QB-6 | Questions can also be non-coding (multiple-choice or short answer), tagged to concepts, so mastery can be probed quickly                                          | P2       |

### 6.3 Adaptive Engine (Knowledge Tracing and Question Selection)

#### 6.3.1 Mastery model

Mastery is estimated per student per concept using **Bayesian Knowledge Tracing (BKT)**.

```
P(L | correct) = P(L)(1 - slip) / [ P(L)(1 - slip) + (1 - P(L)) * guess ]
P(L | wrong)   = P(L) * slip   / [ P(L) * slip   + (1 - P(L)) * (1 - guess) ]
P(L_next)      = P(L | obs) + (1 - P(L | obs)) * learn
```

Default parameters (configurable per concept): `p_init = 0.20`, `learn = 0.15`, `slip = 0.10`, `guess = 0.20`.

| ID   | Requirement                                                                                                                                                                   | Priority |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| AE-1 | The system maintains `p_know` for every student-concept pair and updates it after every graded attempt                                                                        | P0       |
| AE-2 | A coding attempt counts as correct when the hidden-test pass rate reaches a configurable threshold (default: all tests pass). Partial credit is stored for the dashboard      | P0       |
| AE-3 | An attempt on a question tagged with multiple concepts distributes its evidence across the tagged concepts, weighted toward the lowest-mastery concept when the attempt fails | P1       |
| AE-4 | Hint usage and excessive attempts reduce the weight of the evidence (a hinted success counts for less)                                                                        | P1       |
| AE-5 | Explain-your-code results are applied as additional evidence at a lower weight than test results                                                                              | P0       |
| AE-6 | Mastery decays slowly with time since the last evidence, so old concepts get periodic re-checks                                                                               | P2       |
| AE-7 | Every mastery update is stored with its cause (attempt, explanation result, decay), so the dashboard can show _why_ a number changed                                          | P0       |
| AE-8 | An optional short diagnostic at module start seeds mastery and addresses the cold-start problem                                                                               | P1       |

#### 6.3.2 Next-question selection

1. Start from the module's goal concept and collect its ancestors in the prerequisite graph.
2. Mark a concept **ready** when all of its direct prerequisites are at or above the mastery threshold.
3. From the concepts that are ready but below the threshold, select the one with the **lowest mastery** (the weakest ready prerequisite).
4. If every ancestor is at or above the threshold, select the goal concept.
5. Choose a question for the selected concept whose difficulty gives a predicted success probability near 70%, excluding questions already attempted.
6. Record the decision with a human-readable reason (for example: "Inheritance is your weakest prerequisite for Dependency Injection at 0.35").

| ID   | Requirement                                                                                                                               | Priority |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| NQ-1 | The selector implements the policy above deterministically, so a given state always yields the same choice                                | P0       |
| NQ-2 | Two students starting the same module with different mastery states are routed to different concepts                                      | P0       |
| NQ-3 | Each selection stores its reason and the alternatives considered. Both are visible to the student (simplified) and the trainer (detailed) | P0       |
| NQ-4 | Trainers can override a student's path by forcing a concept or unlocking one early. Overrides are logged                                  | P1       |
| NQ-5 | The selector never repeats a question in the same module unless the question bank for that concept is exhausted                           | P1       |
| NQ-6 | Preview mode lets a trainer simulate "if a student with mastery profile X does this, what comes next"                                     | P2       |

### 6.4 Coding Assessment and Secure Sandbox

#### 6.4.1 Student-facing assessment

| ID   | Requirement                                                                                                                                                                                       | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| CA-1 | Students write code in a browser editor with syntax highlighting. The editor is the single source for telemetry capture                                                                           | P0       |
| CA-2 | Languages supported at launch: Python, Java, JavaScript and C++ (additional languages are configuration, not code)                                                                                | P0       |
| CA-3 | **Run** executes the code against the visible sample tests and returns stdout, stderr, exit status and timing                                                                                     | P0       |
| CA-4 | **Submit** executes against the hidden tests and returns pass/fail counts and a failure category per test: wrong answer, timeout, memory limit, runtime error, compile error or blocked operation | P0       |
| CA-5 | Hidden test inputs and expected outputs are never shown. Only counts and categories are returned                                                                                                  | P0       |
| CA-6 | Run frequency and attempt count are limited by configurable rate limits                                                                                                                           | P1       |
| CA-7 | If the sandbox terminates a run for policy reasons (for example a blocked network call), the student sees a clear message rather than a generic failure                                           | P0       |
| CA-8 | The student cannot see any other student's code or results                                                                                                                                        | P0       |

#### 6.4.2 Sandbox security requirements

Execution uses ephemeral, single-use isolated environments (container runtime hardened with gVisor, or an equivalent such as Judge0 with `isolate`). The runner and test harness live **outside** the environment that executes student code.

| Control     | Requirement                                                                                                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Network     | Fully disabled (no outbound or inbound connectivity, including DNS)                                                               |
| Filesystem  | Read-only root filesystem, small writable tmpfs for scratch space, no host mounts, no access to other submissions or hidden tests |
| Privileges  | Non-root user, all Linux capabilities dropped, seccomp profile restricting system calls                                           |
| CPU         | CPU-time limit per test (default 2 s) and wall-clock limit (default 5 s)                                                          |
| Memory      | Hard cgroup limit (default 256 MB)                                                                                                |
| Processes   | PID limit (default 64) to stop fork bombs                                                                                         |
| Output      | Output size cap (default 64 KB), truncated and flagged when exceeded                                                              |
| Disk        | Per-run file size and total disk cap                                                                                              |
| Lifecycle   | One fresh environment per run, destroyed immediately afterward. No state persists between runs or between students                |
| Concurrency | Queue-based dispatch with a bounded worker pool and per-student rate limits so one user cannot starve others                      |

| ID   | Requirement                                                                                                                                                                                                                                                                                                                           | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| SB-1 | All controls in the table above are enforced and verified by automated tests                                                                                                                                                                                                                                                          | P0       |
| SB-2 | A **red-team suite** runs in CI and in the demo. It must include: infinite loop, fork bomb, memory bomb, reading `/etc/passwd` and other host files, writing outside scratch space, outbound network and DNS calls, listening on a port, excessive output, symlink and path-traversal attempts, and attempts to read the test harness | P0       |
| SB-3 | Every red-team case must end in a defined, categorized result with no effect on the host and no degradation of concurrent runs                                                                                                                                                                                                        | P0       |
| SB-4 | The test harness feeds stdin and compares stdout from outside the sandbox. Expected outputs never enter the student's environment                                                                                                                                                                                                     | P0       |
| SB-5 | Sandbox events (kills, blocked syscalls, limit breaches) are logged and attached to the attempt                                                                                                                                                                                                                                       | P1       |
| SB-6 | A trainer can re-run a stored submission against updated tests                                                                                                                                                                                                                                                                        | P1       |

### 6.5 Session Recording and Replay

#### 6.5.1 Capture

Every graded session records a complete timeline. The client emits events in small batches over a persistent connection, each with a sequence number.

**Event types**

| Type                            | Description                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `session_start` / `session_end` | Session boundaries                                                          |
| `insert`                        | Text typed, with range and timestamp                                        |
| `delete`                        | Text removed, with range and removed length                                 |
| `paste`                         | Text inserted from the clipboard, with its length and target range          |
| `cut` / `copy`                  | Clipboard operations from the editor                                        |
| `undo` / `redo`                 | Editor history actions                                                      |
| `autocomplete_accept`           | Insertion from an editor suggestion (distinguished from typing and pasting) |
| `run` / `run_result`            | Run request and its outcome                                                 |
| `submit` / `submit_result`      | Submission request and its outcome                                          |
| `focus` / `blur`                | Editor or window focus change                                               |
| `tab_hidden` / `tab_visible`    | Browser tab visibility change                                               |
| `explain_answer_*`              | Typing and pasting inside the explanation answer box                        |

**Event schema (illustrative)**

```json
{
  "session_id": "sess_123",
  "seq": 4812,
  "t": 1397.42,
  "type": "paste",
  "payload": {
    "range": { "start": 120, "end": 120 },
    "length": 612,
    "source": "clipboard"
  },
  "prev_hash": "9f2c..."
}
```

| ID   | Requirement                                                                                                                                 | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| RC-1 | Capture every keystroke-level change, deletion, paste, run and tab switch with a millisecond-resolution timestamp relative to session start | P0       |
| RC-2 | Events carry a sequence number. The server detects gaps and duplicates and records a data-quality note if events are missing                | P0       |
| RC-3 | Events are stored append-only. Each event stores the hash of the previous event so tampering is detectable                                  | P1       |
| RC-4 | The client buffers events locally and retries on connection loss, so a brief outage does not lose the timeline                              | P1       |
| RC-5 | The student sees a persistent "session is being recorded" indicator, and consent is recorded before any graded session starts               | P0       |
| RC-6 | Recording applies to graded sessions. Practice mode recording is configurable                                                               | P1       |

#### 6.5.3 Replay

| ID   | Requirement                                                                                                                             | Priority |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| RP-1 | The replay player reconstructs the editor contents at any point in time by applying events to the nearest snapshot                      | P0       |
| RP-2 | The player offers play, pause, seek, and speed control (0.5x to 8x)                                                                     | P0       |
| RP-3 | The timeline displays markers for runs (pass or fail), pastes, long pauses, tab switches, submissions and integrity signals             | P0       |
| RP-4 | Snapshots are stored periodically (about every 500 events) so scrubbing is near-instant                                                 | P1       |
| RP-5 | Trainers can attach timestamped notes to the replay                                                                                     | P1       |
| RP-6 | Replay is available only to trainers and admins with access to the batch (and to the student themselves if the institute policy allows) | P0       |

### 6.6 Integrity Signals

Signals are computed asynchronously from the event log by the integrity analyzer. All thresholds below are **defaults and are configurable** per batch, and signals can be recomputed when thresholds change.

#### 6.6.1 Signal definitions

| Signal                                       | Definition                                                                                                                     | Default trigger                                                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Large paste**                              | A single paste inserting a large block of code                                                                                 | Paste of 150 or more characters, or 40% or more of the final solution length                                                                                                                        |
| **Code appearing faster than typing rhythm** | Text arrives at a rate far above the student's own baseline, or text appears in one change with no paste or autocomplete event | Burst rate more than 3 standard deviations above the student's baseline (or above 12 characters per second sustained), or an insertion of 80 or more characters with no paste or autocomplete event |
| **No write-run-fix cycle**                   | The solution was assembled without the normal develop, run and correct loop                                                    | No runs before submit, or first run passing all tests on a solution of 30 or more lines, with no fail → edit → run loop                                                                             |
| **Evenly typed code with no corrections**    | Code typed at a uniform rhythm with no deletions or hesitation                                                                 | At least 300 typed characters, low variance in inter-key intervals (coefficient of variation below a calibrated threshold), deletion ratio below 2%, and no pauses beyond 5 seconds                 |
| **Explanation mismatch**                     | The student's explanation does not match what their code does (see 6.7)                                                        | Judge verdict of "no" or repeated "partial" on grounded questions                                                                                                                                   |

A baseline for the typing-rhythm signal is built from the student's earlier sessions and a short calibration task. When no baseline exists, population thresholds are used and the signal is marked as lower confidence.

#### 6.6.2 Signal record

Every signal is stored with:

- `type`, `strength` (low, medium, high), and `confidence`
- `t_start` and `t_end` (the exact moment in the replay)
- the raw metrics that triggered it
- a **plain-language explanation** (for example: "612 characters were inserted in a single paste at 04:12, which is 71% of the final solution")
- **context that cuts the other way** where it can be determined (for example: "the pasted text matches the student's own earlier submission" or "autocomplete was active")

| ID    | Requirement                                                                                                                                                                         | Priority |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| IS-1  | The four timeline signals above are computed for every graded session                                                                                                               | P0       |
| IS-2  | Every signal links to its moment in the replay. Clicking a signal opens the player at `t_start` with the range highlighted                                                          | P0       |
| IS-3  | Signal language is framed as evidence for review. The UI never uses the words "cheating," "fraud" or "guilty," and shows no single aggregate cheating score                         | P0       |
| IS-4  | Each signal shows the metrics, the threshold that fired, and any exculpatory context                                                                                                | P0       |
| IS-5  | Trainers can record a disposition on each signal: **dismissed**, **needs viva**, or **escalate**, with a required note. All dispositions are stored with the reviewer and timestamp | P0       |
| IS-6  | No grade, mastery value or student-visible status changes automatically as a result of a signal                                                                                     | P0       |
| IS-7  | A review queue lists flagged sessions sorted by signal strength, and supports filtering by batch, signal type and review status                                                     | P0       |
| IS-8  | Thresholds can be tuned per batch, and signals recomputed against stored events                                                                                                     | P1       |
| IS-9  | The dashboard states the known limits of the signals (for example: a second device is not visible, and fast typists and assistive technology can trigger false positives)           | P0       |
| IS-10 | Students can see signals raised on their own sessions and the trainer's disposition, and can add a comment                                                                          | P1       |

### 6.7 Explain-Your-Code Engine

After each submission, the platform asks two or three questions generated from the student's own solution and judges whether the explanation matches what the code does.

#### 6.7.1 Question generation

1. Parse the submission into an AST (tree-sitter) and extract facts: functions, data structures, loops, branches, edge-case handling and complexity-relevant constructs.
2. An LLM generates two or three questions grounded in specific lines of the student's code.
3. At least one question must be **execution-verifiable** where possible, so that ground truth comes from running code and not from model opinion.

**Question types**

| Type                | Example                                                | How it is verified                              |
| ------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Design rationale    | "Why did you use a dictionary here instead of a list?" | LLM judge against extracted facts               |
| Edge-case reasoning | "What happens on line 14 when the input is empty?"     | Sandbox run provides actual behavior            |
| Trace prediction    | "What does this print for input `[3, 1, 2]`?"          | Sandbox run provides the exact expected output  |
| Mutation            | "If line 12 changed to `<=`, which test would fail?"   | Sandbox runs the mutated code against the tests |

#### 6.7.2 Judging

For free-text answers, the judge receives the code, the question, the answer and the extracted facts, and returns structured output:

```json
{
  "verdict": "yes | partial | no",
  "evidence": ["quotes or line references supporting the verdict"],
  "missed_points": ["what the explanation did not cover"],
  "confidence": 0.0
}
```

| ID    | Requirement                                                                                                                                                   | Priority |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| EX-1  | Two or three questions are generated after every graded submission, each referencing specific lines of the student's code                                     | P0       |
| EX-2  | At least one question per submission is execution-verifiable (trace prediction or mutation) wherever the code allows                                          | P0       |
| EX-3  | Execution-verifiable answers are judged deterministically against sandbox output                                                                              | P0       |
| EX-4  | Free-text answers are judged by an LLM against the code and extracted facts, returning the structured verdict above                                           | P0       |
| EX-5  | Every verdict shows its evidence to the student and the trainer                                                                                               | P0       |
| EX-6  | Typing, pasting and timing inside the answer box are recorded in the session timeline and may produce review signals                                          | P1       |
| EX-7  | The result feeds mastery as lower-weight evidence (AE-5) and the integrity panel as a mismatch signal (6.6)                                                   | P0       |
| EX-8  | A student can contest a verdict, and the contest is routed to the trainer                                                                                     | P1       |
| EX-9  | Trainers can overrule a verdict. The overrule corrects the mastery update, and all overrides are logged                                                       | P1       |
| EX-10 | Trainers can run a live viva by selecting generated questions or adding their own                                                                             | P1       |
| EX-11 | Prompts, model outputs and judge evidence are logged for audit, and the judge uses a structured output schema with validation and a retry on malformed output | P1       |

### 6.8 Mastery Dashboards

#### 6.8.1 Student dashboard

| ID   | Requirement                                                                                                                                                                                                        | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| SD-1 | A concept-map heatmap colors each concept as solid, in progress, weak or not started                                                                                                                               | P0       |
| SD-2 | Each concept shows its mastery value and a confidence indicator                                                                                                                                                    | P0       |
| SD-3 | A "why" panel explains the state in plain language and cites the evidence (for example: "Weak because you missed 3 of your last 4 Inheritance questions" or "Blocked by a weak prerequisite: Classes and Objects") | P0       |
| SD-4 | A trend over time per concept, with the events that changed it                                                                                                                                                     | P1       |
| SD-5 | A suggested next step linking directly into the adaptive flow                                                                                                                                                      | P0       |
| SD-6 | Students see only their own data                                                                                                                                                                                   | P0       |

#### 6.8.2 Trainer dashboard

| ID   | Requirement                                                                                         | Priority |
| ---- | --------------------------------------------------------------------------------------------------- | -------- |
| TD-1 | Batch heatmap with students as rows and concepts as columns, color-coded by mastery                 | P0       |
| TD-2 | Cohort summary highlighting the weakest concepts across the batch, to guide reteaching              | P0       |
| TD-3 | Student drill-down with per-concept mastery, the "why" panel, attempt history and routing decisions | P0       |
| TD-4 | Integrity review queue (6.6) accessible from the dashboard, with a count of unreviewed flags        | P0       |
| TD-5 | Export of batch and student reports as CSV                                                          | P1       |
| TD-6 | Filters by module, date range and student                                                           | P1       |

#### 6.8.3 Institute dashboard (thin)

| ID   | Requirement                                                              | Priority |
| ---- | ------------------------------------------------------------------------ | -------- |
| AD-1 | Cross-batch summary of mastery distribution and activity                 | P2       |
| AD-2 | Policy settings page: consent text, retention period, default thresholds | P1       |

---

## 7. Non-Functional Requirements

| Category            | Requirement                                                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**        | Hidden tests and reference solutions never leave the server. All endpoints enforce authentication and role checks. Sandbox controls per 6.4.2. Secrets in environment configuration, never in the client |
| **Performance**     | Run results returned within 3 s for typical submissions. Event ingest acknowledges within 200 ms. Replay seek within 500 ms using snapshots. Next-question selection within 300 ms                       |
| **Scalability**     | Initial target of 200 concurrent students per instance. Sandbox workers scale horizontally behind a queue. Event analysis is asynchronous and never blocks typing                                        |
| **Reliability**     | No loss of recorded events during brief connection loss (client buffering and retry). Sandbox worker failure results in a retried or clearly failed run, never a hang                                    |
| **Auditability**    | Mastery updates, routing decisions, signals, verdicts, overrides and dispositions are all stored with cause, actor and timestamp                                                                         |
| **Reproducibility** | Signal computation and mastery updates are pure functions over stored data and can be re-run after threshold changes                                                                                     |
| **Usability**       | Editor and dashboard are responsive on laptop screens. The replay and review screens are optimized for fast triage by trainers                                                                           |
| **Accessibility**   | Keyboard-navigable, sufficient color contrast, and heatmap status never conveyed by color alone. Integrity signals account for assistive technology as a known confounder                                |
| **Data retention**  | Event logs and replays are retained per the institute's configured period and then deleted. Students can request access to their own data                                                                |
| **Observability**   | Structured logs, metrics for sandbox queue depth and run latency, and error tracking on all workers                                                                                                      |

---

## 8. System Architecture

### 8.1 Logical View

```
┌─────────────────────────── Browser (React / Next.js) ───────────────────────────┐
│ Code editor + telemetry hooks │ Replay player │ Student & Trainer dashboards    │
└───────────┬──────────────────────────────┬──────────────────────────────────────┘
            │ REST (run/submit/answers)    │ WebSocket (event stream)
┌───────────▼──────────────────────────────▼──────────────┐
│                 API service (FastAPI)                   │
│  Auth/roles │ Curriculum │ Session & event ingest │     │
│  Assessment orchestration │ Review workflow             │
└───┬────────────┬──────────────┬──────────────┬──────────┘
    │            │              │              │
    │      ┌─────▼─────┐  ┌─────▼──────┐  ┌────▼──────────────┐
    │      │ Mastery   │  │ Integrity  │  │ Explain engine    │
    │      │ engine    │  │ analyzer   │  │ (AST + LLM +      │
    │      │ BKT +     │  │ (signals   │  │  sandbox-verified │
    │      │ selector  │  │ from log)  │  │  questions)       │
    │      └─────┬─────┘  └─────┬──────┘  └────┬──────────────┘
    │            │              │              │
┌───▼────────────▼──────────────▼──────────────▼───┐   ┌──────────────────────┐
│ PostgreSQL: concepts, questions, mastery,        │   │ Redis queue + workers│
│ sessions, events (append-only), signals, reviews │◄──┤ analysis, LLM calls  │
└──────────────────────────────────────────────────┘   └──────────┬───────────┘
                                                                  │
                                              ┌───────────────────▼────────────────┐
                                              │ Sandbox cluster (gVisor / Judge0)  │
                                              │ no network · cgroups · seccomp ·   │
                                              │ hidden tests held outside          │
                                              └────────────────────────────────────┘
```

### 8.2 Components

| Component              | Responsibility                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web client**         | Editor, telemetry capture, replay player, dashboards, consent and recording indicator                                                                   |
| **API service**        | Authentication, curriculum CRUD, session lifecycle, event ingest, orchestration of runs and submissions, review workflow                                |
| **Event ingest**       | Validates, sequence-checks and appends events. Deliberately simple and fast. All analysis is asynchronous                                               |
| **Mastery engine**     | BKT updates and next-question selection, implemented as pure functions over stored state                                                                |
| **Integrity analyzer** | Computes signals from the event log in a worker and writes signal records with replay anchors                                                           |
| **Explain engine**     | AST fact extraction, question generation, deterministic and LLM-based judging                                                                           |
| **Sandbox cluster**    | Isolated execution of student code and verification runs, with the test harness held outside                                                            |
| **Data store**         | PostgreSQL for relational data and the event log (partitioned by session), with periodic snapshots. Object storage for large replay artifacts if needed |
| **Queue and workers**  | Redis-backed job queue for analysis, LLM calls and sandbox dispatch                                                                                     |

### 8.3 Recommended Stack

| Layer      | Choice                                                                         | Rationale                                                               |
| ---------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Front end  | Next.js, React, Monaco editor, react-flow (concept map), Recharts (dashboards) | Monaco exposes granular change events needed for telemetry              |
| Back end   | FastAPI (Python)                                                               | Same language as the mastery and analysis logic, and strong LLM tooling |
| Data       | PostgreSQL, Redis                                                              | Mature, simple, and sufficient for hackathon scale                      |
| Sandbox    | Judge0 (self-hosted) or custom runner on Docker with gVisor                    | Fastest path to multi-language execution with strong isolation          |
| Parsing    | tree-sitter                                                                    | Multi-language AST for explain-your-code                                |
| LLM        | Hosted LLM API with JSON-schema structured output                              | Question generation and judging                                         |
| Deployment | Docker Compose for the hackathon                                               | Single-command local and demo environments                              |

### 8.4 Key Flows

**Adaptive question flow**

1. Student opens a module. The API loads their mastery state.
2. The selector picks the concept and question (6.3.2) and stores the reason.
3. The student works. Telemetry streams to ingest throughout.
4. On Submit, the sandbox runs hidden tests. The mastery engine updates `p_know`.
5. The explain engine generates questions. The student answers. The verdict updates mastery and is stored.
6. The integrity analyzer runs asynchronously and writes signals.
7. The selector chooses the next question.

**Review flow**

1. A trainer opens the review queue and selects a flagged session.
2. The signal card shows metrics, explanation and context. Clicking it opens the replay at the signal's moment.
3. The trainer records a disposition with a note. If "needs viva," the student is notified and the viva is scheduled.

---

## 9. Data Model

| Table               | Key fields                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `institutes`        | `id`, `name`, `policy_json` (consent text, retention, default thresholds)                                                         |
| `users`             | `id`, `institute_id`, `role`, `name`, `email`                                                                                     |
| `batches`           | `id`, `institute_id`, `name`, `trainer_ids`                                                                                       |
| `batch_members`     | `batch_id`, `student_id`                                                                                                          |
| `concepts`          | `id`, `institute_id`, `name`, `description`, `bkt_params_json`                                                                    |
| `prerequisites`     | `concept_id`, `requires_id`                                                                                                       |
| `modules`           | `id`, `name`, `goal_concept_id`, `mastery_threshold`                                                                              |
| `module_concepts`   | `module_id`, `concept_id`                                                                                                         |
| `questions`         | `id`, `statement`, `difficulty`, `languages`, `starter_code_json`, `status`, `reference_solution_ref`                             |
| `question_concepts` | `question_id`, `concept_id`, `weight`                                                                                             |
| `tests`             | `id`, `question_id`, `visibility` (visible or hidden), `input_ref`, `expected_ref`                                                |
| `assignments`       | `id`, `batch_id`, `module_id`, `deadline`, `mode` (practice or graded), `attempt_limit`                                           |
| `mastery_state`     | `student_id`, `concept_id`, `p_know`, `confidence`, `updated_at`                                                                  |
| `mastery_updates`   | `id`, `student_id`, `concept_id`, `before`, `after`, `cause_type`, `cause_id`, `created_at`                                       |
| `routing_decisions` | `id`, `student_id`, `module_id`, `chosen_concept_id`, `chosen_question_id`, `reason`, `alternatives_json`                         |
| `sessions`          | `id`, `student_id`, `question_id`, `mode`, `consent_id`, `started_at`, `ended_at`                                                 |
| `events`            | `session_id`, `seq`, `t`, `type`, `payload_json`, `prev_hash`                                                                     |
| `snapshots`         | `session_id`, `seq`, `t`, `document_text`                                                                                         |
| `attempts`          | `id`, `session_id`, `kind` (run or submit), `language`, `code_ref`, `result_json`, `pass_rate`, `sandbox_log_ref`                 |
| `signals`           | `id`, `session_id`, `type`, `strength`, `confidence`, `t_start`, `t_end`, `metrics_json`, `explanation`, `context_json`           |
| `reviews`           | `id`, `signal_id`, `reviewer_id`, `disposition`, `note`, `created_at`                                                             |
| `explain_qa`        | `id`, `attempt_id`, `question_text`, `type`, `code_refs`, `answer_text`, `verdict`, `evidence_json`, `overruled_by`, `created_at` |
| `consents`          | `id`, `student_id`, `policy_version`, `accepted_at`                                                                               |
| `overrides`         | `id`, `actor_id`, `target_type`, `target_id`, `action`, `note`, `created_at`                                                      |

---

## 10. API Surface

Illustrative endpoints. All require authentication and role checks.

**Curriculum (trainer)**

- `POST /concepts`, `PATCH /concepts/{id}`, `DELETE /concepts/{id}`
- `POST /concepts/{id}/prerequisites`, `DELETE /concepts/{id}/prerequisites/{requires_id}`
- `POST /questions`, `POST /questions/generate`, `PATCH /questions/{id}`, `POST /questions/{id}/publish`

**Student flow**

- `GET /modules` and `POST /modules/{id}/start`
- `GET /modules/{id}/next` returns the question and routing reason
- `POST /sessions` (requires consent) and `POST /sessions/{id}/run` and `POST /sessions/{id}/submit`
- `WS /sessions/{id}/events` for telemetry
- `GET /attempts/{id}/explain-questions` and `POST /explain/{id}/answer`
- `GET /me/mastery` and `GET /me/mastery/{concept_id}/why`

**Review and replay (trainer)**

- `GET /review/queue`
- `GET /sessions/{id}/replay` and `GET /sessions/{id}/snapshots`
- `GET /sessions/{id}/signals`
- `POST /signals/{id}/review` (disposition and note)
- `POST /explain/{id}/overrule`

**Dashboards**

- `GET /batches/{id}/heatmap`
- `GET /batches/{id}/weak-concepts`
- `GET /students/{id}/mastery`
- `GET /batches/{id}/export.csv`

**Admin**

- `POST /batches`, `POST /batches/{id}/members`, `PUT /institute/policy`

---

## 11. Privacy, Ethics and Fairness

| Topic                       | Requirement                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Consent**                 | A graded session cannot start until the student has accepted the recording notice. The accepted policy version is stored. A visible recording indicator is shown throughout                                                                                              |
| **Data minimization**       | Capture only editor and session events. No webcam, microphone, screen capture or access to other applications                                                                                                                                                            |
| **Retention**               | Event logs and replays are deleted after the institute's configured retention period                                                                                                                                                                                     |
| **Access control**          | Replays and signals are visible only to authorized trainers and admins (and to the student per institute policy)                                                                                                                                                         |
| **No automated punishment** | No signal or verdict changes a grade or status without a human decision (IS-6)                                                                                                                                                                                           |
| **Right of reply**          | Students can see signals on their own sessions and add context (IS-10) and can contest explanation verdicts (EX-8)                                                                                                                                                       |
| **Fairness**                | Documented confounders: fast typists, assistive technology, IDE-style autocomplete, students pasting their own earlier code, and poor connectivity. The system captures exculpatory context where possible and monitors dismissal rates by batch to detect over-flagging |
| **Transparency of limits**  | The product states plainly that client-side capture can be imperfect and that a second device is not visible                                                                                                                                                             |
| **Auditability**            | Every disposition, override and verdict is logged with actor and timestamp                                                                                                                                                                                               |
| **LLM usage**               | Student code sent to the LLM is limited to what is required for the explain engine. Prompts and outputs are logged for audit, and the institute is informed in the consent text                                                                                          |

---

## 12. Release Plan and Scope Cut Line

### Phase 0: Foundations

Repository, Docker Compose environment, database schema, authentication and roles, seeded institute, batches, concept map and a small question bank.

### Phase 1: Walking Skeleton (end-to-end adaptive loop)

Editor → Run in sandbox → Submit against hidden tests → BKT update → next-question selection with reason. Telemetry capture is wired in from the start, because retrofitting it is costly.

**Exit criterion:** two seeded students starting the same module are routed to different concepts, with visible reasons.

### Phase 2: Differentiators

Replay player, the four integrity signals linked to replay moments, the review workflow, explain-your-code (including execution-verified questions), and the student and trainer dashboards.

**Exit criterion:** a flagged session can be opened from the review queue, the signal jumps to the replay moment, and a disposition can be recorded.

### Phase 3: Hardening and Polish

The full red-team suite in CI, the consent flow, seeded demo data, error states and the recorded demo run-through.

### Scope Cut Line

| Tier                 | Contents                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Must ship (P0)**   | Concept map and question editor, BKT with the selection policy and visible reasons, sandbox with the full red-team suite, telemetry and replay, the four signals with replay links, evidence framing and dispositions, explain-your-code with at least one execution-verified question, student and trainer dashboards, consent and recording indicator |
| **Should ship (P1)** | LLM question drafting, hint weighting, hash-chained events, threshold tuning, trainer path overrides, student view of their own flags, CSV export, diagnostic quiz                                                                                                                                                                                      |
| **Roadmap (P2)**     | Mastery decay and spaced re-checks, institute-wide analytics, syllabus import, non-coding question types, path preview simulator                                                                                                                                                                                                                        |

### Suggested Team Split (four people)

| Role | Ownership                                         |
| ---- | ------------------------------------------------- |
| A    | Sandbox, runner, hidden tests, red-team suite     |
| B    | Syllabus, mastery engine, question selection      |
| C    | Telemetry, event store, replay, integrity signals |
| D    | Front end, dashboards, explain-your-code flow     |

---

## 13. Demo Plan and Acceptance Criteria

### 13.1 Demo Script

1. **Adaptive paths.** Two students start the same module and receive visibly different next questions. The routing reason is shown for each.
2. **Sandbox safety.** Submit a fork bomb, a network call and a `/etc/passwd` read. Each is contained and reported with a clear category while other runs continue unaffected.
3. **Replay and evidence.** Open a flagged session, click the large-paste signal, and watch the replay jump to the moment. The signal card shows the metrics and the exculpatory context.
4. **Explanation check.** Show a pasted solution whose explanation does not match its behavior, resulting in a "recommend viva" outcome. Contrast it with an organically written solution that passes.
5. **Mastery dashboard.** End on the trainer heatmap and a student's "why" panel.

### 13.2 Acceptance Criteria

| Area           | Criterion                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Concept map    | Creating a prerequisite that forms a cycle is rejected with an explanation                                                            |
| Adaptivity     | Given two different mastery states, the selector returns different concepts, and each decision stores a reason                        |
| Mastery        | After a correct and an incorrect attempt, `p_know` changes per the BKT equations and the dashboard shows the cause                    |
| Sandbox        | Every case in the red-team suite ends in a categorized result, with no host effect and no impact on concurrent runs                   |
| Hidden tests   | No API response or client payload contains hidden test inputs or expected outputs                                                     |
| Replay         | Replay reconstructs the final submitted code exactly from the event log                                                               |
| Signals        | Seeded sessions trigger the intended signals. Each signal opens the replay at the correct moment                                      |
| Framing        | No UI string or API field presents a cheating verdict or an aggregate cheating score                                                  |
| Dispositions   | Recording a disposition requires a note and is stored with reviewer and timestamp                                                     |
| Explain engine | Execution-verifiable questions are judged from sandbox output. Seeded mismatched explanations receive "partial" or "no" with evidence |
| Dashboards     | Students see only their own data. Trainers see their batch heatmap with drill-down                                                    |
| Consent        | A graded session cannot begin without recorded consent, and a recording indicator is visible throughout                               |

---

## 14. Risks and Mitigations

| Risk                                       | Impact                                       | Mitigation                                                                                                                                    |
| ------------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| False accusations from heuristic signals   | Harm to students, loss of trust              | Evidence-only framing, exculpatory context, human dispositions, student right of reply, monitoring of dismissal rates, no automatic penalties |
| Sandbox escape or resource abuse           | Security breach or outage                    | Defense in depth (gVisor, seccomp, cgroups, no network), single-use environments, red-team suite in CI, bounded worker pool                   |
| LLM judge unreliability                    | Wrong verdicts affecting mastery and reviews | Execution-verified questions, structured outputs with validation, stored evidence, lower mastery weight, trainer overrule and student contest |
| BKT cold start and poor parameter fit      | Misleading early routing                     | Diagnostic quiz, conservative priors, per-concept parameters, trainer override                                                                |
| Client telemetry spoofing or gaps          | Incomplete or manipulated evidence           | Sequence checking, hash chaining, data-quality notes, stated limits                                                                           |
| Privacy concerns about keystroke recording | Adoption and compliance risk                 | Explicit consent, minimal capture, retention policy, access controls, transparency to students                                                |
| Question quality (ambiguous or weak tests) | Wrong mastery and unfair results             | Trainer approval of generated questions, reference-solution validation, ability to retire questions and re-run submissions                    |
| Scope too large for the build window       | Incomplete demo                              | Walking skeleton first, strict P0 cut line, seeded demo data                                                                                  |

---

## 15. Open Questions

1. Which programming languages are mandatory for the first batches, beyond Python, Java, JavaScript and C++?
2. Should students be allowed to replay their own sessions by default, or only on trainer request?
3. What retention period should be the default for event logs and replays?
4. Is the explain-your-code step mandatory for every submission, or only for graded assessments?
5. What mastery threshold and attempt limits should be the institute defaults?
6. Which LLM provider and data-handling terms are acceptable for processing student code?
7. Is a calibration task for the typing-rhythm baseline acceptable to students and trainers at the start of a batch?

---

## 16. Glossary

| Term                                 | Meaning                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Concept map**                      | A directed acyclic graph of concepts connected by prerequisite relationships                                                          |
| **BKT (Bayesian Knowledge Tracing)** | A probabilistic model that estimates the chance a student has mastered a concept from their sequence of correct and incorrect answers |
| **`p_know`**                         | The estimated probability that a student has mastered a concept                                                                       |
| **Ready concept**                    | A concept whose direct prerequisites are all at or above the mastery threshold                                                        |
| **Hidden tests**                     | Test cases stored server-side whose inputs and expected outputs are never shown to the student                                        |
| **Red-team suite**                   | A collection of deliberately hostile submissions used to verify sandbox containment                                                   |
| **Event log**                        | The append-only record of every editor and session event in a graded session                                                          |
| **Replay**                           | A reconstruction of the session by applying the event log to the editor contents over time                                            |
| **Integrity signal**                 | A computed observation about a session that points to a specific replay moment and is presented as evidence for human review          |
| **Disposition**                      | A trainer's recorded decision on a signal: dismissed, needs viva, or escalate                                                         |
| **Execution-verifiable question**    | An explanation question whose correct answer is obtained by running code (for example, trace prediction or mutation)                  |
| **Viva**                             | A live oral or written follow-up in which a student explains their own work to a trainer                                              |
