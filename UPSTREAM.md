# Upstream baseline

- Fork: https://github.com/lec-org/lec-editor
- Upstream: https://github.com/zed-industries/zed
- Release: `v1.28.1`
- Commit: `e8bc16acee5ae1937600d571d441c4b5d7b0d288`
- Baseline established: 2026-11-12 (Asia/Shanghai)
- Development branch: `lec-editor-baseline`
- License: GPL-3.0-or-later, with Apache-2.0 components where marked. Original license and attribution files are retained.

This is a GitHub fork with a separate desktop application repository. The local `origin` remote points to LEC and `upstream` points to Zed. The fork's inherited `main` branch is separate from the pinned development branch. An inherited branch named `codex` prevents creating `codex/*` branches, so this baseline uses `lec-editor-baseline`.

The initial baseline commit changed only fork documentation. Subsequent LEC changes are recorded in `docs/lec/IMPLEMENTATION.md`; imported Wu sources and their exact commits are recorded in `docs/lec/THIRD_PARTY.md`. Windows runtime acceptance remains separate from automated source and build checks.

Future upgrades should select an explicit Zed release, compare it with the recorded baseline, reapply the focused LEC changes, and validate the Windows build and C/C++ workflow before updating this record.

Wu is a reference, not an additional upstream. The review uses Wu `v1.2.2`, commit `41b71ce4905a8467bcf08d1f69a49a77c3a33052`, and individually linked historical commits. When adapting code, record its exact source commit, retain applicable attribution, and check whether Zed already implements the behavior.
