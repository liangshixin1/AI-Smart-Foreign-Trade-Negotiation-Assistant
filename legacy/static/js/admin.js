// -------------------- 全局状态与编辑器实例 --------------------
// adminTheoryLessonEditor：后台理论课 Quill 编辑器实例，承载知识卡、挑战气泡等富文本组件。
let adminTheoryLessonEditor = null;
// 是否已注册 Quill 自定义 blots，避免重复注册。
let challengeBubbleBlotRegistered = false;
let knowledgePointCardBlotRegistered = false;
// 图谱渲染相关实例。当前 MVP 使用 D3 固定环形闭环图谱。
let adminGraphNetwork = null;
let adminGraphSelectionKey = null;
let adminGraphRenderer = "ring";
let adminGraphMapExpanded = true;
let adminGraphFocusedPointId = null;
let adminRingGraphZoomTransform = null;
let adminKgAcceptanceView = "overview";
let adminKgSunburstFocusId = null;
let adminKgStarFocusId = null;
let adminKgWorkFocusId = null;
let adminKgFullscreenListenerReady = false;
const adminKgStarVisibleRelTypes = new Set(["anchor", "req", "scn", "con", "cul"]);
const adminKgWorkExpandedStages = new Set();
const adminKgWorkExpandedTopics = new Set();
const expandedStages = new Set();
const expandedTopics = new Set();
const adminRingExpandedStages = new Set();
const adminRingExpandedTopics = new Set();
// 知识卡弹窗的本地状态缓存，记录当前编辑节点、选中知识点等。
const knowledgeCardModalState = {
  editingNode: null,
  selectedKnowledge: null,
  imageDataUrl: "",
  indexRecords: [],
};
let adminTrendChartInstance = null;

function normalizeKnowledgeLabel(raw) {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") {
    const text = raw.trim();
    if (text.startsWith("{") || text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        return normalizeKnowledgeLabel(parsed);
      } catch (error) {
        return text;
      }
    }
    return text;
  }
  if (typeof raw === "object") {
    if (raw.label) return String(raw.label).trim();
    if (raw.name) return String(raw.name).trim();
    if (raw.title) return String(raw.title).trim();
    if (raw.knowledgePoint) return String(raw.knowledgePoint).trim();
  }
  return String(raw).trim();
}

// -------------------- 知识卡模板与数据规范化 --------------------
// 清洗知识卡 HTML，防止 XSS，同时允许正常的富文本标签。
function sanitizeKnowledgeCardHtml(html) {
  const value = typeof html === "string" ? html : "";
  if (typeof window !== "undefined" && window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    return window.DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
  }
  return value;
}

// 将知识卡 payload 渲染为可直接插入页面的 HTML 结构。
function buildKnowledgeCardMarkup(payload = {}) {
  const title = escapeHtmlText(payload.name || payload.title || "关键知识点");
  const summary = escapeHtmlText(payload.summary || "");
  const tags = Array.isArray(payload.tags) ? payload.tags.filter(Boolean) : [];
  const imageUrl = payload.imageUrl ? escapeHtmlAttribute(payload.imageUrl) : "";
  const imageAlt = payload.imageAlt ? escapeHtmlAttribute(payload.imageAlt) : title;
  const bodyHtml = sanitizeKnowledgeCardHtml(payload.bodyHtml || "");
  const chipsHtml =
    tags.length > 0
      ? `<div class="knowledge-card__footer">${tags
          .map((tag) => `<span class="knowledge-card__chip">${escapeHtmlText(tag)}</span>`)
          .join("")}</div>`
      : "";
  const summaryHtml = summary
    ? `<p class="knowledge-card__summary">${summary}</p>`
    : "";
  const bodySection = bodyHtml
    ? `<div class="knowledge-card__body">${bodyHtml}</div>`
    : "";
  const mediaSection = imageUrl
    ? `<div class="knowledge-card__media"><img src="${imageUrl}" alt="${imageAlt}" loading="lazy" /></div>`
    : "";
  return `
    <article class="knowledge-card">
      <header class="knowledge-card__header">
        <h4 class="knowledge-card__title">${title}</h4>
        <span class="knowledge-card__tag">知识卡</span>
      </header>
      ${summaryHtml}
      ${mediaSection}
      ${bodySection}
      ${chipsHtml}
    </article>
  `;
}

// 统一知识卡的字段命名与默认值，方便存储和渲染。
function normalizeKnowledgeCardPayload(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? { ...rawValue } : {};
  const payload = {
    name: source.name || source.title || source.label || "",
    summary: source.summary || source.description || "",
    bodyHtml: source.bodyHtml || source.html || "",
    imageUrl: source.imageUrl || source.image || "",
    imageAlt: source.imageAlt || source.alt || "",
    anchorId: source.anchorId || source.anchor || "",
    tags: Array.isArray(source.tags)
      ? source.tags
          .map((tag) => (tag && tag.toString ? tag.toString().trim() : ""))
          .filter((tag) => tag)
      : typeof source.tags === "string"
      ? source.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      : [],
    knowledgeId: source.knowledgeId || source.sourceId || "",
  };
  if (!payload.anchorId && typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
    payload.anchorId = `kp-${window.crypto.randomUUID()}`;
  } else if (!payload.anchorId) {
    payload.anchorId = `kp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }
  return payload;
}

// 将知识卡注册为 Quill 的自定义 BlockEmbed，支持在富文本中插入知识卡节点。
function registerKnowledgePointCardBlot() {
  if (knowledgePointCardBlotRegistered) {
    return;
  }
  if (typeof window === "undefined" || typeof window.Quill === "undefined") {
    return;
  }
  const Quill = window.Quill;
  const BlockEmbed = Quill.import("blots/block/embed");
  class KnowledgePointCardBlot extends BlockEmbed {
    static blotName = "knowledgePointCard";

    static tagName = "div";

    static className = "ql-knowledge-point-card";

    static create(value) {
      const node = super.create();
      const payload = normalizeKnowledgeCardPayload(value);
      node.dataset.payload = JSON.stringify(payload);
      node.dataset.knowledgeAnchor = payload.anchorId || "";
      node.setAttribute("data-knowledge-anchor", payload.anchorId || "");
      node.setAttribute("contenteditable", "false");
      node.innerHTML = buildKnowledgeCardMarkup(payload);
      return node;
    }

    static value(node) {
      if (!node) {
        return {};
      }
      try {
        const payload = JSON.parse(node.getAttribute("data-payload") || node.dataset.payload || "{}") || {};
        if (!payload.anchorId && node.dataset.knowledgeAnchor) {
          payload.anchorId = node.dataset.knowledgeAnchor;
        }
        return normalizeKnowledgeCardPayload(payload);
      } catch (error) {
        const fallback = {
          name: node.querySelector(".knowledge-card__title")
            ? node.querySelector(".knowledge-card__title").textContent
            : "",
          summary: node.querySelector(".knowledge-card__summary")
            ? node.querySelector(".knowledge-card__summary").textContent
            : "",
          bodyHtml: node.querySelector(".knowledge-card__body")
            ? node.querySelector(".knowledge-card__body").innerHTML
            : "",
          anchorId: node.dataset.knowledgeAnchor || node.getAttribute("data-knowledge-anchor") || "",
        };
        return normalizeKnowledgeCardPayload(fallback);
      }
    }
  }

  Quill.register(KnowledgePointCardBlot);
  knowledgePointCardBlotRegistered = true;
}

// 将关卡跳转气泡注册为 Quill 的嵌入元素。
function registerChallengeBubbleBlot() {
  if (challengeBubbleBlotRegistered) {
    return;
  }
  if (typeof window === "undefined" || typeof window.Quill === "undefined") {
    return;
  }
  const Quill = window.Quill;
  const Embed = Quill.import("blots/embed");
  class ChallengeBubbleBlot extends Embed {
    static blotName = "challengeBubble";

    static tagName = "span";

    static className = "challenge-link-bubble";

    static create(value) {
      const node = super.create();
      const payload = value && typeof value === "object" ? value : {};
      const chapterId = payload.chapterId || "";
      const sectionId = payload.sectionId || "";
      const label = payload.label || "关卡挑战";
      node.setAttribute("data-chapter-id", chapterId);
      node.setAttribute("data-section-id", sectionId);
      node.setAttribute("data-label", label);
      node.setAttribute("contenteditable", "false");
      node.setAttribute("tabindex", "0");
      node.setAttribute("role", "button");
      node.textContent = label;
      return node;
    }

    static value(node) {
      if (!node) {
        return { chapterId: "", sectionId: "", label: "" };
      }
      return {
        chapterId: node.getAttribute("data-chapter-id") || "",
        sectionId: node.getAttribute("data-section-id") || "",
        label: node.getAttribute("data-label") || node.textContent || "关卡挑战",
      };
    }
  }

  Quill.register(ChallengeBubbleBlot);
  challengeBubbleBlotRegistered = true;
}

// 纯文本转义，避免富文本渲染时出现 HTML 注入。
function escapeHtmlText(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// HTML 属性转义，覆盖单双引号等字符。
function escapeHtmlAttribute(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");
}

// 尝试从任意形态的知识点对象/字符串中提取名称，作为唯一标识。
function extractKnowledgeName(entry) {
  if (!entry) {
    return "";
  }
  if (typeof entry === "string") {
    return entry.trim();
  }
  if (typeof entry === "object") {
    const name = entry.name || entry.title || entry.label || entry.id || "";
    return typeof name === "string" ? name.trim() : String(name).trim();
  }
  return String(entry).trim();
}

// 将两个知识点 payload 合并（优先已有字段，补足缺失字段、合并标签）。
function mergeKnowledgePayload(target, source) {
  if (!source) {
    return target;
  }
  if (!target.name && source.name) {
    target.name = source.name;
  }
  if (!target.summary && source.summary) {
    target.summary = source.summary;
  }
  if (!target.bodyHtml && source.bodyHtml) {
    target.bodyHtml = source.bodyHtml;
  }
  if (!target.imageUrl && source.imageUrl) {
    target.imageUrl = source.imageUrl;
  }
  if (!target.imageAlt && source.imageAlt) {
    target.imageAlt = source.imageAlt;
  }
  if (!target.anchorId && source.anchorId) {
    target.anchorId = source.anchorId;
  }
  if (!target.knowledgeId && source.knowledgeId) {
    target.knowledgeId = source.knowledgeId;
  }
  const existingTags = Array.isArray(target.tags) ? target.tags : [];
  const incomingTags = Array.isArray(source.tags) ? source.tags : [];
  const combined = existingTags.slice();
  incomingTags.forEach((tag) => {
    const value = (tag || "").toString().trim();
    if (value && !combined.includes(value)) {
      combined.push(value);
    }
  });
  target.tags = combined;
  return target;
}

// 批量规范化知识点列表，并按名称去重聚合。
function normalizeKnowledgePayloadList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const map = new Map();
  list.forEach((entry) => {
    const payload = normalizeKnowledgeCardPayload(entry);
    const name = extractKnowledgeName(payload);
    if (!name) {
      return;
    }
    payload.name = name;
    if (map.has(name)) {
      const existing = map.get(name);
      mergeKnowledgePayload(existing, payload);
      return;
    }
    map.set(name, payload);
  });
  return Array.from(map.values());
}

// 从 DOM 节点中读取知识卡 payload，兼容 data-payload 与回退解析。
function readKnowledgeCardNodePayload(node) {
  if (!node) {
    return null;
  }
  try {
    const raw = JSON.parse(node.getAttribute("data-payload") || node.dataset.payload || "{}") || {};
    if (!raw.anchorId && node.dataset.knowledgeAnchor) {
      raw.anchorId = node.dataset.knowledgeAnchor;
    }
    return normalizeKnowledgeCardPayload(raw);
  } catch (error) {
    const fallback = {
      name: node.querySelector(".knowledge-card__title")
        ? node.querySelector(".knowledge-card__title").textContent
        : "",
      summary: node.querySelector(".knowledge-card__summary")
        ? node.querySelector(".knowledge-card__summary").textContent
        : "",
      bodyHtml: node.querySelector(".knowledge-card__body")
        ? node.querySelector(".knowledge-card__body").innerHTML
        : "",
      imageUrl: node.querySelector(".knowledge-card__media img")
        ? node.querySelector(".knowledge-card__media img").getAttribute("src")
        : "",
      imageAlt: node.querySelector(".knowledge-card__media img")
        ? node.querySelector(".knowledge-card__media img").getAttribute("alt")
        : "",
      tags: Array.from(node.querySelectorAll(".knowledge-card__chip")).map((chip) => chip.textContent.trim()),
      anchorId: node.dataset.knowledgeAnchor || node.getAttribute("data-knowledge-anchor") || "",
    };
    return normalizeKnowledgeCardPayload(fallback);
  }
}

// 将最新的 payload 写回 DOM 节点并重建内部 HTML。
function updateKnowledgeCardNode(node, payload) {
  if (!node) {
    return;
  }
  const normalized = normalizeKnowledgeCardPayload(payload);
  node.dataset.payload = JSON.stringify(normalized);
  node.dataset.knowledgeAnchor = normalized.anchorId || "";
  node.setAttribute("data-knowledge-anchor", normalized.anchorId || "");
  node.innerHTML = buildKnowledgeCardMarkup(normalized);
}

// 收集当前富文本中的所有知识卡节点，汇总为 payload 列表。
function collectKnowledgePointPayloadsFromEditor() {
  if (!adminTheoryLessonEditor) {
    return [];
  }
  const root = adminTheoryLessonEditor.root;
  if (!root) {
    return [];
  }
  const nodes = root.querySelectorAll(".ql-knowledge-point-card");
  const payloads = Array.from(nodes)
    .map((node) => readKnowledgeCardNodePayload(node))
    .filter((item) => item && extractKnowledgeName(item));
  return normalizeKnowledgePayloadList(payloads);
}

// 将编辑器中的知识卡列表同步到隐藏域和缓存，便于提交或后续展示。
function syncKnowledgePointsFromEditor({ updateCache = true } = {}) {
  if (!adminTheoryLessonEditor) {
    return [];
  }
  const payloads = collectKnowledgePointPayloadsFromEditor();
  if (adminTheoryLessonKnowledge) {
    writeKnowledgeToTextarea(adminTheoryLessonKnowledge, payloads);
  }
  if (updateCache) {
    const lessonId = state.admin && state.admin.theory ? state.admin.theory.selectedLessonId : null;
    if (lessonId && state.admin.graph && state.admin.graph.lessonKnowledge && state.admin.graph.lessonKnowledge.set) {
      state.admin.graph.lessonKnowledge.set(lessonId, payloads);
    }
  }
  return payloads;
}

// 根据 anchorId 平滑滚动到对应知识卡节点，并闪烁高亮。
function scrollToKnowledgeCardAnchor(anchorId) {
  const targetId = typeof anchorId === "string" ? anchorId.trim() : "";
  if (!targetId) {
    return false;
  }
  const escape =
    typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function"
      ? window.CSS.escape
      : (value) => value.replace(/['"\\]/g, "\\$&");
  const selector = `[data-knowledge-anchor="${escape(targetId)}"]`;
  let target = null;
  if (adminTheoryLessonEditor && adminTheoryLessonEditor.root) {
    target = adminTheoryLessonEditor.root.querySelector(selector);
  }
  if (!target) {
    target = document.querySelector(selector);
  }
  if (!target) {
    return false;
  }
  if (typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  target.classList.add("knowledge-card-highlight");
  window.setTimeout(() => {
    target.classList.remove("knowledge-card-highlight");
  }, 1600);
  return true;
}

// 构建知识点索引列表，用于弹窗搜索和展示统计信息。
function getAdminKnowledgeIndexRecords() {
  const rawList =
    state.admin &&
    state.admin.graph &&
    Array.isArray(state.admin.graph.knowledgePoints)
      ? state.admin.graph.knowledgePoints
      : [];
  return rawList
    .map((item) => ({
      name: extractKnowledgeName(item),
      summary: item.summary || "",
      bodyHtml: item.bodyHtml || "",
      imageUrl: item.imageUrl || "",
      imageAlt: item.imageAlt || "",
      knowledgeId: item.knowledgeId || "",
      tags: Array.isArray(item.tags) ? item.tags : [],
      practiceCount: typeof item.practiceCount === "number" ? item.practiceCount : 0,
      lessonCount: typeof item.lessonCount === "number" ? item.lessonCount : 0,
    }))
    .filter((record) => record.name);
}

// 渲染知识卡搜索列表，可根据关键词过滤并高亮当前选中项。
function renderKnowledgeCardList({ keyword = "", selectedName = "" } = {}) {
  if (!knowledgeCardList) {
    return;
  }
  const searchTerm = (keyword || "").trim().toLowerCase();
  const records = knowledgeCardModalState.indexRecords || [];
  const filtered = records.filter((record) => {
    if (!searchTerm) {
      return true;
    }
    return (
      record.name.toLowerCase().includes(searchTerm) ||
      (record.summary || "").toLowerCase().includes(searchTerm) ||
      (Array.isArray(record.tags) ? record.tags.join(" ") : "").toLowerCase().includes(searchTerm)
    );
  });
  if (filtered.length === 0) {
    knowledgeCardList.innerHTML =
      '<div class="p-4 text-xs text-slate-400">暂无匹配的知识点，可新建一个标签。</div>';
    return;
  }
  const fragment = document.createDocumentFragment();
  filtered.forEach((record) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "knowledge-modal__item";
    if (selectedName && record.name === selectedName) {
      button.setAttribute("aria-selected", "true");
    }
    button.dataset.knowledgeName = record.name;
    button.innerHTML = `
      <span class="knowledge-modal__item-title">${escapeHtmlText(record.name)}</span>
      <span class="knowledge-modal__item-meta">理论 ${record.lessonCount || 0} · 实战 ${record.practiceCount || 0}</span>
      ${record.summary ? `<span class="knowledge-modal__item-meta">${escapeHtmlText(record.summary)}</span>` : ""}
    `;
    fragment.appendChild(button);
  });
  knowledgeCardList.innerHTML = "";
  knowledgeCardList.appendChild(fragment);
}

// 重置/预填知识卡编辑表单，包括名称、摘要、标签、正文与配图。
function resetKnowledgeCardForm(payload = null) {
  const basePayload = payload ? normalizeKnowledgeCardPayload(payload) : null;
  const selectedPayload = knowledgeCardModalState.selectedKnowledge
    ? normalizeKnowledgeCardPayload(knowledgeCardModalState.selectedKnowledge)
    : null;
  const normalized = selectedPayload
    ? mergeKnowledgePayload({ ...(basePayload || {}) }, selectedPayload)
    : basePayload;
  if (knowledgeCardNameInput) {
    knowledgeCardNameInput.value = normalized ? normalized.name || "" : "";
  }
  if (knowledgeCardSummaryInput) {
    knowledgeCardSummaryInput.value = normalized ? normalized.summary || "" : "";
  }
  if (knowledgeCardTagsInput) {
    const tags = normalized && Array.isArray(normalized.tags) ? normalized.tags.join(", ") : "";
    knowledgeCardTagsInput.value = tags;
  }
  if (knowledgeCardBodyEditor) {
    knowledgeCardBodyEditor.innerHTML = normalized ? sanitizeKnowledgeCardHtml(normalized.bodyHtml || "") : "";
  }
  const imageUrl = knowledgeCardModalState.imageDataUrl
    ? knowledgeCardModalState.imageDataUrl
    : normalized && normalized.imageUrl
    ? normalized.imageUrl
    : "";
  if (knowledgeCardImagePreview) {
    if (imageUrl) {
      const safeUrl = escapeHtmlAttribute(imageUrl);
      const safeAlt = escapeHtmlAttribute(
        (normalized && (normalized.imageAlt || normalized.summary || normalized.name)) || "关键知识点配图",
      );
      knowledgeCardImagePreview.innerHTML = `<img src="${safeUrl}" alt="${safeAlt}" />`;
    } else {
      knowledgeCardImagePreview.innerHTML = '<span class="text-xs text-slate-500">未选择图片</span>';
    }
  }
  if (knowledgeCardImageInput) {
    knowledgeCardImageInput.value = "";
  }
}

// 打开知识卡弹窗，准备索引数据、选中项并聚焦输入框。
function openKnowledgeCardModal(payload = null, node = null) {
  if (!knowledgeCardModal) {
    return;
  }
  knowledgeCardModalState.editingNode = node || null;
  knowledgeCardModalState.selectedKnowledge = null;
  knowledgeCardModalState.imageDataUrl = "";
  knowledgeCardModalState.indexRecords = getAdminKnowledgeIndexRecords();
  const selectedName = payload ? extractKnowledgeName(payload) : "";
  if (selectedName) {
    const matched = knowledgeCardModalState.indexRecords.find((item) => item.name === selectedName);
    if (matched) {
      knowledgeCardModalState.selectedKnowledge = matched;
    }
  }
  renderKnowledgeCardList({ selectedName });
  resetKnowledgeCardForm(payload);
  if (knowledgeCardSearch) {
    knowledgeCardSearch.value = "";
  }
  if (knowledgeCardStatus) {
    knowledgeCardStatus.textContent = "";
  }
  knowledgeCardModal.classList.remove("hidden");
  if (knowledgeCardNameInput) {
    window.setTimeout(() => {
      knowledgeCardNameInput.focus();
      knowledgeCardNameInput.select();
    }, 0);
  }
}

// 关闭知识卡弹窗并清理本地状态缓存。
function closeKnowledgeCardModal() {
  if (!knowledgeCardModal) {
    return;
  }
  knowledgeCardModal.classList.add("hidden");
  knowledgeCardModalState.editingNode = null;
  knowledgeCardModalState.selectedKnowledge = null;
  knowledgeCardModalState.imageDataUrl = "";
  knowledgeCardModalState.indexRecords = [];
}

// 搜索框输入时实时刷新列表并保持选中态。
function handleKnowledgeCardSearchInput() {
  if (!knowledgeCardSearch) {
    return;
  }
  renderKnowledgeCardList({
    keyword: knowledgeCardSearch.value || "",
    selectedName:
      knowledgeCardModalState.selectedKnowledge && knowledgeCardModalState.selectedKnowledge.name
        ? knowledgeCardModalState.selectedKnowledge.name
        : knowledgeCardModalState.editingNode
        ? extractKnowledgeName(readKnowledgeCardNodePayload(knowledgeCardModalState.editingNode))
        : "",
  });
}

// 选中列表中的知识点后，填充表单并刷新列表选中状态。
function applyKnowledgeCardSelection(record) {
  if (!record) {
    return;
  }
  knowledgeCardModalState.selectedKnowledge = record;
  resetKnowledgeCardForm(record);
  renderKnowledgeCardList({
    keyword: knowledgeCardSearch ? knowledgeCardSearch.value : "",
    selectedName: record.name,
  });
}

// 列表点击事件代理，读取 dataset 后调用 applyKnowledgeCardSelection。
function handleKnowledgeCardListClick(event) {
  const button = event.target.closest(".knowledge-modal__item");
  if (!button) {
    return;
  }
  const name = button.dataset.knowledgeName || "";
  if (!name) {
    return;
  }
  const record = (knowledgeCardModalState.indexRecords || []).find((item) => item.name === name);
  if (record) {
    applyKnowledgeCardSelection(record);
  }
}

// 切换到“新增知识点”状态，清空表单和状态提示。
function handleKnowledgeCardNew() {
  knowledgeCardModalState.selectedKnowledge = null;
  knowledgeCardModalState.imageDataUrl = "";
  resetKnowledgeCardForm();
  renderKnowledgeCardList({ keyword: knowledgeCardSearch ? knowledgeCardSearch.value : "", selectedName: "" });
  if (knowledgeCardStatus) {
    knowledgeCardStatus.textContent = "";
  }
}

// 监听图片上传，转为 dataURL 预览并写回表单。
function handleKnowledgeCardImageChange(event) {
  const files = event && event.target && event.target.files ? event.target.files : null;
  if (!files || files.length === 0) {
    return;
  }
  const file = files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    knowledgeCardModalState.imageDataUrl = reader.result || "";
    resetKnowledgeCardForm(knowledgeCardModalState.selectedKnowledge || null);
  };
  reader.readAsDataURL(file);
}

// 移除已选图片并刷新表单预览。
function handleKnowledgeCardRemoveImage() {
  knowledgeCardModalState.imageDataUrl = "";
  resetKnowledgeCardForm(knowledgeCardModalState.selectedKnowledge || null);
}

// 在正文区域插入示例表格，方便整理知识点要点。
function handleKnowledgeCardInsertTable() {
  if (!knowledgeCardBodyEditor) {
    return;
  }
  const tableHtml = `
    <table>
      <thead>
        <tr>
          <th>要点</th>
          <th>说明</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>示例 1</td>
          <td>在此填写对应的知识点说明。</td>
        </tr>
        <tr>
          <td>示例 2</td>
          <td>可在知识卡内展示对比、步骤或参数。</td>
        </tr>
      </tbody>
    </table>
  `;
  knowledgeCardBodyEditor.insertAdjacentHTML("beforeend", tableHtml);
}

// 清空知识卡正文区域。
function handleKnowledgeCardClearBody() {
  if (!knowledgeCardBodyEditor) {
    return;
  }
  knowledgeCardBodyEditor.innerHTML = "";
}

// 汇总弹窗表单内容与选中记录，生成标准化 payload。
function readKnowledgeCardForm() {
  const basePayload = knowledgeCardModalState.editingNode
    ? readKnowledgeCardNodePayload(knowledgeCardModalState.editingNode)
    : null;
  const selectedRecord = knowledgeCardModalState.selectedKnowledge;
  const name = knowledgeCardNameInput ? knowledgeCardNameInput.value.trim() : "";
  const summary = knowledgeCardSummaryInput ? knowledgeCardSummaryInput.value.trim() : "";
  const tagsInput = knowledgeCardTagsInput ? knowledgeCardTagsInput.value : "";
  const tags = tagsInput
    ? tagsInput
        .split(/[，,]/)
        .map((tag) => tag.trim())
        .filter((tag) => tag)
    : [];
  const bodyHtml = knowledgeCardBodyEditor ? sanitizeKnowledgeCardHtml(knowledgeCardBodyEditor.innerHTML) : "";
  const fallbackImage = basePayload && basePayload.imageUrl ? basePayload.imageUrl : "";
  const selectedImage = selectedRecord && selectedRecord.imageUrl ? selectedRecord.imageUrl : "";
  const imageUrl = knowledgeCardModalState.imageDataUrl || selectedImage || fallbackImage;
  const payload = normalizeKnowledgeCardPayload({
    ...selectedRecord,
    ...basePayload,
    name,
    summary,
    tags,
    bodyHtml,
    imageUrl,
    knowledgeId: selectedRecord && selectedRecord.knowledgeId ? selectedRecord.knowledgeId : basePayload && basePayload.knowledgeId,
  });
  if (knowledgeCardModalState.imageDataUrl) {
    payload.imageUrl = knowledgeCardModalState.imageDataUrl;
  }
   // 同步正文到 content，便于知识图谱“详细描述”字段复用
  if (payload.bodyHtml && !payload.content) {
    payload.content = payload.bodyHtml;
  }
  return payload;
}

// 将知识卡插入到 Quill 编辑器（或替换已有节点），并同步缓存。
function insertKnowledgeCardIntoEditor(payload, { replaceNode = null } = {}) {
  const normalized = normalizeKnowledgeCardPayload(payload);
  if (adminTheoryLessonEditor) {
    const quill = adminTheoryLessonEditor;
    const source = window.Quill ? window.Quill.sources.USER : undefined;
    const currentRange = quill.getSelection(true);
    if (replaceNode) {
      const blot = window.Quill ? window.Quill.find(replaceNode) : null;
      if (blot) {
        const index = quill.getIndex(blot);
        quill.deleteText(index, 1, source);
        quill.insertEmbed(index, "knowledgePointCard", normalized, source);
        quill.insertText(index + 1, "\n", source);
        quill.setSelection(index + 2, 0, window.Quill ? window.Quill.sources.SILENT : undefined);
      } else {
        updateKnowledgeCardNode(replaceNode, normalized);
      }
    } else {
      let index = quill.getLength();
      if (currentRange && typeof currentRange.index === "number") {
        index = currentRange.index;
        // 若有选中内容，先删除再插入卡片，达到“替换选中文本”的效果
        if (currentRange.length && currentRange.length > 0) {
          quill.deleteText(currentRange.index, currentRange.length, source);
        }
      }
      quill.insertEmbed(index, "knowledgePointCard", normalized, source);
      quill.insertText(index + 1, "\n", source);
      quill.setSelection(index + 2, 0, window.Quill ? window.Quill.sources.SILENT : undefined);
    }
    syncKnowledgePointsFromEditor();
    return;
  }
  if (adminTheoryLessonContent) {
    const existing = adminTheoryLessonContent.value || "";
    adminTheoryLessonContent.value = `${existing}${buildKnowledgeCardMarkup(normalized)}`;
  }
}

// 根据最新 payload 刷新编辑器中已存在的知识卡节点（以锚点或名称匹配）。
function refreshKnowledgeCardNodesFromPayloads(payloads) {
  if (!adminTheoryLessonEditor || !adminTheoryLessonEditor.root) {
    return;
  }
  const normalized = normalizeKnowledgePayloadList(payloads || []);
  if (normalized.length === 0) {
    return;
  }
  const byAnchor = new Map();
  const byName = new Map();
  normalized.forEach((payload) => {
    const anchorId = payload.anchorId || "";
    if (anchorId) {
      byAnchor.set(anchorId, payload);
    }
    if (payload.name) {
      byName.set(payload.name, payload);
    }
  });
  const nodes = adminTheoryLessonEditor.root.querySelectorAll(".ql-knowledge-point-card");
  nodes.forEach((node) => {
    const current = readKnowledgeCardNodePayload(node);
    const anchorId = current && current.anchorId ? current.anchorId : "";
    let payload = null;
    if (anchorId && byAnchor.has(anchorId)) {
      payload = mergeKnowledgePayload({ ...current }, byAnchor.get(anchorId));
    } else if (current && current.name && byName.has(current.name)) {
      payload = mergeKnowledgePayload({ ...current }, byName.get(current.name));
    }
    if (payload) {
      updateKnowledgeCardNode(node, payload);
    }
  });
}

// 点击“确定”时校验名称、写入编辑器并关闭弹窗。
function handleKnowledgeCardConfirm() {
  if (knowledgeCardStatus) {
    knowledgeCardStatus.textContent = "";
  }
  const payload = readKnowledgeCardForm();
  const name = extractKnowledgeName(payload);
  if (!name) {
    if (knowledgeCardStatus) {
      knowledgeCardStatus.textContent = "请填写知识点名称";
    }
    return;
  }
  insertKnowledgeCardIntoEditor(payload, { replaceNode: knowledgeCardModalState.editingNode });
  closeKnowledgeCardModal();
}

// 获取编辑器当前选中 HTML/纯文本，用于预填知识卡或匹配。
function getEditorSelectionContent() {
  if (!adminTheoryLessonEditor || !adminTheoryLessonEditor.root) {
    return null;
  }
  const selection = window.getSelection && window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!adminTheoryLessonEditor.root.contains(range.commonAncestorContainer)) {
    return null;
  }
  const clone = range.cloneContents();
  const wrapper = document.createElement("div");
  wrapper.appendChild(clone);
  const html = wrapper.innerHTML.trim();
  const text = (wrapper.textContent || "").replace(/\s+/g, " ").trim();
  if (!html) {
    return null;
  }
  return { html, text };
}

// 从用户选中内容快速打开知识卡弹窗，并用选中文本填充摘要/正文。
function openKnowledgeCardFromSelection() {
  const selection = getEditorSelectionContent();
  if (!selection) {
    openKnowledgeCardModal();
    return;
  }
  const summary = selection.text ? summarizePreviewText(selection.text, 140) : "";
  const payload = {
    bodyHtml: selection.html,
    summary,
  };
  openKnowledgeCardModal(payload);
  if (knowledgeCardStatus) {
    knowledgeCardStatus.textContent = "已用选中文本预填知识点正文，可选择或新建知识点。";
  }
}

// 计算当前选中区域在视口中的位置，为展示浮动操作气泡。
function getSelectionRectWithinEditor() {
  if (!adminTheoryLessonEditor || !adminTheoryLessonEditor.root) {
    return null;
  }
  const selection = window.getSelection && window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  if (!adminTheoryLessonEditor.root.contains(range.commonAncestorContainer)) {
    return null;
  }
  let rect = range.getBoundingClientRect();
  if ((!rect || (rect.width === 0 && rect.height === 0)) && range.getClientRects) {
    const rects = range.getClientRects();
    rect = rects && rects[0] ? rects[0] : rect;
  }
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return null;
  }
  return rect;
}

// 归一化文本以便匹配（去除标签、压缩空格、转小写）。
function normalizeMatchText(value) {
  return (value || "")
    .toString()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// 将选中文本切分成关键词列表，用于启发式匹配。
function extractMatchTokens(selectionText) {
  const normalized = normalizeMatchText(selectionText);
  if (!normalized) {
    return [];
  }
  const raw = normalized.split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/);
  const filtered = raw.map((t) => t.trim()).filter((t) => t.length > 1);
  return Array.from(new Set(filtered)).slice(0, 30);
}

// 判断是否用选中的长文本覆盖知识卡正文（用于智能匹配回填）。
function shouldOverrideBodyWithSelection(payloadBody, payloadSummary, selection) {
  const selectionText = selection ? normalizeMatchText(selection.html || selection.text || "") : "";
  if (!selectionText || selectionText.length < 6) {
    return false;
  }
  const bodyText = normalizeMatchText(payloadBody || "");
  const summaryText = normalizeMatchText(payloadSummary || "");
  // 如果正文为空/过短/与摘要相同，且选中文本更长，则用选中文本覆盖。
  const isBodyMissing = !bodyText || bodyText.length < 12;
  const isBodySameAsSummary = bodyText && summaryText && bodyText === summaryText;
  const selectionMuchLonger = selectionText.length > bodyText.length + 16;
  return isBodyMissing || isBodySameAsSummary || selectionMuchLonger;
}

// 如果匹配结果正文缺失，则从选中文本中补齐正文/摘要。
function ensureBodyFromSelection(payload, selection) {
  if (!selection || !payload) {
    return payload;
  }
  if (shouldOverrideBodyWithSelection(payload.bodyHtml, payload.summary, selection)) {
    payload.bodyHtml = selection.html || selection.text || payload.bodyHtml;
  }
  if (!payload.summary) {
    payload.summary = summarizePreviewText(selection.text || selection.html || "", 120);
  }
  return payload;
}

// 组装当前选中理论课的上下文（课程/主题/章节），便于后端匹配引用。
function getLessonContextPayload() {
  if (!state.admin || !state.admin.theory || !state.admin.theory.selectedLessonId) {
    return null;
  }
  const ctx = typeof findAdminTheoryLesson === "function" ? findAdminTheoryLesson(state.admin.theory.selectedLessonId) : null;
  if (!ctx || !ctx.lesson) {
    return null;
  }
  return {
    lessonId: ctx.lesson.id || "",
    lessonTitle: ctx.lesson.title || ctx.lesson.name || "",
    topicTitle: ctx.topic && (ctx.topic.title || ctx.topic.name) ? ctx.topic.title || ctx.topic.name : "",
    chapterTitle: ctx.chapter && (ctx.chapter.title || ctx.chapter.displayTitle) ? ctx.chapter.title || ctx.chapter.displayTitle : "",
  };
}

// 根据简单打分规则对知识点进行本地预筛选，辅助匹配失败时展示调试信息。
function computeHeuristicKnowledgeScores(selectionText, knowledgeList, { topK = 6 } = {}) {
  const tokens = extractMatchTokens(selectionText);
  const selectionNormalized = normalizeMatchText(selectionText);
  const scored = (knowledgeList || [])
    .map((item) => {
      const name = item.name || "";
      const summary = item.summary || "";
      const body = item.bodyHtml || item.content || item.body || item.contentHtml || "";
      const nameNorm = normalizeMatchText(name);
      const summaryNorm = normalizeMatchText(summary);
      const bodyNorm = normalizeMatchText(body);
      let nameScore = 0;
      let summaryScore = 0;
      let bodyScore = 0;
      if (selectionNormalized && nameNorm.includes(selectionNormalized)) {
        nameScore += 3;
      }
      if (selectionNormalized && summaryNorm.includes(selectionNormalized)) {
        summaryScore += 2;
      }
      if (selectionNormalized && bodyNorm.includes(selectionNormalized)) {
        bodyScore += 1.5;
      }
      const matchedTokens = [];
      tokens.forEach((tok) => {
        if (!tok) return;
        let hit = false;
        if (nameNorm.includes(tok)) {
          nameScore += 0.6;
          hit = true;
        }
        if (summaryNorm.includes(tok)) {
          summaryScore += 0.4;
          hit = true;
        }
        if (bodyNorm.includes(tok)) {
          bodyScore += 0.3;
          hit = true;
        }
        if (hit) {
          matchedTokens.push(tok);
        }
      });
      const totalScore = nameScore + summaryScore + bodyScore;
      return {
        name,
        summaryPreview: summarizePreviewText(summary || body || "", 80),
        totalScore,
        nameScore,
        summaryScore,
        bodyScore,
        matchedTokens: Array.from(new Set(matchedTokens)),
      };
    })
    .filter((item) => item && item.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, topK);
  return { tokens, scored };
}

// 将匹配调试信息（本地启发式 + 后端返回）渲染到调试区域。
function renderKnowledgeMatchDebug({ selection, heuristics, backend, label = "知识点匹配调试" } = {}) {
  if (!adminTheoryMatchDebug) {
    return;
  }
  const lines = [];
  lines.push(`[${label}] 自动匹配未返回结果，展示调试信息方便排查。`);
  if (selection && selection.text) {
    lines.push(`选中文本: ${summarizePreviewText(selection.text, 180)}`);
  }
  if (heuristics && Array.isArray(heuristics.tokens) && heuristics.tokens.length > 0) {
    lines.push(`候选词: ${heuristics.tokens.join(", ")}`);
  }
  if (heuristics && Array.isArray(heuristics.scored) && heuristics.scored.length > 0) {
    lines.push("启发式预筛选 (name/summary/body 分值):");
    heuristics.scored.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. ${item.name || "(未命名)"} | 总分 ${item.totalScore.toFixed(2)} = name ${
          item.nameScore.toFixed ? item.nameScore.toFixed(2) : item.nameScore
        } + summary ${item.summaryScore.toFixed ? item.summaryScore.toFixed(2) : item.summaryScore} + body ${
          item.bodyScore.toFixed ? item.bodyScore.toFixed(2) : item.bodyScore
        }`
      );
      if (item.summaryPreview) {
        lines.push(`    摘要: ${item.summaryPreview}`);
      }
      if (item.matchedTokens && item.matchedTokens.length > 0) {
        lines.push(`    命中文本片段: ${item.matchedTokens.join(", ")}`);
      }
    });
  } else {
    lines.push("启发式预筛选：暂无得分，可能知识索引为空或文本过短。");
  }
  if (backend) {
    const backendConfidence =
      backend.confidence !== undefined && backend.confidence !== null
        ? Number(backend.confidence).toFixed(3)
        : "N/A";
    const backendName =
      backend.match && backend.match.name
        ? backend.match.name
        : backend.match && backend.match.name === ""
        ? "(空字符串)"
        : backend.match && backend.match.title
        ? backend.match.title
        : "(未返回名称)";
    lines.push(
      `Deepseek/后端返回: source=${backend.source || "-"} confidence=${backendConfidence} match=${backendName}`
    );
    if (backend.reason) {
      lines.push(`LLM/Deepseek reason: ${backend.reason}`);
    }
    if (Array.isArray(backend.context) && backend.context.length > 0) {
      lines.push("上下文/候选片段 (来自 RAG/context)：");
      backend.context.slice(0, 4).forEach((ctx, index) => {
        const score = ctx && typeof ctx.score === "number" ? ctx.score.toFixed(3) : "N/A";
        const preview = summarizePreviewText((ctx && ctx.text) || "", 120);
        lines.push(`  #${index + 1} ${ctx && ctx.name ? ctx.name : "(未知)"} | score=${score} | ${preview}`);
      });
    }
  }
  adminTheoryMatchDebug.textContent = lines.join("\n");
  adminTheoryMatchDebug.classList.remove("hidden");
}

