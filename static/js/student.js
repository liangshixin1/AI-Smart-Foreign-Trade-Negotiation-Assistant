// -------------------- 学生端全局状态 --------------------
// ==================== 演示专用：加载动画控制器 ====================
const LoadingFX = {
  timer: null,
  progress: 0,
  logs: [
    "正在调研全球行业数据库 (Global Trade Data)...",
    "正在分析目标市场背景...",
    "生成虚拟公司档案：TechNova Solutions...",
    "正在构建产品参数表与报价策略...",
    "生成物流条款与风险模型 (Incoterms 2020)...",
    "正在拟定谈判目标与对手心理画像...",
    "生成开场话术与初始邮件草稿...",
    "识别与植入潜在谈判障碍点 (Pain Points) 与解决方案...",
    "生成备选谈判情景剧本...",
    "合规与风险条款自动审查...",
    "模拟多轮对话策略树与底线推演...",
    "思考中...",
    "整合信息中...",
    "最终完整性校验...",
  ],
  start: function () {
    const overlay = document.getElementById("loading-overlay");
    const bar = document.getElementById("progress-bar");
    const logEl = document.getElementById("log-text");
    if (!overlay) return;

    overlay.classList.remove("hidden");
    this.progress = 0;
    let logIndex = 0;

    if (logEl) {
      const initial = this.logs[0] || "系统启动中...";
      logEl.innerText = `> ${initial}`;
      logIndex = 1;
    }

    if (bar) bar.style.width = "0%";

    if (this.timer) clearInterval(this.timer);

    this.timer = setInterval(() => {
      if (this.progress < 40) this.progress += 1.5;
      else if (this.progress < 70) this.progress += 0.4;
      else if (this.progress < 95) this.progress += 0.1;

      if (bar) bar.style.width = `${this.progress}%`;

      if (this.progress > 5 && Math.floor(this.progress * 10) % 120 === 0) {
        if (logEl && logIndex < this.logs.length) {
          logEl.innerText = `> ${this.logs[logIndex++]}`;
        }
      }
    }, 50);
  },
  finish: function () {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.progress = 100;
    const bar = document.getElementById("progress-bar");
    const logEl = document.getElementById("log-text");
    const overlay = document.getElementById("loading-overlay");

    if (bar) bar.style.width = "100%";
    if (logEl) logEl.innerText = "> 场景构建完成！";

    setTimeout(() => {
      if (overlay) overlay.classList.add("hidden");
    }, 600);
  },
};

// ==================== 演示专用：硬编码兜底数据 ====================
// 万一后端挂了，直接用这个渲染，保证演示不翻车
const DEMO_FALLBACK_SCENARIO = {
  title: "第 4 章 · 实战：智能手表出口谈判",
  scenario_title: "第 4 章 · 实战：智能手表出口谈判",
  summary:
    "买家 Smith 代表英国头部电子零售商，急需采购一批智能运动手表（IP68 防水）。但他对价格极其敏感，且要求 D/P 付款。",
  scenario_summary:
    "买家 Smith 代表英国头部电子零售商，急需采购一批智能运动手表（IP68 防水）。但他对价格极其敏感，且要求 D/P 付款。",
  studentRole: "李明（销售经理）",
  student_role: "李明（销售经理）",
  studentCompany: {
    name: "Shenzhen TechWear Co., Ltd.",
    profile: "智能穿戴制造商",
  },
  student_company: {
    name: "Shenzhen TechWear Co., Ltd.",
    profile: "智能穿戴制造商",
  },
  aiRole: "David Smith (Purchasing Manager)",
  ai_role: "David Smith (Purchasing Manager)",
  aiCompany: {
    name: "UK Gadget World",
    profile: "UK electronics retailer",
  },
  ai_company: {
    name: "UK Gadget World",
    profile: "UK electronics retailer",
  },
  product: {
    name: "Smart Watch Model-X",
    specifications: "IP68 Waterproof, 14-day battery life",
    quantity_requirement: "5000 pcs",
    price_expectation: {
      student_target: "$23 FOB Shenzhen",
      ai_bottom_line: "$18 D/P",
    },
  },
  negotiationTargets: [
    "引导买方接受 30% 预付款 + 70% T/T",
    "争取将价格稳定在 $23 以内",
    "强调防水与续航的差异化优势",
  ],
  risks: ["D/P 付款风险过高", "交期压缩导致产能紧张", "价格锚定过低"],
  checklist: ["确认付款方式", "明确交期", "锁定质保条款"],
  difficultyLabel: "展示版",
  difficultyDescription: "快节奏 · 价格敏感",
  communicationTone: "理性务实",
  openingMessage:
    "Hello, I've reviewed your catalog. The Model-X looks promising, but your price of $25 is way above our budget for this quantity.",
  opening_message:
    "Hello, I've reviewed your catalog. The Model-X looks promising, but your price of $25 is way above our budget for this quantity.",
  backgroundSessions: [],
  background_sessions: [],
};
// 能力雷达图实例
let abilityRadarChart = null;
// 学生弹窗当前激活的 tab（会话/作业/账号等）
let currentStudentModalTab = null;
// 体验模块：聊天/复盘/理论等当前展示的区域
let activeExperienceModule = "chat";
// 情景描述区域是否收起
let isScenarioCollapsed = false;
// AI 推荐阈值分数
const RECOMMENDATION_SCORE_THRESHOLD = 80;
// 异步请求防抖 token，确保最新结果覆盖旧请求
let theoryRelatedRequestToken = 0;
let evaluationRecommendationToken = 0;
let lexicalSuggestionTimer = null;
let lexicalSuggestionAbortController = null;
// Scenario briefing 窗口状态（拖拽偏移/最小化）
const scenarioWindowDrag = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
let scenarioWindowMinimized = false;
let scenarioDrawerHideTimer = null;
let evaluationPanelOpen = false;
let evaluationPanelHideTimer = null;
// 学生端理论图谱实例
let studentLessonGraphInstance = null;
// Copilot Agent 连续推理是否运行中
let copilotAgentRunning = false;
let copilotPanelOpen = false;
let copilotMobileHideTimer = null;
const copilotDrag = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
// 需要启用“复盘模式”的章节集合
const REVIEW_SECTION_IDS = new Set([
  "chapter-4-section-1",
  "chapter-4-section-2",
  "chapter-4-section-5",
  "chapter-5-section-4",
  "chapter-6-section-1",
]);
const AVATAR_COLORS = ["#2563eb", "#0ea5e9", "#8b5cf6", "#f97316", "#0ea5a6"];
const SCORE_RING_LENGTH = 339.292; // 2 * Math.PI * r (r=54)
let evaluationSpinValue = 0;

// Fallback DOM refs (防止未定义报错)：若页面未注入对应元素，使用安全的备用获取方式。
const theoryCompassSection = typeof window !== "undefined" && window.theoryCompassSection ? window.theoryCompassSection : document.getElementById("theory-knowledge-compass");
const theoryCompassStatus = typeof window !== "undefined" && window.theoryCompassStatus ? window.theoryCompassStatus : document.getElementById("theory-knowledge-compass-status");
const theoryCompassList = typeof window !== "undefined" && window.theoryCompassList ? window.theoryCompassList : document.getElementById("theory-knowledge-compass-list");
const studentLessonGraph = typeof window !== "undefined" && window.studentLessonGraph ? window.studentLessonGraph : document.getElementById("student-lesson-graph");
const studentLessonGraphRefresh = typeof window !== "undefined" && window.studentLessonGraphRefresh ? window.studentLessonGraphRefresh : document.getElementById("student-lesson-graph-refresh");

// 章节/关卡排序与展示文本规范化：处理序号、绪论、章节标题等。
function sortLevelHierarchy(chapters) {
  if (!Array.isArray(chapters)) {
    return [];
  }

  const collator =
    typeof Intl !== "undefined" && typeof Intl.Collator === "function"
      ? new Intl.Collator("zh-Hans-CN", { numeric: true, sensitivity: "base" })
      : null;

  const normalizeOrderIndex = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  const compareTitle = (aTitle, bTitle) => {
    const left = (aTitle || "").toString();
    const right = (bTitle || "").toString();
    if (collator) {
      return collator.compare(left, right);
    }
    return left.localeCompare(right);
  };

  const isPrologueChapter = (chapter) => {
    if (!chapter) {
      return false;
    }
    if (typeof chapter.isPrologue === "boolean") {
      return chapter.isPrologue;
    }
    const id = (chapter.id || "").toString();
    if (/^chapter-0\b/.test(id)) {
      return true;
    }
    const title = (chapter.title || "").toString().trim();
    return /^绪论/.test(title);
  };

  const cleanAfterPrefix = (text, pattern) => {
    if (typeof text !== "string") {
      return "";
    }
    const stripped = text.replace(pattern, "");
    return stripped.replace(/^[·•∙・:：\-—\s]+/, "").trim();
  };

  const deriveChapterPresentation = (chapter, ordinal, prologueFlag) => {
    const safeTitle = (chapter.title || "").toString().trim();
    const subtitleFromDescription =
      typeof chapter.description === "string" && chapter.description.trim() !== ""
        ? chapter.description.trim()
        : "";
    const ordinalLabel = `第 ${ordinal} 章`;
    const prologueRemainder = cleanAfterPrefix(safeTitle, /^绪论/);
    const numberedRemainder = cleanAfterPrefix(safeTitle, /^第\s*\d+\s*章/);

    let theme = safeTitle;
    if (prologueFlag) {
      theme = "绪论";
    } else if (numberedRemainder !== "") {
      theme = numberedRemainder;
    } else if (prologueRemainder !== "") {
      theme = prologueRemainder;
    }

    const displayTitle = `${ordinalLabel} · ${theme || "章节"}`;
    const fallbackSubtitle = prologueFlag ? prologueRemainder : "";
    const displaySubtitle = subtitleFromDescription || fallbackSubtitle;

    return {
      displayTitle,
      displaySubtitle,
    };
  };

  const compareItems = (a, b) => {
    const orderDiff = normalizeOrderIndex(a && a.orderIndex) - normalizeOrderIndex(b && b.orderIndex);
    if (orderDiff !== 0) {
      return orderDiff;
    }
    return compareTitle(a && a.title, b && b.title);
  };

  const sortedChapters = chapters
    .map((chapter) => {
      const nextChapter = { ...chapter };
      const sections = Array.isArray(chapter.sections) ? [...chapter.sections] : [];
      sections.sort(compareItems);
      nextChapter.sections = sections;
      return nextChapter;
    })
    .sort(compareItems);

  const movePrologueToFront = (list) => {
    const prologueIndex = list.findIndex((chapter) => isPrologueChapter(chapter));
    if (prologueIndex <= 0) {
      return list;
    }
    const reordered = [...list];
    const [prologue] = reordered.splice(prologueIndex, 1);
    reordered.unshift(prologue);
    return reordered;
  };

  let ordinal = 1;
  return movePrologueToFront(sortedChapters).map((chapter) => {
    const nextChapter = { ...chapter };
    const prologueFlag = isPrologueChapter(nextChapter);
    const presentation = deriveChapterPresentation(nextChapter, ordinal, prologueFlag);
    nextChapter.displayOrdinal = ordinal;
    nextChapter.displayTitle = presentation.displayTitle;
    nextChapter.displaySubtitle = presentation.displaySubtitle;
    ordinal += 1;
    return nextChapter;
  });
}

