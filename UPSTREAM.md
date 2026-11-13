# Upstream baseline

- Fork: https://github.com/lec-org/lec-editor
- Upstream: https://github.com/zed-industries/zed
- Release: `v1.28.1`
- Commit: `e8bc16acee5ae1937600d571d441c4b5d7b0d288`
- Baseline established: 2026-11-12 (Asia/Shanghai)
- Development branch: `lec-editor-baseline`
- License: GPL-3.0-or-later, with Apache-2.0 components where marked. Original license and attribution files are retained.

本仓库是独立的 LEC Editor 桌面应用仓库，`origin` 指向 LEC，`upstream` 指向 Zed。当前只保留 `main` 和 `lec-editor-baseline`：`main` 已合入基线的完整 LEC 改造，并保留官网与发布配置；`lec-editor-baseline` 保留为固定参考分支。应用代码继续基于 Zed `v1.28.1`，后续升级需显式选择版本并验证。

The initial baseline commit changed only fork documentation. Subsequent LEC changes are recorded in `docs/lec/IMPLEMENTATION.md`; imported Wu sources and their exact commits are recorded in `docs/lec/THIRD_PARTY.md`. Windows runtime acceptance remains separate from automated source and build checks.

Future upgrades should select an explicit Zed release, compare it with the recorded baseline, reapply the focused LEC changes, and validate the Windows build and C/C++ workflow before updating this record.

Wu is a reference, not an additional upstream. The review uses Wu `v1.2.2`, commit `41b71ce4905a8467bcf08d1f69a49a77c3a33052`, and individually linked historical commits. When adapting code, record its exact source commit, retain applicable attribution, and check whether Zed already implements the behavior.
