**What changed and why**

**Checklist**

- [ ] `npm run typecheck` and `npm test` pass
- [ ] A grammar change includes a corpus case (or probe) that failed before the fix
- [ ] Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`/`fix:`/`docs:`/`chore:`/...) — releases and the changelog are generated from them
- [ ] No `!` after the commit type and no `BREAKING CHANGE:` footer. Those auto-trigger a major (x.0.0) release; a major requires the maintainer's explicit approval first, so commit a technically-breaking change as a plain `feat:`/`fix:` (note the break in the body)
