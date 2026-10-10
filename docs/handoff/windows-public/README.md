# Windows 公开体验版

版本 0.2.0。独立名称与 App ID：外贸谈判公开体验版 / cn.negotiation.public。

## 手动构建

在 Windows PowerShell 运行（不需要管理员）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "\\Mac\Home\Documents\外贸模拟谈判 2\scripts\desktop\bootstrap-windows.ps1" -Public
```

输入包来自 public-release/windows-x64/windows-build-source.zip；在 Windows 本地独立临时目录中构建。工具缓存只读复用普通 release 目录，不读取 private-release、.env 或真实 Key。

成功产物：public-release/windows-x64/ForeignTradePublic-0.2.0-win-x64-setup.exe。

## 安装验收

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "\\Mac\Home\Documents\外贸模拟谈判 2\scripts\desktop\install-and-test-windows.ps1" -Public
```

安装后测试在独立合成数据目录中完成，不读取用户 Key，不消耗真实模型。JSON 结果及截图回传至 public-release/windows-x64/evidence/。

## 用户配置与手测

1. 打开“外贸谈判公开体验版”，首次自动显示配置窗口。也可以从顶部菜单“体验版 → 配置 AI / 更换 Key”打开。
2. 填写自己的一条 DeepSeek Key、账户可用的模型 API 名称。默认模型名 deepseek-flash 可编辑。
3. 点击“测试连接”（发送一次小请求，可能计费）。成功后点击“保存并重启应用”。此前请结束当前练习。
4. 确认顶部显示“公开体验版 · DeepSeek 联网模型”，点击“检查三角色连接”，再测试场景生成、谈判回复、最终评价。
5. 关闭重开，确认 Key 生效、历史保留。更换 Key 后重复测试。
6. 在设置窗口删除 Key 并重启，确认恢复“样例模型（非真实 AI）”、历史仍保留。删除本机配置不会在供应商平台撤销 Key。
7. 测试错误 Key、错误模型名、断网，确认显示错误而非假装成功。检查125%/150%缩放。

数据：%APPDATA%\ForeignTradePublic。Key 单独加密保存为 ai-settings.enc，依赖当前 Windows 账户的 DPAPI。不要上传该文件或数据目录。卸载保留学习数据；卸载前可在界面删除 Key。加密存储不防御同一系统账户下的全部恶意软件。

不配置 Key 可以浏览课程和明确标识的样例模式。请求直接发送 DeepSeek 官方 API，相关练习内容会随请求发送，费用由用户账户承担。无需安装 Python 或 Node。

## 发布边界

尚未创建 GitHub Release。Windows 构建和真实 Key 验收完成前，不宣称公开安装包已通过。版本未签名；Windows 可能提示未知发布者。

仅发布公开版 setup.exe、它的 sha256 校验文件和使用说明。构建 ZIP、日志、诊断文件不作为 Release 附件。专家版、私有版不能上传。公开构建的解包检查会拒绝凭据目录、私有注入器、常见私有配置与数据库文件；还应在正式发布前核对第三方资源许可。

本机验证：后端全套回归通过；其中 7 项后端桌面测试、6 项 Node 测试、前端构建/类型检查、公开设置与学生入口 Electron 烟雾已通过。Mac ARM 结果不替代 Windows x64 验收；系统加密保存、更换、删除及真实模型调用需用户在 Windows 手测。
