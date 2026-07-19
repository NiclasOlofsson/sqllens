// ---------------------------------------------------------------------------
// Parser for PostgreSQL catalog .dat files (corpus vendor/postgres-catalog/
// pg_proc.dat + pg_type.dat, REL_18_STABLE). Each file is one Perl
// array-of-hashrefs literal: `{ key => 'value', ... },` entries that span
// multiple physical lines, with full-line # comments interleaved and
// backslash-escaped single quotes inside values. This reads only the
// key/value surface (no Perl semantics, no BKI_DEFAULT resolution): the
// postgres.pgproc corpus gate needs proname / prorettype / proargtypes /
// prokind / proretset, all of which are literal in the file when present.
// ---------------------------------------------------------------------------

export type PgDatEntry = Record<string, string>;

/** Parse a catalog .dat file into its entries (each a flat key -> value record). */
export function parsePgDat(text: string): PgDatEntry[] {
	// Strip full-line comments first (they never carry entry data).
	const body = text
		.split(/\r?\n/)
		.filter((l) => !/^\s*#/.test(l))
		.join("\n");

	// Walk the text collecting top-level { ... } blocks, quote-aware (backslash escapes).
	const blocks: string[] = [];
	let depth = 0;
	let quote = false;
	let start = -1;
	for (let i = 0; i < body.length; i++) {
		const c = body[i];
		if (quote) {
			if (c === "\\") i++; // skip the escaped char
			else if (c === "'") quote = false;
			continue;
		}
		if (c === "'") quote = true;
		else if (c === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (c === "}") {
			depth--;
			if (depth === 0 && start >= 0) {
				blocks.push(body.slice(start + 1, i));
				start = -1;
			}
		}
	}

	// Extract `key => 'value'` (or unquoted bareword/number) pairs per block.
	const pair = /(\w+)\s*=>\s*(?:'((?:\\.|[^'\\])*)'|([\w.-]+))/g;
	return blocks.map((block) => {
		const entry: PgDatEntry = {};
		for (const m of block.matchAll(pair)) {
			const raw = m[2] !== undefined ? m[2].replace(/\\(.)/g, "$1") : (m[3] ?? "");
			entry[m[1]] = raw;
		}
		return entry;
	});
}
