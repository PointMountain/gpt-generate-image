#!/usr/bin/env python3
"""校验 docs/solutions frontmatter 的静默损坏风险。"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SCALAR_FIELD_RE = re.compile(r"^([A-Za-z0-9_-]+):\s*(.+)$")


def is_quoted(value: str) -> bool:
    return (
        len(value) >= 2
        and value[0] == value[-1]
        and value[0] in {'"', "'"}
    )


def validate_frontmatter(path: Path) -> list[str]:
    lines = path.read_text(encoding="utf-8").splitlines()
    errors: list[str] = []

    if not lines:
        return [f"{path}: 文件为空，缺少 frontmatter。"]

    if lines[0] != "---":
        return [f"{path}: 第 1 行必须是精确的 --- frontmatter 起始分隔符。"]

    try:
        closing_index = lines[1:].index("---") + 1
    except ValueError:
        return [f"{path}: 缺少精确的 --- frontmatter 结束分隔符。"]

    if closing_index == 1:
        return [f"{path}: frontmatter 不能为空。"]

    # 只检查顶层 scalar 字段，目标是拦住最容易静默截断的 YAML 写法。
    for line_number, line in enumerate(lines[1:closing_index], start=2):
        if not line or line.startswith("#") or line.startswith((" ", "\t", "- ")):
            continue

        match = SCALAR_FIELD_RE.match(line)
        if not match:
            continue

        field_name, value = match.groups()

        if value in {"", "[]", "{}"} or value.startswith(("[", "{", "|", ">")):
            continue

        if is_quoted(value):
            continue

        if " #" in value:
            errors.append(
                f"{path}:{line_number}: 字段 {field_name} 包含未加引号的 ' #'，严格 YAML 解析会把后半段当注释截断。"
            )

        if ": " in value:
            errors.append(
                f"{path}:{line_number}: 字段 {field_name} 包含未加引号的 ': '，严格 YAML 解析会把它当成嵌套映射。"
            )

    return errors


def main() -> int:
    if len(sys.argv) != 2:
        print("用法: python3 scripts/validate-frontmatter.py <markdown-path>", file=sys.stderr)
        return 2

    path = Path(sys.argv[1]).resolve()
    if not path.is_file():
        print(f"{path}: 文件不存在。", file=sys.stderr)
        return 2

    errors = validate_frontmatter(path)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    print(f"{path}: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
