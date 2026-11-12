#!/usr/bin/env python3
"""Check fork identities, UI catalogs, and removed application dependencies."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def check(condition, message):
    if not condition:
        raise SystemExit(message)


def rust_string(value):
    value = re.sub(r"\\u\{([0-9a-fA-F]+)\}", lambda match: chr(int(match[1], 16)), value)
    return json.loads('"' + value + '"')


catalog = {}
for path in (ROOT / "assets/locales/zh-CN/strings").glob("*.json"):
    for key, value in json.loads(path.read_text(encoding="utf-8")).items():
        check(value.strip(), f"Empty translation: {key}")
        check(key not in catalog or catalog[key] == value, f"Conflicting translation: {key}")
        placeholders = lambda text: set(re.findall(r"\{([A-Za-z_][A-Za-z0-9_]*)\}", text))
        check(placeholders(key) == placeholders(value), f"Different placeholders: {key}")
        catalog[key] = value

literal = r'"((?:[^"\\]|\\.)*)"'
plain = re.compile(r"\b(?:t|n)!\(\s*" + literal)
contextual = re.compile(r"\btc!\(\s*" + literal + r"\s*,\s*" + literal)
used = set()
for path in (ROOT / "crates").rglob("*.rs"):
    if "i18n" in path.parts:
        continue
    source = path.read_text(encoding="utf-8")
    used.update(rust_string(match[1]) for match in plain.finditer(source))
    used.update(rust_string(match[1]) + "|" + rust_string(match[2]) for match in contextual.finditer(source))
check(not used - catalog.keys(), f"Missing translations: {sorted(used - catalog.keys())}")

production = read("crates/zed/Cargo.toml").split("[dev-dependencies]")[0]
for crate in ("agent_ui", "collab_ui", "sidebar", "repl", "miniprofiler_ui", "journal", "language_models"):
    check(not re.search(r"^" + crate + r"(?:\.workspace)?\s*=", production, re.M), f"Restored excluded dependency: {crate}")
check('name = "leceditor"' in production, "Missing LEC executable")
check('APP_NAME: &str = "LECEditor"' in read("crates/paths/src/paths.rs"), "Shared user data directory")
installer = read("crates/zed/resources/windows/lec-editor.iss")
check("LEC-Editor-Stable-Instance-Mutex" in installer, "Incorrect installer mutex")
check('ReleaseChannel::Stable => "LEC-Editor-Stable"' in read("crates/release_channel/src/lib.rs"), "Incorrect runtime mutex")
check("9A7293B9-052B-4807-8DCB-E6C4B1A93D58" in installer, "Incorrect installer identity")
check("Zed" not in "\n".join(line for line in installer.splitlines() if not line.startswith(";")), "Upstream installer identity leaked")
updater = read("crates/auto_update/src/auto_update.rs")
init = updater[updater.index("pub fn init("):updater.index("pub fn check(")]
check("GlobalAutoUpdate(None)" in init and "AutoUpdater::new" not in init, "Upstream updater re-enabled")
print(f"LEC boundaries and {len(used)} referenced translations checked.")
