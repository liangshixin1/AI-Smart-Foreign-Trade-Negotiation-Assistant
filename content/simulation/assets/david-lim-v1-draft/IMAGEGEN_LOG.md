# David Lim v1-draft ImageGen 生成记录

## 输入与输出模式

- 参考底图：`docs/david.jpg`，复制保存在 `source/user-base.jpg`。
- 角色变体使用 ImageGen **编辑模式**，以参考底图约束同一人物身份、发型、服装、年龄和中长构图。
- 会谈室使用 ImageGen **生成模式**，不带人物参考图。
- 生成原件保存在 ImageGen 输出目录；用于交付的独立副本与派生件保存在本资产目录和 `apps/web/public/simulation/david-lim-v1-draft/`。

## 共同角色提示词

> Preserve the exact identity of the adult East Asian businessman in the reference: same face, black hair, charcoal suit, white shirt, dark tie, front-facing medium-long composition and restrained professional anime illustration. Change only the requested facial expression or subtle hand pose. No text, logo, extra person or cropped head.

表达差异：

- neutral：平静、专注、专业。
- thinking：托腮思考，但不夸张。
- pleased：克制认可，不做讨好式大笑。
- frustrated：轻微皱眉、坚定但不敌意。
- confused：轻微疑惑，保持商务礼仪。

## 背景提示词

> A modern daylight business meeting room in restrained anime background style, a negotiation table with two document folders, no people, no readable text or logo, with clear safe space on the right for a standing character and along the bottom for subtitles.

## 透明背景修复

初始 thinking / pleased / frustrated 结果在浏览器叠加时出现黑色矩形底板；一次“透明背景”重试又生成了烘焙棋盘格，因此两批都未作为最终派生件接受。

随后使用以下编辑约束重新生成纯绿幕源图：

> Preserve the exact character, pose, expression, suit, crop, line art and shading. Replace only the entire background with perfectly uniform solid chroma green #00FF00. No gradient, checkerboard, vignette, shadow, halo, texture, text or extra object.

`scripts/chroma_key_sprite.py` 对绿幕做确定性 alpha 转换和边缘去绿，生成 `source/*.{png}`；再使用 WebP 派生件。五个运行时表情均通过 `hasAlpha: yes` 检查。原绿幕图保存在 `source/*-chroma.png`，便于复核和重新派生。

## 接受边界

- 工程视觉检查：通过，无矩形底板；尺寸、清单、hash、降级和手机裁切已检查。
- 人工审美验收：未完成。
- manifest 状态：`draft`、`approved=false`。只有用户明确认可后才能升级为 approved。
