// [导读] 使用 TypeScript 与 Vue 解析器识别真实交接注释，避免把字符串里的注释标记误当成可豁免行。
const { createRequire } = require("node:module");
const path = require("node:path");
const webRequire = createRequire(
  path.resolve(__dirname, "../apps/web/package.json"),
);
const ts = webRequire("typescript");
const { parse } = webRequire("vue/compiler-sfc");

function documentationLines(filename, source) {
  const rows = new Set();
  const lineStarts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") lineStarts.push(i + 1);
  }
  function rowAt(offset) {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (lineStarts[mid] <= offset) low = mid;
      else high = mid;
    }
    return low;
  }
  function addRange(start, end) {
    const first = rowAt(start);
    const last = rowAt(end - 1);
    const lineEnd = source.indexOf("\n", end);
    // [导读] 只有独占物理行的注释才扣除；同一行存在业务代码时仍按代码行计数。
    if (source.slice(lineStarts[first], start).trim()) return;
    if (source.slice(end, lineEnd < 0 ? source.length : lineEnd).trim()) return;
    for (let row = first; row <= last; row++) rows.add(row);
  }
  function collectScript(content, offset) {
    const file = ts.createSourceFile(
      filename + ".ts",
      content,
      ts.ScriptTarget.Latest,
      true,
    );
    const seen = new Set();
    function visitComment(pos, end) {
      if (seen.has(pos)) return;
      seen.add(pos);
      const text = content.slice(pos, end);
      if (
        text.startsWith("// [导读] ") ||
        (text.startsWith("/* [组件导读]\n") && text.endsWith("[/组件导读] */"))
      )
        addRange(offset + pos, offset + end);
    }
    function visit(node) {
      ts.forEachLeadingCommentRange(content, node.getFullStart(), visitComment);
      ts.forEachTrailingCommentRange(content, node.end, visitComment);
      for (const child of node.getChildren(file)) visit(child);
    }
    visit(file);
  }
  if (filename.endsWith(".vue")) {
    const { descriptor, errors } = parse(source, { filename });
    if (errors.length)
      throw new Error(`Vue parse failed: ${filename}: ${errors.join(", ")}`);
    const header = source.match(
      /^<!-- \[组件导读\]\n[\s\S]*?\[\/组件导读\] -->/,
    );
    if (header) addRange(0, header[0].length);
    for (const script of [descriptor.script, descriptor.scriptSetup]) {
      if (script) collectScript(script.content, script.loc.start.offset);
    }
  } else {
    collectScript(source, 0);
  }
  return rows.size;
}

module.exports = { documentationLines };
if (require.main === module) {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    const files = JSON.parse(input);
    process.stdout.write(
      JSON.stringify(
        Object.fromEntries(
          files.map(({ path: filename, source }) => [
            filename,
            documentationLines(filename, source),
          ]),
        ),
      ),
    );
  });
}
