const chapterSelect = document.getElementById("chapter-select");
const sectionSelect = document.getElementById("section-select");
const sectionDescription = document.getElementById("section-description");
const startLevelBtn = document.getElementById("start-level");
const levelSelector = document.getElementById("level-selector");
const loadingPanel = document.getElementById("loading-panel");
const experienceSection = document.getElementById("experience");

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

const state = {
  chapters: [],
  sectionsByChapter: {},
  sessionId: null,
  scenario: null,
  messages: [],
};

function renderOptions(selectEl, items, placeholder) {
  selectEl.innerHTML = "";
  if (!items || items.length === 0) {
    const option = document.createElement("option");
    option.textContent = placeholder;
    option.value = "";
    selectEl.appendChild(option);
    return;
  }

  items.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.title;
    if (index === 0) {
      option.selected = true;
    }
    selectEl.appendChild(option);
  });
}

function updateSectionDescription(chapterId, sectionId) {
  const sections = state.sectionsByChapter[chapterId] || [];
  const section = sections.find((item) => item.id === sectionId);
  sectionDescription.textContent = section ? section.description : "";
}

function toggleLoading(isLoading) {
  if (isLoading) {
    loadingPanel.classList.remove("hidden");
  } else {
    loadingPanel.classList.add("hidden");
  }
}

function showExperience() {
  levelSelector.classList.add("hidden");
  loadingPanel.classList.add("hidden");
  experienceSection.classList.remove("hidden");
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
    if (ordered) {
      container.appendChild(empty);
    } else {
      container.appendChild(empty);
    }
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
  chatToneEl.textContent = scenario.communicationTone || "";
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
      avatar.classList.add("bg-blue-500/80", "flex", "items-center", "justify-center", "text-white", "text-sm", "font-semibold");
      avatar.textContent = "AI";
      bubble.classList.add("bubble-assistant");
      row.appendChild(avatar);
      row.appendChild(bubble);
    } else {
      row.classList.add("items-start", "justify-end");
      avatar.classList.add("bg-emerald-500/80", "flex", "items-center", "justify-center", "text-white", "text-sm", "font-semibold");
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

async function loadLevels() {
  try {
    const response = await fetch("/api/levels");
    if (!response.ok) {
      throw new Error("无法载入章节信息");
    }
    const data = await response.json();
    state.chapters = data.chapters || [];
    state.sectionsByChapter = {};
    state.chapters.forEach((chapter) => {
      state.sectionsByChapter[chapter.id] = chapter.sections || [];
    });

    renderOptions(chapterSelect, state.chapters, "暂无章节");
    const firstChapter = state.chapters[0];
    if (firstChapter) {
      renderOptions(sectionSelect, firstChapter.sections || [], "暂无小节");
      updateSectionDescription(firstChapter.id, sectionSelect.value);
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "加载章节失败");
  }
}

async function startLevel() {
  const chapterId = chapterSelect.value;
  const sectionId = sectionSelect.value;

  if (!chapterId || !sectionId) {
    alert("请选择章节与小节");
    return;
  }

  startLevelBtn.disabled = true;
  startLevelBtn.textContent = "加载中...";
  toggleLoading(true);

  try {
    const response = await fetch("/api/start_level", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ chapterId, sectionId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "无法生成场景");
    }

    const data = await response.json();
    state.sessionId = data.sessionId;
    state.messages = [];

    renderScenario(data.scenario || {});
    resetEvaluation();

    const opening = data.openingMessage;
    if (opening) {
      appendMessage("assistant", opening);
    }

    showExperience();
  } catch (error) {
    console.error(error);
    alert(error.message || "生成场景失败，请稍后再试");
    toggleLoading(false);
  } finally {
    startLevelBtn.disabled = false;
    startLevelBtn.textContent = "🚀 进入关卡";
  }
}

async function sendMessage() {
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
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
  } catch (error) {
    console.error(error);
    appendMessage("assistant", `系统提示：${error.message || "对话失败"}`);
  } finally {
    chatInputEl.disabled = false;
    sendMessageBtn.disabled = false;
    chatInputEl.focus();
  }
}

chapterSelect.addEventListener("change", () => {
  const chapterId = chapterSelect.value;
  const sections = state.sectionsByChapter[chapterId] || [];
  renderOptions(sectionSelect, sections, "暂无小节");
  updateSectionDescription(chapterId, sectionSelect.value);
});

sectionSelect.addEventListener("change", () => {
  const chapterId = chapterSelect.value;
  updateSectionDescription(chapterId, sectionSelect.value);
});

startLevelBtn.addEventListener("click", startLevel);

sendMessageBtn.addEventListener("click", sendMessage);

chatInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

loadLevels();
