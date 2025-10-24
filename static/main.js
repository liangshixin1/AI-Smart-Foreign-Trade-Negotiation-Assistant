const authPanel = document.getElementById("auth-panel");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const loginErrorEl = document.getElementById("login-error");
const userStatusLabel = document.getElementById("user-status-label");
const logoutBtn = document.getElementById("logout-btn");
const changePasswordBtn = document.getElementById("change-password-btn");

const studentDashboard = document.getElementById("student-dashboard");
const adminPanel = document.getElementById("admin-panel");
const refreshSessionsBtn = document.getElementById("refresh-sessions");
const sessionHistoryList = document.getElementById("session-history");
const studentTopControls = document.getElementById("student-top-controls");

const adminStudentList = document.getElementById("admin-student-list");
const adminStudentMeta = document.getElementById("admin-student-meta");
const adminSessionList = document.getElementById("admin-session-list");
const adminSessionScenario = document.getElementById("admin-session-scenario");
const adminSessionConversation = document.getElementById("admin-session-conversation");
const adminSessionEvaluation = document.getElementById("admin-session-evaluation");
const adminAssignmentList = document.getElementById("admin-assignment-list");
const adminAssignmentForm = document.getElementById("admin-assignment-form");
const adminAssignmentStatus = document.getElementById("admin-assignment-status");
const adminAssignmentIdInput = document.getElementById("admin-assignment-id");
const adminAssignmentTitle = document.getElementById("admin-assignment-title");
const adminAssignmentDescription = document.getElementById("admin-assignment-description");
const adminAssignmentDifficulty = document.getElementById("admin-assignment-difficulty");
const adminAssignmentChapter = document.getElementById("admin-assignment-chapter");
const adminAssignmentSection = document.getElementById("admin-assignment-section");
const adminAssignmentBlueprint = document.getElementById("admin-assignment-blueprint");
const adminAssignmentScenario = document.getElementById("admin-assignment-scenario");
const adminAssignmentScenarioHost = document.getElementById(
  "admin-assignment-scenario-editor",
);
const adminAssignmentStudents = document.getElementById("admin-assignment-students");
const adminAssignmentGenerateBtn = document.getElementById("admin-assignment-generate");
const adminAssignmentGeneratorStatus = document.getElementById("admin-assignment-generator-status");
const adminBlueprintList = document.getElementById("admin-blueprint-list");
const adminBlueprintForm = document.getElementById("admin-blueprint-form");
const adminBlueprintStatus = document.getElementById("admin-blueprint-status");
const adminBlueprintIdInput = document.getElementById("admin-blueprint-id");
const adminBlueprintTitle = document.getElementById("admin-blueprint-title");
const adminBlueprintSummary = document.getElementById("admin-blueprint-summary");
const adminBlueprintStudentRole = document.getElementById("admin-blueprint-student-role");
const adminBlueprintAiRole = document.getElementById("admin-blueprint-ai-role");
const adminBlueprintStudentCompanyName = document.getElementById("admin-blueprint-student-company-name");
const adminBlueprintStudentCompanyProfile = document.getElementById("admin-blueprint-student-company-profile");
const adminBlueprintAiCompanyName = document.getElementById("admin-blueprint-ai-company-name");
const adminBlueprintAiCompanyProfile = document.getElementById("admin-blueprint-ai-company-profile");
const adminBlueprintAiRules = document.getElementById("admin-blueprint-ai-rules");
const adminBlueprintProductName = document.getElementById("admin-blueprint-product-name");
const adminBlueprintProductSpecs = document.getElementById("admin-blueprint-product-specs");
const adminBlueprintProductQuantity = document.getElementById("admin-blueprint-product-quantity");
const adminBlueprintStudentPrice = document.getElementById("admin-blueprint-student-price");
const adminBlueprintAiBottom = document.getElementById("admin-blueprint-ai-bottom");
const adminBlueprintMarket = document.getElementById("admin-blueprint-market");
const adminBlueprintTimeline = document.getElementById("admin-blueprint-timeline");
const adminBlueprintLogistics = document.getElementById("admin-blueprint-logistics");
const adminBlueprintNegotiationTargets = document.getElementById("admin-blueprint-negotiation-targets");
const adminBlueprintRisks = document.getElementById("admin-blueprint-risks");
const adminBlueprintChecklist = document.getElementById("admin-blueprint-checklist");
const adminBlueprintKnowledge = document.getElementById("admin-blueprint-knowledge");
const adminBlueprintOpening = document.getElementById("admin-blueprint-opening");
const adminBlueprintDifficulty = document.getElementById("admin-blueprint-difficulty");
const adminBlueprintReset = document.getElementById("admin-blueprint-reset");
const adminBlueprintGenerateBtn = document.getElementById("admin-blueprint-generate");
const adminBlueprintGeneratorStatus = document.getElementById("admin-blueprint-generator-status");
const adminBlueprintChapter = document.getElementById("admin-blueprint-chapter");
const adminBlueprintSection = document.getElementById("admin-blueprint-section");
const adminStudentImportForm = document.getElementById("admin-student-import-form");
const adminStudentImportFile = document.getElementById("admin-student-import-file");
const adminStudentImportStatus = document.getElementById("admin-student-import-status");
const adminStudentPasswordForm = document.getElementById("admin-student-password-form");
const adminStudentPasswordInput = document.getElementById("admin-student-new-password");
const adminStudentPasswordStatus = document.getElementById("admin-student-password-status");
const adminProfileForm = document.getElementById("admin-profile-form");
const adminProfileNameInput = document.getElementById("admin-profile-name");
const adminProfileStatus = document.getElementById("admin-profile-status");
const adminPasswordForm = document.getElementById("admin-password-form");
const adminPasswordCurrent = document.getElementById("admin-password-current");
const adminPasswordNew = document.getElementById("admin-password-new");
const adminPasswordStatus = document.getElementById("admin-password-status");
const studentAssignmentListEl = document.getElementById("student-assignment-list");
const studentAssignmentStatus = document.getElementById("student-assignment-status");
const studentPasswordForm = document.getElementById("student-password-form");
const studentPasswordCurrent = document.getElementById("student-password-current");
const studentPasswordNew = document.getElementById("student-password-new");
const studentPasswordStatus = document.getElementById("student-password-status");

const levelSelectionPanel = document.getElementById("level-selection-panel");
const levelMapContainer = document.getElementById("level-map");
const selectedLevelDetail = document.getElementById("selected-level-detail");
const selectedLevelTitle = document.getElementById("selected-level-title");
const selectedLevelDescription = document.getElementById("selected-level-description");
const startLevelBtn = document.getElementById("start-level");
const startAssignmentBtn = document.getElementById("start-assignment");
const difficultySelect = document.getElementById("difficulty-select");
const loadingPanel = document.getElementById("loading-panel");
const experienceSection = document.getElementById("experience");
const studentOptionButtons = document.querySelectorAll("[data-student-option]");
const studentModalOverlay = document.getElementById("student-modal-overlay");
const studentModal = document.getElementById("student-modal");
const studentModalCloseBtn = document.getElementById("student-modal-close");
const studentModalTabButtons = document.querySelectorAll("#student-modal [data-modal-tab]");
const studentModalPanels = document.querySelectorAll("#student-modal [data-modal-panel]");
const studentPasswordModal = document.getElementById("student-password-modal");
const studentPasswordModalClose = document.getElementById("student-password-modal-close");
const adminTabButtons = document.querySelectorAll("#admin-panel [data-admin-tab]");
const adminTabPanels = document.querySelectorAll("#admin-panel [data-admin-panel]");
const reopenLevelMapBtn = document.getElementById("reopen-level-map");
const resetSessionBtn = document.getElementById("reset-session");

const levelChapterList = document.getElementById("level-chapter-list");
const levelCreateChapterBtn = document.getElementById("level-create-chapter");
const levelCreateSectionBtn = document.getElementById("level-create-section");
const levelChapterStatus = document.getElementById("level-chapter-status");
const levelSectionStatus = document.getElementById("level-section-status");
const chapterEditorForm = document.getElementById("chapter-editor-form");
const chapterEditorTitle = document.getElementById("chapter-editor-title");
const chapterEditorDescription = document.getElementById("chapter-editor-description");
const chapterEditorOrder = document.getElementById("chapter-editor-order");
const levelSaveChapterBtn = document.getElementById("level-save-chapter");
const levelDeleteChapterBtn = document.getElementById("level-delete-chapter");
const sectionEditorForm = document.getElementById("section-editor-form");
const sectionEditorTitle = document.getElementById("section-editor-title");
const sectionEditorDescription = document.getElementById("section-editor-description");
const sectionEditorEnvironment = document.getElementById("section-editor-environment");
const sectionEditorEnvironmentUser = document.getElementById("section-editor-environment-user");
const sectionEditorConversation = document.getElementById("section-editor-conversation");
const sectionEditorEvaluation = document.getElementById("section-editor-evaluation");
const sectionEditorEnvironmentHost = document.getElementById("section-editor-environment-editor");
const sectionEditorConversationHost = document.getElementById("section-editor-conversation-editor");
const sectionEditorEvaluationHost = document.getElementById("section-editor-evaluation-editor");
const sectionEditorBargaining = document.getElementById("section-editor-bargaining");
const sectionEditorOrder = document.getElementById("section-editor-order");
const levelSaveSectionBtn = document.getElementById("level-save-section");
const levelDeleteSectionBtn = document.getElementById("level-delete-section");

const scenarioTitleEl = document.getElementById("scenario-title");
const scenarioSummaryEl = document.getElementById("scenario-summary");
const studentRoleEl = document.getElementById("student-role");
const studentCompanyEl = document.getElementById("student-company");
const aiRoleEl = document.getElementById("ai-role");
const aiCompanyEl = document.getElementById("ai-company");
const productDetailsEl = document.getElementById("product-details");
const negotiationFocusEl = document.getElementById("negotiation-focus");
const riskListEl = document.getElementById("risk-list");
const taskChecklistEl = document.getElementById("task-checklist");
const chatCompanyEl = document.getElementById("chat-company");
const chatToneEl = document.getElementById("chat-tone");
const chatBodyEl = document.getElementById("chat-body");
const chatInputEl = document.getElementById("chat-input");
const sendMessageBtn = document.getElementById("send-message");
const evaluationScoreEl = document.getElementById("evaluation-score");
const evaluationScoreLabelEl = document.getElementById("evaluation-score-label");
const evaluationCommentaryEl = document.getElementById("evaluation-commentary");
const evaluationActionsEl = document.getElementById("evaluation-actions");
const evaluationKnowledgeEl = document.getElementById("evaluation-knowledge");
const abilityRadarCanvas = document.getElementById("ability-radar");
const abilityRadarEmpty = document.getElementById("ability-radar-empty");
const abilityHistoryList = document.getElementById("ability-history");
const abilityKnowledgeEl = document.getElementById("ability-knowledge");
const scenarioDifficultyEl = document.getElementById("scenario-difficulty");
const scenarioPanel = document.getElementById("scenario-panel");
const scenarioCollapseBtn = document.getElementById("scenario-collapse-btn");
const scenarioPanelBody = document.getElementById("scenario-panel-body");
const experienceModules = document.querySelectorAll("[data-experience-module]");
const experienceTabButtons = document.querySelectorAll(".experience-tab");

const adminTrendList = document.getElementById("admin-trend-list");
const adminActionHotspots = document.getElementById("admin-action-hotspots");
const adminKnowledgeWeakness = document.getElementById("admin-knowledge-weakness");

let abilityRadarChart = null;
let currentStudentModalTab = null;
let activeExperienceModule = "chat";
let isScenarioCollapsed = false;

