"""交接注释行数审计的边界用例, 避免误扣字符串或真实代码行。"""

from pathlib import Path
import unittest

from check_file_lengths import documentation_counts, python_documentation_lines


class HandoffCommentAuditTests(unittest.TestCase):
    def test_python_strings_docstrings_and_inline_code_still_count(self) -> None:
        source = (
            "# [导读] 文件说明\n"
            'text = """\n# [导读] 这是字符串内容\n"""\n'
            "value = 1  # [导读] 这行仍有代码\n"
            "def action():\n"
            "    # [导读] 函数说明\n"
            "    return value\n"
        )
        self.assertEqual(python_documentation_lines(source), 2)

    def test_typescript_only_real_standalone_notes_are_excluded(self) -> None:
        source = (
            "/* [组件导读]\n * 说明\n * [/组件导读] */\n"
            "const text = `\n// [导读] 字符串内容\n`\n"
            r"const re = /\/\/ \[导读\]/"
            "\n"
            "// 普通旧注释仍使用原审计口径\n"
            "function action() {\n"
            "  // [导读] 实际注释\n"
            "  return 1 // [导读] 行内仍有代码\n"
            "}\n"
        )
        path = Path("sample.ts")
        self.assertEqual(documentation_counts({path: source})[path], 4)

    def test_vue_does_not_deduct_template_or_style_text(self) -> None:
        source = (
            "<!-- [组件导读]\n文件说明\n[/组件导读] -->\n"
            "<template><pre>// [导读] 可见文字</pre></template>\n"
            '<script setup lang="ts">\n'
            "// [导读] 脚本说明\n"
            "const value = `\n// [导读] 模板字符串\n`\n"
            "</script>\n"
            '<style scoped>.example::after { content: "// [导读] 文本"; }</style>\n'
        )
        path = Path("sample.vue")
        self.assertEqual(documentation_counts({path: source})[path], 4)

    def test_unmarked_comments_keep_the_previous_baseline(self) -> None:
        sources = {
            Path("plain.ts"): "// existing\nconst value = 1\n",
            Path("plain.py"): "# existing\nvalue = 1\n",
        }
        self.assertEqual(documentation_counts(sources), dict.fromkeys(sources, 0))


if __name__ == "__main__":
    unittest.main()
