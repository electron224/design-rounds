// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readAttemptForSlug,
  readAttemptIndexRaw,
  subscribeAttemptIndex,
  touchAttempt
} from "./attemptIndex";

beforeEach(() => {
  window.localStorage.clear();
});

describe("attemptIndex store", () => {
  it("returns null when empty and round-trips writes", () => {
    expect(readAttemptForSlug("atm")).toBeNull();
    touchAttempt("a1", "atm");
    expect(readAttemptForSlug("atm")).toEqual({ id: "a1", status: "in_progress" });
  });

  it("keeps the latest entry per slug with its status", () => {
    touchAttempt("a1", "atm");
    touchAttempt("a2", "atm", "finished");
    expect(readAttemptForSlug("atm")).toEqual({ id: "a2", status: "finished" });
    touchAttempt("b1", "splitwise");
    expect(readAttemptForSlug("splitwise")).toEqual({ id: "b1", status: "in_progress" });
  });

  it("snapshots are referentially stable when storage is untouched", () => {
    expect(readAttemptIndexRaw()).toBe(readAttemptIndexRaw());
    touchAttempt("a1", "atm");
    const after = readAttemptIndexRaw();
    expect(after).not.toBe("[]");
    expect(readAttemptIndexRaw()).toBe(after);
  });

  it("notifies same-tab subscribers on write", () => {
    const seen: (string | null)[] = [];
    const unsub = subscribeAttemptIndex(() => {
      seen.push(readAttemptForSlug("atm")?.id ?? null);
    });
    touchAttempt("a9", "atm");
    unsub();
    touchAttempt("a10", "atm");
    expect(seen).toEqual(["a9"]);
  });

  it("notifies on cross-tab storage events", () => {
    const cb = vi.fn();
    const unsub = subscribeAttemptIndex(cb);
    window.dispatchEvent(new StorageEvent("storage"));
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
  });

  it("survives corrupt stored data and cleared storage", () => {
    window.localStorage.setItem("lld_attempt_index", "not-json{{{");
    expect(readAttemptForSlug("atm")).toBeNull();
    window.localStorage.clear();
    expect(readAttemptForSlug("atm")).toBeNull();
    touchAttempt("a1", "atm");
    expect(readAttemptForSlug("atm")?.id).toBe("a1");
  });
});
