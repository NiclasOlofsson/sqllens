# [1.8.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.7.0...v1.8.0) (2026-07-23)


### Bug Fixes

* clausesOf anchors FROM across templated fills ([bec7e29](https://github.com/NiclasOlofsson/sqllens/commit/bec7e2953e0eb81498a0454c4d6c8650d501a957))


### Features

* Token.consumedAs: per-occurrence keyword/identifier/type verdicts ([fd4e68b](https://github.com/NiclasOlofsson/sqllens/commit/fd4e68ba2ad28a67611431f2c6ebd6d22687de52))

# [1.7.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.6.0...v1.7.0) (2026-07-22)


### Bug Fixes

* **databricks:** top-level LIMIT/OFFSET reach the IR ([2d17e4d](https://github.com/NiclasOlofsson/sqllens/commit/2d17e4d1f887a9fb5711ff7811f8297ba296c83b))


### Features

* frameAt, clausesOf, setOpArmsOf: the debugger's where-is-what surfaces ([b7ef6bd](https://github.com/NiclasOlofsson/sqllens/commit/b7ef6bd01408e61dca487e5831af043a8d1893c6))
* reserved/soft keyword split + completion candidate decoration (anvil asks) ([03f4703](https://github.com/NiclasOlofsson/sqllens/commit/03f47037940c0373214d23a756fe612d4bd5158c))
* scripting compounds model their inner statements (snowflake, databricks) ([9e14e70](https://github.com/NiclasOlofsson/sqllens/commit/9e14e70dde87a35f3ee968af815e723aa89153d2))
* Spark-gate temp-view threading + snowflake scripting honesty ([6aa04f3](https://github.com/NiclasOlofsson/sqllens/commit/6aa04f329eaee01deb1c550eccfa7eb3e28e37b8)), closes [#40](https://github.com/NiclasOlofsson/sqllens/issues/40)
* **tsql:** DECLARE variable linking and declared-type flow ([555a46c](https://github.com/NiclasOlofsson/sqllens/commit/555a46cb2cb79fed17f613b51e71eb08f745b953))
* **tsql:** routine frames: procedure/function signatures and bodies in the IR ([65efca2](https://github.com/NiclasOlofsson/sqllens/commit/65efca2ce654ac88de7d009001c5eb78848af3d6))

# [1.6.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.5.1...v1.6.0) (2026-07-20)


### Bug Fixes

* **infer:** databricks types corrected against Spark's own analyzer (430 -> 5) ([1d4bd8e](https://github.com/NiclasOlofsson/sqllens/commit/1d4bd8e5976db20c87774dbd3abeab3848f5a7ad)), closes [#40](https://github.com/NiclasOlofsson/sqllens/issues/40)
* **infer:** databricks wrong-type count is ZERO; per-column baseline + unit pins ([8212306](https://github.com/NiclasOlofsson/sqllens/commit/82123063b7968e14dd0731d2af1aca01242cb307))
* **postgres:** registry rules corrected against pg_proc.dat, ledger emptied ([4acfae0](https://github.com/NiclasOlofsson/sqllens/commit/4acfae082af62e9e376d89da3a8d5f625eaef1b5))


### Features

* **api:** dialectVocabulary(dialect) - the per-dialect token catalog as data ([7430155](https://github.com/NiclasOlofsson/sqllens/commit/7430155cdb8df0d82633a6dcdf30501c36818ed4))
* debt burn-down: completion prefix-pruning, fold sweep, small grammar fixes ([7a5011e](https://github.com/NiclasOlofsson/sqllens/commit/7a5011ec1feb0d67a6eceac0a75ac26ee0783d96))
* DQL grammar/IR compliance pass (zero known non-compliance at parse + lower) ([c89d6a5](https://github.com/NiclasOlofsson/sqllens/commit/c89d6a56a3867389dfc0dbb80d0b4262a252d02a))
* parameter and variable IR modeling across all dialects ([c1e9c21](https://github.com/NiclasOlofsson/sqllens/commit/c1e9c21846510e8adc901fd6d230df16ba7e4c7c))

## [1.5.1](https://github.com/NiclasOlofsson/sqllens/compare/v1.5.0...v1.5.1) (2026-07-16)


### Bug Fixes

* **completion:** dangling-dot fallback resolves a templated source's columns ([d83a063](https://github.com/NiclasOlofsson/sqllens/commit/d83a063807bb58b9b7bc879d0d820ac00240c625))
* **symbols:** table Sym.name shows display spelling, not the folded key ([0cc6499](https://github.com/NiclasOlofsson/sqllens/commit/0cc6499a1dc54a8b526035369d6ec02bca55b6a0)), closes [#38](https://github.com/NiclasOlofsson/sqllens/issues/38)

# [1.5.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.4.0...v1.5.0) (2026-07-16)


### Bug Fixes

* **lineage:** origins stay display-facing after the identity/display split ([0398389](https://github.com/NiclasOlofsson/sqllens/commit/0398389a5ccc8c85290bdee6611ed94160403cfd))
* **tests:** AdventureWorks extractor captures every CREATE TABLE in a batch ([d0dbb6f](https://github.com/NiclasOlofsson/sqllens/commit/d0dbb6fcc3570a1f8563f194a7dffe978624e9e4)), closes [#38](https://github.com/NiclasOlofsson/sqllens/issues/38)


### Features

* **completion:** CTE candidates, namespace segment completion, qualifier-filtered columns ([920c862](https://github.com/NiclasOlofsson/sqllens/commit/920c86212ecc625aa7076555ff9b12fb0126ce71)), closes [#38](https://github.com/NiclasOlofsson/sqllens/issues/38)
* **ir:** every table source carries its structured relation name ([405c5d9](https://github.com/NiclasOlofsson/sqllens/commit/405c5d9fc48925724f91694911183f29f0e0f429))
* **ir:** QualifiedName - the structured relation name, with per-dialect namespace configs ([f63417e](https://github.com/NiclasOlofsson/sqllens/commit/f63417ef160a1c93e7fb81e52f057eeae662ff42))
* **ir:** relation is the one truth - TableSource.name retired ([3f94bf1](https://github.com/NiclasOlofsson/sqllens/commit/3f94bf1feab25bf4d9ad6c06a8b9d4b8c47a4fd2)), closes [#38](https://github.com/NiclasOlofsson/sqllens/issues/38)
* **scope,qualify:** resolution consumes qualified-name keys - suffix matching, validation, ambiguity ([7adacb0](https://github.com/NiclasOlofsson/sqllens/commit/7adacb0a16ec79e3fb7d7eaea92b798f1cac74ba)), closes [#38](https://github.com/NiclasOlofsson/sqllens/issues/38)

# [1.4.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.3.0...v1.4.0) (2026-07-15)


### Bug Fixes

* **completion:** the token being typed is the caret token ([56f4da3](https://github.com/NiclasOlofsson/sqllens/commit/56f4da3cf05e19873fc181a3d9fcd8dd31e2a029)), closes [#36](https://github.com/NiclasOlofsson/sqllens/issues/36)
* **minijinja:** unresolved template sources take the raw tag text as their name, never the fill ([36cb274](https://github.com/NiclasOlofsson/sqllens/commit/36cb274ef092c18bdaa8cc81b59aa6f9f7306408)), closes [#35](https://github.com/NiclasOlofsson/sqllens/issues/35)


### Features

* **completion:** templateCandidates receives the whole call; numeric literal args carry values ([ef35ade](https://github.com/NiclasOlofsson/sqllens/commit/ef35adeea2f3e5ab1cdd7b9706502222eb26eebc)), closes [#37](https://github.com/NiclasOlofsson/sqllens/issues/37)

# [1.3.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.2.0...v1.3.0) (2026-07-15)


### Bug Fixes

* **fold:** ASCII-only identifier folding for sqlite, postgres, duckdb and redshift ([095d994](https://github.com/NiclasOlofsson/sqllens/commit/095d99487ccf9797df5f02f2368e620a711a2791)), closes [hi#bit](https://github.com/hi/issues/bit) [#22](https://github.com/NiclasOlofsson/sqllens/issues/22)
* **parse:** cap expected-token enumeration in syntax error messages ([037ce88](https://github.com/NiclasOlofsson/sqllens/commit/037ce88ecf490c617fd45219ad24e8cfe3cd3484)), closes [#31](https://github.com/NiclasOlofsson/sqllens/issues/31)


### Features

* **signature:** authored descriptions for the license-blocked dialects ([9ce4995](https://github.com/NiclasOlofsson/sqllens/commit/9ce4995187b8001bfb96fbbae09b98e4547999f8))
* **signature:** canonical renderSignature with vendor bracket notation ([eabbdbc](https://github.com/NiclasOlofsson/sqllens/commit/eabbdbcbe18dcb1899fdb817c8659f71d1b0af2e)), closes [#33](https://github.com/NiclasOlofsson/sqllens/issues/33)
* **signature:** databricks function descriptions from Apache Spark's builtin reference ([c171f05](https://github.com/NiclasOlofsson/sqllens/commit/c171f0525cb6710e585d8fe5d71729b461b52583))
* **signature:** every function name now links to vendor documentation ([91a2b65](https://github.com/NiclasOlofsson/sqllens/commit/91a2b65569e29ea42996e819f00c321af7f8f5d2)), closes [#safe_casting](https://github.com/NiclasOlofsson/sqllens/issues/safe_casting)
* **signature:** harvest one-line descriptions from the permissively licensed doc sources ([6a535f9](https://github.com/NiclasOlofsson/sqllens/commit/6a535f946b57bdaf7e101b2b38abc58593993c49))
* **signature:** per-function anchors on the docUrls where the source provides them ([b105fe5](https://github.com/NiclasOlofsson/sqllens/commit/b105fe53bbb1de3f2c688d21cc9f7e4ef9b3a16d))
* **signature:** per-name function docs tables with vendor docUrl for every dialect ([1b5d969](https://github.com/NiclasOlofsson/sqllens/commit/1b5d969b04986488e1f74b11f23376be99eaaadc)), closes [#34](https://github.com/NiclasOlofsson/sqllens/issues/34)
* **signature:** sqlite function descriptions from the public-domain doc bundle ([51fb4b1](https://github.com/NiclasOlofsson/sqllens/commit/51fb4b1d6d4005a7b8a48d6fbb2e224ff0e7b452))

# [1.2.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.1.0...v1.2.0) (2026-07-14)


### Bug Fixes

* **bigquery:** named-argument calls never populated argNames ([1b93e1c](https://github.com/NiclasOlofsson/sqllens/commit/1b93e1cb6713d5d67c4bf6351c4db3c2109a2bab))
* **ci:** treat Context7 too-early cooldown as soft skip ([bb2b256](https://github.com/NiclasOlofsson/sqllens/commit/bb2b256f94d4e7b865848018e8562910dd29d177))
* **completion:** lex the placeholder, not raw text, on templated documents ([7dfb293](https://github.com/NiclasOlofsson/sqllens/commit/7dfb2932ae43cd43a13a982b757ff89f1caeb303))
* **completion:** resolve ref/source relation columns in broken-input column completion ([574e975](https://github.com/NiclasOlofsson/sqllens/commit/574e97581980ae357424a7131ec4fd48b49af0c1))
* **pivot:** thread the dialect through aliased-pivot source resolution ([e310f18](https://github.com/NiclasOlofsson/sqllens/commit/e310f18afb40e3cb050b6e30d217eaf7b8b43bc8))
* **signature:** correct the hand-curated tables against the reconciliation evidence ([df54288](https://github.com/NiclasOlofsson/sqllens/commit/df542889c13346971d9480466cbc55cb209ab438))
* **signature:** every call-shaped line in a doc block is a candidate; overrides cut to the proven residue ([6592e6b](https://github.com/NiclasOlofsson/sqllens/commit/6592e6b2bc5f45f55c39ecfb90e7c8b559a0a509))
* **signature:** postgres substring's positional form verified against pg_proc, count optional ([1d1609f](https://github.com/NiclasOlofsson/sqllens/commit/1d1609fd7f6f359c77d223e0325f81cd85bce717))
* **signature:** syntaxsql fences with trailing whitespace were invisible to the harvester ([a441a80](https://github.com/NiclasOlofsson/sqllens/commit/a441a80d8c971b23464331fff9e1623a3e00c457))
* **signature:** tsql harvester emits real optionality instead of flattening brackets ([65f9bb0](https://github.com/NiclasOlofsson/sqllens/commit/65f9bb0fe4670f2975feb32f980d92ee55c2c583))
* **snowflake:** EXTRACT's date-part operand was dropped from the lowered call args ([2960252](https://github.com/NiclasOlofsson/sqllens/commit/29602523d3f52790f21fee0f5a16b0fc6c6e79ee))
* **snowflake:** named-argument calls never populated argNames ([4434921](https://github.com/NiclasOlofsson/sqllens/commit/4434921e98e22a796afae926c3a9639e9cdde2c9))


### Features

* **completion:** complete inside jinja tags via a host candidate contract (REQ2b) ([b1846a5](https://github.com/NiclasOlofsson/sqllens/commit/b1846a5a012f24574ee6f48e2f5eaffcd858ee1f))
* **completion:** detect bare, nested, and control-tag jinja call slots ([38d9852](https://github.com/NiclasOlofsson/sqllens/commit/38d9852526df3abe338cfd43799963f5e2529361))
* **completion:** jinjaSlotAt — neutral jinja completion-slot detection (REQ2a) ([a18610f](https://github.com/NiclasOlofsson/sqllens/commit/a18610f54377533b2c3b1714f34c9f63e4a6bff0))
* **dialect:** add internal DialectBehavior interface + delegating registry ([777f0b3](https://github.com/NiclasOlofsson/sqllens/commit/777f0b3c2efbb70be60a66832cc272d7acd17300))
* **dialect:** behaviorOf carrier resolves a scope's behavior from its dialect tag ([caf2186](https://github.com/NiclasOlofsson/sqllens/commit/caf21860965f3e0388334dac348f59d6a2692823))
* **duckdb:** model PIVOT/UNPIVOT onto the shared IR; dynamic pivot resolves to unknown ([0df2c86](https://github.com/NiclasOlofsson/sqllens/commit/0df2c86c62512f002d852e6cb586ce6d0363dd25))
* **minijinja:** recover incomplete/mid-typing tags as call nodes (REQ1) ([4a7abc6](https://github.com/NiclasOlofsson/sqllens/commit/4a7abc60bdd1b24526f2fe5e081cc2fadf5035dc))
* require a supported dialect; drop the silent default-dialect fallback ([4502813](https://github.com/NiclasOlofsson/sqllens/commit/45028131f33b8b3c51a8daa567db01848b5e2788))
* **signature:** eight reconciliation-driven harvester widenings ([0ad1e47](https://github.com/NiclasOlofsson/sqllens/commit/0ad1e4795437604d2b3a079c5d073f0ad7aa8858))
* **signature:** harvested signature tables for databricks and snowflake ([cd04a36](https://github.com/NiclasOlofsson/sqllens/commit/cd04a365a45e46cbaa746c94e198fc54af91f5bf))
* **signature:** harvested signature tables for duckdb and postgres ([95dcc2c](https://github.com/NiclasOlofsson/sqllens/commit/95dcc2cea0f20c6cc505f4e33a63ff4b47db19b9))
* **signature:** harvested signature tables for trino and bigquery ([f4f9aed](https://github.com/NiclasOlofsson/sqllens/commit/f4f9aed26bc96808eafb1998687698592a263afd))
* **signature:** one generated signature table per dialect, origin per entry ([722492f](https://github.com/NiclasOlofsson/sqllens/commit/722492fafbcc0c441bb08a251617cb2054521dfc))
* **signature:** overload sets per name ([8e8072b](https://github.com/NiclasOlofsson/sqllens/commit/8e8072bb870f55d9a5745d9f919f48bb8be014df))
* **signature:** redshift, mysql and sqlite join the harvest; every dialect now doc-derived ([92500cf](https://github.com/NiclasOlofsson/sqllens/commit/92500cf1aea5ed5e822deffbdee1d78406d2e50c))

# [1.1.0](https://github.com/NiclasOlofsson/sqllens/compare/v1.0.0...v1.1.0) (2026-07-11)


### Bug Fixes

* context7.json description under the 200-char schema cap (validation rejected the whole file) ([c67a25c](https://github.com/NiclasOlofsson/sqllens/commit/c67a25cbac0a528d2afdbf95cdb8bb98bf8af043))
* **mysql:** bar reserved LEFT/RIGHT as identifiers so bare LEFT/RIGHT JOIN parse ([d9cdcae](https://github.com/NiclasOlofsson/sqllens/commit/d9cdcae1b98d2fa7c3c49d4565a051bae8b9e922))
* **mysql:** bounded docs-corpus grammar gaps — 13 cited constructs (wave 1) ([5a8e47a](https://github.com/NiclasOlofsson/sqllens/commit/5a8e47a55a74acb57c0662d1941f2c380f146c5f))
* **mysql:** collect union trailing into-tail arm; pin join/order-by-subquery tests ([d67c8be](https://github.com/NiclasOlofsson/sqllens/commit/d67c8be146a0ba54ccb436ae1bc12ac7b76248ed))
* **mysql:** compute part spans for fused DOT_ID tokens — a.b gets per-part addressability (no grammar change needed) ([5f84cbe](https://github.com/NiclasOlofsson/sqllens/commit/5f84cbe3f443f19d4450ab9afccd7989bb594198))
* **mysql:** DOT_ID part spans for unspaced a.b — per-part editor addressability restored ([52b39ed](https://github.com/NiclasOlofsson/sqllens/commit/52b39edcefa378549f80f24462933569f9fcd8ca))
* **mysql:** fractional literal without exponent is DECIMAL, not double ([f5b5482](https://github.com/NiclasOlofsson/sqllens/commit/f5b5482635fc12ed67fb49ceb6b058461971739b))
* **mysql:** require SEMI between batch statements — quantified-subquery mis-split root fix (SLL floors 11→6, 612→33) ([2d93aa1](https://github.com/NiclasOlofsson/sqllens/commit/2d93aa1ba18ad51e9fcc309870d10c25b1342323))
* **mysql:** reserved-word audit + SEMI-required batching — the completion round ([f83e75d](https://github.com/NiclasOlofsson/sqllens/commit/f83e75dd6b3ebc470d21583312a7ec22bf530103))
* **mysql:** reserved-word identifier audit, the LEFT/RIGHT class checked systematically ([f3f2cb7](https://github.com/NiclasOlofsson/sqllens/commit/f3f2cb728f117fb6d8c6701cea1b9576011f12ca))
* **sqlite:** docs scraper sees past leading comments; bucketed corpus layout ([81daa91](https://github.com/NiclasOlofsson/sqllens/commit/81daa91396d8f592d067370778c7aad20700e5ab))
* **sqlite:** join_step sub-rule — Join.cst spans the full construct (grammar corrected in place per repo policy) ([2d3e1c1](https://github.com/NiclasOlofsson/sqllens/commit/2d3e1c1fefa72cc990e27fd01538d5c2545a6a47))
* **sqlite:** populate SelectExpr.subqueries with expression subqueries (scalar/IN/EXISTS) ([05300c9](https://github.com/NiclasOlofsson/sqllens/commit/05300c97fe744e1de80e93c2d9cb33a4916f34bc))
* **sqlite:** register sign() in SQLITE_FUNCTION_RETURNS ([d39d25f](https://github.com/NiclasOlofsson/sqllens/commit/d39d25fb6ad819c06774c7d5e50bc9c579ce1b8c))


### Features

* **dialects:** sqlite + mysql — two new first-class dialects (grammar → parse → lower → full semantic layer) ([a421559](https://github.com/NiclasOlofsson/sqllens/commit/a42155953566618966d4658731b7fa066ec25dc7))
* **mysql:** corpus gate green ([b687271](https://github.com/NiclasOlofsson/sqllens/commit/b6872714091737fb832b9241eb4b94db18478a48))
* **mysql:** docs-corpus scraper for the MySQL 8.4 reference manual ([5dd2b9f](https://github.com/NiclasOlofsson/sqllens/commit/5dd2b9f79e3245f7b61bf0f0cc24c8d1deec9dce))
* **mysql:** docs-corpus tier green — the second gate ([5aeb132](https://github.com/NiclasOlofsson/sqllens/commit/5aeb132473114eca2d3099e5228b5cf6a9f05b2a))
* **mysql:** fork + split grammar from grammars-v4 ([63a4dc4](https://github.com/NiclasOlofsson/sqllens/commit/63a4dc4ca16b80674fee04351aa7b084211b53dc))
* **mysql:** inference, fold rule, derived-dialect wiring ([d7c1c76](https://github.com/NiclasOlofsson/sqllens/commit/d7c1c76cef8a4601e52e50510d1952cbae38ffb6))
* **mysql:** lower CST to IR ([055af7f](https://github.com/NiclasOlofsson/sqllens/commit/055af7f2aea1aa32ad05c403b0cb3c8417b8a665))
* **mysql:** parse wrapper + smoke test ([cde9ff3](https://github.com/NiclasOlofsson/sqllens/commit/cde9ff33460da4ca4cdb85136e632d00d87a8ce6))
* **mysql:** register in compile-enforced dialect maps ([5a17648](https://github.com/NiclasOlofsson/sqllens/commit/5a17648942755638435abe99c361f75f40fe173f))
* **mysql:** test matrix, tool registries, docs — Track B finisher (R7) ([0074bd4](https://github.com/NiclasOlofsson/sqllens/commit/0074bd405d2dee27708868179ee1ad1ad3befebd))
* **mysql:** the 8.0.19+ query-expression restructure (wave 2) ([71df3e4](https://github.com/NiclasOlofsson/sqllens/commit/71df3e43ab8054ebab817e5d6a2331404e9745f1))
* **sqlite:** corpus gate green ([8d28524](https://github.com/NiclasOlofsson/sqllens/commit/8d285245261deb8f03c6e68860933602fbe6eb8f))
* **sqlite:** docs-corpus tier green ([e0c1923](https://github.com/NiclasOlofsson/sqllens/commit/e0c19231bd45581fcea3300d6c873444da3abbe9))
* **sqlite:** fork + split grammar from grammars-v4 ([7a32407](https://github.com/NiclasOlofsson/sqllens/commit/7a324070ff99dd7c74bb3d7f3f66b057a68b9ec1))
* **sqlite:** inference, fold rule, derived-dialect wiring ([d87000e](https://github.com/NiclasOlofsson/sqllens/commit/d87000eb8f1af4a3b72a826133ac803eb12485f4))
* **sqlite:** lower CST to IR ([8ac1a37](https://github.com/NiclasOlofsson/sqllens/commit/8ac1a37526de34a2963ca9aaa5af0857845812b0))
* **sqlite:** parse wrapper + smoke test ([c296dd7](https://github.com/NiclasOlofsson/sqllens/commit/c296dd7f9c3555aa8b45905f9e17bcec53056ad0))
* **sqlite:** register in compile-enforced dialect maps ([65faaba](https://github.com/NiclasOlofsson/sqllens/commit/65faaba684bb8c04a5d17ea9df85f7f299c41e9e))
* **sqlite:** test matrix, tool registries, docs ([b698904](https://github.com/NiclasOlofsson/sqllens/commit/b6989047b59a2f9ebd66aa2b197e65939da552e1))

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