const hasMarked = typeof window !== "undefined" && typeof window.marked !== "undefined";
if (hasMarked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

// 基础 HTML 转义，防止 Markdown 渲染时注入。
function escapeHtml(text) {
  if (typeof text !== "string") {
    return "";
  }
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Markdown 渲染：优先使用 marked + DOMPurify，回退为转义文本。
function renderMarkdown(text) {
  const safeText = typeof text === "string" ? text : "";
  if (hasMarked && typeof window.DOMPurify !== "undefined") {
    const rendered = window.marked.parse(safeText);
    return window.DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
  }
  return escapeHtml(safeText).replace(/\n/g, "<br />");
}

function isMobileViewport() {
  return window.innerWidth <= 768;
}








// 控制全局 loading 遮罩显隐。
function toggleLoading(isLoading) {
  if (isLoading) {
    loadingPanel.classList.remove("hidden");
  } else {
    loadingPanel.classList.add("hidden");
  }
}

// 控制即时反馈区域的加载态。
function setEvaluationLoading(isLoading) {
  if (isLoading) {
    startEvaluationSpin();
  } else {
    stopEvaluationSpin();
  }
}

// 生成首字母头像文本。
function getInitials(text) {
  if (!text || typeof text !== "string") return "AI";
  const parts = text.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// 根据名称选择稳定的商务色盘背景。
function pickAvatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

// 模拟客户本地时间。
function simulateClientTime() {
  const now = new Date();
  const offsetHours = Math.floor(Math.random() * 12) - 4; // -4 ~ +7 小时
  const simulated = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return formatter.format(simulated);
}

function updateChatHeader(name, role) {
  if (!chatClientNameEl || !chatClientInitialsEl || !chatClientAvatarEl) return;
  const displayName = role || name || "Client";
  chatClientNameEl.textContent = displayName;
  chatClientInitialsEl.textContent = getInitials(displayName);
  chatClientAvatarEl.style.backgroundColor = pickAvatarColor(displayName);
  const timeLabel = simulateClientTime();
  if (chatClientTimeEl) {
    chatClientTimeEl.textContent = `Local Time: ${timeLabel}`;
  }
  if (chatClientStatusEl) {
    chatClientStatusEl.textContent = "● Online";
  }
}

function openScenarioDrawer() {
  if (!scenarioDrawerOverlay || !scenarioDrawer) return;
  if (scenarioDrawerHideTimer) {
    clearTimeout(scenarioDrawerHideTimer);
    scenarioDrawerHideTimer = null;
  }
  scenarioDrawerOverlay.classList.remove("hidden");
  scenarioDrawer.classList.toggle("minimized", scenarioWindowMinimized);
  if (isMobileViewport()) {
    scenarioWindowDrag.offsetX = 0;
    scenarioWindowDrag.offsetY = 0;
    scenarioDrawerOverlay.classList.add("scenario-mobile-open");
    scenarioDrawerOverlay.classList.remove("scenario-mobile-closing");
    scenarioDrawer.style.transform = "";
    return;
  }
  scenarioDrawerOverlay.classList.remove("scenario-mobile-open", "scenario-mobile-closing");
  scenarioDrawer.style.transform = `translate(${scenarioWindowDrag.offsetX}px, ${scenarioWindowDrag.offsetY}px)`;
}

function closeScenarioDrawer() {
  if (!scenarioDrawerOverlay || !scenarioDrawer) return;
  scenarioDrawer.classList.remove("scenario-drawer--dragging");
  if (isMobileViewport()) {
    scenarioDrawerOverlay.classList.remove("scenario-mobile-open");
    scenarioDrawerOverlay.classList.add("scenario-mobile-closing");
    scenarioDrawer.style.transform = "";
    if (scenarioDrawerHideTimer) {
      clearTimeout(scenarioDrawerHideTimer);
    }
    scenarioDrawerHideTimer = setTimeout(() => {
      scenarioDrawerOverlay.classList.add("hidden");
      scenarioDrawerOverlay.classList.remove("scenario-mobile-closing");
      scenarioDrawerHideTimer = null;
    }, 280);
    return;
  }
  scenarioDrawerOverlay.classList.add("hidden");
}

function openEvaluationPanelDrawer() {
  if (!evaluationPanel) return;
  if (evaluationPanelHideTimer) {
    clearTimeout(evaluationPanelHideTimer);
    evaluationPanelHideTimer = null;
  }
  evaluationPanel.classList.remove("hidden", "evaluation-panel--closing");
  if (isMobileViewport()) {
    evaluationPanel.classList.add("evaluation-panel--open");
  }
  evaluationPanelOpen = true;
}

function closeEvaluationPanelDrawer() {
  if (!evaluationPanel) return;
  evaluationPanelOpen = false;
  if (isMobileViewport()) {
    evaluationPanel.classList.remove("evaluation-panel--open");
    evaluationPanel.classList.add("evaluation-panel--closing");
    if (evaluationPanelHideTimer) {
      clearTimeout(evaluationPanelHideTimer);
    }
    evaluationPanelHideTimer = setTimeout(() => {
      evaluationPanel.classList.add("hidden");
      evaluationPanel.classList.remove("evaluation-panel--closing");
      evaluationPanelHideTimer = null;
    }, 280);
  } else {
    evaluationPanel.classList.add("hidden");
  }
}

function toggleScenarioDrawerMinimize() {
  if (!scenarioDrawer) return;
  scenarioWindowMinimized = !scenarioWindowMinimized;
  scenarioDrawer.classList.toggle("minimized", scenarioWindowMinimized);
}

function resetScenarioWindowTransform() {
  scenarioWindowDrag.offsetX = 0;
  scenarioWindowDrag.offsetY = 0;
  if (scenarioDrawer) {
    scenarioDrawer.style.transform = "translate(0px, 0px)";
  }
}

function initScenarioWindowDrag() {
  if (!scenarioDrawer) return;
  const handles =
    (scenarioDragHandles && scenarioDragHandles.length && Array.from(scenarioDragHandles)) ||
    [scenarioDrawer];
  const onPointerMove = (event) => {
    if (!scenarioWindowDrag.active) return;
    const point = event.touches ? event.touches[0] : event;
    const dx = point.clientX - scenarioWindowDrag.startX;
    const dy = point.clientY - scenarioWindowDrag.startY;
    scenarioWindowDrag.offsetX += dx;
    scenarioWindowDrag.offsetY += dy;
    scenarioWindowDrag.startX = point.clientX;
    scenarioWindowDrag.startY = point.clientY;
    scenarioDrawer.style.transform = `translate(${scenarioWindowDrag.offsetX}px, ${scenarioWindowDrag.offsetY}px)`;
  };
  const onPointerEnd = () => {
    scenarioWindowDrag.active = false;
    scenarioDrawer.classList.remove("scenario-drawer--dragging");
  };
  const onPointerStart = (event) => {
    if (window.innerWidth <= 768) return;
    if (event.type === "mousedown" && event.button !== 0) return;
    if (
      event.target.closest(
        "button, input, textarea, select, option, a, label, [contenteditable='true']",
      )
    ) {
      return;
    }
    const point = event.touches ? event.touches[0] : event;
    scenarioWindowDrag.active = true;
    scenarioWindowDrag.startX = point.clientX;
    scenarioWindowDrag.startY = point.clientY;
    scenarioDrawer.classList.add("scenario-drawer--dragging");
  };
  handles.forEach((handle) => {
    handle.addEventListener("mousedown", onPointerStart);
    handle.addEventListener("touchstart", onPointerStart, { passive: true });
  });
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("touchmove", onPointerMove, { passive: true });
  document.addEventListener("mouseup", onPointerEnd);
  document.addEventListener("touchend", onPointerEnd);
  document.addEventListener("touchcancel", onPointerEnd);
}

function ensureSessionState() {
  if (!state.sessionMessages || !(state.sessionMessages instanceof Map)) {
    state.sessionMessages = new Map();
  }
  if (!state.sessionDeck || !Array.isArray(state.sessionDeck)) {
    state.sessionDeck = [];
  }
  if (!state.unreadSessions || !(state.unreadSessions instanceof Set)) {
    state.unreadSessions = new Set();
  }
  if (!state.simulatedSessions || !(state.simulatedSessions instanceof Set)) {
    state.simulatedSessions = new Set();
  }
}

function renderSessionRail() {
  if (!sessionListEl) return;
  ensureSessionState();
  sessionListEl.innerHTML = "";
  if (!state.sessionDeck || state.sessionDeck.length === 0) {
    const empty = document.createElement("div");
    empty.className = "px-4 py-6 text-sm text-slate-500";
    empty.textContent = "暂无会话，进入关卡后自动生成。";
    sessionListEl.appendChild(empty);
    return;
  }
  state.sessionDeck.forEach((session) => {
    const button = document.createElement("button");
    const isActive = state.activeSessionId === session.id;
    const isUnread = state.unreadSessions && state.unreadSessions.has(session.id);
    button.type = "button";
    button.className =
      "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-100" +
      (isActive ? " bg-emerald-50" : "");
    const avatar = document.createElement("div");
    avatar.className =
      "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold text-white";
    avatar.style.backgroundColor = pickAvatarColor(session.role || session.title);
    avatar.textContent = getInitials(session.role || session.title);
    button.appendChild(avatar);
    const meta = document.createElement("div");
    meta.className = "flex-1 min-w-0";
    const title = document.createElement("p");
    title.className = "truncate text-sm font-semibold text-slate-900";
    title.textContent = session.title || session.role || "会话";
    meta.appendChild(title);
    const subtitle = document.createElement("p");
    subtitle.className = "truncate text-xs text-slate-500";
    subtitle.textContent = session.role || session.title || "";
    meta.appendChild(subtitle);
    button.appendChild(meta);
    if (isUnread) {
      const badge = document.createElement("span");
      badge.className = "h-2 w-2 rounded-full bg-rose-500";
      button.appendChild(badge);
    }
    button.addEventListener("click", () => {
      activateSession(session.id);
    });
    sessionListEl.appendChild(button);
  });
}

function setChatInputAvailability(enabled) {
  if (chatInputEl) chatInputEl.disabled = !enabled;
  if (sendMessageBtn) sendMessageBtn.disabled = !enabled;
}

function activateSession(sessionId) {
  ensureSessionState();
  state.activeSessionId = sessionId;
  const messagesForSession =
    (state.sessionMessages && state.sessionMessages.get(sessionId)) || state.messages || [];
  state.messages = messagesForSession;
  if (state.unreadSessions) {
    state.unreadSessions.delete(sessionId);
  }
  renderChat();
  renderSessionRail();
  const isLive = sessionId === state.sessionId;
  setChatInputAvailability(isLive);
  if (!isLive) {
    evaluationScoreEl.textContent = "--";
    updateScoreRing(0, "#cbd5e1");
    if (evaluationScoreLabelEl) evaluationScoreLabelEl.textContent = "仅实时会话可用";
    if (evaluationCommentaryEl) {
      evaluationCommentaryEl.textContent = "模拟会话仅展示消息，不参与打分。";
    }
    if (evaluationActionsEl) evaluationActionsEl.innerHTML = "";
    if (evaluationKnowledgeEl) evaluationKnowledgeEl.innerHTML = "";
  }
}

function seedSessionDeck(mainSessionId, scenario) {
  ensureSessionState();
  state.sessionDeck = [];
  state.sessionMessages = new Map();
  state.simulatedSessions = new Set();
  state.unreadSessions = new Set();

  const main = {
    id: mainSessionId,
    title: (scenario && (scenario.title || scenario.summary)) || "主会话",
    role: (scenario && scenario.aiRole) || "Client",
    simulated: false,
  };
  state.sessionDeck.push(main);
  state.sessionMessages.set(mainSessionId, state.messages || []);

  const backgrounds = Array.isArray(scenario?.backgroundSessions) ? scenario.backgroundSessions : [];
  backgrounds.forEach((item, index) => {
    const simId = item.id || `sim-${Date.now()}-${index}`;
    const session = {
      id: simId,
      title: item.title || `侧边会话 ${index + 1}`,
      role: item.aiRole || item.role || "关联联系人",
      simulated: true,
      openingMessage: item.openingMessage || "同步中...",
    };
    state.sessionDeck.push(session);
    state.simulatedSessions.add(simId);
    state.unreadSessions.add(simId);
    state.sessionMessages.set(simId, [
      { role: "assistant", content: session.openingMessage },
    ]);
  });

  state.activeSessionId = mainSessionId;
  renderSessionRail();
}

// 数字滚动动画，用于即时反馈的分数/胜率。
function animateEvaluationScore(targetValue, { isPercent = false, duration = 900 } = {}) {
  if (!evaluationScoreEl) return;
  const end = Number(targetValue);
  if (!Number.isFinite(end)) {
    evaluationScoreEl.textContent = isPercent && targetValue !== undefined && targetValue !== null
      ? `${targetValue}%`
      : "--";
    evaluationScoreEl.dataset.value = "0";
    return;
  }
  const start = Number(evaluationScoreEl.dataset.value);
  const from = Number.isFinite(start) ? start : 0;
  const startTime = performance.now();

  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const current = from + (end - from) * progress;
    const display = Math.round(current);
    evaluationScoreEl.textContent = isPercent ? `${display}%` : `${display}`;
    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      evaluationScoreEl.textContent = isPercent ? `${Math.round(end)}%` : `${Math.round(end)}`;
      evaluationScoreEl.dataset.value = String(end);
    }
  };

  requestAnimationFrame(step);
}

function updateScoreRing(value, color) {
  if (!evaluationRingProgress) return;
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = SCORE_RING_LENGTH * (1 - clamped / 100);
  evaluationRingProgress.style.strokeDashoffset = offset.toFixed(2);
  evaluationRingProgress.style.stroke = color;
}

let evaluationSpinTimer = null;
function startEvaluationSpin() {
  stopEvaluationSpin();
  evaluationSpinValue = 100;
  updateScoreRing(100, "#cbd5e1");
  evaluationSpinTimer = setInterval(() => {
    const step = 2 + Math.random() * 1; // 2 ~ 3
    evaluationSpinValue = Math.max(0, evaluationSpinValue - step);
    const color =
      evaluationSpinValue >= 80 ? "#16a34a" : evaluationSpinValue >= 60 ? "#ca8a04" : "#ef4444";
    animateEvaluationScore(evaluationSpinValue, { duration: 500 });
    updateScoreRing(evaluationSpinValue, color);
  }, 1000);
}

function stopEvaluationSpin() {
  if (evaluationSpinTimer) {
    clearInterval(evaluationSpinTimer);
    evaluationSpinTimer = null;
  }
  evaluationSpinValue = 0;
}

// 让即时反馈内容浮入。
function animateEvaluationContent() {
  const targets = [
    evaluationScoreEl,
    evaluationScoreLabelEl,
    evaluationFeedbackCards,
    evaluationKnowledgeEl,
    evaluationRecommendationsSection,
  ];
  targets.forEach((el) => {
    if (!el) return;
    el.classList.remove("evaluation-animate");
    void el.offsetWidth;
    el.classList.add("evaluation-animate");
  });
}

// 更新行内状态提示的文本与颜色。
function updateInlineStatus(element, message, variant = "muted") {
  if (!element) return;
  element.textContent = message || "";
  element.classList.remove("text-slate-500", "text-emerald-500", "text-rose-500");
  if (!message) {
    element.classList.add("text-slate-500");
    return;
  }
  if (variant === "success") {
    element.classList.add("text-emerald-500");
  } else if (variant === "error") {
    element.classList.add("text-rose-500");
  } else {
    element.classList.add("text-slate-500");
  }
}

// 设置状态栏提示，并切换颜色样式。
function setStatusText(element, message, variant = "muted") {
  if (!element) {
    return;
  }
  element.textContent = message || "";
  element.classList.remove("text-slate-400", "text-emerald-400", "text-rose-400");
  if (!message || variant === "muted") {
    element.classList.add("text-slate-400");
  } else if (variant === "success") {
    element.classList.add("text-emerald-400");
  } else if (variant === "error") {
    element.classList.add("text-rose-400");
  } else {
    element.classList.add("text-slate-400");
  }
}

// 折叠左侧章节/关卡选择面板。
function collapseLevelSelection() {
  if (!levelSelectionPanel) {
    return;
  }
  levelSelectionPanel.classList.add("hidden");
  state.isLevelSelectionCollapsed = true;
}

// 展开章节/关卡选择面板。
function expandLevelSelection() {
  if (!levelSelectionPanel) {
    return;
  }
  if (studentHomeSection) {
    studentHomeSection.classList.add("hidden");
  }
  if (theoryPanel) {
    theoryPanel.classList.add("hidden");
  }
  levelSelectionPanel.classList.remove("hidden");
  state.isLevelSelectionCollapsed = false;
  state.studentActiveView = "practice";
  highlightSelectedLevel();
}

// 根据 ID 获取章节对象。
function findChapter(chapterId) {
  return (state.chapters || []).find((chapter) => chapter.id === chapterId) || null;
}

// 根据章节/关卡 ID 获取关卡对象。
function findSection(chapterId, sectionId) {
  const chapter = findChapter(chapterId);
  if (!chapter) {
    return null;
  }
  return (chapter.sections || []).find((section) => section.id === sectionId) || null;
}

// 高亮当前选中的关卡按钮。
function highlightSelectedLevel() {
  if (!levelMapContainer) {
    return;
  }
  const { chapterId, sectionId } = state.selectedLevel || {};
  levelMapContainer.querySelectorAll(".level-node").forEach((node) => {
    const nodeChapter = node.dataset.chapterId;
    const nodeSection = node.dataset.sectionId;
    if (nodeChapter === chapterId && nodeSection === sectionId) {
      node.classList.add("level-node-active");
    } else {
      node.classList.remove("level-node-active");
    }
  });
  const shouldKeepExpanded =
    chapterId &&
    state.expandedChapters instanceof Set &&
    state.expandedChapters.has(chapterId);
  if (shouldKeepExpanded) {
    const activeCard = levelMapContainer.querySelector(
      `details[data-chapter-id="${chapterId}"]`,
    );
    if (activeCard && !activeCard.open) {
      activeCard.open = true;
      if (!(state.expandedChapters instanceof Set)) {
        state.expandedChapters = new Set();
      }
      state.expandedChapters.add(chapterId);
    }
  }
}

// 刷新右侧“关卡详情”区域（标题/摘要/关卡按钮）。
function updateSelectedLevelDetail() {
  if (!selectedLevelDetail || !selectedLevelTitle || !selectedLevelDescription) {
    return;
  }
  const { chapterId, sectionId } = state.selectedLevel || {};
  if (!chapterId || !sectionId) {
    selectedLevelDetail.classList.add("hidden");
    selectedLevelTitle.textContent = "";
    selectedLevelDescription.textContent = "";
    startLevelBtn.disabled = true;
    return;
  }
  const chapter = findChapter(chapterId);
  const section = findSection(chapterId, sectionId);
  if (!chapter || !section) {
    selectedLevelDetail.classList.add("hidden");
    startLevelBtn.disabled = true;
    return;
  }
  const chapterLabel = chapter.displayTitle || chapter.title || "章节";
  selectedLevelTitle.textContent = `${chapterLabel}｜${section.title || "小节"}`;
  selectedLevelDescription.textContent = section.description || "";
  selectedLevelDetail.classList.remove("hidden");
  startLevelBtn.disabled = false;
  highlightSelectedLevel();
}

// 设置当前选中的关卡并刷新相关 UI。
function setSelectedLevel(chapterId, sectionId) {
  if (!(state.expandedChapters instanceof Set)) {
    state.expandedChapters = new Set();
  }
  if (chapterId) {
    state.expandedChapters.add(chapterId);
  }
  const section = chapterId && sectionId ? findSection(chapterId, sectionId) : null;
  const mode = section && section.mode ? section.mode : "";
  state.selectedLevel = { chapterId, sectionId, mode };
  updateSelectedLevelDetail();
}

// 渲染章节-关卡地图，支持展开与选中态。
function renderLevelMap() {
  if (!levelMapContainer) {
    return;
  }
  levelMapContainer.innerHTML = "";
  const chapters = state.chapters || [];
  if (chapters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm text-slate-400";
    empty.textContent = "暂无章节，请联系教师配置关卡。";
    levelMapContainer.appendChild(empty);
    startLevelBtn.disabled = true;
    return;
  }

  if (!(state.expandedChapters instanceof Set)) {
    state.expandedChapters = new Set();
  }
  const expandedChapters = new Set(state.expandedChapters);
  let hasExpanded = expandedChapters.size > 0;
  const selectedChapterId = state.selectedLevel
    ? state.selectedLevel.chapterId || null
    : null;

  chapters.forEach((chapter, index) => {
    const sections = chapter.sections || [];
    const totalSections = sections.length;
    const completedCount = sections.reduce((count, section) => {
      if (!(state.levelVictories instanceof Set)) {
        return count;
      }
      const victoryKey = getLevelVictoryKey(chapter.id, section.id);
      return state.levelVictories.has(victoryKey) ? count + 1 : count;
    }, 0);

    const card = document.createElement("details");
    card.className = "chapter-card";
    card.dataset.chapterId = chapter.id;

    const summary = document.createElement("summary");
    summary.className = "chapter-card-summary";
    summary.dataset.chapterId = chapter.id;
    const countClass = totalSections === 0 ? "chapter-card-count chapter-card-count-empty" : "chapter-card-count";
    const displayTitle = chapter.displayTitle || chapter.title || "章节";
    const fallbackOrdinal =
      typeof chapter.displayOrdinal === "number" && Number.isFinite(chapter.displayOrdinal)
        ? chapter.displayOrdinal
        : index + 1;
    const displaySubtitle =
      chapter.displaySubtitle || chapter.description || `Chapter ${fallbackOrdinal}`;

    summary.innerHTML = `
      <div class="chapter-card-summary-content">
        <p class="chapter-card-title">${displayTitle}</p>
        <p class="chapter-card-description">${displaySubtitle}</p>
      </div>
      <div class="chapter-card-meta">
        <span class="${countClass}">${
          totalSections === 0 ? "暂无任务" : `${completedCount}/${totalSections} 完成`
        }</span>
        <span class="chapter-card-chevron" aria-hidden="true">
          <svg class="chapter-card-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 5l8 7-8 7" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </span>
      </div>
    `;
    card.appendChild(summary);

    const body = document.createElement("div");
    body.className = "chapter-card-body";

    const list = document.createElement("div");
    list.className = "level-node-list";

    sections.forEach((section) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "level-node";
      node.dataset.chapterId = chapter.id;
      node.dataset.sectionId = section.id;
      const victoryKey = getLevelVictoryKey(chapter.id, section.id);
      const isVictory =
        state.levelVictories instanceof Set && state.levelVictories.has(victoryKey);
      if (isVictory) {
        node.classList.add("level-node-victory");
      }
      const title = section.title || "小节";
      const description = section.description || "";
      node.innerHTML = `
        <div class="level-node-header">
          <span class="level-node-title">${title}</span>
          ${isVictory ? '<span class="level-node-badge" aria-label="通关成功">🏆 胜利</span>' : ""}
        </div>
        <span class="level-node-description">${description}</span>
      `;
      list.appendChild(node);
    });

    if (sections.length === 0) {
      const emptySection = document.createElement("p");
      emptySection.className = "level-node-empty rounded-xl border border-dashed border-slate-300/60 bg-transparent p-3 text-xs text-slate-500 text-center";
      emptySection.textContent = "暂无小节";
      list.appendChild(emptySection);
    }

    body.appendChild(list);
    card.appendChild(body);

    const shouldExpand =
      expandedChapters.has(chapter.id) ||
      (selectedChapterId && chapter.id === selectedChapterId) ||
      (!hasExpanded && index === 0);

    if (shouldExpand) {
      card.setAttribute("open", "");
      expandedChapters.add(chapter.id);
      hasExpanded = true;
    }

    card.addEventListener("toggle", () => {
      if (!(state.expandedChapters instanceof Set)) {
        state.expandedChapters = new Set();
      }
      if (card.open) {
        state.expandedChapters.add(chapter.id);
        const hasSelection = state.selectedLevel
          ? state.selectedLevel.chapterId === chapter.id
          : false;
        const firstSection = (chapter.sections || [])[0];
        if (!hasSelection && firstSection) {
          setSelectedLevel(chapter.id, firstSection.id);
        }
      } else {
        state.expandedChapters.delete(chapter.id);
      }
    });

    levelMapContainer.appendChild(card);
  });

  state.expandedChapters = expandedChapters;

  highlightSelectedLevel();
}

// 初始化理论模块 state，避免空引用。
function ensureTheoryState() {
  if (!state.theory || typeof state.theory !== "object") {
    state.theory = { tree: [], selectedLessonId: null, lessonCache: new Map() };
  }
  if (!(state.theory.lessonCache instanceof Map)) {
    state.theory.lessonCache = new Map();
  }
}

// 初始化学生端图谱状态（节点/边/缓存等）。
function ensureStudentGraphState() {
  if (!state.studentGraph || typeof state.studentGraph !== "object") {
    state.studentGraph = { lessonPractices: new Map(), practiceLessons: new Map() };
  }
  if (!(state.studentGraph.lessonPractices instanceof Map)) {
    state.studentGraph.lessonPractices = new Map();
  }
  if (!(state.studentGraph.practiceLessons instanceof Map)) {
    state.studentGraph.practiceLessons = new Map();
  }
}

// 初始化知识罗盘状态，存储高亮与缓存数据。
function ensureCompassState() {
  if (!state.studentCompass || typeof state.studentCompass !== "object") {
    state.studentCompass = {
      knowledgeMap: new Map(),
      prereqMap: new Map(),
      loaded: false,
      currentLessonMap: new Map(),
    };
  }
  if (!(state.studentCompass.knowledgeMap instanceof Map)) {
    state.studentCompass.knowledgeMap = new Map();
  }
  if (!(state.studentCompass.prereqMap instanceof Map)) {
    state.studentCompass.prereqMap = new Map();
  }
  if (!(state.studentCompass.currentLessonMap instanceof Map)) {
    state.studentCompass.currentLessonMap = new Map();
  }
}

// 清除文章中的知识点高亮标记。
function clearKnowledgeHighlights(container) {
  if (!container) return;
  const marks = container.querySelectorAll("[data-kp-highlight]");
  marks.forEach((node) => {
    const parent = node.parentNode;
    if (!parent) return;
    while (node.firstChild) {
      parent.insertBefore(node.firstChild, node);
    }
    parent.removeChild(node);
  });
}

// 根据知识点列表在文章中高亮对应关键词。
function applyKnowledgeHighlights(container, knowledgePoints) {
  if (!container || !Array.isArray(knowledgePoints)) return;
  clearKnowledgeHighlights(container);
  const names = knowledgePoints
    .map((kp) => (kp && kp.name ? kp.name.trim() : ""))
    .filter(Boolean);
  if (names.length === 0) return;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.nodeValue && node.nodeValue.trim()) {
      textNodes.push(node);
    }
  }
  names.forEach((name) => {
    const lower = name.toLowerCase();
    for (const textNode of textNodes) {
      const value = textNode.nodeValue || "";
      const idx = value.toLowerCase().indexOf(lower);
      if (idx >= 0) {
        const range = document.createRange();
        range.setStart(textNode, idx);
        range.setEnd(textNode, idx + name.length);
        const mark = document.createElement("span");
        mark.dataset.kpHighlight = "true";
        mark.dataset.kpName = name;
        mark.className = "compass-highlight";
        range.surroundContents(mark);
        break;
      }
    }
  });
}

// 清空罗盘区域的高亮状态。
function clearCompassHighlights(container) {
  if (!container) return;
  const marks = container.querySelectorAll("[data-compass-highlight]");
  marks.forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  });
}

// 在文章中高亮指定文本片段。
function highlightInArticle(container, text) {
  if (!container || !text) return;
  clearCompassHighlights(container);
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let node;
  const lower = text.toLowerCase();
  while ((node = walker.nextNode())) {
    const value = node.nodeValue || "";
    const idx = value.toLowerCase().indexOf(lower);
    if (idx >= 0) {
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + text.length);
      const mark = document.createElement("mark");
      mark.dataset.compassHighlight = "true";
      mark.className = "compass-highlight";
      range.surroundContents(mark);
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      break;
    }
  }
}

// 判断当前关卡是否属于“复盘模式”范围。
function isReviewSection(sectionId) {
  return !!sectionId && REVIEW_SECTION_IDS.has(sectionId);
}

// 初始化复盘状态（文档/提示/标注）。
function ensureReviewState() {
  if (!state.review) {
    state.review = {
      documentText: "",
      hints: null,
      annotations: [],
      pendingSelection: null,
    };
  }
}

// 清空复盘数据，恢复初始状态。
function resetReviewState() {
  ensureReviewState();
  state.review.documentText = "";
  state.review.hints = null;
  state.review.annotations = [];
  state.review.pendingSelection = null;
  renderReviewWorkbench();
}

// 渲染复盘文档正文，并附带提示区域。
function renderReviewDocument() {
  if (!reviewDocumentEl) return;
  ensureReviewState();
  reviewDocumentEl.innerHTML = "";
  const text = (state.review.documentText || "").trim();
  if (!text) {
    reviewDocumentEl.innerHTML = '<p class="text-sm text-slate-500">暂无单证内容。</p>';
    return;
  }
  const pre = document.createElement("pre");
  pre.className = "text-sm whitespace-pre-wrap leading-7 text-slate-800";
  pre.textContent = text;
  reviewDocumentEl.appendChild(pre);
}

// 渲染复盘提示列表。
function renderReviewHints() {
  if (!reviewHintList || !reviewContextList) return;
  ensureReviewState();
  reviewHintList.innerHTML = "";
  reviewContextList.innerHTML = "";
  const hints = state.review.hints || {};
  const hintItems = [];
  if (Array.isArray(hints.complianceRedFlags) && hints.complianceRedFlags.length > 0) {
    hints.complianceRedFlags.forEach((item) => hintItems.push(`⚠️ ${item}`));
  }
  if (Array.isArray(hints.issuesToVerify) && hints.issuesToVerify.length > 0) {
    hints.issuesToVerify.forEach((item) => hintItems.push(`检查：${item}`));
  }
  if (hintItems.length === 0) {
    const li = document.createElement("li");
    li.className = "text-xs text-amber-500";
    li.textContent = "暂无预置风险点，仍需仔细检查条款。";
    reviewHintList.appendChild(li);
  } else {
    hintItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "rounded-lg bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900";
      li.textContent = item;
      reviewHintList.appendChild(li);
    });
  }

  const ctxItems = [];
  if (hints.paymentTermsMatrix) {
    ctxItems.push(`付款矩阵：${hints.paymentTermsMatrix}`);
  }
  if (hints.documentType) {
    ctxItems.push(`单据类型：${hints.documentType}`);
  }
  if (hints.documentSnapshot) {
    ctxItems.push(`基线：${hints.documentSnapshot}`);
  }
  const scenario = state.currentScenario || {};
  const product = scenario.product || {};
  if (product.price_expectation?.ai_bottom_line) {
    ctxItems.push(`AI 底线：${product.price_expectation.ai_bottom_line}`);
  }
  if (product.price_expectation?.student_target) {
    ctxItems.push(`学生目标：${product.price_expectation.student_target}`);
  }

  if (ctxItems.length === 0) {
    const li = document.createElement("li");
    li.className = "text-xs text-blue-700";
    li.textContent = "暂无额外比对参数。";
    reviewContextList.appendChild(li);
  } else {
    ctxItems.forEach((item) => {
      const li = document.createElement("li");
      li.className = "rounded-lg bg-blue-100 px-3 py-2 text-xs font-medium text-blue-900";
      li.textContent = item;
      reviewContextList.appendChild(li);
    });
  }
}

// 渲染已创建的标注列表，包含跳转锚点。
function renderReviewAnnotations() {
  if (!reviewAnnotationsList) return;
  ensureReviewState();
  reviewAnnotationsList.innerHTML = "";
  const annotations = Array.isArray(state.review.annotations) ? state.review.annotations : [];
  if (annotations.length === 0) {
    const li = document.createElement("li");
    li.className = "text-xs text-slate-500";
    li.textContent = "暂无批注，划词后填写错误原因与修改意见。";
    reviewAnnotationsList.appendChild(li);
    return;
  }
  annotations.forEach((note) => {
    const li = document.createElement("li");
    li.className =
      "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm";
    li.innerHTML = `
      <p class="font-semibold text-slate-900">${note.quote || "未记录选中内容"}</p>
      <p class="mt-1 text-slate-700">错误原因：${note.issue || "未填写"}</p>
      <p class="text-slate-700">修改意见：${note.fix || "未填写"}</p>
      <div class="mt-2 flex items-center gap-3">
        <button data-review-focus="${note.id}" class="text-blue-600 hover:underline">定位</button>
        <button data-review-remove="${note.id}" class="text-rose-600 hover:underline">删除</button>
      </div>
    `;
    reviewAnnotationsList.appendChild(li);
  });

  reviewAnnotationsList.querySelectorAll("[data-review-focus]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-review-focus");
      if (!id || !reviewDocumentEl) return;
      const target = reviewDocumentEl.querySelector(`[data-review-annotation-id="${id}"]`);
      if (target && typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  reviewAnnotationsList.querySelectorAll("[data-review-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-review-remove");
      removeReviewAnnotation(id);
    });
  });
}

// 清空“选区预览”区域。
function clearReviewSelectionPreview() {
  ensureReviewState();
  state.review.pendingSelection = null;
  if (reviewSelectionPreview) {
    reviewSelectionPreview.textContent = "尚未划词";
  }
  if (reviewIssueInput) reviewIssueInput.value = "";
  if (reviewFixInput) reviewFixInput.value = "";
}

// 获取用户当前在复盘文档的选区，记录文本和 HTML。
function captureReviewSelection() {
  if (!reviewDocumentEl) return;
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    clearReviewSelectionPreview();
    return;
  }
  const range = selection.getRangeAt(0).cloneRange();
  if (!reviewDocumentEl.contains(range.commonAncestorContainer)) {
    clearReviewSelectionPreview();
    return;
  }
  const text = selection.toString().trim();
  if (!text) {
    clearReviewSelectionPreview();
    return;
  }
  ensureReviewState();
  state.review.pendingSelection = { range, text };
  if (reviewSelectionPreview) {
    reviewSelectionPreview.textContent = text.length > 160 ? `${text.slice(0, 160)}…` : text;
  }
}

// 移除指定标注 ID 的高亮标记。
function unwrapAnnotationMarks(id) {
  if (!reviewDocumentEl || !id) return;
  const marks = reviewDocumentEl.querySelectorAll(`[data-review-annotation-id="${CSS.escape(id)}"]`);
  marks.forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
  });
}

// 删除标注并刷新列表/预览。
function removeReviewAnnotation(id) {
  ensureReviewState();
  if (!id) return;
  unwrapAnnotationMarks(id);
  state.review.annotations = state.review.annotations.filter((item) => item.id !== id);
  renderReviewAnnotations();
}

