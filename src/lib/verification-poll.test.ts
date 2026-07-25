import { describe, expect, it } from "vitest";
import {
  MAX_POLL_ATTEMPTS,
  nextPollDelayMs,
  pollCountdownMessage,
  reachedPollingLimit,
} from "@/lib/verification-poll";

describe("lib/verification-poll", () => {
  it("borne le poll a 12 tentatives", () => {
    expect(MAX_POLL_ATTEMPTS).toBe(12);
  });

  it("part de 5s et croit de 2,5s par tentative", () => {
    expect(nextPollDelayMs(1)).toBe(5_000);
    expect(nextPollDelayMs(2)).toBe(7_500);
    expect(nextPollDelayMs(3)).toBe(10_000);
  });

  it("plafonne a 20s", () => {
    expect(nextPollDelayMs(7)).toBe(20_000);
    expect(nextPollDelayMs(50)).toBe(20_000);
  });

  it("traite une tentative 0 ou negative comme la premiere", () => {
    expect(nextPollDelayMs(0)).toBe(5_000);
    expect(nextPollDelayMs(-3)).toBe(5_000);
  });

  it("annonce le delai et le nombre de tentatives restantes", () => {
    expect(pollCountdownMessage(4, 1)).toContain("4");
    expect(pollCountdownMessage(4, 1)).toContain("11");
  });

  it("accorde le pluriel des tentatives restantes", () => {
    expect(pollCountdownMessage(3, 11)).toContain("1 tentative restante");
    expect(pollCountdownMessage(3, 10)).toContain("2 tentatives restantes");
  });

  it("n'annonce jamais un nombre negatif de tentatives restantes", () => {
    expect(pollCountdownMessage(3, 99)).toContain("0 tentative restante");
  });

  it("signale la limite atteinte", () => {
    expect(reachedPollingLimit(11)).toBe(false);
    expect(reachedPollingLimit(12)).toBe(true);
    expect(reachedPollingLimit(13)).toBe(true);
  });
});