const hasMarked = typeof window !== "undefined" && typeof window.marked !== "undefined";
if (hasMarked) {
  window.marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

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

function renderMarkdown(text) {
  const safeText = typeof text === "string" ? text : "";
  if (hasMarked && typeof window.DOMPurify !== "undefined") {
    const rendered = window.marked.parse(safeText);
    return window.DOMPurify.sanitize(rendered, { USE_PROFILES: { html: true } });
  }
  return escapeHtml(safeText).replace(/\n/g, "<br />");
}

const state = {
  auth: {
    token: null,
    user: null,
  },
  chapters: [],
  sessionId: null,
  scenario: null,
  messages: [],
  sessions: [],
  selectedLevel: { chapterId: null, sectionId: null },
  activeLevel: { chapterId: null, sectionId: null, difficulty: "balanced" },
  isLevelSelectionCollapsed: false,
  expandedChapters: new Set(),
  admin: {
    students: [],
    selectedStudentId: null,
    selectedSessionId: null,
    studentDetail: null,
    analytics: null,
    levels: [],
    selectedEditorChapterId: null,
    selectedEditorSectionId: null,
    blueprints: [],
    assignments: [],
    selectedBlueprintId: null,
    selectedAssignmentId: null,
  },
  studentInsights: null,
  studentAssignments: [],
  levelVictories: new Set(),
};

const PROMPT_TOKEN_DEFINITIONS = {
  scenario_title: {
    label: "场景标题",
    description: "AI 生成的场景题目，可用于提醒训练主题。",
  },
  scenario_summary: {
    label: "场景摘要",
    description: "概括市场背景与合作目标的摘要段落。",
  },
  student_role: {
    label: "学生身份",
    description: "学生在本场景中扮演的角色与职位。",
  },
  student_company_name: {
    label: "学生公司名称",
    description: "学生所在公司的名称。",
  },
  student_company_profile: {
    label: "学生公司简介",
    description: "学生公司的背景、优势或主营业务。",
  },
  ai_role: {
    label: "AI 身份",
    description: "AI 扮演的谈判角色。",
  },
  ai_company_name: {
    label: "AI 公司名称",
    description: "AI 方所属公司的名称。",
  },
  ai_company_profile: {
    label: "AI 公司简介",
    description: "AI 方公司的业务背景或优势。",
  },
  product_name: {
    label: "产品名称",
    description: "交易产品的名称或品类。",
  },
  product_specs: {
    label: "产品规格",
    description: "关键规格、品质标准或技术参数。",
  },
  product_quantity: {
    label: "数量需求",
    description: "需求或可供的数量信息。",
  },
  student_target_price: {
    label: "学生目标价",
    description: "学生期望的价格或目标条件。",
  },
  ai_bottom_line: {
    label: "AI 底线",
    description: "AI 方可接受的底线或最低条件。",
  },
  market_landscape: {
    label: "市场环境",
    description: "目标市场与行业的现况提示。",
  },
  timeline: {
    label: "时间节点",
    description: "交期或关键时间安排。",
  },
  logistics: {
    label: "物流条款",
    description: "物流、交货或贸易条款要点。",
  },
  communication_tone: {
    label: "沟通语气",
    description: "谈判过程建议采用的语气与礼仪。",
  },
  risks_summary: {
    label: "风险提示",
    description: "场景中的风险提醒合并内容。",
  },
  knowledge_points_hint: {
    label: "知识点提示",
    description: "需要覆盖或检查的核心知识点。",
  },
  negotiation_focus_hint: {
    label: "谈判焦点",
    description: "需要重点讨论的议题列表。",
  },
};

const PROMPT_TOKEN_GROUPS = [
  {
    label: "角色设定",
    tokens: [
      "student_role",
      "student_company_name",
      "student_company_profile",
      "ai_role",
      "ai_company_name",
      "ai_company_profile",
    ],
  },
  {
    label: "产品与条款",
    tokens: [
      "product_name",
      "product_specs",
      "product_quantity",
      "student_target_price",
      "ai_bottom_line",
      "logistics",
    ],
  },
  {
    label: "场景背景",
    tokens: [
      "scenario_title",
      "scenario_summary",
      "market_landscape",
      "timeline",
      "communication_tone",
      "risks_summary",
      "negotiation_focus_hint",
    ],
  },
  {
    label: "学习反馈",
    tokens: ["knowledge_points_hint"],
  },
];

class TokenEditor {
  constructor({ container, textarea, definitions, groups, placeholder }) {
    this.container = container;
    this.textarea = textarea;
    this.definitions = definitions || {};
    this.groups = groups || [];
    this.placeholder = placeholder || "";

    this._handleToolbarClick = this._handleToolbarClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handlePaste = this._handlePaste.bind(this);
    this._emitChange = this._emitChange.bind(this);

    if (!this.container) {
      return;
    }

    this.container.innerHTML = "";
    this.container.classList.add("token-editor");

    this.toolbar = document.createElement("div");
    this.toolbar.className = "token-editor-toolbar";

    this.surface = document.createElement("div");
    this.surface.className = "token-editor-surface";
    this.surface.setAttribute("contenteditable", "true");
    this.surface.setAttribute("role", "textbox");
    this.surface.setAttribute("aria-multiline", "true");
    this.surface.dataset.empty = "true";
    if (this.placeholder) {
      this.surface.dataset.placeholder = this.placeholder;
    }

    this.container.appendChild(this.toolbar);
    this.container.appendChild(this.surface);

    this._renderToolbar();
    this._bindEvents();
    const initialValue = this.textarea ? this.textarea.value : "";
    this.setValue(initialValue, { silent: true });
  }

  setValue(value = "", options = {}) {
    if (!this.surface) {
      if (this.textarea) {
        this.textarea.value = value;
      }
      return;
    }
    this._clearSurface();
    const segments = this._parseTemplate(value);
    segments.forEach((segment) => {
      if (!segment) {
        return;
      }
      if (segment.type === "token" && segment.name) {
        const tokenEl = this._createTokenElement(segment.name);
        this.surface.appendChild(tokenEl);
        return;
      }
      if (segment.type === "text" && segment.value) {
        const textNode = document.createTextNode(segment.value);
        this.surface.appendChild(textNode);
      }
    });
    this._updateEmptyState();
    this._syncTextarea({ silent: !!options.silent });
  }

  getValue() {
    if (!this.surface) {
      return this.textarea ? this.textarea.value : "";
    }
    return this._serializeSurface();
  }

  focus() {
    if (this.surface) {
      this.surface.focus();
    }
  }

  _renderToolbar() {
    if (!this.toolbar) {
      return;
    }
    this.toolbar.innerHTML = "";
    const groups = this.groups && this.groups.length > 0 ? this.groups : [
      { label: "可用变量", tokens: Object.keys(this.definitions || {}) },
    ];
    groups.forEach((group) => {
      if (!group || !Array.isArray(group.tokens) || group.tokens.length === 0) {
        return;
      }
      const groupEl = document.createElement("div");
      groupEl.className = "token-editor-group";
      if (group.label) {
        const labelEl = document.createElement("span");
        labelEl.className = "token-editor-group-label";
        labelEl.textContent = group.label;
        groupEl.appendChild(labelEl);
      }
      group.tokens.forEach((tokenName) => {
        const def = this.definitions[tokenName] || { label: tokenName };
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.tokenName = tokenName;
        button.textContent = def.label || tokenName;
        const tokenLabel = `{${tokenName}}`;
        button.title = def.description ? `${tokenLabel}｜${def.description}` : tokenLabel;
        groupEl.appendChild(button);
      });
      this.toolbar.appendChild(groupEl);
    });
  }

  _bindEvents() {
    if (!this.surface) {
      return;
    }
    if (this.toolbar) {
      this.toolbar.addEventListener("click", this._handleToolbarClick);
    }
    this.surface.addEventListener("keydown", this._handleKeyDown);
    this.surface.addEventListener("paste", this._handlePaste);
    this.surface.addEventListener("input", this._emitChange);
    this.surface.addEventListener("blur", this._emitChange);
    this.surface.addEventListener("keyup", () => this._updateEmptyState());
    this.surface.addEventListener("mouseup", () => this._updateEmptyState());
    this.surface.addEventListener("drop", (event) => {
      event.preventDefault();
    });
  }

  _handleToolbarClick(event) {
    const button = event.target.closest("button[data-token-name]");
    if (!button) {
      return;
    }
    event.preventDefault();
    const tokenName = button.dataset.tokenName;
    if (tokenName) {
      this._insertToken(tokenName);
    }
  }

  _createTokenElement(name) {
    const def = this.definitions[name] || { label: name };
    const chip = document.createElement("span");
    chip.className = "token-chip";
    chip.dataset.tokenName = name;
    chip.setAttribute("contenteditable", "false");
    const nameEl = document.createElement("span");
    nameEl.className = "token-chip-name";
    nameEl.textContent = def.label || name;
    chip.appendChild(nameEl);
    const codeEl = document.createElement("span");
    codeEl.className = "token-chip-code";
    codeEl.textContent = `{${name}}`;
    chip.appendChild(codeEl);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "token-chip-remove";
    removeBtn.setAttribute("aria-label", `移除 {${name}}`);
    removeBtn.innerHTML = "&times;";
    removeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      chip.remove();
      this._emitChange();
    });
    chip.appendChild(removeBtn);
    chip.title = def.description ? `${def.label || name}｜${def.description}` : `{${name}}`;
    return chip;
  }

  _insertToken(name) {
    if (!this.surface) {
      if (this.textarea) {
        this.textarea.value = `${this.textarea.value || ""}{${name}}`;
      }
      return;
    }
    this.surface.focus();
    const tokenEl = this._createTokenElement(name);
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !this.surface.contains(selection.anchorNode)) {
      this.surface.appendChild(tokenEl);
    } else {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(tokenEl);
      range.setStartAfter(tokenEl);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    this._emitChange();
  }

  _insertText(text) {
    if (!this.surface || !text) {
      return;
    }
    const normalized = text.replace(/\r\n/g, "\n");
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !this.surface.contains(selection.anchorNode)) {
      this.surface.appendChild(document.createTextNode(normalized));
    } else {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      const node = document.createTextNode(normalized);
      range.insertNode(node);
      range.setStart(node, node.length);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    this._emitChange();
  }

  _handleKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      this._insertText("\n");
      return;
    }
    if (event.key === "Backspace") {
      if (this._selectionTouchesToken("backward")) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === "Delete") {
      if (this._selectionTouchesToken("forward")) {
        event.preventDefault();
      }
    }
  }

  _handlePaste(event) {
    event.preventDefault();
    const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    if (text) {
      this._insertText(text);
    }
  }

  _selectionTouchesToken(direction) {
    if (!this.surface) {
      return false;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return false;
    }
    const range = selection.getRangeAt(0);
    if (!this.surface.contains(range.commonAncestorContainer)) {
      return false;
    }
    if (!range.collapsed) {
      const tokens = Array.from(this.surface.querySelectorAll("[data-token-name]"));
      return tokens.some((token) => range.intersectsNode(token));
    }
    if (direction === "backward") {
      return !!this._findAdjacentToken(range.startContainer, range.startOffset, -1);
    }
    if (direction === "forward") {
      return !!this._findAdjacentToken(range.startContainer, range.startOffset, 1);
    }
    return false;
  }

  _findAdjacentToken(container, offset, direction) {
    if (!container) {
      return null;
    }
    if (container.nodeType === Node.TEXT_NODE) {
      const length = container.nodeValue ? container.nodeValue.length : 0;
      if (direction < 0 && offset > 0) {
        return null;
      }
      if (direction > 0 && offset < length) {
        return null;
      }
      let current = direction < 0 ? container.previousSibling : container.nextSibling;
      let parent = container.parentNode;
      while (!current && parent && parent !== this.surface) {
        current = direction < 0 ? parent.previousSibling : parent.nextSibling;
        parent = parent.parentNode;
      }
      container = current || parent;
    }
    let node = container;
    if (node && node.nodeType === Node.ELEMENT_NODE) {
      if (direction < 0 && node.childNodes && node.childNodes.length > 0) {
        const child = node.childNodes[offset - 1];
        if (child) {
          node = child;
          while (node && node.lastChild) {
            node = node.lastChild;
          }
        } else {
          node = node.previousSibling;
        }
      } else if (direction > 0 && node.childNodes && node.childNodes.length > offset) {
        node = node.childNodes[offset];
        while (node && node.firstChild) {
          node = node.firstChild;
        }
      }
    }
    while (node && node !== this.surface) {
      if (node.nodeType === Node.ELEMENT_NODE && node.dataset && node.dataset.tokenName) {
        return node;
      }
      node = direction < 0 ? node.previousSibling : node.nextSibling;
    }
    return null;
  }

  _serializeSurface() {
    if (!this.surface) {
      return "";
    }
    const nodes = Array.from(this.surface.childNodes);
    return nodes.map((node) => this._serializeNode(node)).join("");
  }

  _serializeNode(node) {
    if (!node) {
      return "";
    }
    if (node.nodeType === Node.TEXT_NODE) {
      return this._escapeLiteral(node.nodeValue || "");
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.dataset && node.dataset.tokenName) {
        return `{${node.dataset.tokenName}}`;
      }
      if (node.tagName === "BR") {
        return "\n";
      }
      const children = Array.from(node.childNodes).map((child) => this._serializeNode(child)).join("");
      return children;
    }
    return "";
  }

  _escapeLiteral(value) {
    return (value || "").replace(/\{/g, "{{").replace(/\}/g, "}}");
  }

  _parseTemplate(value) {
    const source = typeof value === "string" ? value.replace(/\r\n/g, "\n") : "";
    const result = [];
    const tokenRegex = /{{|}}|{[a-zA-Z0-9_]+}/g;
    let lastIndex = 0;
    source.replace(tokenRegex, (match, index) => {
      if (index > lastIndex) {
        result.push({ type: "text", value: source.slice(lastIndex, index) });
      }
      if (match === "{{") {
        result.push({ type: "text", value: "{" });
      } else if (match === "}}") {
        result.push({ type: "text", value: "}" });
      } else {
        result.push({ type: "token", name: match.slice(1, -1) });
      }
      lastIndex = index + match.length;
      return match;
    });
    if (lastIndex < source.length) {
      result.push({ type: "text", value: source.slice(lastIndex) });
    }
    return result;
  }

  _clearSurface() {
    if (this.surface) {
      this.surface.innerHTML = "";
    }
  }

  _syncTextarea(options = {}) {
    if (!this.textarea) {
      return;
    }
    const value = this._serializeSurface();
    this.textarea.value = value;
    if (!options.silent) {
      const event = new Event("input", { bubbles: true });
      this.textarea.dispatchEvent(event);
    }
  }

  _updateEmptyState() {
    if (!this.surface) {
      return;
    }
    const hasToken = this.surface.querySelector("[data-token-name]") !== null;
    const textContent = (this.surface.textContent || "").replace(/\u200b/g, "");
    const hasText = textContent.trim().length > 0;
    this.surface.dataset.empty = hasToken || hasText ? "false" : "true";
  }

  _emitChange() {
    this._updateEmptyState();
    this._syncTextarea();
  }
}

const tokenEditors = {};

function initTokenEditors() {
  const definitions = PROMPT_TOKEN_DEFINITIONS;
  const groups = PROMPT_TOKEN_GROUPS;
  if (sectionEditorEnvironment && sectionEditorEnvironmentHost) {
    tokenEditors.environment = new TokenEditor({
      container: sectionEditorEnvironmentHost,
      textarea: sectionEditorEnvironment,
      definitions,
      groups,
      placeholder: "描述用于生成场景的系统提示，变量会被后台自动替换。",
    });
  }
  if (sectionEditorConversation && sectionEditorConversationHost) {
    tokenEditors.conversation = new TokenEditor({
      container: sectionEditorConversationHost,
      textarea: sectionEditorConversation,
      definitions,
      groups,
      placeholder: "规划 AI 的回应策略、语气与规则，可随时插入变量。",
    });
  }
  if (sectionEditorEvaluation && sectionEditorEvaluationHost) {
    tokenEditors.evaluation = new TokenEditor({
      container: sectionEditorEvaluationHost,
      textarea: sectionEditorEvaluation,
      definitions,
      groups,
      placeholder: "定义评估维度与输出格式，变量将用于生成针对性的反馈。",
    });
  }
  if (adminAssignmentScenario && adminAssignmentScenarioHost) {
    tokenEditors.assignmentScenario = new TokenEditor({
      container: adminAssignmentScenarioHost,
      textarea: adminAssignmentScenario,
      definitions,
      groups,
      placeholder: "使用 JSON 描述统一作业场景，可插入变量占位符。",
    });
  }
}

function toggleLoading(isLoading) {
  if (isLoading) {
    loadingPanel.classList.remove("hidden");
  } else {
    loadingPanel.classList.add("hidden");
  }
}

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

function collapseLevelSelection() {
  if (!levelSelectionPanel) {
    return;
  }
  levelSelectionPanel.classList.add("hidden");
  state.isLevelSelectionCollapsed = true;
}

function expandLevelSelection() {
  if (!levelSelectionPanel) {
    return;
  }
  levelSelectionPanel.classList.remove("hidden");
  state.isLevelSelectionCollapsed = false;
  highlightSelectedLevel();
}