// 清空调试区域并隐藏。
function clearKnowledgeMatchDebug() {
  if (!adminTheoryMatchDebug) {
    return;
  }
  adminTheoryMatchDebug.textContent = "";
  adminTheoryMatchDebug.classList.add("hidden");
}

let knowledgeBubbleEl = null;

// 隐藏选中文本旁的快捷操作气泡。
function hideKnowledgeSelectionBubble() {
  if (knowledgeBubbleEl) {
    knowledgeBubbleEl.remove();
    knowledgeBubbleEl = null;
  }
}

// 点击气泡后尝试自动匹配知识点，若失败则回退到手动弹窗。
async function handleBubbleMatchClick() {
  const selection = getEditorSelectionContent();
  if (!selection) {
    hideKnowledgeSelectionBubble();
    openKnowledgeCardModal();
    return;
  }
  hideKnowledgeSelectionBubble();
  clearKnowledgeMatchDebug();
  updateInlineStatus(adminTheoryLessonStatus, "正在匹配知识点...", "muted");
  const knowledgeList =
    state.admin && state.admin.graph && Array.isArray(state.admin.graph.knowledgePoints)
      ? state.admin.graph.knowledgePoints
      : [];
  const heuristics = computeHeuristicKnowledgeScores(selection.text, knowledgeList);
  let backendDebug = null;
  try {
    const candidateNames = knowledgeList.map((k) => k.name).filter(Boolean);
    const response = await fetchWithAuth("/api/ai/knowledge-points/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionText: selection.text,
        selectionHtml: selection.html,
        lessonId: state.admin && state.admin.theory ? state.admin.theory.selectedLessonId : "",
        candidateNames,
        lessonContext: getLessonContextPayload(),
      }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || "匹配失败");
    }
    const data = await response.json();
    backendDebug = {
      source: data.source,
      confidence: data.confidence,
      reason: data.reason,
      match: data.match,
      context: data.context,
    };
    const match = data.match || {};
    const confidence = data.confidence || 0;
    const payload = {
      name: match.name || "",
      summary: match.summary || "",
      tags: match.tags || [],
      bodyHtml: match.bodyHtml || match.content || selection.html,
      imageUrl: match.imageUrl || "",
      knowledgeId: match.knowledgeId || match.sourceId || "",
    };
    ensureBodyFromSelection(payload, selection);
    if (!payload.name) {
      renderKnowledgeMatchDebug({
        selection,
        heuristics,
        backend: backendDebug,
        label: "关键知识点匹配",
      });
      throw new Error("未匹配到知识点");
    }
    clearKnowledgeMatchDebug();
    insertKnowledgeCardIntoEditor(payload);
    if (adminTheoryLessonStatus) {
      adminTheoryLessonStatus.textContent = `已关联到知识点「${payload.name}」(score ${confidence.toFixed(2)})`;
    }
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryLessonStatus, error.message || "匹配失败", "error");
    renderKnowledgeMatchDebug({
      selection,
      heuristics,
      backend: backendDebug,
      label: "关键知识点匹配",
    });
    // 退回手动弹窗
    openKnowledgeCardModal({
      bodyHtml: selection ? selection.html : "",
      summary: selection ? summarizePreviewText(selection.text || "", 140) : "",
    });
  }
}

// 在选中文本附近展示“关联知识点”的悬浮按钮。
function showKnowledgeSelectionBubble() {
  hideKnowledgeSelectionBubble();
  const rect = getSelectionRectWithinEditor();
  if (!rect) return;
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.textContent = "一键关联知识点";
  bubble.className =
    "knowledge-select-bubble";
  bubble.style.position = "fixed";
  bubble.style.zIndex = "9999";
  bubble.style.borderRadius = "9999px";
  bubble.style.background = "#10b981";
  bubble.style.color = "#fff";
  bubble.style.padding = "6px 10px";
  bubble.style.fontSize = "12px";
  bubble.style.boxShadow = "0 6px 16px rgba(16,185,129,0.35)";
  bubble.style.border = "none";
  bubble.style.cursor = "pointer";
  bubble.style.transition = "opacity 0.15s ease";
  const top = rect.top + window.scrollY - 36;
  const left = rect.left + window.scrollX + rect.width / 2 - 60;
  bubble.style.top = `${Math.max(0, top)}px`;
  bubble.style.left = `${Math.max(0, left)}px`;
  bubble.addEventListener("click", handleBubbleMatchClick);
  document.body.appendChild(bubble);
  knowledgeBubbleEl = bubble;
}

// 监听编辑器内的选区变化/滚动，决定是否展示或隐藏气泡。
function bindKnowledgeSelectionWatcher() {
  if (!adminTheoryLessonEditor || !adminTheoryLessonEditor.root) return;
  const root = adminTheoryLessonEditor.root;
  const handler = () => {
    const selection = getEditorSelectionContent();
    if (selection && selection.text && selection.text.length >= 1) {
      showKnowledgeSelectionBubble();
    } else {
      hideKnowledgeSelectionBubble();
    }
  };
  root.addEventListener("mouseup", handler);
  root.addEventListener("keyup", handler);
  root.addEventListener("mouseleave", hideKnowledgeSelectionBubble);
  document.addEventListener("scroll", hideKnowledgeSelectionBubble, true);
  // 兜底：当用户点击编辑器外时隐藏
  document.addEventListener("mousedown", (event) => {
    if (!root.contains(event.target) && knowledgeBubbleEl) {
      hideKnowledgeSelectionBubble();
    }
  });
}

// 显式触发自动匹配（若无选区则直接打开弹窗）。
function triggerAutoKnowledgeMatch() {
  const selection = getEditorSelectionContent();
  if (selection && selection.text && selection.text.length > 0) {
    handleBubbleMatchClick();
  } else {
    openKnowledgeCardModal();
  }
}

// 使用 RAG Beta 接口进行知识点匹配，优先展示后端推理结果。
async function triggerRagMatchBeta() {
  const selection = getEditorSelectionContent();
  if (!selection || !selection.text) {
    openKnowledgeCardModal();
    return;
  }
  clearKnowledgeMatchDebug();
  updateInlineStatus(adminTheoryLessonStatus, "RAG(Beta) 正在匹配知识点...", "muted");
  const knowledgeList =
    state.admin && state.admin.graph && Array.isArray(state.admin.graph.knowledgePoints)
      ? state.admin.graph.knowledgePoints
      : [];
  const heuristics = computeHeuristicKnowledgeScores(selection.text, knowledgeList);
  let backendDebug = null;
  try {
    const candidateNames = knowledgeList.map((k) => k.name).filter(Boolean);
    const response = await fetchWithAuth("/api/ai/knowledge-points/match-rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectionText: selection.text,
        selectionHtml: selection.html,
        candidateNames,
        lessonContext: getLessonContextPayload(),
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "RAG 匹配失败");
    }
    const data = await response.json();
    backendDebug = {
      source: data.source || "rag-beta",
      confidence: data.confidence,
      reason: data.reason,
      match: data.match,
      context: data.context,
    };
    const match = data.match || {};
    if (!match.name) {
      renderKnowledgeMatchDebug({
        selection,
        heuristics,
        backend: backendDebug,
        label: "RAG 智能匹配",
      });
      throw new Error("未匹配到知识点");
    }
    const payload = {
      name: match.name,
      summary: match.summary || "",
      tags: match.tags || [],
      bodyHtml: match.bodyHtml || match.content || selection.html,
      imageUrl: match.imageUrl || "",
      knowledgeId: match.knowledgeId || match.sourceId || "",
    };
    ensureBodyFromSelection(payload, selection);
    clearKnowledgeMatchDebug();
    insertKnowledgeCardIntoEditor(payload);
    updateInlineStatus(
      adminTheoryLessonStatus,
      `RAG(Beta) 已关联到知识点「${payload.name}」`,
      "success"
    );
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryLessonStatus, error.message || "匹配失败", "error");
    renderKnowledgeMatchDebug({
      selection,
      heuristics,
      backend: backendDebug,
      label: "RAG 智能匹配",
    });
    openKnowledgeCardModal({
      bodyHtml: selection.html,
      summary: summarizePreviewText(selection.text || "", 140),
    });
  }
}

// 处理导入 DOCX 生成知识点草稿的上传逻辑，并展示生成进度。
async function handleAutoBuildGraphUpload() {
  if (!autoBuildGraphInput || autoBuildGraphInput.files.length === 0) {
    return;
  }
  const file = autoBuildGraphInput.files[0];
  const formData = new FormData();
  formData.append("file", file);
  if (autoBuildGraphDraftList) {
    autoBuildGraphDraftList.innerHTML = '<p class="text-xs text-slate-500">正在生成知识点草稿...</p>';
  }
  try {
    const resp = await fetchWithAuth("/api/admin/theory/import-docx/drafts", {
      method: "POST",
      body: formData,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "生成失败");
    }
    const data = await resp.json();
    const drafts = data.drafts || [];
    renderAutoBuildDrafts(drafts);
  } catch (error) {
    console.error(error);
    if (autoBuildGraphDraftList) {
      autoBuildGraphDraftList.innerHTML = `<p class="text-xs text-rose-500">${error.message || "生成失败"}</p>`;
    }
  } finally {
    if (autoBuildGraphInput) {
      autoBuildGraphInput.value = "";
    }
  }
}

// 批量审核并写入通过的草稿知识点。
async function approveAutoBuildDrafts(selectedIds) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return;
  }
  try {
    const resp = await fetchWithAuth(`/api/admin/theory/drafts/${autoBuildGraphDraftList.dataset.batchId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || "审核失败");
    }
    const data = await resp.json();
    if (autoBuildGraphDraftList) {
      autoBuildGraphDraftList.innerHTML += `<p class="text-xs text-emerald-500 mt-2">已创建 ${data.count} 条知识点。</p>`;
    }
  } catch (error) {
    console.error(error);
    if (autoBuildGraphDraftList) {
      autoBuildGraphDraftList.innerHTML += `<p class="text-xs text-rose-500 mt-2">${error.message || "审核失败"}</p>`;
    }
  }
}

// 渲染 AI 自动生成的知识点草稿列表，并附带批量通过按钮。
function renderAutoBuildDrafts(drafts) {
  if (!autoBuildGraphDraftList) return;
  if (!drafts || drafts.length === 0) {
    autoBuildGraphDraftList.innerHTML = '<p class="text-xs text-slate-500">暂无草稿</p>';
    return;
  }
  autoBuildGraphDraftList.dataset.batchId = drafts[0].job_id || drafts[0].batchId || "";
  const container = document.createElement("div");
  container.className = "space-y-2";
  drafts.forEach((draft) => {
    const card = document.createElement("div");
    card.className = "rounded-lg border border-slate-200 bg-white p-3 shadow-sm";
    card.innerHTML = `
      <label class="flex items-start gap-3 text-sm text-slate-800">
        <input type="checkbox" class="mt-1" value="${draft.id}">
        <div class="space-y-1">
          <p class="font-semibold">${draft.name || "未命名知识点"}</p>
          <p class="text-xs text-slate-500">${draft.summary || "（无摘要）"}</p>
        </div>
      </label>
    `;
    container.appendChild(card);
  });
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className =
    "rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-400";
  btn.textContent = "✅ 批量通过并写入图谱";
  btn.addEventListener("click", () => {
    const checks = autoBuildGraphDraftList.querySelectorAll("input[type='checkbox']:checked");
    const ids = Array.from(checks).map((c) => c.value);
    approveAutoBuildDrafts(ids);
  });
  autoBuildGraphDraftList.innerHTML = "";
  autoBuildGraphDraftList.appendChild(container);
  autoBuildGraphDraftList.appendChild(btn);
}

// 渲染学生列表，支持选中态高亮与“查看”按钮。
function getAdminTotalSections() {
  if (state.admin && state.admin.totalSections) {
    return state.admin.totalSections;
  }
  const chapters = state.admin && Array.isArray(state.admin.levels) ? state.admin.levels : [];
  return chapters.reduce((sum, chapter) => sum + (Array.isArray(chapter.sections) ? chapter.sections.length : 0), 0);
}

function deriveStudentStatus(lastActive) {
  if (!lastActive) {
    return { label: "未上线", tone: "warn", detail: "暂无活跃时间" };
  }
  const parsed = new Date(lastActive);
  if (Number.isNaN(parsed.getTime())) {
    return { label: "未上线", tone: "warn", detail: lastActive };
  }
  const diffHours = (Date.now() - parsed.getTime()) / 3600000;
  if (diffHours <= 24) {
    return { label: "当天在线", tone: "good", detail: "最近 24 小时活跃" };
  }
  if (diffHours <= 72) {
    return { label: `离线 ${Math.round(diffHours / 24)} 天`, tone: "warn", detail: "建议提醒上线" };
  }
  return { label: `离线 ${Math.round(diffHours / 24)} 天`, tone: "bad", detail: "长时间未活跃" };
}

function getProgressColor(percent) {
  if (percent >= 80) {
    return "linear-gradient(90deg, #22c55e, #16a34a)";
  }
  if (percent >= 50) {
    return "linear-gradient(90deg, #22d3ee, #38bdf8)";
  }
  return "linear-gradient(90deg, #f97316, #ef4444)";
}

function decorateAdminStudent(student) {
  const totalSections = Math.max(0, getAdminTotalSections());
  const completed = Number(student.sectionCompleted || student.sessionCount || 0);
  const progress = totalSections > 0 ? Math.min(100, Math.round((completed / totalSections) * 100)) : Math.min(100, completed * 10);
  const avgScore = typeof student.averageScore === "number" ? student.averageScore : null;
  const latestScore = typeof student.latestScore === "number" ? student.latestScore : null;
  const status = deriveStudentStatus(student.lastActive);
  const baseName = student.displayName || student.username || "学生";
  const initials = baseName.slice(0, 2).toUpperCase();
  return {
    ...student,
    progress,
    status,
    initials,
    scoreValue: latestScore !== null ? latestScore : avgScore,
    avgScore,
    attention: avgScore !== null && avgScore < 65,
  };
}

function applyStudentFilters(students) {
  const filters = state.admin.studentFilters || { search: "", filter: "all", sort: "progress" };
  const search = (filters.search || "").toLowerCase();
  let list = students;
  if (search) {
    list = list.filter((student) => {
      const name = (student.displayName || student.username || "").toLowerCase();
      return name.includes(search);
    });
  }
  if (filters.filter === "attention") {
    list = list.filter((student) => student.attention);
  } else if (filters.filter === "active") {
    list = list.filter((student) => student.status && student.status.tone === "good");
  }

  list.sort((a, b) => {
    if (filters.sort === "score") {
      return (b.scoreValue || -Infinity) - (a.scoreValue || -Infinity);
    }
    if (filters.sort === "activity") {
      const timeA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
      const timeB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
      return timeB - timeA;
    }
    if (filters.sort === "name") {
      return (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "");
    }
    // 默认按进度
    return (b.progress || 0) - (a.progress || 0);
  });
  return list;
}

function updateAdminKpis(students) {
  const total = students.length;
  const avgProgress = total ? Math.round(students.reduce((sum, s) => sum + (s.progress || 0), 0) / total) : 0;
  const attentionCount = students.filter((s) => s.attention).length;
  if (adminKpiTotal) adminKpiTotal.textContent = `${total}`;
  if (adminKpiProgress) adminKpiProgress.textContent = `${avgProgress}%`;
  if (adminKpiAttention) adminKpiAttention.textContent = `${attentionCount} 人`;
}

function renderAdminStudentList() {
  adminStudentList.innerHTML = "";
  const decorated = (state.admin.students || []).map(decorateAdminStudent);
  updateAdminKpis(decorated);
  const students = applyStudentFilters(decorated);
  if (adminStudentTableEmpty) {
    adminStudentTableEmpty.classList.toggle("hidden", students.length > 0);
  }
  if (!students || students.length === 0) {
    return;
  }

  students.forEach((student) => {
    const tr = document.createElement("tr");
    const isActive = state.admin.selectedStudentId === student.id;
    tr.className = `admin-student-row ${isActive ? "active" : ""}`;
    const progressColor = getProgressColor(student.progress || 0);
    const scoreLabel = student.scoreValue !== null && student.scoreValue !== undefined
      ? `${Math.round(student.scoreValue)} 分`
      : "未评分";
    const displayName = escapeHtmlText(student.displayName || student.username || "学生");
    const metaLine = escapeHtmlText(`会话 ${student.sessionCount || 0} ｜ 评估 ${student.evaluationCount || 0}`);

    tr.innerHTML = `
      <td>
        <div class="flex items-center gap-3">
          <div class="admin-table-avatar">${student.initials}</div>
          <div>
            <div class="admin-student-name">${displayName}</div>
            <p class="admin-student-meta">${metaLine}</p>
          </div>
        </div>
      </td>
      <td>
        <span class="status-pill" data-tone="${student.status.tone}">${student.status.label}</span>
        <p class="mt-1 text-[11px] text-slate-500">${student.status.detail}</p>
      </td>
      <td>
        <div class="flex items-center gap-3">
          <div class="progress-rail">
            <div class="progress-fill" style="width: ${student.progress || 0}%; background: ${progressColor};"></div>
          </div>
          <span class="progress-badge">${student.progress || 0}%</span>
        </div>
      </td>
      <td>
        <div class="score-chip">${scoreLabel}</div>
        ${student.avgScore !== null && student.avgScore !== undefined ? `<p class="mt-1 text-[11px] text-slate-400">均分 ${Math.round(student.avgScore)} 分</p>` : ""}
      </td>
      <td class="text-right">
        <button class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-emerald-500 hover:text-white" data-student-id="${student.id}">👁 查看</button>
      </td>
    `;
    adminStudentList.appendChild(tr);
  });
}

// 展示指定学生的元信息与会话列表；为空则清空右侧区域。
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

  const summarySource = (state.admin.students || []).find((item) => item.id === detail.id) || detail;
  const decorated = decorateAdminStudent(summarySource);
  const safeName = escapeHtmlText(detail.displayName || detail.username || "学生");
  const createdAt = escapeHtmlText(detail.createdAt || "-");
  adminStudentMeta.innerHTML = `
    <p class="text-sm text-slate-200">学生 ${safeName}</p>
    <p class="text-xs text-slate-400">注册时间：${createdAt}</p>
    <p class="text-xs text-emerald-200">进度 ${decorated.progress || 0}% ｜ 均分 ${decorated.avgScore !== null && decorated.avgScore !== undefined ? Math.round(decorated.avgScore) : "未评分"}</p>
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

// 展示会话详情，包括情景设定、对话记录与评估信息。
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

// 将多行文本拆分为行数组并去除空行。
function splitLines(value) {
  return (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line);
}

// 将字符串数组合并为以换行分隔的文本。
function joinLines(list) {
  return Array.isArray(list) ? list.join("\n") : "";
}

// 从文本域读取知识点列表（逐行存储）。
function readKnowledgeFromTextarea(element) {
  if (!element) {
    return [];
  }
  return splitLines(element.value);
}

// 将知识点数组写回文本域，自动按行格式化。
function writeKnowledgeToTextarea(element, points) {
  if (!element) {
    return;
  }
  const names = Array.isArray(points)
    ? points
        .map((point) => extractKnowledgeName(point))
        .filter((name) => name && name.trim())
    : [];
  element.value = joinLines(names);
}

// 清空或删除指定关卡的知识点缓存。
function clearPracticeKnowledgeCache(targetIds = null) {
  const cache = state.admin.graph && state.admin.graph.practiceKnowledge;
  if (!cache || typeof cache !== "object") {
    return;
  }
  if (targetIds === null || targetIds === undefined) {
    if (typeof cache.clear === "function") {
      cache.clear();
    }
    return;
  }
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  ids
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id)
    .forEach((id) => {
      if (typeof cache.delete === "function") {
        cache.delete(id);
      }
    });
}

// 清空或删除指定理论课的知识点缓存。
function clearLessonKnowledgeCache(targetIds = null) {
  const cache = state.admin.graph && state.admin.graph.lessonKnowledge;
  if (!cache || typeof cache !== "object") {
    return;
  }
  if (targetIds === null || targetIds === undefined) {
    if (typeof cache.clear === "function") {
      cache.clear();
    }
    return;
  }
  const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
  ids
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id)
    .forEach((id) => {
      if (typeof cache.delete === "function") {
        cache.delete(id);
      }
    });
}

// 读取关卡关联的知识点，带缓存且可强制刷新。
async function fetchPracticeKnowledge(practiceId, { forceRefresh = false } = {}) {
  if (!practiceId || !state.auth.user || state.auth.user.role !== "teacher") {
    return [];
  }
  const cache = state.admin.graph.practiceKnowledge;
  if (!forceRefresh && cache && cache.has(practiceId)) {
    return cache.get(practiceId) || [];
  }
  try {
    const response = await fetchWithAuth(`/api/graph/practices/${practiceId}`);
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载关卡知识点");
    }
    const data = await response.json();
    const knowledge = (data.practice && data.practice.knowledgePoints) || [];
    if (cache && cache.set) {
      cache.set(practiceId, knowledge);
    }
    return knowledge;
  } catch (error) {
    console.warn(error);
    return cache && cache.get ? cache.get(practiceId) || [] : [];
  }
}

// 将编辑后的知识点列表提交到后端并更新缓存。
async function persistPracticeKnowledge(practiceId, knowledgePoints) {
  if (!practiceId || !state.auth.user || state.auth.user.role !== "teacher") {
    return [];
  }
  try {
    const response = await fetchWithAuth(`/api/graph/practices/${practiceId}/knowledge`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgePoints }),
    });
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新关卡知识点失败");
    }
    const data = await response.json();
    const updated = (data.practice && data.practice.knowledgePoints) || knowledgePoints;
    const cache = state.admin.graph.practiceKnowledge;
    if (cache && cache.set) {
      cache.set(practiceId, updated);
    }
    return updated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 读取理论课程的知识点，按需刷新缓存。
async function fetchLessonKnowledge(lessonId, { forceRefresh = false } = {}) {
  if (!lessonId || !state.auth.user || state.auth.user.role !== "teacher") {
    return [];
  }
  const cache = state.admin.graph.lessonKnowledge;
  if (!forceRefresh && cache && cache.has(lessonId)) {
    return cache.get(lessonId) || [];
  }
  try {
    const response = await fetchWithAuth(`/api/graph/theory-lessons/${lessonId}`);
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载理论知识点");
    }
    const data = await response.json();
    const knowledge = normalizeKnowledgePayloadList((data.lesson && data.lesson.knowledgePoints) || []);
    if (cache && cache.set) {
      cache.set(lessonId, knowledge);
    }
    return knowledge;
  } catch (error) {
    console.warn(error);
    return cache && cache.get ? cache.get(lessonId) || [] : [];
  }
}

// 更新理论课程的知识点列表并写入缓存。
async function persistLessonKnowledge(lessonId, knowledgePoints) {
  if (!lessonId || !state.auth.user || state.auth.user.role !== "teacher") {
    return [];
  }
  try {
    const normalizedPayloads = normalizeKnowledgePayloadList(knowledgePoints);
    const response = await fetchWithAuth(`/api/graph/theory-lessons/${lessonId}/knowledge`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ knowledgePoints: normalizedPayloads }),
    });
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "更新理论知识点失败");
    }
    const data = await response.json();
    const updated = normalizeKnowledgePayloadList(
      (data.lesson && data.lesson.knowledgePoints) || normalizedPayloads,
    );
    const cache = state.admin.graph.lessonKnowledge;
    if (cache && cache.set) {
      cache.set(lessonId, updated);
    }
    return updated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

// 将后台缓存的关卡知识点填充到表单文本域。
async function hydrateSectionKnowledge(sectionId) {
  if (!sectionEditorKnowledge) {
    return;
  }
  if (!sectionId) {
    writeKnowledgeToTextarea(sectionEditorKnowledge, []);
    return;
  }
  const knowledge = await fetchPracticeKnowledge(sectionId);
  if (state.admin.selectedEditorSectionId !== sectionId) {
    return;
  }
  writeKnowledgeToTextarea(sectionEditorKnowledge, knowledge);
}

// 将后台缓存的理论课知识点填充到表单，并刷新已插入的卡片。
async function hydrateLessonKnowledge(lessonId) {
  if (!adminTheoryLessonKnowledge) {
    return;
  }
  if (!lessonId) {
    writeKnowledgeToTextarea(adminTheoryLessonKnowledge, []);
    return;
  }
  const knowledge = await fetchLessonKnowledge(lessonId);
  if (state.admin.theory.selectedLessonId !== lessonId) {
    return;
  }
  writeKnowledgeToTextarea(adminTheoryLessonKnowledge, knowledge);
  refreshKnowledgeCardNodesFromPayloads(knowledge);
}

// 将节点 key 解析为 {label, id} 结构，便于后续匹配。
function describeGraphNodeKey(key) {
  if (typeof key !== "string") {
    return { label: "", id: "" };
  }
  const [label, ...rest] = key.split(":");
  return { label: label || "", id: rest.join(":") };
}

// 渲染后台左侧“知识点分层列表”，按 Stage 分组展示节点。
function renderAdminGraphKnowledgeList() {
  if (!adminGraphKnowledgeList) {
    return;
  }
  const network = state.admin.graph.network || { nodes: [] };
  const nodes = Array.isArray(network.nodes) ? network.nodes : [];
  const stages = nodes.filter((n) => n.label === "Stage");
  const points = nodes.filter((n) =>
    ["KnowledgePoint", "Skill", "Terminology"].includes(n.label)
  );
  const stageMap = {};
  stages.forEach((s) => {
    stageMap[s.title] = { stage: s, points: [] };
  });
  points.forEach((p) => {
    const stageName = p.stage || p.stageName;
    if (stageName && stageMap[stageName]) {
      stageMap[stageName].points.push(p);
    }
  });
  const stageList = Object.values(stageMap).sort((a, b) => (a.stage.order || 0) - (b.stage.order || 0));
  adminGraphKnowledgeList.innerHTML = "";
  if (stageList.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500";
    empty.textContent = "暂无知识点数据或图谱尚未初始化。";
    adminGraphKnowledgeList.appendChild(empty);
    return;
  }
  stageList.forEach(({ stage, points }) => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-800/70 bg-slate-950/60";
    const pointCount = points.length;
    const stageTitle = stage.title || stage.name;
    const listId = `stage-${stageTitle}-list`;
    li.innerHTML = `
      <button class="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-white">
        <span>${escapeHtmlText(stageTitle || "阶段")}</span>
        <span class="text-xs text-slate-400">${pointCount} 个知识点</span>
      </button>
      <div id="${listId}" class="space-y-2 px-3 pb-3 hidden"></div>
    `;
    adminGraphKnowledgeList.appendChild(li);
    const listEl = li.querySelector(`#${listId}`);
    const headerEl = li.querySelector("button");
    headerEl.addEventListener("click", () => {
      listEl.classList.toggle("hidden");
    });
    points
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
      .forEach((p) => {
        const item = document.createElement("div");
        item.className = "rounded-lg border border-slate-800/60 bg-slate-950/40 p-2 text-xs text-slate-200 cursor-pointer hover:border-emerald-400/60 flex items-center gap-2";

        const badge = document.createElement("span");
        badge.className = "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold";
        const nodeType = p.nodeType || p.label || "KnowledgePoint";
        const badgeMap = {
          Terminology: { label: "T", style: "bg-slate-200 text-slate-800" },
          Skill: { label: "S", style: "bg-cyan-200 text-cyan-900" },
          KnowledgePoint: { label: "K", style: "bg-amber-200 text-amber-900" },
        };
        const badgeMeta = badgeMap[nodeType] || badgeMap.KnowledgePoint;
        badge.textContent = badgeMeta.label;
        badge.className += ` ${badgeMeta.style}`;

        const title = document.createElement("span");
        title.textContent = p.title || p.key;

        item.appendChild(badge);
        item.appendChild(title);
        item.addEventListener("click", () => {
          handleGraphNodeSelection(p.key);
        });
        listEl.appendChild(item);
      });
  });
}

// 在侧边栏展示当前选中节点的标题/元数据。
function renderAdminGraphSelection(detail) {
  showGraphDetailDrawer(detail);
  if (!adminGraphSelection) {
    return;
  }
  adminGraphSelection.innerHTML = "";
  if (!detail) {
    adminGraphSelection.innerHTML = '<p class="text-xs text-slate-500">请选择节点以查看详细信息。</p>';
    return;
  }
  if (detail.title) {
    const titleEl = document.createElement("p");
    titleEl.className = "text-sm font-semibold text-white";
    titleEl.textContent = detail.title;
    adminGraphSelection.appendChild(titleEl);
  }
  if (detail.subtitle) {
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "text-xs text-slate-400";
    subtitleEl.textContent = detail.subtitle;
    adminGraphSelection.appendChild(subtitleEl);
  }
  const meta = Array.isArray(detail.meta) ? detail.meta.filter(Boolean) : [];
  if (meta.length > 0) {
    const list = document.createElement("ul");
    list.className = "mt-2 space-y-1 text-xs text-slate-400";
    meta.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    adminGraphSelection.appendChild(list);
  }
}

// 打开底部抽屉详情，展示知识点正文或表单编辑区域。
function showGraphDetailDrawer(detail) {
  const overlay = document.getElementById('graph-detail-overlay');
  const drawer = document.getElementById('graph-detail-drawer');
  if (!drawer || !overlay) return;
  if (!overlay._graphDrawerBound) {
    overlay._graphDrawerBound = true;
    overlay.addEventListener('click', hideGraphDetailDrawer);
  }
  document.getElementById('graph-detail-close')?.addEventListener('click', hideGraphDetailDrawer);
  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
  setTimeout(() => drawer.classList.remove('translate-y-full'), 10);
  document.getElementById('graph-detail-title').textContent = detail?.title || '知识点详情';
  document.getElementById('graph-detail-subtitle').textContent = detail?.subtitle || '';
  const metaEl = document.getElementById('graph-detail-meta');
  metaEl.innerHTML = '';
  (detail?.meta || []).forEach((line) => {
    const li = document.createElement('p');
    li.textContent = line;
    metaEl.appendChild(li);
  });
  const bodyEl = document.getElementById('graph-detail-body');
  if (!bodyEl) {
    return;
  }
  let textEl = bodyEl.querySelector('[data-graph-detail-text]');
  if (!textEl) {
    textEl = document.createElement('div');
    textEl.dataset.graphDetailText = 'true';
    textEl.className = 'space-y-2';
    bodyEl.prepend(textEl);
  }
  const formEl = document.getElementById('admin-graph-form');
  const showForm = detail?.kind === 'KnowledgePoint';

  if (formEl) {
    formEl.style.display = showForm ? 'block' : 'none';
  }
  applyGraphDrawerTheme(showForm ? 'light' : 'dark');
  if (textEl) {
    if (showForm) {
      textEl.classList.add('hidden');
      textEl.innerHTML = '';
    } else {
      textEl.classList.remove('hidden');
      textEl.innerHTML = detail?.body || '<p class="text-xs text-slate-400">暂无详细内容</p>';
    }
  }
}

// 关闭抽屉详情，并解绑遮罩点击事件。
function hideGraphDetailDrawer() {
  const overlay = document.getElementById('graph-detail-overlay');
  const drawer = document.getElementById('graph-detail-drawer');
  if (!drawer || !overlay) return;
  if (!overlay._graphDrawerBound) {
    overlay._graphDrawerBound = true;
    overlay.addEventListener('click', hideGraphDetailDrawer);
  }
  drawer.classList.add('translate-y-full');
  setTimeout(() => {
    drawer.classList.add('hidden');
    overlay.classList.add('hidden');
  }, 180);
}

// 加载关卡节点详情及其关联的理论课程，用于图谱点击展示。
async function loadPracticeGraphDetail(practiceId) {
  try {
    const response = await fetchWithAuth(`/api/graph/practices/${practiceId}/related-lessons`);
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载关卡关联数据");
    }
    const data = await response.json();
    const practice = data.practice || {};
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];
    return {
      title: practice.title || practice.id || "实战关卡",
      subtitle: practice.description || "",
      meta: [
        practice.chapterId ? `所属章节：${practice.chapterId}` : "",
        typeof practice.orderIndex === "number" ? `排序权重：${practice.orderIndex}` : "",
        practice.expectsBargaining ? "博弈回合：开启" : "",
      ],
      knowledge: normalizeKnowledgePayloadList(practice.knowledgePoints || []),
      relatedLessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title || lesson.id,
        code: lesson.code || "",
      })),
    };
  } catch (error) {
    console.error(error);
    return { title: "实战关卡", meta: [error.message || "加载失败"], knowledge: [] };
  }
}

// 加载理论课程节点详情及其关联的实战关卡。
async function loadLessonGraphDetail(lessonId) {
  try {
    const response = await fetchWithAuth(`/api/graph/theory-lessons/${lessonId}/related-practices`);
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载理论关联数据");
    }
    const data = await response.json();
    const lesson = data.lesson || {};
    const practices = Array.isArray(data.practices) ? data.practices : [];
    return {
      title: lesson.title || lesson.id || "理论课程",
      subtitle: lesson.code ? `课程编号：${lesson.code}` : "",
      meta: [lesson.topicId ? `所属主题：${lesson.topicId}` : ""],
      knowledge: normalizeKnowledgePayloadList(lesson.knowledgePoints || []),
      relatedPractices: practices.map((practice) => ({
        id: practice.id,
        title: practice.title || practice.id,
      })),
    };
  } catch (error) {
    console.error(error);
    return { title: "理论课程", meta: [error.message || "加载失败"], knowledge: [] };
  }
}

// 根据知识点名称构造简易详情（关联数量/摘要），用于列表点击展示。
function buildKnowledgePointDetail(name) {
  const record = Array.isArray(state.admin.graph.knowledgePoints)
    ? state.admin.graph.knowledgePoints.find((item) => item.name === name)
    : null;
  const practiceCount = record && typeof record.practiceCount === "number" ? record.practiceCount : 0;
  const lessonCount = record && typeof record.lessonCount === "number" ? record.lessonCount : 0;
  const summary = record && record.summary ? record.summary : "";
  return {
    title: name,
    subtitle: summary,
    meta: [`关联实战：${practiceCount}`, `关联理论：${lessonCount}`],
  };
}

// 根据章节 ID 构造详情摘要，包含章节标题与统计。
function buildChapterDetail(chapterId) {
  const chapter = findAdminChapter(chapterId);
  if (!chapter) {
    return { title: chapterId, meta: ["尚未在系统中维护详细信息"] };
  }
  const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
  return {
    title: chapter.title || chapterId,
    subtitle: chapter.description || "",
    meta: [`关卡数量：${sections.length}`],
    relatedPractices: sections.map((section) => ({ id: section.id, title: section.title })),
  };
}

// 构造流程节点详情（流程/阶段节点用 key=ProcessStep:xxx 存储）。
function buildProcessDetail(processId) {
  const node = (state.admin.graph.network && state.admin.graph.network.nodes || []).find(
    (item) => item.key === `ProcessStep:${processId}`,
  );
  return {
    title: (node && node.title) || processId,
    subtitle: node && node.subtitle ? node.subtitle : "",
  };
}

