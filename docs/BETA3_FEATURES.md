# Beta 3 核心功能总结

**版本**: Beta 3 (开发中期)
**更新日期**: 2025年1月
**状态**: 开发中

---

## 版本亮点

Beta 3是AI外贸谈判助手的重大升级版本，核心特性聚焦在**语义网络知识图谱**、**智能语音交互**和**实战练习体验重塑**。

### 关键改进
1. **DAG风格知识图谱** - 引入有向无环图结构，支持心理语言学概念
2. **语音交互系统** - 完整的ASR+TTS+语音通话能力
3. **词汇网功能** - 基于语义网络的智能词汇建议
4. **实战界面重塑** - 接近真实阿里外贸软件体验
5. **知识点预计算** - 优化运行时性能，避免服务器负载
6. **AI辅助功能** - 邮件助手+聊天Copilot

---

## 核心功能模块

### 1. 语义网络知识图谱

#### DAG风格架构升级
Beta 3将知识图谱从普通图结构升级为DAG（有向无环图）风格，更好地表达知识的层次依赖关系。

```
普通图结构 → DAG风格
- 避免循环依赖
- 清晰的知识前置路径
- 支持拓扑排序学习路径
```

#### 心理语言学概念引入
引入语义网络理论，支持：
- **同族关系** - 词根相同的词汇关联
- **同类关系** - 语义类别相同的词汇
- **搭配关系** - 常见搭配组合

#### 新增节点类型

**SemanticClass（语义类别）**
```cypher
{
  id: String (UNIQUE),
  name: String,                   # 如"价格术语"、"时间表达"
  description: String,
  category: String,               # 分类领域
  examples: [String],             # 示例词汇
  createdAt: DateTime
}
```

**Slot（槽位节点）**
```cypher
{
  id: String (UNIQUE),
  type: String,                   # tone/civics/idiomatic
  name: String,                   # 槽位名称
  context: String,                # 适用上下文
  suggestions: [String],          # 替换建议列表
  createdAt: DateTime
}
```

#### 新增关系类型

| 关系 | 说明 | 属性 |
|------|------|------|
| `IN_CLASS` | 语义类别归属 | category, confidence |
| `FITS_SLOT` | 槽位匹配 | slotType, priority |
| `RELATED_TO` | 同族/同类/搭配 | relationType, strength |

#### 知识点预计算机制
```
教师上传理论内容
       ↓
系统自动预匹配知识点（后台任务）
       ↓
生成预计算索引
       ↓
学生访问时快速召回（<10ms）
```

**优势**：
- 避免学生每次阅读时实时计算
- 减轻服务器负载
- 提升响应速度

### 2. "词汇网"功能（Lexical Network）

#### 核心能力
基于心理语言学语义网络的词汇建议系统，为用户提供多维度的表达替代方案。

#### 三种建议类型

**1. 语气替换（Tone）**
```python
# 输入
"我们必须要求你方降价"

# 输出建议
{
  "softer": "我们希望能与贵方探讨价格优化的可能性",
  "neutral": "关于价格问题，我们期待进一步商议",
  "stronger": "价格调整是我方继续合作的前提条件"
}
```

**2. 思政元素（Civics）**
```python
# 支持的思政导向
- Win-Win (合作共赢)
- Integrity (诚信)
- Dignity (尊严)
- Compliance (合规)

# 示例
"我们只关心利润" → "我们追求互利共赢的长期合作关系"
```

**3. 地道性替换（Idiomatic）**
```python
# 输入（直译）
"Please give me a good price"

# 输出（地道表达）
"Could you offer us a competitive rate?"
"We'd appreciate your best offer"
```

#### 技术实现
```python
# services/lexical_suggestion_service.py

class LexicalSuggestionService:
    def get_suggestions(
        self,
        text: str,
        context_anchors: List[str],      # 相关知识点
        suggestion_types: List[str]       # tone/civics/idiomatic
    ) -> List[Suggestion]:
        # 1. 图谱召回（精确匹配）
        graph_results = self._query_neo4j(text)

        # 2. 向量召回（语义相似）
        vector_results = self._vector_search(text)

        # 3. 融合排序
        merged = self._merge_and_rank(graph_results, vector_results)

        return merged
```

