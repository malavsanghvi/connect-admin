import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Card, Details, Field, FormGrid, LoadProblem, NoAccess, Notice, PageHeader, Stat } from "@/components/ui";
import { can } from "@/lib/access";
import { resolveUserNames } from "@/lib/data/people";
import { formatDate, formatDateTime, todayIso } from "@/lib/format";
import { canStartVoting, lifecycle, parseDateRange, periodOpen, tallyVotes, type VoteHistoryEntry } from "@/lib/logic/resolutions";
import { getSupabase, load, requireViewer, row, rows } from "@/lib/session";
import { addComment, castVote, editComment, saveOutcome, saveResolution, setPeriod, setWithdrawn } from "../../actions";
import { LIFECYCLE_TONE } from "../../lifecycle-tone";

export const metadata: Metadata = { title: "Resolution" };

function PeriodControls({ id, kind, status, allowStart }: { id: string; kind: "comment" | "voting"; status: string; allowStart: boolean }) {
  const act = setPeriod.bind(null, id, kind);
  if (status === "not_started") {
    if (!allowStart) return <p className="text-sm text-muted">Voting can open once the comment period is closed.</p>;
    return (
      <ActionForm action={act} submitLabel={kind === "comment" ? "Open comments" : "Open voting"} submitClassName="btn btn-purple">
        <input type="hidden" name="to" value="started" />
        <FormGrid>
          <Field label="Opens on">
            <input type="date" name="start" defaultValue={new Date().toISOString().slice(0, 10)} className="field-input" />
          </Field>
          <Field label="Closes on">
            <input type="date" name="end" required className="field-input" />
          </Field>
        </FormGrid>
      </ActionForm>
    );
  }
  if (status === "completed") return null;
  return (
    <div className="flex flex-wrap gap-2">
      {status === "started" && <ActionButton action={act} fields={{ to: "paused" }} label="Pause" />}
      {status === "paused" && <ActionButton action={act} fields={{ to: "started" }} label="Resume" />}
      <ActionButton action={act} fields={{ to: "completed" }} label="Close now" className="btn btn-danger" confirm={`Close the ${kind === "comment" ? "comment" : "voting"} period now?`} />
    </div>
  );
}