// 打开知识点编辑表单（底部抽屉），并在选择一致时填充后端数据。
async function openKnowledgePointEditor(name, selectionKey = null) {
  if (!name || typeof window === "undefined" || typeof window.showKnowledgeGraphForm !== "function") {
    return;
  }
  const statusFn = typeof showStatus === "function" ? showStatus : null;
  if (selectionKey && adminGraphSelectionKey !== selectionKey) {
    return;
  }
  try {
    if (statusFn) {
      statusFn("admin-graph-form-status", "加载中...", "info");
    }
    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}`);
    if (!response.ok) {
      throw new Error(`加载知识点失败: ${response.status}`);
    }
    const data = await response.json();
    if (selectionKey && adminGraphSelectionKey !== selectionKey) {
      return;
    }
    window.showKnowledgeGraphForm("edit", data);
    if (statusFn) {
      statusFn("admin-graph-form-status", "", "");
    }
  } catch (error) {
    console.error("[Graph] load knowledge point detail failed", error);
    if (statusFn) {
      statusFn("admin-graph-form-status", `加载失败: ${error.message}`, "error");
    }
  }
}

// 处理图谱点击事件：根据节点类型加载不同的详情或编辑表单。
async function handleGraphNodeSelection(nodeKey) {
  adminGraphSelectionKey = nodeKey;
  if (!nodeKey) {
    renderAdminGraphSelection(null);
    return;
  }
  renderAdminGraphSelection({ title: "加载中...", meta: [] });
  const { label, id } = describeGraphNodeKey(nodeKey);
  let detail = null;
  if (label === "Practice") {
    detail = await loadPracticeGraphDetail(id);
  } else if (label === "TheoryLesson") {
    detail = await loadLessonGraphDetail(id);
  } else if (["KnowledgePoint", "Skill", "Terminology"].includes(label)) {
    detail = buildKnowledgePointDetail(id);
  } else if (label === "Chapter") {
    detail = buildChapterDetail(id);
  } else if (label === "ProcessStep") {
    detail = buildProcessDetail(id);
  } else {
    detail = { title: nodeKey, meta: ["暂未提供详细信息"] };
  }
  detail.kind = label;
  detail.id = detail.id || id;
  if (adminGraphSelectionKey !== nodeKey) {
    return;
  }
  renderAdminGraphSelection(detail);
  if (["KnowledgePoint", "Skill", "Terminology"].includes(label)) {
    await openKnowledgePointEditor(id, nodeKey);
  }
}

// 注入浅色主题样式，供知识点编辑表单切换至“阅读模式”时使用。
function ensureGraphDrawerLightStyles() {
  if (document.getElementById('graph-drawer-light-style')) return;
  const style = document.createElement('style');
  style.id = 'graph-drawer-light-style';
  style.textContent = `
    #graph-detail-drawer.graph-drawer-light {
      background: radial-gradient(120% 120% at 15% 0%, rgba(18, 32, 52, 0.95), rgba(10, 20, 35, 0.9)) !important;
      color: #eaf4ff !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      backdrop-filter: blur(18px);
      box-shadow: 0 30px 70px -32px rgba(0, 0, 0, 0.6);
    }
    #graph-detail-drawer.graph-drawer-light h4,
    #graph-detail-drawer.graph-drawer-light p,
    #graph-detail-drawer.graph-drawer-light label,
    #graph-detail-drawer.graph-drawer-light span {
      color: #eaf4ff !important;
      letter-spacing: 0.04em;
    }
    #graph-detail-drawer.graph-drawer-light label {
      text-transform: uppercase;
      color: #c3d5e8 !important;
      font-weight: 600;
      font-size: 11px;
    }
    #graph-detail-drawer.graph-drawer-light input,
    #graph-detail-drawer.graph-drawer-light select,
    #graph-detail-drawer.graph-drawer-light textarea {
      background: rgba(255, 255, 255, 0.08) !important;
      color: #eaf4ff !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      transition: all 0.2s ease;
    }
    #graph-detail-drawer.graph-drawer-light input:focus,
    #graph-detail-drawer.graph-drawer-light select:focus,
    #graph-detail-drawer.graph-drawer-light textarea:focus {
      border-color: rgba(106, 196, 201, 0.7) !important;
      box-shadow: 0 0 0 2px rgba(106, 196, 201, 0.25);
      background: rgba(255, 255, 255, 0.12) !important;
      outline: none;
    }
    #graph-detail-drawer.graph-drawer-light .grid {
      gap: 14px;
    }
    #graph-detail-drawer.graph-drawer-light button {
      background: rgba(255, 255, 255, 0.06) !important;
      color: #e2e8f0 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 12px;
    }
    #graph-detail-drawer.graph-drawer-light .chip,
    #graph-detail-drawer.graph-drawer-light .tag,
    #graph-detail-drawer.graph-drawer-light .badge {
      background: rgba(106, 196, 201, 0.18) !important;
      color: #0f172a !important;
      border: 1px solid rgba(106, 196, 201, 0.35) !important;
    }
    #graph-detail-drawer.graph-drawer-light #admin-graph-form-submit {
      background: #6ac4c9 !important;
      color: #0f172a !important;
      border-color: #6ac4c9 !important;
      box-shadow: 0 0 20px -5px rgba(106, 196, 201, 0.5);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    #graph-detail-drawer.graph-drawer-light #admin-graph-form-status {
      color: #cbd5e1 !important;
    }
    #graph-detail-drawer.graph-drawer-light .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    #graph-detail-drawer.graph-drawer-light .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.12);
      border-radius: 10px;
    }
    #graph-detail-drawer.graph-drawer-light .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
  `;
  document.head.appendChild(style);
}

// 切换图谱详情抽屉的明暗主题。
function applyGraphDrawerTheme(mode) {
  const drawer = document.getElementById('graph-detail-drawer');
  if (!drawer) return;
  if (mode === 'light') {
    ensureGraphDrawerLightStyles();
    drawer.classList.add('graph-drawer-light');
  } else {
    drawer.classList.remove('graph-drawer-light');
    drawer.style.background = '';
    drawer.style.color = '';
  }
}

function getGraphEdgeSource(edge) {
  return edge?.source || edge?.from || "";
}

function getGraphEdgeTarget(edge) {
  return edge?.target || edge?.to || "";
}

function getGraphNodeId(node) {
  return node?.key || node?.id || node?.name || "";
}

function getGraphNodeTitle(node) {
  return node?.title || node?.name || node?.key || node?.id || "未命名";
}

function getGraphNodeType(node) {
  return node?.label || node?.nodeType || node?.type || "";
}

function isTemplateHeaderNodeTitle(title) {
  const text = (title || "").toString().trim();
  return [
    "中文名称",
    "英文名称",
    "阶段名称",
    "阶段名称*",
    "阶段",
    "知识点名称",
    "知识点名称*",
    "所属阶段",
    "二级主题",
  ].includes(text);
}

function getCanonicalStageOrder(title) {
  const normalized = (title || "").toString().trim();
  const aliases = [
    ["询盘"],
    ["报盘"],
    ["还盘"],
    ["接受与订货"],
    ["包装与装运", "订舱与物流", "包装与装运"],
    ["付款与交货"],
    ["商检"],
    ["保险与仲裁"],
    ["投诉", "投诉处理"],
    ["索赔与理赔"],
  ];
  const index = aliases.findIndex((names) => names.includes(normalized));
  return index >= 0 ? index + 1 : 0;
}

function getCourseMapStageOrder(stage) {
  return Number(stage?.order || stage?.orderIndex || stage?.courseOrder || getCanonicalStageOrder(getGraphNodeTitle(stage)) || 0);
}

function inferStageOrdersFromPrecedes(stages, edgesRaw) {
  const stageIds = new Set(stages.map((stage) => stage.id));
  const nextBySource = new Map();
  const targets = new Set();
  (edgesRaw || []).forEach((edge) => {
    if (edge.type !== "PRECEDES") return;
    const source = getGraphEdgeSource(edge);
    const target = getGraphEdgeTarget(edge);
    if (!stageIds.has(source) || !stageIds.has(target)) return;
    nextBySource.set(source, target);
    targets.add(target);
  });
  const root = stages.find((stage) => nextBySource.has(stage.id) && !targets.has(stage.id));
  if (!root) return new Map();
  const orders = new Map();
  let current = root.id;
  let order = 1;
  while (current && !orders.has(current)) {
    orders.set(current, order);
    current = nextBySource.get(current);
    order += 1;
  }
  return orders;
}

function buildCourseMapModel(nodesRaw, edgesRaw) {
  const nodeMap = new Map();
  (nodesRaw || []).forEach((node) => {
    const id = getGraphNodeId(node);
    if (id) nodeMap.set(id, { ...node, id });
  });

  let stages = [];
  const topics = [];
  const points = [];
  const categories = new Map();
  const stageTypes = new Set(["Stage", "ProcessStep"]);
  const topicTypes = new Set(["Topic", "Chapter", "TheoryTopic"]);
  const pointTypes = new Set(["KnowledgePoint", "Skill", "Terminology", "TheoryLesson", "Practice"]);
  nodeMap.forEach((node) => {
    const type = getGraphNodeType(node);
    if (stageTypes.has(type)) stages.push(node);
    else if (topicTypes.has(type)) topics.push(node);
    else if (type === "KnowledgeCategory") categories.set(node.id, node);
    else if (pointTypes.has(type)) points.push(node);
  });

  stages = stages.filter((stage) => !isTemplateHeaderNodeTitle(getGraphNodeTitle(stage)));
  const hasImportedStageAxis = stages.some((stage) => getGraphNodeType(stage) === "Stage");
  if (hasImportedStageAxis) {
    stages = stages.filter((stage) => getGraphNodeType(stage) === "Stage");
  }
  const inferredStageOrders = inferStageOrdersFromPrecedes(stages, edgesRaw);
  stages = stages.map((stage) => ({
    ...stage,
    courseOrder: getCourseMapStageOrder(stage) || inferredStageOrders.get(stage.id) || getCanonicalStageOrder(getGraphNodeTitle(stage)) || 0,
  }));
  stages.sort((a, b) => getCourseMapStageOrder(a) - getCourseMapStageOrder(b) || getGraphNodeTitle(a).localeCompare(getGraphNodeTitle(b)));
  stages = stages.filter((stage) => {
    const type = getGraphNodeType(stage);
    const order = stage.order ?? stage.orderIndex;
    const title = getGraphNodeTitle(stage);
    return !(type === "ProcessStep" && (Number(order) === 0 || title.includes("课程导入")));
  });
  topics.sort((a, b) => (a.order || a.orderIndex || 0) - (b.order || b.orderIndex || 0) || getGraphNodeTitle(a).localeCompare(getGraphNodeTitle(b)));

  const topicById = new Map(topics.map((topic) => [topic.id, { topic, points: [], categories: new Map() }]));
  const stageById = new Map(stages.map((stage) => [stage.id, { stage, topics: [], loosePoints: [] }]));
  const topicToStage = new Map();
  const categoryToTopic = new Map();

  (edgesRaw || []).forEach((edge) => {
    const source = getGraphEdgeSource(edge);
    const target = getGraphEdgeTarget(edge);
    if (edge.type === "CONTAIN_TOPIC" && stageById.has(source) && topicById.has(target)) {
      const stageBucket = stageById.get(source);
      const topicBucket = topicById.get(target);
      stageBucket.topics.push(topicBucket);
      topicToStage.set(target, source);
    }
    if (edge.type === "COVERS_PROCESS" && topicById.has(source) && stageById.has(target)) {
      const stageBucket = stageById.get(target);
      const topicBucket = topicById.get(source);
      stageBucket.topics.push(topicBucket);
      topicToStage.set(source, target);
    }
    if (edge.type === "HAS_CATEGORY" && topicById.has(source) && categories.has(target)) {
      categoryToTopic.set(target, source);
      const bucket = topicById.get(source);
      bucket.categories.set(target, { category: categories.get(target), points: [] });
    }
  });

  const pointToTopic = new Map();
  (edgesRaw || []).forEach((edge) => {
    const source = getGraphEdgeSource(edge);
    const target = getGraphEdgeTarget(edge);
    if (["INCLUDE_POINT", "HAS_LESSON", "HAS_PRACTICE"].includes(edge.type) && topicById.has(source) && nodeMap.has(target)) {
      const point = nodeMap.get(target);
      if (pointTypes.has(getGraphNodeType(point))) {
        topicById.get(source).points.push(point);
        pointToTopic.set(target, source);
      }
    }
    if (edge.type === "CONTAINS" && categories.has(source) && nodeMap.has(target)) {
      const topicId = categoryToTopic.get(source);
      const point = nodeMap.get(target);
      if (topicId && pointTypes.has(getGraphNodeType(point))) {
        const topicBucket = topicById.get(topicId);
        const categoryBucket = topicBucket.categories.get(source) || { category: categories.get(source), points: [] };
        categoryBucket.points.push(point);
        topicBucket.categories.set(source, categoryBucket);
        pointToTopic.set(target, topicId);
      }
    }
  });

  (edgesRaw || []).forEach((edge) => {
    const source = getGraphEdgeSource(edge);
    const target = getGraphEdgeTarget(edge);
    if (!["EXPLAINS", "TESTS"].includes(edge.type)) return;
    if (!pointToTopic.has(source) || !nodeMap.has(target)) return;
    const point = nodeMap.get(target);
    if (!pointTypes.has(getGraphNodeType(point))) return;
    const topicId = pointToTopic.get(source);
    const topicBucket = topicById.get(topicId);
    if (!topicBucket || pointToTopic.has(target)) return;
    topicBucket.points.push(point);
    pointToTopic.set(target, topicId);
  });

  const findStageBucketByTitle = (node) => {
    const stageName = node.stage || node.stageName || "";
    const title = getGraphNodeTitle(node);
    return stages
      .map((stage) => stageById.get(stage.id))
      .find((bucket) => {
        const bucketTitle = getGraphNodeTitle(bucket.stage);
        return (
          bucketTitle === stageName ||
          bucket.stage.name === stageName ||
          (bucketTitle && title && title.includes(bucketTitle))
        );
      });
  };

  topics.forEach((topic) => {
    if (topicToStage.has(topic.id)) return;
    if (hasImportedStageAxis && getGraphNodeType(topic) !== "Topic") return;
    const stageBucket = findStageBucketByTitle(topic);
    if (stageBucket) {
      stageBucket.topics.push(topicById.get(topic.id));
      topicToStage.set(topic.id, stageBucket.stage.id);
    }
  });

  points.forEach((point) => {
    if (pointToTopic.has(point.id)) return;
    if (hasImportedStageAxis && ["TheoryLesson", "Practice"].includes(getGraphNodeType(point))) return;
    const stageBucket = findStageBucketByTitle(point);
    if (stageBucket) stageBucket.loosePoints.push(point);
  });

  const relationsByPoint = new Map();
  const relationEdges = [];
  const semanticTypes = new Set(["REQUIRES", "SUGGESTS_CO_LEARNING", "RELATED_TO", "RELATES_TO", "CONTRASTS_WITH", "APPLIES_TO_SCENARIO", "SUGGESTS_STRATEGY", "HAS_EXCEPTION", "COMBINES_WITH", "CONFLICTS_WITH", "CULTURE_SENSITIVE_TO", "HAS_CULTURAL_SENSITIVITY", "INVOLVES_CULTURE"]);
  (edgesRaw || []).forEach((edge) => {
    if (!semanticTypes.has(edge.type)) return;
    const source = getGraphEdgeSource(edge);
    const target = getGraphEdgeTarget(edge);
    if (source && target && nodeMap.has(source) && nodeMap.has(target)) {
      relationEdges.push({ ...edge, source, target, type: edge.type });
    }
    [source, target].forEach((id) => {
      if (!relationsByPoint.has(id)) relationsByPoint.set(id, []);
      relationsByPoint.get(id).push(edge.type);
    });
  });

  return {
    stages: [...stageById.values()],
    points,
    relationsByPoint,
    relationEdges,
    nodeMap,
  };
}

function getCourseMapPointTone(type) {
  if (type === "Practice") {
    return {
      label: "练习层",
      className: "border-amber-500 bg-white text-slate-900 shadow-[inset_4px_0_0_#d49222] hover:border-amber-600",
      activeClassName: "border-amber-600 bg-amber-50 text-amber-950 shadow-[inset_4px_0_0_#c57c13]",
    };
  }
  if (type === "TheoryLesson") {
    return {
      label: "课时层",
      className: "border-indigo-500 bg-white text-slate-900 shadow-[inset_4px_0_0_#5f6fb7] hover:border-indigo-600",
      activeClassName: "border-indigo-600 bg-indigo-50 text-indigo-950 shadow-[inset_4px_0_0_#4f5da8]",
    };
  }
  if (type === "Skill") {
    return {
      label: "策略层",
      className: "border-rose-500 bg-white text-slate-900 shadow-[inset_4px_0_0_#e05a47] hover:border-rose-600",
      activeClassName: "border-rose-600 bg-rose-50 text-rose-950 shadow-[inset_4px_0_0_#d94835]",
    };
  }
  if (type === "Terminology") {
    return {
      label: "术语层",
      className: "border-sky-500 bg-white text-slate-900 shadow-[inset_4px_0_0_#2f77b9] hover:border-sky-600",
      activeClassName: "border-sky-600 bg-sky-50 text-sky-950 shadow-[inset_4px_0_0_#2f77b9]",
    };
  }
  return {
    label: "概念层",
    className: "border-teal-500 bg-white text-slate-900 shadow-[inset_4px_0_0_#2fa89a] hover:border-teal-600",
    activeClassName: "border-teal-600 bg-teal-50 text-teal-950 shadow-[inset_4px_0_0_#209487]",
  };
}

function getCourseMapRelationStyle(type) {
  const styles = {
    REQUIRES: { label: "前置依赖", color: "#d85b45", dash: "" },
    SUGGESTS_CO_LEARNING: { label: "建议同时学", color: "#2da77a", dash: "7 5" },
    RELATED_TO: { label: "语义关联", color: "#2f8f83", dash: "6 5" },
    RELATES_TO: { label: "语义关联", color: "#2f8f83", dash: "6 5" },
    CONTRASTS_WITH: { label: "对比辨析", color: "#8561b7", dash: "4 4" },
    APPLIES_TO_SCENARIO: { label: "情境-策略", color: "#c38b18", dash: "" },
    SUGGESTS_STRATEGY: { label: "情境-策略", color: "#c38b18", dash: "" },
    HAS_EXCEPTION: { label: "规则-例外", color: "#d97706", dash: "2 5" },
    COMBINES_WITH: { label: "组合使用", color: "#348b6f", dash: "" },
    CONFLICTS_WITH: { label: "冲突关系", color: "#b83f35", dash: "" },
    CULTURE_SENSITIVE_TO: { label: "文化敏感", color: "#b98a13", dash: "7 4" },
    HAS_CULTURAL_SENSITIVITY: { label: "文化敏感", color: "#b98a13", dash: "7 4" },
    INVOLVES_CULTURE: { label: "文化敏感", color: "#b98a13", dash: "7 4" },
  };
  return styles[type] || { label: type || "关联", color: "#64748b", dash: "5 5" };
}

function getCourseMapRelationLegend(relationEdges) {
  const seen = new Set();
  return (relationEdges || [])
    .map((edge) => edge.type)
    .filter((type) => {
      if (!type || seen.has(type)) return false;
      seen.add(type);
      return true;
    })
    .map((type) => ({ type, ...getCourseMapRelationStyle(type) }));
}

function ensureAdminRingGraphStyles() {
  if (document.getElementById("admin-ring-graph-style")) return;
  const style = document.createElement("style");
  style.id = "admin-ring-graph-style";
  style.textContent = `
    #admin-graph-canvas.admin-ring-graph-canvas {
      position: relative;
      overflow: hidden;
      border-color: #d8dee9;
      background: radial-gradient(circle at 50% 48%, #ffffff 0%, #f5f7fb 52%, #eef2f8 100%);
    }
    .ring-graph-shell {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-columns: minmax(520px, 1fr) 380px;
      gap: 18px;
      padding: 72px 18px 18px;
    }
    .ring-graph-stage-area {
      position: relative;
      min-width: 0;
      min-height: 0;
      border: 1px solid rgba(203, 213, 225, 0.62);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.46);
      overflow: hidden;
    }
    .ring-focus-panel {
      min-width: 0;
      min-height: 0;
      border: 1px solid rgba(203, 213, 225, 0.86);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 18px 46px rgba(15, 23, 42, 0.09);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .ring-focus-panel__head {
      border-bottom: 1px solid #e2e8f0;
      padding: 14px 14px 12px;
    }
    .ring-focus-panel__body {
      min-height: 0;
      overflow: auto;
      padding: 12px;
    }
    .ring-focus-empty {
      display: flex;
      height: 100%;
      min-height: 280px;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
      color: #64748b;
      font-size: 13px;
      line-height: 1.65;
    }
    .ring-topic-card {
      width: 100%;
      border: 1px solid #dbeafe;
      border-radius: 8px;
      background: #ffffff;
      padding: 10px 11px;
      text-align: left;
      color: #1e3a8a;
      transition: border-color 0.16s ease, box-shadow 0.16s ease, background 0.16s ease;
    }
    .ring-topic-card:hover,
    .ring-topic-card.is-active {
      border-color: #60a5fa;
      background: #eff6ff;
      box-shadow: 0 8px 18px rgba(37, 99, 235, 0.1);
    }
    .ring-kp-row {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-left-width: 4px;
      border-radius: 7px;
      background: #ffffff;
      padding: 8px 9px;
      text-align: left;
      color: #1f2937;
      transition: background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
    }
    .ring-kp-row:hover,
    .ring-kp-row.is-active {
      background: #f8fafc;
      border-color: #94a3b8;
      box-shadow: 0 7px 16px rgba(15, 23, 42, 0.08);
    }
    .ring-no-data {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      text-align: center;
      color: #64748b;
    }
    @media (max-width: 1180px) {
      .ring-graph-shell {
        grid-template-columns: 1fr;
        grid-template-rows: minmax(460px, 1fr) 360px;
      }
    }
    .ring-graph-tip {
      position: absolute;
      left: 18px;
      right: 18px;
      top: 14px;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 38px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.86);
      padding: 8px 12px;
      color: #334155;
      font-size: 12px;
      box-shadow: 0 12px 34px rgba(15, 23, 42, 0.08);
      backdrop-filter: blur(8px);
    }
    .ring-graph-tip__relations {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .ring-graph-tip__chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.32);
      background: #f8fafc;
      padding: 3px 8px;
      color: #475569;
      white-space: nowrap;
    }
    .ring-graph-reset {
      position: absolute;
      right: 18px;
      bottom: 16px;
      z-index: 6;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.92);
      padding: 8px 12px;
      color: #334155;
      font-size: 12px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
    }
    .ring-graph-tooltip {
      position: absolute;
      z-index: 8;
      max-width: 260px;
      pointer-events: none;
      border: 1px solid rgba(148, 163, 184, 0.38);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.96);
      padding: 10px 12px;
      color: #1f2937;
      font-size: 12px;
      line-height: 1.55;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.16);
    }
  `;
  document.head.appendChild(style);
}

function getRingLayerRadiusFactor(layer) {
  if (layer === "process") return 1.45;
  if (layer === "strategy") return 1.68;
  if (layer === "culture") return 1.86;
  return 1.22;
}

function getRingLayerStyle(layer) {
  const styles = {
    concept: { label: "概念层", fill: "#3f7fca", stroke: "#2f77b9" },
    process: { label: "流程层", fill: "#32a285", stroke: "#209487" },
    strategy: { label: "策略层", fill: "#d8684b", stroke: "#c94d35" },
    culture: { label: "文化维度", fill: "#c9921e", stroke: "#b77d12" },
  };
  return styles[layer] || styles.concept;
}

function getRingRelationStyle(type) {
  return getCourseMapRelationStyle(type);
}

function describeRingArc(radius, startAngle, endAngle) {
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const startX = Math.cos(startAngle) * radius;
  const startY = Math.sin(startAngle) * radius;
  const endX = Math.cos(endAngle) * radius;
  const endY = Math.sin(endAngle) * radius;
  return `M${startX},${startY} A${radius},${radius} 0 ${largeArc} 1 ${endX},${endY}`;
}

function getRingStageBaseAngle(index, total) {
  return -Math.PI / 2 + (index * Math.PI * 2) / total;
}

function getRingNodeTitleById(data, id) {
  for (const stage of data.stages) {
    const topic = (stage.topics || []).find((item) => item.id === id);
    if (topic) return topic.name;
    for (const currentTopic of stage.topics || []) {
      const point = (currentTopic.kps || []).find((item) => item.id === id);
      if (point) return point.name;
    }
    const point = (stage.kps || []).find((item) => item.id === id);
    if (point) return point.name;
  }
  const culture = (data.culture || []).find((item) => item.id === id);
  return culture ? culture.name : id;
}

function getRingPointById(data, id) {
  for (const stage of data.stages) {
    for (const topic of stage.topics || []) {
      const point = (topic.kps || []).find((item) => item.id === id);
      if (point) return { ...point, stage, topic };
    }
    const point = (stage.kps || []).find((item) => item.id === id);
    if (point) return { ...point, stage, topic: null };
  }
  const culture = (data.culture || []).find((item) => item.id === id);
  return culture ? { ...culture, layer: "culture", isCulture: true } : null;
}

function getRingRelationsForPoint(data, pointId) {
  return (data.relations || []).filter((edge) => edge.source === pointId || edge.target === pointId);
}

function makeRingStableId(prefix, value) {
  const raw = String(value || prefix || "node").trim();
  const normalized = raw
    .replace(/^([^:]+):/, "")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}-${normalized || Math.random().toString(36).slice(2, 8)}`;
}

function inferRingLayerFromNode(node, detail = {}) {
  const type = getGraphNodeType(node);
  const text = `${getGraphNodeTitle(node)} ${node?.subtitle || ""} ${(detail.category_path || detail.category_path_text || detail.category || "").toString()}`;
  if (type === "ProcessStep" || /流程|步骤|逻辑|顺序|收集|准备|确认/.test(text)) {
    return "process";
  }
  if (type === "Skill" || /策略|应对|处理|谈判|让步|锚定|选择|争议/.test(text)) {
    return "strategy";
  }
  return "concept";
}

function normalizeRingDifficulty(value) {
  if (typeof value === "number") return Math.max(0, Math.min(5, value));
  const text = String(value || "").trim().toLowerCase();
  if (!text) return 0;
  if (/5|expert|高级|困难|hard/.test(text)) return 5;
  if (/4|advanced|较难/.test(text)) return 4;
  if (/3|intermediate|中/.test(text)) return 3;
  if (/2|basic|基础/.test(text)) return 2;
  if (/1|beginner|入门|简单|easy/.test(text)) return 1;
  return 0;
}

function normalizeRingGraphTopics(data) {
  const source = data || {};
  const stages = (source.stages || []).map((stage) => {
    const explicitTopics = Array.isArray(stage.topics) ? stage.topics : [];
    if (explicitTopics.length > 0) {
      return {
        ...stage,
        topics: explicitTopics.map((topic) => ({
          ...topic,
          id: topic.id || makeRingStableId("topic", `${stage.id}-${topic.name}`),
          kps: Array.isArray(topic.kps) ? topic.kps : [],
        })),
      };
    }

    const grouped = new Map();
    (stage.kps || []).forEach((point) => {
      const layer = point.layer || "concept";
      const style = getRingLayerStyle(layer);
      const topicName = point.topic || style.label;
      const topicId = makeRingStableId("topic", `${stage.id}-${topicName}`);
      if (!grouped.has(topicId)) {
        grouped.set(topicId, {
          id: topicId,
          name: topicName,
          layer,
          kps: [],
        });
      }
      grouped.get(topicId).kps.push(point);
    });
    return {
      ...stage,
      topics: Array.from(grouped.values()),
    };
  });
  return { ...source, stages };
}

function buildAdminRingGraphDataFromNeo4j() {
  const networkData = state.admin?.graph?.network || { nodes: [], edges: [] };
  const nodes = Array.isArray(networkData.nodes) ? networkData.nodes : [];
  const edges = Array.isArray(networkData.edges) ? networkData.edges : [];
  if (nodes.length === 0) {
    return null;
  }

  const knowledgeDetails = new Map();
  const knowledgeList = state.admin?.graph?.knowledgePoints || [];
  if (Array.isArray(knowledgeList)) {
    knowledgeList.forEach((item) => {
      const name = item?.name || item?.title;
      if (name) knowledgeDetails.set(String(name).trim(), item);
    });
  }

  const stageNodes = nodes
    .filter((node) => getGraphNodeType(node) === "Stage")
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || getGraphNodeTitle(a).localeCompare(getGraphNodeTitle(b), "zh-Hans-CN"));
  if (stageNodes.length === 0) {
    return null;
  }

  const stageByKey = new Map();
  const stageByName = new Map();
  const stages = stageNodes.map((node, index) => {
    const name = getGraphNodeTitle(node);
    const stage = {
      id: makeRingStableId("stage", node.key || name),
      name,
      en: node.subtitle || "",
      topics: [],
      sourceKey: node.key,
      order: Number(node.order || index + 1),
    };
    if (node.key) stageByKey.set(node.key, stage);
    stageByName.set(name, stage);
    return stage;
  });

  const topicTypes = new Set(["Topic"]);
  const topicByKey = new Map();
  const topicToStage = new Map();
  edges.forEach((edge) => {
    const type = edge.type || edge.label;
    if (!["CONTAIN_TOPIC", "HAS_TOPIC"].includes(type)) return;
    const sourceStage = stageByKey.get(edge.source);
    if (sourceStage && edge.target) topicToStage.set(edge.target, sourceStage);
  });

  nodes.forEach((node) => {
    const type = getGraphNodeType(node);
    if (!topicTypes.has(type)) return;
    const title = getGraphNodeTitle(node);
    const stage = topicToStage.get(node.key) || stageByName.get(node.stageName || node.stage || "");
    if (!title || !stage) return;
    const topic = {
      id: makeRingStableId("topic", node.key || `${stage.name}-${title}`),
      name: title,
      layer: "topic",
      sourceKey: node.key,
      stageId: stage.id,
      stageName: stage.name,
      order: Number(node.order || stage.topics.length + 1),
      kps: [],
    };
    stage.topics.push(topic);
    if (node.key) topicByKey.set(node.key, topic);
  });

  const pointTypes = new Set(["KnowledgePoint", "Terminology", "Skill", "ProcessStep"]);
  const cultureTypes = new Set(["CultureDimension"]);
  const pointByKey = new Map();
  const pointIdByKey = new Map();
  const culture = [];

  nodes.forEach((node) => {
    const type = getGraphNodeType(node);
    const title = getGraphNodeTitle(node);
    if (!title || type === "Stage" || topicTypes.has(type)) return;
    if (cultureTypes.has(type)) {
      const cultureNode = {
        id: makeRingStableId("culture", node.key || title),
        name: title,
        source: node.subtitle || "",
        sourceKey: node.key,
      };
      culture.push(cultureNode);
      if (node.key) {
        pointByKey.set(node.key, cultureNode);
        pointIdByKey.set(node.key, cultureNode.id);
      }
      return;
    }
    if (!pointTypes.has(type)) return;

    const detail = knowledgeDetails.get(title) || {};
    const inboundTopic = edges.find((edge) => edge.target === node.key && ["INCLUDE_POINT", "CONTAINS"].includes(edge.type || edge.label));
    let topic = inboundTopic ? topicByKey.get(inboundTopic.source) : null;
    let stage = topic ? stageByName.get(topic.stageName) : null;
    if (!topic) {
      const stageName = node.stageName || node.stage || detail.stage || (Array.isArray(detail.category_path) ? detail.category_path[0] : "");
      stage = stageByName.get(stageName);
      const topicName =
        detail.topic ||
        detail.topicName ||
        (Array.isArray(detail.category_path) ? detail.category_path[1] : "") ||
        node.topic ||
        "未归入二级主题";
      if (stage) {
        const topicId = makeRingStableId("topic", `${stage.id}-${topicName}`);
        topic = stage.topics.find((item) => item.id === topicId || item.name === topicName);
        if (!topic) {
          topic = {
            id: topicId,
            name: topicName,
            layer: "topic",
            stageId: stage.id,
            stageName: stage.name,
            order: stage.topics.length + 1,
            kps: [],
          };
          stage.topics.push(topic);
        }
      }
    }
    if (!stage || !topic) return;

    const point = {
      id: makeRingStableId("kp", node.key || title),
      name: title,
      layer: inferRingLayerFromNode(node, detail),
      nodeType: type || detail.nodeType || "KnowledgePoint",
      kpType: inferKgKpType(type || detail.nodeType, { ...detail, term: type === "Terminology" || Boolean(detail.lex_role) }),
      bloom: detail.bloom_level || detail.bloomLevel || "未标注",
      difficulty: normalizeRingDifficulty(detail.difficulty),
      term: type === "Terminology" || Boolean(detail.lex_role),
      sourceKey: node.key,
      topicId: topic.id,
      topicName: topic.name,
    };
    topic.kps.push(point);
    if (node.key) {
      pointByKey.set(node.key, point);
      pointIdByKey.set(node.key, point.id);
    }
  });

  const excludedRelations = new Set([
    "CONTAIN_TOPIC",
    "HAS_TOPIC",
    "HAS_CATEGORY",
    "CONTAINS",
    "INCLUDE_POINT",
    "EXPLAINS",
    "TESTS",
  ]);
  const relations = [];
  const relationSeen = new Set();
  edges.forEach((edge) => {
    const type = edge.type || edge.label || "RELATED_TO";
    if (excludedRelations.has(type)) return;
    const sourceId = pointIdByKey.get(edge.source);
    const targetId = pointIdByKey.get(edge.target);
    if (!sourceId || !targetId || sourceId === targetId) return;
    const key = `${sourceId}->${targetId}:${type}`;
    if (relationSeen.has(key)) return;
    relationSeen.add(key);
    relations.push({ source: sourceId, target: targetId, type });
  });

  stages.forEach((stage) => {
    stage.topics.sort((a, b) => Number(a.order || 0) - Number(b.order || 0) || a.name.localeCompare(b.name, "zh-Hans-CN"));
    stage.topics.forEach((topic) => {
      topic.kps.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    });
  });

  const totalPoints = stages.reduce(
    (sum, stage) => sum + (stage.topics || []).reduce((topicSum, topic) => topicSum + (topic.kps || []).length, 0),
    0
  );

  return normalizeRingGraphTopics({
    stages,
    culture,
    relations,
    source: "neo4j",
    sourceLabel: `Neo4j 实时数据：${stages.length} 环节 · ${totalPoints} 知识点 · ${relations.length} 语义关系`,
  });
}

function getAdminRingGraphData() {
  return buildAdminRingGraphDataFromNeo4j();
}

function resetAdminRingGraphView() {
  adminRingExpandedStages.clear();
  adminRingExpandedTopics.clear();
  adminGraphFocusedPointId = null;
  renderAdminGraphNetwork();
}

function showRingTooltip(container, html, event) {
  let tooltip = container.querySelector("[data-ring-tooltip]");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.dataset.ringTooltip = "true";
    tooltip.className = "ring-graph-tooltip";
    container.appendChild(tooltip);
  }
  tooltip.innerHTML = html;
  const rect = container.getBoundingClientRect();
  tooltip.style.left = `${Math.min(rect.width - 280, Math.max(12, event.clientX - rect.left + 14))}px`;
  tooltip.style.top = `${Math.min(rect.height - 140, Math.max(60, event.clientY - rect.top + 14))}px`;
}

function hideRingTooltip(container) {
  container.querySelector("[data-ring-tooltip]")?.remove();
}

