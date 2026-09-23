"use client";

import { useState } from "react";

export type SurveyQuestion = { id: string; type: "text" | "single" | "multi" | "rating"; label: string; options: string[]; required: boolean };

let counter = 0;
const newId = () => `q${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Survey question editor; submits the list as JSON in a hidden `questions` field. */
export function QuestionsBuilder({ initial }: { initial: SurveyQuestion[] }) {
  const [qs, setQs] = useState<SurveyQuestion[]>(initial.length ? initial : [{ id: "q1", type: "rating", label: "Overall, how was it?", options: [], required: true }]);
  const update = (i: number, patch: Partial<SurveyQuestion>) => setQs((cur) => cur.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) =>
    setQs((cur) => {
      const next = [...cur];
      const j = i + d;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div className="space-y-3">
      <input type="hidden" name="questions" value={JSON.stringify(qs)} />
      {qs.map((q, i) => (
        <div key={q.id} className="rounded-lg border border-line p-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Question {i + 1}</span>
              <input value={q.label} onChange={(e) => update(i, { label: e.target.value })} className="field-input" required />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold">Answer type</span>
              <select value={q.type} onChange={(e) => update(i, { type: e.target.value as SurveyQuestion["type"] })} className="field-input">
                <option value="rating">Rating 1–5</option>
                <option value="single">Pick one</option>
                <option value="multi">Pick any</option>
                <option value="text">Written answer</option>
              </select>
            </label>
          </div>
          {(q.type === "single" || q.type === "multi") && (
            <label className="mt-2 block">
              <span className="mb-1 block text-xs font-semibold">Choices (comma-separated)</span>
              <input
                value={q.options.join(", ")}
                onChange={(e) => update(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="field-input"
              />
            </label>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} className="h-5 w-5 accent-navy" />
              Required
            </label>
            <button type="button" className="btn btn-secondary min-h-9 px-3 py-1" onClick={() => move(i, -1)} disabled={i === 0}>
              Up
            </button>
            <button type="button" className="btn btn-secondary min-h-9 px-3 py-1" onClick={() => move(i, 1)} disabled={i === qs.length - 1}>
              Down
            </button>
            <button type="button" className="btn btn-danger min-h-9 px-3 py-1" onClick={() => setQs((cur) => cur.filter((_, j) => j !== i))} disabled={qs.length === 1}>
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={() => setQs((cur) => [...cur, { id: newId(), type: "text", label: "", options: [], required: false }])}>
        Add a question
      </button>
    </div>
  );
}