function findChapter(chapterId) {
  return (state.chapters || []).find((chapter) => chapter.id === chapterId) || null;
}

function findSection(chapterId, sectionId) {
  const chapter = findChapter(chapterId);
  if (!chapter) {
    return null;
  }
  return (chapter.sections || []).find((section) => section.id === sectionId) || null;
}

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
  if (chapterId) {
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
    updateAssignmentShortcut();
    return;
  }
  const chapter = findChapter(chapterId);
  const section = findSection(chapterId, sectionId);
  if (!chapter || !section) {
    selectedLevelDetail.classList.add("hidden");
    startLevelBtn.disabled = true;
    updateAssignmentShortcut();
    return;
  }
  selectedLevelTitle.textContent = `${chapter.title || "章节"}｜${section.title || "小节"}`;
  selectedLevelDescription.textContent = section.description || "";
  selectedLevelDetail.classList.remove("hidden");
  startLevelBtn.disabled = false;
  highlightSelectedLevel();
  updateAssignmentShortcut();
}

function setSelectedLevel(chapterId, sectionId) {
  state.selectedLevel = { chapterId, sectionId };
  updateSelectedLevelDetail();
}

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
  const selectedChapterId = state.selectedLevel?.chapterId || null;

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
    summary.innerHTML = `
      <div class="chapter-card-summary-content">
        <p class="chapter-card-title">${chapter.title || "章节"}</p>
        <p class="chapter-card-description">${chapter.description || `Chapter ${index + 1}`}</p>
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
      } else {
        state.expandedChapters.delete(chapter.id);
      }
    });

    levelMapContainer.appendChild(card);
  });

  state.expandedChapters = expandedChapters;

  highlightSelectedLevel();
}

function updateSessionControls() {
  if (resetSessionBtn) {
    resetSessionBtn.disabled = !state.sessionId;
  }
}

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

function closeStudentPasswordModal() {
  if (!studentPasswordModal) {
    return;
  }
  studentPasswordModal.classList.add("hidden");
  if (document.body) {
    document.body.classList.remove("overflow-hidden");
  }
}

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

function showExperience() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  studentDashboard.classList.remove("hidden");
  experienceSection.classList.remove("hidden");
  setActiveExperienceModule("chat");
  if (chatInputEl) {
    chatInputEl.disabled = false;
    chatInputEl.focus();
  }
  if (sendMessageBtn) {
    sendMessageBtn.disabled = false;
  }
}

function showStudentDashboardHome() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  studentDashboard.classList.remove("hidden");
  expandLevelSelection();
  hideExperience();
}

function hideExperience() {
  experienceSection.classList.add("hidden");
  if (chatInputEl) {
    chatInputEl.disabled = true;
  }
  if (sendMessageBtn) {
    sendMessageBtn.disabled = true;
  }
}

function goToLevelSelection({ clearSelection = false } = {}) {
  if (clearSelection) {
    state.selectedLevel = { chapterId: null, sectionId: null };
  }
  state.sessionId = null;
  state.activeLevel = {
    chapterId: null,
    sectionId: null,
    difficulty: difficultySelect ? difficultySelect.value : "balanced",
  };
  state.messages = [];
  renderChat();
  renderScenario({});
  resetEvaluation();
  hideExperience();
  expandLevelSelection();
  updateSelectedLevelDetail();
  updateSessionControls();
  if (chatInputEl) {
    chatInputEl.value = "";
  }
}

function resetEvaluation() {
  evaluationScoreEl.textContent = "--";
  evaluationScoreLabelEl.textContent = "";
  evaluationCommentaryEl.textContent = "等待新的对话内容...";
  evaluationActionsEl.innerHTML = "";
  evaluationKnowledgeEl.innerHTML = "";
}

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

function getLevelVictoryKey(chapterId, sectionId) {
  return `${chapterId || ""}::${sectionId || ""}`;
}

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

function findAssignmentForLevel(chapterId, sectionId) {
  if (!chapterId || !sectionId) {
    return null;
  }
  const assignments = Array.isArray(state.studentAssignments) ? state.studentAssignments : [];
  const byChapterSection = assignments.filter(
    (assignment) => assignment.chapterId === chapterId && assignment.sectionId === sectionId,
  );
  const prioritized =
    byChapterSection.find((assignment) => assignment.status !== "completed") || byChapterSection[0];
  if (prioritized) {
    return prioritized;
  }

  const bySection = assignments.filter(
    (assignment) => assignment.sectionId && assignment.sectionId === sectionId,
  );
  const sectionMatch =
    bySection.find((assignment) => assignment.status !== "completed") || bySection[0];
  if (sectionMatch) {
    return sectionMatch;
  }

  const byChapter = assignments.filter(
    (assignment) => assignment.chapterId && assignment.chapterId === chapterId,
  );
  return (
    byChapter.find((assignment) => assignment.status !== "completed") || byChapter[0] || null
  );
}

function updateAssignmentShortcut() {
  if (!startAssignmentBtn) {
    return;
  }
  const { chapterId, sectionId } = state.selectedLevel || {};
  const assignment = chapterId && sectionId ? findAssignmentForLevel(chapterId, sectionId) : null;
  if (!assignment) {
    startAssignmentBtn.dataset.assignmentId = "";
    startAssignmentBtn.disabled = true;
    startAssignmentBtn.removeAttribute("title");
    startAssignmentBtn.removeAttribute("aria-label");
    return;
  }
  startAssignmentBtn.dataset.assignmentId = assignment.id || "";
  startAssignmentBtn.disabled = false;
  const status = assignment.status || "pending";
  const actionLabel =
    status === "completed"
      ? "查看案例成绩"
      : assignment.sessionId
      ? "继续案例挑战"
      : "开始案例挑战";
  startAssignmentBtn.setAttribute("title", actionLabel);
  startAssignmentBtn.setAttribute("aria-label", actionLabel);
}

function maybeRecordVictory(evaluation) {
  if (!evaluation || !hasVictoryScore(evaluation)) {
    return;
  }
  const { chapterId, sectionId } = state.activeLevel || {};
  if (chapterId && sectionId) {
    markLevelVictory(chapterId, sectionId);
  }
}

function setActiveExperienceModule(moduleId) {
  if (!moduleId) {
    return;
  }
  const modules = Array.from(experienceModules || []);
  if (modules.length === 0) {
    return;
  }
  const exists = modules.some((module) => module.dataset.experienceModule === moduleId);
  if (!exists) {
    return;
  }
  activeExperienceModule = moduleId;
  updateExperienceLayout();
}

function updateExperienceLayout() {
  const modules = Array.from(experienceModules || []);
  if (modules.length === 0) {
    return;
  }
  const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
  modules.forEach((module) => {
    if (!module.dataset.experienceModule) {
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

function renderScenario(scenario) {
  state.scenario = scenario;
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

  chatCompanyEl.textContent = aiCompany.name || "AI 虚拟公司";
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
  chatToneEl.textContent = difficultyLabel
    ? `${difficultyLabel}${toneText ? ` · ${toneText}` : ""}`
    : toneText;
  renderKnowledge(evaluationKnowledgeEl, scenario.knowledgePoints || []);
}

function renderChat() {
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

function appendMessage(role, content, options = {}) {
  const message = { role, content };
  state.messages.push(message);
  if (!options.silent) {
    renderChat();
  }
  return state.messages.length - 1;
}

function updateMessageContent(index, content) {
  if (index < 0 || index >= state.messages.length) {
    return;
  }
  state.messages[index].content = content;
  renderChat();
}

function renderEvaluation(evaluation) {
  if (!evaluation) {
    resetEvaluation();
    return;
  }

  evaluationScoreEl.textContent =
    evaluation.score !== null && evaluation.score !== undefined && evaluation.score !== ""
      ? evaluation.score
      : evaluation.bargainingWinRate !== null && evaluation.bargainingWinRate !== undefined
      ? `${evaluation.bargainingWinRate}%`
      : "--";
  evaluationScoreLabelEl.textContent = evaluation.scoreLabel || "";
  evaluationCommentaryEl.textContent = evaluation.commentary || "等待新的对话内容...";

  evaluationActionsEl.innerHTML = "";
  const actionItems = Array.isArray(evaluation.actionItems)
    ? evaluation.actionItems
    : evaluation.actionItems
    ? [evaluation.actionItems]
    : [];
  actionItems.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    evaluationActionsEl.appendChild(li);
  });

  renderKnowledge(evaluationKnowledgeEl, evaluation.knowledgePoints || []);
  maybeRecordVictory(evaluation);
}

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

function renderAdminStudentList() {
  adminStudentList.innerHTML = "";
  if (!state.admin.students || state.admin.students.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400";
    empty.textContent = "暂无学生数据";
    adminStudentList.appendChild(empty);
    return;
  }

  state.admin.students.forEach((student) => {
    const li = document.createElement("li");
    const isActive = state.admin.selectedStudentId === student.id;
    li.className = `rounded-2xl border p-4 text-sm transition ${
      isActive
        ? "border-emerald-500/60 bg-emerald-500/10"
        : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
    }`;

    const header = document.createElement("div");
    header.className = "flex items-center justify-between";
    const name = document.createElement("span");
    name.className = "font-semibold text-white";
    name.textContent = `学生 ${student.displayName || student.username}`;
    const openBtn = document.createElement("button");
    openBtn.className = "rounded-xl border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-500 hover:text-white";
    openBtn.textContent = "查看";
    openBtn.dataset.studentId = student.id;
    header.appendChild(name);
    header.appendChild(openBtn);

    const stats = document.createElement("p");
    stats.className = "mt-2 text-xs text-slate-400";
    stats.textContent = `会话：${student.sessionCount} · 评估：${student.evaluationCount} · 最近活跃：${student.lastActive || "-"}`;

    li.appendChild(header);
    li.appendChild(stats);
    adminStudentList.appendChild(li);
  });
}

function renderAdminStudentDetail(detail) {
  if (!detail) {
    adminStudentMeta.innerHTML = '<p class="text-slate-400">请选择学生查看详情</p>';
    adminSessionList.innerHTML = "";
    adminSessionScenario.innerHTML = "";
    adminSessionConversation.innerHTML = "";
    adminSessionEvaluation.innerHTML = "";
    state.admin.studentDetail = null;
    return;
  }
  state.admin.studentDetail = detail;

  adminStudentMeta.innerHTML = `
    <p class="text-sm text-slate-200">学生 ${detail.displayName || detail.username}</p>
    <p class="text-xs text-slate-400">注册时间：${detail.createdAt || "-"}</p>
  `;

  adminSessionList.innerHTML = "";
  if (!detail.sessions || detail.sessions.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400";
    empty.textContent = "暂无会话记录";
    adminSessionList.appendChild(empty);
  } else {
    detail.sessions.forEach((session) => {
      const li = document.createElement("li");
      const isActive = state.admin.selectedSessionId === session.id;
      li.className = `rounded-xl border p-3 text-xs transition ${
        isActive
          ? "border-blue-500/60 bg-blue-500/10"
          : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
      }`;
      li.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-semibold text-slate-100">${session.title || `章节 ${session.chapterId}`}</span>
          <button class="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-slate-200 transition hover:border-emerald-500 hover:text-white" data-session-id="${session.id}">
            查看详情
          </button>
        </div>
        <p class="mt-1 text-slate-400">${session.summary || "暂无摘要"}</p>
        <p class="mt-1 text-slate-500">最近更新：${session.updatedAt || "-"}</p>
        ${session.difficultyLabel ? `<p class="mt-1 text-slate-500">难度：${session.difficultyLabel}</p>` : ""}
      `;
      if (session.latestEvaluation) {
        li.innerHTML += `
          <p class="mt-1 text-emerald-300">最新评估：${
            session.latestEvaluation.scoreLabel || session.latestEvaluation.score ||
            (session.latestEvaluation.bargainingWinRate !== null && session.latestEvaluation.bargainingWinRate !== undefined
              ? `${session.latestEvaluation.bargainingWinRate}%`
              : "未评分")
          }</p>`;
      }
      adminSessionList.appendChild(li);
    });
  }
  renderAdminSessionDetail(null);
}

function renderAdminSessionDetail(data) {
  if (!data) {
    adminSessionScenario.innerHTML = "";
    adminSessionConversation.innerHTML = "";
    adminSessionEvaluation.innerHTML = "";
    return;
  }

  const scenario = data.session.scenario || {};
  adminSessionScenario.innerHTML = `
    <p>标题：${scenario.title || "-"}</p>
    <p>学生角色：${scenario.studentRole || "-"}</p>
    <p>AI 角色：${scenario.aiRole || "-"}</p>
    <p>难度设定：${data.session.difficultyLabel || scenario.difficultyLabel || "默认 · 平衡博弈"}</p>
  `;

  adminSessionConversation.innerHTML = "";
  (data.messages || []).forEach((message) => {
    const row = document.createElement("div");
    row.className = "rounded-xl border border-slate-800 bg-slate-900/60 p-2";
    const speaker = message.role === "assistant" ? "AI" : message.role === "user" ? "学生" : message.role;
    row.innerHTML = `<p class="text-[11px] text-slate-400">${speaker}</p><p class="mt-1 whitespace-pre-wrap text-[13px] text-slate-100">${message.content}</p>`;
    adminSessionConversation.appendChild(row);
  });

  adminSessionEvaluation.innerHTML = "";
  const evaluation = data.evaluation;
  if (!evaluation) {
    adminSessionEvaluation.innerHTML = '<p class="text-slate-400">暂无评估记录</p>';
  } else {
    const lines = [];
    if (evaluation.score !== null && evaluation.score !== undefined) {
      lines.push(`评分：${evaluation.score} ${evaluation.scoreLabel || ""}`);
    } else if (evaluation.bargainingWinRate !== null && evaluation.bargainingWinRate !== undefined) {
      lines.push(`胜率：${evaluation.bargainingWinRate}%`);
    }
    if (evaluation.commentary) {
      lines.push(`点评：${evaluation.commentary}`);
    }
    const items = Array.isArray(evaluation.actionItems)
      ? evaluation.actionItems
      : evaluation.actionItems
      ? [evaluation.actionItems]
      : [];
    if (items.length > 0) {
      lines.push(`改进建议：${items.join("；")}`);
    }
    adminSessionEvaluation.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
  }
}