#### API端点
```bash
POST /api/graph/lexical-suggestions
Content-Type: application/json

{
  "text": "请给我报价",
  "context_anchors": ["询盘", "价格谈判"],
  "suggestion_types": ["tone", "civics", "idiomatic"]
}

# 响应
{
  "suggestions": [
    {
      "type": "tone",
      "variant": "softer",
      "text": "能否请您提供参考报价？",
      "score": 0.92
    },
    {
      "type": "idiomatic",
      "text": "Could you kindly quote your best price?",
      "score": 0.88
    }
  ]
}
```

### 3. 语音交互系统

#### 语音识别（ASR）

**技术栈**：DashScope语音识别服务

**两种模式**：

**1. 文件上传转写**
```bash
POST /api/asr/transcribe
Content-Type: multipart/form-data

file: (audio file)

# 响应
{
  "text": "Hello, I would like to inquire about your products.",
  "confidence": 0.95
}
```

**2. WebSocket流式识别**
```javascript
// 前端连接
const ws = new WebSocket('ws://localhost:5000/api/asr/stream');

ws.onopen = () => {
  // 发送音频流（PCM格式）
  ws.send(audioChunk);
};

ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  // result.text: 实时转写文本
  // result.isFinal: 是否为最终结果
};
```

**特性**：
- 实时流式转写
- 语义标点自动添加
- PCM格式处理优化
- 支持中英文混合

#### 语音合成（TTS）

**技术栈**：DashScope qwen3-tts-flash-realtime

**API端点**：
```bash
POST /api/tts/synthesize
Content-Type: application/json

{
  "text": "Thank you for your inquiry. Our FOB price is $100 per unit.",
  "voice": "Ryan"  # Ryan/Cherry/Jennifer等
}

# 响应
Content-Type: audio/wav
(二进制音频流)
```

**音色选项**：
| 音色 | 性别 | 语言 | 风格 |
|------|------|------|------|
| Ryan | 男 | 英语 | 商务 |
| Cherry | 女 | 英语 | 温和 |
| Jennifer | 女 | 英语 | 专业 |
| 更多... | - | - | - |

**技术细节**：
- 24kHz采样率
- 16bit单声道
- PCM转WAV格式
- 流式合成支持

#### 语音通话模式

**工作流程**：
```
1. 用户点击语音模式按钮
       ↓
2. 进入语音通话界面
       ↓
3. 按住录音按钮说话
       ↓
4. 松开后ASR转写
       ↓
5. 发送消息给AI
       ↓
6. AI回复可选TTS播放
       ↓
7. 点击挂断结束通话
```

**UI特性**：
- 手动发送按钮（可控发送时机）
- 拖动操作支持
- 挂断功能
- 状态显示优化
- 接听提示动画

### 4. 实战练习界面重塑

#### Review Mode（单证审查模式）

新增单证审查练习模式，模拟真实的外贸单证审核流程：

```
场景生成
   ↓
展示待审核单证
   ↓
学生标注问题点
   ↓
AI即时反馈
   ↓
评估打分
```

**支持的单证类型**：
- 商业发票 (Commercial Invoice)
- 装箱单 (Packing List)
- 提单 (Bill of Lading)
- 信用证 (Letter of Credit)
- 产地证 (Certificate of Origin)

#### 界面重塑

将实战练习界面升级为接近真实阿里外贸软件的体验：

**布局变化**：
```
Beta 2:                     Beta 3:
┌─────────────────┐        ┌──────────┬────────┐
│   聊天区域       │        │ 聊天区域  │ 信息栏  │
│                 │   →    │          │ (客户)  │
│                 │        │          │ (产品)  │
│─────────────────│        │──────────│ (订单)  │
│   输入框        │        │ 输入框   │ (知识)  │
└─────────────────┘        └──────────┴────────┘
```

**新增元素**：
- 客户信息面板
- 产品详情展示
- 订单状态追踪
- 知识点实时匹配

#### 即时评估体验重塑

```
旧方案（同步）:
用户结束会话 → 等待完整评估 → 显示结果（3-5秒）

新方案（SSE分离）:
用户结束会话 → 先显示分数（<1秒）→ 逐步显示详情
```

**SSE事件流**：
```javascript
// 事件1：分数
event: score
data: {"score": 85, "grade": "B+"}

// 事件2：详情
event: detail
data: {"suggestions": [...], "knowledge_points": [...]}
```

### 5. AI辅助功能

#### 邮件助手

