const authPanel = document.getElementById("auth-panel");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username-input");
const passwordInput = document.getElementById("password-input");
const loginErrorEl = document.getElementById("login-error");
const userStatusLabel = document.getElementById("user-status-label");
const logoutBtn = document.getElementById("logout-btn");

const studentDashboard = document.getElementById("student-dashboard");
const adminPanel = document.getElementById("admin-panel");
const refreshSessionsBtn = document.getElementById("refresh-sessions");
const sessionHistoryList = document.getElementById("session-history");

const adminStudentList = document.getElementById("admin-student-list");
const adminStudentMeta = document.getElementById("admin-student-meta");
const adminSessionList = document.getElementById("admin-session-list");
const adminSessionScenario = document.getElementById("admin-session-scenario");
const adminSessionConversation = document.getElementById("admin-session-conversation");
const adminSessionEvaluation = document.getElementById("admin-session-evaluation");

const levelSelectionPanel = document.getElementById("level-selection-panel");
const levelMapContainer = document.getElementById("level-map");
const selectedLevelDetail = document.getElementById("selected-level-detail");
const selectedLevelTitle = document.getElementById("selected-level-title");
const selectedLevelDescription = document.getElementById("selected-level-description");
const startLevelBtn = document.getElementById("start-level");
const difficultySelect = document.getElementById("difficulty-select");
const loadingPanel = document.getElementById("loading-panel");
const experienceSection = document.getElementById("experience");
const studentTabButtons = document.querySelectorAll("#student-dashboard [data-tab]");
const studentTabPanels = document.querySelectorAll("#student-dashboard [data-tab-panel]");
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

const adminTrendList = document.getElementById("admin-trend-list");
const adminActionHotspots = document.getElementById("admin-action-hotspots");
const adminKnowledgeWeakness = document.getElementById("admin-knowledge-weakness");

let abilityRadarChart = null;

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
  admin: {
    students: [],
    selectedStudentId: null,
    selectedSessionId: null,
    studentDetail: null,
    analytics: null,
    levels: [],
    selectedEditorChapterId: null,
    selectedEditorSectionId: null,
  },
  studentInsights: null,
};

function toggleLoading(isLoading) {
  if (isLoading) {
    loadingPanel.classList.remove("hidden");
  } else {
    loadingPanel.classList.add("hidden");
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
    return;
  }
  const chapter = findChapter(chapterId);
  const section = findSection(chapterId, sectionId);
  if (!chapter || !section) {
    selectedLevelDetail.classList.add("hidden");
    startLevelBtn.disabled = true;
    return;
  }
  selectedLevelTitle.textContent = `${chapter.title || "章节"}｜${section.title || "小节"}`;
  selectedLevelDescription.textContent = section.description || "";
  selectedLevelDetail.classList.remove("hidden");
  startLevelBtn.disabled = false;
  highlightSelectedLevel();
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

  chapters.forEach((chapter, index) => {
    const column = document.createElement("div");
    column.className = "level-column";
    column.dataset.chapterId = chapter.id;

    const header = document.createElement("button");
    header.type = "button";
    header.className = "level-column-header text-left";
    header.dataset.chapterId = chapter.id;
    header.innerHTML = `
      <span>${chapter.title || "章节"}</span>
      <span class="text-xs text-slate-500">${chapter.description || `Chapter ${index + 1}`}</span>
    `;
    column.appendChild(header);

    const list = document.createElement("div");
    list.className = "level-node-list";
    (chapter.sections || []).forEach((section) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "level-node";
      node.dataset.chapterId = chapter.id;
      node.dataset.sectionId = section.id;
      node.innerHTML = `
        <span class="text-sm font-semibold text-white">${section.title || "小节"}</span>
        <span class="text-xs text-slate-400">${section.description || ""}</span>
      `;
      list.appendChild(node);
    });

    if ((chapter.sections || []).length === 0) {
      const emptySection = document.createElement("p");
      emptySection.className = "rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500";
      emptySection.textContent = "暂无小节";
      list.appendChild(emptySection);
    }

    column.appendChild(list);
    levelMapContainer.appendChild(column);
  });

  highlightSelectedLevel();
}

function updateSessionControls() {
  if (resetSessionBtn) {
    resetSessionBtn.disabled = !state.sessionId;
  }
}

