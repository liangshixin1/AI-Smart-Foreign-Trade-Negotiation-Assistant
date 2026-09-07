# 03 · 二次元角色资产与 ImageGen 工单

状态：用户计划提供底图，当前尚未提供。本文规定后续资产制作与接入，不表示本次已生成图片。

## 1. 风格与身份

- 二维AVG商务角色，成年、专业、干净；立绘有性格，界面保持已验收的清新克制风格。
- 优先半身/大半身，商务着装，镜头大致与眼睛齐平；手机不需要展示全身细节。
- 固定同一张脸、发型、体型、服装、配饰、光源与镜头；表情切换不能像换了一个人。
- 若沿用David Lim，形象与剧本中的身份一致；若用户底图是另一角色，应先确认新的角色名/职务/公司以及是否替换演示角色。不得自行把该角色硬称为David。
- 学生以第一人称参与，MVP仅显示“你”的中性头像或身份标识，不必另做玩家可定制立绘。

## 2. 最小资产包

| 资产 | 数量 | 要求 |
| --- | ---: | --- |
| 平静 neutral | 1 | 常驻兜底；专注、礼貌、自信 |
| 思考 thinking | 1 | 轻微思索；不要夸张抓头 |
| 喜悦 pleased | 1 | 克制的认可/微笑；不是恋爱脸红 |
| 愤怒 frustrated | 1 | 商务上的不悦、严肃/警惕；不辱骂不威胁 |
| 疑惑 confused | 1 | 询问、需要澄清；不丑化角色 |
| 头像 portrait | 1 | 与neutral同源裁切，保留一致眼睛位置 |
| 背景 meeting-room-day | 1 | 固定商务会谈室，留出角色和台词区域；无品牌/无随机文字 |
| 轻动作 nod/head_tilt | 默认代码实现 | 基于固定立绘轻微变化，none为无动作；不要求15种组合图 |

如果简单图层变换不能令人信服，可增加1–2张专用“倾听/思考”姿态图，但应保持固定锚点，并在manifest中显式声明支持的组合；不支持的组合回退平静/无动作。

## 3. 图像格式与尺寸

这些是资产交付规格，不要假设生图工具原生保证完全相同的像素尺寸。

- 立绘源文件推荐1024×1536或等比例高分辨率PNG，透明背景；保留生成原件，标准化另存副本。
- 正式Web资产优先透明WebP，PNG作必要回退；画面压缩后检查脸部、发丝、手指、眼镜和边缘。
- 头像推荐256×256；由同一neutral图明确裁切，不独立重新生成人脸。
- 背景推荐横向约16:9高分辨率，至少准备可安全裁切的手机中心区域。
- 记录canvas尺寸、face_anchor、baseline_anchor、safe_crop。换表情时眼睛位置漂移目标≤画布宽度1%，身高/头部比例肉眼一致。
- 初始包压缩目标≤2MB，完整单角色包≤6MB；视觉质量不足时优先重新优化构图与编码，不接受糊脸。
- 无透明背景的图不能假装透明；出现杂边/白边/半透明光晕必须实看修复。

## 4. 目录与manifest

```text
content/simulation/assets/david-lim-business-v1/manifest.json
apps/web/public/simulation/david-lim-business-v1/
  character-neutral.webp
  character-thinking.webp
  character-pleased.webp
  character-frustrated.webp
  character-confused.webp
  portrait.webp
  meeting-room-day.webp
```

源图存项目约定的素材目录，不将大尺寸生成原件全部打进应用主包。真实头像/未批准底图不能未经说明用于公开部署。

示例manifest（占位hash须在制作后替换）：

```json
{
  "schema_version": "simulation.assets.v1",
  "pack_id": "david-lim-business",
  "version": "1.0.0",
  "approval_status": "draft",
  "character_id": "david-lim",
  "display_name": "David Lim",
  "default_expression": "neutral",
  "expressions": {
    "neutral": {"path": "character-neutral.webp", "sha256": "replace-with-real-hash"},
    "thinking": {"path": "character-thinking.webp", "sha256": "replace-with-real-hash"},
    "pleased": {"path": "character-pleased.webp", "sha256": "replace-with-real-hash"},
    "frustrated": {"path": "character-frustrated.webp", "sha256": "replace-with-real-hash"},
    "confused": {"path": "character-confused.webp", "sha256": "replace-with-real-hash"}
  },
  "portrait": "portrait.webp",
  "scenes": {"meeting-room-day": "meeting-room-day.webp"},
  "actions": ["none", "nod", "head_tilt"],
  "canvas": {"width": 1024, "height": 1536},
  "face_anchor": {"x": 0.5, "y": 0.24},
  "baseline_anchor": {"x": 0.5, "y": 1.0}
}
```