**API端点**：`POST /api/ai/email/assist`

**功能**：
1. **草稿生成** - 根据场景上下文生成邮件草稿
2. **润色优化** - 优化现有邮件的表达

```python
# 草稿生成
{
  "action": "draft",
  "context": "回复客户关于FOB报价的询盘",
  "scenario_info": {
    "product": "儿童玩具",
    "customer": "ABC Trading Co.",
    "stage": "报价"
  }
}

# 润色优化
{
  "action": "polish",
  "content": "Dear customer, price is 100 USD.",
  "style": "formal"  # formal/friendly/concise
}
```

#### 聊天Copilot

**API端点**：`POST /api/ai/chat/copilot`

**功能**：
- 实时谈判建议
- 策略推荐
- 风险提示

```python
# 请求
{
  "session_id": "xxx",
  "message": "对方要求降价10%，同时增加订单量",
  "stream": true
}

# 流式响应
data: {"type": "suggestion", "content": "可以考虑..."}
data: {"type": "strategy", "content": "建议采用..."}
data: {"type": "warning", "content": "注意风险..."}
```

### 6. 知识点召回增强

#### 快速本地检索

优化知识点匹配速度，实现毫秒级召回：

```python
# services/embedding_service.py

class EmbeddingService:
    def __init__(self):
        self._model_cache = {}  # 多模型缓存

    def get_embedding(self, text: str, model_name: str = None):
        model = self._get_or_load_model(model_name)
        embedding = model.encode(text, normalize_embeddings=True)
        return self._clean_embedding(embedding)  # NaN/Inf处理
```

#### 多模型嵌入缓存

支持多种嵌入模型的热切换：

| 模型 | 维度 | 语言 | 场景 |
|------|------|------|------|
| paraphrase-multilingual-MiniLM-L12-v2 | 384 | 多语言 | 默认 |
| shibing624/text2vec-base-chinese | 768 | 中文 | 中文优化 |
| all-MiniLM-L6-v2 | 384 | 英文 | 英文场景 |

#### Reranker服务

```python
# services/reranker_service.py

class RerankerService:
    def rerank(
        self,
        query: str,
        candidates: List[str],
        top_k: int = 5
    ) -> List[RankedResult]:
        # 基于交叉编码器的重排序
        scores = self.model.predict([(query, c) for c in candidates])
        return sorted(zip(candidates, scores), key=lambda x: -x[1])[:top_k]
```

#### 召回限制优化

- 默认召回5条高相关知识点
- 过滤不相关节点
- 支持来源区分（AI识别 vs 关键字识别）

### 7. 教师工作台增强

#### 学生分析功能

**知识标签标准化**：
```python
# 标准化处理
raw_tag = "fob、FOB、F.O.B."
normalized = "FOB"  # 统一格式
```

**学生状态判定**：
```python
# 状态枚举
STUDENT_STATUS = {
    "active": "活跃",      # 最近7天有活动
    "normal": "正常",      # 最近30天有活动
    "inactive": "不活跃",  # 超过30天无活动
    "at_risk": "需关注"    # 成绩下降趋势
}
```

**学习进度颜色标识**：
```css
.progress-excellent { color: #22c55e; }  /* 绿色 - 优秀 */
.progress-good { color: #3b82f6; }       /* 蓝色 - 良好 */
.progress-warning { color: #f59e0b; }    /* 橙色 - 需提升 */
.progress-danger { color: #ef4444; }     /* 红色 - 落后 */
```

#### 学生列表增强

**筛选功能**：
- 按状态筛选（活跃/正常/不活跃）
- 按班级筛选
- 按进度区间筛选

**排序功能**：
- 按学习进度排序
- 按最后活跃时间排序
- 按平均分排序

**搜索功能**：
- 按学号搜索
- 按姓名搜索

#### 数据可视化增强

**学习趋势图表**：
```javascript
// 每周表现变化折线图
const chartData = {
  labels: ['第1周', '第2周', '第3周', '第4周'],
  datasets: [{
    label: '平均分',
    data: [65, 72, 78, 85]
  }, {
    label: '完成率',
    data: [40, 55, 70, 80]
  }]
};
```

**行为热点渲染**：
```
访问时间热力图:
     周一  周二  周三  周四  周五  周六  周日
08:00  ○    ○    ●    ●    ○    ○    ○
14:00  ●    ●    ●    ●    ●    ○    ○
20:00  ●    ●    ●    ●    ●    ●    ○

● 高频访问  ○ 低频/无访问
```