function buildRingGraphLayout(data, width, height) {
  const cx = width / 2;
  const cy = height / 2 + 18;
  const radius = Math.min(width, height) * 0.27;
  const stages = data.stages.map((stage, index) => {
    const angle = getRingStageBaseAngle(index, data.stages.length);
    return {
      ...stage,
      index,
      angle,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  return { cx, cy, radius, stages, stageById };
}

function getRingGraphStats(data) {
  const stages = data?.stages || [];
  const topics = stages.reduce((sum, stage) => sum + (stage.topics || []).length, 0);
  const points = stages.reduce(
    (sum, stage) => sum + (stage.topics || []).reduce((topicSum, topic) => topicSum + (topic.kps || []).length, 0),
    0
  );
  const relations = Array.isArray(data?.relations) ? data.relations.length : 0;
  return { stages: stages.length, topics, points, relations };
}

function getRingActiveStage(data) {
  const stages = data?.stages || [];
  return stages.find((stage) => adminRingExpandedStages.has(stage.id)) || null;
}

function getRingTopicLocation(data, topicId) {
  for (const stage of data?.stages || []) {
    const topic = (stage.topics || []).find((item) => item.id === topicId);
    if (topic) return { stage, topic };
  }
  return null;
}

function getRingPointLocation(data, pointId) {
  for (const stage of data?.stages || []) {
    for (const topic of stage.topics || []) {
      const point = (topic.kps || []).find((item) => item.id === pointId);
      if (point) return { stage, topic, point };
    }
  }
  return null;
}

function renderAdminRingNoData() {
  adminGraphCanvas.innerHTML = `
    <div class="ring-no-data">
      <div>
        <div class="text-base font-semibold text-slate-800">暂无知识图谱数据</div>
        <div class="mt-2 text-sm">请先通过教师版模板导入数据，或检查 Neo4j 连接与数据结构。</div>
      </div>
    </div>
  `;
  if (adminGraphStatus) adminGraphStatus.textContent = "暂无 Neo4j 图谱数据";
}

const KG_ACCEPTANCE_REL_TYPES = {
  req: { label: "前置依赖", color: "#df6b4f", dash: "", width: 2.4 },
  scn: { label: "建议同时学", color: "#2da77a", dash: "7 5", width: 2.2 },
  cul: { label: "文化敏感", color: "#c99422", dash: "2 6", width: 2.4 },
  con: { label: "对比辨析", color: "#7a64c7", dash: "", width: 2.2 },
  exc: { label: "规则-例外", color: "#e18a2b", dash: "6 4", width: 2.2 },
  mig: { label: "★策略迁移", color: "#13a6a6", dash: "12 6", width: 3.2 },
  anchor: { label: "层级归属", color: "#cbd5e1", dash: "", width: 1.8 },
};

const KG_ACCEPTANCE_LAYER_TYPES = {
  concept: { label: "概念", color: "#3f7fca", soft: "#dceafe" },
  process: { label: "流程", color: "#2fa77f", soft: "#dcf7ed" },
  strategy: { label: "策略", color: "#df6640", soft: "#fee7dd" },
  culture: { label: "文化", color: "#c99524", soft: "#f8edcf" },
};

const KG_KP_TYPE_STYLES = {
  terminology: { label: "术语", color: "#2fa77f", soft: "#dcf7ed" },
  knowledge: { label: "知识", color: "#3f7fca", soft: "#dceafe" },
  skill: { label: "技能", color: "#df6640", soft: "#fee7dd" },
};

function ensureKgAcceptanceStyles() {
  if (document.getElementById("kg-acceptance-style")) return;
  const style = document.createElement("style");
  style.id = "kg-acceptance-style";
  style.textContent = `
    #admin-graph-canvas.kg-acceptance-canvas {
      position: relative;
      height: clamp(920px, 86vh, 1180px);
      min-height: 920px;
      overflow: hidden;
      border-color: #d8dee9;
      background: #f3f6fb;
    }
    #admin-graph-canvas.kg-acceptance-canvas:fullscreen,
    #admin-graph-canvas.kg-acceptance-canvas:-webkit-full-screen {
      width: 100vw;
      height: 100vh;
      min-height: 100vh;
      border-radius: 0;
      border: 0;
      background: #f3f6fb;
    }
    .kg-acceptance-shell {
      position: absolute;
      inset: 0;
      display: grid;
      grid-template-rows: 74px 44px minmax(0, 1fr);
      color: #26354d;
      background: linear-gradient(180deg, #f8fafc 0%, #eef3f9 100%);
    }
    .kg-acceptance-topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-bottom: 1px solid #d6deea;
      background: rgba(255, 255, 255, 0.86);
      padding: 14px 18px;
    }
    .kg-view-tabs {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .kg-view-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }
    .kg-view-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      padding: 10px 14px;
      color: #64748b;
      font-size: 13px;
      font-weight: 750;
      transition: all 0.16s ease;
    }
    .kg-view-tab:hover {
      background: #eef3f9;
      color: #26354d;
    }
    .kg-view-tab.is-active {
      background: #273956;
      color: #ffffff;
      box-shadow: 0 10px 24px rgba(39, 57, 86, 0.22);
    }
    .kg-view-tab__num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 22px;
      border-radius: 8px;
      background: rgba(148, 163, 184, 0.15);
      font-size: 12px;
    }
    .kg-view-tab.is-active .kg-view-tab__num {
      background: rgba(255, 255, 255, 0.22);
    }
    .kg-fullscreen-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #ffffff;
      padding: 10px 13px;
      color: #334155;
      font-size: 13px;
      font-weight: 800;
      transition: all 0.16s ease;
    }
    .kg-fullscreen-btn:hover {
      border-color: #94a3b8;
      background: #f8fafc;
      color: #1e293b;
    }
    #admin-graph-canvas:fullscreen .kg-fullscreen-btn,
    #admin-graph-canvas:-webkit-full-screen .kg-fullscreen-btn {
      background: #273956;
      border-color: #273956;
      color: #ffffff;
    }
    .kg-acceptance-hint {
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #d6deea;
      background: rgba(255, 255, 255, 0.62);
      padding: 0 18px;
      color: #53627a;
      font-size: 13px;
      font-weight: 650;
    }
    .kg-acceptance-hint strong {
      color: #c58a18;
    }
    .kg-panels {
      position: relative;
      min-height: 0;
      overflow: hidden;
    }
    .kg-panel {
      position: absolute;
      inset: 0;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s ease;
    }
    .kg-panel.is-active {
      opacity: 1;
      pointer-events: auto;
    }
    .kg-metric-wall {
      position: absolute;
      right: 24px;
      bottom: 26px;
      display: grid;
      grid-template-columns: repeat(5, minmax(70px, 1fr));
      gap: 14px;
      border: 1px solid #d6deea;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.86);
      padding: 18px 22px;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
    }
    .kg-metric-wall b {
      display: block;
      color: #26354d;
      font-size: 30px;
      line-height: 1;
    }
    .kg-metric-wall span {
      display: block;
      margin-top: 6px;
      color: #8a98ad;
      font-size: 12px;
      font-weight: 700;
    }
    .kg-legend-card,
    .kg-star-back {
      position: absolute;
      z-index: 4;
      border: 1px solid #d6deea;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.86);
      padding: 12px 14px;
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
      color: #64748b;
      font-size: 12px;
    }
    .kg-legend-card {
      left: 18px;
      bottom: 18px;
      min-width: 230px;
    }
    .kg-rel-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      padding: 4px 6px;
      color: #64748b;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
    }
    .kg-rel-toggle:hover {
      background: #eef3f9;
      color: #273956;
    }
    .kg-rel-toggle:not(.is-active) {
      color: #a8b3c3;
    }
    .kg-rel-toggle:not(.is-active) .kg-rel-toggle__line {
      opacity: 0.25;
    }
    .kg-rel-toggle__check {
      width: 16px;
      height: 16px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      background: #ffffff;
      color: #ffffff;
      text-align: center;
      line-height: 14px;
      font-size: 11px;
      font-weight: 900;
      flex: 0 0 auto;
    }
    .kg-rel-toggle.is-active .kg-rel-toggle__check {
      border-color: #273956;
      background: #273956;
    }
    .kg-star-back {
      right: 18px;
      top: 64px;
    }
    .kg-point-search {
      position: absolute;
      z-index: 5;
      right: 18px;
      top: 18px;
      display: flex;
      align-items: center;
      gap: 6px;
      border: 1px solid #d6deea;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      padding: 6px 8px 6px 12px;
      box-shadow: 0 12px 26px rgba(15, 23, 42, 0.08);
    }
    .kg-point-search input {
      width: 220px;
      border: 0;
      outline: 0;
      background: transparent;
      color: #273956;
      font-size: 12px;
      font-weight: 700;
    }
    .kg-point-search input::placeholder {
      color: #94a3b8;
    }
    .kg-point-search button {
      border: 0;
      border-radius: 999px;
      background: #273956;
      padding: 5px 10px;
      color: #ffffff;
      font-size: 12px;
      font-weight: 800;
    }
    .kg-point-search__msg {
      position: absolute;
      top: 38px;
      right: 10px;
      color: #c2410c;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .kg-star-back button {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      padding: 6px 10px;
      color: #334155;
      font-weight: 700;
    }
    .kg-work-layout {
      display: grid;
      grid-template-columns: 360px minmax(0, 1fr);
      height: 100%;
      min-height: 0;
    }
    .kg-work-tree {
      min-height: 0;
      overflow: auto;
      border-right: 1px solid #d6deea;
      background: rgba(255, 255, 255, 0.72);
      padding: 14px 10px 22px;
    }
    .kg-work-node {
      width: 100%;
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr) auto;
      align-items: center;
      gap: 6px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      padding: 7px 8px;
      text-align: left;
      color: #273956;
      font-size: 13px;
      font-weight: 750;
    }
    .kg-work-node:hover,
    .kg-work-node.is-active {
      background: #e7edf7;
    }
    .kg-work-node__count {
      color: #9aa7bb;
      font-size: 12px;
      font-weight: 800;
    }
    .kg-work-graph {
      position: relative;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
    }
    .kg-work-empty {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: #64748b;
      font-size: 14px;
    }
    .kg-tooltip {
      position: absolute;
      z-index: 10;
      max-width: 280px;
      pointer-events: none;
      border: 1px solid rgba(148, 163, 184, 0.36);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.96);
      padding: 10px 12px;
      color: #26354d;
      font-size: 12px;
      line-height: 1.55;
      box-shadow: 0 18px 42px rgba(15, 23, 42, 0.15);
    }
  `;
  document.head.appendChild(style);
}

function isAdminGraphFullscreen() {
  return document.fullscreenElement === adminGraphCanvas || document.webkitFullscreenElement === adminGraphCanvas;
}

function ensureKgFullscreenListener() {
  if (adminKgFullscreenListenerReady) return;
  adminKgFullscreenListenerReady = true;
  const rerender = () => {
    if (!adminGraphCanvas || !adminGraphCanvas.classList.contains("kg-acceptance-canvas")) return;
    requestAnimationFrame(() => renderAdminGraphNetwork());
  };
  document.addEventListener("fullscreenchange", rerender);
  document.addEventListener("webkitfullscreenchange", rerender);
}

async function toggleKgGraphFullscreen() {
  if (!adminGraphCanvas) return;
  try {
    if (isAdminGraphFullscreen()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }
    if (adminGraphCanvas.requestFullscreen) await adminGraphCanvas.requestFullscreen();
    else if (adminGraphCanvas.webkitRequestFullscreen) adminGraphCanvas.webkitRequestFullscreen();
  } catch (error) {
    console.warn("[Graph] fullscreen toggle failed", error);
  }
}

function kgRelStyle(type) {
  return KG_ACCEPTANCE_REL_TYPES[type] || KG_ACCEPTANCE_REL_TYPES.req;
}

function kgLayerStyle(layer) {
  return KG_ACCEPTANCE_LAYER_TYPES[layer] || KG_ACCEPTANCE_LAYER_TYPES.concept;
}

function kgKpTypeStyle(type) {
  return KG_KP_TYPE_STYLES[type] || KG_KP_TYPE_STYLES.knowledge;
}

function inferKgKpType(rawType, point = {}) {
  const text = `${rawType || ""} ${point.nodeType || ""} ${point.type || ""} ${point.term ? "term" : ""}`.toLowerCase();
  if (text.includes("terminology") || text.includes("term") || text.includes("术语")) return "terminology";
  if (text.includes("skill") || text.includes("技能")) return "skill";
  return "knowledge";
}

function mapKgRelationType(type) {
  const raw = String(type || "").toUpperCase();
  if (["REQ", "REQUIRES", "PREREQUISITE", "DEPENDS_ON"].includes(raw)) return "req";
  if (["SCN", "SUGGESTS_CO_LEARNING", "RELATED_TO", "RELATES_TO", "SIMILAR", "APPLIES_TO_SCENARIO", "SUGGESTS_STRATEGY", "RELATED_TO_SCENARIO"].includes(raw)) return "scn";
  if (["CUL", "HAS_CULTURAL_SENSITIVITY", "CULTURE_SENSITIVE_TO", "INVOLVES_CULTURE", "CULTURAL_CONTEXT"].includes(raw)) return "cul";
  if (["CON", "CONTRASTS_WITH", "CONFLICTS_WITH"].includes(raw)) return "con";
  if (["EXC", "HAS_EXCEPTION", "EXCEPTION_TO"].includes(raw)) return "exc";
  if (["MIG", "MIGRATES_TO", "STRATEGY_TRANSFER", "TRANSFER_TO", "COMBINES_WITH"].includes(raw)) return "mig";
  return raw.includes("CULTURE") ? "cul" : raw.includes("CONTRAST") ? "con" : raw.includes("EXCEPTION") ? "exc" : raw.includes("MIG") || raw.includes("TRANSFER") ? "mig" : "req";
}

function buildKgAcceptanceData() {
  const source = getAdminRingGraphData();
  if (!source || !(source.stages || []).length) return null;
  const stages = [];
  const topics = [];
  const kps = [];
  const culture = (source.culture || []).map((item) => ({
    id: item.id,
    name: item.name,
    sourceKey: item.sourceKey,
  }));
  const nodeIds = new Set(culture.map((item) => item.id));
  const kpById = new Map();

  (source.stages || []).forEach((stage, stageIndex) => {
    const stageRecord = {
      id: stage.id,
      zh: stage.name || stage.zh || `环节 ${stageIndex + 1}`,
      en: stage.en || "",
      order: Number(stage.order || stageIndex + 1),
      sourceKey: stage.sourceKey,
    };
    stages.push(stageRecord);
    (stage.topics || []).forEach((topic) => {
      const topicKps = topic.kps || [];
      const inferredLayer = topic.layer && KG_ACCEPTANCE_LAYER_TYPES[topic.layer]
        ? topic.layer
        : topicKps.find((point) => point.layer === "strategy") ? "strategy" : topicKps.find((point) => point.layer === "process") ? "process" : "concept";
      topics.push({
        id: topic.id,
        name: topic.name || "未命名主题",
        stage: stageRecord.id,
        layer: inferredLayer,
        sourceKey: topic.sourceKey,
      });
      topicKps.forEach((point) => {
        const kp = {
          id: point.id,
          topic: topic.id,
          stage: stageRecord.id,
          layer: KG_ACCEPTANCE_LAYER_TYPES[point.layer] ? point.layer : inferredLayer,
          name: point.name || "未命名知识点",
          bloom: point.bloom || "未标注",
          diff: Math.max(1, Math.min(3, Number(point.difficulty || point.diff || 1))),
          term: Boolean(point.term),
          star: Boolean(point.star),
          nodeType: point.nodeType || point.type || (point.term ? "Terminology" : "KnowledgePoint"),
          kpType: point.kpType || inferKgKpType(point.nodeType || point.type, point),
          sourceKey: point.sourceKey,
        };
        kps.push(kp);
        kpById.set(kp.id, kp);
        nodeIds.add(kp.id);
      });
    });
  });

  const rels = [];
  const seen = new Set();
  (source.relations || []).forEach((edge) => {
    const s = edge.source || edge.s;
    const t = edge.target || edge.t;
    if (!nodeIds.has(s) || !nodeIds.has(t) || s === t) return;
    const r = mapKgRelationType(edge.type || edge.r);
    const key = `${s}->${t}:${r}`;
    if (seen.has(key)) return;
    seen.add(key);
    rels.push({ s, t, r });
    if (r === "mig") {
      if (kpById.has(s)) kpById.get(s).star = true;
      if (kpById.has(t)) kpById.get(t).star = true;
    }
  });

  return {
    stages: stages.sort((a, b) => a.order - b.order),
    topics,
    kps,
    culture,
    rels,
    sourceLabel: source.sourceLabel || "Neo4j 实时数据",
  };
}

function kgStats(data) {
  return {
    stages: data?.stages?.length || 0,
    topics: data?.topics?.length || 0,
    kps: data?.kps?.length || 0,
    rels: data?.rels?.length || 0,
    culture: data?.culture?.length || 0,
  };
}

function kgFindNode(data, id) {
  return (data.kps || []).find((item) => item.id === id) || (data.culture || []).find((item) => item.id === id) || null;
}

function kgNodeName(data, id) {
  const node = kgFindNode(data, id);
  return node?.name || id;
}

function kgRelationsForNode(data, id) {
  return (data.rels || []).filter((edge) => edge.s === id || edge.t === id);
}

function kgRelationSummaryHtml(data, id) {
  const relations = kgRelationsForNode(data, id);
  if (!id || !relations.length) return "";
  const counts = {};
  relations.forEach((edge) => {
    counts[edge.r] = (counts[edge.r] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([type, count]) => {
      const style = kgRelStyle(type);
      return `<span style="color:${style.color};font-weight:800">${escapeHtmlText(style.label)}×${count}</span>`;
    })
    .join("　");
}

function kgShowTooltip(container, html, event) {
  let tooltip = container.querySelector("[data-kg-tooltip]");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.dataset.kgTooltip = "true";
    tooltip.className = "kg-tooltip";
    container.appendChild(tooltip);
  }
  tooltip.innerHTML = html;
  const rect = container.getBoundingClientRect();
  tooltip.style.left = `${Math.min(rect.width - 300, Math.max(12, event.clientX - rect.left + 14))}px`;
  tooltip.style.top = `${Math.min(rect.height - 160, Math.max(12, event.clientY - rect.top + 14))}px`;
}

function kgHideTooltip(container) {
  container.querySelector("[data-kg-tooltip]")?.remove();
}

function renderKgAcceptanceShell(data) {
  ensureKgFullscreenListener();
  const stats = kgStats(data);
  const views = [
    { id: "overview", num: "1", label: "总览闭环" },
    { id: "sunburst", num: "2", label: "全景旭日" },
    { id: "star", num: "3", label: "关系星图" },
    { id: "work", num: "4", label: "下钻视图" },
  ];
  const hints = {
    overview: `<strong>总览</strong> 十环节闭环骨架。点击任意环节，下钻进入该环节的工作视图。右下角为规模总量。`,
    sunburst: `<strong>全景</strong> 全部 ${stats.kps} 个知识点在同心圆中一屏铺开、零重叠。内圈=环节，中圈=主题，外圈=知识点。点击下钻，点中心返回。`,
    star: `<strong>关系网</strong> 10 个环节作为大号锚点，知识点围绕所属环节形成“星系”。只显示前置依赖、建议同时学、对比辨析、文化敏感四类关系。`,
    work: `<strong>聚焦</strong> 左侧树承载全部节点；点击知识点，右侧只画该点的一跳关系网，并打开知识点详情。`,
  };
  adminGraphCanvas.innerHTML = `
    <div class="kg-acceptance-shell">
      <header class="kg-acceptance-topbar">
        <div>
          <div class="text-lg font-extrabold tracking-tight text-slate-900">外贸谈判知识图谱</div>
          <div class="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">验收总览 · ${escapeHtmlText(data.sourceLabel || "Neo4j")}</div>
        </div>
        <div class="kg-view-actions">
          <nav class="kg-view-tabs">
            ${views.map((view) => `<button type="button" class="kg-view-tab ${adminKgAcceptanceView === view.id ? "is-active" : ""}" data-kg-view="${view.id}"><span class="kg-view-tab__num">${view.num}</span>${view.label}</button>`).join("")}
          </nav>
          <button type="button" class="kg-fullscreen-btn" data-kg-fullscreen>${isAdminGraphFullscreen() ? "退出全屏" : "全屏"}</button>
        </div>
      </header>
      <div class="kg-acceptance-hint">${hints[adminKgAcceptanceView] || ""}</div>
      <main class="kg-panels">
        ${views.map((view) => `<section class="kg-panel ${adminKgAcceptanceView === view.id ? "is-active" : ""}" data-kg-panel="${view.id}"></section>`).join("")}
      </main>
    </div>
  `;
  adminGraphCanvas.querySelectorAll("[data-kg-view]").forEach((button) => {
    button.addEventListener("click", () => {
      adminKgAcceptanceView = button.dataset.kgView;
      renderAdminGraphNetwork();
    });
  });
  adminGraphCanvas.querySelector("[data-kg-fullscreen]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleKgGraphFullscreen();
  });
  return adminGraphCanvas.querySelector(`[data-kg-panel="${adminKgAcceptanceView}"]`);
}

function renderKgOverview(panel, data) {
  const d3lib = window.d3;
  const stats = kgStats(data);
  const rect = panel.getBoundingClientRect();
  const width = Math.max(900, rect.width || 1100);
  const height = Math.max(620, rect.height || 700);
  const radius = Math.min(width, height) * 0.32;
  const cx = width / 2;
  const cy = height / 2 - 4;
  const pointCountByStage = new Map(data.stages.map((stage) => [stage.id, data.kps.filter((kp) => kp.stage === stage.id).length]));
  panel.innerHTML = "";

  const svg = d3lib.select(panel).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", "100%");
  const defs = svg.append("defs");
  defs.append("marker").attr("id", "kg-overview-arrow").attr("markerWidth", 12).attr("markerHeight", 12).attr("refX", 10).attr("refY", 4).attr("orient", "auto").append("path").attr("d", "M0,0 L0,8 L10,4 z").attr("fill", "#c4cedf");

  const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);
  data.stages.forEach((stage, index) => {
    const start = getRingStageBaseAngle(index, data.stages.length) + 0.14;
    const endRaw = getRingStageBaseAngle((index + 1) % data.stages.length, data.stages.length) - 0.14;
    const end = endRaw <= start ? endRaw + Math.PI * 2 : endRaw;
    g.append("path")
      .attr("d", describeRingArc(radius, start, end))
      .attr("fill", "none")
      .attr("stroke", "#c4cedf")
      .attr("stroke-width", 3)
      .attr("marker-end", "url(#kg-overview-arrow)");
  });

  const stageNodes = data.stages.map((stage, index) => {
    const angle = getRingStageBaseAngle(index, data.stages.length);
    return {
      ...stage,
      index,
      count: pointCountByStage.get(stage.id) || 0,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });
  const nodes = g.selectAll(".kg-overview-stage").data(stageNodes).join("g")
    .attr("class", "kg-overview-stage")
    .attr("transform", (stage) => `translate(${stage.x},${stage.y})`)
    .style("cursor", "pointer")
    .on("click", (event, stage) => {
      event.stopPropagation();
      adminKgAcceptanceView = "work";
      adminKgWorkExpandedStages.add(stage.id);
      adminKgWorkFocusId = data.kps.find((kp) => kp.stage === stage.id)?.id || null;
      renderAdminGraphNetwork();
    })
    .on("mousemove", (event, stage) => {
      const topicCount = data.topics.filter((topic) => topic.stage === stage.id).length;
      kgShowTooltip(adminGraphCanvas, `<strong>${escapeHtmlText(stage.zh)}</strong><br>${escapeHtmlText(stage.en || "")}<br>${topicCount} 主题 · ${stage.count} 知识点<br>点击进入下钻视图`, event);
    })
    .on("mouseleave", () => kgHideTooltip(adminGraphCanvas));

  nodes.append("circle").attr("r", 47).attr("fill", "#263956").attr("stroke", "#e2e8f0").attr("stroke-width", 3).attr("filter", "drop-shadow(0 12px 18px rgba(15,23,42,0.18))");
  nodes.append("text").attr("text-anchor", "middle").attr("y", -20).attr("fill", "#cbd5e1").attr("font-size", 12).attr("font-weight", 800).text((stage) => String(stage.order).padStart(2, "0"));
  nodes.append("text").attr("text-anchor", "middle").attr("y", 2).attr("fill", "#fff").attr("font-size", 17).attr("font-weight", 900).text((stage) => stage.zh.length > 5 ? `${stage.zh.slice(0, 4)}…` : stage.zh);
  nodes.append("text").attr("text-anchor", "middle").attr("y", 24).attr("fill", "#d79b24").attr("font-size", 13).attr("font-weight", 900).text((stage) => `${stage.count}点`);

  const hub = g.append("g");
  hub.append("text").attr("text-anchor", "middle").attr("y", -6).attr("fill", "#26354d").attr("font-size", 23).attr("font-weight", 900).text("外贸谈判");
  hub.append("text").attr("text-anchor", "middle").attr("y", 22).attr("fill", "#9aa7bb").attr("font-size", 13).attr("font-weight", 800).attr("letter-spacing", 2).text("CLOSED LOOP · 10 STAGES");

  const wall = document.createElement("div");
  wall.className = "kg-metric-wall";
  wall.innerHTML = [
    ["环节", stats.stages],
    ["主题", stats.topics],
    ["知识点", stats.kps],
    ["语义关系", stats.rels],
    ["文化维度", stats.culture],
  ].map(([label, value]) => `<div><b>${value}</b><span>${label}</span></div>`).join("");
  panel.appendChild(wall);
}

function buildKgSunburstHierarchy(data) {
  const topicByStage = new Map();
  data.topics.forEach((topic) => {
    if (!topicByStage.has(topic.stage)) topicByStage.set(topic.stage, []);
    topicByStage.get(topic.stage).push(topic);
  });
  const kpsByTopic = new Map();
  data.kps.forEach((kp) => {
    if (!kpsByTopic.has(kp.topic)) kpsByTopic.set(kp.topic, []);
    kpsByTopic.get(kp.topic).push(kp);
  });
  return {
    name: "全部",
    id: "root",
    children: data.stages.map((stage) => ({
      name: stage.zh,
      id: stage.id,
      kind: "stage",
      children: (topicByStage.get(stage.id) || []).map((topic) => ({
        name: topic.name,
        id: topic.id,
        kind: "topic",
        layer: topic.layer,
        children: (kpsByTopic.get(topic.id) || []).map((kp) => ({
          name: kp.name,
          id: kp.id,
          kind: "kp",
          layer: kp.layer,
          value: 1,
        })),
      })),
    })),
  };
}

function renderKgSunburst(panel, data) {
  const d3lib = window.d3;
  const rect = panel.getBoundingClientRect();
  const width = Math.max(720, rect.width || 1000);
  const height = Math.max(620, rect.height || 700);
  const size = Math.min(width, height) * 0.92;
  const radius = size / 6;
  panel.innerHTML = "";
  const root = d3lib.hierarchy(buildKgSunburstHierarchy(data)).sum((d) => d.value || 0).sort((a, b) => b.value - a.value);
  d3lib.partition().size([2 * Math.PI, root.height + 1])(root);
  root.each((d) => (d.current = d));
  const color = (d) => {
    if (d.depth === 1) return "#263956";
    return kgLayerStyle(d.data.layer || d.parent?.data?.layer || "concept").color;
  };
  const arc = d3lib.arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.004))
    .padRadius(radius * 1.5)
    .innerRadius((d) => d.y0 * radius)
    .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));
  const svg = d3lib.select(panel).append("svg")
    .attr("viewBox", `${-width / 2} ${-height / 2} ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("font", "12px sans-serif");
  const path = svg.append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
    .attr("fill", color)
    .attr("fill-opacity", (d) => arcVisible(d.current) ? (d.children ? 0.92 : 0.72) : 0)
    .attr("stroke", (d) => d.data.id === adminKgSunburstFocusId ? "#111827" : "#ffffff")
    .attr("stroke-width", (d) => d.data.id === adminKgSunburstFocusId ? 2.6 : 0.6)
    .attr("pointer-events", (d) => arcVisible(d.current) ? "auto" : "none")
    .attr("d", (d) => arc(d.current))
    .style("cursor", (d) => d.children ? "pointer" : "default")
    .on("click", clicked)
    .on("mousemove", (event, d) => {
      kgShowTooltip(adminGraphCanvas, `<strong>${escapeHtmlText(d.data.name)}</strong><br>${d.data.kind === "kp" ? "知识点" : d.data.kind === "topic" ? "二级主题" : "环节"}<br>${d.value || 0} 知识点`, event);
    })
    .on("mouseleave", () => kgHideTooltip(adminGraphCanvas));
  path.append("title").text((d) => `${d.ancestors().map((item) => item.data.name).reverse().join(" / ")}\n${d.value || 0}`);
  const label = svg.append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
    .attr("dy", "0.35em")
    .attr("fill", "#ffffff")
    .attr("font-weight", 800)
    .attr("font-size", (d) => d.depth === 1 ? 14 : 10)
    .attr("fill-opacity", (d) => +labelVisible(d.current))
    .attr("transform", (d) => labelTransform(d.current))
    .text((d) => d.data.name.length > 8 ? `${d.data.name.slice(0, 7)}…` : d.data.name);
  const parent = svg.append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "#fff")
    .attr("stroke", "#d6deea")
    .attr("stroke-width", 1.4)
    .attr("pointer-events", "all")
    .style("cursor", "pointer")
    .on("click", clicked);
  const center = svg.append("g").attr("pointer-events", "none");
  center.append("text").attr("text-anchor", "middle").attr("y", -4).attr("font-size", 18).attr("font-weight", 900).attr("fill", "#26354d").text("全部");
  center.append("text").attr("text-anchor", "middle").attr("y", 18).attr("font-size", 12).attr("font-weight", 700).attr("fill", "#9aa7bb").text(`${data.kps.length} 知识点`);
  renderKgPointSearch(panel, data, {
    view: "sunburst",
    value: kgFindNode(data, adminKgSunburstFocusId)?.name || "",
    placeholder: "搜索知识点",
    onSelect: (point) => {
      adminKgSunburstFocusId = point.id;
      const target = root.descendants().find((d) => d.data.kind === "kp" && d.data.id === point.id);
      updateSunburstFocus();
      if (target) clicked(null, target);
    },
  });
  updateSunburstFocus();

  function clicked(event, p) {
    if (!p) return;
    parent.datum(p.parent || root);
    root.each((d) => {
      d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth),
      };
    });
    const t = svg.transition().duration(720).ease(d3lib.easeCubicInOut);
    path.transition(t)
      .tween("data", (d) => {
        const i = d3lib.interpolate(d.current, d.target);
        return (value) => (d.current = i(value));
      })
      .filter(function (d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
      .attr("fill-opacity", (d) => arcVisible(d.target) ? (d.children ? 0.92 : 0.72) : 0)
      .attr("pointer-events", (d) => arcVisible(d.target) ? "auto" : "none")
      .attrTween("d", (d) => () => arc(d.current));
    label.filter(function (d) {
      return +this.getAttribute("fill-opacity") || labelVisible(d.target);
    }).transition(t)
      .attr("fill-opacity", (d) => +labelVisible(d.target))
      .attrTween("transform", (d) => () => labelTransform(d.current));
  }
  function updateSunburstFocus() {
    path.attr("stroke", (d) => d.data.id === adminKgSunburstFocusId ? "#111827" : "#ffffff")
      .attr("stroke-width", (d) => d.data.id === adminKgSunburstFocusId ? 2.6 : 0.6);
  }
  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }
  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.035;
  }
  function labelTransform(d) {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }
}

function buildKgGraphNodes(data) {
  return [
    ...data.kps.map((kp) => ({ ...kp, kind: "kp", radius: kp.star ? 12 : 8 })),
    ...data.culture.map((item) => ({ ...item, kind: "culture", layer: "culture", radius: 14, star: false })),
  ];
}

function findKgPointByQuery(data, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  const points = Array.isArray(data?.kps) ? data.kps : [];
  return points.find((kp) => String(kp.name || "").toLowerCase() === q)
    || points.find((kp) => String(kp.name || "").toLowerCase().includes(q))
    || points.find((kp) => String(kp.id || "").toLowerCase() === q);
}

function renderKgPointSearch(panel, data, options = {}) {
  if (!panel || !Array.isArray(data?.kps) || !data.kps.length || typeof options.onSelect !== "function") return;
  const id = `kg-point-search-${options.view || "view"}-${Math.random().toString(36).slice(2, 8)}`;
  const wrap = document.createElement("form");
  wrap.className = "kg-point-search";
  wrap.innerHTML = `
    <input type="search" list="${id}" value="${escapeHtmlAttribute(options.value || "")}" placeholder="${escapeHtmlAttribute(options.placeholder || "搜索知识点")}" autocomplete="off">
    <datalist id="${id}">
      ${data.kps.map((kp) => `<option value="${escapeHtmlAttribute(kp.name)}"></option>`).join("")}
    </datalist>
    <button type="submit">搜索</button>
    <span class="kg-point-search__msg hidden" data-kg-search-msg>未找到</span>
  `;
  const input = wrap.querySelector("input");
  const msg = wrap.querySelector("[data-kg-search-msg]");
  const submit = (event) => {
    event?.preventDefault();
    const point = findKgPointByQuery(data, input.value);
    if (!point) {
      msg?.classList.remove("hidden");
      return;
    }
    msg?.classList.add("hidden");
    options.onSelect(point);
  };
  wrap.addEventListener("submit", submit);
  input.addEventListener("change", submit);
  panel.appendChild(wrap);
}

function renderKgStarGraph(panel, data) {
  const d3lib = window.d3;
  const rect = panel.getBoundingClientRect();
  const width = Math.max(1100, rect.width || 1200);
  const height = Math.max(760, rect.height || 820);
  panel.innerHTML = "";
  const centerX = width / 2;
  const centerY = height / 2;
  const galaxyRadiusX = Math.min(width * 0.31, Math.max(360, width * 0.25));
  const galaxyRadiusY = Math.min(height * 0.27, Math.max(220, height * 0.24));
  const stageNodes = data.stages.map((stage, index) => {
    const angle = -Math.PI / 2 + (index / Math.max(1, data.stages.length)) * Math.PI * 2;
    const count = data.kps.filter((kp) => kp.stage === stage.id).length;
    return {
      id: `stage-anchor:${stage.id}`,
      kind: "stage",
      layer: "stage",
      stage: stage.id,
      order: stage.order,
      name: stage.zh,
      en: stage.en,
      count,
      radius: 30,
      angle,
      x: centerX + Math.cos(angle) * galaxyRadiusX,
      y: centerY + Math.sin(angle) * galaxyRadiusY,
    };
  });
  const stageAnchorByStage = new Map(stageNodes.map((node) => [node.stage, node]));
  const topicsByStage = new Map();
  data.topics.forEach((topic) => {
    if (!topicsByStage.has(topic.stage)) topicsByStage.set(topic.stage, []);
    topicsByStage.get(topic.stage).push(topic);
  });
  const topicNodes = data.topics.map((topic, index) => {
    const stageAnchor = stageAnchorByStage.get(topic.stage);
    const stageTopics = topicsByStage.get(topic.stage) || [];
    const topicIndex = Math.max(0, stageTopics.findIndex((item) => item.id === topic.id));
    const spread = stageTopics.length <= 1 ? 0 : (topicIndex / (stageTopics.length - 1) - 0.5);
    const baseAngle = stageAnchor?.angle ?? (-Math.PI / 2 + index * 0.3);
    const radialX = Math.cos(baseAngle);
    const radialY = Math.sin(baseAngle);
    const tangentX = -Math.sin(baseAngle);
    const tangentY = Math.cos(baseAngle);
    const count = data.kps.filter((kp) => kp.topic === topic.id).length;
    return {
      id: `topic-anchor:${topic.id}`,
      kind: "topic",
      layer: "topic",
      topic: topic.id,
      stage: topic.stage,
      name: topic.name,
      count,
      radius: 15,
      angle: baseAngle,
      x: (stageAnchor?.x || centerX) + radialX * 74 + tangentX * spread * 130,
      y: (stageAnchor?.y || centerY) + radialY * 74 + tangentY * spread * 92,
    };
  });
  const topicAnchorByTopic = new Map(topicNodes.map((node) => [node.topic, node]));
  const kpsByTopic = new Map();
  data.kps.forEach((kp) => {
    if (!kpsByTopic.has(kp.topic)) kpsByTopic.set(kp.topic, []);
    kpsByTopic.get(kp.topic).push(kp);
  });
  const kpNodes = data.kps.map((kp) => {
    const topicAnchor = topicAnchorByTopic.get(kp.topic);
    const topicKps = kpsByTopic.get(kp.topic) || [];
    const kpIndex = Math.max(0, topicKps.findIndex((item) => item.id === kp.id));
    const ring = Math.floor(kpIndex / 12);
    const ringStart = ring * 12;
    const ringCount = Math.max(1, Math.min(12, topicKps.length - ringStart));
    const localIndex = kpIndex - ringStart;
    const baseAngle = topicAnchor?.angle ?? 0;
    const localAngle = baseAngle + (localIndex / ringCount) * Math.PI * 2 + (ring % 2 ? Math.PI / ringCount : 0);
    const distance = 42 + ring * 24;
    return {
      ...kp,
      kind: "kp",
      radius: kp.star ? 10 : 7,
      x: (topicAnchor?.x || centerX) + Math.cos(localAngle) * distance,
      y: (topicAnchor?.y || centerY) + Math.sin(localAngle) * distance,
    };
  });
  const prelimNodeById = new Map([...stageNodes, ...topicNodes, ...kpNodes].map((node) => [node.id, node]));
  const cultureNodes = data.culture.map((item, index) => {
    const rels = (data.rels || []).filter((edge) => edge.r === "cul" && (edge.s === item.id || edge.t === item.id));
    const linked = rels
      .map((edge) => prelimNodeById.get(edge.s === item.id ? edge.t : edge.s))
      .filter(Boolean);
    if (linked.length) {
      const avgX = linked.reduce((sum, node) => sum + node.x, 0) / linked.length;
      const avgY = linked.reduce((sum, node) => sum + node.y, 0) / linked.length;
      return {
        ...item,
        kind: "culture",
        layer: "culture",
        radius: 13,
        star: false,
        x: centerX + (avgX - centerX) * 0.62,
        y: centerY + (avgY - centerY) * 0.62,
      };
    }
    const angle = -Math.PI / 2 + (index / Math.max(1, data.culture.length)) * Math.PI * 2;
    return {
      ...item,
      kind: "culture",
      layer: "culture",
      radius: 13,
      star: false,
      x: centerX + Math.cos(angle) * Math.min(width, height) * 0.18,
      y: centerY + Math.sin(angle) * Math.min(width, height) * 0.18,
    };
  });
  const nodes = [...stageNodes, ...topicNodes, ...kpNodes, ...cultureNodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const starRelTypes = new Set(["req", "scn", "con", "cul"]);
  const semanticLinks = data.rels
    .filter((edge) => starRelTypes.has(edge.r) && nodeIds.has(edge.s) && nodeIds.has(edge.t))
    .map((edge) => ({ ...edge, source: edge.s, target: edge.t, isAnchor: false }));
  const stageTopicLinks = topicNodes
    .filter((topic) => stageAnchorByStage.has(topic.stage))
    .map((topic) => {
      const stageAnchor = stageAnchorByStage.get(topic.stage);
      return {
        id: `anchor:${stageAnchor.id}:${topic.id}`,
        s: stageAnchor.id,
        t: topic.id,
        r: "anchor",
        source: stageAnchor.id,
        target: topic.id,
        anchorLevel: "stage-topic",
        isAnchor: true,
      };
    });
  const topicKpLinks = data.kps
    .filter((kp) => topicAnchorByTopic.has(kp.topic))
    .map((kp) => {
      const topicAnchor = topicAnchorByTopic.get(kp.topic);
      return {
        id: `anchor:${topicAnchor.id}:${kp.id}`,
        s: topicAnchor.id,
        t: kp.id,
        r: "anchor",
        source: topicAnchor.id,
        target: kp.id,
        anchorLevel: "topic-kp",
        isAnchor: true,
      };
    });
  const anchorLinks = [...stageTopicLinks, ...topicKpLinks];
  const links = [...anchorLinks, ...semanticLinks];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const focusedId = adminKgStarFocusId;
  const edgeVisible = (edge) => adminKgStarVisibleRelTypes.has(edge.isAnchor ? "anchor" : edge.r);
  const getFocusRelatedIds = (id) => {
    const ids = new Set([id]);
    const focusNode = nodeById.get(id);
    if (focusNode?.kind === "stage" && adminKgStarVisibleRelTypes.has("anchor")) {
      stageTopicLinks.forEach((edge) => {
        if (edge.s === id) ids.add(edge.t);
      });
      topicKpLinks.forEach((edge) => {
        if (ids.has(edge.s)) ids.add(edge.t);
      });
    }
    if (focusNode?.kind === "topic" && adminKgStarVisibleRelTypes.has("anchor")) {
      stageTopicLinks.forEach((edge) => {
        if (edge.t === id) ids.add(edge.s);
      });
      topicKpLinks.forEach((edge) => {
        if (edge.s === id) ids.add(edge.t);
      });
    }
    links.forEach((edge) => {
      if (!edgeVisible(edge)) return;
      if (ids.has(edge.s) || ids.has(edge.t)) {
        ids.add(edge.s);
        ids.add(edge.t);
      }
    });
    return ids;
  };
  const edgeIsFocused = (edge, ids, id) => edge.s === id || edge.t === id || (!edge.isAnchor && ids.has(edge.s) && ids.has(edge.t));
  const relatedIds = focusedId ? getFocusRelatedIds(focusedId) : new Set();

  const simNodes = nodes.map((node) => ({ ...node }));
  const simLinks = links.map((edge) => ({ ...edge }));
  d3lib.forceSimulation(simNodes)
    .force("link", d3lib.forceLink(simLinks).id((d) => d.id).distance((edge) => {
      if (!edge.isAnchor) return 155;
      return edge.anchorLevel === "stage-topic" ? 76 : 46;
    }).strength((edge) => {
      if (!edge.isAnchor) return 0.08;
      return edge.anchorLevel === "stage-topic" ? 0.28 : 0.18;
    }))
    .force("charge", d3lib.forceManyBody().strength((node) => node.kind === "stage" ? -180 : node.kind === "topic" ? -70 : node.kind === "culture" ? -120 : -18))
    .force("x", d3lib.forceX((node) => {
      return node.x ?? centerX;
    }).strength((node) => node.kind === "stage" ? 1 : node.kind === "topic" ? 0.72 : node.kind === "kp" ? 0.58 : 0.38))
    .force("y", d3lib.forceY((node) => {
      return node.y ?? centerY;
    }).strength((node) => node.kind === "stage" ? 1 : node.kind === "topic" ? 0.72 : node.kind === "kp" ? 0.58 : 0.38))
    .force("collide", d3lib.forceCollide().radius((d) => d.radius + (d.kind === "stage" ? 14 : d.kind === "topic" ? 10 : 7)))
    .stop()
    .tick(120);
  const boundaryPadding = 54;
  simNodes.forEach((node) => {
    node.x = Math.max(boundaryPadding, Math.min(width - boundaryPadding, node.x));
    node.y = Math.max(boundaryPadding, Math.min(height - boundaryPadding, node.y));
  });
  const positioned = new Map(simNodes.map((node) => [node.id, node]));

  const svg = d3lib.select(panel).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", "100%");
  const defs = svg.append("defs");
  defs.append("filter").attr("id", "kg-star-glow").html('<feGaussianBlur stdDeviation="3.5" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>');
  defs.append("filter").attr("id", "kg-star-blur").html('<feGaussianBlur stdDeviation="1.2"/>');
  const stageGrad = defs.append("radialGradient").attr("id", "kg-node-grad-stage").attr("cx", "35%").attr("cy", "28%").attr("r", "74%");
  stageGrad.append("stop").attr("offset", "0%").attr("stop-color", "#64748b").attr("stop-opacity", 0.98);
  stageGrad.append("stop").attr("offset", "45%").attr("stop-color", "#273956").attr("stop-opacity", 0.98);
  stageGrad.append("stop").attr("offset", "100%").attr("stop-color", "#172338").attr("stop-opacity", 1);
  Object.entries(KG_KP_TYPE_STYLES).forEach(([type, style]) => {
    const grad = defs.append("radialGradient").attr("id", `kg-kp-type-grad-${type}`).attr("cx", "35%").attr("cy", "28%").attr("r", "70%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.94);
    grad.append("stop").attr("offset", "35%").attr("stop-color", style.color).attr("stop-opacity", 0.94);
    grad.append("stop").attr("offset", "100%").attr("stop-color", style.color).attr("stop-opacity", 1);
  });
  Object.entries(KG_ACCEPTANCE_LAYER_TYPES).forEach(([layer, style]) => {
    const grad = defs.append("radialGradient").attr("id", `kg-node-grad-${layer}`).attr("cx", "35%").attr("cy", "28%").attr("r", "70%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.92);
    grad.append("stop").attr("offset", "35%").attr("stop-color", style.color).attr("stop-opacity", 0.92);
    grad.append("stop").attr("offset", "100%").attr("stop-color", style.color).attr("stop-opacity", 1);
  });

  const zoomLayer = svg.append("g");
  const zoom = d3lib.zoom().scaleExtent([0.45, 2.8]).on("zoom", (event) => zoomLayer.attr("transform", event.transform));
  svg.call(zoom).on("click", (event) => {
    if (event.target.tagName.toLowerCase() === "svg") {
      adminKgStarFocusId = null;
      renderAdminGraphNetwork();
    }
  });

  const galaxyGuide = zoomLayer.append("g").attr("opacity", 0.44);
  galaxyGuide.selectAll("circle").data(stageNodes).join("circle")
    .attr("cx", (node) => positioned.get(node.id)?.x || node.x)
    .attr("cy", (node) => positioned.get(node.id)?.y || node.y)
    .attr("r", 72)
    .attr("fill", "#ffffff")
    .attr("stroke", "#d9e2ef")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "4 8");

  const linkPath = (edge) => {
    const s = positioned.get(edge.s);
    const t = positioned.get(edge.t);
    if (!s || !t) return "";
    if (edge.isAnchor) return `M${s.x},${s.y}L${t.x},${t.y}`;
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const dr = Math.sqrt(dx * dx + dy * dy) * 1.22;
    return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
  };
  const anchorSel = zoomLayer.append("g").selectAll("path").data(simLinks.filter((edge) => edge.isAnchor)).join("path")
    .attr("d", linkPath)
    .attr("fill", "none")
    .attr("stroke", kgRelStyle("anchor").color)
    .attr("stroke-width", 2)
    .attr("opacity", (edge) => {
      if (!edgeVisible(edge)) return 0;
      if (!focusedId) return 0.42;
      return edgeIsFocused(edge, relatedIds, focusedId) ? 0.82 : 0.09;
    })
    .attr("pointer-events", (edge) => edgeVisible(edge) ? "stroke" : "none");
  const linkSel = zoomLayer.append("g").selectAll("path").data(simLinks.filter((edge) => !edge.isAnchor)).join("path")
    .attr("d", (edge) => {
      return linkPath(edge);
    })
    .attr("fill", "none")
    .attr("stroke", (edge) => kgRelStyle(edge.r).color)
    .attr("stroke-width", (edge) => kgRelStyle(edge.r).width)
    .attr("stroke-dasharray", (edge) => kgRelStyle(edge.r).dash || null)
    .attr("opacity", (edge) => {
      if (!edgeVisible(edge)) return 0;
      if (!focusedId) return 0.48;
      return edgeIsFocused(edge, relatedIds, focusedId) ? 0.92 : 0.07;
    })
    .attr("pointer-events", (edge) => edgeVisible(edge) ? "stroke" : "none")
    .attr("filter", (edge) => edge.r === "cul" ? "url(#kg-star-glow)" : null);

  const nodeSel = zoomLayer.append("g").selectAll("g").data(simNodes).join("g")
    .attr("class", "kg-star-node")
    .attr("transform", (node) => `translate(${node.x},${node.y})`)
    .style("cursor", "pointer")
    .attr("opacity", (node) => !focusedId || relatedIds.has(node.id) ? 1 : 0.16)
    .attr("filter", (node) => focusedId && !relatedIds.has(node.id) ? "url(#kg-star-blur)" : null)
    .on("click", async (event, node) => {
      event.stopPropagation();
      adminKgStarFocusId = node.id;
      showStarBackButton();
      const scale = node.kind === "stage" ? 1.35 : node.kind === "topic" ? 1.55 : 1.85;
      const transform = d3lib.zoomIdentity.translate(width / 2 - node.x * scale, height / 2 - node.y * scale).scale(scale);
      updateStarFocus(node.id);
      svg.transition().duration(680).ease(d3lib.easeCubicInOut).call(zoom.transform, transform);
      if (node.kind === "kp") {
        adminGraphFocusedPointId = node.id;
        await handleGraphNodeSelection(node.sourceKey || `KnowledgePoint:${node.name}`);
      }
    })
    .on("mousemove", (event, node) => {
      const stage = node.kind === "kp" ? data.stages.find((item) => item.id === node.stage) : null;
      const relHtml = node.kind === "stage"
        ? `${node.count} 个知识点<br>点击聚焦该环节星系`
        : node.kind === "topic"
          ? `${node.count} 个知识点<br>点击聚焦该二级主题`
          : kgRelationSummaryHtml(data, node.id) || "暂无关系";
      const meta = node.kind === "stage"
        ? `第 ${String(node.order).padStart(2, "0")} 环 · ${escapeHtmlText(node.en || "")}`
        : node.kind === "topic"
          ? "二级主题"
          : node.kind === "culture"
            ? "文化维度"
            : `${escapeHtmlText(stage?.zh || "未归属环节")} · ${escapeHtmlText(kgKpTypeStyle(node.kpType).label)}`;
      kgShowTooltip(adminGraphCanvas, `<strong>${escapeHtmlText(node.name)}</strong>${node.star ? " ★" : ""}<br>${meta}<br>${relHtml}`, event);
    })
    .on("mouseleave", () => kgHideTooltip(adminGraphCanvas));

  nodeSel.append("circle")
    .attr("r", (node) => node.radius)
    .attr("fill", (node) => {
      if (node.kind === "topic") return "#ffffff";
      if (node.kind === "kp") return `url(#kg-kp-type-grad-${node.kpType || "knowledge"})`;
      return `url(#kg-node-grad-${node.layer || "concept"})`;
    })
    .attr("stroke-width", (node) => node.id === focusedId ? 3 : node.kind === "topic" ? 2.2 : 1.8)
    .attr("stroke", (node) => {
      if (node.id === focusedId) return "#111827";
      if (node.kind === "topic") return "#94a3b8";
      return "#ffffff";
    })
    .attr("filter", (node) => node.kind === "stage" || node.star || node.kind === "culture" ? "url(#kg-star-glow)" : null);
  nodeSel.filter((node) => node.kind === "stage").append("text")
    .attr("text-anchor", "middle")
    .attr("y", -8)
    .attr("fill", "#d8e2ef")
    .attr("font-size", 10)
    .attr("font-weight", 900)
    .text((node) => String(node.order).padStart(2, "0"));
  nodeSel.filter((node) => node.kind === "stage").append("text")
    .attr("text-anchor", "middle")
    .attr("y", 8)
    .attr("fill", "#ffffff")
    .attr("font-size", 13)
    .attr("font-weight", 900)
    .text((node) => node.name.length > 4 ? node.name.slice(0, 4) : node.name);
  nodeSel.filter((node) => node.kind === "stage").append("text")
    .attr("text-anchor", "middle")
    .attr("y", 23)
    .attr("fill", "#e0a936")
    .attr("font-size", 10)
    .attr("font-weight", 850)
    .text((node) => `${node.count}点`);
  nodeSel.filter((node) => node.kind === "topic").append("text")
    .attr("text-anchor", "middle")
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 10)
    .attr("font-weight", 900)
    .attr("paint-order", "stroke")
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 4)
    .text((node) => node.name.length > 6 ? `${node.name.slice(0, 5)}…` : node.name);
  nodeSel.filter((node) => node.star).append("text").attr("text-anchor", "middle").attr("dy", 4).attr("fill", "#ffffff").attr("font-size", 11).attr("font-weight", 900).text("★");
  nodeSel.filter((node) => node.kind !== "stage" && node.kind !== "topic").append("text")
    .attr("x", 14)
    .attr("y", 4)
    .attr("fill", "#334155")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .attr("paint-order", "stroke")
    .attr("stroke", "#f8fafc")
    .attr("stroke-width", 4)
    .attr("opacity", (node) => node.star || node.kind === "culture" || node.id === focusedId ? 1 : 0)
    .text((node) => node.name.length > 11 ? `${node.name.slice(0, 10)}…` : node.name);

  if (focusedId && positioned.has(focusedId)) {
    const focusNode = positioned.get(focusedId);
    const scale = focusNode.kind === "stage" ? 1.35 : focusNode.kind === "topic" ? 1.55 : 1.85;
    svg.call(zoom.transform, d3lib.zoomIdentity.translate(width / 2 - focusNode.x * scale, height / 2 - focusNode.y * scale).scale(scale));
  }

  const legend = document.createElement("div");
  legend.className = "kg-legend-card";
  legend.innerHTML = ["anchor", "req", "scn", "con", "cul"].map((key) => {
    const style = KG_ACCEPTANCE_REL_TYPES[key];
    const active = adminKgStarVisibleRelTypes.has(key);
    return `
      <button type="button" class="kg-rel-toggle ${active ? "is-active" : ""}" data-kg-star-rel-toggle="${key}" title="点击显示/隐藏${escapeHtmlText(style.label)}线">
        <span class="kg-rel-toggle__check">${active ? "✓" : ""}</span>
        <span class="kg-rel-toggle__line" style="width:28px;border-top:3px solid ${style.color};${style.dash ? `border-top-style:dashed` : ""}"></span>
        <span>${escapeHtmlText(style.label)}</span>
      </button>
    `;
  }).join("") + `
    <div class="mt-2 border-t border-slate-200 pt-2 text-slate-400">
      <div class="mb-1 font-bold text-slate-500">知识点类型</div>
      <div class="flex flex-wrap gap-2">
        ${Object.entries(KG_KP_TYPE_STYLES).map(([key, style]) => `<span class="inline-flex items-center gap-1"><span style="width:9px;height:9px;border-radius:999px;background:${style.color};display:inline-block"></span>${escapeHtmlText(style.label)}</span>`).join("")}
      </div>
      <div class="mt-2">点击上方开关筛选线条；深色大圆=环节；白色中圆=二级主题。</div>
    </div>
  `;
  panel.appendChild(legend);
  legend.querySelectorAll("[data-kg-star-rel-toggle]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const key = button.dataset.kgStarRelToggle;
      if (adminKgStarVisibleRelTypes.has(key)) adminKgStarVisibleRelTypes.delete(key);
      else adminKgStarVisibleRelTypes.add(key);
      renderAdminGraphNetwork();
    });
  });
  renderKgPointSearch(panel, data, {
    view: "star",
    value: kgFindNode(data, adminKgStarFocusId)?.kind === "kp" ? kgFindNode(data, adminKgStarFocusId).name : "",
    placeholder: "搜索知识点",
    onSelect: (point) => {
      adminKgStarFocusId = point.id;
      adminGraphFocusedPointId = point.id;
      renderAdminGraphNetwork();
    },
  });
  if (focusedId) {
    showStarBackButton();
  }

  function showStarBackButton() {
    if (panel.querySelector(".kg-star-back")) return;
    const back = document.createElement("div");
    back.className = "kg-star-back";
    back.innerHTML = `<button type="button">返回全景</button>`;
    back.querySelector("button").addEventListener("click", () => {
      adminKgStarFocusId = null;
      renderAdminGraphNetwork();
    });
    panel.appendChild(back);
  }

  function updateStarFocus(id) {
    const nextRelated = getFocusRelatedIds(id);
    nodeSel.transition().duration(240)
      .attr("opacity", (node) => nextRelated.has(node.id) ? 1 : 0.16)
      .attr("filter", (node) => nextRelated.has(node.id) ? null : "url(#kg-star-blur)");
    anchorSel.transition().duration(240)
      .attr("opacity", (edge) => {
        if (!edgeVisible(edge)) return 0;
        return edgeIsFocused(edge, nextRelated, id) ? 0.82 : 0.08;
      });
    linkSel.transition().duration(240)
      .attr("opacity", (edge) => {
        if (!edgeVisible(edge)) return 0;
        return edgeIsFocused(edge, nextRelated, id) ? 0.92 : 0.07;
      });
  }
}