// 保存当前选区为标注（附带备注），并刷新展示。
function saveReviewAnnotation() {
  ensureReviewState();
  const pending = state.review.pendingSelection;
  if (!pending || !pending.range || !pending.text) {
    alert("请先在左侧单证中划词选择要批注的内容。");
    return;
  }
  const issue = reviewIssueInput ? reviewIssueInput.value.trim() : "";
  const fix = reviewFixInput ? reviewFixInput.value.trim() : "";
  const id = `note-${Date.now()}`;
  const mark = document.createElement("mark");
  mark.dataset.reviewAnnotationId = id;
  mark.className = "review-highlight";
  try {
    pending.range.surroundContents(mark);
  } catch (err) {
    console.warn("无法包裹选区", err);
    clearReviewSelectionPreview();
    return;
  }
  state.review.annotations.push({
    id,
    quote: pending.text,
    issue,
    fix,
  });
  state.review.pendingSelection = null;
  if (reviewIssueInput) reviewIssueInput.value = "";
  if (reviewFixInput) reviewFixInput.value = "";
  if (reviewSelectionPreview) reviewSelectionPreview.textContent = "已记录";
  renderReviewAnnotations();
}

// 渲染复盘工作台（包含提示、标注、选区预览）。
function renderReviewWorkbench() {
  if (!reviewModule) return;
  ensureReviewState();
  const sectionId = state.activeLevel?.sectionId;
  const hasDoc = isReviewSection(sectionId) && !!(state.review.documentText || "").trim();
  if (!hasDoc) {
    reviewModule.classList.add("hidden");
    return;
  }
  reviewModule.classList.remove("hidden");
  renderReviewDocument();
  renderReviewHints();
  renderReviewAnnotations();
}

// 判断当前体验模块是否为邮件往来模式。
function isEmailModeActive() {
  const mode =
    (state.currentScenario && state.currentScenario.mode) ||
    (state.activeLevel && state.activeLevel.mode) ||
    (state.selectedLevel && state.selectedLevel.mode) ||
    "";
  return mode === "email";
}

// 初始化邮件草稿结构。
function ensureEmailDraft() {
  if (!state.emailDraft) {
    state.emailDraft = { subject: "", body: "", signature: "" };
  }
}

// 根据场景信息预填邮件撰写器（收件人/主题等）。
function hydrateEmailComposer(scenario) {
  ensureEmailDraft();
  const studentCompany = (scenario && scenario.studentCompany) || {};
  const aiCompany = (scenario && scenario.aiCompany) || {};
  const studentRole = scenario && scenario.studentRole ? scenario.studentRole : "";
  const aiRole = scenario && scenario.aiRole ? scenario.aiRole : "";
  const defaultSubject = scenario?.title || "Business correspondence";
  const defaultSignature =
    state.emailDraft.signature || `${studentRole}\n${studentCompany.name || ""}`.trim();
  if (emailSubjectInput) emailSubjectInput.value = state.emailDraft.subject || defaultSubject;
  if (emailFromInput) {
    const fromLine = `${studentRole || "Student"}${studentCompany.name ? " | " + studentCompany.name : ""}`;
    emailFromInput.value = fromLine;
  }
  if (emailToInput) {
    const toLine = `${aiRole || "Counterparty"}${aiCompany.name ? " | " + aiCompany.name : ""}`;
    emailToInput.value = toLine;
  }
  if (emailBodyInput) {
    emailBodyInput.value = state.emailDraft.body || "";
  }
  if (emailSignatureInput) {
    emailSignatureInput.value = defaultSignature;
  }
}

// 更新邮件 Copilot 状态栏。
function setEmailCopilotStatus(message, variant = "muted") {
  if (!emailCopilotStatus) return;
  emailCopilotStatus.textContent = message || "";
  emailCopilotStatus.className = "text-xs";
  if (variant === "loading") {
    emailCopilotStatus.classList.add("text-blue-600");
  } else if (variant === "error") {
    emailCopilotStatus.classList.add("text-rose-600");
  } else {
    emailCopilotStatus.classList.add("text-slate-500");
  }
}

// 渲染邮件往来列表（AI 回复 + 用户草稿）。
function renderEmailThread() {
  if (!emailThreadEl || !chatBodyEl || !emailComposerEl || !chatInputPanel || !emailBannerEl) {
    return;
  }
  emailThreadEl.innerHTML = "";
  chatBodyEl.classList.add("hidden");
  chatInputPanel.classList.add("hidden");
  emailThreadEl.classList.remove("hidden");
  emailComposerEl.classList.remove("hidden");
  emailBannerEl.classList.remove("hidden");

  const scenario = state.currentScenario || {};
  const aiCompany = scenario.aiCompany || {};
  const studentCompany = scenario.studentCompany || {};
  state.messages.forEach((message) => {
    const card = document.createElement("article");
    const isUser = message.role === "user";
    let subject = message.subject;
    if (!subject && typeof message.content === "string") {
      const match = message.content.match(/Subject:\s*([^\n]+)/i);
      if (match) {
        subject = match[1].trim();
      }
    }
    card.className = `email-card ${isUser ? "email-card--user" : "email-card--assistant"}`;
    const meta = document.createElement("div");
    meta.className = "email-card__meta";
    const fromLabel = isUser
      ? studentCompany.name || scenario.studentRole || "Student"
      : aiCompany.name || scenario.aiRole || "AI";
    const from = document.createElement("span");
    from.textContent = `From: ${fromLabel}`;
    meta.appendChild(from);
    if (subject) {
      const subj = document.createElement("span");
      subj.textContent = `Subject: ${subject}`;
      meta.appendChild(subj);
    }
    card.appendChild(meta);
    if (subject) {
      const subjectEl = document.createElement("div");
      subjectEl.className = "email-card__subject";
      subjectEl.textContent = subject;
      card.appendChild(subjectEl);
    }
    const body = document.createElement("div");
    body.className = "email-card__body chat-markdown";
    body.innerHTML = renderMarkdown(message.content);
    card.appendChild(body);
    emailThreadEl.appendChild(card);
  });
}

// 渲染邮件撰写区域，包括开关、按钮、输入框。
function renderEmailComposer() {
  if (!isEmailModeActive()) {
    if (emailBannerEl) emailBannerEl.classList.add("hidden");
    if (emailComposerEl) emailComposerEl.classList.add("hidden");
    if (emailThreadEl) emailThreadEl.classList.add("hidden");
    if (chatBodyEl) chatBodyEl.classList.remove("hidden");
    if (chatInputPanel) chatInputPanel.classList.remove("hidden");
    renderCopilotVisibility();
    return;
  }
  hydrateEmailComposer(state.currentScenario || {});
  renderEmailThread();
  renderCopilotVisibility();
}

// 根据当前模式显示/隐藏 Copilot 面板与切换按钮。
function renderCopilotVisibility() {
  if (!copilotFab) return;
  const liveChat = !isEmailModeActive() && !isReviewSection(state.activeLevel?.sectionId);
  if (!liveChat) {
    copilotFab.style.display = "none";
    if (copilotPanel) copilotPanel.style.display = "none";
    copilotPanelOpen = false;
    copilotAgentRunning = false;
    if (copilotStopBtn) copilotStopBtn.classList.add("hidden");
    return;
  }
  copilotFab.style.display = copilotPanelOpen ? "none" : "flex";
}

// 展开 Copilot 面板。
function openCopilotPanel() {
  if (!copilotPanel) return;
  if (copilotMobileHideTimer) {
    clearTimeout(copilotMobileHideTimer);
    copilotMobileHideTimer = null;
  }
  copilotPanel.style.display = "flex";
  if (isMobileViewport()) {
    copilotPanel.classList.add("copilot-panel--open");
    copilotPanel.classList.remove("copilot-panel--closing");
    copilotPanel.style.transform = "";
  }
  copilotPanelOpen = true;
  renderCopilotVisibility();
  if (copilotInput) copilotInput.focus();
}

// 收起 Copilot 面板。
function closeCopilotPanel() {
  if (!copilotPanel) return;
  copilotPanelOpen = false;
  copilotAgentRunning = false;
  if (copilotStopBtn) copilotStopBtn.classList.add("hidden");
  setCopilotStatus("");
  if (isMobileViewport()) {
    copilotPanel.classList.remove("copilot-panel--open");
    copilotPanel.classList.add("copilot-panel--closing");
    if (copilotMobileHideTimer) {
      clearTimeout(copilotMobileHideTimer);
    }
    copilotMobileHideTimer = setTimeout(() => {
      copilotPanel.style.display = "none";
      copilotPanel.classList.remove("copilot-panel--closing");
      copilotMobileHideTimer = null;
    }, 260);
  } else {
    copilotPanel.style.display = "none";
  }
  renderCopilotVisibility();
}

// 更新 Copilot 状态提示。
function setCopilotStatus(text, variant = "muted") {
  if (!copilotStatus) return;
  copilotStatus.textContent = text || "";
  copilotStatus.className = "text-xs";
  if (variant === "loading") {
    copilotStatus.classList.add("text-blue-300");
  } else if (variant === "error") {
    copilotStatus.classList.add("text-rose-300");
  } else {
    copilotStatus.classList.add("text-slate-400");
  }
}

// 设置 Copilot 输出展示（支持 Markdown）。
function setCopilotOutput(text) {
  if (!copilotOutput) return;
  copilotOutput.innerHTML = renderMarkdown(text || "");
}

function initCopilotDrag() {
  if (!copilotPanel) return;
  const onPointerMove = (event) => {
    if (!copilotDrag.active) return;
    const point = event.touches ? event.touches[0] : event;
    const dx = point.clientX - copilotDrag.startX;
    const dy = point.clientY - copilotDrag.startY;
    copilotDrag.offsetX += dx;
    copilotDrag.offsetY += dy;
    copilotDrag.startX = point.clientX;
    copilotDrag.startY = point.clientY;
    copilotPanel.style.transform = `translate(${copilotDrag.offsetX}px, ${copilotDrag.offsetY}px)`;
  };
  const onPointerEnd = () => {
    copilotDrag.active = false;
    copilotPanel.classList.remove("copilot-panel--dragging");
  };
  const onPointerStart = (event) => {
    if (isMobileViewport()) return;
    if (event.type === "mousedown" && event.button !== 0) return;
    if (
      event.target.closest(
        "button, input, textarea, select, option, a, label, [contenteditable='true']"
      )
    ) {
      return;
    }
    const point = event.touches ? event.touches[0] : event;
    copilotDrag.active = true;
    copilotDrag.startX = point.clientX;
    copilotDrag.startY = point.clientY;
    copilotPanel.classList.add("copilot-panel--dragging");
  };
  copilotPanel.addEventListener("mousedown", onPointerStart);
  copilotPanel.addEventListener("touchstart", onPointerStart, { passive: true });
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("touchmove", onPointerMove, { passive: true });
  document.addEventListener("mouseup", onPointerEnd);
  document.addEventListener("touchend", onPointerEnd);
  document.addEventListener("touchcancel", onPointerEnd);
}

// 调用后端 Copilot 接口获取建议/草稿。
async function fetchCopilotSuggestion(action, hint) {
  if (!state.sessionId) {
    setCopilotStatus("请先进入关卡。", "error");
    return null;
  }
  setCopilotStatus("Copilot 正在思考…", "loading");
  setCopilotOutput("");
  try {
    const response = await fetchWithAuth("/api/ai/chat/copilot?stream=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        session_id: state.sessionId,
        action,
        user_input: hint || "",
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Copilot 调用失败";
      if (errorText) {
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || errorMessage;
        } catch (err) {
          errorMessage = errorText || errorMessage;
        }
      }
      throw new Error(errorMessage);
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/event-stream")) {
      const data = await response.json();
      setCopilotStatus("完成，内容仅供参考。");
      return data.suggestion || "";
    }
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法读取 Copilot 流式响应");
    }
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let fullText = "";
    let shouldTerminate = false;
    let streamError = null;

    const parseEvent = (raw) => {
      const lines = raw.split("\n");
      let eventType = "message";
      const dataLines = [];
      lines.forEach((line) => {
        if (line.startsWith("event:")) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      });
      const dataString = dataLines.join("\n");
      let payload;
      if (dataString) {
        try {
          payload = JSON.parse(dataString);
        } catch (err) {
          payload = {};
        }
      } else {
        payload = {};
      }
      return { eventType, payload };
    };

    const handleEvent = (eventType, payload) => {
      if (eventType === "chunk") {
        if (payload.content) {
          fullText += payload.content;
          setCopilotOutput(fullText);
        }
      } else if (eventType === "done") {
        shouldTerminate = true;
      } else if (eventType === "error") {
        streamError = new Error(payload.error || "Copilot 调用失败");
        shouldTerminate = true;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      parts.filter(Boolean).forEach((part) => {
        const { eventType, payload } = parseEvent(part);
        handleEvent(eventType, payload);
      });
      if (shouldTerminate) break;
    }
    if (streamError) {
      throw streamError;
    }
    setCopilotStatus("完成，内容仅供参考。");
    return fullText;
  } catch (error) {
    console.error(error);
    setCopilotStatus(error.message || "Copilot 失败", "error");
    return null;
  }
}

// Copilot 单轮助理：根据输入生成建议并写入输出区。
async function handleCopilotAssist() {
  const hint = copilotInput ? copilotInput.value.trim() : "";
  const suggestion = await fetchCopilotSuggestion("assistant", hint);
  if (suggestion) {
    setCopilotOutput(suggestion);
  }
}

// Copilot Agent 模式：循环向后端请求分步骤输出。
async function copilotAgentLoop(hint) {
  if (!copilotAgentRunning) return;
  const suggestion = await fetchCopilotSuggestion("agent", hint);
  if (!suggestion) {
    copilotAgentRunning = false;
    if (copilotStopBtn) copilotStopBtn.classList.add("hidden");
    return;
  }
  setCopilotOutput(suggestion);
  await sendMessageWithContent(suggestion, { fromCopilot: true });
  if (copilotAgentRunning) {
    setTimeout(() => copilotAgentLoop(hint), 600);
  }
}

// 入口：触发 Agent 模式，避免重复运行。
async function handleCopilotAgent() {
  if (!state.sessionId) {
    setCopilotStatus("请先进入关卡。", "error");
    return;
  }
  copilotAgentRunning = true;
  if (copilotStopBtn) copilotStopBtn.classList.remove("hidden");
  setCopilotStatus("Agent 自动回复中（仅供体验）。", "loading");
  const hint = copilotInput ? copilotInput.value.trim() : "";
  copilotAgentLoop(hint);
}

function handleCopilotStop() {
  copilotAgentRunning = false;
  if (copilotStopBtn) copilotStopBtn.classList.add("hidden");
  setCopilotStatus("已停止自动回复");
}

// 打开知识卡弹窗，展示指定知识点详情。
function showStudentKnowledgeCard(name) {
  if (!name) return;
  ensureCompassState();
  const kp = state.studentCompass.currentLessonMap.get(name) || { name };
  const overlayId = "kp-viewer-overlay";
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = overlayId;
    overlay.className = "kp-viewer-overlay";
    const card = document.createElement("div");
    card.className = "kp-viewer-card";
    card.innerHTML = `
      <button class="kp-viewer-close" aria-label="关闭">×</button>
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-slate-900" data-kp-title></h3>
        <span class="kp-viewer-chip">知识卡</span>
      </div>
      <p class="mt-2 text-sm text-slate-600" data-kp-summary></p>
      <div class="mt-3 text-sm text-slate-700 space-y-2" data-kp-body></div>
      <p class="mt-3 text-xs text-slate-500" data-kp-prereq></p>
      <div class="mt-4" data-kp-practices></div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay || e.target.classList.contains("kp-viewer-close")) {
        overlay.remove();
      }
    });
  }
  const titleEl = overlay.querySelector("[data-kp-title]");
  const summaryEl = overlay.querySelector("[data-kp-summary]");
  const bodyEl = overlay.querySelector("[data-kp-body]");
  const prereqEl = overlay.querySelector("[data-kp-prereq]");
  const practiceEl = overlay.querySelector("[data-kp-practices]");
  if (titleEl) titleEl.textContent = kp.title || kp.name || name;
  if (summaryEl) summaryEl.textContent = kp.summary || "";
  if (bodyEl) bodyEl.innerHTML = kp.bodyHtml || "";
  const prereqs = Array.isArray(kp.prerequisites) ? kp.prerequisites : [];
  if (prereqEl) prereqEl.textContent = prereqs.length ? `前置：${prereqs.join("、")}` : "";
  overlay.style.display = "flex";

  // 流式获取讲解
  const lessonId = state.theory?.selectedLessonId;
  if (bodyEl) {
    bodyEl.textContent = "生成讲解中...";
    fetchWithAuth("/api/knowledge/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, lessonId }),
    })
      .then((response) => {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("无法读取流");
        const decoder = new TextDecoder("utf-8");
        let buf = "";
        const pump = () =>
          reader.read().then(({ value, done }) => {
            if (done) {
              if (buf) {
                if (window.marked && window.DOMPurify) {
                  bodyEl.innerHTML = window.DOMPurify.sanitize(window.marked.parse(buf));
                } else {
                  bodyEl.textContent = buf;
                }
              }
              return;
            }
            buf += decoder.decode(value, { stream: true });
            if (window.marked && window.DOMPurify) {
              bodyEl.innerHTML = window.DOMPurify.sanitize(window.marked.parse(buf));
            } else {
              bodyEl.textContent = buf;
            }
            return pump();
          });
        return pump();
      })
      .catch(() => {
        bodyEl.textContent = kp.bodyHtml || kp.summary || "暂时无法生成讲解，请稍后重试";
      });
  }

  if (practiceEl) {
    practiceEl.innerHTML = "";
    fetchWithAuth(`/api/knowledge/practice-recs?name=${encodeURIComponent(name)}&limit=5`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data.practices) ? data.practices : [];
        if (list.length === 0) return;
        const title = document.createElement("p");
        title.className = "text-xs text-slate-500";
        title.textContent = "推荐练习";
        practiceEl.appendChild(title);
        const ul = document.createElement("ul");
        ul.className = "mt-2 space-y-2";
        list.forEach((p) => {
          const li = document.createElement("li");
          li.className =
            "rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm text-slate-800 shadow-sm";
          li.textContent = p.title || p.id;
          li.addEventListener("click", () => {
            if (p.id && typeof startLevel === "function") {
              // 如果有章节信息，可选择跳转；否则仅提示
              startLevel(p.chapterId || "");
            }
          });
          ul.appendChild(li);
        });
        practiceEl.appendChild(ul);
      })
      .catch(() => {});
  }
}

// 渲染知识罗盘：突出当前课程的重点知识点与关联状态。
function renderKnowledgeCompass(lessonDetail) {
  if (!theoryCompassSection || !theoryCompassList || !theoryCompassStatus) return;
  ensureCompassState();
  state.studentCompass.currentLessonMap.clear();
  const knowledgePoints = Array.isArray(lessonDetail?.knowledgePoints)
    ? lessonDetail.knowledgePoints
    : [];
  if (knowledgePoints.length === 0) {
    theoryCompassSection.classList.add("hidden");
    return;
  }
  theoryCompassSection.classList.remove("hidden");
  theoryCompassList.innerHTML = "";
  theoryCompassStatus.textContent = "自动匹配本课的知识点，高亮正文并展示前置关系。";

  knowledgePoints.forEach((kp) => {
    const name = kp?.name || "";
    if (!name) return;
    state.studentCompass.currentLessonMap.set(name, kp);
    const prereqs = Array.isArray(kp.prerequisites) ? kp.prerequisites : [];
    const source = kp.source === "linked" ? "人工关联" : "自动检测";
    const li = document.createElement("li");
    li.className =
      "rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-800 shadow-sm hover:border-emerald-300/60 transition cursor-pointer";
    li.dataset.kpName = name;
    li.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold text-slate-900">${name}</span>
        <span class="text-[11px] text-emerald-600">${source}${prereqs.length ? ` · 前置 ${prereqs.length}` : ""}</span>
      </div>
      ${kp.summary ? `<p class="mt-1 text-xs text-slate-600">${kp.summary}</p>` : ""}
      ${
        prereqs.length
          ? `<p class="mt-1 text-[11px] text-slate-500">前置：${prereqs.join("、")}</p>`
          : ""
      }
    `;
    li.addEventListener("click", () => {
      showStudentKnowledgeCard(name);
      applyKnowledgeHighlights(theoryLessonContentEl, [{ name }]);
    });
    theoryCompassList.appendChild(li);
  });
}

// 根据课程 ID 返回所在章节/主题等上下文。
function findTheoryLessonContext(lessonId) {
  if (!lessonId) {
    return null;
  }
  const chapters = (state.theory && state.theory.tree) || [];
  for (const chapter of chapters) {
    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    for (const topic of topics) {
      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      for (const lesson of lessons) {
        if (lesson && lesson.id === lessonId) {
          return { chapter, topic, lesson };
        }
      }
    }
  }
  return null;
}

// 获取理论树的首个课程节点，供默认选中。
function getFirstTheoryLesson(tree) {
  const chapters = Array.isArray(tree) ? tree : [];
  for (const chapter of chapters) {
    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    for (const topic of topics) {
      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      if (lessons.length > 0) {
        return { chapter, topic, lesson: lessons[0] };
      }
    }
  }
  return null;
}

// 渲染学生端理论导航树，并绑定点击事件。
function renderStudentTheoryTree() {
  if (!theoryTree) {
    return;
  }
  ensureTheoryState();
  const tree = Array.isArray(state.theory.tree) ? state.theory.tree : [];
  theoryTree.innerHTML = "";

  if (tree.length === 0) {
    if (theoryStatusText) {
      theoryStatusText.textContent = "教师尚未发布理论学习内容，敬请期待。";
    }
    const empty = document.createElement("p");
    empty.className =
      "rounded-2xl border border-dashed border-indigo-400/40 bg-indigo-500/10 p-4 text-sm text-slate-300";
    empty.textContent = "暂无理论学习章节";
    theoryTree.appendChild(empty);
    return;
  }

  if (theoryStatusText) {
    theoryStatusText.textContent = "点击左侧目录即可查看对应的理论内容。";
  }

  const activeLessonId = state.theory.selectedLessonId;
  const root = document.createElement("ul");
  root.className = "theory-tree__list";

  tree.forEach((chapter) => {
    const chapterItem = document.createElement("li");
    chapterItem.className = "theory-tree__item";

    const chapterHeader = document.createElement("div");
    chapterHeader.className = "flex flex-col gap-1";
    const chapterTitle = document.createElement("p");
    chapterTitle.className = "text-sm font-semibold text-slate-100";
    chapterTitle.textContent = chapter.chapterTitle || chapter.chapterId || "章节";
    chapterHeader.appendChild(chapterTitle);
    if (chapter.chapterDescription) {
      const chapterDesc = document.createElement("p");
      chapterDesc.className = "text-xs text-slate-400";
      chapterDesc.textContent = chapter.chapterDescription;
      chapterHeader.appendChild(chapterDesc);
    }
    chapterItem.appendChild(chapterHeader);

    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    const topicList = document.createElement("ul");
    topicList.className = "theory-tree__group";

    if (topics.length === 0) {
      const emptyTopic = document.createElement("li");
      emptyTopic.className = "text-xs text-slate-400";
      emptyTopic.textContent = "该章节暂未发布理论内容";
      topicList.appendChild(emptyTopic);
    }

    topics.forEach((topic) => {
      const topicItem = document.createElement("li");
      topicItem.className = "theory-tree__item";

      const topicButton = document.createElement("div");
      topicButton.className = "theory-tree__button theory-tree__button--static";
      const topicLabel = document.createElement("div");
      topicLabel.className = "flex flex-col gap-1";
      const topicTitle = document.createElement("span");
      topicTitle.className = "text-sm font-semibold";
      topicTitle.textContent = topic.title || topic.id;
      topicLabel.appendChild(topicTitle);
      if (topic.code) {
        const topicCode = document.createElement("span");
        topicCode.className = "theory-tree__meta";
        topicCode.textContent = topic.code;
        topicLabel.appendChild(topicCode);
      }
      if (topic.summary) {
        const topicSummary = document.createElement("span");
        topicSummary.className = "text-xs text-slate-400";
        topicSummary.textContent = topic.summary;
        topicLabel.appendChild(topicSummary);
      }
      topicButton.appendChild(topicLabel);
      topicItem.appendChild(topicButton);

      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      const lessonList = document.createElement("ul");
      lessonList.className = "theory-tree__group";

      if (lessons.length === 0) {
        const emptyLesson = document.createElement("li");
        emptyLesson.className = "text-xs text-slate-400";
        emptyLesson.textContent = "暂无知识点";
        lessonList.appendChild(emptyLesson);
      }

      lessons.forEach((lesson) => {
        const lessonItem = document.createElement("li");
        lessonItem.className = "theory-tree__item";
        const lessonButton = document.createElement("button");
        lessonButton.type = "button";
        lessonButton.dataset.theoryLessonId = lesson.id;
        lessonButton.className = "theory-tree__button";
        if (lesson.id === activeLessonId) {
          lessonButton.classList.add("is-active");
        }
        const lessonLabel = document.createElement("div");
        lessonLabel.className = "flex flex-col gap-1";
        const lessonTitle = document.createElement("span");
        lessonTitle.className = "text-sm font-semibold";
        lessonTitle.textContent = lesson.title || lesson.id;
        lessonLabel.appendChild(lessonTitle);
        const metaParts = [];
        if (lesson.code) metaParts.push(lesson.code);
        if (lesson.sectionTitle) metaParts.push(lesson.sectionTitle);
        if (metaParts.length > 0) {
          const lessonMeta = document.createElement("span");
          lessonMeta.className = "theory-tree__meta";
          lessonMeta.textContent = metaParts.join(" ｜ ");
          lessonLabel.appendChild(lessonMeta);
        }
        lessonButton.appendChild(lessonLabel);
        lessonItem.appendChild(lessonButton);
        lessonList.appendChild(lessonItem);
      });

      topicItem.appendChild(lessonList);
      topicList.appendChild(topicItem);
    });

    chapterItem.appendChild(topicList);
    root.appendChild(chapterItem);
  });

  theoryTree.appendChild(root);
}