function splitLines(value) {
  return (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
}

function joinLines(list) {
  return Array.isArray(list) ? list.join("\n") : "";
}

function resetBlueprintForm(blueprint = null) {
  if (!adminBlueprintForm) return;
  adminBlueprintIdInput.value = blueprint?.id || "";
  adminBlueprintTitle.value = blueprint?.blueprint?.scenario_title || blueprint?.title || "";
  adminBlueprintSummary.value = blueprint?.blueprint?.scenario_summary || blueprint?.description || "";
  adminBlueprintStudentRole.value = blueprint?.blueprint?.student_role || "";
  adminBlueprintAiRole.value = blueprint?.blueprint?.ai_role || "";
  const studentCompany = (blueprint?.blueprint?.student_company) || {};
  adminBlueprintStudentCompanyName.value = studentCompany.name || "";
  adminBlueprintStudentCompanyProfile.value = studentCompany.profile || "";
  const aiCompany = (blueprint?.blueprint?.ai_company) || {};
  adminBlueprintAiCompanyName.value = aiCompany.name || "";
  adminBlueprintAiCompanyProfile.value = aiCompany.profile || "";
  adminBlueprintAiRules.value = joinLines(blueprint?.blueprint?.ai_rules || []);
  const product = blueprint?.blueprint?.product || {};
  const price = product.price_expectation || {};
  adminBlueprintProductName.value = product.name || "";
  adminBlueprintProductSpecs.value = product.specifications || "";
  adminBlueprintProductQuantity.value = product.quantity_requirement || "";
  adminBlueprintStudentPrice.value = price.student_target || "";
  adminBlueprintAiBottom.value = price.ai_bottom_line || "";
  adminBlueprintMarket.value = blueprint?.blueprint?.market_landscape || "";
  adminBlueprintTimeline.value = blueprint?.blueprint?.timeline || "";
  adminBlueprintLogistics.value = blueprint?.blueprint?.logistics || "";
  adminBlueprintNegotiationTargets.value = joinLines(blueprint?.blueprint?.negotiation_targets || []);
  adminBlueprintRisks.value = joinLines(blueprint?.blueprint?.risks || []);
  adminBlueprintChecklist.value = joinLines(blueprint?.blueprint?.checklist || []);
  adminBlueprintKnowledge.value = joinLines(blueprint?.blueprint?.knowledge_points || []);
  adminBlueprintOpening.value = blueprint?.blueprint?.opening_message || "";
  adminBlueprintDifficulty.value = blueprint?.difficulty || "balanced";
  updateInlineStatus(adminBlueprintGeneratorStatus, "");
}

function selectAdminBlueprint(blueprintId) {
  const blueprint = findAdminBlueprint(blueprintId);
  if (!blueprint) {
    return;
  }
  state.admin.selectedBlueprintId = blueprint.id;
  resetBlueprintForm(blueprint);
  renderBlueprintList();
  if (adminBlueprintStatus) {
    adminBlueprintStatus.textContent = "已载入蓝图，可编辑后保存";
  }
}

function buildBlueprintPayloadFromForm() {
  return {
    scenarioTitle: adminBlueprintTitle.value.trim(),
    scenarioSummary: adminBlueprintSummary.value.trim(),
    studentRole: adminBlueprintStudentRole.value.trim(),
    studentCompany: {
      name: adminBlueprintStudentCompanyName.value.trim(),
      profile: adminBlueprintStudentCompanyProfile.value.trim(),
    },
    aiRole: adminBlueprintAiRole.value.trim(),
    aiCompany: {
      name: adminBlueprintAiCompanyName.value.trim(),
      profile: adminBlueprintAiCompanyProfile.value.trim(),
    },
    aiRules: splitLines(adminBlueprintAiRules.value),
    product: {
      name: adminBlueprintProductName.value.trim(),
      specifications: adminBlueprintProductSpecs.value.trim(),
      quantityRequirement: adminBlueprintProductQuantity.value.trim(),
      priceExpectation: {
        studentTarget: adminBlueprintStudentPrice.value.trim(),
        aiBottomLine: adminBlueprintAiBottom.value.trim(),
      },
    },
    marketLandscape: adminBlueprintMarket.value.trim(),
    timeline: adminBlueprintTimeline.value.trim(),
    logistics: adminBlueprintLogistics.value.trim(),
    negotiationTargets: splitLines(adminBlueprintNegotiationTargets.value),
    risks: splitLines(adminBlueprintRisks.value),
    checklist: splitLines(adminBlueprintChecklist.value),
    knowledgePoints: splitLines(adminBlueprintKnowledge.value),
    openingMessage: adminBlueprintOpening.value.trim(),
    difficulty: adminBlueprintDifficulty.value,
  };
}

function renderBlueprintList() {
  if (!adminBlueprintList) return;
  adminBlueprintList.innerHTML = "";
  const list = state.admin.blueprints || [];
  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400";
    empty.textContent = "暂无蓝图，请填写表单创建。";
    adminBlueprintList.appendChild(empty);
    return;
  }

  list.forEach((item) => {
    const li = document.createElement("li");
    const isActive = state.admin.selectedBlueprintId === item.id;
    li.className = `rounded-2xl border p-4 text-sm transition ${
      isActive
        ? "border-purple-400/60 bg-purple-500/10"
        : "border-slate-800 bg-slate-900/70 hover:border-purple-400/40"
    }`;
    li.dataset.blueprintId = item.id;
    li.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold text-white">${item.title || item.scenarioPreview?.title || "蓝图"}</p>
          <p class="text-xs text-slate-400">${item.scenarioPreview?.summary || ""}</p>
          <p class="text-xs text-slate-500">难度：${item.difficultyLabel || "平衡博弈"}</p>
        </div>
        <div class="flex gap-2">
          <button class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-purple-400 hover:text-white" data-action="edit" data-blueprint-id="${item.id}">编辑</button>
          <button class="rounded-lg border border-rose-500/70 px-3 py-1 text-xs text-rose-200 transition hover:border-rose-300 hover:text-rose-50" data-action="delete" data-blueprint-id="${item.id}">删除</button>
        </div>
      </div>
    `;
    adminBlueprintList.appendChild(li);
  });
}

function populateAssignmentChapterOptions() {
  if (!adminAssignmentChapter) return;
  const selected = adminAssignmentChapter.value;
  adminAssignmentChapter.innerHTML = '<option value="">不关联</option>';
  (state.chapters || []).forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.title || chapter.id;
    if (chapter.id === selected) {
      option.selected = true;
    }
    adminAssignmentChapter.appendChild(option);
  });
  updateAssignmentSectionOptions();
}

function updateAssignmentSectionOptions() {
  if (!adminAssignmentSection) return;
  const chapterId = adminAssignmentChapter ? adminAssignmentChapter.value : "";
  const previous = adminAssignmentSection.value;
  adminAssignmentSection.innerHTML = '<option value="">不关联</option>';
  if (!chapterId) {
    return;
  }
  const chapter = findChapter(chapterId);
  if (!chapter) return;
  (chapter.sections || []).forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.title || section.id;
    if (section.id === previous) {
      option.selected = true;
    }
    adminAssignmentSection.appendChild(option);
  });
}

function populateAssignmentBlueprintOptions() {
  if (!adminAssignmentBlueprint) return;
  const selected = adminAssignmentBlueprint.value;
  adminAssignmentBlueprint.innerHTML = '<option value="">手动填写</option>';
  (state.admin.blueprints || []).forEach((blueprint) => {
    const option = document.createElement("option");
    option.value = blueprint.id;
    option.textContent = blueprint.title || blueprint.scenarioPreview?.title || blueprint.id;
    if (blueprint.id === selected) {
      option.selected = true;
    }
    adminAssignmentBlueprint.appendChild(option);
  });
}

function populateBlueprintChapterOptions() {
  if (!adminBlueprintChapter) return;
  const selected = adminBlueprintChapter.value;
  adminBlueprintChapter.innerHTML = '<option value="">选择章节</option>';
  (state.chapters || []).forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.title || chapter.id;
    if (chapter.id === selected) {
      option.selected = true;
    }
    adminBlueprintChapter.appendChild(option);
  });
  updateBlueprintSectionOptions();
}

function updateBlueprintSectionOptions() {
  if (!adminBlueprintSection) return;
  const chapterId = adminBlueprintChapter ? adminBlueprintChapter.value : "";
  const previous = adminBlueprintSection.value;
  adminBlueprintSection.innerHTML = '<option value="">选择小节</option>';
  if (!chapterId) {
    return;
  }
  const chapter = findChapter(chapterId);
  if (!chapter) return;
  (chapter.sections || []).forEach((section) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = section.title || section.id;
    if (section.id === previous) {
      option.selected = true;
    }
    adminBlueprintSection.appendChild(option);
  });
}

async function requestGeneratedScenario({ chapterId, sectionId, difficulty }) {
  if (!chapterId || !sectionId) {
    throw new Error("请先选择章节和小节");
  }
  const payload = {
    chapterId,
    sectionId,
    difficulty: (difficulty || "balanced").toLowerCase(),
  };
  const response = await fetchWithAuth("/api/generator/scenario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || "生成失败，请稍后重试";
    throw new Error(message);
  }
  return data;
}

function applyScenarioToAssignmentFields(scenario, difficultyKey) {
  if (!scenario) return;
  if (adminAssignmentTitle && !adminAssignmentTitle.value) {
    adminAssignmentTitle.value = scenario.scenario_title || "";
  }
  if (adminAssignmentDescription && !adminAssignmentDescription.value) {
    adminAssignmentDescription.value = scenario.scenario_summary || "";
  }
  if (adminAssignmentDifficulty && difficultyKey) {
    adminAssignmentDifficulty.value = difficultyKey;
  }
}

function applyScenarioToBlueprintFormFields(scenario, difficultyKey) {
  if (!scenario) return;
  adminBlueprintTitle.value = scenario.scenario_title || "";
  adminBlueprintSummary.value = scenario.scenario_summary || "";
  adminBlueprintStudentRole.value = scenario.student_role || "";
  adminBlueprintAiRole.value = scenario.ai_role || "";
  const studentCompany = scenario.student_company || {};
  adminBlueprintStudentCompanyName.value = studentCompany.name || "";
  adminBlueprintStudentCompanyProfile.value = studentCompany.profile || "";
  const aiCompany = scenario.ai_company || {};
  adminBlueprintAiCompanyName.value = aiCompany.name || "";
  adminBlueprintAiCompanyProfile.value = aiCompany.profile || "";
  adminBlueprintAiRules.value = joinLines(scenario.ai_rules || []);
  const product = scenario.product || {};
  const price = product.price_expectation || {};
  adminBlueprintProductName.value = product.name || "";
  adminBlueprintProductSpecs.value = product.specifications || "";
  adminBlueprintProductQuantity.value =
    product.quantity_requirement || product.quantityRequirement || "";
  adminBlueprintStudentPrice.value =
    price.student_target || price.studentTarget || "";
  adminBlueprintAiBottom.value = price.ai_bottom_line || price.aiBottomLine || "";
  adminBlueprintMarket.value = scenario.market_landscape || "";
  adminBlueprintTimeline.value = scenario.timeline || "";
  adminBlueprintLogistics.value = scenario.logistics || "";
  adminBlueprintNegotiationTargets.value = joinLines(
    scenario.negotiation_targets || [],
  );
  adminBlueprintRisks.value = joinLines(scenario.risks || []);
  adminBlueprintChecklist.value = joinLines(scenario.checklist || []);
  adminBlueprintKnowledge.value = joinLines(scenario.knowledge_points || []);
  adminBlueprintOpening.value = scenario.opening_message || "";
  if (difficultyKey && adminBlueprintDifficulty) {
    adminBlueprintDifficulty.value = difficultyKey;
  } else if (scenario.difficulty && adminBlueprintDifficulty) {
    adminBlueprintDifficulty.value = scenario.difficulty;
  }
}

async function handleAssignmentScenarioGeneration() {
  if (!adminAssignmentGenerateBtn) return;
  const chapterId = adminAssignmentChapter ? adminAssignmentChapter.value : "";
  const sectionId = adminAssignmentSection ? adminAssignmentSection.value : "";
  const difficultyKey = adminAssignmentDifficulty
    ? adminAssignmentDifficulty.value || "balanced"
    : "balanced";
  if (!chapterId || !sectionId) {
    updateInlineStatus(
      adminAssignmentGeneratorStatus,
      "请先选择章节和小节后再生成",
      "error",
    );
    return;
  }
  try {
    adminAssignmentGenerateBtn.disabled = true;
    updateInlineStatus(adminAssignmentGeneratorStatus, "正在生成场景...", "muted");
    const data = await requestGeneratedScenario({
      chapterId,
      sectionId,
      difficulty: difficultyKey,
    });
    const scenario = data.scenario || {};
    const scenarioJson = JSON.stringify(scenario, null, 2);
    if (tokenEditors.assignmentScenario) {
      tokenEditors.assignmentScenario.setValue(scenarioJson);
    } else if (adminAssignmentScenario) {
      adminAssignmentScenario.value = scenarioJson;
    }
    applyScenarioToAssignmentFields(scenario, data.difficulty || difficultyKey);
    updateInlineStatus(adminAssignmentGeneratorStatus, "已生成场景，可继续微调。", "success");
    if (adminAssignmentStatus) {
      adminAssignmentStatus.textContent = "已根据章节模板生成场景";
    }
  } catch (error) {
    console.error(error);
    updateInlineStatus(
      adminAssignmentGeneratorStatus,
      error.message || "生成失败，请稍后再试。",
      "error",
    );
  } finally {
    adminAssignmentGenerateBtn.disabled = false;
  }
}

async function handleBlueprintScenarioGeneration() {
  if (!adminBlueprintGenerateBtn) return;
  const chapterId = adminBlueprintChapter ? adminBlueprintChapter.value : "";
  const sectionId = adminBlueprintSection ? adminBlueprintSection.value : "";
  const difficultyKey = adminBlueprintDifficulty
    ? adminBlueprintDifficulty.value || "balanced"
    : "balanced";
  if (!chapterId || !sectionId) {
    updateInlineStatus(
      adminBlueprintGeneratorStatus,
      "请先选择章节与小节",
      "error",
    );
    return;
  }
  try {
    adminBlueprintGenerateBtn.disabled = true;
    updateInlineStatus(adminBlueprintGeneratorStatus, "正在生成蓝图...", "muted");
    const data = await requestGeneratedScenario({
      chapterId,
      sectionId,
      difficulty: difficultyKey,
    });
    const scenario = data.scenario || {};
    applyScenarioToBlueprintFormFields(scenario, data.difficulty || difficultyKey);
    updateInlineStatus(adminBlueprintGeneratorStatus, "生成完成，已填充表单。", "success");
    if (adminBlueprintStatus) {
      adminBlueprintStatus.textContent = "已根据章节模板生成蓝图，可直接保存或调整";
    }
  } catch (error) {
    console.error(error);
    updateInlineStatus(
      adminBlueprintGeneratorStatus,
      error.message || "生成失败，请稍后再试。",
      "error",
    );
  } finally {
    adminBlueprintGenerateBtn.disabled = false;
  }
}

function renderAssignmentStudents(options = {}) {
  if (!adminAssignmentStudents) return;
  const existingChecked = Array.from(
    adminAssignmentStudents.querySelectorAll("input[type='checkbox']:checked") || [],
  ).map((input) => input.value);
  let selectedIds = Array.isArray(options.selectedIds) ? options.selectedIds : existingChecked;
  if ((!selectedIds || selectedIds.length === 0) && state.admin.selectedAssignmentId) {
    const currentAssignment = findAdminAssignment(state.admin.selectedAssignmentId);
    if (currentAssignment && Array.isArray(currentAssignment.studentIds)) {
      selectedIds = currentAssignment.studentIds.map((value) => String(value));
    }
  }
  const selectedSet = new Set((selectedIds || []).map((value) => String(value)));

  adminAssignmentStudents.innerHTML = "";
  const students = state.admin.students || [];
  if (students.length === 0) {
    adminAssignmentStudents.innerHTML = "<p>暂无学生名单，请先导入。</p>";
    return;
  }
  students.forEach((student) => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-800/60";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = student.id;
    checkbox.className = "rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400";
    checkbox.checked = selectedSet.has(String(student.id));
    label.appendChild(checkbox);
    const info = document.createElement("span");
    info.textContent = `${student.displayName || student.username}（${student.username}）`;
    label.appendChild(info);
    adminAssignmentStudents.appendChild(label);
  });
}

function renderAssignmentList() {
  if (!adminAssignmentList) return;
  adminAssignmentList.innerHTML = "";
  const assignments = state.admin.assignments || [];
  if (assignments.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400";
    empty.textContent = "尚未创建统一作业";
    adminAssignmentList.appendChild(empty);
    return;
  }
  assignments.forEach((assignment) => {
    const li = document.createElement("li");
    const isActive = state.admin.selectedAssignmentId === assignment.id;
    li.className = `rounded-2xl border p-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
      isActive
        ? "border-emerald-400/60 bg-emerald-500/10"
        : "border-slate-800 bg-slate-900/70 hover:border-emerald-400/40"
    }`;
    li.dataset.assignmentId = assignment.id;
    li.tabIndex = 0;
    li.innerHTML = `
      <div class="flex flex-col gap-1">
        <p class="font-semibold text-white">${assignment.title || assignment.scenario.title || "统一作业"}</p>
        <p class="text-xs text-slate-400">${assignment.description || assignment.scenario.summary || ""}</p>
        <p class="text-xs text-slate-500">难度：${assignment.difficultyLabel || "平衡博弈"}</p>
        <p class="text-xs text-slate-500">学生：${assignment.assignedCount || 0} 人 · 进行中 ${assignment.inProgressCount || 0} · 完成 ${assignment.completedCount || 0}</p>
      </div>
    `;
    adminAssignmentList.appendChild(li);
  });
}

function populateAssignmentForm(assignment) {
  updateInlineStatus(adminAssignmentGeneratorStatus, "");
  if (!assignment || !adminAssignmentForm) {
    if (adminAssignmentIdInput) adminAssignmentIdInput.value = "";
    if (adminAssignmentTitle) adminAssignmentTitle.value = "";
    if (adminAssignmentDescription) adminAssignmentDescription.value = "";
    if (adminAssignmentDifficulty) adminAssignmentDifficulty.value = "balanced";
    if (adminAssignmentChapter) adminAssignmentChapter.value = "";
    updateAssignmentSectionOptions();
    if (adminAssignmentSection) adminAssignmentSection.value = "";
    if (adminAssignmentBlueprint) adminAssignmentBlueprint.value = "";
    if (tokenEditors.assignmentScenario) {
      tokenEditors.assignmentScenario.setValue("", { silent: true });
    } else if (adminAssignmentScenario) {
      adminAssignmentScenario.value = "";
    }
    renderAssignmentStudents({ selectedIds: [] });
    return;
  }

  if (adminAssignmentIdInput) adminAssignmentIdInput.value = assignment.id || "";
  if (adminAssignmentTitle) adminAssignmentTitle.value = assignment.title || "";
  if (adminAssignmentDescription)
    adminAssignmentDescription.value = assignment.description || "";
  if (adminAssignmentDifficulty)
    adminAssignmentDifficulty.value = assignment.difficulty || "balanced";
  if (adminAssignmentChapter) {
    adminAssignmentChapter.value = assignment.chapterId || "";
  }
  updateAssignmentSectionOptions();
  if (adminAssignmentSection) {
    adminAssignmentSection.value = assignment.sectionId || "";
  }
  if (adminAssignmentBlueprint) {
    adminAssignmentBlueprint.value = assignment.blueprintId || "";
  }
  const scenarioValue = (() => {
    try {
      return JSON.stringify(assignment.scenario || {}, null, 2);
    } catch (error) {
      console.warn("无法序列化场景 JSON", error);
      return "";
    }
  })();
  if (tokenEditors.assignmentScenario) {
    tokenEditors.assignmentScenario.setValue(scenarioValue || "", { silent: true });
  } else if (adminAssignmentScenario) {
    adminAssignmentScenario.value = scenarioValue;
  }
  renderAssignmentStudents({ selectedIds: assignment.studentIds || [] });
}

function selectAdminAssignment(assignmentId) {
  const assignment = findAdminAssignment(assignmentId);
  if (!assignment) {
    return;
  }
  state.admin.selectedAssignmentId = assignment.id;
  populateAssignmentForm(assignment);
  renderAssignmentList();
  if (adminAssignmentStatus) {
    adminAssignmentStatus.textContent = "已载入作业，可调整后重新保存";
  }
}

function renderStudentAssignments() {
  if (!studentAssignmentListEl) return;
  studentAssignmentListEl.innerHTML = "";
  const assignments = Array.isArray(state.studentAssignments)
    ? state.studentAssignments
    : [];
  if (assignments.length === 0) {
    const empty = document.createElement("li");
    empty.className = "assignment-item assignment-empty";
    empty.textContent = "暂无待完成的作业";
    studentAssignmentListEl.appendChild(empty);
    return;
  }

  assignments.forEach((assignment) => {
    const li = document.createElement("li");
    li.className = "assignment-item";

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-2";

    const header = document.createElement("div");
    header.className = "flex flex-wrap items-center justify-between gap-2";

    const title = document.createElement("h3");
    const assignmentTitle =
      assignment.title ||
      (assignment.scenario && (assignment.scenario.title || assignment.scenario.name)) ||
      "统一作业";
    title.textContent = assignmentTitle;
    header.appendChild(title);

    const statusValue = assignment.status || "pending";
    const statusLabel =
      statusValue === "completed"
        ? "状态：已完成"
        : statusValue === "in_progress"
        ? "状态：进行中"
        : "状态：待开始";
    const statusMeta = document.createElement("span");
    statusMeta.className = "assignment-meta";
    statusMeta.textContent = statusLabel;
    header.appendChild(statusMeta);

    wrapper.appendChild(header);

    const description = assignment.description ||
      (assignment.scenario && assignment.scenario.summary) ||
      "";
    if (description) {
      const descEl = document.createElement("p");
      descEl.textContent = description;
      wrapper.appendChild(descEl);
    }

    const footer = document.createElement("div");
    footer.className = "flex flex-wrap items-center justify-between gap-2";

    const metaParts = [];
    if (assignment.chapterTitle || assignment.sectionTitle) {
      metaParts.push(
        [assignment.chapterTitle, assignment.sectionTitle]
          .filter(Boolean)
          .join(" ｜ ")
      );
    } else if (assignment.chapterId || assignment.sectionId) {
      metaParts.push(
        [assignment.chapterId && `章节 ${assignment.chapterId}`, assignment.sectionId && `小节 ${assignment.sectionId}`]
          .filter(Boolean)
          .join(" ｜ ")
      );
    }
    if (assignment.difficultyLabel) {
      metaParts.push(`难度：${assignment.difficultyLabel}`);
    }
    if (assignment.updatedAt) {
      metaParts.push(`更新：${assignment.updatedAt}`);
    }

    const metaEl = document.createElement("p");
    metaEl.className = "assignment-meta";
    metaEl.textContent = metaParts.filter(Boolean).join(" ｜ ") || "教师统一指派";
    footer.appendChild(metaEl);

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.dataset.assignmentId = assignment.id || "";
    const actionLabel =
      statusValue === "completed"
        ? "查看成绩"
        : assignment.sessionId
        ? "继续作业"
        : "开始作业";
    actionBtn.textContent = actionLabel;
    footer.appendChild(actionBtn);

    wrapper.appendChild(footer);
    li.appendChild(wrapper);
    studentAssignmentListEl.appendChild(li);
  });
}

function renderAnalyticsList(container, items, formatItem, emptyText) {
  if (!container) return;
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-xl border border-white/20 bg-white/5 p-3 text-xs opacity-80";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-white/20 bg-white/10 p-3 text-xs";
    li.textContent = formatItem(item);
    container.appendChild(li);
  });
}

function renderAdminAnalytics(analytics) {
  state.admin.analytics = analytics || null;
  renderAnalyticsList(
    adminTrendList,
    analytics ? analytics.weeklyTrends : [],
    (trend) => {
      const label = trend.sectionTitle || `${trend.chapterId} · ${trend.sectionId}`;
      const week = trend.weekLabel || trend.week;
      const avg = trend.averageScore !== null && trend.averageScore !== undefined
        ? `平均 ${Math.round(trend.averageScore)}分`
        : "暂无评分";
      const samples = trend.sampleSize ? ` · 样本 ${trend.sampleSize}` : "";
      return `${label}｜${week}｜${avg}${samples}`;
    },
    "暂无趋势数据"
  );

  renderAnalyticsList(
    adminActionHotspots,
    analytics ? analytics.actionHotspots : [],
    (item) => `${item.label || item.actionItem}｜${item.count} 次`,
    "暂无改进建议统计"
  );

  renderAnalyticsList(
    adminKnowledgeWeakness,
    analytics ? analytics.knowledgeWeakness : [],
    (item) => {
      const avg = item.averageScore !== null && item.averageScore !== undefined
        ? ` · 平均 ${Math.round(item.averageScore)}分`
        : "";
      return `${item.label || item.knowledgePoint}｜${item.count} 次${avg}`;
    },
    "暂无知识点统计"
  );
}

function findAdminChapter(chapterId) {
  const chapters = state.admin.levels || [];
  for (let index = 0; index < chapters.length; index += 1) {
    const chapter = chapters[index];
    if (chapter.id === chapterId) {
      return chapter;
    }
  }
  return null;
}

function findAdminAssignment(assignmentId) {
  const assignments = state.admin.assignments || [];
  for (let index = 0; index < assignments.length; index += 1) {
    const assignment = assignments[index];
    if (assignment.id === assignmentId) {
      return assignment;
    }
  }
  return null;
}

function findAdminBlueprint(blueprintId) {
  const blueprints = state.admin.blueprints || [];
  for (let index = 0; index < blueprints.length; index += 1) {
    const blueprint = blueprints[index];
    if (blueprint.id === blueprintId) {
      return blueprint;
    }
  }
  return null;
}

function findAdminSection(chapterId, sectionId) {
  const chapter = findAdminChapter(chapterId);
  if (!chapter) {
    return null;
  }
  const sections = chapter.sections || [];
  for (let index = 0; index < sections.length; index += 1) {
    const section = sections[index];
    if (section.id === sectionId) {
      return section;
    }
  }
  return null;
}

function renderAdminLevelList() {
  if (!levelChapterList) {
    return;
  }
  levelChapterList.innerHTML = "";
  const chapters = state.admin.levels || [];
  if (chapters.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400";
    empty.textContent = "暂无关卡，请创建章节与小节。";
    levelChapterList.appendChild(empty);
    return;
  }

  chapters.forEach((chapter) => {
    const wrapper = document.createElement("div");
    wrapper.className = "rounded-2xl border border-slate-800 bg-slate-900/60";
    if (chapter.id === state.admin.selectedEditorChapterId) {
      wrapper.classList.add("ring-2", "ring-purple-400/60");
    }

    const headerBtn = document.createElement("button");
    headerBtn.type = "button";
    headerBtn.dataset.chapterId = chapter.id;
    headerBtn.className = "flex w-full items-center justify-between px-4 py-3 text-left";
    headerBtn.innerHTML =
      '<span class="font-semibold text-slate-100">' +
      (chapter.title || "章节") +
      '</span><span class="text-xs text-slate-500">' +
      (chapter.description || "") +
      "</span>";
    wrapper.appendChild(headerBtn);

    const sectionContainer = document.createElement("div");
    sectionContainer.className = "space-y-2 border-t border-slate-800 px-4 py-3";
    (chapter.sections || []).forEach((section) => {
      const sectionBtn = document.createElement("button");
      sectionBtn.type = "button";
      sectionBtn.dataset.chapterId = chapter.id;
      sectionBtn.dataset.sectionId = section.id;
      sectionBtn.className = "flex w-full flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left transition hover:border-emerald-400/60";
      if (section.id === state.admin.selectedEditorSectionId) {
        sectionBtn.classList.add("border-emerald-400/60", "bg-emerald-500/10");
      }
      sectionBtn.innerHTML =
        '<span class="text-sm font-semibold text-slate-100">' +
        (section.title || "小节") +
        '</span><span class="text-xs text-slate-500">' +
        (section.description || "") +
        "</span>";
      sectionContainer.appendChild(sectionBtn);
    });

    if ((chapter.sections || []).length === 0) {
      const placeholder = document.createElement("p");
      placeholder.className = "rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-3 text-xs text-slate-500";
      placeholder.textContent = "暂无小节";
      sectionContainer.appendChild(placeholder);
    }

    wrapper.appendChild(sectionContainer);
    levelChapterList.appendChild(wrapper);
  });
}

function updateChapterForm() {
  if (!chapterEditorForm || !levelChapterStatus) {
    return;
  }
  const chapter = state.admin.selectedEditorChapterId
    ? findAdminChapter(state.admin.selectedEditorChapterId)
    : null;

  if (!chapter) {
    chapterEditorForm.classList.add("hidden");
    levelChapterStatus.textContent = "请选择章节进行编辑。";
    if (levelCreateSectionBtn) levelCreateSectionBtn.disabled = true;
    if (levelDeleteChapterBtn) levelDeleteChapterBtn.disabled = true;
    if (levelSaveChapterBtn) levelSaveChapterBtn.disabled = true;
    if (chapterEditorTitle) chapterEditorTitle.value = "";
    if (chapterEditorDescription) chapterEditorDescription.value = "";
    if (chapterEditorOrder) chapterEditorOrder.value = "";
    return;
  }

  chapterEditorForm.classList.remove("hidden");
  levelChapterStatus.textContent = "编辑 " + (chapter.title || "章节");
  if (chapterEditorTitle) chapterEditorTitle.value = chapter.title || "";
  if (chapterEditorDescription) chapterEditorDescription.value = chapter.description || "";
  if (chapterEditorOrder) {
    chapterEditorOrder.value =
      chapter.orderIndex !== null && chapter.orderIndex !== undefined ? chapter.orderIndex : "";
  }
  if (levelCreateSectionBtn) levelCreateSectionBtn.disabled = false;
  if (levelDeleteChapterBtn) levelDeleteChapterBtn.disabled = false;
  if (levelSaveChapterBtn) levelSaveChapterBtn.disabled = false;
}

function updateSectionForm() {
  if (!sectionEditorForm || !levelSectionStatus) {
    return;
  }
  const chapterId = state.admin.selectedEditorChapterId;
  const sectionId = state.admin.selectedEditorSectionId;
  const section = chapterId && sectionId ? findAdminSection(chapterId, sectionId) : null;

  if (!section) {
    sectionEditorForm.classList.add("hidden");
    levelSectionStatus.textContent = "请选择小节查看或编辑详细提示词。";
    if (levelSaveSectionBtn) levelSaveSectionBtn.disabled = true;
    if (levelDeleteSectionBtn) levelDeleteSectionBtn.disabled = true;
    if (sectionEditorTitle) sectionEditorTitle.value = "";
    if (sectionEditorDescription) sectionEditorDescription.value = "";
    if (tokenEditors.environment) {
      tokenEditors.environment.setValue("", { silent: true });
    } else if (sectionEditorEnvironment) {
      sectionEditorEnvironment.value = "";
    }
    if (sectionEditorEnvironmentUser) sectionEditorEnvironmentUser.value = "";
    if (tokenEditors.conversation) {
      tokenEditors.conversation.setValue("", { silent: true });
    } else if (sectionEditorConversation) {
      sectionEditorConversation.value = "";
    }
    if (tokenEditors.evaluation) {
      tokenEditors.evaluation.setValue("", { silent: true });
    } else if (sectionEditorEvaluation) {
      sectionEditorEvaluation.value = "";
    }
    if (sectionEditorBargaining) sectionEditorBargaining.checked = false;
    if (sectionEditorOrder) sectionEditorOrder.value = "";
    return;
  }

  sectionEditorForm.classList.remove("hidden");
  levelSectionStatus.textContent = "编辑 " + (section.title || "小节");
  if (sectionEditorTitle) sectionEditorTitle.value = section.title || "";
  if (sectionEditorDescription) sectionEditorDescription.value = section.description || "";
  if (tokenEditors.environment) {
    tokenEditors.environment.setValue(section.environmentPromptTemplate || "");
  } else if (sectionEditorEnvironment) {
    sectionEditorEnvironment.value = section.environmentPromptTemplate || "";
  }
  if (sectionEditorEnvironmentUser)
    sectionEditorEnvironmentUser.value = section.environmentUserMessage || "";
  if (tokenEditors.conversation) {
    tokenEditors.conversation.setValue(section.conversationPromptTemplate || "");
  } else if (sectionEditorConversation) {
    sectionEditorConversation.value = section.conversationPromptTemplate || "";
  }
  if (tokenEditors.evaluation) {
    tokenEditors.evaluation.setValue(section.evaluationPromptTemplate || "");
  } else if (sectionEditorEvaluation) {
    sectionEditorEvaluation.value = section.evaluationPromptTemplate || "";
  }
  if (sectionEditorBargaining) sectionEditorBargaining.checked = !!section.expectsBargaining;
  if (sectionEditorOrder) {
    sectionEditorOrder.value =
      section.orderIndex !== null && section.orderIndex !== undefined ? section.orderIndex : "";
  }
  if (levelSaveSectionBtn) levelSaveSectionBtn.disabled = false;
  if (levelDeleteSectionBtn) levelDeleteSectionBtn.disabled = false;
}

function selectEditorChapter(chapterId) {
  state.admin.selectedEditorChapterId = chapterId;
  const chapter = findAdminChapter(chapterId);
  if (chapter) {
    const hasCurrentSection = (chapter.sections || []).some(
      (section) => section.id === state.admin.selectedEditorSectionId,
    );
    if (!hasCurrentSection) {
      const firstSection = (chapter.sections || [])[0];
      state.admin.selectedEditorSectionId = firstSection ? firstSection.id : null;
    }
  } else {
    state.admin.selectedEditorSectionId = null;
  }
  renderAdminLevelList();
  updateChapterForm();
  updateSectionForm();
}

function selectEditorSection(sectionId) {
  state.admin.selectedEditorSectionId = sectionId;
  renderAdminLevelList();
  updateSectionForm();
}

async function loadAdminLevels(options = {}) {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/admin/levels");
    if (!response.ok) {
      throw new Error("无法加载关卡数据");
    }
    const data = await response.json();
    state.admin.levels = data.chapters || [];

    if (options.chapterId) {
      state.admin.selectedEditorChapterId = options.chapterId;
    } else if (state.admin.selectedEditorChapterId) {
      const exists = findAdminChapter(state.admin.selectedEditorChapterId);
      if (!exists) {
        state.admin.selectedEditorChapterId = state.admin.levels[0]
          ? state.admin.levels[0].id
          : null;
      }
    } else if (state.admin.levels[0]) {
      state.admin.selectedEditorChapterId = state.admin.levels[0].id;
    }

    if (options.sectionId) {
      state.admin.selectedEditorSectionId = options.sectionId;
    } else if (state.admin.selectedEditorChapterId) {
      const chapter = findAdminChapter(state.admin.selectedEditorChapterId);
      const hasSection = chapter
        && (chapter.sections || []).some((section) => section.id === state.admin.selectedEditorSectionId);
      if (!hasSection) {
        const firstSection = chapter && (chapter.sections || [])[0];
        state.admin.selectedEditorSectionId = firstSection ? firstSection.id : null;
      }
    } else {
      state.admin.selectedEditorSectionId = null;
    }

    renderAdminLevelList();
    updateChapterForm();
    updateSectionForm();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载关卡数据失败");
  }
}

async function createAdminChapter() {
  try {
    const response = await fetchWithAuth("/api/admin/chapters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "新建章节", description: "" }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "创建章节失败");
    }
    const data = await response.json();
    const chapterId = data.chapter && data.chapter.id;
    await loadAdminLevels({ chapterId });
    if (chapterId) {
      selectEditorChapter(chapterId);
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "创建章节失败");
  }
}

async function createAdminSection() {
  const chapterId = state.admin.selectedEditorChapterId;
  if (!chapterId) {
    alert("请先选择章节");
    return;
  }
  try {
    const response = await fetchWithAuth("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chapterId,
        title: "新建小节",
        description: "请补充小节描述。",
        environmentPromptTemplate: "请在此编写环境提示模板。",
        environmentUserMessage: "请在此编写用于生成场景的用户消息。",
        conversationPromptTemplate: "请在此编写对话提示模板。",
        evaluationPromptTemplate: "请在此编写评价提示模板。",
        expectsBargaining: false,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "创建小节失败");
    }
    const data = await response.json();
    const sectionId = data.section && data.section.id;
    await loadAdminLevels({ chapterId, sectionId });
    if (sectionId) {
      selectEditorSection(sectionId);
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "创建小节失败");
  }
}

async function saveAdminChapter() {
  const chapterId = state.admin.selectedEditorChapterId;
  if (!chapterId) {
    alert("请先选择章节");
    return;
  }
  const payload = {};
  if (chapterEditorTitle) payload.title = chapterEditorTitle.value.trim();
  if (chapterEditorDescription) payload.description = chapterEditorDescription.value.trim();
  if (chapterEditorOrder && chapterEditorOrder.value.trim() !== "") {
    payload.orderIndex = Number(chapterEditorOrder.value);
  }
  try {
    const response = await fetchWithAuth(`/api/admin/chapters/${chapterId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "保存章节失败");
    }
    await loadAdminLevels({ chapterId });
  } catch (error) {
    console.error(error);
    alert(error.message || "保存章节失败");
  }
}