**知识薄弱点分析**：
```python
# 识别薄弱知识点
weak_points = [
    {"name": "信用证条款", "score": 45, "attempts": 3},
    {"name": "FOB成本计算", "score": 52, "attempts": 2},
]
```

---

## 技术架构升级

### 新增服务模块

| 服务 | 文件 | 职责 |
|------|------|------|
| LexicalSuggestionService | lexical_suggestion_service.py (21KB) | 词汇网建议 |
| EmbeddingService | embedding_service.py (2.2KB) | 多模型嵌入 |
| RerankerService | reranker_service.py (1.7KB) | 结果重排序 |

### 新增路由模块

| 路由 | 文件 | 端点 |
|------|------|------|
| ASR | asr.py (6.6KB) | /api/asr/* |
| TTS | tts.py (4.1KB) | /api/tts/* |
| Assistants | assistants.py (8KB) | /api/ai/* |

### 依赖升级

```python
# requirements.txt 新增
dashscope>=1.14.0          # 阿里云语音服务
sentence-transformers>=2.2 # 向量嵌入
scipy>=1.10                # 向量计算
websockets>=11.0           # WebSocket支持
```

### 前端架构

**新增Vite+React模板**：
```
foreign-trade/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   └── assets/
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 性能指标

### 知识点召回性能
```
指标                    Beta 2        Beta 3
首次加载嵌入模型        8s            8s (仅首次)
后续召回延迟           200ms          <50ms (缓存命中)
批量召回(100条)        3s             500ms
```

### 语音处理性能
```
指标                    目标值         实际值
ASR首字延迟            <500ms        ~300ms
ASR转写准确率          >95%          ~96%
TTS首字延迟            <300ms        ~200ms
TTS合成速度            >实时         2x实时
```

### 接口响应时间
```
端点                              平均响应时间
GET /api/graph/lexical-suggestions    150ms
POST /api/asr/transcribe              1.5s (视音频长度)
POST /api/tts/synthesize              500ms
POST /api/ai/email/assist             2s
POST /api/ai/chat/copilot (stream)    首字符 200ms
```

---

## 配置要求

### 新增环境变量
```bash
# DashScope语音服务
DASHSCOPE_API_KEY=sk-xxx

# 嵌入模型配置
EMBEDDING_MODEL=paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_CACHE_DIR=./models

# 词汇网配置
LEXICAL_VECTOR_THRESHOLD=0.7
LEXICAL_MAX_SUGGESTIONS=10
```

### 硬件建议
```
最低配置:
- CPU: 4核
- 内存: 8GB
- 磁盘: 20GB (含模型缓存)

推荐配置:
- CPU: 8核
- 内存: 16GB
- 磁盘: 50GB SSD
- GPU: 可选 (加速嵌入计算)
```

---

## Beta 2 → Beta 3 对比总结

| 维度 | Beta 2 | Beta 3 | 提升 |
|------|--------|--------|------|
| 知识图谱架构 | 普通图 | DAG+语义网络 | 结构化 |
| 节点类型 | 8种 | 10种 | +25% |
| 关系类型 | 12种 | 15+种 | +25% |
| 语音交互 | 无 | ASR+TTS+通话 | **全新** |
| 词汇建议 | 无 | 词汇网 | **全新** |
| AI辅助 | 无 | 邮件+Copilot | **全新** |
| 实战界面 | 基础 | 真实体验 | 重塑 |
| 知识点匹配 | 运行时 | 预计算 | 10x |
| 嵌入模型 | 单一 | 多模型缓存 | 灵活 |
| 学生分析 | 基础 | 趋势+热点 | 增强 |

---

## 下一步发展

### 近期（Beta 3后期）
- [ ] 语音识别准确率优化
- [ ] 词汇网扩展更多词汇对
- [ ] 实战界面移动端适配
- [ ] Copilot策略库扩充

### 中期（Beta 4规划）
- [ ] 多轮语音对话支持
- [ ] 知识图谱自动扩展
- [ ] 个性化学习路径推荐
- [ ] 教师协作编辑功能

详见 [TODO.md](TODO.md)

---

**版本**: Beta 3 (开发中期)
**文档更新日期**: 2025-01-07
**维护者**: 项目组
