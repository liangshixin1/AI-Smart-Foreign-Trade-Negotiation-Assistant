# static/vendor — 本地托管的第三方前端库

为消除运行时 CDN 依赖（版本漂移、供应链风险、断网白屏），以下库从 **npm 官方
registry 的对应版本 tarball** 中原样提取，本地托管。目录名即锁定的版本号。

| 目录 | 包 | 提取自 tarball 内路径 |
|------|----|----------------------|
| `chart.js-4.4.6/` | `chart.js@4.4.6` | `dist/chart.umd.js` |
| `marked-18.0.5/` | `marked@18.0.5` | `lib/marked.umd.js` |
| `dompurify-3.0.6/` | `dompurify@3.0.6` | `dist/purify.min.js` |
| `quill-2.0.2/` | `quill@2.0.2` | `dist/quill.js`、`dist/quill.snow.css` |
| `echarts-5.6.0/` | `echarts@5.6.0` | `dist/echarts.min.js` |

注：`marked`、`echarts` 此前在 CDN 上未锁定版本，本次锁定为当时 CDN 实际解析到的
版本（marked 18.0.5、echarts 5.6.0），行为与线上一致。`quill.js` 为包内官方产物
（npm 包未附带 min 版，此前 CDN 的 .min 为 jsdelivr 自动压缩）。

仍走 CDN 的例外：
- **Tailwind Play CDN**（`cdn.tailwindcss.com/3.4.17`，已锁版本）——Play 版本无
  npm 等价物，将在前端重构 Phase 1 改为 npm 安装的 Tailwind 构建后彻底移除；
- **Google Fonts**——加载失败时自动降级为系统字体，不影响功能。

## 升级方式

```bash
# 以 echarts 为例：从 npm registry 下载 tarball 并提取 dist 产物
curl -sL "$(curl -s https://registry.npmjs.org/echarts/5.6.0 \
  | python3 -c 'import json,sys;print(json.load(sys.stdin)["dist"]["tarball"])')" \
  | tar xz -C /tmp package/dist/echarts.min.js
mkdir -p static/vendor/echarts-<新版本>
cp /tmp/package/dist/echarts.min.js static/vendor/echarts-<新版本>/
# 同步更新 static/index.html 中的引用路径，并删除旧版本目录
```

不要手工修改本目录下的任何 JS/CSS 文件。
