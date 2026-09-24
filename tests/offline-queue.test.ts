import { describe, expect, it } from "vitest";
import { createScanQueue, isConnectivityError, memoryStorage, queueKey, type QueuedScan } from "@/lib/logic/offline-queue";

function makeQueue() {
  let n = 0;
  return createScanQueue(memoryStorage(), queueKey("ev1"), () => `q${++n}`);
}

describe("offline scan queue", () => {
  it("queues scans and persists them in storage", () => {
    const storage = memoryStorage();
    const q = createScanQueue(storage, "k", () => "id1");
    q.enqueue({ eventId: "ev1", token: " abc ", station: "entry" }, new Date("2026-09-20T15:00:00Z"));
    const again = createScanQueue(storage, "k");
    expect(again.size()).toBe(1);
    expect(again.list()[0]).toMatchObject({ id: "id1", token: "abc", station: "entry", attendeeIds: null, attempts: 0 });
  });

  it("does not queue the same scan twice (same token, station, people)", () => {
    const q = makeQueue();
    q.enqueue({ eventId: "ev1", token: "t1", station: "entry", attendeeIds: ["b", "a"] });
    q.enqueue({ eventId: "ev1", token: "t1", station: "entry", attendeeIds: ["a", "b"] });
    q.enqueue({ eventId: "ev1", token: "t1", station: "food", attendeeIds: ["a", "b"] });
    expect(q.size()).toBe(2);
  });

  it("replays in order and removes sent and rejected scans", async () => {
    const q = makeQueue();
    q.enqueue({ eventId: "ev1", token: "good", station: "entry" });
    q.enqueue({ eventId: "ev1", token: "bad", station: "entry" });
    q.enqueue({ eventId: "ev1", token: "good2", station: "food" });
    const seen: string[] = [];
    const report = await q.replay(async (s: QueuedScan) => {
      seen.push(s.token);
      return s.token === "bad" ? { kind: "rejected", error: "invalid" } : { kind: "sent" };
    });
    expect(seen).toEqual(["good", "bad", "good2"]);
    expect(report.sent).toBe(2);
    expect(report.rejected.map((r) => r.scan.token)).toEqual(["bad"]);
    expect(report.remaining).toBe(0);
  });

  it("stops at the first connectivity failure and keeps the rest in order", async () => {
    const q = makeQueue();
    q.enqueue({ eventId: "ev1", token: "a", station: "entry" });
    q.enqueue({ eventId: "ev1", token: "b", station: "entry" });
    q.enqueue({ eventId: "ev1", token: "c", station: "entry" });
    const report = await q.replay(async (s) => (s.token === "b" ? { kind: "retry", error: "offline" } : { kind: "sent" }));
    expect(report.sent).toBe(1);
    expect(report.remaining).toBe(2);
    const left = q.list();
    expect(left.map((s) => s.token)).toEqual(["b", "c"]);
    expect(left[0].attempts).toBe(1);
    expect(left[0].lastError).toBe("offline");
  });

  it("treats a thrown error as retry", async () => {
    const q = makeQueue();
    q.enqueue({ eventId: "ev1", token: "a", station: "entry" });
    const report = await q.replay(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(report.remaining).toBe(1);
  });

  it("survives corrupt storage", () => {
    const storage = memoryStorage();
    storage.setItem("k", "{not json");
    expect(createScanQueue(storage, "k").size()).toBe(0);
  });

  it("recognises connectivity errors", () => {
    expect(isConnectivityError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isConnectivityError({ message: "TypeError: fetch failed" })).toBe(true);
    expect(isConnectivityError({ message: "not allowed to check in for this event" })).toBe(false);
  });
});