export default async function ResolutionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await requireViewer();
  if (!can(v.access, "governance.view", "governance.manage")) return <NoAccess area="committee resolutions" />;
  const supabase = await getSupabase();
  const tz = v.center.time_zone;
  const today = todayIso(tz);

  const res = await load(async () => {
    const r = row(await supabase.from("resolutions").select("*").eq("id", id).maybeSingle(), "the resolution");
    if (!r) return null;
    const [comments, votes] = await Promise.all([
      supabase.from("resolution_comments").select("*").eq("resolution_id", id).order("created_at"),
      supabase.from("resolution_votes").select("*").eq("resolution_id", id).order("voted_at"),
    ]);
    const c = rows(comments, "comments");
    const vt = rows(votes, "votes");
    const names = await resolveUserNames(supabase, v.center.id, [...c.map((x) => x.author_user), ...vt.map((x) => x.voter_user), r.created_by]);
    return { r, comments: c, votes: vt, names };
  });
  if (!res.ok) return <LoadProblem message={res.error} />;
  if (!res.data) notFound();
  const { r, comments, votes, names } = res.data;
  const who = (uid: string | null) => (uid === v.userId ? "You" : uid ? (names.get(uid) ?? "Committee member") : "—");
  const lc = lifecycle(r, votes);
  const tally = tallyVotes(votes);
  const quorum = r.quorum || 4;
  const manage = can(v.access, "governance.manage");
  const commentsOpen = !r.withdrawn_at && periodOpen(r.comment_status, r.comment_period, today);
  const votingOpen = !r.withdrawn_at && periodOpen(r.voting_status, r.voting_period, today);
  const myVote = votes.find((x) => x.voter_user === v.userId);
  const cp = parseDateRange(r.comment_period);
  const vp = parseDateRange(r.voting_period);

  return (
    <>
      <PageHeader
        title={r.title}
        accent="pathshala"
        back={{ href: "/pathshala/committee/resolutions", label: "Resolutions" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={LIFECYCLE_TONE[lc]}>{lc}</Badge> Proposed by {who(r.created_by)} on {formatDate(r.created_at)}
          </span>
        }
      />
      {r.withdrawn_at && (
        <div className="mb-4">
          <Notice tone="warning">Withdrawn {formatDateTime(r.withdrawn_at, tz)}. Comments and votes are kept for the record.</Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <Card title="Resolution">
            <p className="whitespace-pre-line text-sm">{r.description ?? "—"}</p>
            {r.rationale && (
              <>
                <h3 className="mt-4 text-sm font-semibold">Why</h3>
                <p className="whitespace-pre-line text-sm">{r.rationale}</p>
              </>
            )}
            {manage && r.voting_status !== "completed" && !r.withdrawn_at && (
              <div className="mt-4">
                <Details summary="Edit text">
                  <ActionForm action={saveResolution.bind(null, r.id)} submitLabel="Save">
                    <div className="space-y-3">
                      <Field label="Title">
                        <input name="title" required defaultValue={r.title} className="field-input" />
                      </Field>
                      <Field label="Resolution text">
                        <textarea name="description" rows={5} defaultValue={r.description ?? ""} className="field-input" />
                      </Field>
                      <Field label="Why">
                        <textarea name="rationale" rows={3} defaultValue={r.rationale ?? ""} className="field-input" />
                      </Field>
                      <Field label="Quorum">
                        <input name="quorum" type="number" min={1} defaultValue={quorum} className="field-input" />
                      </Field>
                    </div>
                  </ActionForm>
                </Details>
              </div>
            )}
          </Card>

          <Card
            title="Comments"
            description={
              r.comment_status === "not_started"
                ? "Comment period not opened yet."
                : `${cp.start ? formatDate(cp.start) : "?"} – ${cp.end ? formatDate(cp.end) : "?"} · ${r.comment_status.replace("_", " ")}`
            }
          >
            {comments.length === 0 ? (
              <p className="text-sm text-muted">No comments.</p>
            ) : (
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-sand p-3 text-sm">
                    <p className="whitespace-pre-line">{c.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      {who(c.author_user)} · {formatDateTime(c.created_at, tz)}
                      {c.edited_at ? " · edited" : ""}
                    </p>
                    {commentsOpen && c.author_user === v.userId && (
                      <div className="mt-2">
                        <Details summary="Edit or delete">
                          <ActionForm
                            action={editComment.bind(null, c.id)}
                            submitLabel="Save"
                            extraButtons={
                              <button type="submit" name="intent" value="delete" className="btn btn-danger">
                                Delete
                              </button>
                            }
                          >
                            <textarea name="body" rows={3} defaultValue={c.body} className="field-input" aria-label="Your comment" />
                          </ActionForm>
                        </Details>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {commentsOpen && (
              <div className="mt-4">
                <ActionForm action={addComment.bind(null, r.id)} submitLabel="Add comment" resetOnSuccess>
                  <textarea name="body" rows={3} required className="field-input" aria-label="Your comment" />
                </ActionForm>
              </div>
            )}
            {manage && !r.withdrawn_at && (
              <div className="mt-4 border-t border-line pt-4">
                <PeriodControls id={r.id} kind="comment" status={r.comment_status} allowStart={r.voting_status === "not_started"} />
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Vote"
            description={
              r.voting_status === "not_started"
                ? "Voting not opened yet."
                : `${vp.start ? formatDate(vp.start) : "?"} – ${vp.end ? formatDate(vp.end) : "?"} · ${r.voting_status.replace("_", " ")}`
            }
          >
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Yes" value={tally.yes} tone="success" />
              <Stat label="No" value={tally.no} tone="danger" />
              <Stat label="Abstain" value={tally.abstain} tone="navy" />
            </div>
            <p className="mt-3 text-sm" aria-live="polite">
              <strong>{tally.total}</strong> of {quorum} ballots needed for quorum{" "}
              {tally.total >= quorum ? <Badge tone="success">Quorum met</Badge> : <Badge tone="warning">{quorum - tally.total} more needed</Badge>}
            </p>
            {r.voting_status === "completed" && (
              <div className="mt-3">
                <Notice tone={lc === "Closed – passed" ? "success" : lc === "Closed – failed" ? "danger" : "warning"}>
                  {lc === "Closed – passed"
                    ? `Passed: ${tally.yes} yes, ${tally.no} no.`
                    : lc === "Closed – failed"
                      ? `Failed: ${tally.yes} yes, ${tally.no} no (Yes must outnumber No).`
                      : `No quorum: only ${tally.total} of ${quorum} ballots were cast.`}
                </Notice>
              </div>
            )}
            {votingOpen && can(v.access, "governance.vote") && (
              <div className="mt-4">
                <ActionForm action={castVote.bind(null, r.id)} submitLabel={myVote ? "Change my vote" : "Cast my vote"} submitClassName="btn btn-maroon">
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">{myVote ? `Your vote: ${myVote.vote}` : "Your vote"}</legend>
                    <div className="grid grid-cols-3 gap-2">
                      {(["yes", "no", "abstain"] as const).map((opt) => (
                        <label key={opt} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-line bg-white font-semibold has-[:checked]:border-navy has-[:checked]:bg-navy-soft">
                          <input type="radio" name="vote" value={opt} required defaultChecked={myVote?.vote === opt} className="h-5 w-5 accent-navy" />
                          {opt[0].toUpperCase() + opt.slice(1)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Field label="Reason (optional)" className="mt-3">
                    <input name="reason" defaultValue={myVote?.reason ?? ""} className="field-input" />
                  </Field>
                </ActionForm>
              </div>
            )}
            {votingOpen && !can(v.access, "governance.vote") && <p className="mt-3 text-sm text-muted">Only current committee members can vote.</p>}
            {manage && !r.withdrawn_at && (
              <div className="mt-4 border-t border-line pt-4">
                <PeriodControls id={r.id} kind="voting" status={r.voting_status} allowStart={canStartVoting(r, today)} />
              </div>
            )}
            {votes.length > 0 && (
              <div className="mt-4">
                <Details summary={`Vote log (${votes.length})`}>
                  <ul className="space-y-2 text-sm">
                    {votes.map((x) => {
                      const history = Array.isArray(x.vote_history) ? (x.vote_history as VoteHistoryEntry[]) : [];
                      return (
                        <li key={x.id}>
                          <strong>{who(x.voter_user)}</strong>: {x.vote} · {formatDateTime(x.voted_at, tz)}
                          {x.reason ? ` — ${x.reason}` : ""}
                          {history.length > 0 && (
                            <ul className="ml-4 text-xs text-muted">
                              {history.map((h, i) => (
                                <li key={i}>
                                  earlier: {h.vote} · {formatDateTime(h.voted_at, tz)}
                                  {h.reason ? ` — ${h.reason}` : ""}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Details>
              </div>
            )}
          </Card>

          {r.voting_status === "completed" && (
            <Card title="Outcome note">
              {manage ? (
                <ActionForm action={saveOutcome.bind(null, r.id)} submitLabel="Save outcome note">
                  <textarea name="outcome_note" rows={4} defaultValue={r.outcome_note ?? ""} className="field-input" aria-label="Outcome note" />
                </ActionForm>
              ) : (
                <p className="whitespace-pre-line text-sm">{r.outcome_note ?? "—"}</p>
              )}
            </Card>
          )}

          {manage && (
            <Card title={r.withdrawn_at ? "Restore" : "Withdraw"}>
              {r.withdrawn_at ? (
                <ActionButton action={setWithdrawn.bind(null, r.id)} fields={{ withdraw: "0" }} label="Restore resolution" />
              ) : r.voting_status !== "completed" ? (
                <ActionButton
                  action={setWithdrawn.bind(null, r.id)}
                  fields={{ withdraw: "1" }}
                  label="Withdraw resolution"
                  className="btn btn-danger"
                  confirm="Withdraw this resolution? Its comments and votes stay on record."
                />
              ) : (
                <p className="text-sm text-muted">Voting has closed; it can no longer be withdrawn.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