function renderKgWorkView(panel, data) {
  const stats = kgStats(data);
  if (!adminKgWorkExpandedStages.size && data.stages[0]) adminKgWorkExpandedStages.add(data.stages[0].id);
  if (!adminKgWorkFocusId && data.kps[0]) adminKgWorkFocusId = data.kps[0].id;
  const focusNode = kgFindNode(data, adminKgWorkFocusId);
  if (focusNode && focusNode.topic && focusNode.stage) {
    adminKgWorkExpandedStages.add(focusNode.stage);
    adminKgWorkExpandedTopics.add(focusNode.topic);
  }
  const focusRelations = focusNode ? kgRelationsForNode(data, focusNode.id) : [];
  panel.innerHTML = `<div class="kg-work-layout"><aside class="kg-work-tree custom-scrollbar" data-kg-work-tree></aside><section class="kg-work-graph" data-kg-work-graph></section></div>`;
  renderKgPointSearch(panel, data, {
    view: "work",
    value: focusNode?.name || "",
    placeholder: "搜索知识点",
    onSelect: async (point) => {
      adminKgWorkFocusId = point.id;
      adminGraphFocusedPointId = point.id;
      if (point.stage) adminKgWorkExpandedStages.add(point.stage);
      if (point.topic) adminKgWorkExpandedTopics.add(point.topic);
      renderAdminGraphNetwork();
      await handleGraphNodeSelection(point.sourceKey || `KnowledgePoint:${point.name}`);
    },
  });
  const tree = panel.querySelector("[data-kg-work-tree]");
  const graph = panel.querySelector("[data-kg-work-graph]");
  const topicsByStage = new Map();
  data.topics.forEach((topic) => {
    if (!topicsByStage.has(topic.stage)) topicsByStage.set(topic.stage, []);
    topicsByStage.get(topic.stage).push(topic);
  });
  const kpsByTopic = new Map();
  data.kps.forEach((kp) => {
    if (!kpsByTopic.has(kp.topic)) kpsByTopic.set(kp.topic, []);
    kpsByTopic.get(kp.topic).push(kp);
  });

  tree.innerHTML = data.stages.map((stage) => {
    const stageTopics = topicsByStage.get(stage.id) || [];
    const stageCount = data.kps.filter((kp) => kp.stage === stage.id).length;
    const stageOpen = adminKgWorkExpandedStages.has(stage.id);
    return `
      <div class="mb-1">
        <button type="button" class="kg-work-node" data-kg-work-stage="${escapeHtmlText(stage.id)}"><span>${stageOpen ? "▾" : "▸"}</span><span class="truncate">${String(stage.order).padStart(2, "0")} ${escapeHtmlText(stage.zh)}</span><span class="kg-work-node__count">${stageCount}</span></button>
        ${stageOpen ? `<div class="ml-4">${stageTopics.map((topic) => {
          const topicOpen = adminKgWorkExpandedTopics.has(topic.id);
          const topicKps = kpsByTopic.get(topic.id) || [];
          const layer = kgLayerStyle(topic.layer);
          return `
            <div>
              <button type="button" class="kg-work-node" data-kg-work-topic="${escapeHtmlText(topic.id)}"><span style="color:${layer.color}">${topicOpen ? "▾" : "▸"}</span><span class="truncate">${escapeHtmlText(topic.name)}</span><span class="kg-work-node__count">${topicKps.length}</span></button>
              ${topicOpen ? `<div class="ml-5">${topicKps.map((kp) => `<button type="button" class="kg-work-node ${kp.id === adminKgWorkFocusId ? "is-active" : ""}" data-kg-work-kp="${escapeHtmlText(kp.id)}"><span style="color:${kgLayerStyle(kp.layer).color}">•</span><span class="truncate">${escapeHtmlText(kp.name)}${kp.star ? " ★" : ""}</span><span></span></button>`).join("")}</div>` : ""}
            </div>
          `;
        }).join("")}</div>` : ""}
      </div>
    `;
  }).join("");
  tree.querySelectorAll("[data-kg-work-stage]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.kgWorkStage;
      if (adminKgWorkExpandedStages.has(id)) adminKgWorkExpandedStages.delete(id);
      else adminKgWorkExpandedStages.add(id);
      renderAdminGraphNetwork();
    });
  });
  tree.querySelectorAll("[data-kg-work-topic]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.kgWorkTopic;
      if (adminKgWorkExpandedTopics.has(id)) adminKgWorkExpandedTopics.delete(id);
      else adminKgWorkExpandedTopics.add(id);
      renderAdminGraphNetwork();
    });
  });
  tree.querySelectorAll("[data-kg-work-kp]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.kgWorkKp;
      adminKgWorkFocusId = id;
      adminGraphFocusedPointId = id;
      renderAdminGraphNetwork();
      const kp = kgFindNode(data, id);
      await handleGraphNodeSelection(kp?.sourceKey || `KnowledgePoint:${kp?.name || id}`);
    });
  });

  renderKgWorkFocusGraph(graph, data, focusNode, focusRelations, stats);
}

function renderKgWorkFocusGraph(container, data, focusNode, focusRelations, stats) {
  const d3lib = window.d3;
  const rect = container.getBoundingClientRect();
  const width = Math.max(620, rect.width || 760);
  const height = Math.max(520, rect.height || 620);
  container.innerHTML = "";
  if (!focusNode) {
    container.innerHTML = `<div class="kg-work-empty">请选择左侧知识点，右侧显示它的一跳关系网。</div>`;
    return;
  }
  const neighborIds = [];
  focusRelations.forEach((edge) => neighborIds.push(edge.s === focusNode.id ? edge.t : edge.s));
  const neighbors = [...new Set(neighborIds)].map((id) => kgFindNode(data, id)).filter(Boolean);
  const top = document.createElement("div");
  top.className = "absolute left-0 right-0 top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 text-sm font-bold text-slate-700";
  top.innerHTML = `<span style="color:#c58a18">聚焦</span><span>${escapeHtmlText(focusNode.name)}</span><span class="text-slate-400">与 ${neighbors.length} 个节点相连：</span><span>${kgRelationSummaryHtml(data, focusNode.id) || "暂无关系"}</span>`;
  container.appendChild(top);
  const svg = d3lib.select(container).append("svg").attr("viewBox", `0 0 ${width} ${height}`).attr("width", "100%").attr("height", "100%");
  const defs = svg.append("defs");
  defs.append("marker").attr("id", "kg-work-arrow").attr("markerWidth", 10).attr("markerHeight", 10).attr("refX", 8).attr("refY", 3).attr("orient", "auto").append("path").attr("d", "M0,0 L0,6 L8,3 z").attr("fill", "#64748b");
  const cx = width / 2;
  const cy = height / 2 + 20;
  const radius = Math.min(width, height) * 0.28;
  const neighborLayout = neighbors.map((node, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, neighbors.length);
    return { ...node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
  const pos = new Map([[focusNode.id, { ...focusNode, x: cx, y: cy }], ...neighborLayout.map((node) => [node.id, node])]);
  focusRelations.forEach((edge) => {
    const s = pos.get(edge.s);
    const t = pos.get(edge.t);
    if (!s || !t) return;
    const style = kgRelStyle(edge.r);
    svg.append("line").attr("x1", s.x).attr("y1", s.y).attr("x2", t.x).attr("y2", t.y)
      .attr("stroke", style.color).attr("stroke-width", style.width).attr("stroke-dasharray", style.dash || null).attr("marker-end", "url(#kg-work-arrow)").attr("opacity", 0.9);
    svg.append("text").attr("x", (s.x + t.x) / 2).attr("y", (s.y + t.y) / 2 - 8).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 800).attr("fill", style.color).attr("paint-order", "stroke").attr("stroke", "#f8fafc").attr("stroke-width", 5).text(style.label);
  });
  const allNodes = [{ ...focusNode, x: cx, y: cy, isFocus: true }, ...neighborLayout];
  const node = svg.append("g").selectAll("g").data(allNodes).join("g").attr("transform", (d) => `translate(${d.x},${d.y})`).style("cursor", "pointer")
    .on("click", async (event, nodeData) => {
      if (nodeData.kind === "culture") return;
      adminKgWorkFocusId = nodeData.id;
      adminGraphFocusedPointId = nodeData.id;
      renderAdminGraphNetwork();
      await handleGraphNodeSelection(nodeData.sourceKey || `KnowledgePoint:${nodeData.name}`);
    })
    .on("mousemove", (event, nodeData) => kgShowTooltip(adminGraphCanvas, `<strong>${escapeHtmlText(nodeData.name)}</strong><br>${nodeData.kind === "culture" ? "文化维度" : `${escapeHtmlText(kgLayerStyle(nodeData.layer).label)}层`}${nodeData.star ? " · ★迁移" : ""}<br>${kgRelationSummaryHtml(data, nodeData.id) || "暂无关系"}`, event))
    .on("mouseleave", () => kgHideTooltip(adminGraphCanvas));
  node.append("rect").attr("x", (d) => d.isFocus ? -62 : -54).attr("y", (d) => d.isFocus ? -22 : -18).attr("width", (d) => d.isFocus ? 124 : 108).attr("height", (d) => d.isFocus ? 44 : 36).attr("rx", 8)
    .attr("fill", (d) => d.isFocus ? kgLayerStyle(d.layer).color : "#ffffff")
    .attr("stroke", (d) => d.isFocus ? "#1f2937" : kgLayerStyle(d.layer).color)
    .attr("stroke-width", (d) => d.isFocus ? 2.6 : 1.8)
    .attr("filter", "drop-shadow(0 8px 15px rgba(15,23,42,0.14))");
  node.append("text").attr("text-anchor", "middle").attr("dy", 4).attr("font-size", 12).attr("font-weight", 900).attr("fill", (d) => d.isFocus ? "#ffffff" : "#26354d").text((d) => d.name.length > 10 ? `${d.name.slice(0, 9)}…` : d.name);
}

function renderKgAcceptanceGraph() {
  if (!adminGraphCanvas) return;
  ensureAdminRingGraphStyles();
  ensureKgAcceptanceStyles();
  const data = buildKgAcceptanceData();
  adminGraphCanvas.innerHTML = "";
  adminGraphCanvas.classList.add("admin-ring-graph-canvas", "kg-acceptance-canvas");
  adminGraphCanvas.classList.remove("overflow-auto");
  if (!data || !(data.stages || []).length || !(data.kps || []).length) {
    renderAdminRingNoData();
    return;
  }
  const d3lib = window.d3;
  if (!d3lib) {
    adminGraphCanvas.innerHTML = '<div class="p-6 text-sm text-slate-600">D3.js 未加载。请确认 CDN 可访问：https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js</div>';
    if (adminGraphStatus) adminGraphStatus.textContent = "D3.js 未加载，无法渲染验收图谱";
    return;
  }
  const panel = renderKgAcceptanceShell(data);
  if (!panel) return;
  if (adminKgAcceptanceView === "sunburst") renderKgSunburst(panel, data);
  else if (adminKgAcceptanceView === "star") renderKgStarGraph(panel, data);
  else if (adminKgAcceptanceView === "work") renderKgWorkView(panel, data);
  else renderKgOverview(panel, data);
  const stats = kgStats(data);
  if (adminGraphStatus) {
    adminGraphStatus.textContent = `验收图谱 · Neo4j 数据 · ${stats.stages} 环节 · ${stats.topics} 主题 · ${stats.kps} 知识点 · ${stats.rels} 语义关系 · ${stats.culture} 文化维度`;
  }
}

function buildRingRelationSummaryHtml(data, focusedPoint) {
  if (!focusedPoint) return "";
  const relations = getRingRelationsForPoint(data, focusedPoint.id);
  if (!relations.length) {
    return `<div><strong>【${escapeHtmlText(focusedPoint.name)}】</strong> 暂无已定义语义关系。</div>`;
  }
  return `
    <div><strong>【${escapeHtmlText(focusedPoint.name)}】</strong> 与 ${relations.length} 个节点有联系：</div>
    <div class="ring-graph-tip__relations">
      ${relations
        .map((edge) => {
          const otherId = edge.source === focusedPoint.id ? edge.target : edge.source;
          const style = getRingRelationStyle(edge.type);
          return `<span class="ring-graph-tip__chip"><span style="width:8px;height:8px;border-radius:999px;background:${style.color};display:inline-block"></span>${escapeHtmlText(style.label)} → ${escapeHtmlText(getRingNodeTitleById(data, otherId))}</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderRingFocusPanel(panel, data) {
  const stats = getRingGraphStats(data);
  const activeStage = getRingActiveStage(data);
  const focusedLocation = adminGraphFocusedPointId ? getRingPointLocation(data, adminGraphFocusedPointId) : null;
  const activeTopicId = [...adminRingExpandedTopics][0] || focusedLocation?.topic?.id || null;

  if (!activeStage) {
    panel.innerHTML = `
      <div class="ring-focus-panel__head">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">知识图谱总览</div>
        <div class="mt-1 text-lg font-bold text-slate-900">外贸谈判闭环</div>
        <div class="mt-1 text-xs text-slate-500">${stats.stages} 环节 · ${stats.topics} 二级主题 · ${stats.points} 知识点 · ${stats.relations} 关系</div>
      </div>
      <div class="ring-focus-empty">请选择左侧闭环中的一个环节。</div>
    `;
    return;
  }

  const topics = activeStage.topics || [];
  const relationCountByPoint = new Map();
  (data.relations || []).forEach((edge) => {
    relationCountByPoint.set(edge.source, (relationCountByPoint.get(edge.source) || 0) + 1);
    relationCountByPoint.set(edge.target, (relationCountByPoint.get(edge.target) || 0) + 1);
  });
  const pointCount = topics.reduce((sum, topic) => sum + (topic.kps || []).length, 0);

  panel.innerHTML = `
    <div class="ring-focus-panel__head">
      <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">第 ${String(activeStage.order || activeStage.index + 1 || 1).padStart(2, "0")} 环</div>
      <div class="mt-1 text-lg font-bold text-slate-900">${escapeHtmlText(activeStage.name)}</div>
      <div class="mt-1 text-xs text-slate-500">${topics.length} 二级主题 · ${pointCount} 知识点</div>
    </div>
    <div class="ring-focus-panel__body custom-scrollbar">
      <div class="space-y-3">
        ${topics
          .map((topic) => {
            const isActiveTopic = activeTopicId === topic.id;
            const points = topic.kps || [];
            return `
              <section class="space-y-2">
                <button type="button" class="ring-topic-card ${isActiveTopic ? "is-active" : ""}" data-ring-topic-panel-id="${escapeHtmlText(topic.id)}">
                  <span class="flex items-start justify-between gap-3">
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-semibold">${escapeHtmlText(topic.name)}</span>
                      <span class="mt-1 block text-xs text-slate-500">${points.length} 知识点</span>
                    </span>
                    <span class="shrink-0 text-xs text-blue-500">${isActiveTopic ? "收起" : "展开"}</span>
                  </span>
                </button>
                ${isActiveTopic ? `
                  <div class="space-y-2 pl-2">
                    ${points.length ? points
                      .map((point) => {
                        const style = getRingLayerStyle(point.layer);
                        const relationCount = relationCountByPoint.get(point.id) || 0;
                        const isFocused = adminGraphFocusedPointId === point.id;
                        return `
                          <button type="button" class="ring-kp-row ${isFocused ? "is-active" : ""}" style="border-left-color:${style.stroke}" data-ring-kp-panel-id="${escapeHtmlText(point.id)}">
                            <span class="flex items-start justify-between gap-2">
                              <span class="min-w-0">
                                <span class="block truncate text-xs font-semibold">${escapeHtmlText(point.name)}</span>
                                <span class="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                                  <span class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">${escapeHtmlText(style.label)}</span>
                                  ${point.term ? `<span class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">术语</span>` : ""}
                                  <span class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">${relationCount} 关系</span>
                                </span>
                              </span>
                              <span class="shrink-0 text-[10px] text-slate-400">详情</span>
                            </span>
                          </button>
                        `;
                      })
                      .join("") : `<div class="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">该二级主题下暂无知识点</div>`}
                  </div>
                ` : ""}
              </section>
            `;
          })
          .join("")}
      </div>
    </div>
  `;

  panel.querySelectorAll("[data-ring-topic-panel-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const topicId = button.dataset.ringTopicPanelId;
      adminRingExpandedTopics.clear();
      adminGraphFocusedPointId = null;
      if (activeTopicId !== topicId) adminRingExpandedTopics.add(topicId);
      renderAdminGraphNetwork();
    });
  });

  panel.querySelectorAll("[data-ring-kp-panel-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const pointId = button.dataset.ringKpPanelId;
      const location = getRingPointLocation(data, pointId);
      if (!location) return;
      adminRingExpandedTopics.clear();
      adminRingExpandedTopics.add(location.topic.id);
      adminGraphFocusedPointId = pointId;
      renderAdminGraphNetwork();
      await handleGraphNodeSelection(location.point.sourceKey || `KnowledgePoint:${location.point.name}`);
    });
  });
}

function renderAdminRingGraphMvp() {
  if (!adminGraphCanvas) return;
  renderKgAcceptanceGraph();
  return;
  ensureAdminRingGraphStyles();
  const data = getAdminRingGraphData();
  adminGraphCanvas.innerHTML = "";
  adminGraphCanvas.classList.add("admin-ring-graph-canvas");
  adminGraphCanvas.classList.remove("overflow-auto");

  if (!data || !(data.stages || []).length) {
    renderAdminRingNoData();
    return;
  }

  const stats = getRingGraphStats(data);
  const d3lib = window.d3;
  if (!d3lib) {
    adminGraphCanvas.innerHTML = '<div class="p-6 text-sm text-slate-600">D3.js 未加载。请确认 CDN 可访问：https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js</div>';
    if (adminGraphStatus) adminGraphStatus.textContent = "D3.js 未加载，无法渲染环形图谱";
    return;
  }

  const focusedPoint = adminGraphFocusedPointId ? getRingPointById(data, adminGraphFocusedPointId) : null;

  const tip = document.createElement("div");
  tip.className = "ring-graph-tip";
  const relationSummary = buildRingRelationSummaryHtml(data, focusedPoint);
  if (relationSummary) {
    tip.innerHTML = relationSummary;
  } else {
    tip.innerHTML = `<div><strong>点击环节</strong> 在右侧展开二级主题；点击二级主题展开知识点；点击知识点进入详情并显示语义关系。</div><div class="ring-graph-tip__relations"><span class="ring-graph-tip__chip">${escapeHtmlText(data.sourceLabel || "Neo4j 实时数据")}</span><span class="ring-graph-tip__chip">滚轮缩放</span><span class="ring-graph-tip__chip">拖拽平移</span></div>`;
  }
  adminGraphCanvas.appendChild(tip);

  const shell = document.createElement("div");
  shell.className = "ring-graph-shell";
  shell.innerHTML = `
    <div class="ring-graph-stage-area" data-ring-svg-host></div>
    <aside class="ring-focus-panel" data-ring-focus-panel></aside>
  `;
  adminGraphCanvas.appendChild(shell);

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "ring-graph-reset";
  resetBtn.textContent = "全部收回";
  resetBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    resetAdminRingGraphView();
  });
  adminGraphCanvas.appendChild(resetBtn);

  const panel = shell.querySelector("[data-ring-focus-panel]");
  renderRingFocusPanel(panel, data);

  const svgHost = shell.querySelector("[data-ring-svg-host]");
  const hostRect = svgHost.getBoundingClientRect();
  const width = Math.max(620, Math.round(hostRect.width || 760));
  const height = Math.max(460, Math.round(hostRect.height || 560));
  const layout = buildRingGraphLayout(data, width, height);
  const activeStage = getRingActiveStage(data);

  const svg = d3lib
    .select(svgHost)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .style("display", "block")
    .on("click", (event) => {
      if (event.target.tagName.toLowerCase() === "svg") {
        adminGraphFocusedPointId = null;
        renderAdminGraphNetwork();
      }
    });

  const defs = svg.append("defs");
  defs
    .append("marker")
    .attr("id", "ring-stage-arrow")
    .attr("markerWidth", 10)
    .attr("markerHeight", 10)
    .attr("refX", 8)
    .attr("refY", 3)
    .attr("orient", "auto")
    .attr("markerUnits", "strokeWidth")
    .append("path")
    .attr("d", "M0,0 L0,6 L8,3 z")
    .attr("fill", "#c8d2e4");

  const zoomLayer = svg.append("g").attr("class", "ring-zoom-layer");
  if (adminRingGraphZoomTransform) {
    zoomLayer.attr("transform", adminRingGraphZoomTransform.toString());
  }

  const ringLayer = zoomLayer
    .append("g")
    .attr("class", "ring-stage-layer")
    .attr("transform", `translate(${layout.cx},${layout.cy})`);

  const hub = zoomLayer
    .append("g")
    .attr("class", "ring-hub")
    .attr("transform", `translate(${layout.cx},${layout.cy})`);
  hub.append("circle").attr("r", 62).attr("fill", "#ffffff").attr("stroke", "#e2e8f0").attr("stroke-width", 1.2);
  hub.append("text").attr("text-anchor", "middle").attr("y", -4).attr("font-size", 18).attr("font-weight", 800).attr("fill", "#26354d").text("外贸谈判");
  hub.append("text").attr("text-anchor", "middle").attr("y", 18).attr("font-size", 11).attr("font-weight", 700).attr("letter-spacing", 1.2).attr("fill", "#9aa7bb").text(`CLOSED LOOP · ${data.stages.length} STAGES`);

  const arcGroup = ringLayer.append("g").attr("class", "ring-arcs");
  layout.stages.forEach((stage, index) => {
    const start = stage.angle + 0.11;
    const end = getRingStageBaseAngle((index + 1) % layout.stages.length, layout.stages.length) - 0.11;
    const normalizedEnd = end <= start ? end + Math.PI * 2 : end;
    arcGroup
      .append("path")
      .attr("d", describeRingArc(layout.radius, start, normalizedEnd))
      .attr("fill", "none")
      .attr("stroke", "#c8d2e4")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#ring-stage-arrow)");
  });

  const stageGroups = ringLayer
    .append("g")
    .attr("class", "ring-stages")
    .selectAll("g")
    .data(layout.stages)
    .join("g")
    .attr("class", "ring-stage")
    .attr("data-ring-stage-id", (stage) => stage.id)
    .attr("transform", (stage) => `translate(${stage.x},${stage.y})`)
    .style("cursor", "pointer")
    .style("opacity", (stage) => (!activeStage || activeStage.id === stage.id ? 1 : 0.62))
    .on("click", (event, stage) => {
      event.stopPropagation();
      const alreadyActive = activeStage?.id === stage.id;
      adminRingExpandedStages.clear();
      adminRingExpandedTopics.clear();
      adminGraphFocusedPointId = null;
      if (!alreadyActive) adminRingExpandedStages.add(stage.id);
      renderAdminGraphNetwork();
    })
    .on("mousemove", (event, stage) => {
      const topicCount = (stage.topics || []).length;
      const pointCount = (stage.topics || []).reduce((sum, topic) => sum + (topic.kps || []).length, 0);
      showRingTooltip(adminGraphCanvas, `<strong>${escapeHtmlText(stage.name)} / ${escapeHtmlText(stage.en || "")}</strong><br>第 ${String(stage.index + 1).padStart(2, "0")} 环<br>${topicCount} 个二级主题 · ${pointCount} 个知识点<br>点击在右侧查看层级`, event);
    })
    .on("mouseleave", () => hideRingTooltip(adminGraphCanvas));

  stageGroups
    .append("circle")
    .attr("r", (stage) => (activeStage?.id === stage.id ? 42 : 36))
    .attr("fill", (stage) => (activeStage?.id === stage.id ? "#d49a24" : "#21324d"))
    .attr("stroke", "#e7edf7")
    .attr("stroke-width", 2.5)
    .attr("filter", "drop-shadow(0 8px 12px rgba(15,23,42,0.16))");

  const stageLabels = stageGroups.append("g").attr("class", "ring-label");
  stageLabels.append("text").attr("text-anchor", "middle").attr("y", -12).attr("font-size", 10).attr("font-weight", 800).attr("fill", "#d7dfec").text((stage) => String(stage.index + 1).padStart(2, "0"));
  stageLabels.append("text").attr("text-anchor", "middle").attr("y", 7).attr("font-size", 15).attr("font-weight", 900).attr("fill", "#ffffff").text((stage) => stage.name.length > 5 ? `${stage.name.slice(0, 4)}…` : stage.name);

  const zoom = d3lib
    .zoom()
    .scaleExtent([0.6, 2.2])
    .on("zoom", (event) => {
      adminRingGraphZoomTransform = event.transform;
      zoomLayer.attr("transform", event.transform);
    });
  svg.call(zoom);
  if (adminRingGraphZoomTransform) {
    svg.call(zoom.transform, adminRingGraphZoomTransform);
  }

  if (adminGraphStatus) {
    const relationText = adminGraphFocusedPointId ? ` · 已聚焦 ${getRingRelationsForPoint(data, adminGraphFocusedPointId).length} 条关系` : "";
    adminGraphStatus.textContent = `闭环图谱 · Neo4j 数据 · ${stats.stages} 环节 · ${stats.topics} 二级主题 · ${stats.points} 知识点 · ${stats.relations} 语义关系${relationText}`;
  }
}