async function deleteAdminChapter() {
  const chapterId = state.admin.selectedEditorChapterId;
  if (!chapterId) {
    alert("请选择章节");
    return;
  }
  if (!confirm("确认删除该章节及其所有小节？")) {
    return;
  }
  try {
    const response = await fetchWithAuth(`/api/admin/chapters/${chapterId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除章节失败");
    }
    state.admin.selectedEditorChapterId = null;
    state.admin.selectedEditorSectionId = null;
    await loadAdminLevels();
  } catch (error) {
    console.error(error);
    alert(error.message || "删除章节失败");
  }
}

async function saveAdminSection() {
  const chapterId = state.admin.selectedEditorChapterId;
  const sectionId = state.admin.selectedEditorSectionId;
  if (!chapterId || !sectionId) {
    alert("请先选择小节");
    return;
  }
  const payload = {};
  if (sectionEditorTitle) payload.title = sectionEditorTitle.value.trim();
  if (sectionEditorDescription) payload.description = sectionEditorDescription.value.trim();
  if (tokenEditors.environment) {
    payload.environment_prompt_template = tokenEditors.environment.getValue();
  } else if (sectionEditorEnvironment) {
    payload.environment_prompt_template = sectionEditorEnvironment.value;
  }
  if (sectionEditorEnvironmentUser)
    payload.environment_user_message = sectionEditorEnvironmentUser.value;
  if (tokenEditors.conversation) {
    payload.conversation_prompt_template = tokenEditors.conversation.getValue();
  } else if (sectionEditorConversation) {
    payload.conversation_prompt_template = sectionEditorConversation.value;
  }
  if (tokenEditors.evaluation) {
    payload.evaluation_prompt_template = tokenEditors.evaluation.getValue();
  } else if (sectionEditorEvaluation) {
    payload.evaluation_prompt_template = sectionEditorEvaluation.value;
  }
  if (sectionEditorBargaining !== null)
    payload.expects_bargaining = !!sectionEditorBargaining.checked;
  if (sectionEditorOrder && sectionEditorOrder.value.trim() !== "") {
    payload.order_index = Number(sectionEditorOrder.value);
  }

  try {
    const response = await fetchWithAuth(`/api/admin/sections/${sectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "保存小节失败");
    }
    await loadAdminLevels({ chapterId, sectionId });
  } catch (error) {
    console.error(error);
    alert(error.message || "保存小节失败");
  }
}