// 绑定富文本中的关卡气泡点击事件，实现跳转/提示。
function attachChallengeBubbleHandlers(container) {
  if (!container) {
    return;
  }
  const bubbles = container.querySelectorAll(
    ".challenge-link-bubble[data-chapter-id][data-section-id]",
  );
  if (bubbles.length === 0) {
    return;
  }
  bubbles.forEach((bubble) => {
    bubble.setAttribute("role", "button");
    bubble.setAttribute("tabindex", "0");
    const activate = () => {
      const chapterId = bubble.getAttribute("data-chapter-id");
      const sectionId = bubble.getAttribute("data-section-id");
      if (!chapterId || !sectionId) {
        return;
      }
      setSelectedLevel(chapterId, sectionId);
      expandLevelSelection();
      startLevel();
    };
    bubble.addEventListener("click", activate);
    bubble.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    });
  });
}

// 渲染理论课程正文、知识罗盘和相关关卡按钮。
function renderTheoryLessonContent(lessonDetail) {
  if (!theoryLessonTitleEl || !theoryLessonContentEl || !theoryLessonCodeEl) {
    return;
  }
  if (!lessonDetail) {
    theoryLessonTitleEl.textContent = "请选择理论学习小节";
    theoryLessonCodeEl.textContent = "";
    theoryLessonContentEl.innerHTML = "<p class=\"text-sm text-slate-400\">在左侧选择任意知识点即可查看内容。</p>";
    renderKnowledgeCompass(null);
    if (theoryChallengeContainer) {
      theoryChallengeContainer.classList.add("hidden");
    }
    return;
  }

  theoryLessonTitleEl.textContent = lessonDetail.title || "理论学习";
  theoryLessonCodeEl.textContent = lessonDetail.code || "";
  const htmlContent = typeof lessonDetail.contentHtml === "string" ? lessonDetail.contentHtml : "";
  if (typeof window !== "undefined" && window.DOMPurify) {
    theoryLessonContentEl.innerHTML = window.DOMPurify.sanitize(htmlContent, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["data-chapter-id", "data-section-id", "data-label", "contenteditable"],
    });
  } else {
    theoryLessonContentEl.innerHTML = htmlContent || "";
  }
  if (!theoryLessonContentEl.innerHTML.trim()) {
    theoryLessonContentEl.innerHTML = "<p class=\"text-sm text-slate-400\">教师尚未填写详细内容。</p>";
  }
  attachChallengeBubbleHandlers(theoryLessonContentEl);
  applyKnowledgeHighlights(theoryLessonContentEl, lessonDetail.knowledgePoints || []);
  renderKnowledgeCompass(lessonDetail);
  renderLessonSubgraph(lessonDetail.id || lessonDetail.lessonId);
  if (!theoryChallengeContainer || !theoryChallengeTitleEl) {
    return;
  }
  if (!lessonDetail.sectionId) {
    theoryChallengeContainer.classList.add("hidden");
    return;
  }
  const section = findSection(lessonDetail.chapterId, lessonDetail.sectionId);
  if (!section) {
    theoryChallengeContainer.classList.add("hidden");
    return;
  }
  theoryChallengeTitleEl.textContent = `${section.title || "关卡"}`;
  theoryChallengeContainer.classList.remove("hidden");
}

// 刷新理论板块的选中状态（标题、内容、关联图谱）。
function refreshStudentTheorySelection() {
  ensureTheoryState();
  const lessonId = state.theory.selectedLessonId;
  if (!lessonId) {
    renderTheoryLessonContent(null);
    updateTheoryRelatedPractices(null);
    renderLessonSubgraph(null);
    return;
  }
  const cache = state.theory.lessonCache instanceof Map ? state.theory.lessonCache : null;
  const lessonDetail = cache ? cache.get(lessonId) : null;
  if (lessonDetail) {
    renderTheoryLessonContent(lessonDetail);
    updateTheoryRelatedPractices(lessonId, { preferCache: true });
  } else {
    updateTheoryRelatedPractices(null);
  }
}

if (theoryLessonContentEl) {
  theoryLessonContentEl.addEventListener("click", (event) => {
    const target = event.target.closest("[data-kp-highlight]");
    if (target) {
      const name = target.dataset.kpName || target.textContent || "";
      showStudentKnowledgeCard(name);
    }
  });
}

if (studentLessonGraphRefresh) {
  studentLessonGraphRefresh.addEventListener("click", () => {
    if (state.theory?.selectedLessonId) {
      renderLessonSubgraph(state.theory.selectedLessonId);
    }
  });
}

// 切换选中的理论课程，加载内容与关联练习。
async function selectStudentTheoryLesson(lessonId) {
  ensureTheoryState();
  state.theory.selectedLessonId = lessonId || null;
  renderStudentTheoryTree();
  if (!lessonId) {
    renderTheoryLessonContent(null);
    return;
  }

  let lessonDetail = state.theory.lessonCache.get(lessonId);
  if (!lessonDetail) {
    try {
      const response = await fetchWithAuth(`/api/theory/lessons/${lessonId}`);
      if (!response.ok) {
        throw new Error("无法获取理论学习内容");
      }
      const data = await response.json();
      lessonDetail = data.lesson || null;
      if (lessonDetail) {
        state.theory.lessonCache.set(lessonId, lessonDetail);
      }
    } catch (error) {
      console.error(error);
      if (theoryStatusText) {
        theoryStatusText.textContent = error.message || "无法获取理论学习内容";
      }
    }
  }
  renderTheoryLessonContent(lessonDetail || null);
  if (lessonDetail) {
    await updateTheoryRelatedPractices(lessonId);
  } else {
    updateTheoryRelatedPractices(null);
  }
}

// 拉取并渲染当前课程的关联图谱（知识点/关卡）。
async function renderLessonSubgraph(lessonId) {
  if (!studentLessonGraph) return;
  if (studentLessonGraphInstance && typeof studentLessonGraphInstance.destroy === "function") {
    studentLessonGraphInstance.destroy();
    studentLessonGraphInstance = null;
  }
  if (!lessonId) {
    studentLessonGraph.innerHTML = "<p class='text-xs text-slate-400 p-3'>请选择课时以查看知识图谱</p>";
    return;
  }
  studentLessonGraph.innerHTML = "<p class='text-xs text-slate-400 p-3'>知识图谱加载中...</p>";
  try {
    const resp = await fetchWithAuth(`/api/graph/lesson-network?lessonId=${encodeURIComponent(lessonId)}&limit=800`);
    if (!resp.ok) {
      console.warn("[LessonSubgraph] fetch failed", resp.status);
      studentLessonGraph.innerHTML = "<p class='text-xs text-slate-400 p-3'>知识图谱暂不可用</p>";
      return;
    }
    const text = await resp.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch (err) {
      console.error("[LessonSubgraph] JSON parse error", err, text);
      studentLessonGraph.innerHTML = "<p class='text-xs text-slate-400 p-3'>知识图谱数据异常</p>";
      return;
    }
    const nodes = data.nodes || [];
    const edgesRaw = Array.isArray(data.edges) ? data.edges : [];
    const nodeIds = new Set((nodes || []).map((n) => n.id || n.key || n.name));
    const edges = edgesRaw.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    const highlights = new Set(data.highlights || []);
    console.log("[LessonSubgraph] nodes:", nodes.length, "edges:", edges.length, "highlights:", highlights.size);
    if (nodes.length === 0) {
      studentLessonGraph.innerHTML = "<p class='text-xs text-slate-400 p-3'>本课暂无关联或匹配的知识点</p>";
      return;
    }
    renderLessonKnowledgeMap(studentLessonGraph, nodes, edges, highlights);
  } catch (error) {
    console.error("[LessonSubgraph]", error);
    studentLessonGraph.innerHTML = "<p class='text-xs text-slate-400 p-3'>加载失败</p>";
  }
}

function nodeDisplayId(node) {
  return node?.id || node?.key || node?.name || "";
}

function nodeDisplayTitle(node) {
  return node?.name || node?.title || node?.label || nodeDisplayId(node);
}

function nodeDisplayType(node) {
  return node?.nodeType || node?.label || node?.type || "";
}

