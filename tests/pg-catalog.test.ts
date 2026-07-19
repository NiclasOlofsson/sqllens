import { describe, expect, it } from "vitest";
import { parsePgDat } from "./helpers/pg-catalog.js";

// Unit tests for the PostgreSQL catalog .dat parser (tests/helpers/pg-catalog.ts).
// The files (corpus vendor/postgres-catalog/pg_proc.dat, pg_type.dat) are one Perl
// array-of-hashrefs literal: `{ key => 'value', ... },` entries spanning multiple
// physical lines, full-line # comments interleaved, backslash-escaped quotes inside
// values. The parser only needs the key/value surface, not Perl semantics.

const SAMPLE = `#----------------------------------------------------------------------
# pg_proc.dat sample
#----------------------------------------------------------------------

[

{ oid => '1317', descr => 'length',
  proname => 'length', prorettype => 'int4', proargtypes => 'text',
  prosrc => 'textlen' },

# a comment between entries
{ oid => '2331', descr => 'expand array to set of rows',
  proname => 'unnest', prorows => '100', prosupport => 'array_unnest_support',
  proretset => 't', prorettype => 'anyelement', proargtypes => 'anyarray',
  prosrc => 'array_unnest' },

{ oid => '16', array_type_oid => '1000',
  descr => 'boolean, format \\'t\\'/\\'f\\'',
  typname => 'bool', typlen => '1' },

]
`;

describe("parsePgDat", () => {
	it("parses entries with their key/value pairs", () => {
		const entries = parsePgDat(SAMPLE);
		expect(entries).toHaveLength(3);
		expect(entries[0]).toMatchObject({ proname: "length", prorettype: "int4", proargtypes: "text" });
		expect(entries[1]).toMatchObject({ proname: "unnest", proretset: "t", prorettype: "anyelement" });
	});

	it("unescapes backslash-escaped quotes inside values", () => {
		const entries = parsePgDat(SAMPLE);
		expect(entries[2].descr).toBe("boolean, format 't'/'f'");
		expect(entries[2].typname).toBe("bool");
	});

	it("ignores full-line comments and survives multi-line entries", () => {
		const entries = parsePgDat(SAMPLE);
		expect(entries.map((e) => e.oid)).toEqual(["1317", "2331", "16"]);
	});
});
