import { describe, it, expect } from "vitest";
import { POSTGRES_FUNCTION_RETURNS } from "../src/postgres/infer.js";
import { scalar } from "../src/infer/types.js";

// Registry rules graded against pg_proc.dat (REL_18_STABLE) in tests/corpus/postgres.pgproc.test.ts;
// one representative case per fixed rule class here, at the unit level.
describe("postgres function registry — pg_proc.dat-graded rule fixes", () => {
	const rule = (name: string, args: ReturnType<typeof scalar>[] = []) => POSTGRES_FUNCTION_RETURNS[name]?.(args);

	it("rtrim of a binary column stays binary (bytea overload, not coerced to string)", () => {
		expect(rule("rtrim", [scalar("binary"), scalar("binary")])).toEqual(scalar("binary"));
	});

	it("ts_headline over jsonb stays jsonb (returns the document arg's type)", () => {
		expect(rule("ts_headline", [scalar("jsonb"), scalar("tsquery")])).toEqual(scalar("jsonb"));
	});

	it("random(1,10) is int (PG17+ bounded form returns the bound's own type)", () => {
		expect(rule("random", [scalar("int"), scalar("int")])).toEqual(scalar("int"));
	});

	it("length of an lseg column is double (geometric overload, not the text-family int)", () => {
		expect(rule("length", [scalar("lseg")])).toEqual(scalar("double"));
	});

	it("min_scale is int (fixed return, not argument-dependent)", () => {
		expect(rule("min_scale", [scalar("decimal")])).toEqual(scalar("int"));
	});

	it("age of a xid column is int (transaction-id distance, not the datetime interval)", () => {
		expect(rule("age", [scalar("xid")])).toEqual(scalar("int"));
	});

	it("pg_typeof is regtype, not a string", () => {
		expect(rule("pg_typeof", [scalar("int")])).toEqual(scalar("regtype"));
	});
});