function renderLessonKnowledgeMap(container, nodes, edges, highlights) {
  const nodeMap = new Map();
  (nodes || []).forEach((node) => {
    const id = nodeDisplayId(node);
    if (id) nodeMap.set(id, { ...node, id });
  });
  const stageBuckets = new Map();
  const topicBuckets = new Map();
  const pointNodes = [];
  nodeMap.forEach((node) => {
    const type = nodeDisplayType(node);
    if (type === "Stage") stageBuckets.set(node.id, { stage: node, topics: [], points: [] });
    else if (type === "Topic") topicBuckets.set(node.id, { topic: node, points: [] });
    else if (["KnowledgePoint", "Skill", "Terminology"].includes(type)) pointNodes.push(node);
  });

  (edges || []).forEach((edge) => {
    const source = edge.source || edge.from;
    const target = edge.target || edge.to;
    if (edge.type === "CONTAIN_TOPIC" && stageBuckets.has(source) && topicBuckets.has(target)) {
      stageBuckets.get(source).topics.push(topicBuckets.get(target));
    }
    if (edge.type === "INCLUDE_POINT" && topicBuckets.has(source) && nodeMap.has(target)) {
      topicBuckets.get(source).points.push(nodeMap.get(target));
    }
  });

  pointNodes.forEach((point) => {
    const alreadyPlaced = [...topicBuckets.values()].some((topic) => topic.points.some((item) => item.id === point.id));
    if (alreadyPlaced) return;
    const stageName = point.stage || point.stageName;
    const stageBucket = [...stageBuckets.values()].find((bucket) => nodeDisplayTitle(bucket.stage) === stageName);
    if (stageBucket) stageBucket.points.push(point);
  });

  const stages = [...stageBuckets.values()];
  container.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "h-full overflow-auto p-3";
  const grid = document.createElement("div");
  grid.className = "grid gap-3 md:grid-cols-2";

  const renderPoint = (point) => {
    const title = nodeDisplayTitle(point);
    const isHighlighted = highlights && (highlights.has(point.id) || highlights.has(point.name) || highlights.has(title));
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "w-full rounded-lg border px-2.5 py-2 text-left text-xs transition",
      isHighlighted ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300",
    ].join(" ");
    button.innerHTML = `<span class="font-semibold">${escapeHtml(title)}</span><span class="ml-2 text-[10px] text-slate-400">${escapeHtml(nodeDisplayType(point) || "KnowledgePoint")}</span>`;
    button.addEventListener("click", () => showStudentKnowledgeCard(title));
    return button;
  };

  if (stages.length === 0) {
    const loose = document.createElement("section");
    loose.className = "rounded-xl border border-slate-200 bg-slate-50 p-3";
    loose.innerHTML = '<h5 class="mb-2 text-sm font-semibold text-slate-900">本课知识点</h5>';
    const list = document.createElement("div");
    list.className = "space-y-2";
    pointNodes.forEach((point) => list.appendChild(renderPoint(point)));
    loose.appendChild(list);
    grid.appendChild(loose);
  } else {
    stages.forEach((bucket) => {
      const card = document.createElement("section");
      card.className = "rounded-xl border border-slate-200 bg-slate-50 p-3";
      card.innerHTML = `<h5 class="text-sm font-semibold text-slate-900">${escapeHtml(nodeDisplayTitle(bucket.stage))}</h5>`;
      const body = document.createElement("div");
      body.className = "mt-2 space-y-2";
      bucket.topics.forEach((topicBucket) => {
        const topicEl = document.createElement("div");
        topicEl.className = "rounded-lg border border-slate-200 bg-white/80 p-2";
        topicEl.innerHTML = `<div class="mb-1 text-[11px] font-semibold text-amber-700">${escapeHtml(nodeDisplayTitle(topicBucket.topic))}</div>`;
        const list = document.createElement("div");
        list.className = "space-y-1.5";
        topicBucket.points.forEach((point) => list.appendChild(renderPoint(point)));
        if (!list.children.length) {
          list.innerHTML = '<p class="text-[11px] text-slate-400">暂无知识点</p>';
        }
        topicEl.appendChild(list);
        body.appendChild(topicEl);
      });
      bucket.points.forEach((point) => body.appendChild(renderPoint(point)));
      if (!body.children.length) {
        body.innerHTML = '<p class="text-[11px] text-slate-400">暂无知识点</p>';
      }
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  shell.appendChild(grid);
  container.appendChild(shell);
  studentLessonGraphInstance = { destroy: () => { container.innerHTML = ""; } };
}

// 初始化理论板块：加载课程树、默认选择、刷新罗盘。
async function loadStudentTheory(options = {}) {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  ensureTheoryState();
  const keepSelection = !!options.keepSelection;
  try {
    const response = await fetchWithAuth("/api/theory");
    if (!response.ok) {
      throw new Error("无法加载理论学习目录");
    }
    const data = await response.json();
    const tree = Array.isArray(data.theory) ? data.theory : [];
    state.theory.tree = tree;

    if (!keepSelection || !findTheoryLessonContext(state.theory.selectedLessonId)) {
      const first = getFirstTheoryLesson(tree);
      state.theory.selectedLessonId = first && first.lesson ? first.lesson.id : null;
    }

    renderStudentTheoryTree();
    if (state.theory.selectedLessonId) {
      await selectStudentTheoryLesson(state.theory.selectedLessonId);
    } else {
      renderTheoryLessonContent(null);
    }
  } catch (error) {
    console.error(error);
    if (theoryStatusText) {
      theoryStatusText.textContent = error.message || "无法加载理论学习目录";
    }
    if (theoryTree) {
      const failure = document.createElement("div");
      failure.className = "rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200";
      failure.textContent = "加载理论学习内容失败，请稍后重试。";
      theoryTree.innerHTML = "";
      theoryTree.appendChild(failure);
    }
    if (state.studentActiveView === "theory" && theoryPanel) {
      theoryPanel.classList.remove("hidden");
    }
  }
}

// 根据 session 是否存在、模式等控制按钮启用状态。
function updateSessionControls() {
  if (resetSessionBtn) {
    resetSessionBtn.disabled = !state.sessionId;
  }
}

// 切换学生弹窗内的选项卡状态。
function updateStudentOptionState(activeTab) {
  if (!studentOptionButtons || studentOptionButtons.length === 0) {
    return;
  }
  studentOptionButtons.forEach((button) => {
    const isActive = button.dataset.studentOption === activeTab;
    button.classList.toggle("student-option-active", isActive);
    button.classList.toggle("shadow-lg", isActive);
    button.classList.toggle("shadow-blue-500/30", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

// 激活学生端体验区域的 tab，并渲染对应模块。
function activateStudentTab(tabId = null) {
  if (tabId) {
    openStudentModal(tabId);
    return;
  }

  currentStudentModalTab = null;
  updateStudentOptionState(null);

  if (studentModal) {
    studentModal.removeAttribute("data-active-tab");
  }
  if (studentModalOverlay) {
    studentModalOverlay.classList.add("hidden");
  }
  if (document.body) {
    document.body.classList.remove("overflow-hidden");
  }
}

// 激活弹窗中的 tab，同时刷新 UI。
function activateStudentModalTab(tabId) {
  if (!studentModalTabButtons || studentModalTabButtons.length === 0) {
    updateStudentOptionState(null);
    return;
  }
  const buttonList = Array.from(studentModalTabButtons);
  const panelList = Array.from(studentModalPanels || []);
  const defaultTab = buttonList[0] ? buttonList[0].dataset.modalTab : null;
  const targetTab = buttonList.some((btn) => btn.dataset.modalTab === tabId)
    ? tabId
    : defaultTab;

  buttonList.forEach((button) => {
    const isActive = button.dataset.modalTab === targetTab;
    button.classList.toggle("tab-trigger-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  panelList.forEach((panel) => {
    const isActive = panel.dataset.modalPanel === targetTab;
    panel.classList.toggle("tab-panel-active", isActive);
  });

  currentStudentModalTab = targetTab || null;
  updateStudentOptionState(currentStudentModalTab);
  if (studentModal) {
    studentModal.setAttribute("data-active-tab", currentStudentModalTab || "");
  }
}

// 打开学生侧弹窗并可选指定 tab。
function openStudentModal(tabId) {
  if (!studentModalOverlay) {
    return;
  }
  studentModalOverlay.classList.remove("hidden");
  if (document.body) {
    document.body.classList.add("overflow-hidden");
  }
  activateStudentModalTab(tabId);
  if (studentModalCloseBtn) {
    studentModalCloseBtn.focus();
  }
}

// 关闭学生弹窗并移除遮罩。
function closeStudentModal() {
  if (!studentModalOverlay) {
    return;
  }
  studentModalOverlay.classList.add("hidden");
  if (document.body) {
    document.body.classList.remove("overflow-hidden");
  }
  currentStudentModalTab = null;
  updateStudentOptionState(null);
  if (studentModal) {
    studentModal.removeAttribute("data-active-tab");
  }
}

// 打开密码修改弹窗并重置输入。
function openStudentPasswordModal() {
  if (!studentPasswordModal) {
    return;
  }
  studentPasswordModal.classList.remove("hidden");
  if (document.body) {
    document.body.classList.add("overflow-hidden");
  }
  if (studentPasswordForm) {
    studentPasswordForm.reset();
  }
  if (studentPasswordStatus) {
    studentPasswordStatus.textContent = "";
  }
  if (studentPasswordCurrent) {
    studentPasswordCurrent.focus();
  }
}

// 关闭密码修改弹窗。
function closeStudentPasswordModal() {
  if (!studentPasswordModal) {
    return;
  }
  studentPasswordModal.classList.add("hidden");
  if (document.body) {
    document.body.classList.remove("overflow-hidden");
  }
}

// 管理员入口的 tab 切换（仅学生页面复用）。
function activateAdminTab(tabId) {
  if (!adminTabButtons || adminTabButtons.length === 0) {
    return;
  }
  const buttonList = Array.from(adminTabButtons);
  const panelList = Array.from(adminTabPanels || []);
  const defaultTab = buttonList[0] ? buttonList[0].dataset.adminTab : null;
  const targetTab = buttonList.some((btn) => btn.dataset.adminTab === tabId)
    ? tabId
    : defaultTab;

  buttonList.forEach((button) => {
    const isActive = button.dataset.adminTab === targetTab;
    button.classList.toggle("tab-trigger-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  panelList.forEach((panel) => {
    const isActive = panel.dataset.adminPanel === targetTab;
    panel.classList.toggle("tab-panel-active", isActive);
  });
}

// 展示体验面板（对话/复盘/理论等）。
function showExperience() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  studentDashboard.classList.remove("hidden");
  if (studentHomeSection) {
    studentHomeSection.classList.add("hidden");
  }
  if (theoryPanel) {
    theoryPanel.classList.add("hidden");
  }
  experienceSection.classList.remove("hidden");
  ensureReviewState();
  const reviewModeActive =
    isReviewSection(state.activeLevel?.sectionId) &&
    !!(state.review && state.review.documentText && state.review.documentText.trim());
  const emailModeActive = isEmailModeActive();
  setActiveExperienceModule(reviewModeActive ? "review" : "chat");
  if (chatInputEl) {
    chatInputEl.disabled = reviewModeActive || emailModeActive;
    if (!reviewModeActive && !emailModeActive) {
      chatInputEl.focus();
    }
  }
  if (sendMessageBtn) {
    sendMessageBtn.disabled = reviewModeActive || emailModeActive;
  }
  if (emailModeActive) {
    renderEmailComposer();
  }
  state.studentActiveView = "practice";
}

// 回到学生首页卡片视图。
function showStudentDashboardHome() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  studentDashboard.classList.remove("hidden");
  hideExperience();
  collapseLevelSelection();
  if (studentHomeSection) {
    studentHomeSection.classList.remove("hidden");
  }
  if (levelSelectionPanel) {
    levelSelectionPanel.classList.add("hidden");
  }
  if (theoryPanel) {
    theoryPanel.classList.add("hidden");
  }
  state.studentActiveView = "home";
}

// 进入理论学习模式，隐藏对话模块。
function enterTheoryMode(options = {}) {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  studentDashboard.classList.remove("hidden");
  hideExperience();
  collapseLevelSelection();
  if (studentHomeSection) {
    studentHomeSection.classList.add("hidden");
  }
  if (theoryPanel) {
    theoryPanel.classList.remove("hidden");
  }
  state.studentActiveView = "theory";
  ensureTheoryState();
  renderStudentTheoryTree();
  refreshStudentTheorySelection();
  if (options.scrollIntoView && theoryPanel && typeof theoryPanel.scrollIntoView === "function") {
    theoryPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// 隐藏体验区域，返回章节选择。
function hideExperience() {
  experienceSection.classList.add("hidden");
  if (chatInputEl) {
    chatInputEl.disabled = true;
  }
  if (sendMessageBtn) {
    sendMessageBtn.disabled = true;
  }
}

// 回到章节/关卡选择界面，可选清除当前关卡。
function goToLevelSelection({ clearSelection = false, showPanel = true } = {}) {
  if (clearSelection) {
    state.selectedLevel = { chapterId: null, sectionId: null };
  }
  state.sessionId = null;
  state.activeLevel = {
    chapterId: null,
    sectionId: null,
    difficulty: difficultySelect ? difficultySelect.value : "balanced",
    mode: "",
  };
  ensureSessionState();
  state.sessionDeck = [];
  state.sessionMessages = new Map();
  state.simulatedSessions = new Set();
  state.unreadSessions = new Set();
  state.activeSessionId = null;
  state.messages = [];
  state.emailDraft = { subject: "", body: "", signature: "" };
  renderChat();
  renderScenario({});
  resetEvaluation();
  resetReviewState();
  hideExperience();
  if (showPanel) {
    expandLevelSelection();
  } else {
    collapseLevelSelection();
  }
  updateSelectedLevelDetail();
  updateSessionControls();
  if (chatInputEl) {
    chatInputEl.value = "";
  }
  renderSessionRail();
  setChatInputAvailability(false);
}

// 清空评估信息与雷达图。
function resetEvaluation() {
  evaluationScoreEl.textContent = "--";
  evaluationScoreEl.dataset.value = "0";
  if (evaluationScoreLabelEl) evaluationScoreLabelEl.textContent = "";
  if (evaluationCommentaryEl) evaluationCommentaryEl.textContent = "等待新的对话内容...";
  if (evaluationActionsEl) evaluationActionsEl.innerHTML = "";
  if (evaluationKnowledgeEl) evaluationKnowledgeEl.innerHTML = "";
  updateScoreRing(0, "#cbd5e1");
  setEvaluationLoading(false);
  if (evaluationRecommendationsSection) {
    evaluationRecommendationsSection.classList.add("hidden");
  }
  if (evaluationRecommendationsStatus) {
    setStatusText(evaluationRecommendationsStatus, "");
  }
  if (evaluationRecommendationsList) {
    evaluationRecommendationsList.innerHTML = "";
  }
}

// ========== 语音输入（录音 -> 后端转写） ==========
let asrSocket = null;
let asrStreaming = false;
let asrBuffer = "";
let asrAudioContext = null;
let asrProcessor = null;
let asrStream = null;
let asrStopping = false;
let voiceMode = state.voice?.mode || "asr_only"; // asr_only | realtime
let asrCommittedText = "";
let asrSegments = [];
let asrCurrentPartial = "";
let asrLastEndText = "";
let asrFinalized = false;
let voiceSendOnStop = false;
let asrStopTimer = null;

// ========== TTS 播放队列 ==========
const ttsQueue = []; // {seq, url}
let ttsPlaying = false;
let ttsBuffer = "";
let ttsCurrentAudio = null;
let ttsCursor = 0; // 已处理的文本长度（用于增量分句）
let ttsSeq = 0; // 送入 TTS 的序号，确保播放顺序
let ttsChain = Promise.resolve(); // 串行化 TTS 请求，防止乱序返回
let voiceCallActive = false;
let voiceIncoming = false;
let voiceCallOpeningLine = "";
let voiceDialTimer = null;
let voiceCallHideTimer = null;
const voiceCallDrag = { active: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };
const ringAudio = new Audio("/static/audio/ring.mp3"); // 请将铃声文件放置在 static/audio/ring.mp3
ringAudio.loop = true;

function refreshVoiceModeUI() {
  if (voiceCallActive && voiceCallOverlay) {
    voiceCallOverlay.classList.remove("hidden");
    if (voiceCallWindow) {
      voiceCallWindow.classList.add("voice-call-open");
    }
  } else if (voiceCallOverlay) {
    if (voiceCallHideTimer) return;
    voiceCallOverlay.classList.add("hidden");
  }
}

function setVoiceMode(mode) {
  voiceMode = mode === "realtime" ? "realtime" : "asr_only";
  if (state.voice) {
    state.voice.mode = voiceMode;
  }
  // 切回纯 ASR 时停止/清空 TTS
  if (voiceMode === "asr_only") {
    ttsBuffer = "";
    ttsCursor = 0;
    ttsSeq = 0;
    ttsQueue.length = 0;
    if (ttsCurrentAudio) {
      try {
        ttsCurrentAudio.pause();
      } catch (err) {
        /* ignore */
      }
      ttsCurrentAudio = null;
    }
    ttsPlaying = false;
  }
  refreshVoiceModeUI();
}

// TTS 队列播放
function playNextTts() {
  if (ttsQueue.length === 0) {
    ttsPlaying = false;
    ttsCurrentAudio = null;
    return;
  }
  ttsPlaying = true;
  const { url } = ttsQueue.shift();
  if (asrStreaming) {
    stopVoiceRecording();
  }
  const audio = new Audio(url);
  ttsCurrentAudio = audio;
  audio.onended = () => {
    URL.revokeObjectURL(url);
    ttsCurrentAudio = null;
    playNextTts();
  };
  audio.onerror = () => {
    URL.revokeObjectURL(url);
    ttsCurrentAudio = null;
    playNextTts();
  };
  audio.play().catch((err) => {
    console.warn("[TTS] autoplay blocked", err);
    ttsCurrentAudio = null;
    playNextTts();
  });
}

async function enqueueTtsSentence(sentence) {
  const text = (sentence || "").trim();
  if (!text || voiceMode !== "realtime") return;
  const seq = ++ttsSeq;
  // 串行执行 TTS 请求，防止返回乱序
  ttsChain = ttsChain
    .catch(() => {}) // 忽略前一条错误，继续后续
    .then(async () => {
      try {
        const res = await fetchWithAuth("/api/tts/synthesize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) {
          console.warn("[TTS] synthesize failed", res.status, "seq", seq);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        ttsQueue.push({ seq, url });
        ttsQueue.sort((a, b) => a.seq - b.seq);
        if (!ttsPlaying) {
          playNextTts();
        }
      } catch (err) {
        console.warn("[TTS] enqueue error", err, "seq", seq);
      }
    });
}

function processTtsStream(fullText, isEnd = false) {
  if (voiceMode !== "realtime") return;
  const incoming = (fullText || "").toString();
  if (!incoming) {
    if (isEnd && ttsBuffer.trim()) {
      enqueueTtsSentence(ttsBuffer.trim());
      ttsBuffer = "";
    }
    return;
  }
  // 只处理新增的文本片段，避免重复朗读
  const delta = incoming.slice(ttsCursor);
  ttsCursor = incoming.length;
  if (delta) {
    ttsBuffer += delta;
  }
  const sentences = [];
  const regex = /[^。！？!?\\.]+[。！？!?\\.]/g;
  let match;
  while ((match = regex.exec(ttsBuffer)) !== null) {
    sentences.push(match[0]);
  }
  // 移除已提取的部分
  if (sentences.length > 0) {
    const consumed = sentences.reduce((sum, s) => sum + s.length, 0);
    ttsBuffer = ttsBuffer.slice(consumed);
  }
  if (isEnd && ttsBuffer.trim()) {
    sentences.push(ttsBuffer.trim());
    ttsBuffer = "";
  }
  sentences.forEach((s) => enqueueTtsSentence(s));
}

function showVoiceCallOverlay(stateText, hintText, showAccept = false) {
  if (voiceCallOverlay) {
    if (voiceCallHideTimer) {
      clearTimeout(voiceCallHideTimer);
      voiceCallHideTimer = null;
    }
    voiceCallOverlay.classList.remove("hidden");
  }
  if (voiceCallStatus) voiceCallStatus.textContent = stateText || "";
  if (voiceCallHint) voiceCallHint.textContent = hintText || "";
  const aiCompany = (state.currentScenario && state.currentScenario.aiCompany) || {};
  const aiName = (aiCompany && aiCompany.name) || state.currentScenario?.aiRole || "AI";
  if (voiceCallName) voiceCallName.textContent = aiName;
  if (voiceCallTitle) voiceCallTitle.textContent = state.currentScenario?.aiRole || "Voice Chat";
  if (voiceCallAvatar) {
    const initials = aiName ? aiName.slice(0, 2).toUpperCase() : "AI";
    voiceCallAvatar.textContent = initials;
  }
  const showHangup = !showAccept;
  if (voiceCallAcceptWrap) {
    voiceCallAcceptWrap.classList.toggle("hidden", !showAccept);
  } else if (voiceCallAccept) {
    voiceCallAccept.classList.toggle("hidden", !showAccept);
  }
  if (voiceCallHangupWrap) {
    voiceCallHangupWrap.classList.toggle("hidden", !showHangup);
  }
  if (voiceCallWindow) {
    voiceCallWindow.classList.add("voice-call-open");
    if (isMobileViewport()) {
      voiceCallWindow.style.transform = "";
    }
  }
  refreshVoiceModeUI();
}

function hideVoiceCallOverlay() {
  if (voiceCallWindow) {
    voiceCallWindow.classList.remove("voice-call-open");
  }
  if (voiceCallOverlay) {
    if (isMobileViewport()) {
      if (voiceCallHideTimer) {
        clearTimeout(voiceCallHideTimer);
      }
      voiceCallHideTimer = setTimeout(() => {
        voiceCallOverlay.classList.add("hidden");
        voiceCallHideTimer = null;
      }, 220);
    } else {
      voiceCallOverlay.classList.add("hidden");
    }
  }
  refreshVoiceModeUI();
}

function toggleVoiceCallMinimize() {
  if (!voiceCallWindow) return;
  voiceCallWindow.classList.toggle("minimized");
}

function initVoiceCallDrag() {
  if (!voiceCallHeader || !voiceCallWindow) return;
  const onPointerMove = (event) => {
    if (!voiceCallDrag.active) return;
    const point = event.touches ? event.touches[0] : event;
    const dx = point.clientX - voiceCallDrag.startX;
    const dy = point.clientY - voiceCallDrag.startY;
    voiceCallDrag.offsetX += dx;
    voiceCallDrag.offsetY += dy;
    voiceCallDrag.startX = point.clientX;
    voiceCallDrag.startY = point.clientY;
    voiceCallWindow.style.transform = `translate(${voiceCallDrag.offsetX}px, ${voiceCallDrag.offsetY}px)`;
  };
  const onPointerEnd = () => {
    voiceCallDrag.active = false;
  };
  const onPointerStart = (event) => {
    if (window.innerWidth <= 768 && !voiceCallWindow.classList.contains("minimized")) {
      return;
    }
    const point = event.touches ? event.touches[0] : event;
    voiceCallDrag.active = true;
    voiceCallDrag.startX = point.clientX;
    voiceCallDrag.startY = point.clientY;
  };
  voiceCallHeader.addEventListener("mousedown", onPointerStart);
  voiceCallHeader.addEventListener("touchstart", onPointerStart, { passive: true });
  document.addEventListener("mousemove", onPointerMove);
  document.addEventListener("touchmove", onPointerMove, { passive: true });
  document.addEventListener("mouseup", onPointerEnd);
  document.addEventListener("touchend", onPointerEnd);
}


function startVoiceCallManually() {
  startVoiceCallFlow(false, "");
}

function startVoiceCallFlow(isIncoming, openingLine) {
  if (voiceCallActive) return;
  voiceMode = "realtime";
  if (state.voice) {
    state.voice.mode = "realtime";
  }
  if (voiceCallWindow) {
    voiceCallWindow.classList.remove("minimized");
  }
  voiceCallActive = true;
  voiceIncoming = isIncoming;
  voiceCallOpeningLine = isIncoming ? (openingLine || getOpeningLineFallback()) : "";
  ttsBuffer = "";
  ttsCursor = 0;
  ttsSeq = 0;
  ttsQueue.length = 0;
  stopVoiceRecording();
  if (isIncoming) {
    showVoiceCallOverlay("来电中...", "点击接听", true);
    try {
      ringAudio.currentTime = 0;
      ringAudio.play().catch(() => {});
    } catch (err) {}
  } else {
    showVoiceCallOverlay("正在拨号...", "请稍候，连接中", false);
    if (voiceDialTimer) {
      clearTimeout(voiceDialTimer);
      voiceDialTimer = null;
    }
    voiceDialTimer = setTimeout(() => {
      connectOutgoingCall();
    }, 5000);
  }
  refreshVoiceModeUI();
}

function acceptIncomingCall() {
  if (!voiceIncoming) return;
  try {
    ringAudio.pause();
  } catch (err) {}
  voiceIncoming = false;
  showVoiceCallOverlay("通话中", "按住说话，松开发送", false);
  if (voiceCallOpeningLine) {
    enqueueTtsSentence(voiceCallOpeningLine);
  }
}

function hangupVoiceCall() {
  try {
    ringAudio.pause();
  } catch (err) {}
  if (voiceDialTimer) {
    clearTimeout(voiceDialTimer);
    voiceDialTimer = null;
  }
  voiceCallActive = false;
  voiceIncoming = false;
  voiceCallOpeningLine = "";
  voiceSendOnStop = false;
  asrCommittedText = "";
  voiceMode = "asr_only";
  if (state.voice) state.voice.mode = "asr_only";
  stopVoiceRecording();
  hideVoiceCallOverlay();
  // 挂断视为失败提示
  alert("通话已挂断");
}

function getOpeningLineFallback() {
  const lastAssistant = state.messages.find((m) => m.role === "assistant");
  if (lastAssistant && lastAssistant.content) return lastAssistant.content;
  return "您好，这里是语音练习座席，我们开始实战演练。";
}

function maybeStartIncomingCall(openingLine) {
  // 30% 概率触发自动来电
  if (Math.random() < 0.3) {
    startVoiceCallFlow(true, openingLine || getOpeningLineFallback());
  }
}

function connectOutgoingCall() {
  voiceDialTimer = null;
  if (!voiceCallActive || voiceIncoming) return;
  showVoiceCallOverlay("已接通", "按住说话，松开发送", false);
}

function sendManualVoiceMessage() {
  // 在通话模式下提供手动提前发送
  if (!voiceCallActive) return;
  if (ttsPlaying) {
    return;
  }
  if (asrStreaming) {
    return;
  }
  voiceSendOnStop = true;
  startVoiceRecording();
}

// 初始化模式样式
setVoiceMode(voiceMode);
initVoiceCallDrag();
initCopilotDrag();
initScenarioWindowDrag();

async function startVoiceRecording() {
  if (voiceCallActive && ttsPlaying) {
    return;
  }
  if (asrStreaming) {
    return;
  }
  asrStopping = false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("当前浏览器不支持麦克风录音");
    return;
  }
  try {
    asrStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${window.location.host}/api/asr/stream`;
    asrSocket = new WebSocket(wsUrl);
    asrStreaming = true;
    asrStopping = false;
    asrSocket.binaryType = "arraybuffer";

    asrSocket.onopen = () => {
      console.debug("[ASR] WS open");
      // 建立音频处理管线：采样 → 重采样 → PCM int16 → WS
      asrAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (asrAudioContext.state === "suspended") {
        asrAudioContext.resume();
      }
      const source = asrAudioContext.createMediaStreamSource(asrStream);
      asrProcessor = asrAudioContext.createScriptProcessor(4096, 1, 1);
      asrProcessor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const pcmBuffer = floatToPcm16k(input, asrAudioContext.sampleRate);
        if (asrSocket && asrSocket.readyState === WebSocket.OPEN) {
          console.debug("[ASR] send bytes", pcmBuffer.byteLength);
          asrSocket.send(pcmBuffer);
        }
      };
      source.connect(asrProcessor);
      asrProcessor.connect(asrAudioContext.destination);
      if (chatVoiceBtn) {
        chatVoiceBtn.classList.add("border-emerald-400", "text-emerald-600");
        chatVoiceBtn.textContent = "⏹";
      }
      const currentText = chatInputEl ? chatInputEl.value.trim() : "";
      if (currentText) {
        asrCommittedText = currentText;
      } else if (!asrCommittedText) {
        asrCommittedText = "";
      }
      asrBuffer = "";
      asrSegments = [];
      asrCurrentPartial = "";
      asrLastEndText = "";
      asrFinalized = false;
    };

    asrSocket.onmessage = (event) => {
      console.debug("[ASR] recv", event.data);
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "asr_partial" && payload.text) {
          const nextText = payload.text.trim();
          if (!nextText) return;
          if (payload.isEnd) {
            if (nextText !== asrLastEndText) {
              const lastSegment = asrSegments[asrSegments.length - 1] || "";
              if (nextText && nextText !== lastSegment) {
                asrSegments.push(nextText);
              }
              asrLastEndText = nextText;
            }
            asrCurrentPartial = "";
          } else if (nextText !== asrCurrentPartial) {
            asrCurrentPartial = nextText;
          }
          const combined = [...asrSegments, asrCurrentPartial].filter(Boolean).join(" ");
          if (chatInputEl) {
            const prefix = asrCommittedText ? `${asrCommittedText} ` : "";
            chatInputEl.value = `${prefix}${combined}`.trim();
          }
        }
        if (payload.event === "asr_complete") {
          if (asrFinalized) return;
          asrFinalized = true;
          const spoken = [...asrSegments, asrCurrentPartial].filter(Boolean).join(" ").trim();
          if (voiceSendOnStop && spoken) {
            voiceSendOnStop = false;
            if (asrCommittedText) {
              asrCommittedText = `${asrCommittedText} ${spoken}`.trim();
            } else {
              asrCommittedText = spoken;
            }
            if (chatInputEl) {
              chatInputEl.value = asrCommittedText;
            }
            sendMessageWithContent(spoken);
          } else {
            voiceSendOnStop = false;
          }
          asrBuffer = "";
          asrSegments = [];
          asrCurrentPartial = "";
          asrLastEndText = "";
          if (asrStopTimer) {
            clearTimeout(asrStopTimer);
            asrStopTimer = null;
          }
          if (asrSocket && asrSocket.readyState === WebSocket.OPEN) {
            try {
              asrSocket.close();
            } catch (err) {
              /* ignore */
            }
          }
        }
        if (payload.event === "asr_error" && payload.error) {
          alert(`语音识别出错：${payload.error}`);
        }
      } catch (err) {
        console.warn("[ASR] 无法解析 WS 消息", err);
      }
    };

    asrSocket.onerror = () => {
      console.error("[ASR] WS error");
      if (!asrStopping) {
        alert("语音通道连接失败");
        stopVoiceRecording();
      }
    };

    asrSocket.onclose = () => {
      console.debug("[ASR] WS closed");
      asrStreaming = false;
      asrStopping = false;
      asrSocket = null;
      if (chatVoiceBtn) {
        chatVoiceBtn.classList.remove("border-emerald-400", "text-emerald-600");
        chatVoiceBtn.textContent = "🎤";
      }
      refreshVoiceModeUI();
    };
  } catch (err) {
    console.error("[ASR] 无法开始录音", err);
    alert("无法获取麦克风权限");
  }
}

function stopVoiceRecording() {
  asrStopping = true;
  if (asrProcessor) {
    asrProcessor.disconnect();
    asrProcessor = null;
  }
  if (asrAudioContext) {
    asrAudioContext.close();
    asrAudioContext = null;
  }
  if (asrStream) {
    asrStream.getTracks().forEach((t) => t.stop());
    asrStream = null;
  }
  if (asrSocket && asrSocket.readyState === WebSocket.OPEN) {
    try {
      asrSocket.send("__STOP__");
      if (voiceSendOnStop) {
        if (asrStopTimer) clearTimeout(asrStopTimer);
        asrStopTimer = setTimeout(() => {
          if (asrSocket && asrSocket.readyState === WebSocket.OPEN) {
            asrSocket.close();
          }
        }, 1500);
      } else {
        asrSocket.close();
      }
    } catch (err) {
      console.error("[ASR] 关闭 WS 失败", err);
    }
  }
  if (!asrSocket) {
    asrStopping = false;
  }
  asrStreaming = false;
  if (chatVoiceBtn) {
    chatVoiceBtn.classList.remove("border-emerald-400", "text-emerald-600");
    chatVoiceBtn.textContent = "🎤";
  }
  refreshVoiceModeUI();
}

function toggleVoiceRecording() {
  if (voiceCallActive) return; // 通话模式下不使用文字录音按钮
  if (asrStreaming) {
    stopVoiceRecording();
  } else {
    setVoiceMode("asr_only");
    startVoiceRecording();
  }
}

// 将 float32 数据重采样为 PCM16 16k
function floatToPcm16k(float32Array, sourceSampleRate) {
  const targetRate = 16000;
  const sampleRateRatio = sourceSampleRate / targetRate;
  const newLength = Math.round(float32Array.length / sampleRateRatio);
  const pcm = new Int16Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < float32Array.length; i++) {
      accum += float32Array[i];
      count++;
    }
    const sample = accum / count;
    const s = Math.max(-1, Math.min(1, sample));
    pcm[offsetResult] = s < 0 ? s * 0x8000 : s * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return pcm.buffer;
}

// 通用列表渲染，支持有序/无序模式。
function renderList(container, items, ordered = false) {
  const values = Array.isArray(items)
    ? items
    : items
    ? [items]
    : [];

  container.innerHTML = "";
  if (values.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "暂无信息";
    empty.className = "text-xs text-slate-500";
    container.appendChild(empty);
    return;
  }

  values.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    container.appendChild(li);
  });
}

// 渲染知识点列表，附带标签/简介。
function renderKnowledge(container, items) {
  if (!container) {
    return;
  }
  const values = Array.isArray(items)
    ? items
    : items
    ? [items]
    : [];

  container.innerHTML = "";
  if (values.length === 0) {
    const pill = document.createElement("span");
    pill.className = "knowledge-pill";
    pill.textContent = "暂无知识点";
    container.appendChild(pill);
    return;
  }

  values.forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "knowledge-pill";
    if (item && typeof item === "object") {
      pill.textContent = item.label || item.name || item.title || "知识点";
      if (item.description || item.detail) {
        pill.dataset.tooltip = item.description || item.detail;
      }
    } else {
      pill.textContent = item;
    }
    container.appendChild(pill);
  });
}

function renderEvaluationKnowledge(items) {
  if (!evaluationKnowledgeEl) return;
  const statusEl = document.getElementById("evaluation-knowledge-status");
  evaluationKnowledgeEl.innerHTML = "";
  const values = Array.isArray(items) ? items : items ? [items] : [];
  if (values.length === 0) {
    if (statusEl) statusEl.textContent = "";
    const pill = document.createElement("span");
    pill.className = "knowledge-pill";
    pill.textContent = "暂无知识点";
    evaluationKnowledgeEl.appendChild(pill);
    return;
  }
  const hasKeyword = values.some((item) => item && typeof item === "object" && item.source === "keyword");
  const hasAi = values.some((item) => item && typeof item === "object" && item.source === "ai");
  if (statusEl) {
    statusEl.innerHTML = "";
    const main = document.createElement("span");
    if (hasAi) {
      main.textContent = "AI 识别并补充相关知识点";
    } else if (hasKeyword) {
      main.textContent = "你可能需要了解...";
    } else {
      main.textContent = "";
    }
    statusEl.appendChild(main);

    const badgeText = hasAi ? "AI识别" : hasKeyword ? "关键字识别" : "";
    if (badgeText) {
      const badge = document.createElement("span");
      badge.style.marginLeft = "0.5rem";
      badge.style.display = "inline-flex";
      badge.style.alignItems = "center";
      badge.style.gap = "0.3rem";
      badge.style.fontSize = "11px";
      badge.style.color = "rgb(100, 116, 139)";
      const dot = document.createElement("span");
      dot.style.width = "6px";
      dot.style.height = "6px";
      dot.style.borderRadius = "9999px";
      dot.style.background = hasAi ? "#10b981" : "#3b82f6";
      badge.appendChild(dot);
      const txt = document.createElement("span");
      txt.textContent = badgeText;
      badge.appendChild(txt);
      statusEl.appendChild(badge);
    }
  }
  values.forEach((item) => {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "knowledge-pill";
    const labelSource =
      (item && (item.point || item.label || item.name || item.title || item.content)) || item || "知识点";
    const label = typeof labelSource === "string" ? labelSource : String(labelSource || "知识点");
    const detail =
      (item && (item.description || item.detail || item.summary || item.text || item.content)) || "";
    const source = item && typeof item === "object" ? item.source : "";
    const isKeyword = source === "keyword";
    const pillBg = isKeyword ? "rgba(59, 130, 246, 0.14)" : "rgba(16, 185, 129, 0.14)";
    const pillColor = isKeyword ? "#2563eb" : "#059669";
    const graphPayload = {
      name: item && (item.name || item.label || label),
      prerequisites: item && item.prerequisites,
      relations: item && item.relations,
      lessonId: item && item.lessonId,
    };
    pill.style.background = pillBg;
    pill.style.color = pillColor;
    pill.style.cursor = "pointer";
    pill.textContent = label;
    pill.addEventListener("click", () => {
      showKnowledgePeek(label, detail);
      renderKnowledgePeekGraph(graphPayload);
    });
    evaluationKnowledgeEl.appendChild(pill);
  });
}

function setEvaluationTab(tab) {
  if (!evaluationAnalysisPanel || !evaluationLexicalPanel || !evaluationTabAnalysis || !evaluationTabLexical) return;
  const isLexical = tab === "lexical";
  evaluationAnalysisPanel.classList.toggle("hidden", isLexical);
  evaluationLexicalPanel.classList.toggle("hidden", !isLexical);
  evaluationTabAnalysis.classList.toggle("bg-blue-600", !isLexical);
  evaluationTabAnalysis.classList.toggle("text-white", !isLexical);
  evaluationTabAnalysis.classList.toggle("bg-slate-200", isLexical);
  evaluationTabAnalysis.classList.toggle("text-slate-700", isLexical);
  evaluationTabLexical.classList.toggle("bg-blue-600", isLexical);
  evaluationTabLexical.classList.toggle("text-white", isLexical);
  evaluationTabLexical.classList.toggle("bg-slate-200", !isLexical);
  evaluationTabLexical.classList.toggle("text-slate-700", !isLexical);
}

function clearLexicalSuggestions(message = "") {
  if (lexicalSuggestionsEl) lexicalSuggestionsEl.innerHTML = "";
  if (lexicalSuggestionsStatus) lexicalSuggestionsStatus.textContent = message;
}

function renderLexicalSuggestions(items) {
  if (!lexicalSuggestionsEl) return;
  lexicalSuggestionsEl.innerHTML = "";
  if (!items || items.length === 0) {
    clearLexicalSuggestions("未检测到可改进的语义表达");
    return;
  }
  if (lexicalSuggestionsStatus) lexicalSuggestionsStatus.textContent = "";

  const colorByTrigger = {
    negative_civic: "border-red-200 bg-red-50",
    tone_shift: "border-sky-200 bg-sky-50",
    idiomatic_shift: "border-emerald-200 bg-emerald-50",
  };

  items.slice(0, 6).forEach((item) => {
    const card = document.createElement("div");
    card.className = `rounded-xl border p-3 shadow-sm ${colorByTrigger[item.trigger] || "border-slate-200 bg-slate-50"}`;

    const title = document.createElement("div");
    title.className = "flex items-center justify-between text-sm font-semibold text-slate-800";
    title.textContent = item.lex_item || "未知词汇";
    card.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "mt-1 flex flex-wrap gap-1 text-[11px] text-slate-600";
    if (item.semantic_class) {
      const badge = document.createElement("span");
      badge.className = "rounded-full bg-slate-200 px-2 py-[2px]";
      badge.textContent = `类: ${item.semantic_class}`;
      meta.appendChild(badge);
    }
    if (item.slot) {
      const badge = document.createElement("span");
      badge.className = "rounded-full bg-slate-200 px-2 py-[2px]";
      badge.textContent = `槽位: ${item.slot}`;
      meta.appendChild(badge);
    }
    if (item.tone) {
      const badge = document.createElement("span");
      badge.className = "rounded-full bg-slate-200 px-2 py-[2px]";
      badge.textContent = `tone: ${item.tone}`;
      meta.appendChild(badge);
    }
    if (item.idiomatic !== undefined && item.idiomatic !== null) {
      const badge = document.createElement("span");
      badge.className = "rounded-full bg-slate-200 px-2 py-[2px]";
      badge.textContent = item.idiomatic ? "更地道" : "不够地道";
      meta.appendChild(badge);
    }
    if (item.civicTags && item.civicTags.length > 0) {
      const badge = document.createElement("span");
      badge.className = "rounded-full bg-slate-200 px-2 py-[2px]";
      badge.textContent = `思政: ${item.civicTags.join(",")}`;
      meta.appendChild(badge);
    }
    if (meta.childNodes.length > 0) {
      card.appendChild(meta);
    }

    if (item.recommendations && item.recommendations.length > 0) {
      const recTitle = document.createElement("div");
      recTitle.className = "mt-2 text-xs font-semibold text-slate-700";
      if (item.trigger === "negative_civic") {
        recTitle.textContent = "推荐使用更正向表达";
      } else if (item.trigger === "tone_shift") {
        recTitle.textContent = "你可以调整语气";
      } else if (item.trigger === "idiomatic_shift") {
        recTitle.textContent = "更地道的说法";
      } else {
        recTitle.textContent = "替换建议";
      }
      card.appendChild(recTitle);

      const list = document.createElement("div");
      list.className = "mt-1 flex flex-wrap gap-2";
      item.recommendations.slice(0, 5).forEach((rec) => {
        const pill = document.createElement("span");
        pill.className = "inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow";
        pill.textContent = rec.lex_item || rec.name || "建议";
        list.appendChild(pill);
      });
      card.appendChild(list);
    }

    if (item.knowledge_points && item.knowledge_points.length > 0) {
      const kpTitle = document.createElement("div");
      kpTitle.className = "mt-2 text-xs font-semibold text-slate-700";
      kpTitle.textContent = "你也许要掌握";
      card.appendChild(kpTitle);

      const kpList = document.createElement("div");
      kpList.className = "mt-1 flex flex-wrap gap-2";
      item.knowledge_points.slice(0, 5).forEach((kp) => {
        const pill = document.createElement("span");
        pill.className = "rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700";
        pill.textContent = kp;
        kpList.appendChild(pill);
      });
      card.appendChild(kpList);
    }

    lexicalSuggestionsEl.appendChild(card);
  });
}

async function fetchLexicalSuggestions(text) {
  if (!text || !lexicalSuggestionsEl) {
    clearLexicalSuggestions("输入以获取语义建议");
    return;
  }
  if (lexicalSuggestionsStatus) {
    lexicalSuggestionsStatus.textContent = "分析中…";
  }
  if (lexicalSuggestionAbortController) {
    lexicalSuggestionAbortController.abort();
  }
  lexicalSuggestionAbortController = new AbortController();
  try {
    const resp = await fetch(`/api/lexical-suggestions?utterance=${encodeURIComponent(text)}`, {
      signal: lexicalSuggestionAbortController.signal,
    });
    if (!resp.ok) {
      clearLexicalSuggestions("暂时无法获取语义建议");
      return;
    }
    const data = await resp.json();
    renderLexicalSuggestions(data.suggestions || []);
  } catch (err) {
    if (err.name !== "AbortError") {
      clearLexicalSuggestions("获取语义建议失败");
    }
  } finally {
    lexicalSuggestionAbortController = null;
  }
}

function scheduleLexicalSuggestions(text) {
  if (lexicalSuggestionTimer) {
    clearTimeout(lexicalSuggestionTimer);
  }
  lexicalSuggestionTimer = setTimeout(() => fetchLexicalSuggestions(text), 400);
}

// 渲染与理论课程关联的实战关卡列表。
function renderTheoryRelatedPracticeItems(practices) {
  if (!theoryRelatedPracticeList) {
    return;
  }
  theoryRelatedPracticeList.innerHTML = "";
  const items = Array.isArray(practices) ? practices : [];
  items.forEach((practice) => {
    if (!practice || !practice.id) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "w-full rounded-2xl border border-slate-800/60 bg-slate-900/70 px-4 py-3 text-left text-slate-200 transition hover:border-blue-400/60 hover:bg-slate-900";

    const title = document.createElement("p");
    title.className = "text-sm font-semibold";
    title.textContent = practice.title || "未命名关卡";
    button.appendChild(title);

    let chapterLabel = "关联章节未设置";
    let targetChapterId = practice.chapterId || null;
    if (practice.chapterId) {
      const chapter = findChapter(practice.chapterId);
      chapterLabel = chapter
        ? chapter.displayTitle || chapter.title || chapter.id || chapterLabel
        : practice.chapterId;
    } else {
      const chapters = Array.isArray(state.chapters) ? state.chapters : [];
      for (const chapter of chapters) {
        const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
        if (sections.find((section) => section.id === practice.id)) {
          chapterLabel = chapter.displayTitle || chapter.title || chapter.id || chapterLabel;
          targetChapterId = chapter.id || targetChapterId;
          break;
        }
      }
    }

    const meta = document.createElement("p");
    meta.className = "text-xs text-slate-400";
    meta.textContent = chapterLabel;
    button.appendChild(meta);

    if (practice.description) {
      const description = document.createElement("p");
      description.className = "text-xs text-slate-500";
      description.textContent = practice.description;
      button.appendChild(description);
    }

    button.addEventListener("click", () => {
      setSelectedLevel(targetChapterId, practice.id);
      expandLevelSelection();
      const maybeStart = startLevel();
      if (maybeStart && typeof maybeStart.catch === "function") {
        maybeStart.catch((error) => {
          console.error(error);
          alert(error.message || "无法启动实战关卡");
        });
      }
    });

    const listItem = document.createElement("li");
    listItem.appendChild(button);
    theoryRelatedPracticeList.appendChild(listItem);
  });
}

// 加载并展示与指定理论课程关联的实战关卡（含缓存与状态提示）。
async function updateTheoryRelatedPractices(lessonId, options = {}) {
  ensureStudentGraphState();
  const requestId = ++theoryRelatedRequestToken;
  const forceRefresh = !!options.forceRefresh;

  if (!theoryRelatedPracticesSection) {
    return;
  }

  if (!lessonId) {
    theoryRelatedPracticesSection.classList.add("hidden");
    if (theoryRelatedPracticeList) {
      theoryRelatedPracticeList.innerHTML = "";
    }
    setStatusText(theoryRelatedPracticesStatus, "");
    return;
  }

  theoryRelatedPracticesSection.classList.remove("hidden");
  if (theoryRelatedPracticeList) {
    theoryRelatedPracticeList.innerHTML = "";
  }

  const cache = state.studentGraph.lessonPractices;
  if (forceRefresh && cache && cache.delete) {
    cache.delete(lessonId);
  }

  let practices = cache instanceof Map ? cache.get(lessonId) : null;
  if (!practices) {
    setStatusText(theoryRelatedPracticesStatus, "正在匹配相关关卡…", "muted");
    try {
      const response = await fetchWithAuth(
        `/api/graph/theory-lessons/${lessonId}/related-practices`,
      );
      if (!response.ok) {
        let errorMessage = "无法加载相关实战练习";
        if (response.status === 503) {
          errorMessage = "知识图谱服务暂不可用";
        } else if (response.status === 404) {
          errorMessage = "未找到对应的理论小节";
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      practices = Array.isArray(data.practices) ? data.practices : [];
      if (cache && cache.set) {
        cache.set(lessonId, practices);
      }
    } catch (error) {
      if (theoryRelatedRequestToken !== requestId) {
        return;
      }
      setStatusText(
        theoryRelatedPracticesStatus,
        error.message || "无法加载相关实战练习",
        "error",
      );
      return;
    }
  }

  if (theoryRelatedRequestToken !== requestId) {
    return;
  }

  const items = Array.isArray(practices) ? practices : [];
  if (items.length === 0) {
    setStatusText(
      theoryRelatedPracticesStatus,
      "当前知识点暂未关联实战练习，敬请期待教师更新。",
      "muted",
    );
    return;
  }

  setStatusText(
    theoryRelatedPracticesStatus,
    "点击下方关卡即可直接进入实战练习。",
    "muted",
  );
  renderTheoryRelatedPracticeItems(items);
}

// 根据评估结果判断是否触发理论推荐。
function shouldRecommendLessons(evaluation) {
  if (!evaluation) {
    return false;
  }
  if (evaluation.score !== null && evaluation.score !== undefined) {
    const numericScore = Number(evaluation.score);
    if (Number.isFinite(numericScore)) {
      return numericScore < RECOMMENDATION_SCORE_THRESHOLD;
    }
  }
  if (evaluation.bargainingWinRate !== null && evaluation.bargainingWinRate !== undefined) {
    const winRate = Number(evaluation.bargainingWinRate);
    if (Number.isFinite(winRate)) {
      return winRate < RECOMMENDATION_SCORE_THRESHOLD;
    }
  }
  return false;
}

// 学生点击推荐课程时的跳转逻辑：选中课程并滚动到理论面板。
async function navigateToTheoryLesson(lessonId) {
  if (!lessonId || !state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  enterTheoryMode({ scrollIntoView: true });
  ensureTheoryState();
  if (!findTheoryLessonContext(lessonId)) {
    try {
      await loadStudentTheory({ keepSelection: true });
    } catch (error) {
      console.error(error);
    }
  }
  try {
    await selectStudentTheoryLesson(lessonId);
  } catch (error) {
    console.error(error);
    if (theoryStatusText) {
      theoryStatusText.textContent = error.message || "无法加载理论学习内容";
    }
  }
}

// 根据评估结果生成 AI 推荐（理论/实战）并渲染推荐卡片。
async function updateEvaluationRecommendations(evaluation) {
  const requestId = ++evaluationRecommendationToken;
  if (!evaluationRecommendationsSection) {
    return;
  }
  if (!evaluation || !shouldRecommendLessons(evaluation)) {
    evaluationRecommendationsSection.classList.add("hidden");
    if (evaluationRecommendationsList) {
      evaluationRecommendationsList.innerHTML = "";
    }
    setStatusText(evaluationRecommendationsStatus, "");
    return;
  }

  const practiceId = state.activeLevel && state.activeLevel.sectionId;
  if (!practiceId) {
    evaluationRecommendationsSection.classList.add("hidden");
    if (evaluationRecommendationsList) {
      evaluationRecommendationsList.innerHTML = "";
    }
    setStatusText(evaluationRecommendationsStatus, "");
    return;
  }

  ensureStudentGraphState();
  evaluationRecommendationsSection.classList.remove("hidden");
  if (evaluationRecommendationsList) {
    evaluationRecommendationsList.innerHTML = "";
  }
  setStatusText(evaluationRecommendationsStatus, "正在查找推荐课程…", "muted");

  const cache = state.studentGraph.practiceLessons;
  let lessons = cache instanceof Map ? cache.get(practiceId) : null;
  if (!lessons) {
    try {
      const response = await fetchWithAuth(
        `/api/graph/practices/${practiceId}/related-lessons`,
      );
      if (!response.ok) {
        let errorMessage = "无法加载推荐课程";
        if (response.status === 503) {
          errorMessage = "知识图谱服务暂不可用";
        } else if (response.status === 404) {
          errorMessage = "未找到对应的关卡";
        } else {
          const errorData = await response.json().catch(() => ({}));
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        }
        throw new Error(errorMessage);
      }
      const data = await response.json();
      lessons = Array.isArray(data.lessons) ? data.lessons : [];
      if (cache && cache.set) {
        cache.set(practiceId, lessons);
      }
    } catch (error) {
      if (evaluationRecommendationToken !== requestId) {
        return;
      }
      setStatusText(
        evaluationRecommendationsStatus,
        error.message || "无法加载推荐课程",
        "error",
      );
      return;
    }
  }

  if (evaluationRecommendationToken !== requestId) {
    return;
  }

  const items = Array.isArray(lessons)
    ? lessons.filter((lesson) => lesson && lesson.id && lesson.isPublished !== false)
    : [];
  if (items.length === 0) {
    setStatusText(
      evaluationRecommendationsStatus,
      "当前关卡尚未关联理论课程，建议联系教师补充知识图谱。",
      "muted",
    );
    return;
  }

  setStatusText(
    evaluationRecommendationsStatus,
    "建议复习以下理论课程，点击即可跳转。",
    "muted",
  );

  items.forEach((lesson) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "w-full rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-left text-slate-200 transition hover:border-emerald-400/60 hover:bg-slate-900";

    const title = document.createElement("p");
    title.className = "text-sm font-semibold";
    title.textContent = lesson.title || "理论课程";
    button.appendChild(title);

    if (lesson.code) {
      const codeLine = document.createElement("p");
      codeLine.className = "text-xs text-slate-400";
      codeLine.textContent = lesson.code;
      button.appendChild(codeLine);
    }

    button.addEventListener("click", async () => {
      try {
        await navigateToTheoryLesson(lesson.id);
      } catch (error) {
        console.error(error);
        alert(error.message || "无法打开理论课程");
      }
    });

    evaluationRecommendationsList.appendChild(button);
  });
}

// 渲染场景自定义字段（如买方信息、卖方信息等）。
function renderCustomFields(fields) {
  if (!scenarioCustomFieldsEl) {
    return;
  }

  scenarioCustomFieldsEl.innerHTML = "";

  const entries = Array.isArray(fields) ? fields : [];
  if (entries.length === 0) {
    scenarioCustomFieldsEl.classList.add("hidden");
    return;
  }

  scenarioCustomFieldsEl.classList.remove("hidden");

  entries.forEach((field) => {
    const card = document.createElement("div");
    card.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-4";

    const title = document.createElement("h3");
    title.className = "text-sm font-semibold text-slate-200";
    title.textContent = field.label || field.key || "Additional Detail";
    card.appendChild(title);

    const body = document.createElement("div");
    body.className = "mt-3 space-y-2 text-sm text-slate-300";

    const items = Array.isArray(field.items) ? field.items : [];
    if (items.length > 0) {
      const list = document.createElement("ul");
      list.className = "list-disc space-y-1 pl-4";
      items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      body.appendChild(list);
    } else if (field.value) {
      const paragraph = document.createElement("p");
      paragraph.textContent = field.value;
      body.appendChild(paragraph);
    } else {
      const placeholder = document.createElement("p");
      placeholder.className = "text-xs text-slate-500";
      placeholder.textContent = "暂无补充信息";
      body.appendChild(placeholder);
    }

    card.appendChild(body);
    scenarioCustomFieldsEl.appendChild(card);
  });
}

// 生成关卡胜利标识的存储 key。
function getLevelVictoryKey(chapterId, sectionId) {
  return `${chapterId || ""}::${sectionId || ""}`;
}

// 判断评估结果是否包含胜利/通过的评分。
function hasVictoryScore(evaluation) {
  if (!evaluation || evaluation.score === null || evaluation.score === undefined) {
    return false;
  }
  const numeric = Number(evaluation.score);
  if (Number.isNaN(numeric)) {
    return false;
  }
  return numeric > 80;
}

// 标记关卡已通过（本地存储 + 内存）。
function markLevelVictory(chapterId, sectionId) {
  if (!chapterId || !sectionId) {
    return;
  }
  if (!state.levelVictories || !(state.levelVictories instanceof Set)) {
    state.levelVictories = new Set();
  }
  const key = getLevelVictoryKey(chapterId, sectionId);
  if (state.levelVictories.has(key)) {
    return;
  }
  state.levelVictories.add(key);
  renderLevelMap();
}

// 从 localStorage 重建通过记录，供 UI 高亮。
function rebuildLevelVictories() {
  if (!state.levelVictories || !(state.levelVictories instanceof Set)) {
    state.levelVictories = new Set();
  }
  const next = new Set();
  (state.sessions || []).forEach((session) => {
    if (!session || !session.chapterId || !session.sectionId) {
      return;
    }
    if (hasVictoryScore(session.latestEvaluation)) {
      next.add(getLevelVictoryKey(session.chapterId, session.sectionId));
    }
  });

  let changed = next.size !== state.levelVictories.size;
  if (!changed) {
    for (const key of next) {
      if (!state.levelVictories.has(key)) {
        changed = true;
        break;
      }
    }
  }

  state.levelVictories = next;
  if (changed) {
    renderLevelMap();
  } else {
    highlightSelectedLevel();
  }
}

// 若评估达到胜利阈值，则记录关卡通过状态。
function maybeRecordVictory(evaluation) {
  if (!evaluation || !hasVictoryScore(evaluation)) {
    return;
  }
  const { chapterId, sectionId } = state.activeLevel || {};
  if (chapterId && sectionId) {
    markLevelVictory(chapterId, sectionId);
  }
}

// 切换体验区模块（聊天/复盘/理论等），并刷新布局。
function setActiveExperienceModule(moduleId) {
  if (!moduleId) {
    return;
  }
  const modules = Array.from(experienceModules || []);
  if (modules.length === 0) {
    return;
  }
  const reviewModeActive =
    isReviewSection(state.activeLevel?.sectionId) &&
    !!(state.review && state.review.documentText && state.review.documentText.trim());
  if (reviewModeActive) {
    moduleId = "review";
  }
  const exists = modules.some((module) => module.dataset.experienceModule === moduleId);
  if (!exists) {
    return;
  }
  activeExperienceModule = moduleId;
  updateExperienceLayout();
}

// 根据 activeExperienceModule 切换展示/隐藏对应区块。
function updateExperienceLayout() {
  const modules = Array.from(experienceModules || []);
  if (modules.length === 0) {
    return;
  }
  const reviewModeActive =
    isReviewSection(state.activeLevel?.sectionId) &&
    !!(state.review && state.review.documentText && state.review.documentText.trim());
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  modules.forEach((module) => {
    if (!module.dataset.experienceModule) {
      return;
    }
    if (module.dataset.experienceModule === "review" && !reviewModeActive) {
      module.classList.add("hidden");
      return;
    }
    if (module.dataset.experienceModule === "chat" && reviewModeActive) {
      module.classList.add("hidden");
      return;
    }
    if (isDesktop) {
      module.classList.remove("hidden");
    } else if (module.dataset.experienceModule === activeExperienceModule) {
      module.classList.remove("hidden");
    } else {
      module.classList.add("hidden");
    }
  });

  const tabs = Array.from(experienceTabButtons || []);
  tabs.forEach((button) => {
    const isActive = button.dataset.experienceTab === activeExperienceModule;
    button.classList.remove("text-slate-100", "text-slate-200", "text-slate-300", "text-slate-400");
    button.classList.toggle("font-semibold", isActive);
    button.classList.toggle("font-medium", !isActive);
    button.classList.add(isActive ? "text-slate-100" : "text-slate-400");
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

// 展开/收起情景描述面板。
function toggleScenarioPanel() {
  if (!scenarioPanelBody || !scenarioCollapseBtn) {
    return;
  }
  isScenarioCollapsed = !isScenarioCollapsed;
  if (isScenarioCollapsed) {
    scenarioPanelBody.classList.add("hidden");
    scenarioCollapseBtn.setAttribute("aria-expanded", "false");
    scenarioCollapseBtn.textContent = "展开 ▼";
  } else {
    scenarioPanelBody.classList.remove("hidden");
    scenarioCollapseBtn.setAttribute("aria-expanded", "true");
    scenarioCollapseBtn.textContent = "收起 ▲";
  }
}

// 渲染能力/知识点条目列表，用于评估反馈。
function renderAbilityKnowledge(container, items) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "text-xs text-slate-500";
    empty.textContent = "暂无知识点数据";
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "knowledge-pill";
    const label = item.label || item.name || item;
    pill.textContent = label;
    const tooltipParts = [];
    if (item.count !== undefined) {
      tooltipParts.push(`出现 ${item.count} 次`);
    }
    if (item.latestScore !== undefined && item.latestScore !== null) {
      tooltipParts.push(`最近得分 ${item.latestScore}`);
    }
    if (item.averageScore !== undefined && item.averageScore !== null) {
      tooltipParts.push(`平均分 ${Math.round(item.averageScore)}`);
    }
    pill.dataset.tooltip = tooltipParts.join(" · ") || "知识点";
    container.appendChild(pill);
  });
}

// 渲染学生仪表盘数据：能力雷达、推荐课程等。
function renderStudentInsights(insights) {
  state.studentInsights = insights || null;

  if (abilityHistoryList) {
    abilityHistoryList.innerHTML = "";
    const timeline = (insights && insights.timeline) || [];
    if (timeline.length === 0) {
      const empty = document.createElement("li");
      empty.className = "rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500";
      empty.textContent = "暂无评估记录，完成一次谈判即可生成成长轨迹。";
      abilityHistoryList.appendChild(empty);
    } else {
      timeline
        .slice()
        .reverse()
        .forEach((item) => {
          const li = document.createElement("li");
          li.className = "rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs text-slate-300";
          const scoreText =
            item.score !== null && item.score !== undefined
              ? `得分 ${item.score}${item.scoreLabel ? ` · ${item.scoreLabel}` : ""}`
              : item.bargainingWinRate !== null && item.bargainingWinRate !== undefined
              ? `胜率 ${item.bargainingWinRate}%`
              : "暂无分数";
          const difficulty = item.difficultyLabel ? ` · ${item.difficultyLabel}` : "";
          const knowledge = (item.knowledgePoints || []).join("、");
          li.innerHTML = `
            <p class="text-slate-200">${item.title || item.sectionId || "关卡"}${difficulty}</p>
            <p class="mt-1 text-slate-400">${scoreText}</p>
            <p class="mt-1 text-slate-500">${item.createdAt || "-"}</p>
            ${knowledge ? `<p class="mt-1 text-slate-400">知识点：${knowledge}</p>` : ""}
          `;
          abilityHistoryList.appendChild(li);
        });
    }
  }

  if (abilityKnowledgeEl) {
    renderAbilityKnowledge(abilityKnowledgeEl, (insights && insights.recentKnowledge) || []);
  }

  if (!abilityRadarCanvas) {
    return;
  }

  const radarData = (insights && insights.knowledgeRadar) || [];
  const hasRadarData = radarData.length > 0;
  if (abilityRadarEmpty) {
    abilityRadarEmpty.textContent = hasRadarData
      ? ""
      : "暂无评估数据，完成一次谈判后即可查看能力雷达图。";
  }

  if (!hasRadarData) {
    if (abilityRadarChart) {
      abilityRadarChart.destroy();
      abilityRadarChart = null;
    }
    return;
  }

  const labels = radarData.map((item) => item.label || item.name || "能力");
  const values = radarData.map((item) => {
    const value = item.averageScore !== undefined && item.averageScore !== null ? item.averageScore : 0;
    return Math.round(value);
  });

  if (abilityRadarChart) {
    abilityRadarChart.destroy();
  }

  abilityRadarChart = new Chart(abilityRadarCanvas, {
    type: "radar",
    data: {
      labels,
      datasets: [
        {
          label: "平均得分",
          data: values,
          borderColor: "rgba(16, 185, 129, 0.8)",
          backgroundColor: "rgba(16, 185, 129, 0.25)",
          borderWidth: 2,
          pointBackgroundColor: "rgba(16, 185, 129, 0.9)",
        },
      ],
    },
    options: {
      scales: {
        r: {
          suggestedMin: 0,
          suggestedMax: 100,
          ticks: {
            stepSize: 20,
            color: "rgba(226, 232, 240, 0.6)",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.2)",
          },
          angleLines: {
            color: "rgba(148, 163, 184, 0.2)",
          },
          pointLabels: {
            color: "rgba(226, 232, 240, 0.9)",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(226, 232, 240, 0.9)",
          },
        },
      },
    },
  });
}

// 渲染当前会话的情景描述、买卖双方信息与提示。
function renderScenario(scenario) {
  state.currentScenario = scenario;
  scenarioTitleEl.textContent = scenario.title || "";
  scenarioSummaryEl.textContent = scenario.summary || "";
  studentRoleEl.textContent = scenario.studentRole || "";
  const studentCompany = scenario.studentCompany || {};
  studentCompanyEl.textContent = studentCompany.profile
    ? `${studentCompany.name || ""} · ${studentCompany.profile}`
    : studentCompany.name || "";
  aiRoleEl.textContent = scenario.aiRole || "";
  const aiCompany = scenario.aiCompany || {};
  aiCompanyEl.textContent = aiCompany.profile
    ? `${aiCompany.name || ""} · ${aiCompany.profile}`
    : aiCompany.name || "";

  const product = scenario.product || {};
  const price = product.price_expectation || {};
  const productDetails = [];
  if (product.name) productDetails.push(`品名：${product.name}`);
  if (product.specifications) productDetails.push(`规格：${product.specifications}`);
  if (product.quantity_requirement)
    productDetails.push(`数量/产能：${product.quantity_requirement}`);
  if (price.student_target)
    productDetails.push(`学生目标：${price.student_target}`);
  if (price.ai_bottom_line)
    productDetails.push(`AI 底线：${price.ai_bottom_line}`);
  if (scenario.timeline) productDetails.push(`交期：${scenario.timeline}`);
  if (scenario.logistics) productDetails.push(`物流条款：${scenario.logistics}`);
  productDetailsEl.innerHTML = "";
  if (productDetails.length === 0) {
    const item = document.createElement("li");
    item.textContent = "暂无产品信息";
    item.className = "text-xs text-slate-500";
    productDetailsEl.appendChild(item);
  } else {
    productDetails.forEach((detail) => {
      const item = document.createElement("li");
      item.textContent = detail;
      productDetailsEl.appendChild(item);
    });
  }

  renderList(negotiationFocusEl, scenario.negotiationTargets || []);
  renderList(riskListEl, scenario.risks || []);
  renderList(taskChecklistEl, scenario.checklist || [], true);

  if (chatCompanyEl) {
    chatCompanyEl.textContent = aiCompany.name || "AI 虚拟公司";
  }
  const difficultyLabel = scenario.difficultyLabel || "";
  const difficultyDescription = scenario.difficultyDescription || "";
  if (scenarioDifficultyEl) {
    const descriptionParts = [];
    if (difficultyLabel) {
      descriptionParts.push(difficultyLabel);
    }
    if (difficultyDescription) {
      descriptionParts.push(difficultyDescription);
    }
    scenarioDifficultyEl.textContent =
      descriptionParts.length > 0 ? descriptionParts.join(" · ") : "默认 · 平衡博弈";
  }
  const toneText = scenario.communicationTone || "";
  if (chatToneEl) {
    chatToneEl.textContent = difficultyLabel
      ? `${difficultyLabel}${toneText ? ` · ${toneText}` : ""}`
      : toneText;
  }
  renderCustomFields(scenario.customFields || []);
  renderKnowledge(evaluationKnowledgeEl, scenario.knowledgePoints || []);
  renderEmailComposer();
  renderCopilotVisibility();
  updateChatHeader(scenario.title || scenario.aiRole || "");
}

// 渲染聊天窗口（消息列表 + 输入区域），区分邮件/普通模式。
function renderChat() {
  if (isEmailModeActive()) {
    renderEmailComposer();
    return;
  }
  if (emailBannerEl) emailBannerEl.classList.add("hidden");
  if (emailComposerEl) emailComposerEl.classList.add("hidden");
  if (emailThreadEl) emailThreadEl.classList.add("hidden");
  if (chatInputPanel) chatInputPanel.classList.remove("hidden");
  chatBodyEl.innerHTML = "";
  state.messages.forEach((message) => {
    const row = document.createElement("div");
    row.className = "flex gap-3";
    const avatar = document.createElement("div");
    avatar.className = "mt-1 h-10 w-10 flex-shrink-0 rounded-full";
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-markdown text-sm leading-6";
    bubble.innerHTML = renderMarkdown(message.content);

    if (message.role === "assistant") {
      row.classList.add("items-start");
      avatar.classList.add(
        "bg-blue-500/80",
        "flex",
        "items-center",
        "justify-center",
        "text-white",
        "text-sm",
        "font-semibold"
      );
      avatar.textContent = "AI";
      bubble.classList.add("bubble-assistant");
      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      row.classList.add("items-start", "justify-end");
      avatar.classList.add(
        "bg-emerald-500/80",
        "flex",
        "items-center",
        "justify-center",
        "text-white",
        "text-sm",
        "font-semibold"
      );
      avatar.textContent = "我";
      bubble.classList.add("bubble-user");
      row.appendChild(bubble);
      row.appendChild(avatar);
    }

    chatBodyEl.appendChild(row);
  });
  chatBodyEl.scrollTop = chatBodyEl.scrollHeight;
}

// 追加一条消息到 state，并返回索引（支持中途更新）。
function appendMessage(role, content, options = {}) {
  const message = { role, content };
  if (options.subject) {
    message.subject = options.subject;
  }
  if (state.sessionMessages && state.activeSessionId) {
    const bucket = state.sessionMessages.get(state.activeSessionId) || [];
    bucket.push(message);
    state.sessionMessages.set(state.activeSessionId, bucket);
    state.messages = bucket;
  } else {
    state.messages.push(message);
  }
  if (!options.silent) {
    renderChat();
  }
  return state.messages.length - 1;
}

// 发送一条消息并流式接收 AI 回复，兼容重新生成/回退等。
async function sendMessageWithContent(message, options = {}) {
  if (!state.auth.user || state.auth.user.role !== "student") {
    alert("请使用学生账号体验对话");
    return;
  }
  if (state.activeSessionId && state.sessionId && state.activeSessionId !== state.sessionId) {
    alert("当前为模拟侧边会话，无法发送。请切回主会话。");
    return;
  }
  if (!message) return;
  if (!state.sessionId) {
    alert("请先选择关卡并加载场景");
    return;
  }

  setEvaluationLoading(true);
  if (sendMessageBtn) sendMessageBtn.disabled = true;

  const userMessageIndex = appendMessage("user", message, options);
  const assistantIndex = appendMessage("assistant", "…", { silent: true });
  renderChat();

  let fullReply = "";
  ttsBuffer = "";
  ttsCursor = 0;
  let evaluationResult = null;
  let shouldTerminate = false;
  let streamError = null;

  const mergeKnowledgePoints = (base, incoming) => {
    const baseList = Array.isArray(base) ? base : base ? [base] : [];
    const incomingList = Array.isArray(incoming) ? incoming : incoming ? [incoming] : [];
    const mergedMap = new Map();
    const toKey = (item) =>
      item && typeof item === "object" ? item.name || item.label || item.title : String(item || "");
    const scoreSource = (item) => {
      if (!item || typeof item !== "object") return 0;
      if (item.source === "ai") return 2;
      if (item.source === "keyword") return 1;
      return 0;
    };
    const upsert = (item) => {
      const key = toKey(item);
      if (!key) return;
      const existing = mergedMap.get(key);
      if (!existing) {
        mergedMap.set(key, item);
        return;
      }
      // Final（AI）若与快速同名，升级为 AI；否则保留原有。
      if (scoreSource(item) > scoreSource(existing)) {
        mergedMap.set(key, item);
      }
    };
    baseList.forEach(upsert);
    incomingList.forEach(upsert);
    return Array.from(mergedMap.values());
  };

  const parseEvent = (raw) => {
    const lines = raw.split("\n");
    let eventType = "message";
    const dataLines = [];
    lines.forEach((line) => {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    });
    const dataString = dataLines.join("\n");
    let payload;
    if (dataString) {
      try {
        payload = JSON.parse(dataString);
      } catch (err) {
        console.warn("无法解析流式数据", err, dataString);
        payload = {};
      }
    } else {
      payload = {};
    }
    return { eventType, payload };
  };

  const handleEvent = (eventType, payload) => {
    if (eventType === "chunk") {
      if (payload.content) {
        fullReply += payload.content;
        updateMessageContent(assistantIndex, fullReply);
        processTtsStream(fullReply, false);
      }
    } else if (eventType === "summary") {
      if (payload.reply) {
        fullReply = payload.reply;
        updateMessageContent(assistantIndex, fullReply);
        processTtsStream(fullReply, false);
      }
    } else if (eventType === "score") {
      const scoreVal = payload.score;
      const scoreLabel = payload.scoreLabel || (payload.debug && payload.debug.parsedScore && payload.debug.parsedScore.score_label);
      evaluationResult = {
        score: scoreVal,
        scoreLabel,
        commentary: evaluationResult ? evaluationResult.commentary : "等待详细评语…",
        actionItems: evaluationResult ? evaluationResult.actionItems : [],
        knowledgePoints: evaluationResult ? evaluationResult.knowledgePoints : [],
      };
      renderEvaluation(evaluationResult);
    } else if (eventType === "knowledge") {
      const recalled = payload.knowledgePoints || payload.knowledge_points || [];
      if (!evaluationResult) {
        evaluationResult = {
          score: null,
          scoreLabel: "",
          commentary: "等待详细评语…",
          actionItems: [],
          knowledgePoints: [],
        };
      }
      evaluationResult.knowledgePoints = mergeKnowledgePoints(evaluationResult.knowledgePoints, recalled);
      renderEvaluation(evaluationResult);
    } else if (eventType === "evaluation") {
      const incoming = payload.evaluation || null;
      if (incoming && evaluationResult) {
        incoming.knowledgePoints = mergeKnowledgePoints(evaluationResult.knowledgePoints, incoming.knowledgePoints || []);
      }
      evaluationResult = incoming;
      renderEvaluation(evaluationResult);
    } else if (eventType === "detail") {
      const incoming = payload.evaluation || null;
      if (incoming && evaluationResult) {
        incoming.knowledgePoints = mergeKnowledgePoints(evaluationResult.knowledgePoints, incoming.knowledgePoints || []);
      }
      evaluationResult = incoming;
      renderEvaluation(evaluationResult);
    } else if (eventType === "error") {
      streamError = new Error(payload.error || "对话失败");
      shouldTerminate = true;
    } else if (eventType === "done" || eventType === "close") {
      processTtsStream(fullReply, true);
      shouldTerminate = true;
    }
  };

  try {
    const response = await fetchWithAuth(`/api/chat?stream=1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ sessionId: state.sessionId, message }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "发送消息失败";
      if (errorText) {
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || errorMessage;
        } catch (err) {
          errorMessage = errorText || errorMessage;
        }
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("无法读取响应流");
    }
    const decoder = new TextDecoder("utf-8");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      const parts = raw.split("\n\n").filter(Boolean);
      parts.forEach((part) => {
        const { eventType, payload } = parseEvent(part);
        handleEvent(eventType, payload);
      });
      if (shouldTerminate) break;
    }
    if (streamError) {
      throw streamError;
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "发送失败");
    state.messages.splice(assistantIndex, 1);
    state.messages.splice(userMessageIndex, 1);
    renderChat();
  } finally {
    setEvaluationLoading(false);
    if (sendMessageBtn) sendMessageBtn.disabled = false;
  }
}

// 更新已有消息的内容（用于流式或修正）。
function updateMessageContent(index, content) {
  if (index < 0 || index >= state.messages.length) {
    return;
  }
  state.messages[index].content = content;
  renderChat();
}

// 渲染会话评估结果、行动建议、知识点反馈与雷达图。
function renderEvaluation(evaluation) {
  setEvaluationLoading(false);
  if (!evaluation) {
    resetEvaluation();
    return;
  }

  const parsedScore = evaluation.debug && evaluation.debug.parsedScore ? evaluation.debug.parsedScore : {};
  const parsedDetail = evaluation.debug && evaluation.debug.parsedDetail ? evaluation.debug.parsedDetail : {};
  if ((evaluation.score === null || evaluation.score === undefined || evaluation.score === "") && parsedScore.score !== undefined) {
    evaluation.score = parsedScore.score;
  }
  if ((!evaluation.scoreLabel || evaluation.scoreLabel === "") && parsedScore.score_label) {
    evaluation.scoreLabel = parsedScore.score_label;
  }
  if ((!evaluation.knowledgePoints || evaluation.knowledgePoints.length === 0) && (parsedDetail.knowledge_points || parsedScore.knowledge_points)) {
    const fallbackKp = parsedDetail.knowledge_points || parsedScore.knowledge_points || [];
    evaluation.knowledgePoints = Array.isArray(fallbackKp) ? fallbackKp : [fallbackKp];
  }
  if ((!evaluation.highlights || evaluation.highlights.length === 0) && parsedDetail.highlights) {
    evaluation.highlights = parsedDetail.highlights;
  }
  if ((!evaluation.risks || evaluation.risks.length === 0) && parsedDetail.risks) {
    evaluation.risks = parsedDetail.risks;
  }
  if ((!evaluation.suggestions || evaluation.suggestions.length === 0) && parsedDetail.suggestions) {
    evaluation.suggestions = parsedDetail.suggestions;
  }
  console.info("[EvaluationDebug][ResolvedEvaluation]", evaluation);

  const hasScore = evaluation.score !== null && evaluation.score !== undefined && evaluation.score !== "";
  const hasWinRate =
    evaluation.bargainingWinRate !== null &&
    evaluation.bargainingWinRate !== undefined &&
    evaluation.bargainingWinRate !== "";

  let numericScore = null;
  let isPercent = false;
  if (hasScore) {
    numericScore = Number(evaluation.score);
  } else if (hasWinRate) {
    numericScore = Number(evaluation.bargainingWinRate);
    isPercent = true;
  }

  const color = numericScore >= 80 ? "#16a34a" : numericScore >= 60 ? "#ca8a04" : "#ef4444";
  updateScoreRing(numericScore, color);
  animateEvaluationScore(numericScore, { isPercent });
  if (evaluationScoreLabelEl) evaluationScoreLabelEl.textContent = evaluation.scoreLabel || "";
  if (evaluationCommentaryEl) {
    evaluationCommentaryEl.textContent = evaluation.commentary || "等待新的对话内容...";
  }

  renderEvaluationCards(evaluation);
  renderEvaluationKnowledge(evaluation.knowledgePoints || []);
  maybeRecordVictory(evaluation);
  updateEvaluationRecommendations(evaluation);
  animateEvaluationContent();
}

function normalizeFeedbackEntries(evaluation) {
  const collected = [];
  const addEntries = (items, type) => {
    if (!items) return;
    const list = Array.isArray(items) ? items : [items];
    list.forEach((entry) => {
      if (!entry) return;
      if (typeof entry === "string") {
        collected.push({ type, title: entry, detail: entry });
      } else if (typeof entry === "object") {
        collected.push({
          type,
          title: entry.title || entry.label || entry.name || "未命名",
          detail:
            entry.detail ||
            entry.description ||
            entry.content ||
            entry.value ||
            entry.explanation ||
            entry.text ||
            "",
        });
      }
    });
  };

  addEntries(evaluation.highlights || evaluation.亮点, "highlight");
  addEntries(evaluation.risks || evaluation.warnings || evaluation.不足, "risk");
  addEntries(evaluation.suggestions || evaluation.tips || evaluation.actionItems, "tip");

  if (collected.length === 0) {
    const fallback = evaluation.commentary || "等待新的对话内容...";
    collected.push({ type: "tip", title: fallback.slice(0, 20), detail: fallback });
  }
  // 补全缺失的 detail
  const fallbackDetail = evaluation.commentary || "";
  return collected.map((item) => ({
    ...item,
    detail: item.detail || fallbackDetail || item.title || "暂无详情",
  }));
}

function renderEvaluationCards(evaluation) {
  if (!evaluationFeedbackCards) return;
  evaluationFeedbackCards.innerHTML = "";
  const cards = normalizeFeedbackEntries(evaluation);
  const typeMeta = {
    highlight: { icon: "🟢", label: "Keep it up", border: "border-emerald-200 bg-emerald-50" },
    risk: { icon: "🔴", label: "Warning", border: "border-rose-200 bg-rose-50" },
    tip: { icon: "🔵", label: "Tip", border: "border-sky-200 bg-sky-50" },
  };
  cards.forEach((card) => {
    const meta = typeMeta[card.type] || typeMeta.tip;
    const node = document.createElement("div");
    node.className = `feedback-card ${meta.border}`;
    const titleRow = document.createElement("div");
    titleRow.className = "feedback-card__title text-sm text-slate-900";
    const titleText = document.createElement("span");
    const safeTitle = (card.title || meta.label || "").toString();
    const clipped = safeTitle.length > 15 ? `${safeTitle.slice(0, 15)}…` : safeTitle;
    titleText.textContent = `${meta.icon} ${clipped || meta.label}`;
    const tag = document.createElement("span");
    tag.className = "text-[11px] text-slate-500";
    tag.textContent = meta.label;
    titleRow.appendChild(titleText);
    titleRow.appendChild(tag);
    const body = document.createElement("p");
    body.className = "feedback-card__body text-xs";
    body.textContent = card.detail || "点击查看详情";
    node.appendChild(titleRow);
    node.appendChild(body);
    node.addEventListener("click", () => {
      node.classList.toggle("active");
    });
    evaluationFeedbackCards.appendChild(node);
  });
}

function showKnowledgePeek(title, detail) {
  if (!knowledgePeek || !knowledgePeekTitle || !knowledgePeekSummary) return;
  const name = title || "";
  knowledgePeekTitle.textContent = name || "知识点";
  knowledgePeekSummary.textContent = detail || "结合知识图谱预览该知识点。";
  if (knowledgePeekBody) {
    knowledgePeekBody.innerHTML = detail || "";
  }
  knowledgePeek.classList.add("active");
  renderKnowledgePeekGraph({ name });
  loadKnowledgePeekDetail(name, detail || "");
}

function closeKnowledgePeek() {
  if (!knowledgePeek) return;
  knowledgePeek.classList.remove("active");
}

function loadKnowledgePeekDetail(name, fallbackDetail = "") {
  if (!name) return;
  if (knowledgePeekBody) knowledgePeekBody.textContent = "加载详情中...";
  if (knowledgePeekGraphStatus) knowledgePeekGraphStatus.textContent = "加载图谱...";
  fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}`)
    .then((res) => res.json())
    .then((data) => {
      const info = data || {};
      if (knowledgePeekSummary) {
        knowledgePeekSummary.textContent = info.description || info.summary || knowledgePeekSummary.textContent;
      }
      if (knowledgePeekBody) {
        const bodyText = info.content || info.description || info.summary || "";
        if (window.marked && window.DOMPurify && bodyText) {
          knowledgePeekBody.innerHTML = window.DOMPurify.sanitize(window.marked.parse(bodyText));
        } else {
          knowledgePeekBody.textContent = bodyText || fallbackDetail || "";
        }
      }
      if (knowledgePeekJump) {
        const lessonId = Array.isArray(info.lessons) && info.lessons[0];
        knowledgePeekJump.classList.toggle("hidden", !lessonId);
        if (lessonId) {
          knowledgePeekJump.onclick = () => navigateToTheoryLesson(lessonId);
        } else {
          knowledgePeekJump.onclick = null;
        }
      }
      renderKnowledgePeekGraph({
        name,
        prerequisites: info.prerequisites || [],
        relations: info.relations || [],
        lessonId: Array.isArray(info.lessons) ? info.lessons[0] : null,
      });
      // 流式讲解（复用知识卡体验）
      if (knowledgePeekBody) {
        knowledgePeekBody.textContent = "生成讲解中...";
        fetchWithAuth("/api/knowledge/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, lessonId: Array.isArray(info.lessons) ? info.lessons[0] : null }),
        })
          .then((response) => {
            const reader = response.body?.getReader();
            if (!reader) throw new Error("无法读取流");
            const decoder = new TextDecoder("utf-8");
            let buf = "";
            const pump = () =>
              reader.read().then(({ value, done }) => {
                if (done) {
                  if (buf) {
                    if (window.marked && window.DOMPurify) {
                      knowledgePeekBody.innerHTML = window.DOMPurify.sanitize(window.marked.parse(buf));
                    } else {
                      knowledgePeekBody.textContent = buf;
                    }
                  }
                  return;
                }
                buf += decoder.decode(value, { stream: true });
                if (window.marked && window.DOMPurify) {
                  knowledgePeekBody.innerHTML = window.DOMPurify.sanitize(window.marked.parse(buf));
                } else {
                  knowledgePeekBody.textContent = buf;
                }
                return pump();
              });
            return pump();
          })
          .catch(() => {
            knowledgePeekBody.textContent =
              info.content || info.description || info.summary || fallbackDetail || "暂时无法生成讲解";
          });
      }
    })
    .catch(() => {
      if (knowledgePeekBody) knowledgePeekBody.textContent = "暂时无法加载详情";
      renderKnowledgePeekGraph({ name });
    });
}

let knowledgePeekGraphInstance = null;
async function renderKnowledgePeekGraph(payload) {
  if (!knowledgePeekGraph) return;
  if (knowledgePeekGraphStatus) knowledgePeekGraphStatus.textContent = "加载图谱...";
  const highlight = payload.name || "";
  const lessonId = payload.lessonId || null;

  const renderSimple = () => {
    const prereqs = Array.isArray(payload.prerequisites) ? payload.prerequisites : [];
    const relations = Array.isArray(payload.relations) ? payload.relations : [];
    const nodes = [{ id: highlight || "KP", label: highlight || "知识点", nodeType: "KnowledgePoint" }];
    const edges = [];
    prereqs.forEach((p, idx) => {
      const id = `prereq-${idx}-${p}`;
      nodes.push({ id, label: p, nodeType: "Prerequisite" });
      edges.push({ source: id, target: nodes[0].id, label: "前置" });
    });
    relations.forEach((r, idx) => {
      const id = `rel-${idx}-${r}`;
      nodes.push({ id, label: r, nodeType: "Related" });
      edges.push({ source: nodes[0].id, target: id, label: "关联" });
    });
    drawKnowledgePeekGraph(nodes, edges, new Set([highlight]));
  };

  if (!lessonId) {
    renderSimple();
    return;
  }

  try {
      const resp = await fetchWithAuth(
        `/api/graph/lesson-network?lessonId=${encodeURIComponent(lessonId)}&limit=600`,
      );
    if (!resp.ok) {
      renderSimple();
      return;
    }
    const data = await resp.json();
    const nodes = data.nodes || [];
    const edges = Array.isArray(data.edges) ? data.edges : [];
    const nodeIds = new Set(nodes.map((n) => n.id || n.key || n.name));
    const safeEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
    const highlights = new Set(data.highlights || []);
    if (highlight) highlights.add(highlight);
    if (nodes.length === 0) {
      renderSimple();
      return;
    }
    drawKnowledgePeekGraph(nodes, safeEdges, highlights);
  } catch (err) {
    console.error("[KnowledgePeekGraph]", err);
    renderSimple();
  }
}

function drawKnowledgePeekGraph(nodes, edges, highlights) {
  if (!knowledgePeekGraph) return;
  if (knowledgePeekGraphInstance && typeof knowledgePeekGraphInstance.destroy === "function") {
    knowledgePeekGraphInstance.destroy();
    knowledgePeekGraphInstance = null;
  }
  const nodeMap = new Map();
  (nodes || []).forEach((node) => {
    const id = nodeDisplayId(node);
    if (id) nodeMap.set(id, { ...node, id });
  });
  const incoming = new Map();
  const outgoing = new Map();
  (edges || []).forEach((edge) => {
    const source = edge.source || edge.from;
    const target = edge.target || edge.to;
    if (!source || !target) return;
    if (!outgoing.has(source)) outgoing.set(source, []);
    if (!incoming.has(target)) incoming.set(target, []);
    outgoing.get(source).push({ edge, node: nodeMap.get(target) });
    incoming.get(target).push({ edge, node: nodeMap.get(source) });
  });

  knowledgePeekGraph.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "h-full overflow-auto p-3 text-xs";
  const centerNodes = [...nodeMap.values()].filter((node) => highlights && (highlights.has(node.id) || highlights.has(node.name) || highlights.has(nodeDisplayTitle(node))));
  const center = centerNodes[0] || [...nodeMap.values()][0];

  if (!center) {
    shell.innerHTML = '<p class="text-slate-400">暂无图谱关系</p>';
    knowledgePeekGraph.appendChild(shell);
    return;
  }

  const relationBlock = (title, rows, emptyText) => {
    const block = document.createElement("section");
    block.className = "mb-3 rounded-xl border border-slate-200 bg-white p-3";
    block.innerHTML = `<h5 class="mb-2 font-semibold text-slate-900">${escapeHtml(title)}</h5>`;
    const list = document.createElement("div");
    list.className = "space-y-1.5";
    rows.filter((row) => row.node).slice(0, 8).forEach((row) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-left hover:border-emerald-300";
      button.innerHTML = `<span class="truncate text-slate-800">${escapeHtml(nodeDisplayTitle(row.node))}</span><span class="ml-2 text-[10px] text-slate-400">${escapeHtml(row.edge.type || row.edge.label || "关系")}</span>`;
      button.addEventListener("click", () => showStudentKnowledgeCard(nodeDisplayTitle(row.node)));
      list.appendChild(button);
    });
    if (!list.children.length) {
      list.innerHTML = `<p class="text-slate-400">${escapeHtml(emptyText)}</p>`;
    }
    block.appendChild(list);
    return block;
  };

  const centerCard = document.createElement("section");
  centerCard.className = "mb-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3";
  centerCard.innerHTML = `<div class="text-[11px] text-emerald-700">当前知识点</div><div class="mt-1 font-semibold text-emerald-950">${escapeHtml(nodeDisplayTitle(center))}</div>`;
  shell.appendChild(centerCard);
  shell.appendChild(relationBlock("前置/来源", incoming.get(center.id) || [], "暂无前置关系"));
  shell.appendChild(relationBlock("后续/关联", outgoing.get(center.id) || [], "暂无关联关系"));
  knowledgePeekGraph.appendChild(shell);
  knowledgePeekGraphInstance = { destroy: () => { knowledgePeekGraph.innerHTML = ""; } };
  if (knowledgePeekGraphStatus) {
    knowledgePeekGraphStatus.textContent = `${nodes.length} 节点`;
  }
}

// 渲染历史会话列表，供学生继续对话。
function renderSessionHistory() {
  sessionHistoryList.innerHTML = "";
  if (!state.sessions || state.sessions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400";
    empty.textContent = "暂无历史会话，点击左侧生成新场景。";
    sessionHistoryList.appendChild(empty);
    return;
  }

  state.sessions.forEach((session) => {
    const li = document.createElement("li");
    li.className = "rounded-2xl border border-slate-800 bg-slate-900/70 p-4 transition hover:border-slate-600 hover:bg-slate-900";

    const title = document.createElement("p");
    title.className = "text-sm font-semibold text-white";
    title.textContent = session.title || `章节 ${session.chapterId} · 小节 ${session.sectionId}`;

    const summary = document.createElement("p");
    summary.className = "mt-1 text-xs text-slate-400";
    summary.textContent = session.summary || "暂无摘要";

    let difficultyMeta = null;
    if (session.difficultyLabel) {
      difficultyMeta = document.createElement("p");
      difficultyMeta.className = "mt-1 text-[11px] text-slate-500";
      difficultyMeta.textContent = `难度：${session.difficultyLabel}`;
    }

    const footer = document.createElement("div");
    footer.className = "mt-3 flex items-center justify-between text-xs text-slate-500";
    footer.innerHTML = `<span>最近更新：${session.updatedAt || "-"}</span>`;

    const button = document.createElement("button");
    button.className = "rounded-xl border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-500 hover:text-white";
    button.textContent = "继续会话";
    button.dataset.sessionId = session.id;
    footer.appendChild(button);

    li.appendChild(title);
    li.appendChild(summary);
    if (difficultyMeta) {
      li.appendChild(difficultyMeta);
    }
    li.appendChild(footer);
    sessionHistoryList.appendChild(li);
  });
}



// 拉取章节/关卡配置，初始化默认选中项并刷新地图。
async function loadLevels() {
  try {
    const response = await fetch("/api/levels");
    if (!response.ok) {
      throw new Error("无法载入章节信息");
    }
    const data = await response.json();
    state.chapters = sortLevelHierarchy(data.chapters || []);
    if (!(state.expandedChapters instanceof Set)) {
      state.expandedChapters = new Set();
    }
    const preservedExpanded = new Set();
    state.chapters.forEach((chapter) => {
      if (state.expandedChapters.has(chapter.id)) {
        preservedExpanded.add(chapter.id);
      }
    });
    state.expandedChapters = preservedExpanded;
    populateBlueprintChapterOptions();
    const { chapterId, sectionId } = state.selectedLevel || {};
    const currentSection = chapterId && sectionId ? findSection(chapterId, sectionId) : null;
    if (!currentSection) {
      const firstChapter = state.chapters[0];
      const firstSection = firstChapter && (firstChapter.sections || [])[0];
      if (firstChapter && firstSection) {
        state.selectedLevel = { chapterId: firstChapter.id, sectionId: firstSection.id };
      } else {
        state.selectedLevel = { chapterId: null, sectionId: null };
      }
    }
    renderLevelMap();
    updateSelectedLevelDetail();
    refreshStudentTheorySelection();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载章节失败");
  }
}



// 拉取历史会话列表并重建通过记录。
async function loadSessions() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/sessions");
    if (!response.ok) {
      throw new Error("无法加载历史会话");
    }
    const data = await response.json();
    state.sessions = data.sessions || [];
    rebuildLevelVictories();
    renderSessionHistory();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载历史会话失败");
  }
}



// 拉取学生仪表盘数据（成长报告、推荐等）。
async function loadStudentDashboardInsights() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/student/dashboard");
    if (!response.ok) {
      throw new Error("无法加载成长数据");
    }
    const data = await response.json();
    renderStudentInsights(data);
  } catch (error) {
    console.error(error);
    renderStudentInsights(null);
  }
}



// 载入指定会话详情，恢复对话、场景和评估。
async function loadStudentSession(sessionId) {
  if (!sessionId) return;
  try {
    const response = await fetchWithAuth(`/api/sessions/${sessionId}`);
    if (!response.ok) {
      throw new Error("无法载入会话详情");
    }
    const data = await response.json();
    state.sessionId = data.session.id;
    state.messages = (data.messages || []).map((item) => ({ role: item.role, content: item.content }));
    state.activeLevel = {
      chapterId: data.session.chapterId,
      sectionId: data.session.sectionId,
      difficulty: data.session.difficulty || "balanced",
      mode: data.session.mode || state.selectedLevel?.mode || "",
    };
    state.selectedLevel = {
      chapterId: state.activeLevel.chapterId,
      sectionId: state.activeLevel.sectionId,
      mode: state.activeLevel.mode || "",
    };
    ensureReviewState();
    state.review.documentText =
      data.session.scenario?.documentText ||
      data.session.scenario?.document_text ||
      "";
    state.review.hints = data.session.scenario?.reviewHints || null;
    state.review.annotations = [];
    state.review.pendingSelection = null;
    updateSessionControls();
    renderScenario(data.session.scenario || {});
    renderChat();
    renderEvaluation(data.evaluation);
    seedSessionDeck(state.sessionId, data.session.scenario || {});
    activateSession(state.sessionId);
    renderReviewWorkbench();
    collapseLevelSelection();
    updateSelectedLevelDetail();
    showExperience();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载会话失败");
  }
}



// 拉取学生的作业列表并刷新 UI。
async function loadStudentAssignments() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  state.studentAssignments = [];
}



// 进入某个作业对应的会话，初始化场景/提示。
async function startAssignmentSession() {
  return;
}



// 处理学生修改密码表单提交。
async function handleStudentPasswordChange(event) {
  event.preventDefault();
  if (!state.auth.user) return;
  try {
    const response = await fetchWithAuth("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: studentPasswordCurrent.value,
        newPassword: studentPasswordNew.value,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新密码失败");
    }
    studentPasswordCurrent.value = "";
    studentPasswordNew.value = "";
    studentPasswordStatus.textContent = "密码已更新";
  } catch (error) {
    console.error(error);
    studentPasswordStatus.textContent = error.message || "更新密码失败";
  }
}



// 从选中的关卡发起新会话，生成场景并开启对话。
async function startLevel() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    alert("请先使用学生账号登录");
    return;
  }

  const { chapterId, sectionId } = state.selectedLevel || {};
  const difficulty = difficultySelect ? difficultySelect.value : "balanced";

  if (!chapterId || !sectionId) {
    alert("请选择章节与小节");
    return;
  }

  startLevelBtn.disabled = true;
  startLevelBtn.textContent = "加载中...";
  LoadingFX.start();

  const hydrateScenario = async (
    payload,
    { skipRemote = false } = {}
  ) => {
    const scenario = payload.scenario || {};
    const sessionId = payload.sessionId || `demo-${Date.now()}`;
    const opening =
      payload.openingMessage || scenario.openingMessage || scenario.opening_message || "";

    state.sessionId = sessionId;
    state.messages = [];
    state.activeLevel = {
      chapterId,
      sectionId,
      difficulty,
      mode: payload.mode || state.selectedLevel?.mode || "",
    };
    updateSessionControls();

    ensureReviewState();
    state.review.documentText = payload.documentText || scenario.documentText || "";
    state.review.hints = payload.reviewHints || scenario.reviewHints || null;
    state.review.annotations = [];
    state.review.pendingSelection = null;

    renderScenario(scenario);
    resetEvaluation();
    renderReviewWorkbench();
    seedSessionDeck(state.sessionId, scenario);
    activateSession(state.sessionId);

    if (opening) {
      appendMessage("assistant", opening);
    }

    collapseLevelSelection();
    updateSelectedLevelDetail();
    showExperience();
    maybeStartIncomingCall(opening);

    if (!skipRemote) {
      await loadSessions();
      await loadStudentAssignments();
      await loadStudentDashboardInsights();
    }
  };

  try {
    const response = await fetchWithAuth("/api/start_level", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId, sectionId, difficulty }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "无法生成场景");
    }

    const data = await response.json();
    await hydrateScenario({
      sessionId: data.sessionId,
      mode: data.mode,
      scenario: data.scenario || {},
      openingMessage: data.openingMessage,
      documentText: data.documentText,
      reviewHints: data.reviewHints,
    });
    LoadingFX.finish();
  } catch (error) {
    console.warn("演示模式：后端请求失败，启用兜底数据", error);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await hydrateScenario(
      {
        sessionId: `demo-${Date.now()}`,
        mode: state.selectedLevel?.mode || "",
        scenario: DEMO_FALLBACK_SCENARIO,
        openingMessage:
          DEMO_FALLBACK_SCENARIO.openingMessage || DEMO_FALLBACK_SCENARIO.opening_message,
      },
      { skipRemote: true }
    );
    LoadingFX.finish();
    alert("（演示提示：已触发兜底数据模式）");
  } finally {
    startLevelBtn.disabled = false;
    startLevelBtn.textContent = "🚀 进入关卡";
  }
}



// 重置当前会话，清空记录并回到章节选择。
async function resetCurrentSession() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    alert("请使用学生账号体验对话");
    return;
  }
  if (!state.sessionId) {
    alert("当前没有可重置的会话");
    return;
  }
  if (!resetSessionBtn) {
    return;
  }

  const originalLabel = resetSessionBtn.textContent;
  resetSessionBtn.disabled = true;
  resetSessionBtn.textContent = "重置中...";

  try {
    const response = await fetchWithAuth(`/api/sessions/${state.sessionId}/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "重置对话失败");
    }

    await response.json().catch(() => ({}));
    goToLevelSelection({ clearSelection: true });
    closeStudentModal();
    await loadSessions();
    await loadStudentAssignments();
    await loadStudentDashboardInsights();
  } catch (error) {
    console.error(error);
    alert(error.message || "重置会话失败");
  } finally {
    resetSessionBtn.textContent = originalLabel;
    resetSessionBtn.disabled = false;
    updateSessionControls();
  }
}

// 在邮件模式下发送一封邮件形式的对话消息，并处理 AI 回复。
async function sendEmailMessage() {
  ensureEmailDraft();
  if (!state.auth.user || state.auth.user.role !== "student") {
    alert("请使用学生账号体验");
    return;
  }
  if (state.activeSessionId && state.sessionId && state.activeSessionId !== state.sessionId) {
    alert("当前为模拟侧边会话，无法发送。请切回主会话。");
    return;
  }
  if (!state.sessionId) {
    alert("请先选择关卡并加载场景");
    return;
  }
  const subject = emailSubjectInput ? emailSubjectInput.value.trim() : "";
  const to = emailToInput ? emailToInput.value.trim() : "";
  const from = emailFromInput ? emailFromInput.value.trim() : "";
  const body = emailBodyInput ? emailBodyInput.value.trim() : "";
  const signature = emailSignatureInput ? emailSignatureInput.value.trim() : "";
  if (!subject || !body) {
    alert("请填写 Subject 与正文后再发送");
    return;
  }
  state.emailDraft = { subject, body, signature };

  const composed = `Subject: ${subject}\nTo: ${to}\nFrom: ${from}\n\n${body}${signature ? `\n\n${signature}` : ""}`;

  if (emailSendBtn) {
    emailSendBtn.disabled = true;
    emailSendBtn.textContent = "发送中...";
  }
  const userIndex = appendMessage("user", composed, { subject });
  renderChat();
  setEvaluationLoading(true);
  try {
    const response = await fetchWithAuth("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, message: composed }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "发送失败");
    }
    const data = await response.json();
    if (data.reply) {
      appendMessage("assistant", data.reply);
    }
    if (data.evaluation) {
      renderEvaluation(data.evaluation);
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "发送失败");
    state.messages.splice(userIndex, 1);
    renderChat();
  } finally {
    setEvaluationLoading(false);
    if (emailSendBtn) {
      emailSendBtn.disabled = false;
      emailSendBtn.textContent = "发送邮件";
    }
  }
}

// 使用 Copilot 为当前邮件生成草稿。
async function handleEmailDraft() {
  if (!isEmailModeActive()) return;
  const intent = window.prompt("告诉 Copilot 你的意图（例：写一封委婉的催款信）");
  if (!intent) return;
  setEmailCopilotStatus("AI 正在起草...", "loading");
  try {
    const response = await fetchWithAuth("/api/ai/email/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.sessionId,
        action: "draft",
        user_input: intent,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "起草失败");
    }
    if (emailBodyInput) {
      emailBodyInput.value = data.suggestion || emailBodyInput.value;
      state.emailDraft.body = emailBodyInput.value;
    }
    setEmailCopilotStatus("已生成草稿");
  } catch (error) {
    console.error(error);
    setEmailCopilotStatus(error.message || "AI 起草失败", "error");
  }
}