async function deleteAdminSection() {
  const sectionId = state.admin.selectedEditorSectionId;
  if (!sectionId) {
    alert("请选择小节");
    return;
  }
  if (!confirm("确认删除该小节？")) {
    return;
  }
  try {
    const response = await fetchWithAuth(`/api/admin/sections/${sectionId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除小节失败");
    }
    await loadAdminLevels({ chapterId: state.admin.selectedEditorChapterId });
  } catch (error) {
    console.error(error);
    alert(error.message || "删除小节失败");
  }
}

async function loadLevels() {
  try {
    const response = await fetch("/api/levels");
    if (!response.ok) {
      throw new Error("无法载入章节信息");
    }
    const data = await response.json();
    state.chapters = data.chapters || [];
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
    populateAssignmentChapterOptions();
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
  } catch (error) {
    console.error(error);
    alert(error.message || "加载章节失败");
  }
}

function getAuthHeaders() {
  const headers = {};
  if (state.auth.token) {
    headers["Authorization"] = `Bearer ${state.auth.token}`;
  }
  return headers;
}

async function fetchWithAuth(url, options = {}) {
  const merged = { ...options };
  merged.headers = { ...getAuthHeaders(), ...(options.headers || {}) };
  return fetch(url, merged);
}

function updateAuthUI() {
  if (state.auth.user) {
    authPanel.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    const display = state.auth.user.displayName || state.auth.user.username;
    userStatusLabel.textContent = `${state.auth.user.role === "teacher" ? "教师" : "学生"} ${display}`;
    if (adminProfileNameInput) {
      adminProfileNameInput.value =
        state.auth.user.role === "teacher"
          ? state.auth.user.displayName || state.auth.user.username || ""
          : "";
    }
    updateInlineStatus(adminProfileStatus, "");
    updateInlineStatus(adminPasswordStatus, "");
    if (state.auth.user.role === "student") {
      studentDashboard.classList.remove("hidden");
      adminPanel.classList.add("hidden");
      goToLevelSelection();
      closeStudentModal();
      if (studentTopControls) {
        studentTopControls.classList.remove("hidden");
      }
      if (changePasswordBtn) {
        changePasswordBtn.classList.remove("hidden");
      }
    } else {
      studentDashboard.classList.add("hidden");
      hideExperience();
      adminPanel.classList.remove("hidden");
      closeStudentModal();
      renderAdminAnalytics(state.admin.analytics);
      activateAdminTab();
      if (studentTopControls) {
        studentTopControls.classList.add("hidden");
      }
      if (changePasswordBtn) {
        changePasswordBtn.classList.add("hidden");
      }
      closeStudentPasswordModal();
    }
  } else {
    authPanel.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userStatusLabel.textContent = "未登录";
    studentDashboard.classList.add("hidden");
    adminPanel.classList.add("hidden");
    hideExperience();
    if (studentTopControls) {
      studentTopControls.classList.add("hidden");
    }
    if (changePasswordBtn) {
      changePasswordBtn.classList.add("hidden");
    }
    chatInputEl.value = "";
    chatInputEl.disabled = true;
    sendMessageBtn.disabled = true;
    resetEvaluation();
    state.messages = [];
    renderChat();
    closeStudentModal();
    closeStudentPasswordModal();
  }
}

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
    };
    state.selectedLevel = {
      chapterId: state.activeLevel.chapterId,
      sectionId: state.activeLevel.sectionId,
    };
    updateSessionControls();
    renderScenario(data.session.scenario || {});
    renderChat();
    renderEvaluation(data.evaluation);
    collapseLevelSelection();
    updateSelectedLevelDetail();
    showExperience();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载会话失败");
  }
}

async function loadAdminStudents() {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/admin/students");
    if (!response.ok) {
      throw new Error("无法加载学生数据");
    }
    const data = await response.json();
    state.admin.students = data.students || [];
    renderAdminStudentList();
    renderAssignmentStudents();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载学生数据失败");
  }
}

async function loadAdminStudentDetail(studentId) {
  try {
    const response = await fetchWithAuth(`/api/admin/students/${studentId}`);
    if (!response.ok) {
      throw new Error("无法加载学生详情");
    }
    const data = await response.json();
    state.admin.selectedStudentId = data.id;
    state.admin.selectedSessionId = null;
    renderAdminStudentList();
    renderAdminStudentDetail(data);
  } catch (error) {
    console.error(error);
    alert(error.message || "加载学生详情失败");
  }
}

async function loadAdminSessionDetail(sessionId) {
  try {
    const response = await fetchWithAuth(`/api/sessions/${sessionId}`);
    if (!response.ok) {
      throw new Error("无法加载会话详情");
    }
    const data = await response.json();
    state.admin.selectedSessionId = data.session.id;
    renderAdminStudentList();
    if (state.admin.studentDetail) {
      renderAdminStudentDetail(state.admin.studentDetail);
    }
    renderAdminSessionDetail(data);
  } catch (error) {
    console.error(error);
    alert(error.message || "加载会话详情失败");
  }
}

async function loadAdminAnalytics() {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/admin/analytics");
    if (!response.ok) {
      throw new Error("无法加载班级数据");
    }
    const data = await response.json();
    renderAdminAnalytics(data);
  } catch (error) {
    console.error(error);
    renderAdminAnalytics(null);
  }
}

async function loadAdminBlueprints() {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/blueprints");
    if (!response.ok) {
      throw new Error("无法加载蓝图列表");
    }
    const data = await response.json();
    state.admin.blueprints = data.blueprints || [];
    if (
      state.admin.selectedBlueprintId &&
      !state.admin.blueprints.some((item) => item.id === state.admin.selectedBlueprintId)
    ) {
      state.admin.selectedBlueprintId = null;
      resetBlueprintForm();
    }
    renderBlueprintList();
    populateAssignmentBlueprintOptions();
  } catch (error) {
    console.error(error);
    if (adminBlueprintStatus) {
      adminBlueprintStatus.textContent = error.message || "加载蓝图失败";
    }
  }
}

async function loadAdminAssignments() {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/assignments");
    if (!response.ok) {
      throw new Error("无法加载作业列表");
    }
    const data = await response.json();
    state.admin.assignments = data.assignments || [];
    if (
      state.admin.selectedAssignmentId &&
      !state.admin.assignments.some((item) => item.id === state.admin.selectedAssignmentId)
    ) {
      state.admin.selectedAssignmentId = null;
      if (adminAssignmentIdInput) {
        adminAssignmentIdInput.value = "";
      }
      populateAssignmentForm(null);
    } else if (state.admin.selectedAssignmentId) {
      const selected = findAdminAssignment(state.admin.selectedAssignmentId);
      if (selected) {
        populateAssignmentForm(selected);
      }
    }
    renderAssignmentList();
    renderAssignmentStudents();
  } catch (error) {
    console.error(error);
    if (adminAssignmentStatus) {
      adminAssignmentStatus.textContent = error.message || "加载作业失败";
    }
  }
}

async function submitBlueprint(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  const payload = {
    title: adminBlueprintTitle.value.trim(),
    description: adminBlueprintSummary.value.trim(),
    difficulty: adminBlueprintDifficulty.value,
    blueprint: buildBlueprintPayloadFromForm(),
  };
  const blueprintId = adminBlueprintIdInput.value;
  const url = blueprintId ? `/api/blueprints/${blueprintId}` : "/api/blueprints";
  const method = blueprintId ? "PUT" : "POST";
  try {
    if (adminBlueprintStatus) adminBlueprintStatus.textContent = "保存中...";
    const response = await fetchWithAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "保存蓝图失败");
    }
    const data = await response.json();
    if (adminBlueprintStatus) adminBlueprintStatus.textContent = "蓝图已保存";
    state.admin.selectedBlueprintId = data.blueprint?.id || null;
    resetBlueprintForm(data.blueprint);
    await loadAdminBlueprints();
  } catch (error) {
    console.error(error);
    if (adminBlueprintStatus) adminBlueprintStatus.textContent = error.message || "保存蓝图失败";
  }
}

async function deleteBlueprint(blueprintId) {
  if (!blueprintId) return;
  try {
    const response = await fetchWithAuth(`/api/blueprints/${blueprintId}`, { method: "DELETE" });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    if (adminBlueprintStatus) adminBlueprintStatus.textContent = "蓝图已删除";
    if (adminBlueprintIdInput && adminBlueprintIdInput.value === blueprintId) {
      state.admin.selectedBlueprintId = null;
      resetBlueprintForm();
    }
    await loadAdminBlueprints();
  } catch (error) {
    console.error(error);
    if (adminBlueprintStatus) adminBlueprintStatus.textContent = error.message || "删除蓝图失败";
  }
}

async function submitAssignment(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  const students = Array.from(
    adminAssignmentStudents ? adminAssignmentStudents.querySelectorAll("input[type='checkbox']") : []
  )
    .filter((input) => input.checked)
    .map((input) => Number(input.value));
  let scenarioPayload = null;
  let scenarioSource = "";
  if (tokenEditors.assignmentScenario) {
    scenarioSource = tokenEditors.assignmentScenario.getValue();
  } else if (adminAssignmentScenario) {
    scenarioSource = adminAssignmentScenario.value;
  }
  if (scenarioSource && scenarioSource.trim()) {
    try {
      scenarioPayload = JSON.parse(scenarioSource.trim());
    } catch (error) {
      if (adminAssignmentStatus) {
        adminAssignmentStatus.textContent = "场景 JSON 解析失败，请检查格式";
      }
      return;
    }
  }
  const payload = {
    title: adminAssignmentTitle.value.trim(),
    description: adminAssignmentDescription.value.trim(),
    difficulty: adminAssignmentDifficulty.value,
    chapterId: adminAssignmentChapter.value || null,
    sectionId: adminAssignmentSection.value || null,
    blueprintId: adminAssignmentBlueprint.value || null,
    studentIds: students,
  };
  if (scenarioPayload) {
    payload.scenario = scenarioPayload;
  }
  try {
    if (adminAssignmentStatus) adminAssignmentStatus.textContent = "发布中...";
    const response = await fetchWithAuth("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "创建作业失败");
    }
    if (adminAssignmentStatus) adminAssignmentStatus.textContent = "作业已创建";
    adminAssignmentForm.reset();
    state.admin.selectedAssignmentId = null;
    populateAssignmentForm(null);
    populateAssignmentChapterOptions();
    populateAssignmentBlueprintOptions();
    renderAssignmentStudents();
    await loadAdminAssignments();
  } catch (error) {
    console.error(error);
    if (adminAssignmentStatus) adminAssignmentStatus.textContent = error.message || "创建作业失败";
  }
}

async function loadStudentAssignments() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  try {
    const response = await fetchWithAuth("/api/student/assignments");
    if (!response.ok) {
      throw new Error("无法获取作业列表");
    }
    const data = await response.json();
    state.studentAssignments = data.assignments || [];
    renderStudentAssignments();
    updateAssignmentShortcut();
    if (studentAssignmentStatus) {
      studentAssignmentStatus.textContent = "";
    }
  } catch (error) {
    console.error(error);
    if (studentAssignmentStatus) {
      studentAssignmentStatus.textContent = error.message || "加载作业失败";
    }
  }
}

async function startAssignmentSession(assignmentId) {
  if (!state.auth.user || state.auth.user.role !== "student") {
    return;
  }
  toggleLoading(true);
  try {
    if (studentAssignmentStatus) studentAssignmentStatus.textContent = "连接作业中...";
    const response = await fetchWithAuth(`/api/assignments/${assignmentId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "无法启动作业");
    }
    const data = await response.json();
    state.sessionId = data.sessionId;
    state.messages = [];
    state.activeLevel = {
      chapterId: data.chapterId || null,
      sectionId: data.sectionId || null,
      difficulty: data.difficulty || "balanced",
    };
    state.selectedLevel = {
      chapterId: data.chapterId || null,
      sectionId: data.sectionId || null,
    };
    updateSessionControls();
    renderScenario(data.scenario || {});
    resetEvaluation();
    highlightSelectedLevel();
    updateSelectedLevelDetail();
    if (data.openingMessage) {
      appendMessage("assistant", data.openingMessage);
    }
    collapseLevelSelection();
    showExperience();
    await loadSessions();
    await loadStudentAssignments();
    await loadStudentDashboardInsights();
    updateAssignmentShortcut();
    if (studentAssignmentStatus) studentAssignmentStatus.textContent = "";
  } catch (error) {
    console.error(error);
    if (studentAssignmentStatus) {
      studentAssignmentStatus.textContent = error.message || "启动作业失败";
    }
  } finally {
    toggleLoading(false);
  }
}

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