function escapeCourseMapSelectorValue(value) {
  const raw = String(value || "");
  if (typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(raw);
  }
  return raw.replace(/['"\\]/g, "\\$&");
}

function createCourseMapPointButton(point, relationsByPoint, keyword) {
  const id = point.id;
  const title = getGraphNodeTitle(point);
  const type = getGraphNodeType(point);
  const relations = relationsByPoint.get(id) || [];
  const matched = keyword && title.toLowerCase().includes(keyword);
  const tone = getCourseMapPointTone(type);
  const isFocused = adminGraphFocusedPointId === id;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.nodeId = id;
  button.className = [
    "group w-full rounded-md border px-3 py-2 text-left text-[11px] leading-tight transition",
    "focus:outline-none focus:ring-2 focus:ring-slate-500/30",
    isFocused ? tone.activeClassName : tone.className,
    matched ? "ring-2 ring-amber-300" : "",
  ].join(" ");
  button.innerHTML = `
    <span class="flex items-start justify-between gap-2">
      <span class="min-w-0">
        <span class="block truncate font-semibold">${escapeHtmlText(title)}</span>
        <span class="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
          <span class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">${escapeHtmlText(tone.label)}</span>
          ${relations.length ? `<span class="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5">${relations.length} 关系</span>` : ""}
        </span>
      </span>
      <span class="text-[10px] text-slate-400 group-hover:text-slate-700">查看</span>
    </span>
  `;
  button.addEventListener("click", () => {
    adminGraphFocusedPointId = id;
    renderAdminGraphNetwork();
    handleGraphNodeSelection(id);
  });
  return button;
}

function countCourseMapLinkedPoints(stageBucket) {
  const topicPoints = (stageBucket.topics || []).reduce((topicSum, topicBucket) => {
    const categoryCount = [...topicBucket.categories.values()].reduce((count, category) => count + category.points.length, 0);
    return topicSum + topicBucket.points.length + categoryCount;
  }, 0);
  return topicPoints + (stageBucket.loosePoints || []).length;
}

function isCourseMapStageCollapsed(stageId) {
  return !adminGraphMapExpanded || expandedStages.has(stageId);
}

function isCourseMapTopicCollapsed(topicId) {
  return !adminGraphMapExpanded || expandedTopics.has(topicId);
}

function renderCourseMapRelationOverlay(surface, model) {
  surface.querySelector("[data-relation-overlay]")?.remove();
  const focusedId = adminGraphFocusedPointId;
  if (!focusedId) return;

  const focusedEl = surface.querySelector(`[data-node-id="${escapeCourseMapSelectorValue(focusedId)}"]`);
  if (!focusedEl) return;

  const relatedEdges = (model.relationEdges || []).filter((edge) => edge.source === focusedId || edge.target === focusedId);
  if (!relatedEdges.length) return;

  const surfaceRect = surface.getBoundingClientRect();
  const width = Math.max(surface.scrollWidth, surfaceRect.width);
  const height = Math.max(surface.scrollHeight, surfaceRect.height);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("data-relation-overlay", "true");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.classList.add("pointer-events-none", "absolute", "left-0", "top-0", "z-10");
  svg.style.width = `${width}px`;
  svg.style.height = `${height}px`;

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(defs);

  relatedEdges.forEach((edge, index) => {
    const targetId = edge.source === focusedId ? edge.target : edge.source;
    const targetEl = surface.querySelector(`[data-node-id="${escapeCourseMapSelectorValue(targetId)}"]`);
    if (!targetEl) return;
    const sourceRect = focusedEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const x1 = sourceRect.left + sourceRect.width / 2 - surfaceRect.left;
    const y1 = sourceRect.top + sourceRect.height / 2 - surfaceRect.top;
    const x2 = targetRect.left + targetRect.width / 2 - surfaceRect.left;
    const y2 = targetRect.top + targetRect.height / 2 - surfaceRect.top;
    const style = getCourseMapRelationStyle(edge.type);
    const markerId = `course-map-arrow-${index}`;
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", markerId);
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    marker.setAttribute("markerUnits", "strokeWidth");
    marker.innerHTML = `<path d="M0,0 L0,6 L8,3 z" fill="${style.color}"></path>`;
    defs.appendChild(marker);

    const dx = Math.max(80, Math.abs(x2 - x1) * 0.45);
    const curve = y2 >= y1 ? 54 : -54;
    const c1x = x1 + (x2 >= x1 ? dx : -dx);
    const c2x = x2 - (x2 >= x1 ? dx : -dx);
    const c1y = y1 + curve;
    const c2y = y2 - curve;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", style.color);
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("marker-end", `url(#${markerId})`);
    if (style.dash) path.setAttribute("stroke-dasharray", style.dash);
    svg.appendChild(path);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String((x1 + x2) / 2));
    label.setAttribute("y", String((y1 + y2) / 2 - 8));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "11");
    label.setAttribute("font-weight", "600");
    label.setAttribute("fill", style.color);
    label.setAttribute("paint-order", "stroke");
    label.setAttribute("stroke", "#f8f5ef");
    label.setAttribute("stroke-width", "4");
    label.textContent = style.label;
    svg.appendChild(label);
  });

  surface.prepend(svg);
}

function renderCourseMapMvp(nodesRaw, edgesRaw) {
  if (!adminGraphCanvas) return;
  const keyword = (state.admin.graph.searchKeyword || "").trim().toLowerCase();
  const model = buildCourseMapModel(nodesRaw, edgesRaw);
  adminGraphCanvas.innerHTML = "";
  adminGraphCanvas.classList.add("overflow-auto");

  const shell = document.createElement("div");
  shell.className = "min-h-full bg-[#f8f5ef] p-4 text-slate-800";

  const totalTopics = model.stages.reduce((sum, item) => sum + item.topics.length, 0);
  const linkedPoints = model.stages.reduce((sum, item) => sum + countCourseMapLinkedPoints(item), 0);
  const focusedNode = adminGraphFocusedPointId ? model.nodeMap.get(adminGraphFocusedPointId) : null;
  const legend = getCourseMapRelationLegend(model.relationEdges);
  const toolbar = document.createElement("div");
  toolbar.className = "mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 pb-3 text-xs";
  toolbar.innerHTML = `
    <div>
      <div class="text-base font-semibold text-slate-900">外贸谈判知识图谱</div>
      <div class="mt-1 text-slate-500">${model.stages.length} 环节 · ${totalTopics} 主题 · ${model.points.length} 下层节点 · ${model.relationEdges.length} 语义关系</div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-slate-500">点亮关系</span>
      ${
        legend.length
          ? legend
              .slice(0, 7)
              .map((item) => `<span class="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-stone-100 px-2.5 py-1 text-slate-700"><span class="h-2 w-2 rounded-full" style="background:${item.color}"></span>${escapeHtmlText(item.label)}</span>`)
              .join("")
          : '<span class="text-slate-400">暂无语义关系</span>'
      }
      ${
        focusedNode
          ? `<button type="button" class="rounded-full border border-stone-300 bg-white px-3 py-1 text-slate-700 hover:border-slate-500" data-clear-focus>取消聚焦</button>`
          : ""
      }
    </div>
  `;
  toolbar.querySelector("[data-clear-focus]")?.addEventListener("click", () => {
    adminGraphFocusedPointId = null;
    renderAdminGraphNetwork();
  });
  shell.appendChild(toolbar);

  const stageBuckets = model.stages.length ? model.stages : [{ stage: { id: "unassigned", name: "未归入阶段" }, topics: [], loosePoints: model.points }];
  const viewport = document.createElement("div");
  viewport.className = "overflow-auto";
  const surface = document.createElement("div");
  surface.className = "relative min-h-[620px] py-8";
  surface.style.minWidth = `${Math.max(1180, stageBuckets.length * 172)}px`;

  const timeline = document.createElement("div");
  timeline.className = "relative z-20 flex items-start gap-10 px-6";

  stageBuckets.forEach(({ stage, topics, loosePoints }) => {
    const stageTitle = getGraphNodeTitle(stage);
    const stageId = stage.id || stageTitle;
    const isStageCollapsed = isCourseMapStageCollapsed(stageId);
    const column = document.createElement("section");
    column.className = "w-32 shrink-0";
    const topicCount = topics.length;
    const pointCount = countCourseMapLinkedPoints({ topics, loosePoints });
    column.innerHTML = `
      <div class="relative mb-16 flex h-14 items-center justify-center">
        <button type="button" class="w-full rounded-lg bg-stone-300 px-3 py-2 text-center text-white shadow-sm transition hover:bg-stone-400 ${isStageCollapsed ? "opacity-70" : ""}" data-stage-toggle="${escapeHtmlAttribute(stageId)}">
          <span class="block text-[10px] font-semibold leading-none">${escapeHtmlText(String(getCourseMapStageOrder(stage) || "").padStart(2, "0"))}</span>
          <span class="mt-1 block truncate text-sm font-semibold">${escapeHtmlText(stageTitle)}</span>
          <span class="block truncate text-[10px] opacity-80">${topicCount} 主题 · ${pointCount} 点</span>
        </button>
      </div>
    `;
    column.querySelector("[data-stage-toggle]")?.addEventListener("click", () => {
      if (expandedStages.has(stageId)) expandedStages.delete(stageId);
      else expandedStages.add(stageId);
      renderAdminGraphNetwork();
    });

    const body = document.createElement("div");
    body.className = isStageCollapsed ? "hidden" : "relative space-y-5 border-l border-stone-300 pl-3";
    topics.forEach((topicBucket) => {
      const topic = topicBucket.topic;
      const topicId = topic.id || getGraphNodeTitle(topic);
      const isTopicCollapsed = isCourseMapTopicCollapsed(topicId);
      const topicEl = document.createElement("div");
      topicEl.className = "relative";
      topicEl.innerHTML = `
        <button type="button" class="mb-2 w-full rounded-md border border-sky-400 bg-white px-2.5 py-2 text-left text-[11px] font-semibold text-slate-800 shadow-[inset_4px_0_0_#2f77b9] hover:border-sky-600" data-topic-toggle="${escapeHtmlAttribute(topicId)}">
          <span class="block truncate">${escapeHtmlText(getGraphNodeTitle(topic))}</span>
          <span class="mt-1 block text-[10px] font-normal text-slate-400">${isTopicCollapsed ? "已收起" : "点击收起"} · 流程/概念</span>
        </button>
      `;
      topicEl.querySelector("[data-topic-toggle]")?.addEventListener("click", () => {
        if (expandedTopics.has(topicId)) expandedTopics.delete(topicId);
        else expandedTopics.add(topicId);
        renderAdminGraphNetwork();
      });

      const pointList = document.createElement("div");
      pointList.className = isTopicCollapsed ? "hidden" : "space-y-2";
      const directPoints = topicBucket.points || [];
      directPoints.forEach((point) => pointList.appendChild(createCourseMapPointButton(point, model.relationsByPoint, keyword)));
      [...topicBucket.categories.values()].forEach((categoryBucket) => {
        if (!categoryBucket.points.length) return;
        const categoryTitle = getGraphNodeTitle(categoryBucket.category);
        const label = document.createElement("div");
        label.className = "pt-1 text-[10px] font-semibold text-slate-400";
        label.textContent = categoryTitle;
        pointList.appendChild(label);
        categoryBucket.points.forEach((point) => pointList.appendChild(createCourseMapPointButton(point, model.relationsByPoint, keyword)));
      });
      if (!pointList.children.length) {
        pointList.innerHTML = '<p class="rounded-lg border border-dashed border-slate-800 px-3 py-2 text-[11px] text-slate-500">暂无知识点</p>';
      }
      topicEl.appendChild(pointList);
      body.appendChild(topicEl);
    });
    if (loosePoints.length) {
      const loose = document.createElement("div");
      loose.className = "space-y-2";
      loose.innerHTML = '<div class="text-[10px] font-semibold text-slate-400">未归入主题</div>';
      const list = document.createElement("div");
      list.className = "space-y-2";
      loosePoints.forEach((point) => list.appendChild(createCourseMapPointButton(point, model.relationsByPoint, keyword)));
      loose.appendChild(list);
      body.appendChild(loose);
    }
    column.appendChild(body);
    timeline.appendChild(column);
  });

  stageBuckets.slice(0, -1).forEach((_item, index) => {
    const arrow = document.createElement("div");
    arrow.className = "absolute top-[54px] h-px bg-stone-400";
    arrow.style.left = `${118 + index * 168}px`;
    arrow.style.width = "42px";
    arrow.innerHTML = '<span class="absolute -right-1 -top-1 h-2 w-2 rotate-45 border-r border-t border-stone-500"></span>';
    timeline.appendChild(arrow);
  });

  surface.appendChild(timeline);
  viewport.appendChild(surface);
  shell.appendChild(viewport);
  adminGraphCanvas.appendChild(shell);
  requestAnimationFrame(() => renderCourseMapRelationOverlay(surface, model));

  if (adminGraphStatus) {
    const focusText = focusedNode ? ` · 已聚焦「${getGraphNodeTitle(focusedNode)}」` : " · 点击知识点查看关系";
    adminGraphStatus.textContent = `十环节课程图谱 MVP · 阶段 ${model.stages.length} · 主题 ${totalTopics} · 下层节点 ${model.points.length}${focusText}`;
  }
}

// 渲染后台知识图谱：MVP 使用 D3 固定环形闭环，先不依赖后端图谱数据。
function renderAdminGraphNetwork() {
  if (!adminGraphCanvas) {
    return;
  }

  if (adminGraphNetwork && typeof adminGraphNetwork.dispose === "function") {
    adminGraphNetwork.dispose();
    adminGraphNetwork = null;
  }
  if (adminGraphRenderer === "ring") {
    renderAdminRingGraphMvp();
    return;
  }

  const networkData = state.admin.graph.network || { nodes: [], edges: [] };
  const nodesRaw = Array.isArray(networkData.nodes) ? networkData.nodes : [];
  const edgesRaw = Array.isArray(networkData.edges) ? networkData.edges : [];

  if (nodesRaw.length === 0) {
    if (adminGraphStatus) {
      adminGraphStatus.textContent = "暂无可展示的节点，请检查数据或关系";
    }
    return;
  }

  renderCourseMapMvp(nodesRaw, edgesRaw);
}

async function refreshAdminGraph() {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  if (!adminGraphCanvas) {
    return;
  }
  if (adminGraphStatus) {
    adminGraphStatus.textContent = "加载知识图谱中...";
  }
  if (adminGraphRenderer === "ring") {
    renderAdminGraphNetwork();
  }
  try {
    const keyword =
      (document.getElementById('admin-graph-search-graph')?.value ||
        document.getElementById('admin-graph-search')?.value ||
        '').trim();

    const [networkResp, knowledgeResp] = await Promise.all([
      fetchWithAuth(`/api/graph/network?limit=800${keyword ? `&search=${encodeURIComponent(keyword)}` : ''}`),
      fetchWithAuth("/api/graph/knowledge-points"),
    ]);

    // --- Graph network fetch ---
    const networkText = await networkResp.clone().text();
    if (!networkResp.ok) {
      console.error("[Graph] /api/graph/network failed", networkResp.status, networkText);
      if (networkResp.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error(networkText || "无法加载知识图谱");
    }
    let networkData;
    try {
      networkData = networkText ? JSON.parse(networkText) : { nodes: [], edges: [] };
    } catch (jsonErr) {
      console.error("[Graph] network JSON parse error", jsonErr, networkText);
      throw new Error("知识图谱数据解析失败");
    }
    state.admin.graph.network = networkData || { nodes: [], edges: [] };
    state.admin.graph.searchKeyword = keyword.toLowerCase();

    // --- Knowledge list fetch (best-effort) ---
    const knowledgeText = await knowledgeResp.clone().text();
    if (!knowledgeResp.ok) {
      console.error("[Graph] /api/graph/knowledge-points failed", knowledgeResp.status, knowledgeText);
    } else {
      try {
        const knowledgeData = knowledgeText ? JSON.parse(knowledgeText) : {};
        state.admin.graph.knowledgePoints = knowledgeData.knowledgePoints || [];
      } catch (jsonErr) {
        console.error("[Graph] knowledge JSON parse error", jsonErr, knowledgeText);
      }
    }

    renderAdminGraphKnowledgeList();
    renderAdminGraphNetwork();
  } catch (error) {
    console.error("[Graph] refreshAdminGraph error", error);
    if (adminGraphStatus && adminGraphRenderer !== "ring") {
      adminGraphStatus.textContent = error.message || "加载知识图谱失败";
    }
  }
}

// 重置任务模版（blueprint）表单，可传入已有数据进行回填。
function resetBlueprintForm(blueprint = null) {
  if (!adminBlueprintForm) return;
  const blueprintData = blueprint || {};
  const blueprintScenario =
    blueprintData.blueprint && typeof blueprintData.blueprint === "object"
      ? blueprintData.blueprint
      : {};
  const studentCompany =
    blueprintScenario.student_company &&
    typeof blueprintScenario.student_company === "object"
      ? blueprintScenario.student_company
      : {};
  const aiCompany =
    blueprintScenario.ai_company && typeof blueprintScenario.ai_company === "object"
      ? blueprintScenario.ai_company
      : {};
  const product =
    blueprintScenario.product && typeof blueprintScenario.product === "object"
      ? blueprintScenario.product
      : {};
  const price =
    product.price_expectation && typeof product.price_expectation === "object"
      ? product.price_expectation
      : {};

  adminBlueprintIdInput.value = blueprintData.id || "";
  adminBlueprintTitle.value =
    blueprintScenario.scenario_title || blueprintData.title || "";
  adminBlueprintSummary.value =
    blueprintScenario.scenario_summary || blueprintData.description || "";
  adminBlueprintStudentRole.value = blueprintScenario.student_role || "";
  adminBlueprintAiRole.value = blueprintScenario.ai_role || "";
  adminBlueprintStudentCompanyName.value = studentCompany.name || "";
  adminBlueprintStudentCompanyProfile.value = studentCompany.profile || "";
  adminBlueprintAiCompanyName.value = aiCompany.name || "";
  adminBlueprintAiCompanyProfile.value = aiCompany.profile || "";
  adminBlueprintAiRules.value = joinLines(blueprintScenario.ai_rules || []);
  adminBlueprintProductName.value = product.name || "";
  adminBlueprintProductSpecs.value = product.specifications || "";
  adminBlueprintProductQuantity.value = product.quantity_requirement || "";
  adminBlueprintStudentPrice.value = price.student_target || "";
  adminBlueprintAiBottom.value = price.ai_bottom_line || "";
  adminBlueprintMarket.value = blueprintScenario.market_landscape || "";
  adminBlueprintTimeline.value = blueprintScenario.timeline || "";
  adminBlueprintLogistics.value = blueprintScenario.logistics || "";
  adminBlueprintNegotiationTargets.value = joinLines(
    blueprintScenario.negotiation_targets || [],
  );
  adminBlueprintRisks.value = joinLines(blueprintScenario.risks || []);
  adminBlueprintChecklist.value = joinLines(blueprintScenario.checklist || []);
  adminBlueprintKnowledge.value = joinLines(
    blueprintScenario.knowledge_points || [],
  );
  adminBlueprintOpening.value = blueprintScenario.opening_message || "";
  adminBlueprintDifficulty.value = blueprintData.difficulty || "balanced";
  updateInlineStatus(adminBlueprintGeneratorStatus, "");
}

// 选择某个 Blueprint 以回填表单并高亮列表。
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

// 从 Blueprint 表单读取字段并组装提交 payload。
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

// 渲染 Blueprint 列表卡片，展示难度、关联章节等信息。
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
    const scenarioPreview =
      item && item.scenarioPreview && typeof item.scenarioPreview === "object"
        ? item.scenarioPreview
        : {};
    const displayTitle = item.title || scenarioPreview.title || "蓝图";
    const displaySummary = scenarioPreview.summary || "";
    li.className = `rounded-2xl border p-4 text-sm transition ${
      isActive
        ? "border-purple-400/60 bg-purple-500/10"
        : "border-slate-800 bg-slate-900/70 hover:border-purple-400/40"
    }`;
    li.dataset.blueprintId = item.id;
    li.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="font-semibold text-white">${displayTitle}</p>
          <p class="text-xs text-slate-400">${displaySummary}</p>
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

// 初始化作业表单的章节下拉选项（过滤掉没有关卡的章节）。
function populateAssignmentChapterOptions() {
  if (!adminAssignmentChapter) return;
  const selected = adminAssignmentChapter.value;
  adminAssignmentChapter.innerHTML = '<option value="">不关联</option>';
  (state.chapters || []).forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.displayTitle || chapter.title || chapter.id;
    if (chapter.id === selected) {
      option.selected = true;
    }
    adminAssignmentChapter.appendChild(option);
  });
  updateAssignmentSectionOptions();
}

// 根据章节选择刷新对应的关卡下拉框。
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

// 填充作业表单的 Blueprint 选项，便于复用模版。
function populateAssignmentBlueprintOptions() {
  if (!adminAssignmentBlueprint) return;
  const selected = adminAssignmentBlueprint.value;
  adminAssignmentBlueprint.innerHTML = '<option value="">手动填写</option>';
  (state.admin.blueprints || []).forEach((blueprint) => {
    const option = document.createElement("option");
    option.value = blueprint.id;
    const scenarioPreview =
      blueprint && blueprint.scenarioPreview &&
      typeof blueprint.scenarioPreview === "object"
        ? blueprint.scenarioPreview
        : {};
    option.textContent =
      blueprint.title || scenarioPreview.title || blueprint.id;
    if (blueprint.id === selected) {
      option.selected = true;
    }
    adminAssignmentBlueprint.appendChild(option);
  });
}

// 填充 Blueprint 表单中的章节下拉框。
function populateBlueprintChapterOptions() {
  if (!adminBlueprintChapter) return;
  const selected = adminBlueprintChapter.value;
  adminBlueprintChapter.innerHTML = '<option value="">选择章节</option>';
  (state.chapters || []).forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.displayTitle || chapter.title || chapter.id;
    if (chapter.id === selected) {
      option.selected = true;
    }
    adminBlueprintChapter.appendChild(option);
  });
  updateBlueprintSectionOptions();
}

// 根据章节选择刷新 Blueprint 的关卡下拉框。
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

// 将选定场景信息写入作业表单（标题/角色/难度等）。
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

// 将场景信息回填到 Blueprint 编辑表单。
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

// 渲染学生选取列表，支持全选、搜索和已分配标识。
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

// 渲染已创建的作业列表卡片。
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

// 将指定作业数据填充到表单，便于编辑。
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

// 选中并加载某个作业，刷新表单与学生名单。
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

// 在“学生视角”区域渲染已分配的作业及完成状态。
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

// 通用渲染函数：将统计数据数组转成列表 DOM。
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

// 展示后台仪表盘的关键统计（练习、评估、反馈等）。
function renderAdminTrendChart(trends) {
  if (!adminTrendChart) return;
  if (adminTrendEmpty) adminTrendEmpty.classList.toggle("hidden", trends && trends.length > 0);

  if (!trends || trends.length === 0) {
    if (adminTrendChartInstance) {
      adminTrendChartInstance.dispose();
      adminTrendChartInstance = null;
    }
    return;
  }
  if (typeof window === "undefined" || typeof window.echarts === "undefined") {
    if (adminTrendEmpty) {
      adminTrendEmpty.textContent = "ECharts 未加载，无法展示趋势图";
      adminTrendEmpty.classList.remove("hidden");
    }
    return;
  }

  const grouped = new Map();
  trends.forEach((trend) => {
    const weekKey = trend.week || trend.weekLabel || "unknown";
    const label = trend.weekLabel || trend.week || "周度";
    const value =
      trend.averageScore !== null && trend.averageScore !== undefined
        ? Number(trend.averageScore)
        : null;
    if (value === null || Number.isNaN(value)) {
      return;
    }
    const current = grouped.get(weekKey) || { label, sum: 0, count: 0, sample: 0 };
    current.sum += value;
    current.count += 1;
    current.sample += trend.sampleSize || 0;
    grouped.set(weekKey, current);
  });

  const data = Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, item]) => ({
      label: item.label,
      value: item.count ? item.sum / item.count : 0,
      sample: item.sample,
    }));

  if (!data.length) {
    if (adminTrendChartInstance) {
      adminTrendChartInstance.dispose();
      adminTrendChartInstance = null;
    }
    if (adminTrendEmpty) {
      adminTrendEmpty.classList.remove("hidden");
    }
    return;
  }

  if (adminTrendChartInstance) {
    adminTrendChartInstance.dispose();
  }
  adminTrendChartInstance = window.echarts.init(adminTrendChart);
  adminTrendChartInstance.setOption({
    tooltip: {
      trigger: "axis",
      formatter: (params) => {
        const point = params && params[0];
        if (!point) return "";
        const sample = point.data && point.data.sample ? `样本 ${point.data.sample}` : "暂无样本";
        return `${point.axisValue}<br/>周均分：${point.data ? Math.round(point.data.value) : 0}｜${sample}`;
      },
    },
    grid: { left: 45, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: "category",
      data: data.map((item) => item.label),
      axisLine: { lineStyle: { color: "#64748b" } },
      axisLabel: { color: "#cbd5e1" },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { formatter: "{value} 分", color: "#cbd5e1" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.2)" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: "#60a5fa", width: 2 },
        areaStyle: {
          color: new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(96, 165, 250, 0.45)" },
            { offset: 1, color: "rgba(59, 130, 246, 0.05)" },
          ]),
        },
        data: data.map((item) => ({
          value: Number(item.value.toFixed(2)),
          sample: item.sample,
        })),
      },
    ],
    color: ["#60a5fa"],
  });
}

function renderActionHotspots(items) {
  if (!adminActionHotspots) return;
  adminActionHotspots.innerHTML = "";
  if (adminActionEmpty) {
    adminActionEmpty.classList.toggle("hidden", items && items.length > 0);
  }
  if (!items || items.length === 0) {
    return;
  }
  items.forEach((item) => {
    const raw = item && (item.label || item.actionItem || "");
    let title = raw;
    let body = "";
    const markdownMatch = raw.match(/\*\*(.+?)\*\*\s*[:：]\s*(.+)/);
    if (markdownMatch) {
      title = markdownMatch[1];
      body = markdownMatch[2];
    } else if (raw.includes("：")) {
      const [left, right] = raw.split(/：(.+)/);
      title = left;
      body = right || "";
    } else if (raw.includes(":")) {
      const [left, right] = raw.split(/:(.+)/);
      title = left;
      body = right || "";
    }
    const card = document.createElement("div");
    card.className = "feedback-card";
    card.innerHTML = `
      <div class="feedback-card__title">
        <span>${escapeHtmlText(title || "改进建议")}</span>
        <span class="admin-action-count">x${item.count || 0}</span>
      </div>
      <div class="feedback-card__body">${escapeHtmlText(body || "展开查看详细描述")}</div>
    `;
    card.addEventListener("click", () => {
      card.classList.toggle("active");
    });
    adminActionHotspots.appendChild(card);
  });
}

function getErrorRateColor(rate) {
  if (rate >= 70) return "linear-gradient(90deg, #ef4444, #b91c1c)";
  if (rate >= 40) return "linear-gradient(90deg, #fb7185, #f43f5e)";
  return "linear-gradient(90deg, #fbbf24, #f97316)";
}

function renderKnowledgeWeakness(items) {
  if (!adminKnowledgeWeakness) return;
  adminKnowledgeWeakness.innerHTML = "";
  if (adminKnowledgeEmpty) {
    adminKnowledgeEmpty.classList.toggle("hidden", items && items.length > 0);
  }
  if (!items || items.length === 0) {
    return;
  }
  items.forEach((item) => {
    const label = normalizeKnowledgeLabel(item.label || item.knowledgePoint || item.name);
    const errorRate =
      item.averageScore !== null && item.averageScore !== undefined
        ? Math.max(0, Math.min(100, 100 - item.averageScore))
        : null;
    const bar = document.createElement("button");
    bar.type = "button";
    bar.className = "error-bar w-full text-left";
    bar.innerHTML = `
      <span class="error-bar__label">${escapeHtmlText(label || "知识点")}</span>
      <span class="error-bar__track">
        <span class="error-bar__fill" style="width: ${errorRate !== null ? errorRate : 12}%; background: ${getErrorRateColor(errorRate || 0)};"></span>
      </span>
      <span class="error-bar__meta">${item.count || 0} 次${errorRate !== null ? ` · ${Math.round(errorRate)}%` : ""}</span>
    `;
    bar.addEventListener("click", () => openKnowledgeDrawer(item, errorRate, label));
    adminKnowledgeWeakness.appendChild(bar);
  });
}

function openKnowledgeDrawer(item, errorRate, labelOverride = "") {
  if (!adminKnowledgeDrawer) return;
  const students = Array.isArray(item.students) ? item.students : [];
  const label = labelOverride || normalizeKnowledgeLabel(item.label || item.knowledgePoint || item.name);
  if (adminKnowledgeDrawerTitle) adminKnowledgeDrawerTitle.textContent = label || "知识点详情";
  if (adminKnowledgeDrawerHint) {
    const errorText = errorRate !== null && errorRate !== undefined ? `错误率 ${Math.round(errorRate)}%` : "暂无错误率数据";
    adminKnowledgeDrawerHint.textContent = `${label || "知识点"} ｜ ${errorText} ｜ ${item.count || 0} 次标记`;
  }
  if (adminKnowledgeDrawerList) {
    adminKnowledgeDrawerList.innerHTML = "";
    if (students.length === 0) {
      const empty = document.createElement("li");
      empty.className = "text-xs text-slate-400";
      empty.textContent = "暂无关联学生";
      adminKnowledgeDrawerList.appendChild(empty);
    } else {
      students.forEach((student) => {
        const li = document.createElement("li");
        const avgScore =
          student.averageScore !== null && student.averageScore !== undefined
            ? `${Math.round(student.averageScore)} 分`
            : "未评分";
        li.innerHTML = `
          <span class="font-semibold">${escapeHtmlText(student.name || `学生 ${student.id || ""}`)}</span>
          <span class="text-xs text-slate-400">出现 ${student.count || 0} 次 ｜ ${avgScore}</span>
        `;
        adminKnowledgeDrawerList.appendChild(li);
      });
    }
  }
  adminKnowledgeDrawer.classList.remove("hidden");
}

function closeKnowledgeDrawer() {
  if (adminKnowledgeDrawer) {
    adminKnowledgeDrawer.classList.add("hidden");
  }
}

function renderAdminAnalytics(analytics) {
  state.admin.analytics = analytics || null;
  const weeklyTrends = analytics ? analytics.weeklyTrends || [] : [];
  const actionHotspots = analytics ? analytics.actionHotspots || [] : [];
  const knowledgeWeakness = analytics ? analytics.knowledgeWeakness || [] : [];

  if (adminTrendSectionFilter) {
    const uniqueSections = new Map();
    weeklyTrends.forEach((trend) => {
      const key = `${trend.chapterId || ""}-${trend.sectionId || ""}`;
      if (!uniqueSections.has(key)) {
        uniqueSections.set(key, trend.sectionTitle || key || "章节");
      }
    });
    adminTrendSectionFilter.innerHTML = '<option value="all">全部章节</option>';
    uniqueSections.forEach((label, key) => {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = label;
      adminTrendSectionFilter.appendChild(option);
    });
    const selectValue =
      (state.admin.selectedTrendSection && uniqueSections.has(state.admin.selectedTrendSection))
        ? state.admin.selectedTrendSection
        : "all";
    adminTrendSectionFilter.value = selectValue;
  }

  const selectedKey = state.admin.selectedTrendSection || "all";
  const filteredTrends =
    selectedKey === "all"
      ? weeklyTrends
      : weeklyTrends.filter(
          (trend) => `${trend.chapterId || ""}-${trend.sectionId || ""}` === selectedKey
        );
  renderAdminTrendChart(filteredTrends);
  renderActionHotspots(actionHotspots);
  renderKnowledgeWeakness(knowledgeWeakness);

  // Fallback: if学生列表尚未加载但统计中包含学生姓名，补充一个只读列表，避免 KPI 显示 0。
  const hasStudents = state.admin.students && state.admin.students.length > 0;
  if (!hasStudents && Array.isArray(knowledgeWeakness) && knowledgeWeakness.length > 0) {
    const syntheticMap = new Map();
    knowledgeWeakness.forEach((item) => {
      (item.students || []).forEach((stu) => {
        if (!syntheticMap.has(stu.id)) {
          syntheticMap.set(stu.id, {
            id: stu.id,
            username: stu.name || `学生 ${stu.id || ""}`,
            displayName: stu.name || `学生 ${stu.id || ""}`,
            sessionCount: 0,
            evaluationCount: 0,
            sectionCompleted: 0,
            lastActive: "",
            averageScore: stu.averageScore,
            latestScore: stu.averageScore,
            latestScoreLabel: "",
          });
        }
      });
    });
    const syntheticStudents = Array.from(syntheticMap.values());
    if (syntheticStudents.length > 0) {
      state.admin.students = syntheticStudents;
      renderAdminStudentList();
    }
  }
}

// 工具：根据 ID 获取章节对象。
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

// 工具：根据 ID 获取作业对象。
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

// 工具：根据 ID 获取 Blueprint 对象。
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

// 工具：根据章节/关卡 ID 获取关卡对象。
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

// 渲染等级配置（章节/关卡）树状列表，支持展开/折叠。
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
    const adminChapterLabel = chapter.displayTitle || chapter.title || "章节";
    const adminChapterSubtitle = chapter.displaySubtitle || chapter.description || "";
    headerBtn.innerHTML =
      '<span class="font-semibold text-slate-100">' +
      adminChapterLabel +
      '</span><span class="text-xs text-slate-500">' +
      adminChapterSubtitle +
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

// 将当前章节数据回填到编辑表单。
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

// 将当前关卡数据回填到编辑表单，包括知识点。
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
    writeKnowledgeToTextarea(sectionEditorKnowledge, []);
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
  if (sectionEditorKnowledge) {
    const cache = state.admin.graph.practiceKnowledge;
    const cached = cache && cache.get ? cache.get(section.id) || [] : [];
    writeKnowledgeToTextarea(sectionEditorKnowledge, cached);
    hydrateSectionKnowledge(section.id);
  }
  if (levelSaveSectionBtn) levelSaveSectionBtn.disabled = false;
  if (levelDeleteSectionBtn) levelDeleteSectionBtn.disabled = false;
}

// 在关卡编辑页选择章节，刷新关卡列表和表单。
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