// 使用 Copilot 对邮件草稿进行润色。
async function handleEmailPolish() {
  if (!isEmailModeActive()) return;
  const subject = emailSubjectInput ? emailSubjectInput.value.trim() : "";
  const to = emailToInput ? emailToInput.value.trim() : "";
  const from = emailFromInput ? emailFromInput.value.trim() : "";
  const body = emailBodyInput ? emailBodyInput.value.trim() : "";
  const signature = emailSignatureInput ? emailSignatureInput.value.trim() : "";
  const draft = `Subject: ${subject}\nTo: ${to}\nFrom: ${from}\n\n${body}${signature ? `\n\n${signature}` : ""}`;
  setEmailCopilotStatus("AI 正在润色...", "loading");
  try {
    const response = await fetchWithAuth("/api/ai/email/assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: state.sessionId,
        action: "polish",
        user_input: draft,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "润色失败");
    }
    if (emailBodyInput) {
      emailBodyInput.value = data.suggestion || emailBodyInput.value;
      state.emailDraft.body = emailBodyInput.value;
    }
    setEmailCopilotStatus("润色完成");
  } catch (error) {
    console.error(error);
    setEmailCopilotStatus(error.message || "AI 润色失败", "error");
  }
}

// 文本输入框发送消息的入口，自动区分邮件/普通模式。
async function sendMessage() {
  if (isEmailModeActive()) {
    return sendEmailMessage();
  }
  if (!state.auth.user || state.auth.user.role !== "student") {
    alert("请使用学生账号体验对话");
    return;
  }
  const message = chatInputEl.value.trim();
  if (!message) {
    return;
  }
  chatInputEl.value = "";
  await sendMessageWithContent(message);
}