manifest由受信本地内容控制，LLM只能返回character_id/expression/action枚举。拒绝路径穿越、绝对URL、data URI和未登记资源；不从模型返回值下载图片。

## 5. 实际生图工作流

1. 读取当前可用imagegen技能，先查看用户底图，记录哪些视觉属性必须保留。
2. 对齐角色身份与素材用途；底图已明确时不要反复确认颜色、尺寸等可由规范决定的细节。
3. 保留用户原图，先生成/编辑一张neutral基准，让用户能够验看整体方向。
4. 以同一基准图生成其余表情。固定画布、镜头、身体姿势、服装与背景，只改表情。
5. 生成后保存原件与workspace中的交付副本；不覆盖用户底图。
6. 必要的图像编辑继续使用规定的imagegen工具，除非用户明确要求其他方式。编码压缩/打包可用常规工具，但不借此擅自重绘形象。
7. 制作五表情对照图，逐张检查并在应用舞台连续切换；检查电脑和手机截图。
8. 真正通过后更新approval_status与hash，绑定新的不可变asset pack version。旧包不覆盖，旧训练可回放。

尚无底图时：记录“等待底图”；用本地中性剪影完成工程。不要从网络随便找动漫人物替代，也不要让应用实时调用生图接口。

## 6. 可交给ImageGen的基准提示词模板

> 以所附参考图作为同一角色的身份与视觉基准，制作二维AVG商务谈判训练用的成年角色立绘。严格保持参考角色的脸型、五官、发型、服装、配饰、体型、镜头方向和画风。构图为大半身，身体位置稳定，正面或轻微侧身，视线朝向交谈者；透明背景，无文字、无水印、无额外人物。表情为平静、专注、专业、自信，适合长期停留在商务谈判界面。为后续表情变体保留统一画布与头部位置。

如果底图未提供透明背景，不擅自声称已有透明通道；实际输出后检查。

## 7. 表情变体提示词模板

> 编辑所附同一角色的neutral基准立绘。只改变面部表情为【目标表情】，保持人物身份、发型、衣着、身体姿势、手部位置、镜头、光线、构图、画布和透明背景完全一致。不要增加文字、符号、汗滴、愤怒漫画标记、脸红特效或额外道具。需要自然、克制、可用于专业商务会谈的表情变化。不得改变年龄或性别呈现，不得改变角色所属身份。

目标表情描述：

- thinking：眉眼略收，目光专注，正在衡量对方提出的交易条件。
- pleased：轻微真诚的认可微笑，表现出对互惠方案的积极反应。
- frustrated：眉眼严肃、嘴角收紧，表现出商务上的不悦与警惕，克制而不失礼。
- confused：眉头轻抬或略皱，表现出需要澄清含糊条款的疑惑。

## 8. 动作规范

- none：完全静止。
- nod：一次短促轻微点头的视觉示意；若只有静态图可采用≤2px轻位移/约1°转动，总时长180–260ms，必须实看是否自然。
- head_tilt：轻微倾斜后保持或复位，约1–2°，不做持续摇摆。
- 不宣称图层转动能替代真实头部动画；效果不自然就使用专用姿态或退回none。
- 表情交叉淡入120–180ms，稳定底层轮廓，避免换图闪白。
- 每轮至多一次明显动作。关闭动态效果时全部取消；不播放循环漂浮、弹跳或不断呼吸动画。

## 9. 资产验收清单

- [ ] 五张图肉眼可确认是同一个人，构图与锚点一致。
- [ ] 没有多指、穿帮、五官变化、衣服标识漂移、随机文字或水印。
- [ ] 表情区分明显但克制；正常还盘不会配侮辱性愤怒演出。
- [ ] 缩放到手机画面后五官仍清晰，字幕区不遮脸。
- [ ] 透明边缘在浅色/深色背景均无明显杂边。
- [ ] neutral/头像/背景均有合法文件、hash与版本；manifest不引用不存在文件。
- [ ] 图片失败时回退行为正确，无404死循环或无限重载。
- [ ] 五表情连续切换无明显身体跳动；慢网络只保留前图等待，不闪空白。
- [ ] 原图与生成原件保留，交付的是最终修订版。
- [ ] 人工验看记录存在；文件尺寸正确不代替审美验收。
