const channelSelect = document.getElementById("channel-select");
const moduleSelect = document.getElementById("module-select");
const loadPromptsBtn = document.getElementById("load-prompts");
const systemPromptTextarea = document.getElementById("system-prompt");
const loadUserSampleBtn = document.getElementById("load-user-sample");
const userPromptTextarea = document.getElementById("user-prompt");
const sendRequestBtn = document.getElementById("send-request");
const streamContainer = document.getElementById("stream-container");
const rawJsonPre = document.getElementById("raw-json");
const clearOutputBtn = document.getElementById("clear-output");
const channelBadge = document.getElementById("channel-badge");

const roleAssignmentEl = document.getElementById("role-assignment");
const scenarioListEl = document.getElementById("scenario-list");
const knowledgeGraphEl = document.getElementById("knowledge-graph");
const taskStepsEl = document.getElementById("task-steps");
const templatesEl = document.getElementById("templates");
const checklistEl = document.getElementById("checklist");
const rubricEl = document.getElementById("rubric");
const nextActionsEl = document.getElementById("next-actions");
const streamTagsEl = document.getElementById("stream-tags");

const CHANNEL_LABELS = {
  collab: "协作生成 · Collaboration",
  critic: "批判反馈 · Critique",
};

function populateModuleOptions(channel) {
  moduleSelect.innerHTML = "";
  const modules = MODULE_PROMPTS[channel];
  Object.keys(modules)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = `${key} 章`;
      moduleSelect.appendChild(option);
    });
}

function updateChannelBadge(channel) {
  channelBadge.textContent = CHANNEL_LABELS[channel];
  channelBadge.className =
    "rounded-full px-3 py-1 text-xs" +
    (channel === "collab"
      ? " bg-blue-500/20 text-blue-200"
      : " bg-rose-500/20 text-rose-200");
}

function fillSystemPrompts() {
  const channel = channelSelect.value;
  const module = moduleSelect.value;
  const globalPrompt = GLOBAL_PROMPTS[channel] ?? "";
  const modulePrompt = MODULE_PROMPTS[channel]?.[module] ?? "";
  systemPromptTextarea.value = `${globalPrompt}\n\n${modulePrompt}`.trim();
}

function fillUserSample() {
  const channel = channelSelect.value;
  const module = moduleSelect.value;
  userPromptTextarea.value = SAMPLE_USER_PROMPTS[channel]?.[module] ?? "";
}

function resetParsedInsights() {
  roleAssignmentEl.textContent = "";
  scenarioListEl.innerHTML = "";
  knowledgeGraphEl.innerHTML = "";
  taskStepsEl.innerHTML = "";
  templatesEl.innerHTML = "";
  checklistEl.innerHTML = "";
  rubricEl.innerHTML = "";
  nextActionsEl.innerHTML = "";
  streamTagsEl.innerHTML = "";
  rawJsonPre.textContent = "";
}

function renderScenario(scenario = {}) {
  const entries = Object.entries(scenario).filter(([, value]) => value);
  scenarioListEl.innerHTML = "";
  entries.forEach(([key, value]) => {
    const item = document.createElement("li");
    item.innerHTML = `<span class="font-semibold text-slate-200">${key}：</span>${Array.isArray(value) ? value.join("；") : value}`;
    scenarioListEl.appendChild(item);
  });
}

function renderBadges(container, items = []) {
  container.innerHTML = "";
  items.forEach((item) => {
    const badge = document.createElement("span");
    badge.className = "rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200";
    badge.textContent = item;
    container.appendChild(badge);
  });
}

function renderList(container, items = [], ordered = false) {
  container.innerHTML = "";
  items.forEach((item) => {
    const element = document.createElement("li");
    element.textContent = item;
    container.appendChild(element);
  });
}

function renderTemplates(templates = {}) {
  templatesEl.innerHTML = "";
  if (!templates.cn && !templates.en) {
    return;
  }
  if (templates.cn) {
    const cnBlock = document.createElement("div");
    cnBlock.innerHTML = `<p class="font-semibold text-slate-200">中文模板</p><p class="mt-1 whitespace-pre-wrap">${templates.cn}</p>`;
    templatesEl.appendChild(cnBlock);
  }
  if (templates.en) {
    const enBlock = document.createElement("div");
    enBlock.innerHTML = `<p class="font-semibold text-slate-200">English Template</p><p class="mt-1 whitespace-pre-wrap">${templates.en}</p>`;
    templatesEl.appendChild(enBlock);
  }
}

