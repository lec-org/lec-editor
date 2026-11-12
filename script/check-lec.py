#!/usr/bin/env python3
"""Check fork identities, UI catalogs, and removed application dependencies."""
import argparse
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


def parse_jsonc(source):
    tokens = re.findall(r'//[^\n]*|/\*[\s\S]*?\*/|"(?:\\.|[^"\\])*"|[^\s]', source)
    tokens = [token for token in tokens if not token.startswith(("//", "/*"))]
    return json.loads("".join(
        token for index, token in enumerate(tokens)
        if not (token == "," and index + 1 < len(tokens) and tokens[index + 1] in ("}", "]"))
    ))


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--actions-json", type=Path, help="Output of leceditor --dump-all-actions")
arguments = parser.parse_args()
registered_actions = None
if arguments.actions_json:
    actions = json.loads(arguments.actions_json.read_text(encoding="utf-8"))["actions"]
    registered_actions = {action["name"] for action in actions}
    registered_actions.update(alias for action in actions for alias in action["deprecated_aliases"])

# Built-in keymaps are loaded before disabled-feature filtering, so an action
# from a removed crate causes startup to fail even when its panel is hidden.
removed_namespaces = (
    "acp::", "agent::", "agents_sidebar::", "assistant::", "edit_prediction::",
    "inline_assistant::", "zeta::", "collab_panel::", "channel_modal::",
    "onboarding::", "repl::", "journal::", "miniprofiler::",
    "git::", "git_panel::", "debugger::", "debug_panel::",
    "variable_list::", "new_process_modal::", "console::",
)
keymaps = list((ROOT / "assets/keymaps").rglob("*.json"))
for path in keymaps:
    for section in parse_jsonc(path.read_text(encoding="utf-8")):
        for action in section.get("bindings", {}).values():
            if isinstance(action, list):
                action = action[0]
            if isinstance(action, str):
                check(not action.startswith(removed_namespaces), f"Removed action in {path}: {action}")
                if registered_actions is not None:
                    check(action in registered_actions, f"Unregistered action in {path}: {action}")


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
print(f"LEC boundaries, {len(keymaps)} keymaps and {len(used)} referenced translations checked.")
