import { describe, expect, it } from "vitest";
import { resolveCreatedFrom } from "@/lib/session-period";

const now = new Date("2026-07-27T12:00:00.000Z");

describe("resolveCreatedFrom", () => {
	it("rend une borne a 7 jours", () => {
		expect(resolveCreatedFrom("7d", now)).toBe("2026-07-20T12:00:00.000Z");
	});

	it("rend une borne a 30 jours", () => {
		expect(resolveCreatedFrom("30d", now)).toBe("2026-06-27T12:00:00.000Z");
	});

	it("ne borne rien pour la periode complete", () => {
		expect(resolveCreatedFrom("all", now)).toBeUndefined();
	});
});
