---
name: release
description:
  Step-by-step release of @onlyoffice/n8n-nodes-docs - pre-release checks, version and CHANGELOG, the release PR
  from develop to master, the create-tag and release workflows that publish to npm from the GitHub mirror, and the
  manual checks after publishing. Use when the user asks to prepare, cut or verify a release.
---

# Release

The package is published to npm by `.github/workflows/release.yml` **on the GitHub mirror**
(`ONLYOFFICE/onlyoffice-n8n`), with npm Trusted Publishing and provenance. There is no npm token, and nothing is
published by hand. The agent prepares the commits and PRs; every push, PR and merge happens only after the user
confirms it.

## 0. One-time state checks

- `git ls-tree --name-only origin/master` must list `package.json`. Until the first normal release, `master` holds
  only `.github/` and `LICENSE`. In that case the release PR brings the whole package into `master`; tell the user
  this before opening it.
- `pnpm lint` must pass. On 2026-11-13 it failed on the `maintainers` field in `package.json` (rule
  `no-template-placeholders`). Fix that in a normal `fix/…` PR to `develop` first.

## 1. Pre-release checks on `develop`

```bash
git fetch origin && git checkout develop && git merge --ff-only origin/develop
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm test
```

- The Audit and Test workflows of the last `develop` push are green (Gitea, and the GitHub mirror Actions tab).
- After the user confirms: `bash test/docker.sh`, the full automation suite against a Document Server 10, 15-20 min.
- After the user confirms: the manual checks in `HANDOVER.md` → "Smoke checks".

## 2. Version and CHANGELOG

1. Choose the version with semver from `[Unreleased]`: `Fixed` only → patch, `Added`/`Changed` → minor. A raised
   minimum Docs version or a removed or renamed parameter is a breaking change. While the version is `0.x`, a
   breaking change is a minor bump. Ask the user to confirm the version.
2. Create the branch `release/<version>` from `develop`.
3. In `package.json`, set `"version": "<version>"` and change nothing else.
4. In `CHANGELOG.md`:
   - rename `## [Unreleased]` to `## [<version>] - <YYYY-MM-DD>`;
   - add an empty `## [Unreleased]` above it;
   - in the link definitions at the bottom, add `[<version>]: https://github.com/ONLYOFFICE/onlyoffice-n8n/compare/v<prev>...v<version>/`
     and change `[Unreleased]` to compare from `v<version>`.
5. Run `pnpm build && pnpm lint && pnpm test` again and commit as `<version>`, as in the history.

## 3. Release PRs (after the user confirms each step)

1. Push `release/<version>` and open a PR to `develop`. Merge it after review.
2. Open the PR `Release/<version>` from `develop` to `master` in Gitea. Merge it after review.
3. Because the push to `master` changes `package.json`, `create-tag.yml` creates the tag `v<version>`. On the GitHub
   mirror the tag starts `release.yml` with the jobs `build` → `npm` → `gh`.
4. Merge `master` back into `develop` (`git merge origin/master`, as in earlier releases) and push after confirmation.

## 4. Verify the publication

```bash
npm view @onlyoffice/n8n-nodes-docs version            # = <version>
npm view @onlyoffice/n8n-nodes-docs@<version> dist.attestations   # provenance present
```

- On GitHub, a release `v<version>` exists with the `.tgz` attached. The 0.0.2 run was cancelled after the npm job,
  so check the `gh` job.
- If `create-tag` did not run (no change to `package.json` reached `master`), the user can start it from the GitHub
  Actions tab with `workflow_dispatch`.
- If `npm` failed before the upload, re-run the job. If the version was uploaded, it cannot be published again; fix
  the problem and release the next patch.

## 5. Manual steps after publishing

- In a clean n8n, install `@onlyoffice/n8n-nodes-docs` from **Settings → Community Nodes**. The new version installs
  and the node opens.
- Repeat the short manual checklist from `HANDOVER.md` → "Smoke checks" on the installed package.
- Report to the user: the version, the npm link, the GitHub release link, and the checks that were run.