// 在关卡编辑页选择关卡，填充表单并加载知识点缓存。
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
    state.admin.levels = sortLevelHierarchy(data.chapters || []);

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
    populateAdminTheoryChapterOptions();
    populateAdminTheorySectionOptions();
    renderAdminTheoryDocxPreview();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载关卡数据失败");
  }
}

// 确保后台理论编辑区域的状态对象存在，防止空引用。
function ensureAdminTheoryState() {
  if (!state.admin || typeof state.admin !== "object") {
    state.admin = {};
  }
  if (!state.admin.theory || typeof state.admin.theory !== "object") {
    state.admin.theory = {
      tree: [],
      selectedTopicId: null,
      selectedLessonId: null,
      pendingImport: null,
    };
  }
  if (!("pendingImport" in state.admin.theory)) {
    state.admin.theory.pendingImport = null;
  }
}

// 填充理论编辑区的章节下拉框。
function populateAdminTheoryChapterOptions() {
  if (!adminTheoryTopicChapter) {
    return;
  }
  const chapters = Array.isArray(state.admin.levels) ? state.admin.levels : [];
  adminTheoryTopicChapter.innerHTML = "";
  if (chapters.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无章节";
    adminTheoryTopicChapter.appendChild(option);
    adminTheoryTopicChapter.disabled = true;
    return;
  }
  adminTheoryTopicChapter.disabled = false;
  chapters.forEach((chapter) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.displayTitle || chapter.title || chapter.id;
    adminTheoryTopicChapter.appendChild(option);
  });
}

// 根据章节刷新理论编辑区的关卡下拉框。
function populateAdminTheorySectionOptions() {
  if (!adminTheoryLessonSection) {
    return;
  }
  const chapters = Array.isArray(state.admin.levels) ? state.admin.levels : [];
  adminTheoryLessonSection.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "不关联关卡";
  adminTheoryLessonSection.appendChild(emptyOption);
  chapters.forEach((chapter) => {
    const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
    sections.forEach((section) => {
      const option = document.createElement("option");
      option.value = section.id;
      const chapterLabel = chapter.displayTitle || chapter.title || chapter.id;
      option.textContent = `${chapterLabel}｜${section.title || section.id}`;
      adminTheoryLessonSection.appendChild(option);
    });
  });
}

// 对长文本生成预览摘要，截断并附加省略号。
function summarizePreviewText(value, limit = 80) {
  const text = typeof value === "string" ? value : value && value.toString ? value.toString() : "";
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 1).trim()}…`;
}

// 更新 Docx 导入进度条显示文案。
function setAdminTheoryDocxProgress({ total = 0, completed = 0, actionVerb = "已完成" } = {}) {
  if (!adminTheoryDocxProgress || !adminTheoryDocxProgressBar) {
    return;
  }
  const numericTotal = Number(total);
  const safeTotal = Number.isFinite(numericTotal) && numericTotal > 0 ? numericTotal : 0;
  const numericCompleted = Number(completed);
  const safeCompleted = Number.isFinite(numericCompleted)
    ? Math.max(0, Math.min(numericCompleted, safeTotal))
    : 0;
  if (safeTotal <= 0) {
    adminTheoryDocxProgress.classList.add("hidden");
    adminTheoryDocxProgressBar.style.width = "0%";
    if (adminTheoryDocxProgressLabel) {
      adminTheoryDocxProgressLabel.textContent = "";
    }
    return;
  }
  const percent = Math.round((safeCompleted / safeTotal) * 100);
  adminTheoryDocxProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  adminTheoryDocxProgress.classList.remove("hidden");
  if (adminTheoryDocxProgressLabel) {
    const verb = typeof actionVerb === "string" && actionVerb.trim() !== "" ? actionVerb.trim() : "已完成";
    adminTheoryDocxProgressLabel.textContent = `${verb} ${safeCompleted}/${safeTotal}`;
  }
}

// 渲染 Docx 导入的章节/关卡预览树。
function renderAdminTheoryDocxPreview(importData = null) {
  if (!adminTheoryDocxPreview) {
    return;
  }
  ensureAdminTheoryState();
  const data = importData || state.admin.theory.pendingImport;
  const chapters = data && Array.isArray(data.chapters) ? data.chapters : [];
  const warnings = data && Array.isArray(data.warnings) ? data.warnings : [];
  if (!chapters.length) {
    adminTheoryDocxPreview.innerHTML =
      '<p class="text-[12px] text-slate-500">尚未导入 Word 文档。</p>';
    if (adminTheoryDocxApply) {
      adminTheoryDocxApply.disabled = true;
    }
    if (adminTheoryDocxPublish) {
      adminTheoryDocxPublish.disabled = true;
    }
    setAdminTheoryDocxProgress();
    return;
  }
  const fragments = [];
  if (warnings.length) {
    const warningItems = warnings
      .map((warning) => `<li>${escapeHtmlText(warning)}</li>`)
      .join("");
    fragments.push(
      `<div class="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-700">` +
        `<p class="font-semibold text-amber-800">检测到以下提示：</p>` +
        `<ul class="list-disc space-y-1 pl-4">${warningItems}</ul>` +
        `</div>`,
    );
  }
  chapters.forEach((chapter, chapterIndex) => {
    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    const chapterSummary = summarizePreviewText(chapter.summary || chapter.introHtml || "", 110);
    const topicsHtml = topics
      .map((topic, topicIndex) => {
        const lessonList = Array.isArray(topic.lessons) ? topic.lessons : [];
        const topicSummary = summarizePreviewText(topic.summary || topic.introHtml || "", 90);
        const lessonsHtml = lessonList
          .map((lesson, lessonIndex) => {
            const summary = summarizePreviewText(lesson.summary || lesson.contentHtml || "", 90);
            return (
              `<li class="rounded-md border border-slate-200 bg-white p-3 shadow-sm">` +
              `<div class="flex items-center justify-between text-[12px] text-slate-700">` +
              `<span class="font-semibold text-slate-900">${lessonIndex + 1}. ${escapeHtmlText(lesson.title || "未命名知识点")}</span>` +
              `</div>` +
              (summary ? `<p class="text-[12px] text-slate-600">${escapeHtmlText(summary)}</p>` : "") +
              `</li>`
            );
          })
          .join("");
        return (
          `<li class="space-y-2 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm">` +
          `<div class="flex items-center justify-between text-[12px] text-slate-700">` +
          `<span class="font-semibold text-slate-900">${chapterIndex + 1}.${topicIndex + 1} ${escapeHtmlText(topic.title || "未命名目录")}</span>` +
          `<span class="text-[12px] text-slate-500">知识点 ${lessonList.length} 个</span>` +
          `</div>` +
          (topicSummary ? `<p class="text-[12px] text-slate-600">${escapeHtmlText(topicSummary)}</p>` : "") +
          (lessonsHtml
            ? `<ol class="space-y-2 text-[12px] text-slate-700">${lessonsHtml}</ol>`
            : `<p class="text-[12px] text-slate-500">该目录暂未检测到三级标题内容。</p>`) +
          `</li>`
        );
      })
      .join("");
    fragments.push(
      `<div class="space-y-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">` +
        `<div class="flex items-center justify-between text-[13px] text-slate-700">` +
        `<span class="font-semibold text-slate-900">${chapterIndex + 1}. ${escapeHtmlText(chapter.title || "未命名章节")}</span>` +
        `<span class="text-[12px] text-slate-500">目录 ${topics.length} 个</span>` +
        `</div>` +
        (chapterSummary ? `<p class="text-[12px] text-slate-600">${escapeHtmlText(chapterSummary)}</p>` : "") +
        (topicsHtml
          ? `<ol class="space-y-2 text-[12px] text-slate-700">${topicsHtml}</ol>`
          : `<p class="text-[12px] text-slate-500">该章节尚未检测到二级标题。</p>`) +
        `</div>`
    );
  });
  adminTheoryDocxPreview.innerHTML = fragments.join("");
  if (adminTheoryDocxApply) {
    adminTheoryDocxApply.disabled = false;
  }
  if (adminTheoryDocxPublish) {
    adminTheoryDocxPublish.disabled = false;
  }
}

// 清空 Docx 导入数据与相关 UI 状态。
function clearAdminTheoryDocxImport(options = {}) {
  ensureAdminTheoryState();
  state.admin.theory.pendingImport = null;
  if (adminTheoryDocxInput) {
    adminTheoryDocxInput.value = "";
  }
  renderAdminTheoryDocxPreview(null);
  if (adminTheoryDocxApply) {
    adminTheoryDocxApply.disabled = true;
  }
  if (adminTheoryDocxPublish) {
    adminTheoryDocxPublish.disabled = true;
  }
  setAdminTheoryDocxProgress();
  if (!options.silent) {
    updateInlineStatus(adminTheoryDocxStatus, "已清除导入结果", "muted");
  }
}

async function handleAdminTheoryDocxUpload() {
  if (!adminTheoryDocxInput || adminTheoryDocxInput.files.length === 0) {
    return;
  }
  const file = adminTheoryDocxInput.files[0];
  const formData = new FormData();
  formData.append("file", file);
  setAdminTheoryDocxProgress();
  updateInlineStatus(adminTheoryDocxStatus, `正在解析 ${file.name}...`, "muted");
  if (adminTheoryDocxApply) {
    adminTheoryDocxApply.disabled = true;
  }
  if (adminTheoryDocxPublish) {
    adminTheoryDocxPublish.disabled = true;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetchWithAuth("/api/admin/theory/import-docx", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "解析失败，请检查文档格式");
    }
    const data = await response.json();
    const result = data.import || null;
    ensureAdminTheoryState();
    state.admin.theory.pendingImport = result;
    renderAdminTheoryDocxPreview(result);
    adminTheoryDocxInput.value = "";
    const stats = result && result.stats ? result.stats : null;
    if (stats) {
      updateInlineStatus(
        adminTheoryDocxStatus,
        `解析完成：检测到 ${stats.chapterCount || 0} 个章节、${stats.topicCount || 0} 个目录、${stats.lessonCount || 0} 个知识点。`,
        "success",
      );
    } else {
      updateInlineStatus(adminTheoryDocxStatus, "解析完成，可直接导入生成章节。", "success");
    }
  } catch (error) {
    console.error(error);
    state.admin.theory.pendingImport = null;
    renderAdminTheoryDocxPreview(null);
    if (error?.name === "AbortError") {
      updateInlineStatus(adminTheoryDocxStatus, "解析超时，请检查网络或文档大小后重试。", "error");
    } else {
      updateInlineStatus(adminTheoryDocxStatus, error.message || "解析失败", "error");
    }
    if (adminTheoryDocxInput) {
      adminTheoryDocxInput.value = "";
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

async function applyAdminTheoryDocxImport({ publish = false } = {}) {
  ensureAdminTheoryState();
  const importData = state.admin.theory.pendingImport;
  if (!importData || !Array.isArray(importData.chapters) || importData.chapters.length === 0) {
    updateInlineStatus(adminTheoryDocxStatus, "请先上传并解析 Word 文档", "error");
    return;
  }
  const chapters = importData.chapters;
  const levelChapters = Array.isArray(state.admin.levels) ? state.admin.levels : [];
  const availableChapters = levelChapters.filter((chapter) => chapter && chapter.id);
  if (!availableChapters.length) {
    updateInlineStatus(adminTheoryDocxStatus, "当前尚未创建任何章节，请先在关卡地图中配置章节。", "error");
    return;
  }
  if (chapters.length > availableChapters.length) {
    updateInlineStatus(
      adminTheoryDocxStatus,
      `Word 文档包含 ${chapters.length} 个一级标题，但系统仅配置 ${availableChapters.length} 个章节，请先补充章节或调整文档结构。`,
      "error",
    );
    return;
  }
  const totalTopics = chapters.reduce(
    (sum, chapter) => sum + (Array.isArray(chapter.topics) ? chapter.topics.length : 0),
    0,
  );
  const totalLessons = chapters.reduce(
    (sum, chapter) =>
      sum +
      (Array.isArray(chapter.topics)
        ? chapter.topics.reduce(
            (topicSum, topic) => topicSum + (Array.isArray(topic.lessons) ? topic.lessons.length : 0),
            0,
          )
        : 0),
    0,
  );
  const progressTotal = totalLessons || totalTopics;
  const trackLessonsOnly = totalLessons > 0;
  const actionVerb = publish
    ? trackLessonsOnly
      ? "已发布"
      : "已生成"
    : trackLessonsOnly
      ? "已生成"
      : "已同步";
  const baseProgressLabel = publish ? "正在生成并发布理论内容" : "正在生成章节与目录草稿";
  let processedUnits = 0;
  const updateProgressStatus = () => {
    if (progressTotal > 0) {
      updateInlineStatus(
        adminTheoryDocxStatus,
        `${baseProgressLabel}（${actionVerb} ${processedUnits}/${progressTotal}）`,
        "muted",
      );
    } else {
      updateInlineStatus(adminTheoryDocxStatus, `${baseProgressLabel}...`, "muted");
    }
  };
  updateProgressStatus();
  setAdminTheoryDocxProgress({ total: progressTotal, completed: processedUnits, actionVerb });
  if (adminTheoryDocxApply) {
    adminTheoryDocxApply.disabled = true;
  }
  if (adminTheoryDocxPublish) {
    adminTheoryDocxPublish.disabled = true;
  }
  try {
    const assignedChapterIds = [];
    const createdTopicIds = [];
    let firstTopicId = null;
    let firstLessonId = null;

    for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex += 1) {
      const chapter = chapters[chapterIndex] || {};
      const targetChapter = availableChapters[chapterIndex];
      const chapterId = targetChapter && targetChapter.id;
      if (!chapterId) {
        throw new Error("未找到可用的章节用于导入");
      }
      assignedChapterIds.push(chapterId);

      const existingTheoryChapters = Array.isArray(state.admin.theory.tree)
        ? state.admin.theory.tree
        : [];
      const existingTheoryEntry = existingTheoryChapters.find((item) => {
        const itemChapterId = item && (item.chapterId || item.chapter_id || item.id);
        return itemChapterId === chapterId;
      });
      if (existingTheoryEntry && Array.isArray(existingTheoryEntry.topics)) {
        for (let existingIndex = 0; existingIndex < existingTheoryEntry.topics.length; existingIndex += 1) {
          const existingTopic = existingTheoryEntry.topics[existingIndex];
          if (!existingTopic || !existingTopic.id) {
            continue;
          }
          const lessonIds = Array.isArray(existingTopic.lessons)
            ? existingTopic.lessons
                .map((lesson) => (lesson && lesson.id ? lesson.id : null))
                .filter((id) => id)
            : [];
          if (lessonIds.length) {
            clearLessonKnowledgeCache(lessonIds);
          }
          const deleteResponse = await fetchWithAuth(`/api/admin/theory/topics/${existingTopic.id}`, {
            method: "DELETE",
          });
          if (!deleteResponse.ok) {
            const errorData = await deleteResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `清空章节“${targetChapter.displayTitle || targetChapter.title || chapterId}”失败`);
          }
        }
      }

      const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
      for (let topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
        const topic = topics[topicIndex] || {};
        const topicPayload = {
          chapterId,
          title: (topic.title || "").trim() || `导入目录 ${topicIndex + 1}`,
          summary: (topic.summary || "").trim(),
        };
        if (typeof topic.orderIndex === "number") {
          topicPayload.orderIndex = topic.orderIndex;
        }
        const topicResponse = await fetchWithAuth("/api/admin/theory/topics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(topicPayload),
        });
        if (!topicResponse.ok) {
          const errorData = await topicResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `创建目录“${topicPayload.title}”失败`);
        }
        const topicData = await topicResponse.json();
        const topicId = topicData.topic && topicData.topic.id;
        if (!topicId) {
          throw new Error("目录创建失败，请稍后再试");
        }
        createdTopicIds.push(topicId);
        if (!firstTopicId) {
          firstTopicId = topicId;
        }
        if (!trackLessonsOnly && progressTotal > 0) {
          processedUnits += 1;
          setAdminTheoryDocxProgress({ total: progressTotal, completed: processedUnits, actionVerb });
          updateProgressStatus();
        }

        const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
        for (let lessonIndex = 0; lessonIndex < lessons.length; lessonIndex += 1) {
          const lesson = lessons[lessonIndex] || {};
          const lessonPayload = {
            topicId,
            title: (lesson.title || "").trim() || `导入知识点 ${lessonIndex + 1}`,
            contentHtml: lesson.contentHtml || "<p><br></p>",
            isPublished: publish,
          };
          if (typeof lesson.orderIndex === "number") {
            lessonPayload.orderIndex = lesson.orderIndex;
          }
          const lessonResponse = await fetchWithAuth("/api/admin/theory/lessons", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(lessonPayload),
          });
          if (!lessonResponse.ok) {
            const errorData = await lessonResponse.json().catch(() => ({}));
            throw new Error(errorData.error || `创建知识点“${lessonPayload.title}”失败`);
          }
          const lessonData = await lessonResponse.json();
          if (!firstLessonId && lessonData.lesson && lessonData.lesson.id) {
            firstLessonId = lessonData.lesson.id;
          }
          if (trackLessonsOnly && progressTotal > 0) {
            processedUnits += 1;
            setAdminTheoryDocxProgress({ total: progressTotal, completed: processedUnits, actionVerb });
            updateProgressStatus();
          }
        }
      }
    }
    if (progressTotal > 0) {
      setAdminTheoryDocxProgress({ total: progressTotal, completed: processedUnits, actionVerb });
      updateProgressStatus();
    }
    clearAdminTheoryDocxImport({ silent: true });
    const successMessage = publish
      ? `已导入并发布 ${totalLessons} 个知识点，覆盖 ${assignedChapterIds.length} 个章节、${totalTopics} 个目录。`
      : `已将 Word 内容同步到 ${assignedChapterIds.length} 个章节，生成 ${totalTopics} 个目录、${totalLessons} 个知识点草稿。`;
    updateInlineStatus(adminTheoryDocxStatus, successMessage, "success");
    await loadAdminLevels({ chapterId: assignedChapterIds[0] || null });
    await loadAdminTheory({
      focusTopicId: firstTopicId || createdTopicIds[0] || null,
      focusLessonId: firstLessonId || null,
      keepSelection: false,
    });
    refreshAdminGraph();
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryDocxStatus, error.message || "导入失败", "error");
    setAdminTheoryDocxProgress();
  } finally {
    const hasPendingImport =
      state.admin &&
      state.admin.theory &&
      state.admin.theory.pendingImport &&
      Array.isArray(state.admin.theory.pendingImport.chapters) &&
      state.admin.theory.pendingImport.chapters.length > 0;
    if (adminTheoryDocxApply) {
      adminTheoryDocxApply.disabled = !hasPendingImport;
    }
    if (adminTheoryDocxPublish) {
      adminTheoryDocxPublish.disabled = !hasPendingImport;
    }
  }
}

// 将章节/主题/课程组合成树结构，方便渲染导航树。
function collectAdminTheoryTopics() {
  ensureAdminTheoryState();
  const chapters = Array.isArray(state.admin.theory.tree) ? state.admin.theory.tree : [];
  const items = [];
  chapters.forEach((chapter) => {
    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    topics.forEach((topic) => {
      items.push({ chapter, topic });
    });
  });
  return items;
}

// 根据 ID 查找后台缓存的理论主题。
function findAdminTheoryTopic(topicId) {
  if (!topicId) {
    return null;
  }
  ensureAdminTheoryState();
  const chapters = Array.isArray(state.admin.theory.tree) ? state.admin.theory.tree : [];
  for (const chapter of chapters) {
    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    for (const topic of topics) {
      if (topic.id === topicId) {
        return { chapter, topic };
      }
    }
  }
  return null;
}

// 根据 ID 查找后台缓存的理论课程。
function findAdminTheoryLesson(lessonId) {
  if (!lessonId) {
    return null;
  }
  ensureAdminTheoryState();
  const chapters = Array.isArray(state.admin.theory.tree) ? state.admin.theory.tree : [];
  for (const chapter of chapters) {
    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    for (const topic of topics) {
      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      for (const lesson of lessons) {
        if (lesson.id === lessonId) {
          return { chapter, topic, lesson };
        }
      }
    }
  }
  return null;
}

// 渲染课程详情头部信息（主题/章节/课程标题）。
function renderAdminTheoryLessonHeading(lessonContext) {
  if (!adminTheoryLessonHeading) {
    return;
  }
  adminTheoryLessonHeading.innerHTML = "";

  const composeLine = (values, fallback) => {
    const seen = new Set();
    const parts = [];
    values.forEach((value) => {
      const text = typeof value === "string" ? value.trim() : "";
      if (text && !seen.has(text)) {
        seen.add(text);
        parts.push(text);
      }
    });
    return parts.length > 0 ? parts.join(" ") : fallback;
  };

  if (!lessonContext) {
    const placeholder = document.createElement("p");
    placeholder.className = "text-xs text-slate-400";
    placeholder.textContent = "根据左侧目录选择知识点，即可在此查看结构化标题。";
    adminTheoryLessonHeading.appendChild(placeholder);
    return;
  }

  const chapterLine = document.createElement("p");
  chapterLine.className = "text-base font-semibold text-white";
  chapterLine.textContent = composeLine(
    [
      lessonContext.chapter.chapterTitle,
      lessonContext.chapter.chapterId,
      lessonContext.chapter.id,
    ],
    "未命名章节",
  );
  adminTheoryLessonHeading.appendChild(chapterLine);

  const topicLine = document.createElement("p");
  topicLine.className = "text-sm text-slate-200";
  topicLine.textContent = composeLine(
    [lessonContext.topic.code, lessonContext.topic.title, lessonContext.topic.id],
    "未命名目录",
  );
  adminTheoryLessonHeading.appendChild(topicLine);

  const lessonLine = document.createElement("p");
  lessonLine.className = "text-sm text-slate-400";
  lessonLine.textContent = composeLine(
    [lessonContext.lesson.code, lessonContext.lesson.title, lessonContext.lesson.id],
    "未命名知识点",
  );
  adminTheoryLessonHeading.appendChild(lessonLine);
}

// 渲染理论知识树，包含章节、主题、课程节点及创建按钮。
function renderAdminTheoryTree() {
  if (!adminTheoryTree) {
    return;
  }
  ensureAdminTheoryState();
  const theoryChapters = Array.isArray(state.admin.theory.tree) ? state.admin.theory.tree : [];
  const levelChapters = getAdminLevelChapters();

  const theoryByKey = new Map();
  theoryChapters.forEach((chapter) => {
    if (!chapter) {
      return;
    }
    const keys = [chapter.chapterId, chapter.id, chapter.chapterCode, chapter.chapterTitle];
    keys
      .filter((value) => !!value)
      .forEach((value) => {
        if (!theoryByKey.has(value)) {
          theoryByKey.set(value, chapter);
        }
      });
  });

  const usedTheoryChapters = new Set();
  const displayChapters = [];

  levelChapters.forEach((levelChapter, index) => {
    const candidateKeys = [levelChapter.id, levelChapter.chapterId, levelChapter.displayTitle, levelChapter.title];
    let matched = null;
    let matchedKey = "";
    for (let pointer = 0; pointer < candidateKeys.length; pointer += 1) {
      const candidate = candidateKeys[pointer];
      if (candidate && theoryByKey.has(candidate)) {
        matched = theoryByKey.get(candidate);
        matchedKey = candidate;
        break;
      }
    }

    if (matched) {
      usedTheoryChapters.add(matched);
      const key = matched.chapterId || matched.id || matchedKey || levelChapter.id || `level-${index}`;
      displayChapters.push({ key, level: levelChapter, theory: matched });
    } else {
      const fallbackKey = levelChapter.id || levelChapter.title || `level-${index}`;
      displayChapters.push({
        key: fallbackKey,
        level: levelChapter,
        theory: {
          chapterId: levelChapter.id,
          chapterTitle: levelChapter.displayTitle || levelChapter.title || levelChapter.id,
          chapterDescription: levelChapter.displaySubtitle || levelChapter.description || "",
          topics: [],
        },
      });
    }
  });

  theoryChapters.forEach((chapter, index) => {
    if (usedTheoryChapters.has(chapter)) {
      return;
    }
    const fallbackKey = chapter.chapterId || chapter.id || chapter.chapterTitle || `theory-${index}`;
    displayChapters.push({ key: fallbackKey, level: null, theory: chapter });
  });

  adminTheoryTree.innerHTML = "";

  if (displayChapters.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-theory-empty";
    empty.textContent = "暂无理论学习目录，先在关卡地图中创建章节吧。";
    adminTheoryTree.appendChild(empty);
    return;
  }

  const activeTopicId = state.admin.theory.selectedTopicId;
  const activeLessonId = state.admin.theory.selectedLessonId;

  const grid = document.createElement("div");
  grid.className = "admin-theory-chapter-grid";

  displayChapters.forEach((entry, index) => {
    const { theory, level, key } = entry;
    const topics = Array.isArray(theory.topics) ? theory.topics : [];
    const lessonCount = topics.reduce((total, topic) => {
      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      return total + lessons.length;
    }, 0);

    const chapterId = theory.chapterId || (level && level.id) || key || "";

    const card = document.createElement("details");
    card.className = "chapter-card admin-theory-card";
    if (chapterId) {
      card.dataset.chapterId = chapterId;
    }

    const shouldExpand = topics.some((topic) => {
      if (topic.id === activeTopicId) {
        return true;
      }
      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      return lessons.some((lesson) => lesson.id === activeLessonId);
    });
    if (shouldExpand || (index === 0 && !activeTopicId && !activeLessonId)) {
      card.setAttribute("open", "");
    }

    const summary = document.createElement("summary");
    summary.className = "chapter-card-summary";
    const displayTitle =
      (level && (level.displayTitle || level.title)) || theory.chapterTitle || chapterId || "章节";
    const displaySubtitle =
      (level && (level.displaySubtitle || level.description)) || theory.chapterDescription || "欢迎来到理论学习";
    const hasNodes = topics.length > 0 || lessonCount > 0;
    const countLabel = hasNodes ? `二级 ${topics.length} · 三级 ${lessonCount}` : "尚未配置理论";
    const countClass = hasNodes ? "chapter-card-count" : "chapter-card-count chapter-card-count-empty";
    summary.innerHTML = `
      <div class="chapter-card-summary-content">
        <p class="chapter-card-title">${displayTitle}</p>
        <p class="chapter-card-description">${displaySubtitle}</p>
      </div>
      <div class="chapter-card-meta">
        <span class="${countClass}">${countLabel}</span>
        <span class="chapter-card-chevron" aria-hidden="true">
          <svg class="chapter-card-chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 5l8 7-8 7" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </span>
      </div>
    `;
    card.appendChild(summary);

    const body = document.createElement("div");
    body.className = "chapter-card-body admin-theory-card-body";

    const structure = document.createElement("div");
    structure.className = "admin-theory-structure";

    if (topics.length === 0) {
      const emptyNode = document.createElement("p");
      emptyNode.className = "admin-theory-empty";
      emptyNode.textContent = "还没有二级小节，点击下方按钮新建。";
      structure.appendChild(emptyNode);
    } else {
      topics.forEach((topic) => {
        const topicNode = document.createElement("div");
        topicNode.className = "admin-theory-node";
        topicNode.dataset.adminTheoryTopicRow = topic.id;
        if (topic.id === activeTopicId) {
          topicNode.classList.add("is-active");
        }

        const header = document.createElement("div");
        header.className = "admin-theory-node__header";

        const topicTitle = document.createElement("input");
        topicTitle.type = "text";
        topicTitle.className = "admin-theory-node__title";
        topicTitle.placeholder = "添加二级小节（在这里编辑）";
        const topicName = topic.title || "";
        topicTitle.value = topicName;
        topicTitle.dataset.adminTheoryTopicTitle = topic.id;
        topicTitle.dataset.previousValue = topicName;
        header.appendChild(topicTitle);

        const topicActions = document.createElement("div");
        topicActions.className = "admin-theory-node__actions";

        const addLessonBtn = document.createElement("button");
        addLessonBtn.type = "button";
        addLessonBtn.className = "admin-theory-node__action";
        addLessonBtn.dataset.adminTheoryAddLesson = topic.id;
        addLessonBtn.title = "新增三级小节";
        addLessonBtn.textContent = "+";
        topicActions.appendChild(addLessonBtn);

        const deleteTopicBtn = document.createElement("button");
        deleteTopicBtn.type = "button";
        deleteTopicBtn.className = "admin-theory-node__action admin-theory-node__action--danger";
        deleteTopicBtn.dataset.adminTheoryRemoveTopic = topic.id;
        deleteTopicBtn.title = "删除二级小节";
        deleteTopicBtn.textContent = "-";
        topicActions.appendChild(deleteTopicBtn);

        header.appendChild(topicActions);
        topicNode.appendChild(header);

        if (topic.code || topic.summary) {
          const meta = document.createElement("div");
          meta.className = "admin-theory-node__meta";
          const metaParts = [];
          if (topic.code) metaParts.push(topic.code);
          if (topic.summary) metaParts.push(topic.summary);
          meta.textContent = metaParts.join(" ｜ ");
          topicNode.appendChild(meta);
        }

        const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
        if (lessons.length === 0) {
          const placeholder = document.createElement("p");
          placeholder.className = "admin-theory-empty";
          placeholder.textContent = "还没有三级小节，使用上方 + 按钮添加。";
          topicNode.appendChild(placeholder);
        } else {
          lessons.forEach((lesson) => {
            const lessonRow = document.createElement("div");
            lessonRow.className = "admin-theory-leaf";
            lessonRow.dataset.adminTheoryLessonRow = lesson.id;
            if (lesson.id === activeLessonId) {
              lessonRow.classList.add("is-active");
            }

            const lessonHeader = document.createElement("div");
            lessonHeader.className = "admin-theory-leaf__header";

            const lessonTitle = document.createElement("input");
            lessonTitle.type = "text";
            lessonTitle.className = "admin-theory-leaf__title";
            lessonTitle.placeholder = "添加三级小节（在这里编辑）";
            const lessonName = lesson.title || "";
            lessonTitle.value = lessonName;
            lessonTitle.dataset.adminTheoryLessonTitle = lesson.id;
            lessonTitle.dataset.previousValue = lessonName;
            lessonHeader.appendChild(lessonTitle);

            const lessonActions = document.createElement("div");
            lessonActions.className = "admin-theory-leaf__actions";

            const statusBadge = document.createElement("span");
            statusBadge.className = "admin-theory-leaf__badge";
            if (lesson.isPublished) {
              statusBadge.classList.add("admin-theory-leaf__badge--published");
              statusBadge.textContent = "已发布";
            } else {
              statusBadge.classList.add("admin-theory-leaf__badge--draft");
              statusBadge.textContent = "草稿";
            }
            lessonActions.appendChild(statusBadge);

            const deleteLessonBtn = document.createElement("button");
            deleteLessonBtn.type = "button";
            deleteLessonBtn.className = "admin-theory-leaf__action admin-theory-leaf__action--danger";
            deleteLessonBtn.dataset.adminTheoryRemoveLesson = lesson.id;
            deleteLessonBtn.title = "删除三级小节";
            deleteLessonBtn.textContent = "-";
            lessonActions.appendChild(deleteLessonBtn);

            lessonHeader.appendChild(lessonActions);
            lessonRow.appendChild(lessonHeader);

            const metaParts = [];
            if (lesson.code) metaParts.push(lesson.code);
            if (lesson.sectionTitle) metaParts.push(lesson.sectionTitle);
            if (metaParts.length > 0) {
              const footer = document.createElement("div");
              footer.className = "admin-theory-leaf__footer";
              const meta = document.createElement("span");
              meta.className = "admin-theory-leaf__meta";
              meta.textContent = metaParts.join(" ｜ ");
              footer.appendChild(meta);
              lessonRow.appendChild(footer);
            }

            topicNode.appendChild(lessonRow);
          });
        }

        structure.appendChild(topicNode);
      });
    }

    const addTopicBtn = document.createElement("button");
    addTopicBtn.type = "button";
    addTopicBtn.className = "admin-theory-add-row";
    if (chapterId) {
      addTopicBtn.dataset.adminTheoryAddTopic = chapterId;
      addTopicBtn.innerHTML = "<span>＋</span><span>添加二级小节</span>";
    } else {
      addTopicBtn.disabled = true;
      addTopicBtn.innerHTML = "<span>⚠️</span><span>章节未关联关卡</span>";
    }
    structure.appendChild(addTopicBtn);

    body.appendChild(structure);
    card.appendChild(body);
    grid.appendChild(card);
  });

  adminTheoryTree.appendChild(grid);
}

async function createAdminTheoryTopicInline(chapterId) {
  const targetChapterId = (chapterId || "").trim();
  if (!targetChapterId) {
    alert("请先在关卡地图中创建章节");
    return;
  }
  try {
    updateInlineStatus(adminTheoryStatus, "正在创建二级小节...", "muted");
    const response = await fetchWithAuth("/api/admin/theory/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId: targetChapterId, title: "未命名二级小节" }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "创建二级小节失败");
    }
    const data = await response.json().catch(() => ({}));
    const newTopicId = data.topic && data.topic.id;
    await loadAdminTheory({ focusTopicId: newTopicId || null, keepSelection: true });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryStatus, "已创建新的二级小节", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryStatus, error.message || "创建失败", "error");
  }
}

async function createAdminTheoryLessonInline(topicId) {
  const targetTopicId = (topicId || "").trim();
  if (!targetTopicId) {
    alert("请先选择二级小节");
    return;
  }
  try {
    updateInlineStatus(adminTheoryStatus, "正在创建三级小节...", "muted");
    const response = await fetchWithAuth("/api/admin/theory/lessons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId: targetTopicId, title: "未命名三级小节" }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "创建三级小节失败");
    }
    const data = await response.json().catch(() => ({}));
    const lesson = data.lesson || {};
    const newLessonId = lesson.id || null;
    const focusTopicId = lesson.topicId || targetTopicId;
    await loadAdminTheory({ focusTopicId, focusLessonId: newLessonId, keepSelection: true });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryStatus, "已创建新的三级小节", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryStatus, error.message || "创建失败", "error");
  }
}

async function updateAdminTheoryTopicTitleInline(topicId, rawTitle, inputElement) {
  const targetTopicId = (topicId || "").trim();
  if (!targetTopicId) {
    return;
  }
  const nextTitle = (rawTitle || "").trim();
  const previousTitle = inputElement ? inputElement.dataset.previousValue || "" : "";
  if (!nextTitle) {
    if (inputElement) {
      inputElement.value = previousTitle;
    }
    updateInlineStatus(adminTheoryStatus, "标题不能为空", "error");
    return;
  }
  if (nextTitle === previousTitle) {
    return;
  }
  try {
    updateInlineStatus(adminTheoryStatus, "正在保存二级小节标题...", "muted");
    const response = await fetchWithAuth(`/api/admin/theory/topics/${targetTopicId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "保存失败");
    }
    if (inputElement) {
      inputElement.dataset.previousValue = nextTitle;
    }
    await loadAdminTheory({ focusTopicId: targetTopicId, keepSelection: true });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryStatus, "二级小节标题已更新", "success");
  } catch (error) {
    console.error(error);
    if (inputElement) {
      inputElement.value = previousTitle;
    }
    updateInlineStatus(adminTheoryStatus, error.message || "保存失败", "error");
  }
}

