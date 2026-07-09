// src/lsp/dialect-config.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { minimatch } from "minimatch";
import { Schema, resolveDialect, type Dialect, type SchemaMapping } from "../index.js";

// ---------------------------------------------------------------------------
// Dialect resolution: a document's dialect is configured, never guessed. Reads
// <root>/.sqllens.json — ordered glob rules, first match wins, else `default`.
// A rule's `dialect` value is resolved through the library's derived-dialect map,
// so it accepts a dialect name OR an engine name (`athena` → trino, `fabric` →
// tsql, …). An optional `schema` key points at a JSON catalog (a SchemaMapping)
// used by the semantic-diagnostics and hover tiers. A missing/malformed config
// falls back to the "databricks" default and records a warning (surfaced over
// window/logMessage by the server) — loading never throws.
// ---------------------------------------------------------------------------

interface Rule {
	files: string;
	dialect: Dialect;
}

export interface DialectConfig {
	/** The dialect for a workspace-relative path (POSIX-style), first matching rule then default. */
	dialectFor(relPath: string): Dialect;
	/** The catalog from the `schema` key, if present and valid. */
	schema?: Schema;
	/** Non-fatal problems (missing/malformed config, unknown dialect, bad schema) for logMessage. */
	warnings: string[];
}

export function loadDialectConfig(rootDir: string): DialectConfig {
	const warnings: string[] = [];
	let rules: Rule[] = [];
	let fallback: Dialect = "databricks";
	let schema: Schema | undefined;

	let raw: string | undefined;
	try {
		raw = readFileSync(join(rootDir, ".sqllens.json"), "utf8");
	} catch {
		warnings.push("No .sqllens.json found; defaulting all files to the databricks dialect.");
	}

	if (raw !== undefined) {
		try {
			const parsed = JSON.parse(raw) as {
				dialects?: { files: string; dialect: string }[];
				default?: string;
				schema?: string;
			};
			for (const r of parsed.dialects ?? []) {
				const dialect = resolveDialect(r.dialect);
				if (dialect === undefined) {
					warnings.push(
						`Unknown dialect "${r.dialect}" in .sqllens.json rule for "${r.files}"; rule ignored.`,
					);
					continue;
				}
				rules.push({ files: r.files, dialect });
			}
			if (parsed.default !== undefined) {
				const dialect = resolveDialect(parsed.default);
				if (dialect !== undefined) fallback = dialect;
				else warnings.push(`Unknown default dialect "${parsed.default}" in .sqllens.json; using databricks.`);
			}
			if (parsed.schema !== undefined) {
				try {
					const mapping = JSON.parse(readFileSync(join(rootDir, parsed.schema), "utf8")) as SchemaMapping;
					schema = new Schema(mapping);
				} catch {
					warnings.push(`Could not read schema file "${parsed.schema}" referenced by .sqllens.json.`);
				}
			}
		} catch {
			warnings.push(".sqllens.json is not valid JSON; defaulting all files to the databricks dialect.");
		}
	}

	const dialectFor = (relPath: string): Dialect => {
		const posix = relPath.replace(/\\/g, "/");
		for (const rule of rules) if (minimatch(posix, rule.files)) return rule.dialect;
		return fallback;
	};

	return { dialectFor, schema, warnings };
}