function activateStudentTab(tabId) {
  if (!studentTabButtons || studentTabButtons.length === 0) {
    return;
  }
  const buttonList = Array.from(studentTabButtons);
  const panelList = Array.from(studentTabPanels || []);
  const defaultTab = buttonList[0] ? buttonList[0].dataset.tab : null;
  const targetTab = buttonList.some((btn) => btn.dataset.tab === tabId)
    ? tabId
    : defaultTab;

  buttonList.forEach((button) => {
    const isActive = button.dataset.tab === targetTab;
    button.classList.toggle("tab-trigger-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  panelList.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === targetTab;
    panel.classList.toggle("tab-panel-active", isActive);
  });
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
}

function hideExperience() {
  experienceSection.classList.add("hidden");
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
  const values = Array.isArray(items)
    ? items
    : items
    ? [items]
    : [];

  container.innerHTML = "";
  values.forEach((item) => {
    const pill = document.createElement("span");
    pill.className = "knowledge-pill";
    pill.dataset.tooltip = "待开发";
    pill.textContent = item;
    container.appendChild(pill);
  });
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
    bubble.className = "chat-bubble whitespace-pre-wrap text-sm leading-6";
    bubble.textContent = message.content;

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

function appendMessage(role, content) {
  state.messages.push({ role, content });
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
    name.textContent = `学生 ${student.username}`;
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
    <p class="text-sm text-slate-200">学生 ${detail.username}</p>
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
    if (sectionEditorEnvironment) sectionEditorEnvironment.value = "";
    if (sectionEditorEnvironmentUser) sectionEditorEnvironmentUser.value = "";
    if (sectionEditorConversation) sectionEditorConversation.value = "";
    if (sectionEditorEvaluation) sectionEditorEvaluation.value = "";
    if (sectionEditorBargaining) sectionEditorBargaining.checked = false;
    if (sectionEditorOrder) sectionEditorOrder.value = "";
    return;
  }

  sectionEditorForm.classList.remove("hidden");
  levelSectionStatus.textContent = "编辑 " + (section.title || "小节");
  if (sectionEditorTitle) sectionEditorTitle.value = section.title || "";
  if (sectionEditorDescription) sectionEditorDescription.value = section.description || "";
  if (sectionEditorEnvironment)
    sectionEditorEnvironment.value = section.environmentPromptTemplate || "";
  if (sectionEditorEnvironmentUser)
    sectionEditorEnvironmentUser.value = section.environmentUserMessage || "";
  if (sectionEditorConversation)
    sectionEditorConversation.value = section.conversationPromptTemplate || "";
  if (sectionEditorEvaluation)
    sectionEditorEvaluation.value = section.evaluationPromptTemplate || "";
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
  if (sectionEditorEnvironment)
    payload.environment_prompt_template = sectionEditorEnvironment.value;
  if (sectionEditorEnvironmentUser)
    payload.environment_user_message = sectionEditorEnvironmentUser.value;
  if (sectionEditorConversation)
    payload.conversation_prompt_template = sectionEditorConversation.value;
  if (sectionEditorEvaluation)
    payload.evaluation_prompt_template = sectionEditorEvaluation.value;
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
    userStatusLabel.textContent = `${state.auth.user.role === "teacher" ? "教师" : "学生"} ${state.auth.user.username}`;
    if (state.auth.user.role === "student") {
      studentDashboard.classList.remove("hidden");
      adminPanel.classList.add("hidden");
      chatInputEl.disabled = false;
      sendMessageBtn.disabled = false;
      activateStudentTab();
    } else {
      studentDashboard.classList.add("hidden");
      hideExperience();
      adminPanel.classList.remove("hidden");
      chatInputEl.disabled = true;
      sendMessageBtn.disabled = true;
      renderAdminAnalytics(state.admin.analytics);
      activateAdminTab();
    }
  } else {
    authPanel.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    userStatusLabel.textContent = "未登录";
    studentDashboard.classList.add("hidden");
    adminPanel.classList.add("hidden");
    hideExperience();
    chatInputEl.value = "";
    chatInputEl.disabled = true;
    sendMessageBtn.disabled = true;
    resetEvaluation();
    state.messages = [];
    renderChat();
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

    const data = await response.json();
    state.messages = [];
    renderScenario(data.scenario || {});
    resetEvaluation();
    renderChat();

    const opening = data.openingMessage;
    if (opening) {
      appendMessage("assistant", opening);
    }

    state.activeLevel = {
      chapterId: data.chapterId,
      sectionId: data.sectionId,
      difficulty: data.difficulty || state.activeLevel.difficulty || "balanced",
    };
    state.selectedLevel = {
      chapterId: state.activeLevel.chapterId,
      sectionId: state.activeLevel.sectionId,
    };
    collapseLevelSelection();
    updateSelectedLevelDetail();

    await loadSessions();
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

  appendMessage("user", message);

  try {
    const response = await fetchWithAuth("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: state.sessionId, message }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "发送消息失败");
    }

    const data = await response.json();
    if (data.reply) {
      appendMessage("assistant", data.reply);
    }
    renderEvaluation(data.evaluation);
    await loadSessions();
    await loadStudentDashboardInsights();
  } catch (error) {
    console.error(error);
    state.messages.pop();
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
      await loadStudentDashboardInsights();
      showExperience();
    } else {
      await loadAdminStudents();
      await loadAdminAnalytics();
      await loadAdminLevels();
    }
  } catch (error) {
    console.error(error);
    loginErrorEl.textContent = error.message || "登录失败";
  }
}

function handleLogout() {
  state.auth = { token: null, user: null };
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
  };
  state.studentInsights = null;
  sessionHistoryList.innerHTML = "";
  adminStudentList.innerHTML = "";
  adminStudentMeta.innerHTML = '<p class="text-slate-400">请选择学生查看详情</p>';
  adminSessionList.innerHTML = "";
  adminSessionScenario.innerHTML = "";
  adminSessionConversation.innerHTML = "";
  adminSessionEvaluation.innerHTML = "";
  renderScenario({});
  renderStudentInsights(null);
  renderAdminAnalytics(null);
  renderAdminLevelList();
  updateChapterForm();
  updateSectionForm();
  resetEvaluation();
  state.messages = [];
  renderChat();
  expandLevelSelection();
  updateSelectedLevelDetail();
  hideExperience();
  activateStudentTab();
  activateAdminTab();
  updateSessionControls();
  updateAuthUI();
}

if (startLevelBtn) {
  startLevelBtn.addEventListener("click", startLevel);
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

if (refreshSessionsBtn) {
  refreshSessionsBtn.addEventListener("click", () => {
    loadSessions();
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

if (studentTabButtons) {
  studentTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateStudentTab(button.dataset.tab);
    });
  });
}

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
    const chapterHeader = event.target.closest(".level-column-header");
    if (chapterHeader) {
      const chapterId = chapterHeader.dataset.chapterId;
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

renderStudentInsights(null);
renderAdminAnalytics(null);
activateStudentTab();
activateAdminTab();
updateSessionControls();
loadLevels();
updateAuthUI();