async function handleAdminProfileUpdate(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  const displayName = adminProfileNameInput ? adminProfileNameInput.value.trim() : "";
  if (!displayName) {
    updateInlineStatus(adminProfileStatus, "请填写显示名称", "error");
    return;
  }
  updateInlineStatus(adminProfileStatus, "保存中...", "muted");
  try {
    const response = await fetchWithAuth("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新失败");
    }
    const data = await response.json();
    if (data.user) {
      state.auth.user = { ...state.auth.user, ...data.user };
      if (adminProfileNameInput) {
        adminProfileNameInput.value = data.user.displayName || data.user.username || displayName;
      }
      updateAuthUI();
    }
    updateInlineStatus(adminProfileStatus, "显示名称已更新", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminProfileStatus, error.message || "更新失败", "error");
  }
}

async function handleAdminPasswordUpdate(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  const currentPassword = adminPasswordCurrent ? adminPasswordCurrent.value : "";
  const newPassword = adminPasswordNew ? adminPasswordNew.value : "";
  if (!currentPassword || !newPassword) {
    updateInlineStatus(adminPasswordStatus, "请填写完整的密码信息", "error");
    return;
  }
  updateInlineStatus(adminPasswordStatus, "更新中...", "muted");
  try {
    const response = await fetchWithAuth("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新密码失败");
    }
    if (adminPasswordCurrent) adminPasswordCurrent.value = "";
    if (adminPasswordNew) adminPasswordNew.value = "";
    updateInlineStatus(adminPasswordStatus, "密码已更新", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminPasswordStatus, error.message || "更新密码失败", "error");
  }
}

