import Link from "next/link";
import type { ConceptDashboardRow, AttemptDashboardRow, RecommendationView, StudentDashboard, TrainerDashboard } from "@/lib/services/dashboard";
import { formatMastery } from "@/lib/engine/dashboard-bands";

export function StudentLearning({ view }: { view: StudentDashboard }) {
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Your mastery</h1>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm text-foreground">
          {view.module
            ? `${view.module.name} uses a mastery threshold of ${view.module.threshold.toFixed(2)}. A percentage appears only where a mastery record is stored.`
            : "No module is published for your institute, so there is no recommendation yet."}
        </p>
      </header>
      <Recommendation practice recommendation={view.recommendation} />
      <ConceptTable concepts={view.concepts} threshold={view.module?.threshold ?? null} />
      <AttemptTable attempts={view.attempts} showStudent={false} />
    </div>
  );
}

export function StudentDetail({ view }: { view: StudentDashboard }) {
  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm">
          <Link href="/dashboard" className="underline-offset-4 hover:underline">
            Dashboard
          </Link>
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance">{view.student.name}</h1>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm">
          Hidden-test results, explanation verdicts, and mastery are listed separately. A review signal is not a grade.
        </p>
      </header>
      <Recommendation recommendation={view.recommendation} />
      <ConceptTable concepts={view.concepts} threshold={view.module?.threshold ?? null} />
      <AttemptTable attempts={view.attempts} showStudent={false} />
      <section>
        <h2 className="text-xl font-semibold tracking-tight">Why the selector chose this</h2>
        {view.routing.length === 0 ? (
          <p className="mt-2 text-sm">No routing decision is stored yet. Opening Practice writes one.</p>
        ) : (
          <ol className="mt-3 space-y-3 text-sm">
            {view.routing.map((decision) => (
              <li key={`${decision.at}-${decision.reason}`}>
                <p className="font-medium">{decision.at}</p>
                <p className="text-pretty">{decision.reason}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function TrainerLearning({ view, batchId, moduleId }: { view: TrainerDashboard; batchId?: string; moduleId?: string }) {
  const below = view.insights.filter((insight) => insight.belowThreshold);
  const unrecorded = view.insights.filter((insight) => insight.recorded === 0);
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-balance">Batch mastery</h1>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm">
          {view.module
            ? `In ${view.module.name}, stored mastery is solid at ${view.module.threshold.toFixed(2)} or above. A missing cell is not zero.`
            : "This institute has no module yet."}
        </p>
      </header>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm" htmlFor="batch">
          Batch
          <select
            className="mt-1 block rounded-md border border-border bg-background px-2 py-1"
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
        <button className="rounded-md border border-border px-3 py-1 text-sm" type="submit">
          Show batch
        </button>
      </form>
      {view.batches.length === 0 ? <p className="text-sm">You are not assigned to a batch in this institute.</p> : null}
      {view.batch && view.students.length === 0 ? <p className="text-sm">This batch has no students yet.</p> : null}
      <Heatmap view={view} />
      <section>
        <h2 className="text-xl font-semibold tracking-tight">Below the module threshold</h2>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm">
          The mean uses only stored mastery values. Students with no record are excluded from the mean and counted separately. A concept is listed here when that mean is under the module threshold.
          {view.module ? ` The threshold is ${view.module.threshold.toFixed(2)}.` : ""}
        </p>
        {below.length === 0 ? (
          <p className="mt-3 text-sm">
            {view.students.length === 0
              ? "There is no batch population to summarize."
              : "No concept with a stored mastery has a mean below the module threshold."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
              <caption className="mb-2 text-left">
                Population is the students enrolled in {view.batch?.name ?? "this batch"}.
              </caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-3 font-medium" scope="col">Concept</th>
                  <th className="py-2 pr-3 font-medium" scope="col">Mean of stored values</th>
                  <th className="py-2 pr-3 font-medium" scope="col">Stored records</th>
                  <th className="py-2 pr-3 font-medium" scope="col">Stored and below threshold</th>
                  <th className="py-2 font-medium" scope="col">Blocks a later concept</th>
                </tr>
              </thead>
              <tbody>
                {below.map((insight) => (
                  <tr key={insight.conceptId} className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium" scope="row">{insight.name}</th>
                    <td className="py-2 pr-3">{insight.mean === null ? "No records" : formatMastery(insight.mean)}</td>
                    <td className="py-2 pr-3">{insight.recorded} of {insight.students}</td>
                    <td className="py-2 pr-3">{insight.below} of {insight.recorded}</td>
                    <td className="py-2">{insight.blocking} students with a stored value under the threshold</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {unrecorded.length > 0 ? (
          <p className="mt-3 text-sm">
            No stored mastery for {unrecorded.map((insight) => insight.name).join(", ")}. Those concepts are not treated as zero.
          </p>
        ) : null}
      </section>
      <AttemptTable attempts={view.attempts} showStudent />
      <section>
        <h2 className="text-xl font-semibold tracking-tight">Review queue</h2>
        <p className="mt-2 max-w-[65ch] text-pretty text-sm">
          {view.pendingReviews === 1
            ? "1 pending pattern is waiting in this batch."
            : `${view.pendingReviews} pending patterns are waiting in this batch.`}{" "}
          These are patterns for a person to interpret. They do not change a grade or a mastery value. A second device is not visible, and fast typing or assistive technology can look like one of these patterns.
        </p>
        <p className="mt-3">
          <Link className="text-sm underline-offset-4 hover:underline" href="/review">
            Open the review queue
          </Link>
        </p>
      </section>
    </div>
  );
}

function Recommendation({ recommendation, practice = false }: { recommendation: RecommendationView | null; practice?: boolean }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Next step</h2>
      {recommendation === null ? (
        <p className="mt-2 text-sm">The selector has no module to recommend.</p>
      ) : (
        <div className="mt-3 max-w-[65ch] space-y-3 text-sm">
          <p className="text-pretty">{recommendation.reason}</p>
          {recommendation.storedMastery === null ? (
            <p className="text-pretty">
              No mastery record is stored for {recommendation.conceptName}. The number in that sentence is the selector’s starting estimate, not a stored score.
            </p>
          ) : (
            <p>Stored mastery for {recommendation.conceptName}: {formatMastery(recommendation.storedMastery)}.</p>
          )}
          {recommendation.predictedSuccess !== null ? (
            <p>
              Predicted chance the selector used for the chosen question: {formatMastery(recommendation.predictedSuccess)}. This is not a mastery value.
            </p>
          ) : null}
          {!recommendation.hasQuestion ? <p>No published question is available for that concept.</p> : null}
          {recommendation.alternatives.length > 0 ? (
            <ul className="space-y-1">
              {recommendation.alternatives.map((alternative) => (
                <li key={alternative.name}>
                  {alternative.name}: {alternative.note}
                  {alternative.storedMastery === null ? " No mastery record." : ` Stored mastery ${formatMastery(alternative.storedMastery)}.`}
                </li>
              ))}
            </ul>
          ) : null}
          {practice && recommendation.lesson ? (
            <p>
              <Link className="underline-offset-4 hover:underline" href={`/learn/${recommendation.lesson.id}`}>
                Read the published lesson: {recommendation.lesson.title}
              </Link>
            </p>
          ) : null}
          {practice ? (
            <p>
              <Link className="underline-offset-4 hover:underline" href="/practice">
                Continue in Practice
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ConceptTable({ concepts, threshold }: { concepts: ConceptDashboardRow[]; threshold: number | null }) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Concepts</h2>
      {concepts.length === 0 ? (
        <p className="mt-2 text-sm">This module has no concepts yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[48rem] border-collapse text-sm">
            <caption className="mb-2 text-left">
              Status uses the module threshold{threshold === null ? "" : ` of ${threshold.toFixed(2)}`}. Not recorded is not the same as 0%.
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium" scope="col">Concept</th>
                <th className="py-2 pr-3 font-medium" scope="col">Status</th>
                <th className="py-2 pr-3 font-medium" scope="col">Confidence</th>
                <th className="py-2 pr-3 font-medium" scope="col">Prerequisites</th>
                <th className="py-2 font-medium" scope="col">Latest stored change</th>
              </tr>
            </thead>
            <tbody>
              {concepts.map((concept) => (
                <tr key={concept.id} className="border-b border-border align-top">
                  <th className="py-3 pr-3 text-left font-medium" scope="row">{concept.name}</th>
                  <td className="py-3 pr-3">{statusText(concept)}</td>
                  <td className="py-3 pr-3">{concept.confidenceLabel}</td>
                  <td className="py-3 pr-3">{prerequisiteText(concept)}</td>
                  <td className="py-3">{updateText(concept)}</td>
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
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Graded submissions</h2>
      <p className="mt-2 max-w-[65ch] text-pretty text-sm">
        The hidden-test pass rate is the assessment result. The explanation column is a separate check and does not change mastery.
      </p>
      {attempts.length === 0 ? (
        <p className="mt-3 text-sm">No graded submission is stored. Practice runs are not listed here.</p>
      ) : (
        <div className="mt-3 overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[44rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {showStudent ? <th className="py-2 pr-3 font-medium" scope="col">Student</th> : null}
                <th className="py-2 pr-3 font-medium" scope="col">When</th>
                <th className="py-2 pr-3 font-medium" scope="col">Question</th>
                <th className="py-2 pr-3 font-medium" scope="col">Hidden tests</th>
                <th className="py-2 font-medium" scope="col">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id} className="border-b border-border align-top">
                  {showStudent ? <td className="py-3 pr-3">{attempt.studentName}</td> : null}
                  <td className="py-3 pr-3 whitespace-nowrap">{attempt.at}</td>
                  <td className="py-3 pr-3">
                    {attempt.replayHref ? (
                      <Link className="underline-offset-4 hover:underline" href={attempt.replayHref}>
                        {attempt.statement}
                      </Link>
                    ) : (
                      attempt.statement
                    )}
                  </td>
                  <td className="py-3 pr-3">{hiddenText(attempt)}</td>
                  <td className="py-3">{attempt.explanation}</td>
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
    <section>
      <h2 className="text-xl font-semibold tracking-tight">{view.batch.name}</h2>
      <div className="mt-3 overflow-x-auto" tabIndex={0}>
        <table className="w-full min-w-[48rem] border-collapse text-sm">
          <caption className="mb-2 text-left">
            Rows are students in this batch. Columns follow the concept prerequisites. Scroll sideways if the row is wider than the page.
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th className="sticky left-0 bg-background py-2 pr-3 font-medium" scope="col">Student</th>
              {view.concepts.map((concept) => (
                <th key={concept.id} className="px-2 py-2 font-medium" scope="col">{concept.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.students.map((student) => (
              <tr key={student.id} className="border-b border-border">
                <th className="sticky left-0 bg-background py-2 pr-3 text-left font-medium" scope="row">
                  <Link className="underline-offset-4 hover:underline" href={`/dashboard/students/${student.id}`}>
                    {student.name}
                  </Link>
                </th>
                {view.concepts.map((concept) => {
                  const cell = byKey.get(`${student.id}\0${concept.id}`);
                  return (
                    <td key={concept.id} className={`px-2 py-2 ${cellClass(cell?.band ?? "not_recorded")}`}>
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
  if (band === "solid") return "bg-foreground text-background";
  if (band === "below_threshold") return "bg-muted";
  return "";
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