function renderRubric(rubric = []) {
  rubricEl.innerHTML = "";
  rubric.forEach((item) => {
    const card = document.createElement("div");
    card.className = "rounded-xl border border-slate-800 bg-slate-900/60 p-3";
    const criteria = Array.isArray(item.criteria)
      ? item.criteria.map((crit) => `<li>${crit}</li>`).join("")
      : "";
    card.innerHTML = `
      <p class="font-semibold text-slate-200">${item.dimension} · ${(item.weight * 100).toFixed(0)}%</p>
      <ul class="mt-2 list-disc space-y-1 pl-5">${criteria}</ul>
    `;
    rubricEl.appendChild(card);
  });
}

function renderNextActions(actions = []) {
  nextActionsEl.innerHTML = "";
  actions.forEach((action) => {
    const li = document.createElement("li");
    li.textContent = action;
    nextActionsEl.appendChild(li);
  });
}

function renderStreamTags(tags = []) {
  streamTagsEl.innerHTML = "";
  tags.forEach((tag) => {
    const badge = document.createElement("span");
    badge.className = "rounded-full bg-indigo-500/20 px-3 py-1 text-xs text-indigo-200";
    badge.textContent = tag;
    streamTagsEl.appendChild(badge);
  });
}

function applyParsedData(data) {
  const role = data.role_assignment ?? {};
  roleAssignmentEl.textContent = role.student_role
    ? `Student: ${role.student_role} ｜ AI: ${role.ai_role} ｜ ${role.why || ""}`
    : "";
  renderScenario(data.scenario ?? {});
  renderBadges(knowledgeGraphEl, data.knowledge_graph_focus ?? []);
  renderList(taskStepsEl, data.task_steps ?? []);
  renderTemplates(data.templates ?? {});
  renderList(checklistEl, data.checklist ?? []);
  renderRubric(data.rubric ?? []);
  renderNextActions(data.next_actions ?? []);
  renderStreamTags(data.stream_tags ?? []);
}

async function streamRequest() {
  const channel = channelSelect.value;
  const endpoint = channel === "critic" ? "/api/critique_stream" : "/api/collab_stream";
  const systemPrompt = systemPromptTextarea.value.trim();
  const userPrompt = userPromptTextarea.value.trim();

  if (!systemPrompt || !userPrompt) {
    alert("请填写 System Prompt 和 User Prompt。");
    return;
  }

  streamContainer.textContent = "";
  rawJsonPre.textContent = "";
  resetParsedInsights();

  sendRequestBtn.disabled = true;
  sendRequestBtn.textContent = "Streaming...";

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ system: systemPrompt, user: userPrompt }),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(text || "请求失败");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;

      const jsonStart = fullText.indexOf("--JSON_START--");
      const displayText = jsonStart >= 0 ? fullText.slice(0, jsonStart) : fullText;
      streamContainer.textContent = displayText;
      streamContainer.scrollTop = streamContainer.scrollHeight;
    }

    const jsonStart = fullText.indexOf("--JSON_START--");
    const jsonEnd = fullText.indexOf("--JSON_END--");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonString = fullText.slice(jsonStart + "--JSON_START--".length, jsonEnd).trim();
      rawJsonPre.textContent = jsonString;
      try {
        const parsed = JSON.parse(jsonString);
        applyParsedData(parsed);
      } catch (error) {
        rawJsonPre.textContent += `\n\nJSON 解析失败：${error.message}`;
      }
    }
  } catch (error) {
    streamContainer.textContent = `请求出错：${error.message}`;
  } finally {
    sendRequestBtn.disabled = false;
    sendRequestBtn.textContent = "🚀 启动流式对话 · Start Streaming";
  }
}

channelSelect.addEventListener("change", () => {
  populateModuleOptions(channelSelect.value);
  fillSystemPrompts();
  fillUserSample();
  updateChannelBadge(channelSelect.value);
});

moduleSelect.addEventListener("change", () => {
  fillSystemPrompts();
  fillUserSample();
});

loadPromptsBtn.addEventListener("click", fillSystemPrompts);
loadUserSampleBtn.addEventListener("click", fillUserSample);
sendRequestBtn.addEventListener("click", streamRequest);
clearOutputBtn.addEventListener("click", () => {
  streamContainer.textContent = "";
  rawJsonPre.textContent = "";
  resetParsedInsights();
});

// Initialize defaults
populateModuleOptions(channelSelect.value);
fillSystemPrompts();
fillUserSample();
updateChannelBadge(channelSelect.value);