async function updateAdminTheoryLessonTitleInline(lessonId, rawTitle, inputElement) {
  const targetLessonId = (lessonId || "").trim();
  if (!targetLessonId) {
    return;
  }
  const nextTitle = (rawTitle || "").trim();
  const previousTitle = inputElement ? inputElement.dataset.previousValue || "" : "";
  if (!nextTitle) {
    if (inputElement) {
      inputElement.value = previousTitle;
    }
    updateInlineStatus(adminTheoryStatus, "标题不能为空", "error");
    return;
  }
  if (nextTitle === previousTitle) {
    return;
  }
  try {
    updateInlineStatus(adminTheoryStatus, "正在保存三级小节标题...", "muted");
    const response = await fetchWithAuth(`/api/admin/theory/lessons/${targetLessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "保存失败");
    }
    if (inputElement) {
      inputElement.dataset.previousValue = nextTitle;
    }
    await loadAdminTheory({ focusLessonId: targetLessonId, keepSelection: true });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryStatus, "三级小节标题已更新", "success");
  } catch (error) {
    console.error(error);
    if (inputElement) {
      inputElement.value = previousTitle;
    }
    updateInlineStatus(adminTheoryStatus, error.message || "保存失败", "error");
  }
}

async function deleteAdminTheoryTopicInline(topicId) {
  const targetTopicId = (topicId || "").trim();
  if (!targetTopicId) {
    return;
  }
  const context = findAdminTheoryTopic(targetTopicId);
  const removedLessonIds = context && context.topic && Array.isArray(context.topic.lessons)
    ? context.topic.lessons.map((lesson) => lesson && lesson.id).filter((id) => id)
    : [];
  if (!confirm("确认删除该二级小节及其下的所有内容？")) {
    return;
  }
  try {
    updateInlineStatus(adminTheoryStatus, "正在删除二级小节...", "muted");
    const response = await fetchWithAuth(`/api/admin/theory/topics/${targetTopicId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    if (state.admin.theory && state.admin.theory.selectedTopicId === targetTopicId) {
      state.admin.theory.selectedTopicId = null;
      state.admin.theory.selectedLessonId = null;
    }
    clearLessonKnowledgeCache(removedLessonIds);
    await loadAdminTheory({ keepSelection: true });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryStatus, "二级小节已删除", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryStatus, error.message || "删除失败", "error");
  }
}

async function deleteAdminTheoryLessonInline(lessonId) {
  const targetLessonId = (lessonId || "").trim();
  if (!targetLessonId) {
    return;
  }
  if (!confirm("确认删除该三级小节？")) {
    return;
  }
  try {
    updateInlineStatus(adminTheoryStatus, "正在删除三级小节...", "muted");
    const response = await fetchWithAuth(`/api/admin/theory/lessons/${targetLessonId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    if (state.admin.theory && state.admin.theory.selectedLessonId === targetLessonId) {
      state.admin.theory.selectedLessonId = null;
    }
    clearLessonKnowledgeCache(targetLessonId);
    await loadAdminTheory({ keepSelection: true });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryStatus, "三级小节已删除", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryStatus, error.message || "删除失败", "error");
  }
}

// 初始化理论课 Quill 编辑器，注册知识卡/挑战气泡并绑定事件。
function initAdminTheoryLessonEditor() {
  if (!adminTheoryLessonEditorHost || adminTheoryLessonEditor) {
    return;
  }
  if (typeof window === "undefined" || typeof window.Quill === "undefined") {
    if (adminTheoryLessonContent) {
      adminTheoryLessonContent.classList.remove("hidden");
    }
    return;
  }
  registerChallengeBubbleBlot();
  registerKnowledgePointCardBlot();
  adminTheoryLessonEditor = new window.Quill(adminTheoryLessonEditorHost, {
    theme: "snow",
    placeholder: "请在此编写理论学习的富文本内容…",
    modules: {
      table: true,
      history: {
        delay: 1500,
        maxStack: 200,
        userOnly: true,
      },
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ script: "sub" }, { script: "super" }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ indent: "-1" }, { indent: "+1" }],
          [{ align: [] }],
          ["blockquote", "code-block"],
          ["link", "image", "table"],
          ["clean"],
        ],
      },
    },
  });
  try {
    const Delta = window.Quill.import("delta");
    adminTheoryLessonEditor.clipboard.addMatcher("span.challenge-link-bubble", (node) => {
      const chapterId = node.getAttribute("data-chapter-id") || "";
      const sectionId = node.getAttribute("data-section-id") || "";
      const label = node.getAttribute("data-label") || node.textContent || "关卡挑战";
      if (!chapterId || !sectionId) {
        return new Delta().insert(label);
      }
      return new Delta().insert({ challengeBubble: { chapterId, sectionId, label } }).insert(" ");
    });
    adminTheoryLessonEditor.clipboard.addMatcher("div.ql-knowledge-point-card", (node) => {
      const payload = readKnowledgeCardNodePayload(node);
      if (!payload || !extractKnowledgeName(payload)) {
        return new Delta().insert("");
      }
      return new Delta().insert({ knowledgePointCard: payload }).insert("\n");
    });
  } catch (error) {
    console.warn("未能注册理论挑战气泡剪贴板解析器", error);
  }
  adminTheoryLessonEditor.on("text-change", () => {
    syncKnowledgePointsFromEditor({ updateCache: false });
  });
  if (adminTheoryLessonEditor.root) {
    adminTheoryLessonEditor.root.addEventListener("dblclick", (event) => {
      const cardNode = event.target.closest(".ql-knowledge-point-card");
      if (cardNode) {
        const payload = readKnowledgeCardNodePayload(cardNode);
        openKnowledgeCardModal(payload, cardNode);
      }
    });
    bindKnowledgeSelectionWatcher();
  }
}

// 将 HTML 写入理论课编辑器（或隐藏 textarea 兜底）。
function setAdminTheoryEditorContent(html) {
  const content = typeof html === "string" ? html : "";
  if (adminTheoryLessonEditor) {
    adminTheoryLessonEditor.clipboard.dangerouslyPasteHTML(content || "<p><br></p>");
    syncKnowledgePointsFromEditor({ updateCache: false });
  } else if (adminTheoryLessonContent) {
    adminTheoryLessonContent.value = content;
  }
}

// 读取理论课编辑器内容（若无实例则从隐藏域读取）。
function getAdminTheoryEditorContent() {
  if (adminTheoryLessonEditor) {
    return adminTheoryLessonEditor.root.innerHTML;
  }
  if (adminTheoryLessonContent) {
    return adminTheoryLessonContent.value;
  }
  return "";
}

// 从全局 levels 结构中提取章节数组。
function getAdminLevelChapters() {
  return Array.isArray(state.admin.levels) ? state.admin.levels : [];
}

// 填充挑战选择器的关卡列表。
function populateChallengeSelectorSections(chapterId, selectedSectionId) {
  if (!challengeSelectorSection) {
    return;
  }
  challengeSelectorSection.innerHTML = "";
  const chapters = getAdminLevelChapters();
  const chapter = chapters.find((item) => item.id === chapterId);
  const sections = chapter && Array.isArray(chapter.sections) ? chapter.sections : [];
  sections.forEach((section, index) => {
    const option = document.createElement("option");
    option.value = section.id;
    option.textContent = `${section.title || section.id}`;
    if (selectedSectionId && section.id === selectedSectionId) {
      option.selected = true;
    } else if (!selectedSectionId && index === 0) {
      option.selected = true;
    }
    challengeSelectorSection.appendChild(option);
  });
  if (sections.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "当前章节暂无小节";
    challengeSelectorSection.appendChild(empty);
  }
}

// 填充挑战选择器的章节列表并联动关卡下拉。
function populateChallengeSelectorChapters(selectedChapterId, selectedSectionId) {
  if (!challengeSelectorChapter) {
    return;
  }
  const chapters = getAdminLevelChapters();
  challengeSelectorChapter.innerHTML = "";
  let targetChapterId = selectedChapterId;
  chapters.forEach((chapter, index) => {
    const option = document.createElement("option");
    option.value = chapter.id;
    option.textContent = chapter.displayTitle || chapter.title || chapter.id;
    if (!targetChapterId && index === 0) {
      option.selected = true;
      targetChapterId = chapter.id;
    } else if (targetChapterId && chapter.id === targetChapterId) {
      option.selected = true;
    }
    challengeSelectorChapter.appendChild(option);
  });
  if (!targetChapterId && chapters.length > 0) {
    targetChapterId = chapters[0].id;
  }
  populateChallengeSelectorSections(targetChapterId || "", selectedSectionId || "");
}

// 根据当前选择更新预览文本。
function updateChallengeSelectorPreview() {
  if (!challengeSelectorPreview) {
    return;
  }
  challengeSelectorPreview.innerHTML = "";
  const chapterId = challengeSelectorChapter ? challengeSelectorChapter.value : "";
  const sectionId = challengeSelectorSection ? challengeSelectorSection.value : "";
  if (!chapterId || !sectionId) {
    const hint = document.createElement("p");
    hint.className = "text-xs text-slate-400";
    hint.textContent = "请选择章节与小节关卡";
    challengeSelectorPreview.appendChild(hint);
    return;
  }
  const customLabel = challengeSelectorLabel ? challengeSelectorLabel.value.trim() : "";
  const section = findAdminSection(chapterId, sectionId);
  const displayLabel = customLabel || (section && section.title) || "关卡挑战";
  const bubble = document.createElement("span");
  bubble.className = "challenge-link-bubble";
  bubble.textContent = displayLabel;
  challengeSelectorPreview.appendChild(bubble);
}

// 打开挑战选择器弹窗，并尝试预选当前课程关联的关卡。
function openChallengeSelectorModal(preferredSectionId = null) {
  if (!challengeSelectorModal) {
    return;
  }
  const chapters = getAdminLevelChapters();
  if (chapters.length === 0) {
    alert("请先在关卡地图中创建章节与小节");
    return;
  }
  let targetChapterId = "";
  let targetSectionId = preferredSectionId || "";
  if (targetSectionId) {
    const match = chapters
      .flatMap((chapter) => (Array.isArray(chapter.sections) ? chapter.sections.map((section) => ({ chapter, section })) : []))
      .find(({ section }) => section.id === targetSectionId);
    if (match) {
      targetChapterId = match.chapter.id;
    }
  }
  if (!targetChapterId) {
    const lessonContext = state.admin.theory.selectedLessonId
      ? findAdminTheoryLesson(state.admin.theory.selectedLessonId)
      : null;
    if (lessonContext && lessonContext.chapter && lessonContext.chapter.chapterId) {
      targetChapterId = lessonContext.chapter.chapterId;
    }
  }
  if (!targetChapterId && chapters.length > 0) {
    targetChapterId = chapters[0].id;
  }
  if (challengeSelectorLabel) {
    challengeSelectorLabel.value = "";
  }
  populateChallengeSelectorChapters(targetChapterId, targetSectionId);
  updateChallengeSelectorPreview();
  challengeSelectorModal.classList.remove("hidden");
}

// 关闭挑战选择器弹窗并清理状态。
function closeChallengeSelectorModal() {
  if (!challengeSelectorModal) {
    return;
  }
  challengeSelectorModal.classList.add("hidden");
}

// 将关卡挑战气泡插入富文本编辑器，便于学生端跳转。
function insertChallengeBubbleIntoEditor(chapterId, sectionId, label) {
  if (!chapterId || !sectionId) {
    return;
  }
  const section = findAdminSection(chapterId, sectionId);
  const textLabel = label || (section && section.title) || "关卡挑战";
  if (adminTheoryLessonEditor) {
    const quill = adminTheoryLessonEditor;
    const range = quill.getSelection(true);
    const index = range && typeof range.index === "number" ? range.index : quill.getLength();
    quill.insertEmbed(index, "challengeBubble", { chapterId, sectionId, label: textLabel });
    quill.insertText(index + 1, " ");
    if (typeof quill.setSelection === "function") {
      const silentSource = window.Quill && window.Quill.sources ? window.Quill.sources.SILENT : null;
      if (silentSource) {
        quill.setSelection(index + 2, 0, silentSource);
      } else {
        quill.setSelection(index + 2, 0);
      }
    }
    if (typeof quill.focus === "function") {
      quill.focus();
    }
  } else if (adminTheoryLessonContent) {
    const safeLabel = escapeHtmlText(textLabel);
    const attrLabel = escapeHtmlAttribute(textLabel);
    const bubbleHtml =
      `<span class="challenge-link-bubble" data-chapter-id="${escapeHtmlAttribute(chapterId)}" data-section-id="${escapeHtmlAttribute(sectionId)}" data-label="${attrLabel}" contenteditable="false">${safeLabel}</span>&nbsp;`;
    adminTheoryLessonContent.value = `${adminTheoryLessonContent.value || ""}${bubbleHtml}`;
  }
}

// 刷新理论编辑相关表单（章节/关卡下拉、知识点缓存）。
function updateAdminTheoryForms() {
  ensureAdminTheoryState();
  if (adminTheoryTopicForm) {
    const mode = adminTheoryTopicForm.dataset.mode || "edit";
    const topicId = state.admin.theory.selectedTopicId;
    const topicContext = topicId ? findAdminTheoryTopic(topicId) : null;
    if (mode === "create") {
      adminTheoryTopicForm.classList.remove("hidden");
      adminTheoryTopicForm.dataset.mode = "create";
      const preferredChapterId = adminTheoryTopicForm.dataset.prefChapterId || "";
      if (adminTheoryTopicChapter) {
        const options = Array.from(adminTheoryTopicChapter.options || []);
        const matched = options.find((option) => option.value === preferredChapterId);
        if (matched) {
          adminTheoryTopicChapter.value = preferredChapterId;
        } else if (options.length > 0) {
          adminTheoryTopicChapter.value = options[0].value;
        } else {
          adminTheoryTopicChapter.value = "";
        }
      }
      if (adminTheoryTopicCode) adminTheoryTopicCode.value = "";
      if (adminTheoryTopicTitle) adminTheoryTopicTitle.value = "";
      if (adminTheoryTopicSummary) adminTheoryTopicSummary.value = "";
      if (adminTheoryTopicOrder) adminTheoryTopicOrder.value = "";
      if (adminTheoryTopicDeleteBtn) adminTheoryTopicDeleteBtn.disabled = true;
      updateInlineStatus(adminTheoryTopicStatus, "填写信息后保存即可创建新的理论目录。", "muted");
    } else if (topicContext) {
      adminTheoryTopicForm.classList.remove("hidden");
      adminTheoryTopicForm.dataset.mode = "edit";
      adminTheoryTopicForm.dataset.topicId = topicContext.topic.id;
      if (adminTheoryTopicChapter) {
        adminTheoryTopicChapter.value =
          topicContext.topic.chapterId || topicContext.chapter.chapterId || topicContext.chapter.id || "";
      }
      if (adminTheoryTopicCode) adminTheoryTopicCode.value = topicContext.topic.code || "";
      if (adminTheoryTopicTitle) adminTheoryTopicTitle.value = topicContext.topic.title || "";
      if (adminTheoryTopicSummary) adminTheoryTopicSummary.value = topicContext.topic.summary || "";
      if (adminTheoryTopicOrder) {
        adminTheoryTopicOrder.value =
          topicContext.topic.orderIndex !== null && topicContext.topic.orderIndex !== undefined
            ? topicContext.topic.orderIndex
            : "";
      }
      if (adminTheoryTopicDeleteBtn) adminTheoryTopicDeleteBtn.disabled = false;
      updateInlineStatus(adminTheoryTopicStatus, "", "muted");
    } else {
      adminTheoryTopicForm.classList.add("hidden");
      if (adminTheoryTopicDeleteBtn) adminTheoryTopicDeleteBtn.disabled = true;
      updateInlineStatus(adminTheoryTopicStatus, "请选择或新建理论目录。", "muted");
    }
  }

  if (!adminTheoryLessonForm) {
    renderAdminTheoryLessonHeading(null);
    return;
  }
  initAdminTheoryLessonEditor();
  const lessonId = state.admin.theory.selectedLessonId;
  const lessonContext = lessonId ? findAdminTheoryLesson(lessonId) : null;
  renderAdminTheoryLessonHeading(lessonContext);
  if (lessonContext) {
    adminTheoryLessonForm.classList.remove("hidden");
    adminTheoryLessonForm.dataset.mode = "edit";
    adminTheoryLessonForm.dataset.lessonId = lessonContext.lesson.id;
    if (adminTheoryLessonSection) {
      adminTheoryLessonSection.value = lessonContext.lesson.sectionId || "";
    }
    if (adminTheoryLessonPublished) {
      adminTheoryLessonPublished.checked = !!lessonContext.lesson.isPublished;
    }
    setAdminTheoryEditorContent(lessonContext.lesson.contentHtml || "<p><br></p>");
    if (adminTheoryLessonKnowledge) {
      const cache = state.admin.graph.lessonKnowledge;
      const cached = cache && cache.get ? cache.get(lessonContext.lesson.id) || [] : [];
      writeKnowledgeToTextarea(adminTheoryLessonKnowledge, cached);
      hydrateLessonKnowledge(lessonContext.lesson.id);
    }
    if (adminTheoryLessonDeleteBtn) adminTheoryLessonDeleteBtn.disabled = false;
    updateInlineStatus(adminTheoryLessonStatus, "", "muted");
  } else {
    adminTheoryLessonForm.classList.add("hidden");
    adminTheoryLessonForm.dataset.mode = "edit";
    adminTheoryLessonForm.dataset.lessonId = "";
    if (adminTheoryLessonDeleteBtn) adminTheoryLessonDeleteBtn.disabled = true;
    setAdminTheoryEditorContent("<p><br></p>");
    writeKnowledgeToTextarea(adminTheoryLessonKnowledge, []);
    updateInlineStatus(adminTheoryLessonStatus, "请选择理论内容以编辑，或新建一个内容小节。", "muted");
  }
}

// 进入“新增主题”模式，清空课程表单并预选章节。
function enterAdminTheoryTopicCreateMode(preferredChapterId = null) {
  ensureAdminTheoryState();
  if (!adminTheoryTopicForm) {
    return;
  }
  adminTheoryTopicForm.dataset.mode = "create";
  adminTheoryTopicForm.dataset.prefChapterId = preferredChapterId || "";
  state.admin.theory.selectedTopicId = null;
  state.admin.theory.selectedLessonId = null;
  renderAdminTheoryTree();
  updateAdminTheoryForms();
}

// 进入“新增课程”模式，清空表单并预选主题。
function enterAdminTheoryLessonCreateMode(preferredTopicId = null) {
  ensureAdminTheoryState();
  const targetTopicId = (preferredTopicId || state.admin.theory.selectedTopicId || "").trim();
  if (!targetTopicId) {
    alert("请先选择二级小节");
    return;
  }
  createAdminTheoryLessonInline(targetTopicId);
}

// 切换选择的主题，刷新课程列表与表单。
function selectAdminTheoryTopic(topicId) {
  ensureAdminTheoryState();
  state.admin.theory.selectedTopicId = topicId;
  const context = topicId ? findAdminTheoryTopic(topicId) : null;
  if (context) {
    const lessons = Array.isArray(context.topic.lessons) ? context.topic.lessons : [];
    if (!lessons.some((lesson) => lesson.id === state.admin.theory.selectedLessonId)) {
      state.admin.theory.selectedLessonId = lessons.length > 0 ? lessons[0].id : null;
    }
  } else {
    state.admin.theory.selectedLessonId = null;
  }
  adminTheoryTopicForm.dataset.mode = "edit";
  renderAdminTheoryTree();
  updateAdminTheoryForms();
}

// 选择课程，填充表单、加载知识点并更新编辑器。
function selectAdminTheoryLesson(lessonId) {
  ensureAdminTheoryState();
  state.admin.theory.selectedLessonId = lessonId;
  adminTheoryLessonForm.dataset.mode = "edit";
  if (lessonId) {
    const context = findAdminTheoryLesson(lessonId);
    if (context) {
      state.admin.theory.selectedTopicId = context.topic.id;
    }
  }
  renderAdminTheoryTree();
  updateAdminTheoryForms();
}

async function loadAdminTheory(options = {}) {
  if (!state.auth.user || state.auth.user.role !== "teacher") {
    return;
  }
  ensureAdminTheoryState();
  const { focusTopicId = null, focusLessonId = null, keepSelection = false } = options;
  try {
    const response = await fetchWithAuth("/api/admin/theory?includeContent=true");
    if (!response.ok) {
      throw new Error("无法加载理论学习数据");
    }
    const data = await response.json();
    const tree = Array.isArray(data.theory) ? data.theory : [];
    state.admin.theory.tree = tree;

    let nextTopicId = focusTopicId;
    if (!nextTopicId) {
      if (keepSelection && state.admin.theory.selectedTopicId && findAdminTheoryTopic(state.admin.theory.selectedTopicId)) {
        nextTopicId = state.admin.theory.selectedTopicId;
      } else {
        const firstTopic = collectAdminTheoryTopics()[0];
        nextTopicId = firstTopic ? firstTopic.topic.id : null;
      }
    }
    state.admin.theory.selectedTopicId = nextTopicId;

    let nextLessonId = focusLessonId;
    if (!nextLessonId) {
      if (
        keepSelection &&
        state.admin.theory.selectedLessonId &&
        findAdminTheoryLesson(state.admin.theory.selectedLessonId)
      ) {
        nextLessonId = state.admin.theory.selectedLessonId;
      } else if (nextTopicId) {
        const topic = findAdminTheoryTopic(nextTopicId);
        if (topic) {
          const lessons = Array.isArray(topic.topic.lessons) ? topic.topic.lessons : [];
          nextLessonId = lessons.length > 0 ? lessons[0].id : null;
        }
      }
    }
    state.admin.theory.selectedLessonId = nextLessonId;

    populateAdminTheorySectionOptions();
    renderAdminTheoryTree();
    updateAdminTheoryForms();
    updateInlineStatus(adminTheoryStatus, "理论目录已更新", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryStatus, error.message || "加载理论学习失败", "error");
  }
}

async function saveAdminTheoryTopic(event) {
  event.preventDefault();
  if (!adminTheoryTopicForm) {
    return;
  }
  const mode = adminTheoryTopicForm.dataset.mode || "edit";
  const chapterId = adminTheoryTopicChapter ? adminTheoryTopicChapter.value : "";
  const payload = {
    chapterId,
    code: adminTheoryTopicCode ? adminTheoryTopicCode.value.trim() : "",
    title: adminTheoryTopicTitle ? adminTheoryTopicTitle.value.trim() : "",
    summary: adminTheoryTopicSummary ? adminTheoryTopicSummary.value.trim() : "",
  };
  if (adminTheoryTopicOrder && adminTheoryTopicOrder.value.trim() !== "") {
    payload.orderIndex = Number(adminTheoryTopicOrder.value);
  }
  try {
    if (mode === "create") {
      const response = await fetchWithAuth("/api/admin/theory/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "创建理论目录失败");
      }
      const data = await response.json();
      const newTopicId = data.topic && data.topic.id;
      await loadAdminTheory({ focusTopicId: newTopicId });
      adminTheoryTopicForm.dataset.mode = "edit";
      updateInlineStatus(adminTheoryTopicStatus, "理论目录已创建", "success");
      refreshAdminGraph();
    } else {
      const topicId = adminTheoryTopicForm.dataset.topicId;
      if (!topicId) {
        throw new Error("未选择理论目录");
      }
      const response = await fetchWithAuth(`/api/admin/theory/topics/${topicId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "更新理论目录失败");
      }
      await loadAdminTheory({ focusTopicId: topicId, keepSelection: true });
      updateInlineStatus(adminTheoryTopicStatus, "理论目录已保存", "success");
      refreshAdminGraph();
    }
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryTopicStatus, error.message || "保存失败", "error");
  }
}

async function deleteAdminTheoryTopic() {
  if (!adminTheoryTopicForm) {
    return;
  }
  const topicId = adminTheoryTopicForm.dataset.topicId;
  if (!topicId) {
    alert("请选择理论目录");
    return;
  }
  if (!confirm("确认删除该理论目录及其下的所有内容？")) {
    return;
  }
  try {
    const context = findAdminTheoryTopic(topicId);
    const removedLessonIds = context && context.topic && Array.isArray(context.topic.lessons)
      ? context.topic.lessons.map((lesson) => lesson && lesson.id).filter((id) => id)
      : [];
    const response = await fetchWithAuth(`/api/admin/theory/topics/${topicId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    clearLessonKnowledgeCache(removedLessonIds);
    await loadAdminTheory();
    adminTheoryTopicForm.dataset.mode = "edit";
    updateInlineStatus(adminTheoryTopicStatus, "理论目录已删除", "success");
    refreshAdminGraph();
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryTopicStatus, error.message || "删除失败", "error");
  }
}

async function saveAdminTheoryLesson(event) {
  event.preventDefault();
  if (!adminTheoryLessonForm) {
    return;
  }
  const lessonId = adminTheoryLessonForm.dataset.lessonId;
  if (!lessonId) {
    alert("请选择理论内容");
    return;
  }
  const contextBeforeSave = findAdminTheoryLesson(lessonId);
  const payload = {
    contentHtml: getAdminTheoryEditorContent(),
  };
  let knowledgePoints = [];
  if (adminTheoryLessonEditor) {
    knowledgePoints = syncKnowledgePointsFromEditor({ updateCache: false });
  } else {
    knowledgePoints = readKnowledgeFromTextarea(adminTheoryLessonKnowledge).map((name) => ({ name }));
  }
  if (adminTheoryLessonSection) {
    payload.sectionId = adminTheoryLessonSection.value;
  }
  if (adminTheoryLessonPublished) {
    payload.isPublished = !!adminTheoryLessonPublished.checked;
  }
  try {
    updateInlineStatus(adminTheoryLessonStatus, "正在保存理论内容...", "muted");
    const response = await fetchWithAuth(`/api/admin/theory/lessons/${lessonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "保存失败");
    }
    const targetTopicId = contextBeforeSave ? contextBeforeSave.topic.id : state.admin.theory.selectedTopicId;
    await loadAdminTheory({ focusTopicId: targetTopicId, focusLessonId: lessonId, keepSelection: true });
    try {
      const updated = await persistLessonKnowledge(lessonId, knowledgePoints);
      refreshKnowledgeCardNodesFromPayloads(updated);
      writeKnowledgeToTextarea(adminTheoryLessonKnowledge, updated);
      refreshAdminGraph();
    } catch (graphError) {
      updateInlineStatus(adminTheoryLessonStatus, graphError.message || "知识点更新失败", "error");
    }
    updateInlineStatus(adminTheoryLessonStatus, "理论内容已保存", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryLessonStatus, error.message || "保存失败", "error");
  }
}

async function deleteAdminTheoryLesson() {
  if (!adminTheoryLessonForm) {
    return;
  }
  const lessonId = adminTheoryLessonForm.dataset.lessonId;
  if (!lessonId) {
    alert("请选择理论内容");
    return;
  }
  if (!confirm("确认删除该理论内容？")) {
    return;
  }
  try {
    const contextBeforeDelete = findAdminTheoryLesson(lessonId);
    updateInlineStatus(adminTheoryLessonStatus, "正在删除理论内容...", "muted");
    const response = await fetchWithAuth(`/api/admin/theory/lessons/${lessonId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    clearLessonKnowledgeCache(lessonId);
    const topicId = contextBeforeDelete ? contextBeforeDelete.topic.id : state.admin.theory.selectedTopicId;
    await loadAdminTheory({ focusTopicId: topicId });
    refreshAdminGraph();
    updateInlineStatus(adminTheoryLessonStatus, "理论内容已删除", "success");
  } catch (error) {
    console.error(error);
    updateInlineStatus(adminTheoryLessonStatus, error.message || "删除失败", "error");
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
    refreshAdminGraph();
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
    refreshAdminGraph();
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
    refreshAdminGraph();
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
    clearPracticeKnowledgeCache();
    clearLessonKnowledgeCache();
    await loadAdminLevels();
    refreshAdminGraph();
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
  const knowledgePoints = readKnowledgeFromTextarea(sectionEditorKnowledge);
  if (tokenEditors.environment) {
    payload.environmentPromptTemplate = tokenEditors.environment.getValue();
  } else if (sectionEditorEnvironment) {
    payload.environmentPromptTemplate = sectionEditorEnvironment.value;
  }
  if (sectionEditorEnvironmentUser)
    payload.environmentUserMessage = sectionEditorEnvironmentUser.value;
  if (tokenEditors.conversation) {
    payload.conversationPromptTemplate = tokenEditors.conversation.getValue();
  } else if (sectionEditorConversation) {
    payload.conversationPromptTemplate = sectionEditorConversation.value;
  }
  if (tokenEditors.evaluation) {
    payload.evaluationPromptTemplate = tokenEditors.evaluation.getValue();
  } else if (sectionEditorEvaluation) {
    payload.evaluationPromptTemplate = sectionEditorEvaluation.value;
  }
  if (sectionEditorBargaining !== null)
    payload.expectsBargaining = !!sectionEditorBargaining.checked;
  if (sectionEditorOrder && sectionEditorOrder.value.trim() !== "") {
    payload.orderIndex = Number(sectionEditorOrder.value);
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
    try {
      const updated = await persistPracticeKnowledge(sectionId, knowledgePoints);
      writeKnowledgeToTextarea(sectionEditorKnowledge, updated);
      refreshAdminGraph();
    } catch (graphError) {
      alert(graphError.message || "更新知识点失败");
    }
  } catch (error) {
    console.error(error);
    alert(error.message || "保存小节失败");
  }
}

async function deleteAdminSection() {
  const chapterId = state.admin.selectedEditorChapterId;
  const sectionId = state.admin.selectedEditorSectionId;
  if (!chapterId || !sectionId) {
    alert("请先选择小节");
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
    clearPracticeKnowledgeCache(sectionId);
    state.admin.selectedEditorSectionId = null;
    await loadAdminLevels({ chapterId });
    refreshAdminGraph();
  } catch (error) {
    console.error(error);
    alert(error.message || "删除小节失败");
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
    state.admin.totalSections = data.totalSections || state.admin.totalSections || 0;
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
  state.admin.assignments = [];
  state.admin.selectedAssignmentId = null;
  renderAssignmentList();
  renderAssignmentStudents();
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
    const savedBlueprint =
      data && data.blueprint && typeof data.blueprint === "object"
        ? data.blueprint
        : {};
    if (adminBlueprintStatus) adminBlueprintStatus.textContent = "蓝图已保存";
    state.admin.selectedBlueprintId = savedBlueprint.id || null;
    resetBlueprintForm(savedBlueprint);
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
  if (adminAssignmentStatus) {
    adminAssignmentStatus.textContent = "Assignments are disabled.";
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


const tokenEditors = {};

// TokenEditor：用于编辑包含占位符的系统提示词，提供 token 插入、拖拽、格式化等体验。
class TokenEditor {
  constructor({ container, textarea, definitions, groups, placeholder }) {
    this.container = container;
    this.textarea = textarea;
    this.definitions = definitions || {};
    this.groups = Array.isArray(groups)
      ? groups.map((group) => ({
          label: group.label,
          tokens: Array.isArray(group.tokens) ? [...group.tokens] : [],
        }))
      : [];
    this.placeholder = placeholder || "";
    this.customTokens = new Set();

    this._handleToolbarClick = this._handleToolbarClick.bind(this);
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handlePaste = this._handlePaste.bind(this);
    this._emitChange = this._emitChange.bind(this);
    this._handleCustomTokenSubmit = this._handleCustomTokenSubmit.bind(this);

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

    this._createCustomControls();
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
    if (this.customTokens && this.customTokens.size > 0) {
      const customGroup = document.createElement("div");
      customGroup.className = "token-editor-group token-editor-group-custom";
      const labelEl = document.createElement("span");
      labelEl.className = "token-editor-group-label";
      labelEl.textContent = "自定义变量";
      customGroup.appendChild(labelEl);
      Array.from(this.customTokens)
        .sort()
        .forEach((tokenName) => {
          const def = this.definitions[tokenName] || { label: tokenName };
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.tokenName = tokenName;
          button.textContent = def.label || tokenName;
          const tokenLabel = `{${tokenName}}`;
          button.title = def.description ? `${tokenLabel}｜${def.description}` : tokenLabel;
          customGroup.appendChild(button);
        });
      this.toolbar.appendChild(customGroup);
    }
    if (this.customControls) {
      this.toolbar.appendChild(this.customControls);
    }
  }

  _createCustomControls() {
    if (!this.toolbar) {
      return;
    }
    this.customControls = document.createElement("div");
    this.customControls.className = "token-editor-actions";
    const hint = document.createElement("p");
    hint.className = "token-editor-actions-hint";
    hint.textContent = "如需新的占位符，可在此新增变量名，系统会自动以 {变量名} 形式替换。";
    this.customControls.appendChild(hint);
    const form = document.createElement("form");
    form.className = "token-editor-add-form";
    this.customNameInput = document.createElement("input");
    this.customNameInput.type = "text";
    this.customNameInput.placeholder = "变量名（仅字母、数字、下划线）";
    this.customLabelInput = document.createElement("input");
    this.customLabelInput.type = "text";
    this.customLabelInput.placeholder = "展示名称（选填）";
    const submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.textContent = "添加变量";
    form.appendChild(this.customNameInput);
    form.appendChild(this.customLabelInput);
    form.appendChild(submitBtn);
    form.addEventListener("submit", this._handleCustomTokenSubmit);
    this.customControls.appendChild(form);
    this.customFeedback = document.createElement("p");
    this.customFeedback.classList.add("token-editor-actions-feedback", "text-slate-500");
    this.customControls.appendChild(this.customFeedback);
  }

  _handleCustomTokenSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.customNameInput) {
      return;
    }
    const rawName = (this.customNameInput.value || "").trim();
    const normalized = this._normalizeTokenName(rawName);
    if (!normalized) {
      this._setCustomFeedback("变量名需以字母开头，仅包含字母、数字或下划线。", "error");
      return;
    }
    if (this._hasToken(normalized)) {
      this._setCustomFeedback("该变量已存在，可直接在上方列表中使用。", "success");
      return;
    }
    const label = (this.customLabelInput && this.customLabelInput.value
      ? this.customLabelInput.value.trim()
      : "")
      || normalized;
    const definition = {
      label,
      description: `自定义变量，可在保存后由系统替换真实的 ${label}。`,
    };
    this.registerCustomToken(normalized, definition);
    PROMPT_TOKEN_DEFINITIONS[normalized] = definition;
    Object.values(tokenEditors).forEach((editor) => {
      if (editor && editor !== this && typeof editor.registerCustomToken === "function") {
        editor.registerCustomToken(normalized, definition);
      }
    });
    if (this.customNameInput) {
      this.customNameInput.value = "";
    }
    if (this.customLabelInput) {
      this.customLabelInput.value = "";
    }
    this._setCustomFeedback("变量已添加，可在正文中点击插入。", "success");
    this._insertToken(normalized);
    this.focus();
  }

  registerCustomToken(name, definition = {}) {
    const normalized = this._normalizeTokenName(name);
    if (!normalized) {
      return null;
    }
    const def = {
      label: definition.label || normalized,
      description: definition.description || `自定义变量 {${normalized}}`,
    };
    this.definitions[normalized] = def;
    if (!this.customTokens) {
      this.customTokens = new Set();
    }
    if (!this.customTokens.has(normalized)) {
      this.customTokens.add(normalized);
      this._renderToolbar();
    } else {
      this._renderToolbar();
    }
    return normalized;
  }

  _normalizeTokenName(name) {
    if (typeof name !== "string") {
      return "";
    }
    const trimmed = name.trim().replace(/\s+/g, "_");
    if (!/^[A-Za-z][A-Za-z0-9_]{1,48}$/.test(trimmed)) {
      return "";
    }
    return trimmed;
  }

  _hasToken(name) {
    if (!name) {
      return false;
    }
    const baseGroups = this.groups || [];
    const existsInGroups = baseGroups.some(
      (group) => Array.isArray(group.tokens) && group.tokens.includes(name),
    );
    return existsInGroups || (this.customTokens && this.customTokens.has(name));
  }

  _setCustomFeedback(message, variant = "muted") {
    if (!this.customFeedback) {
      return;
    }
    this.customFeedback.textContent = message || "";
    this.customFeedback.classList.remove("text-slate-500", "text-emerald-500", "text-rose-500");
    if (!message || variant === "muted") {
      this.customFeedback.classList.add("text-slate-500");
    } else if (variant === "success") {
      this.customFeedback.classList.add("text-emerald-500");
    } else if (variant === "error") {
      this.customFeedback.classList.add("text-rose-500");
    } else {
      this.customFeedback.classList.add("text-slate-500");
    }
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

// 当富文本 token 编辑器无法加载时，回退为普通 textarea 编辑模式。
function activateTokenEditorFallback(textarea, host) {
  if (host && !host.dataset.fallbackMessage) {
    host.dataset.fallbackMessage = "true";
    host.classList.remove("token-editor");
    host.classList.add("token-editor-fallback-wrapper");
    host.innerHTML =
      '<p class="token-editor-fallback-message">富文本编辑器未加载，已切换到基础文本框，请直接输入内容并使用 {变量名} 占位符。</p>';
  }
  if (textarea) {
    textarea.classList.remove("hidden");
    textarea.classList.add(
      "w-full",
      "rounded-xl",
      "border",
      "border-slate-700",
      "bg-slate-950/60",
      "px-3",
      "py-2",
      "text-sm",
      "text-white",
      "focus:border-emerald-400",
      "focus:outline-none"
    );
  }
}

// 初始化章节/客服等模板的 TokenEditor 组件，失败则降级为回退模式。
function initTokenEditors() {
  const definitions = PROMPT_TOKEN_DEFINITIONS;
  const groups = PROMPT_TOKEN_GROUPS;
  if (sectionEditorEnvironment && sectionEditorEnvironmentHost) {
    try {
      tokenEditors.environment = new TokenEditor({
        container: sectionEditorEnvironmentHost,
        textarea: sectionEditorEnvironment,
        definitions,
        groups,
        placeholder: "描述用于生成场景的系统提示，变量会被后台自动替换。",
      });
    } catch (error) {
      console.error("初始化环境提示编辑器失败", error);
      tokenEditors.environment = null;
      activateTokenEditorFallback(sectionEditorEnvironment, sectionEditorEnvironmentHost);
    }
  } else if (sectionEditorEnvironment) {
    activateTokenEditorFallback(sectionEditorEnvironment, sectionEditorEnvironmentHost);
  }
  if (sectionEditorConversation && sectionEditorConversationHost) {
    try {
      tokenEditors.conversation = new TokenEditor({
        container: sectionEditorConversationHost,
        textarea: sectionEditorConversation,
        definitions,
        groups,
        placeholder: "规划 AI 的回应策略、语气与规则，可随时插入变量。",
      });
    } catch (error) {
      console.error("初始化对话提示编辑器失败", error);
      tokenEditors.conversation = null;
      activateTokenEditorFallback(sectionEditorConversation, sectionEditorConversationHost);
    }
  } else if (sectionEditorConversation) {
    activateTokenEditorFallback(sectionEditorConversation, sectionEditorConversationHost);
  }
  if (sectionEditorEvaluation && sectionEditorEvaluationHost) {
    try {
      tokenEditors.evaluation = new TokenEditor({
        container: sectionEditorEvaluationHost,
        textarea: sectionEditorEvaluation,
        definitions,
        groups,
        placeholder: "定义评估维度与输出格式，变量将用于生成针对性的反馈。",
      });
    } catch (error) {
      console.error("初始化评价提示编辑器失败", error);
      tokenEditors.evaluation = null;
      activateTokenEditorFallback(sectionEditorEvaluation, sectionEditorEvaluationHost);
    }
  } else if (sectionEditorEvaluation) {
    activateTokenEditorFallback(sectionEditorEvaluation, sectionEditorEvaluationHost);
  }
  if (adminAssignmentScenario && adminAssignmentScenarioHost) {
    try {
      tokenEditors.assignmentScenario = new TokenEditor({
        container: adminAssignmentScenarioHost,
        textarea: adminAssignmentScenario,
        definitions,
        groups,
        placeholder: "使用 JSON 描述统一作业场景，可插入变量占位符。",
      });
    } catch (error) {
      console.error("初始化统一作业场景编辑器失败", error);
      tokenEditors.assignmentScenario = null;
      activateTokenEditorFallback(adminAssignmentScenario, adminAssignmentScenarioHost);
    }
  } else if (adminAssignmentScenario) {
    activateTokenEditorFallback(adminAssignmentScenario, adminAssignmentScenarioHost);
  }
}