// 注册顶部抽屉事件
if (scenarioDrawerToggle) {
  scenarioDrawerToggle.addEventListener("click", openScenarioDrawer);
}
if (scenarioDrawerMinimize) {
  scenarioDrawerMinimize.addEventListener("click", toggleScenarioDrawerMinimize);
}
if (scenarioDrawerClose) {
  scenarioDrawerClose.addEventListener("click", closeScenarioDrawer);
}
if (evaluationToggle) {
  evaluationToggle.addEventListener("click", () => {
    if (evaluationPanelOpen) {
      closeEvaluationPanelDrawer();
    } else {
      openEvaluationPanelDrawer();
    }
  });
}
if (evaluationPanelClose) {
  evaluationPanelClose.addEventListener("click", closeEvaluationPanelDrawer);
}

if (evaluationTabAnalysis) {
  evaluationTabAnalysis.addEventListener("click", () => setEvaluationTab("analysis"));
}
if (evaluationTabLexical) {
  evaluationTabLexical.addEventListener("click", () => setEvaluationTab("lexical"));
}

if (chatInputEl) {
  chatInputEl.addEventListener("input", (e) => {
    const text = e.target.value || "";
    scheduleLexicalSuggestions(text);
  });
}

// 默认显示对话分析
setEvaluationTab("analysis");
window.addEventListener("resize", () => {
  if (window.innerWidth <= 768) {
    scenarioWindowMinimized = false;
    if (scenarioDrawer) scenarioDrawer.classList.remove("minimized");
    resetScenarioWindowTransform();
  }
});

if (knowledgePeekClose) {
  knowledgePeekClose.addEventListener("click", closeKnowledgePeek);
}
if (knowledgePeek) {
  knowledgePeek.addEventListener("click", (event) => {
    if (event.target === knowledgePeek) {
      closeKnowledgePeek();
    }
  });
}
