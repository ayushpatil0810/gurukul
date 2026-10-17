import Link from "next/link";
import type { ConceptDashboardRow, AttemptDashboardRow, RecommendationView, StudentDashboard, TrainerDashboard } from "@/lib/services/dashboard";
import { formatMastery } from "@/lib/engine/dashboard-bands";
import type { ClassroomAnalyticsSummary } from "@/lib/services/classroom-analytics";

function StudentLearning({
  view,
  analytics,
}: {
  view: StudentDashboard;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  return (
    <div className="space-y-8">
      <header className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Learner Workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">Your mastery</h1>
          </div>
        </div>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-muted-foreground">
          {view.module
            ? `${view.module.name} uses a mastery threshold of ${view.module.threshold.toFixed(2)}. A percentage appears only where a mastery record is stored.`
            : "No module is published for your institute, so there is no recommendation yet."}
        </p>
      </header>

      <ClassroomAnalyticsCard analytics={analytics} />
      <Recommendation practice recommendation={view.recommendation} />
      <ConceptTable concepts={view.concepts} threshold={view.module?.threshold ?? null} />
      <AttemptTable attempts={view.attempts} showStudent={false} />
    </div>
  );
}

export function StudentDetail({
  view,
  analytics,
}: {
  view: StudentDashboard;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  return (
    <div className="space-y-8">
      <header className="border-b border-border/60 pb-6">
        <p className="text-xs font-medium text-muted-foreground">
          <Link href="/dashboard" className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline-offset-4 hover:underline">
            <span aria-hidden="true">&larr;</span> Back to Dashboard
          </Link>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Student Profile
          </span>
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground text-balance">{view.student.name}</h1>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-muted-foreground">
          Hidden-test results, explanation verdicts, and mastery are listed separately. A review signal is not a grade.
        </p>
      </header>

      <ClassroomAnalyticsCard analytics={analytics} />
      <Recommendation recommendation={view.recommendation} />
      <ConceptTable concepts={view.concepts} threshold={view.module?.threshold ?? null} />
      <AttemptTable attempts={view.attempts} showStudent={false} />

      <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs backdrop-blur-xs">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Why the selector chose this</h2>
        {view.routing.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No routing decision is stored yet. Opening Practice writes one.</p>
        ) : (
          <ol className="mt-4 space-y-3 divide-y divide-border/60 text-sm">
            {view.routing.map((decision) => (
              <li key={`${decision.at}-${decision.reason}`} className="pt-3 first:pt-0">
                <p className="font-mono text-xs font-semibold text-primary">{decision.at}</p>
                <p className="mt-1 text-pretty text-foreground">{decision.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function TrainerLearning({
  view,
  batchId,
  moduleId,
  analytics,
}: {
  view: TrainerDashboard;
  batchId?: string;
  moduleId?: string;
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  const below = view.insights.filter((insight) => insight.belowThreshold);
  const unrecorded = view.insights.filter((insight) => insight.recorded === 0);

  return (
    <div className="space-y-8">
      <header className="border-b border-border/60 pb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground mb-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Instructor Analytics
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">Batch mastery</h1>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-muted-foreground">
          {view.module
            ? `In ${view.module.name}, stored mastery is solid at ${view.module.threshold.toFixed(2)} or above. A missing cell is not zero.`
            : "This institute has no module yet."}
        </p>
      </header>

      <ClassroomAnalyticsCard analytics={analytics} />

      <form className="flex flex-wrap items-end gap-3 rounded-xl border border-border/80 bg-card/60 p-4 shadow-xs" method="get">
        <label className="text-xs font-medium text-foreground" htmlFor="batch">
          Batch
          <select
            className="mt-1 block rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            defaultValue={batchId ?? view.batch?.id ?? ""}
            id="batch"
            name="batch"
          >
            {view.batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </label>
        {moduleId ? <input name="module" type="hidden" value={moduleId} /> : null}
        <button
          className="rounded-md bg-secondary border border-border px-3.5 py-1.5 text-sm font-medium text-secondary-foreground shadow-xs hover:bg-secondary/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring transition-colors"
          type="submit"
        >
          Show batch
        </button>
      </form>

      {view.batches.length === 0 ? <p className="text-sm text-muted-foreground">You are not assigned to a batch in this institute.</p> : null}
      {view.batch && view.students.length === 0 ? <p className="text-sm text-muted-foreground">This batch has no students yet.</p> : null}

      <Heatmap view={view} />

      <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Below the module threshold</h2>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-muted-foreground">
          The mean uses only stored mastery values. Students with no record are excluded from the mean and counted separately. A concept is listed here when that mean is under the module threshold.
          {view.module ? ` The threshold is ${view.module.threshold.toFixed(2)}.` : ""}
        </p>
        {below.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {view.students.length === 0
              ? "There is no batch population to summarize."
              : "No concept with a stored mastery has a mean below the module threshold."}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-border/70">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="sr-only">
                Population is the students enrolled in {view.batch?.name ?? "this batch"}.
              </caption>
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Concept</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Mean of stored values</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Stored records</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Stored and below threshold</th>
                  <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Blocks a later concept</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {below.map((insight) => (
                  <tr key={insight.conceptId} className="hover:bg-muted/20 transition-colors">
                    <th className="py-3 px-3 text-left font-medium text-foreground" scope="row">{insight.name}</th>
                    <td className="py-3 px-3 font-mono">{insight.mean === null ? "No records" : formatMastery(insight.mean)}</td>
                    <td className="py-3 px-3 text-muted-foreground">{insight.recorded} of {insight.students}</td>
                    <td className="py-3 px-3 font-medium text-amber-700 dark:text-amber-400">{insight.below} of {insight.recorded}</td>
                    <td className="py-3 px-3 text-muted-foreground">{insight.blocking} students with a stored value under the threshold</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {unrecorded.length > 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">
            No stored mastery for {unrecorded.map((insight) => insight.name).join(", ")}. Those concepts are not treated as zero.
          </p>
        ) : null}
      </section>

      <AttemptTable attempts={view.attempts} showStudent />

      <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Review queue</h2>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-muted-foreground">
          {view.pendingReviews === 1
            ? "1 pending pattern is waiting in this batch."
            : `${view.pendingReviews} pending patterns are waiting in this batch.`}{" "}
          These are patterns for a person to interpret. They do not change a grade or a mastery value. A second device is not visible, and fast typing or assistive technology can look like one of these patterns.
        </p>
        <p className="mt-4">
          <Link className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors underline-offset-4" href="/review">
            Open the review queue <span aria-hidden="true">&rarr;</span>
          </Link>
        </p>
      </section>
    </div>
  );
}

function Recommendation({ recommendation, practice = false }: { recommendation: RecommendationView | null; practice?: boolean }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card p-6 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            ⚡
          </span>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Adaptive Learning Path</h2>
        </div>
        {recommendation?.badgeLabel ? (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {recommendation.badgeLabel}
          </span>
        ) : (
          <span className="rounded-md border border-border/60 bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Next step
          </span>
        )}
      </div>

      {recommendation === null ? (
        <p className="mt-4 text-sm text-muted-foreground">The selector has no module to recommend.</p>
      ) : (
        <div className="mt-5 space-y-4 text-sm">
          {/* Primary Action Button */}
          {recommendation.href ? (
            <div className="flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground shadow-xs hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring transition-colors"
                href={recommendation.href}
              >
                {recommendation.actionLabel ?? "Open Recommended Activity"}
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          ) : null}

          {/* Reason & Explanation Callout */}
          <div className="rounded-lg border border-border/70 bg-muted/40 p-4 text-pretty">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Adaptive Recommendation Rationale
            </p>
            <p className="font-medium text-foreground leading-relaxed">{recommendation.reason}</p>
          </div>

          {/* Stored Mastery vs Predicted Success */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 rounded-lg border border-border/70 p-4 bg-background/60">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Concept Focus</p>
              <p className="text-base font-semibold text-foreground">{recommendation.conceptName}</p>
              {recommendation.storedMastery === null ? (
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  No mastery record is stored for {recommendation.conceptName}. The number in that sentence is the selector’s starting estimate, not a stored score.
                </p>
              ) : (
                <p className="mt-1 text-xs text-foreground leading-relaxed">
                  Stored mastery for {recommendation.conceptName}: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatMastery(recommendation.storedMastery)}</span>.
                </p>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-border/60 sm:pl-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Calibration Estimate</p>
              {recommendation.predictedSuccess !== null ? (
                <div>
                  <p className="text-base font-semibold text-foreground">
                    {formatMastery(recommendation.predictedSuccess)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Predicted chance the selector used for the chosen question: {formatMastery(recommendation.predictedSuccess)}. This is not a mastery value.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No question prediction.</p>
              )}
            </div>
          </div>

          {/* Prerequisite Readiness Checklist */}
          {recommendation.prerequisites && recommendation.prerequisites.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border/70 p-4 bg-muted/20">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prerequisite Readiness</p>
              <ul className="space-y-1.5 text-xs">
                {recommendation.prerequisites.map((prereq) => (
                  <li key={prereq.id} className="flex items-center justify-between rounded border border-border/50 bg-background/50 px-2.5 py-1.5">
                    <span>
                      <span className="font-medium text-foreground">{prereq.name}</span>:{" "}
                      <span className="text-muted-foreground">
                        {prereq.storedMastery !== null
                          ? `Stored mastery ${formatMastery(prereq.storedMastery)}`
                          : "No mastery record"}
                      </span>
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 font-medium text-[11px] border ${
                        prereq.ready
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                      }`}
                    >
                      {prereq.ready ? "Ready (≥ 0.80)" : "Blocking (< 0.80)"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Evidence Summary Chips */}
          {recommendation.evidenceSummary ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
              <span className="font-semibold text-foreground">Validated evidence:</span>
              <span className="rounded-md border border-border/60 bg-muted/70 px-2.5 py-1 font-medium text-foreground">
                {recommendation.evidenceSummary.gradedAttempts} graded attempt{recommendation.evidenceSummary.gradedAttempts !== 1 ? "s" : ""}
              </span>
              <span className="rounded-md border border-border/60 bg-muted/70 px-2.5 py-1 font-medium text-foreground">
                {recommendation.evidenceSummary.assessmentsPassed} passed
              </span>
              {recommendation.evidenceSummary.lessonsCompleted > 0 ? (
                <span className="rounded-md border border-border/60 bg-muted/70 px-2.5 py-1 font-medium text-foreground">
                  {recommendation.evidenceSummary.lessonsCompleted} lesson{recommendation.evidenceSummary.lessonsCompleted !== 1 ? "s" : ""} completed
                </span>
              ) : null}
            </div>
          ) : null}

          {!recommendation.hasQuestion ? <p className="text-xs text-muted-foreground">No published question is available for that concept.</p> : null}

          {/* Alternatives */}
          {recommendation.alternatives.length > 0 ? (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alternative concepts evaluated:</p>
              <ul className="space-y-1 text-xs">
                {recommendation.alternatives.map((alternative) => (
                  <li key={alternative.name} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{alternative.name}</span>: {alternative.note}
                    {alternative.storedMastery === null ? " No mastery record." : ` Stored mastery ${formatMastery(alternative.storedMastery)}.`}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Compatibility Links for practice & lesson preview */}
          <div className="space-y-1.5 pt-3 border-t border-border/60">
            {practice && recommendation.lesson ? (
              <p>
                <Link className="underline-offset-4 hover:underline text-xs text-primary font-medium inline-flex items-center gap-1" href={`/learn/${recommendation.lesson.id}`}>
                  <span>📖</span> Read the published lesson: {recommendation.lesson.title}
                </Link>
              </p>
            ) : null}
            {practice ? (
              <p>
                <Link className="underline-offset-4 hover:underline text-xs text-primary font-medium inline-flex items-center gap-1" href="/learn">
                  <span>🎓</span> Open Learn Module (All Concepts & Quizzes)
                </Link>
              </p>
            ) : null}
            {practice ? (
              <p>
                <Link className="underline-offset-4 hover:underline text-xs text-primary font-medium inline-flex items-center gap-1" href="/practice">
                  <span>💻</span> Continue in Practice Lab
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function ConceptTable({ concepts, threshold }: { concepts: ConceptDashboardRow[]; threshold: number | null }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Concepts</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Status uses the module threshold{threshold === null ? "" : ` of ${threshold.toFixed(2)}`}. Not recorded is not the same as 0%.
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
          {concepts.length} Concept{concepts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {concepts.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">This module has no concepts yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/70" tabIndex={0}>
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="sr-only">
              Status uses the module threshold{threshold === null ? "" : ` of ${threshold.toFixed(2)}`}. Not recorded is not the same as 0%.
            </caption>
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Concept</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Status</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Confidence</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Prerequisites</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Latest stored change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {concepts.map((concept) => (
                <tr key={concept.id} className="align-top hover:bg-muted/20 transition-colors">
                  <th className="py-3 px-3 text-left font-medium text-foreground" scope="row">{concept.name}</th>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                        concept.band === "solid"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                          : concept.band === "below_threshold"
                            ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                            : "bg-muted/60 text-muted-foreground border-border/60"
                      }`}
                    >
                      {statusText(concept)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground font-mono">{concept.confidenceLabel}</td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[24ch] text-pretty">{prerequisiteText(concept)}</td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[32ch] text-pretty">{updateText(concept)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AttemptTable({ attempts, showStudent }: { attempts: AttemptDashboardRow[]; showStudent: boolean }) {
  return (
    <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Graded submissions</h2>
          <p className="mt-0.5 max-w-[65ch] text-pretty text-xs text-muted-foreground">
            The hidden-test pass rate is the assessment result. The explanation column is a separate check and does not change mastery.
          </p>
        </div>
        <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
          {attempts.length} Submission{attempts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {attempts.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No graded submission is stored. Practice runs are not listed here.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border/70" tabIndex={0}>
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                {showStudent ? <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Student</th> : null}
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">When</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Question</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Hidden tests</th>
                <th className="py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider" scope="col">Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="align-top hover:bg-muted/20 transition-colors">
                  {showStudent ? <td className="py-3 px-3 font-medium text-foreground">{attempt.studentName}</td> : null}
                  <td className="py-3 px-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{attempt.at}</td>
                  <td className="py-3 px-3">
                    {attempt.replayHref ? (
                      <Link className="font-medium text-primary hover:underline underline-offset-4" href={attempt.replayHref}>
                        {attempt.statement}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{attempt.statement}</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-mono text-xs font-semibold text-foreground">{hiddenText(attempt)}</span>
                  </td>
                  <td className="py-3 px-3 text-xs text-muted-foreground max-w-[30ch] text-pretty">{attempt.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Heatmap({ view }: { view: TrainerDashboard }) {
  if (!view.batch || view.concepts.length === 0 || view.students.length === 0) return null;
  const byKey = new Map(view.cells.map((cell) => [`${cell.studentId}\0${cell.conceptId}`, cell]));

  return (
    <section className="rounded-xl border border-border/80 bg-card/60 p-6 shadow-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{view.batch.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Rows are students in this batch. Columns follow the concept prerequisites. Scroll sideways if the row is wider than the page.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40" /> Solid
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/10 border border-amber-500/30" /> Below Threshold
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-muted border border-border/60" /> Not Recorded
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border/70" tabIndex={0}>
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="sr-only">
            Rows are students in this batch. Columns follow the concept prerequisites. Scroll sideways if the row is wider than the page.
          </caption>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="sticky left-0 bg-background/95 backdrop-blur-xs py-2.5 px-3 font-semibold text-foreground text-xs uppercase tracking-wider border-r border-border/60 shadow-xs" scope="col">Student</th>
              {view.concepts.map((concept) => (
                <th key={concept.id} className="px-3 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wider text-center" scope="col">{concept.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {view.students.map((student) => (
              <tr key={student.id} className="hover:bg-muted/10 transition-colors">
                <th className="sticky left-0 bg-background/95 backdrop-blur-xs py-2.5 px-3 text-left font-medium text-foreground border-r border-border/60 shadow-xs" scope="row">
                  <Link className="text-primary hover:underline underline-offset-4" href={`/dashboard/students/${student.id}`}>
                    {student.name}
                  </Link>
                </th>
                {view.concepts.map((concept) => {
                  const cell = byKey.get(`${student.id}\0${concept.id}`);
                  return (
                    <td key={concept.id} className={`px-3 py-2.5 text-center text-xs ${cellClass(cell?.band ?? "not_recorded")}`}>
                      {cell?.label ?? "Not recorded"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function cellClass(band: "not_recorded" | "below_threshold" | "solid"): string {
  if (band === "solid") return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold";
  if (band === "below_threshold") return "bg-amber-500/10 text-amber-800 dark:text-amber-300 font-medium";
  return "text-muted-foreground/50";
}

function statusText(concept: ConceptDashboardRow): string {
  if (concept.pKnow === null) return "Not recorded";
  const value = formatMastery(concept.pKnow);
  if (concept.band === "solid") return `Solid, ${value}`;
  return `Below threshold, ${value}`;
}

function prerequisiteText(concept: ConceptDashboardRow): string {
  if (concept.prerequisites.length === 0) return "None";
  return concept.prerequisites
    .map((item) => {
      if (item.state === "met") return `${item.name} is at the threshold`;
      if (item.state === "below") return `${item.name} is below the threshold`;
      return `${item.name} is not recorded`;
    })
    .join(". ");
}

function updateText(concept: ConceptDashboardRow): string {
  const tagged = concept.recentTagged
    ? ` Of the last ${concept.recentTagged.counted} graded submissions tagged to this concept, ${concept.recentTagged.passedAll} passed every hidden test.`
    : "";
  if (!concept.latestUpdate) {
    return concept.pKnow === null
      ? `No mastery record.${tagged}`
      : `A mastery record is stored. No graded update explains it.${tagged}`;
  }
  const cause = concept.latestUpdate.causeType === "attempt" ? "A graded attempt" : `A ${concept.latestUpdate.causeType} update`;
  return `${cause} moved this from ${concept.latestUpdate.before.toFixed(2)} to ${concept.latestUpdate.after.toFixed(2)} at ${concept.latestUpdate.at}.${tagged}`;
}

function hiddenText(attempt: AttemptDashboardRow): string {
  if (attempt.passed !== null && attempt.total !== null) {
    return `${attempt.passed}/${attempt.total} passed${attempt.passRate === null ? "" : ` (${formatMastery(attempt.passRate)})`}`;
  }
  if (attempt.passRate === null) return "No score stored";
  return formatMastery(attempt.passRate);
}

function ClassroomAnalyticsCard({
  analytics,
}: {
  analytics?: ClassroomAnalyticsSummary | null;
}) {
  if (!analytics) return null;

  return (
    <section className="space-y-4 rounded-xl border border-border/80 bg-card/60 p-5 shadow-xs backdrop-blur-xs">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Classroom Learning Analytics
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Engagement with interactive classroom lessons, simulations, and formative checks.
          </p>
        </div>
        <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          Formative Telemetry
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Lessons Started / Done</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.lessons.started} / {analytics.lessons.completed}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {Math.round(analytics.lessons.completionRate * 100)}% completed
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Scenes Viewed</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.scenes.totalViews}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {analytics.scenes.navigationEvents} navigation steps
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Interactive Labs</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.labs.totalAttempts}
          </p>
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            {analytics.labs.totalRecoveries} recovered ({Math.round(analytics.labs.recoveryRate * 100)}%)
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Knowledge Checks</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.knowledgeChecks.totalAttempts}
          </p>
          <p className="text-[10px] text-foreground font-medium">
            {Math.round(analytics.knowledgeChecks.accuracyRate * 100)}% accuracy ({analytics.knowledgeChecks.retriesCount} retries)
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Mentor Usage</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.mentor.totalOpens}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {analytics.mentor.totalActions} actions · {analytics.mentor.totalReplies} replies
          </p>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/60 p-3 shadow-xs">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session Context</p>
          <p className="mt-1 text-lg font-bold text-foreground font-mono">
            {analytics.sessionContext.validSessionEvents}
          </p>
          <p className="text-[10px] text-muted-foreground truncate" title={`${analytics.sessionContext.missingOrInvalidSessionEvents} outside assessment session`}>
            {analytics.sessionContext.missingOrInvalidSessionEvents} non-assessment events
          </p>
        </div>
      </div>

      {analytics.lessons.recentLessons.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Classroom Lessons
          </h3>
          <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/60 text-xs">
            {analytics.lessons.recentLessons.map((lesson) => (
              <li key={lesson.lessonId} className="flex items-center justify-between p-3 hover:bg-muted/10 transition-colors">
                <Link
                  href={`/learn/${lesson.lessonId}`}
                  className="font-medium text-foreground hover:underline"
                >
                  {lesson.lessonTitle}
                </Link>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{lesson.scenesViewed} scenes viewed</span>
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${lesson.completed ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-border/60 bg-muted text-muted-foreground"}`}>
                    {lesson.completed ? "Completed" : "In Progress"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Note: Classroom activities and simulations are formative learning experiences. They do not alter your BKT mastery probability, selector recommendations, or assessment grading.
      </p>
    </section>
  );
}


