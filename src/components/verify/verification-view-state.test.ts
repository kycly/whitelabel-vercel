import { describe, expect, it } from "vitest";
import {
  selectVerificationView,
  shouldPoll,
} from "@/components/verify/verification-view-state";

describe("selectVerificationView", () => {
  it("loading tant que l'etat de session est inconnu", () => {
    expect(selectVerificationView({ sessionState: null, hasDetail: false })).toBe("loading");
  });

  it("resumable pour une session jamais soumise", () => {
    expect(selectVerificationView({ sessionState: "ACTIVE", hasDetail: false })).toBe("resumable");
  });

  it("awaiting-decision pour une session soumise sans decision", () => {
    expect(selectVerificationView({ sessionState: "SUBMITTED", hasDetail: false })).toBe("awaiting-decision");
  });

  it("awaiting-detail quand la decision est rendue mais le detail absent", () => {
    expect(selectVerificationView({ sessionState: "COMPLETED", hasDetail: false })).toBe("awaiting-detail");
  });

  it("complete quand la decision et le detail sont la", () => {
    expect(selectVerificationView({ sessionState: "COMPLETED", hasDetail: true })).toBe("complete");
  });

  it("expired pour une session expiree jamais soumise", () => {
    expect(selectVerificationView({ sessionState: "EXPIRED", hasDetail: false })).toBe("expired");
  });

  it("ignore un detail arrive sur une session non terminee", () => {
    // Cas de bord : le detail ne doit pas court-circuiter l'attente de decision.
    expect(selectVerificationView({ sessionState: "SUBMITTED", hasDetail: true })).toBe("awaiting-decision");
  });
});

describe("shouldPoll", () => {
  it("polle uniquement les deux vues d'attente", () => {
    expect(shouldPoll("awaiting-decision")).toBe(true);
    expect(shouldPoll("awaiting-detail")).toBe(true);
  });

  it("ne polle pas les vues terminales ni resumable", () => {
    expect(shouldPoll("complete")).toBe(false);
    expect(shouldPoll("expired")).toBe(false);
    expect(shouldPoll("resumable")).toBe(false);
    expect(shouldPoll("loading")).toBe(false);
  });
});
