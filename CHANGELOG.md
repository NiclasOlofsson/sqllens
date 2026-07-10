# [1.0.0](https://github.com/NiclasOlofsson/sqllens/compare/v0.1.1...v1.0.0) (2026-07-10)


* refactor(api)!: jinja entry points move to the sqllens/minijinja subpath — parseTemplated/tokenizeTemplated/TagNode/regions/variants leave the main barrel; the neutral TemplateEngine contract stays ([0d51d95](https://github.com/NiclasOlofsson/sqllens/commit/0d51d95bda3b81d12608597382a6a67c28401c85))
* refactor(api)!: rename adapter map to derived dialects, drop dbt vocabulary ([f2373e2](https://github.com/NiclasOlofsson/sqllens/commit/f2373e29a74a8d3b215da94a8f5ce809bdbe86b9))


### Bug Fixes

* **api:** drop dead ParserRuleContext imports left by the ParseResult consolidation; exports test covers all 12 IR types ([b382178](https://github.com/NiclasOlofsson/sqllens/commit/b3821786e90fe0111d0a1e344fcbc1000ee85d17))
* **document:** setop output-column matching folds raw-name provenance on both sides — quoted projections no longer drop on asymmetric-fold dialects ([7300058](https://github.com/NiclasOlofsson/sqllens/commit/73000589e08038379f1ad6c735d91bfc7d08f115))
* **document:** union column entries speak the fold vocabulary (fold-normalized, quote-preserving names; star-expanded spans anchor on the star) — anvil retirement blockers ([a14b51a](https://github.com/NiclasOlofsson/sqllens/commit/a14b51a30db6064bb62d87ca5a5bb97fafd02f8a))
* **document:** union diagnostics key folds line:column (lexer-error collision); setop-root output columns answered via qualification (or visibly gapped); comment pins ([c726a33](https://github.com/NiclasOlofsson/sqllens/commit/c726a335ff66d84e17cff4d77ef4d3499aee29d0))
* **minijinja:** TemplateVariant.active.armIndex stays required (0 + syntheticEmpty discriminator — anvil contract is additive); nested else-less fixture pins the synthetic path ([af16756](https://github.com/NiclasOlofsson/sqllens/commit/af16756c2a4295a5c45bb09c3210e19af98f1322))
* **qualify:** columnsOfSource returns typed columns for schema-known tables via tableSourceColumns — the plan's sourceColumns wiring dropped types ([dc77bd5](https://github.com/NiclasOlofsson/sqllens/commit/dc77bd5657fbe53181becc64c062b141e785f3e8))
* **session,document:** cell-aware cursor verbs — doc.nodeAt delegation + new SqlDocument.referencesAt/lineageAt absorbing the LSP multi-statement dance; session works past statement 1 ([b9623c7](https://github.com/NiclasOlofsson/sqllens/commit/b9623c7879704749a6cd2d010fd103beb5f4ec1c))
* **tests:** engine-contract fill-leak fixture actually reaches the scrub path (brief's fixture parsed clean); subpath header comment de-contradicted ([2519425](https://github.com/NiclasOlofsson/sqllens/commit/251942592dcd0eb03ce6cad9f381899e91a61384))


### Features

* **api:** barrel-complete — PipeStage/GraphTableSource/WindowSpec/… union members, NodeHit+nodeAt, endPosition, ParserRuleContext, one shared ParseResult; delete the LSP node-at shim ([736913c](https://github.com/NiclasOlofsson/sqllens/commit/736913c9e12a9c5c91ef2b5f789b04528e932a9e))
* **completion:** completeAt — uniform cursor-verb name; complete stays as deprecated alias (no break) ([de12f8a](https://github.com/NiclasOlofsson/sqllens/commit/de12f8a2fdc8910a75b6fbd5cf8696c826d8c45f))
* **dialects:** postgresql -> postgres alias (alternate engine-name spelling; anvil-requested, unattested-adapter caveat documented) ([13e8ef6](https://github.com/NiclasOlofsson/sqllens/commit/13e8ef6b277077ecabd9a0cf727c2bf87e060c7a))
* **document:** doc.variants — engine.variants() consumed; each arm a lazy SqlDocument sharing the cache family (a variant IS a document) ([b337fb4](https://github.com/NiclasOlofsson/sqllens/commit/b337fb4c5b9079e48b5d7e0c08f194efe76afaa9))
* **document:** templated cell cache keyed on engine+provider version; withText carries the engine; version bump invalidates ([4585515](https://github.com/NiclasOlofsson/sqllens/commit/4585515bc0bcbcc72eaee3a72e979be8ff654b17))
* **document:** the unified door — SqlDocument accepts templating: TemplateEngine (+provider); templated docs ride the single-cell path with doc.templated facets; plain path byte-untouched ([90ee6a7](https://github.com/NiclasOlofsson/sqllens/commit/90ee6a7301bcaa77e7190f07cecb494fccd38bb0))
* **document:** union views — unionSymbols/unionDiagnostics/unionCtes/unionOutputColumns across variant docs; span+identity(+name) dedup, first-live-arm representative spans; the consumer never reasons about arms ([907cc5e](https://github.com/NiclasOlofsson/sqllens/commit/907cc5e712466382db52802806965254a57161ae))
* **document:** variantAt(offset) — cursor routing to the arm where the byte has structure; session delegates ([d6a649c](https://github.com/NiclasOlofsson/sqllens/commit/d6a649cf29c659bab5ec970b2e848fbbe1a59b73))
* **lineage:** node-keyed origins — ColumnLineage.projection + Lineage.originsOfNode; duplicate output names disambiguated ([cf39238](https://github.com/NiclasOlofsson/sqllens/commit/cf3923830bf73c17eccfe31b2fe864966c59fe4b))
* **minijinja:** minijinja() engine factory + sqllens/minijinja subpath + runnable engine-contract suite (main barrel untouched) ([94a6023](https://github.com/NiclasOlofsson/sqllens/commit/94a60236d58589adfd1f966655eda954da5be9f6))
* **minijinja:** synthetic empty-else arm — an optional {% if %} body is also ABSENT in exactly one variant (A8b); enumeration stays linear ([af27433](https://github.com/NiclasOlofsson/sqllens/commit/af274334d0fdd64d99b88bd26a2df62742562ba7))
* **minijinja:** tagOf/nodeOf/diagnosticsOf on TemplatedParseResult — direct two-spine joins replace span-containment correlation ([a723b0f](https://github.com/NiclasOlofsson/sqllens/commit/a723b0f0936d666ec54c7b18b94d98ba4ee1fbaa))
* **qualify:** public Qualification.columnsOfSource — per-source schema-resolved columns, side-effect-free (anvil fold-in) ([29666df](https://github.com/NiclasOlofsson/sqllens/commit/29666df03028f9343b534ef2951427aadd511400))
* **scope:** public walk(scopes) + scopeOf(node) — the node→scope join every consumer re-derived by hand ([95f567d](https://github.com/NiclasOlofsson/sqllens/commit/95f567dedb7ecd0bbcfa151b8d4afd5c7848b37e))
* **session:** SqlSession — the verb-shaped facade over one document; pure delegation, uniform offset anchors, flattened template facets ([bb1b0c0](https://github.com/NiclasOlofsson/sqllens/commit/bb1b0c03dd5a47d23a99511975b4d82845c6054b))
* **symbols:** Span carries absolute offsets (start/end exclusive) — one span vocabulary; multi-cell shifting covered ([6922d01](https://github.com/NiclasOlofsson/sqllens/commit/6922d016a1dfbc11af8dbbbebab80fe858227bbb))
* **symbols:** Sym.node back-reference + public symbolAt — absorbs the LSP's sym-at workaround ([2ab6dce](https://github.com/NiclasOlofsson/sqllens/commit/2ab6dcedf57fcaedbf07ecae97bb4fbf5543d2b7))
* **template:** neutral TemplateEngine contract — result/options types move to src/template/engine.ts; minijinja re-exports (no public change yet) ([068dcc7](https://github.com/NiclasOlofsson/sqllens/commit/068dcc7eb8b8cfffda847656276eb450a8603ff6))


### BREAKING CHANGES

* import { minijinja, parseTemplated, tokenizeTemplated } from "sqllens/minijinja" (in-repo: src/minijinja/index.js). The main barrel keeps TemplateEngine/TemplatedParseResult/TemplatedParseOptions and the whole TemplateProvider family unchanged.
* ADAPTER_DIALECTS / adapterDialect are renamed to
DERIVED_DIALECTS / resolveDialect.

## [0.1.1](https://github.com/NiclasOlofsson/sqllens/compare/v0.1.0...v0.1.1) (2026-07-09)


### Bug Fixes

* **tests:** pin minijinja golden-gate fixtures to LF — CRLF checkout broke it on non-Windows ([a29f4dc](https://github.com/NiclasOlofsson/sqllens/commit/a29f4dcc8e758772c326fe86f9c99ff27ff9b456))
* **tests:** tier-1 corpus-dependent tests hard-throw instead of skip when SQL_CORPUS_DIR is unset ([833aba5](https://github.com/NiclasOlofsson/sqllens/commit/833aba56b1d4c4d53b50c117c86a362fad13808e))