async function handleAdminStudentPasswordReset(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  if (!state.admin.selectedStudentId) {
    adminStudentPasswordStatus.textContent = "请先选择学生";
    return;
  }
  const newPassword = adminStudentPasswordInput.value.trim();
  if (newPassword.length < 4) {
    adminStudentPasswordStatus.textContent = "密码至少 4 位";
    return;
  }
  try {
    const response = await fetchWithAuth(`/api/admin/students/${state.admin.selectedStudentId}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "重置失败");
    }
    adminStudentPasswordInput.value = "";
    adminStudentPasswordStatus.textContent = "已重置";
  } catch (error) {
    console.error(error);
    adminStudentPasswordStatus.textContent = error.message || "重置失败";
  }
}

async function handleStudentImport(event) {
  event.preventDefault();
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  if (!adminStudentImportFile || adminStudentImportFile.files.length === 0) {
    adminStudentImportStatus.textContent = "请选择 Excel 文件";
    return;
  }
  const formData = new FormData();
  formData.append("file", adminStudentImportFile.files[0]);
  try {
    adminStudentImportStatus.textContent = "导入中...";
    const response = await fetchWithAuth("/api/admin/students/import", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "导入失败");
    }
    const data = await response.json();
    adminStudentImportStatus.textContent = `导入成功：新增 ${data.result.created || 0} 人，更新 ${data.result.updated || 0} 人`;
    adminStudentImportFile.value = "";
    await loadAdminStudents();
  } catch (error) {
    console.error(error);
    adminStudentImportStatus.textContent = error.message || "导入失败";
  }
}

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
  toggleLoading(true);

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
    state.sessionId = data.sessionId;
    state.messages = [];
    state.activeLevel = { chapterId, sectionId, difficulty };
    updateSessionControls();

    renderScenario(data.scenario || {});
    resetEvaluation();

    const opening = data.openingMessage;
    if (opening) {
      appendMessage("assistant", opening);
    }

    collapseLevelSelection();
    updateSelectedLevelDetail();
    showExperience();
    await loadSessions();
    await loadStudentAssignments();
    await loadStudentDashboardInsights();
  } catch (error) {
    console.error(error);
    alert(error.message || "生成场景失败，请稍后再试");
    toggleLoading(false);
  } finally {
    startLevelBtn.disabled = false;
    startLevelBtn.textContent = "🚀 进入关卡";
    toggleLoading(false);
  }
}

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

async function sendMessage() {
  if (!state.auth.user || state.auth.user.role !== "student") {
    alert("请使用学生账号体验对话");
    return;
  }
  const message = chatInputEl.value.trim();
  if (!message) {
    return;
  }
  if (!state.sessionId) {
    alert("请先选择关卡并加载场景");
    return;
  }

  chatInputEl.value = "";
  chatInputEl.disabled = true;
  sendMessageBtn.disabled = true;

  const userMessageIndex = appendMessage("user", message);
  const assistantIndex = appendMessage("assistant", "…", { silent: true });
  renderChat();

  let fullReply = "";
  let evaluationResult = null;
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
      }
    } else if (eventType === "summary") {
      if (payload.reply) {
        fullReply = payload.reply;
        updateMessageContent(assistantIndex, fullReply);
      }
    } else if (eventType === "evaluation") {
      evaluationResult = payload.evaluation || null;
      renderEvaluation(evaluationResult);
    } else if (eventType === "error") {
      streamError = new Error(payload.error || "对话失败");
      shouldTerminate = true;
    } else if (eventType === "done") {
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
          errorMessage = errorText;
        }
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error("当前浏览器不支持流式响应");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (!shouldTerminate) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value || new Uint8Array(), { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf("\n\n");

        if (!rawEvent.trim()) {
          continue;
        }

        const { eventType, payload } = parseEvent(rawEvent);
        handleEvent(eventType, payload);
        if (shouldTerminate) {
          break;
        }
      }
    }

    if (!shouldTerminate && buffer.trim()) {
      const { eventType, payload } = parseEvent(buffer.trim());
      handleEvent(eventType, payload);
    }

    if (streamError) {
      throw streamError;
    }

    if (!fullReply) {
      const existing = state.messages[assistantIndex]?.content || "";
      fullReply = existing && existing !== "…" ? existing : "（无有效回复）";
      updateMessageContent(assistantIndex, fullReply);
    }

    await loadSessions();
    await loadStudentAssignments();
    await loadStudentDashboardInsights();
  } catch (error) {
    console.error(error);
    state.messages.splice(assistantIndex, 1);
    state.messages.splice(userMessageIndex, 1);
    renderChat();
    appendMessage("assistant", `系统提示：${error.message || "对话失败"}`);
  } finally {
    chatInputEl.disabled = false;
    sendMessageBtn.disabled = false;
    chatInputEl.focus();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  loginErrorEl.textContent = "";

  if (!username || !password) {
    loginErrorEl.textContent = "请输入账号和密码";
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "登录失败");
    }

    const data = await response.json();
    state.auth.token = data.token;
    state.auth.user = data.user;
    updateAuthUI();
    loginForm.reset();
    loginErrorEl.textContent = "";
    updateSessionControls();

    if (state.auth.user.role === "student") {
      await loadSessions();
      await loadStudentAssignments();
      await loadStudentDashboardInsights();
      showStudentDashboardHome();
    } else {
      await loadAdminStudents();
      await loadAdminAnalytics();
      await loadAdminLevels();
      await loadAdminBlueprints();
      await loadAdminAssignments();
    }
  } catch (error) {
    console.error(error);
    loginErrorEl.textContent = error.message || "登录失败";
  }
}

function handleLogout() {
  state.auth = { token: null, user: null };
  state.chapters = [];
  state.sessions = [];
  state.sessionId = null;
  state.messages = [];
  state.activeLevel = { chapterId: null, sectionId: null, difficulty: "balanced" };
  state.selectedLevel = { chapterId: null, sectionId: null };
  state.admin = {
    students: [],
    selectedStudentId: null,
    selectedSessionId: null,
    studentDetail: null,
    analytics: null,
    levels: [],
    selectedEditorChapterId: null,
    selectedEditorSectionId: null,
    blueprints: [],
    assignments: [],
    selectedBlueprintId: null,
    selectedAssignmentId: null,
  };
  state.studentInsights = null;
  state.studentAssignments = [];
  state.levelVictories = new Set();
  state.expandedChapters = new Set();
  sessionHistoryList.innerHTML = "";
  adminStudentList.innerHTML = "";
  adminStudentMeta.innerHTML = '<p class="text-slate-400">请选择学生查看详情</p>';
  adminSessionList.innerHTML = "";
  adminSessionScenario.innerHTML = "";
  adminSessionConversation.innerHTML = "";
  adminSessionEvaluation.innerHTML = "";
  if (studentAssignmentListEl) {
    studentAssignmentListEl.innerHTML = "";
  }
  if (studentAssignmentStatus) {
    studentAssignmentStatus.textContent = "";
  }
  if (adminAssignmentStatus) {
    adminAssignmentStatus.textContent = "";
  }
  if (adminBlueprintStatus) {
    adminBlueprintStatus.textContent = "";
  }
  if (adminStudentImportStatus) {
    adminStudentImportStatus.textContent = "";
  }
  if (adminStudentPasswordStatus) {
    adminStudentPasswordStatus.textContent = "";
  }
  if (studentPasswordStatus) {
    studentPasswordStatus.textContent = "";
  }
  updateInlineStatus(adminProfileStatus, "");
  updateInlineStatus(adminPasswordStatus, "");
  if (adminProfileNameInput) {
    adminProfileNameInput.value = "";
  }
  if (adminAssignmentForm) {
    adminAssignmentForm.reset();
  }
  populateAssignmentForm(null);
  populateAssignmentChapterOptions();
  populateAssignmentBlueprintOptions();
  renderAssignmentList();
  renderAssignmentStudents();
  if (adminBlueprintForm) {
    adminBlueprintForm.reset();
  }
  resetBlueprintForm();
  renderBlueprintList();
  if (adminStudentImportForm) {
    adminStudentImportForm.reset();
  }
  if (adminStudentPasswordForm) {
    adminStudentPasswordForm.reset();
  }
  if (studentPasswordForm) {
    studentPasswordForm.reset();
  }
  renderStudentInsights(null);
  renderAdminAnalytics(null);
  renderAdminLevelList();
  updateChapterForm();
  updateSectionForm();
  goToLevelSelection({ clearSelection: true });
  renderLevelMap();
  if (startAssignmentBtn) {
    startAssignmentBtn.dataset.assignmentId = "";
    startAssignmentBtn.disabled = true;
    startAssignmentBtn.removeAttribute("title");
    startAssignmentBtn.removeAttribute("aria-label");
  }
  closeStudentModal();
  closeStudentPasswordModal();
  activateAdminTab();
  updateAuthUI();
}

if (startLevelBtn) {
  startLevelBtn.addEventListener("click", startLevel);
}

if (startAssignmentBtn) {
  startAssignmentBtn.addEventListener("click", () => {
    const assignmentId = startAssignmentBtn.dataset.assignmentId;
    if (!assignmentId) {
      if (studentAssignmentStatus) {
        studentAssignmentStatus.textContent = "请先选择关卡或等待教师分配案例挑战";
      }
      return;
    }
    startAssignmentSession(assignmentId);
  });
}

if (sendMessageBtn) {
  sendMessageBtn.addEventListener("click", sendMessage);
}

if (chatInputEl) {
  chatInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

if (changePasswordBtn) {
  changePasswordBtn.addEventListener("click", () => {
    if (state.auth.user && state.auth.user.role === "student") {
      openStudentPasswordModal();
    }
  });
}

if (studentPasswordModal) {
  studentPasswordModal.addEventListener("click", (event) => {
    if (event.target === studentPasswordModal) {
      closeStudentPasswordModal();
    }
  });
}

if (studentPasswordModalClose) {
  studentPasswordModalClose.addEventListener("click", () => {
    closeStudentPasswordModal();
  });
}

if (refreshSessionsBtn) {
  refreshSessionsBtn.addEventListener("click", () => {
    loadSessions();
    loadStudentAssignments();
  });
}

if (sessionHistoryList) {
  sessionHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-session-id]");
    if (!button) return;
    const sessionId = button.dataset.sessionId;
    loadStudentSession(sessionId);
  });
}

if (studentOptionButtons && studentOptionButtons.length > 0) {
  studentOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openStudentModal(button.dataset.studentOption);
    });
  });
}

if (studentModalTabButtons && studentModalTabButtons.length > 0) {
  studentModalTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateStudentModalTab(button.dataset.modalTab);
    });
  });
}

if (studentModalCloseBtn) {
  studentModalCloseBtn.addEventListener("click", () => {
    closeStudentModal();
  });
}

if (studentModalOverlay) {
  studentModalOverlay.addEventListener("click", (event) => {
    if (event.target === studentModalOverlay) {
      closeStudentModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && studentModalOverlay && !studentModalOverlay.classList.contains("hidden")) {
    closeStudentModal();
  }
});

if (reopenLevelMapBtn) {
  reopenLevelMapBtn.addEventListener("click", () => {
    expandLevelSelection();
    highlightSelectedLevel();
  });
}

if (levelMapContainer) {
  levelMapContainer.addEventListener("click", (event) => {
    const sectionNode = event.target.closest(".level-node");
    if (sectionNode) {
      setSelectedLevel(sectionNode.dataset.chapterId, sectionNode.dataset.sectionId);
      return;
    }
    const chapterSummary = event.target.closest("summary.chapter-card-summary");
    if (chapterSummary) {
      const chapterId = chapterSummary.dataset.chapterId;
      const chapter = findChapter(chapterId);
      const firstSection = chapter && (chapter.sections || [])[0];
      if (chapterId && firstSection) {
        setSelectedLevel(chapterId, firstSection.id);
      }
    }
  });
}

if (resetSessionBtn) {
  resetSessionBtn.addEventListener("click", resetCurrentSession);
}

if (experienceTabButtons && experienceTabButtons.length > 0) {
  experienceTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveExperienceModule(button.dataset.experienceTab);
    });
  });
}

if (scenarioCollapseBtn) {
  scenarioCollapseBtn.addEventListener("click", toggleScenarioPanel);
}

if (adminTabButtons) {
  adminTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.adminTab;
      activateAdminTab(target);
      if (target === "levels") {
        loadAdminLevels();
      }
      if (target === "students") {
        loadAdminStudents();
        loadAdminAnalytics();
      }
      if (target === "assignments") {
        loadAdminStudents();
        loadAdminAssignments();
      }
      if (target === "blueprints") {
        loadAdminBlueprints();
      }
    });
  });
}

if (adminStudentList) {
  adminStudentList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-student-id]");
    if (!button) return;
    const studentId = button.dataset.studentId;
    loadAdminStudentDetail(studentId);
  });
}

if (adminAssignmentForm) {
  adminAssignmentForm.addEventListener("submit", submitAssignment);
}

if (adminAssignmentChapter) {
  adminAssignmentChapter.addEventListener("change", () => {
    updateAssignmentSectionOptions();
    state.admin.selectedAssignmentId = null;
    renderAssignmentList();
    if (adminAssignmentStatus) {
      adminAssignmentStatus.textContent = "";
    }
    updateInlineStatus(adminAssignmentGeneratorStatus, "");
  });
}

if (adminAssignmentSection) {
  adminAssignmentSection.addEventListener("change", () => {
    updateInlineStatus(adminAssignmentGeneratorStatus, "");
  });
}

if (adminAssignmentList) {
  adminAssignmentList.addEventListener("click", (event) => {
    const item = event.target.closest("li[data-assignment-id]");
    if (!item) return;
    selectAdminAssignment(item.dataset.assignmentId);
  });
  adminAssignmentList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const item = event.target.closest("li[data-assignment-id]");
    if (!item) return;
    event.preventDefault();
    selectAdminAssignment(item.dataset.assignmentId);
  });
}

if (studentAssignmentListEl) {
  studentAssignmentListEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-assignment-id]");
    if (!button) return;
    startAssignmentSession(button.dataset.assignmentId);
  });
}

if (studentPasswordForm) {
  studentPasswordForm.addEventListener("submit", handleStudentPasswordChange);
}

if (adminProfileForm) {
  adminProfileForm.addEventListener("submit", handleAdminProfileUpdate);
}

if (adminPasswordForm) {
  adminPasswordForm.addEventListener("submit", handleAdminPasswordUpdate);
}

if (adminStudentImportForm) {
  adminStudentImportForm.addEventListener("submit", handleStudentImport);
}

if (adminStudentPasswordForm) {
  adminStudentPasswordForm.addEventListener("submit", handleAdminStudentPasswordReset);
}

if (adminBlueprintForm) {
  adminBlueprintForm.addEventListener("submit", submitBlueprint);
}

if (adminAssignmentGenerateBtn) {
  adminAssignmentGenerateBtn.addEventListener(
    "click",
    handleAssignmentScenarioGeneration,
  );
}

if (adminBlueprintGenerateBtn) {
  adminBlueprintGenerateBtn.addEventListener(
    "click",
    handleBlueprintScenarioGeneration,
  );
}

if (adminBlueprintChapter) {
  adminBlueprintChapter.addEventListener("change", () => {
    updateBlueprintSectionOptions();
    updateInlineStatus(adminBlueprintGeneratorStatus, "");
  });
}

if (adminBlueprintSection) {
  adminBlueprintSection.addEventListener("change", () => {
    updateInlineStatus(adminBlueprintGeneratorStatus, "");
  });
}

if (adminBlueprintReset) {
  adminBlueprintReset.addEventListener("click", (event) => {
    event.preventDefault();
    state.admin.selectedBlueprintId = null;
    resetBlueprintForm();
    renderBlueprintList();
    if (adminBlueprintStatus) {
      adminBlueprintStatus.textContent = "已切换至空白蓝图";
    }
  });
}

if (adminBlueprintList) {
  adminBlueprintList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("button[data-action='edit']");
    if (editButton) {
      event.preventDefault();
      selectAdminBlueprint(editButton.dataset.blueprintId);
      return;
    }
    const deleteButton = event.target.closest("button[data-action='delete']");
    if (deleteButton) {
      event.preventDefault();
      const blueprintId = deleteButton.dataset.blueprintId;
      if (!blueprintId) return;
      if (!confirm("确认删除该蓝图？")) {
        return;
      }
      await deleteBlueprint(blueprintId);
    }
  });
}

if (adminSessionList) {
  adminSessionList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-session-id]");
    if (!button) return;
    const sessionId = button.dataset.sessionId;
    loadAdminSessionDetail(sessionId);
  });
}

if (levelChapterList) {
  levelChapterList.addEventListener("click", (event) => {
    const chapterButton = event.target.closest("button[data-chapter-id]");
    if (chapterButton && !event.target.closest("button[data-section-id]")) {
      const chapterId = chapterButton.dataset.chapterId;
      selectEditorChapter(chapterId);
      return;
    }
    const sectionButton = event.target.closest("button[data-section-id]");
    if (sectionButton) {
      selectEditorChapter(sectionButton.dataset.chapterId);
      selectEditorSection(sectionButton.dataset.sectionId);
    }
  });
}

if (levelCreateChapterBtn) {
  levelCreateChapterBtn.addEventListener("click", createAdminChapter);
}

if (levelCreateSectionBtn) {
  levelCreateSectionBtn.addEventListener("click", createAdminSection);
}

if (levelSaveChapterBtn) {
  levelSaveChapterBtn.addEventListener("click", saveAdminChapter);
}

if (levelDeleteChapterBtn) {
  levelDeleteChapterBtn.addEventListener("click", deleteAdminChapter);
}

if (levelSaveSectionBtn) {
  levelSaveSectionBtn.addEventListener("click", saveAdminSection);
}

if (levelDeleteSectionBtn) {
  levelDeleteSectionBtn.addEventListener("click", deleteAdminSection);
}

window.addEventListener("resize", updateExperienceLayout);
updateExperienceLayout();

initTokenEditors();
renderStudentInsights(null);
renderAdminAnalytics(null);
activateStudentTab();
activateAdminTab();
updateSessionControls();
loadLevels();
updateAuthUI();
