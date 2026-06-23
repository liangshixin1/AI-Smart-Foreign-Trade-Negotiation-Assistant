// -------------------- 全局状态与编辑器实例 --------------------
// adminTheoryLessonEditor：后台理论课 Quill 编辑器实例，承载知识卡、挑战气泡等富文本组件。
let adminTheoryLessonEditor = null;
// 是否已注册 Quill 自定义 blots，避免重复注册。
let challengeBubbleBlotRegistered = false;
let knowledgePointCardBlotRegistered = false;
// 图谱渲染相关实例：默认使用自研 SVG 语义网络，G6 仅作为历史/兜底能力保留。
let adminGraphNetwork = null;
let adminG6Graph = null;
let adminGraphSelectionKey = null;
// 后台知识图谱渲染模式，默认采用“关系优先”的语义网络。
let adminGraphRenderer = "semantic";
// 知识图谱分层方向：TB=纵向（阶段在上），LR=横向（阶段在左）。可通过工具栏按钮切换。
let adminGraphDirection = "TB";
const expandedStages = new Set();
const expandedTopics = new Set();
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

// 渲染后台知识图谱（默认走关系优先的语义网络，而不是开花/思维导图）。
function renderAdminGraphNetwork() {
  if (!adminGraphCanvas) {
    return;
  }

  if (adminGraphNetwork) {
    adminGraphNetwork.dispose();
    adminGraphNetwork = null;
  }
  if (adminG6Graph) {
    adminG6Graph.destroy();
    adminG6Graph = null;
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

  const width = adminGraphCanvas.clientWidth || 960;
  const height = adminGraphCanvas.clientHeight || 820;

  // 关系优先语义网络：显式呈现流程、包含、前置、策略、跨文化等多类型联系。
  renderSemanticRelationGraph(nodesRaw, edgesRaw, width, height);
}

// 根据不同渲染模式生成 G6 布局配置。
function createGraphLayout(mode, nodes, edges) {
  if (mode === "force") {
    // 根据节点类型/边类型调整距离，避免堆叠
    const linkDistance = (d) => {
      const edgeType = d?.data?.type;
      const source = nodes.find((n) => n.id === d.source);
      const target = nodes.find((n) => n.id === d.target);
      const isStageLine = source?.nodeType === "Stage" || target?.nodeType === "Stage";
      const isTopicLine = source?.nodeType === "Topic" || target?.nodeType === "Topic";
      if (isStageLine) return 240;
      if (isTopicLine) return 180;
      if (edgeType === "PRECEDES") return 200;
      return 110;
    };
    const nodeStrength = (node) => {
      if (node.nodeType === "Stage") return -600;
      if (node.nodeType === "Topic") return -360;
      return -120;
    };
    const edgeStrength = (edge) => {
      if (edge.label === "PRECEDES") return 0.05;
      if (edge.label === "CONTAIN_TOPIC" || edge.label === "HAS_CATEGORY") return 0.08;
      return 0.02;
    };
    return {
      type: "force",
      preventOverlap: true,
      nodeSpacing: 24,
      linkDistance,
      nodeStrength,
      edgeStrength,
      alpha: 0.8,
      alphaDecay: 0.05,
      collideStrength: 0.75,
      onTick: () => {
        // 控制缩放范围，避免突然奔溃到屏外
        if (adminG6Graph) {
          const zoom = adminG6Graph.getZoom();
          if (zoom < 0.2) adminG6Graph.zoomTo(0.2);
          if (zoom > 3) adminG6Graph.zoomTo(3);
        }
      },
    };
  }

  return {
    type: "dagre",
    rankdir: "LR",
    nodesep: 40,
    ranksep: 160,
    controlPoints: true,
    preventOverlap: true,
    nodeSize: 34,
  };
}


const GRAPH_NODE_STYLES = {
  Stage: { fill: "#2563eb", stroke: "#93c5fd", shape: "pill" },
  Topic: { fill: "#f97316", stroke: "#fed7aa", shape: "rect" },
  KnowledgePoint: { fill: "#22c55e", stroke: "#bbf7d0", shape: "circle" },
  Skill: { fill: "#0ea5e9", stroke: "#bae6fd", shape: "circle" },
  Terminology: { fill: "#475569", stroke: "#cbd5e1", shape: "circle" },
  CultureDimension: { fill: "#a855f7", stroke: "#e9d5ff", shape: "diamond" },
  Practice: { fill: "#0f766e", stroke: "#99f6e4", shape: "rect" },
  TheoryLesson: { fill: "#9a3412", stroke: "#fed7aa", shape: "rect" },
  Chapter: { fill: "#64748b", stroke: "#cbd5e1", shape: "rect" },
  ProcessStep: { fill: "#64748b", stroke: "#cbd5e1", shape: "circle" },
};

const GRAPH_RELATION_STYLES = {
  PRECEDES: { color: "#2563eb", label: "流程顺序", dash: "", width: 2.4, group: "flow" },
  NEXT: { color: "#2563eb", label: "流程顺序", dash: "", width: 2.4, group: "flow" },
  CONTAIN_TOPIC: { color: "#94a3b8", label: "包含", dash: "4 5", width: 1.2, group: "hierarchy" },
  INCLUDE_POINT: { color: "#94a3b8", label: "收录", dash: "4 5", width: 1.1, group: "hierarchy" },
  HAS_CATEGORY: { color: "#94a3b8", label: "分类", dash: "4 5", width: 1.1, group: "hierarchy" },
  CONTAINS: { color: "#94a3b8", label: "包含", dash: "4 5", width: 1.1, group: "hierarchy" },
  REQUIRES: { color: "#ef4444", label: "前置依赖", dash: "", width: 2.1, group: "semantic" },
  RELATED_TO: { color: "#14b8a6", label: "横向关联", dash: "6 4", width: 1.8, group: "semantic" },
  RELATES_TO: { color: "#14b8a6", label: "横向关联", dash: "6 4", width: 1.8, group: "semantic" },
  CONTRASTS_WITH: { color: "#f59e0b", label: "相似/对比", dash: "3 3", width: 1.9, group: "semantic" },
  APPLIES_TO_SCENARIO: { color: "#06b6d4", label: "情境-策略", dash: "", width: 2, group: "semantic" },
  SUGGESTS_STRATEGY: { color: "#06b6d4", label: "策略建议", dash: "", width: 2, group: "semantic" },
  HAS_EXCEPTION: { color: "#f97316", label: "规则-例外", dash: "2 5", width: 2, group: "semantic" },
  COMBINES_WITH: { color: "#84cc16", label: "策略组合", dash: "", width: 1.9, group: "semantic" },
  CONFLICTS_WITH: { color: "#dc2626", label: "策略冲突", dash: "2 4", width: 2, group: "semantic" },
  HAS_CULTURAL_SENSITIVITY: { color: "#a855f7", label: "跨文化敏感", dash: "", width: 2.2, group: "culture" },
  INVOLVES_CULTURE: { color: "#a855f7", label: "涉及文化", dash: "", width: 2.2, group: "culture" },
  CULTURE_SENSITIVE_TO: { color: "#a855f7", label: "文化映射", dash: "", width: 2.2, group: "culture" },
  MAPS_TO_STAGE: { color: "#6366f1", label: "映射阶段", dash: "5 3", width: 1.7, group: "semantic" },
  TESTS: { color: "#0f766e", label: "练习考察", dash: "", width: 1.8, group: "resource" },
  EXPLAINS: { color: "#9a3412", label: "课时讲解", dash: "", width: 1.8, group: "resource" },
};

function getGraphNodeId(node) {
  return node?.key || node?.id || node?.name || "";
}

function getGraphNodeTitle(node) {
  return node?.title || node?.name || node?.key || node?.id || "未命名";
}

function getRelationStyle(type) {
  return GRAPH_RELATION_STYLES[type] || { color: "#64748b", label: type || "关系", dash: "4 4", width: 1.4, group: "other" };
}

function sanitizeSvgText(text) {
  return String(text || "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]));
}

function truncateGraphLabel(text, max = 12) {
  const value = String(text || "");
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

// ─── 阶段脊椎布局（Stage-Spine Layout）─────────────────────────────────────────
// 核心设计：以十大谈判阶段为横向主轴，Topic/KP等节点在各阶段列下方垂直排列。
// 不使用 dagre——dagre 会把所有 Stage 打进同一行、所有 KP 打进同一行，形成三条平带。
// ────────────────────────────────────────────────────────────────────────────────

const MAX_TOPICS_PER_STAGE = 4;   // 每阶段最多显示的主题数
const MAX_KPS_PER_TOPIC    = 3;   // 每主题最多显示的知识点数（横向排列）
const MAX_SEMANTIC_EDGES   = 60;  // 跨阶段语义连线上限，避免视觉污染

// 语义连线优先级（数字小=优先保留）
const SEM_EDGE_PRIORITY = {
  PRECEDES: 0, NEXT: 0,
  REQUIRES: 1,
  HAS_CULTURAL_SENSITIVITY: 2, INVOLVES_CULTURE: 2, CULTURE_SENSITIVE_TO: 2,
  APPLIES_TO_SCENARIO: 3, SUGGESTS_STRATEGY: 3,
  CONTRASTS_WITH: 4, CONFLICTS_WITH: 4, COMBINES_WITH: 4,
  HAS_EXCEPTION: 5,
  RELATED_TO: 9, RELATES_TO: 9,
};

/**
 * 将 PRECEDES 边拓扑排序 Stage 节点，确保阶段按真实外贸流程顺序从左到右排列。
 */
function topoSortStages(allStages, edgesRaw) {
  const stageIds = new Set(allStages.map(s => s.id));
  const inDeg = new Map(allStages.map(s => [s.id, 0]));
  const adj   = new Map(allStages.map(s => [s.id, []]));
  edgesRaw.forEach(e => {
    const src = e.source || e.from, tgt = e.target || e.to;
    if (e.type === 'PRECEDES' && stageIds.has(src) && stageIds.has(tgt)) {
      adj.get(src).push(tgt);
      inDeg.set(tgt, (inDeg.get(tgt) || 0) + 1);
    }
  });
  const queue = allStages.filter(s => inDeg.get(s.id) === 0)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const result = [], seen = new Set();
  while (queue.length) {
    const s = queue.shift();
    if (seen.has(s.id)) continue;
    seen.add(s.id); result.push(s);
    (adj.get(s.id) || []).forEach(nid => {
      inDeg.set(nid, inDeg.get(nid) - 1);
      if (inDeg.get(nid) === 0) {
        const node = allStages.find(x => x.id === nid);
        if (node) queue.push(node);
      }
    });
  }
  allStages.forEach(s => { if (!seen.has(s.id)) result.push(s); });
  return result;
}

/**
 * 计算阶段脊椎布局的节点位置（返回 Map<id, {x,y}>）。
 *
 * 布局层次：
 *   Layer 0 (top)   — Stage 横向均匀分布
 *   Layer 1         — Topic  在各自所属阶段列下方叠放（最多 MAX_TOPICS_PER_STAGE 个）
 *   Layer 2         — KP     在各 Topic 下方横向排开（最多 MAX_KPS_PER_TOPIC 个）
 *   Right column    — CultureDimension（文化维度独立于阶段柱，放右侧）
 *   Bottom row      — Practice / TheoryLesson / Chapter（课时/实战放底部）
 */
function buildStageSpinePositions(nodeMap, edgesRaw, width, height) {
  // ── 1. 建立层级父子映射 ──
  const stageTopics = new Map(); // stageId -> [topicId]
  const topicKPs    = new Map(); // topicId -> [kpId]
  edgesRaw.forEach(e => {
    const src = e.source || e.from, tgt = e.target || e.to;
    if (!src || !tgt || src === tgt) return;
    if (e.type === 'CONTAIN_TOPIC') {
      if (!stageTopics.has(src)) stageTopics.set(src, []);
      stageTopics.get(src).push(tgt);
    }
    if (['INCLUDE_POINT', 'HAS_CATEGORY', 'CONTAINS'].includes(e.type)) {
      if (!topicKPs.has(src)) topicKPs.set(src, []);
      topicKPs.get(src).push(tgt);
    }
  });

  // ── 2. 对 Stage 进行拓扑排序 ──
  const allStages = [...nodeMap.values()]
    .filter(n => (n.label || n.nodeType) === 'Stage')
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  const stages = topoSortStages(allStages, edgesRaw);
  const numStages = Math.max(stages.length, 1);

  // ── 3. 计算列宽与各层 Y 值 ──
  const marginX    = 60;
  const marginTop  = 30;
  const usableW    = width - marginX * 2;
  const colW       = usableW / numStages;     // 每阶段占用的水平带宽

  const STAGE_Y    = marginTop + 24;          // 阶段节点中心 Y
  const TOPIC_Y0   = STAGE_Y  + 90;          // 第一个 Topic 中心 Y
  const TOPIC_DY   = 76;                      // 相邻 Topic 的垂直间距
  const KP_DY      = 46;                      // Topic 到其 KP 的垂直偏移

  // ── 4. 放置 Stage、Topic、KP ──
  const positions  = new Map(); // id -> {x, y}
  const placedIds  = new Set();
  const hiddenInfo = new Map(); // id -> {hiddenTopics?, hiddenKPs?}

  stages.forEach((stage, si) => {
    const stageX = marginX + (si + 0.5) * colW;
    positions.set(stage.id, { x: stageX, y: STAGE_Y });
    placedIds.add(stage.id);

    // 取 stageTopics，按 order 排序，最多显示 MAX_TOPICS_PER_STAGE 个
    const rawTopics = (stageTopics.get(stage.id) || []).filter(id => nodeMap.has(id));
    const visTopics = rawTopics.slice(0, MAX_TOPICS_PER_STAGE);
    const hidT = rawTopics.length - visTopics.length;
    if (hidT > 0) hiddenInfo.set(stage.id, { hiddenTopics: hidT });

    visTopics.forEach((topicId, ti) => {
      const topicX = stageX;
      const topicY = TOPIC_Y0 + ti * TOPIC_DY;
      positions.set(topicId, { x: topicX, y: topicY });
      placedIds.add(topicId);

      // KP 横向排在 Topic 正下方
      const rawKPs = (topicKPs.get(topicId) || []).filter(id => nodeMap.has(id));
      const visKPs = rawKPs.slice(0, MAX_KPS_PER_TOPIC);
      const hidKP  = rawKPs.length - visKPs.length;
      if (hidKP > 0) hiddenInfo.set(topicId, { hiddenKPs: hidKP });

      const kpY     = topicY + KP_DY;
      // 最多 3 个 KP，间距不超过列宽 / 4，避免越过相邻列
      const kpSpacing = Math.min(colW * 0.28, 34);
      visKPs.forEach((kpId, ki) => {
        const kpX = topicX + (ki - (visKPs.length - 1) / 2) * kpSpacing;
        positions.set(kpId, { x: kpX, y: kpY });
        placedIds.add(kpId);
      });
    });
  });

  // ── 5. CultureDimension —— 右侧独立列 ──
  const cultures = [...nodeMap.values()].filter(n => (n.label || n.nodeType) === 'CultureDimension');
  const cultureX = width - 44;
  const cultureYStep = Math.min(58, (height - 80) / Math.max(cultures.length, 1));
  cultures.slice(0, Math.floor((height - 80) / 44)).forEach((c, i) => {
    positions.set(c.id, { x: cultureX, y: 70 + i * cultureYStep });
    placedIds.add(c.id);
  });

  // ── 6. Practice / TheoryLesson / Chapter —— 底部横向 ──
  const bottomTypes = new Set(['Practice', 'TheoryLesson', 'Chapter']);
  const bottomNodes = [...nodeMap.values()].filter(n => bottomTypes.has(n.label || n.nodeType) && !placedIds.has(n.id));
  const bottomY = Math.min(height - 44, TOPIC_Y0 + MAX_TOPICS_PER_STAGE * TOPIC_DY + KP_DY + 48);
  bottomNodes.slice(0, Math.floor(usableW / 90)).forEach((n, i) => {
    positions.set(n.id, { x: marginX + 40 + i * Math.min(90, usableW / Math.max(bottomNodes.length, 1)), y: bottomY });
    placedIds.add(n.id);
  });

  return { positions, placedIds, hiddenInfo, stages };
}

/**
 * 主渲染器：以阶段脊椎布局 + G6 preset 渲染教师端总览 & 学生端本课图谱。
 *
 * 与 dagre 的核心区别：
 *   - dagre 按全局最小化边交叉排 rank，结果是所有 Stage 一行、所有 KP 一行；
 *   - 本实现自行计算 x/y，让每个阶段占据独立列带，Topics/KPs 在该列内向下分布。
 */
function renderKnowledgeGraphG6(options) {
  const {
    container,
    nodes: rawNodes = [],
    edges: rawEdges = [],
    direction = 'TB',   // 目前固定 TB（纵向），为未来横向扩展留口
    highlightKeyword = '',
    highlightNames = null,
    onNodeClick = null,
    compact = false,
    theme = 'dark',
  } = options || {};

  if (!container || typeof window === 'undefined' || !window.G6) return null;

  // ── 构建 nodeMap ──
  const nodeMap = new Map();
  rawNodes.forEach(n => {
    const id = getGraphNodeId(n);
    if (id && !nodeMap.has(id)) nodeMap.set(id, { ...n, id });
  });
  if (nodeMap.size === 0) return null;

  // ── 计算阶段脊椎布局位置 ──
  const W = container.clientWidth  || (compact ? 620 : 980);
  const H = container.clientHeight || (compact ? 290 : 660);
  const { positions, placedIds, hiddenInfo } = buildStageSpinePositions(nodeMap, rawEdges, W, H);

  if (placedIds.size === 0) return null;

  // ── 关键词 / 高亮名称集合 ──
  const kw = String(highlightKeyword || '').trim().toLowerCase();
  const hlSet = highlightNames instanceof Set ? highlightNames : null;
  const labelColor = theme === 'light' ? '#1e293b' : '#e2e8f0';

  // ── 构建 G6 节点模型 ──
  const g6Nodes = [...nodeMap.values()]
    .filter(n => placedIds.has(n.id))
    .map(n => {
      const type    = n.label || n.nodeType || 'KnowledgePoint';
      const vis     = GRAPH_NODE_STYLES[type] || { fill: '#64748b', stroke: '#cbd5e1', shape: 'circle' };
      const title   = getGraphNodeTitle(n);
      const pos     = positions.get(n.id) || { x: W / 2, y: H / 2 };
      const matched = (kw && title.toLowerCase().includes(kw)) || (hlSet && (hlSet.has(n.name) || hlSet.has(n.id) || hlSet.has(title)));
      const extra   = hiddenInfo.get(n.id);

      // 紧凑模式（学生端）略微缩小节点
      const scl = compact ? 0.82 : 1;

      let nodeType = 'circle', nodeSize = 28 * scl;
      let labelPos = 'bottom', labelInside = false;
      let nodeW = 0, nodeH = 0;

      if (type === 'Stage') {
        nodeType = 'rect'; nodeW = 88 * scl; nodeH = 30 * scl;
        nodeSize = [nodeW, nodeH]; labelPos = 'center'; labelInside = true;
      } else if (type === 'Topic' || type === 'KnowledgeCategory') {
        nodeType = 'rect'; nodeW = 82 * scl; nodeH = 24 * scl;
        nodeSize = [nodeW, nodeH]; labelPos = 'center'; labelInside = true;
      } else if (type === 'CultureDimension') {
        nodeType = 'diamond'; nodeSize = 22 * scl;
      } else if (['Practice','TheoryLesson','Chapter'].includes(type)) {
        nodeType = 'rect'; nodeW = 78 * scl; nodeH = 22 * scl;
        nodeSize = [nodeW, nodeH]; labelPos = 'center'; labelInside = true;
      } else {
        // KnowledgePoint / Skill / Terminology
        nodeType = 'circle'; nodeSize = 20 * scl;
      }

      // 标签：矩形节点写内部，圆形写底部；截断避免溢出
      const maxLabelLen = nodeType === 'rect' ? Math.floor((nodeW || 80) / 12) : 6;
      const rawLabel = title;
      const label = rawLabel.length > maxLabelLen ? rawLabel.slice(0, maxLabelLen - 1) + '…' : rawLabel;

      // 隐藏数量徽标追加到标签（简单实现）
      let badgeLabel = label;
      if (extra?.hiddenTopics) badgeLabel += ` +${extra.hiddenTopics}`;
      if (extra?.hiddenKPs)    badgeLabel += ` +${extra.hiddenKPs}`;

      const fontSize = type === 'Stage' ? (compact ? 10 : 12) : (compact ? 9 : 11);

      return {
        id: n.id,
        x: pos.x,
        y: pos.y,
        nodeType: type,
        fullTitle: title,
        name: n.name || title,
        type: nodeType,
        size: nodeSize,
        matched: !!matched,
        label: badgeLabel,
        labelCfg: {
          position: labelPos,
          offset: labelInside ? 0 : 5,
          style: {
            fill: labelInside ? '#f8fafc' : labelColor,
            fontSize,
            fontWeight: type === 'Stage' ? 700 : (type === 'Topic' ? 600 : 500),
          },
        },
        style: {
          fill: vis.fill,
          stroke: matched ? '#fde047' : vis.stroke,
          lineWidth: matched ? 3 : 1.5,
          radius: (type === 'Stage' || type === 'Topic') ? 6 : undefined,
          cursor: 'pointer',
        },
      };
    });

  // ── 边过滤与分类 ──
  const visSet = new Set(g6Nodes.map(n => n.id));
  const allValid = rawEdges
    .map(e => ({ ...e, source: e.source || e.from, target: e.target || e.to }))
    .filter(e => e.source && e.target && e.source !== e.target && visSet.has(e.source) && visSet.has(e.target));

  const hierEdges  = allValid.filter(e => ['CONTAIN_TOPIC','INCLUDE_POINT','HAS_CATEGORY','CONTAINS'].includes(e.type));
  const flowEdges  = allValid.filter(e => e.type === 'PRECEDES' || e.type === 'NEXT');
  const otherEdges = allValid.filter(e => !['CONTAIN_TOPIC','INCLUDE_POINT','HAS_CATEGORY','CONTAINS','PRECEDES','NEXT'].includes(e.type));

  // 语义连线按优先级限制数量，避免大量 RELATED_TO 形成色带
  const curatedSem = otherEdges
    .sort((a, b) => (SEM_EDGE_PRIORITY[a.type] ?? 9) - (SEM_EDGE_PRIORITY[b.type] ?? 9))
    .slice(0, MAX_SEMANTIC_EDGES);

  function buildEdgeModel(edge, edgeClass) {
    const s    = getRelationStyle(edge.type);
    const dash = s.dash ? s.dash.split(/\s+/).map(Number).filter(v => !Number.isNaN(v)) : null;
    const isHier = edgeClass === 'hier';
    const isFlow = edgeClass === 'flow';

    // 流程顺序（PRECEDES）在阶段行绘成直线带箭头；层级线绘成轻量垂直曲线；语义线绘成弧线
    const edgeType  = isFlow ? 'line' : 'quadratic';
    // 语义弧线用较大曲率，确保不和节点列重叠
    const srcPos    = positions.get(edge.source) || { x: 0, y: 0 };
    const tgtPos    = positions.get(edge.target) || { x: 0, y: 0 };
    const dx        = Math.abs((tgtPos.x || 0) - (srcPos.x || 0));
    const curveOffset = isHier ? 0 : isFlow ? 0 : Math.min(80, 20 + dx * 0.08);

    return {
      source: edge.source,
      target: edge.target,
      relType: edge.type,
      type: edgeType,
      curveOffset,
      label: isHier ? '' : (edge.label || s.label || ''),
      labelCfg: {
        autoRotate: true,
        refY: 4,
        style: {
          fill: s.color,
          fontSize: 9,
          background: {
            fill: theme === 'light' ? 'rgba(255,255,255,.88)' : 'rgba(2,6,23,.82)',
            padding: [1, 3, 1, 3],
            radius: 3,
          },
        },
      },
      style: {
        stroke: s.color,
        lineWidth: isHier ? 1 : s.width,
        lineDash: dash || undefined,
        opacity: isHier ? 0.35 : isFlow ? 0.9 : 0.65,
        endArrow: (isFlow || !isHier)
          ? { path: window.G6.Arrow.triangle(6, 8, 2), fill: s.color, stroke: s.color }
          : false,
      },
    };
  }

  const g6Edges = [
    ...hierEdges.map(e  => buildEdgeModel(e, 'hier')),
    ...flowEdges.map(e  => buildEdgeModel(e, 'flow')),
    ...curatedSem.map(e => buildEdgeModel(e, 'sem')),
  ];

  // ── 初始化 G6 图（preset 布局，不让 G6 再计算位置）──
  container.innerHTML = '';
  const padding = compact ? [12, 16, 12, 16] : [24, 36, 24, 36];
  const graph = new window.G6.Graph({
    container,
    width:  W,
    height: H,
    fitView: true,
    fitViewPadding: padding,
    minZoom: 0.15,
    maxZoom: 3,
    layout: { type: 'preset' },   // 直接使用节点上的 x/y，不再走 dagre
    modes: {
      default: [
        'drag-canvas',
        'zoom-canvas',
        { type: 'drag-node', enableDelegate: true },
        { type: 'activate-relations', trigger: 'mouseenter', resetSelected: true },
      ],
    },
    defaultNode: { type: 'circle' },
    defaultEdge: { type: 'quadratic' },
    nodeStateStyles: {
      active:    { lineWidth: 3, shadowColor: 'rgba(250,204,21,.85)', shadowBlur: 14 },
      inactive:  { opacity: 0.22 },
      highlight: { lineWidth: 4, stroke: '#fde047', shadowColor: 'rgba(250,204,21,.9)', shadowBlur: 18 },
    },
    edgeStateStyles: {
      active:   { lineWidth: 2.4, opacity: 1 },
      inactive: { opacity: 0.06 },
    },
  });

  graph.data({ nodes: g6Nodes, edges: g6Edges });
  graph.render();
  graph.fitView(padding);

  // 高亮匹配节点
  if (kw || hlSet) {
    graph.getNodes().forEach(node => {
      if (node.getModel().matched) graph.setItemState(node, 'highlight', true);
    });
  }

  if (typeof onNodeClick === 'function') {
    graph.on('node:click', evt => {
      const model = evt.item && evt.item.getModel();
      if (model) onNodeClick(model.id, model);
    });
  }

  // 容器大小变化时自适应
  if (typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(() => {
      if (!graph || graph.get('destroyed')) { observer.disconnect(); return; }
      const w = container.clientWidth, h = container.clientHeight;
      if (w && h) { graph.changeSize(w, h); graph.fitView(padding); }
    });
    observer.observe(container);
  }

  return graph;
}

// 图例：节点类型 + 关系类型
function buildKnowledgeGraphLegend() {
  const nodeLegendItems = [
    { type: 'Stage', text: '谈判阶段' },
    { type: 'Topic', text: '主题' },
    { type: 'KnowledgePoint', text: '知识点' },
    { type: 'Skill', text: '技能' },
    { type: 'Terminology', text: '术语' },
    { type: 'CultureDimension', text: '文化维度' },
    { type: 'Practice', text: '实战/课时' },
  ];
  const relLegendItems = ['CONTAIN_TOPIC', 'PRECEDES', 'REQUIRES', 'RELATED_TO', 'APPLIES_TO_SCENARIO', 'HAS_CULTURAL_SENSITIVITY'];

  const legend = document.createElement('div');
  legend.className = 'absolute bottom-3 left-3 max-w-[760px] rounded-xl border border-slate-700/70 bg-slate-950/88 p-3 text-[11px] text-slate-300 shadow-lg backdrop-blur pointer-events-none';

  const nodeRow = nodeLegendItems.map(item => {
    const vis = GRAPH_NODE_STYLES[item.type] || { fill: '#64748b', stroke: '#cbd5e1' };
    const isRect = item.type === 'Stage' || item.type === 'Topic' || item.type === 'Practice';
    const isDia  = item.type === 'CultureDimension';
    const shapeCss = isDia
      ? 'width:10px;height:10px;transform:rotate(45deg);'
      : isRect
        ? 'width:16px;height:11px;border-radius:3px;'
        : 'width:12px;height:12px;border-radius:50%;';
    return `<span class="inline-flex items-center gap-1"><i style="display:inline-block;${shapeCss}background:${vis.fill};border:1.5px solid ${vis.stroke};flex-shrink:0"></i>${sanitizeSvgText(item.text)}</span>`;
  }).join('');

  const relRow = relLegendItems.map(type => {
    const s = getRelationStyle(type);
    return `<span class="inline-flex items-center gap-1"><i style="display:inline-block;width:18px;border-top:${s.width}px ${s.dash ? 'dashed' : 'solid'} ${s.color};vertical-align:middle;flex-shrink:0"></i>${sanitizeSvgText(s.label)}</span>`;
  }).join('');

  legend.innerHTML = `
    <div class="mb-1.5 font-semibold text-slate-100">阶段脊椎视图（十大阶段 → 主题 → 知识点）</div>
    <div class="mb-1.5 flex flex-wrap gap-x-3 gap-y-1">${nodeRow}</div>
    <div class="flex flex-wrap gap-x-3 gap-y-1">${relRow}</div>`;
  return legend;
}

// 教师端知识图谱总览入口（阶段脊椎 + 语义/跨文化连线叠加）
function renderSemanticRelationGraph(nodesRaw, edgesRaw, width, height) {
  if (!adminGraphCanvas) return;
  adminGraphCanvas.innerHTML = '';
  adminGraphCanvas.style.position = 'relative';
  adminGraphCanvas.style.overflow = 'hidden';

  if (typeof window === 'undefined' || !window.G6) {
    adminGraphCanvas.innerHTML = "<p class='p-4 text-sm text-slate-400'>图谱引擎 (G6) 未加载，请检查 /static/vendor/g6 资源。</p>";
    return;
  }

  const keyword = (state.admin.graph.searchKeyword || '').trim();
  adminG6Graph = renderKnowledgeGraphG6({
    container: adminGraphCanvas,
    nodes: nodesRaw,
    edges: edgesRaw,
    direction: adminGraphDirection,
    highlightKeyword: keyword,
    onNodeClick: id => handleGraphNodeSelection(id),
    theme: 'dark',
  });

  if (!adminG6Graph) {
    if (adminGraphStatus) adminGraphStatus.textContent = '暂无可展示的节点，请检查数据或关系';
    return;
  }

  adminGraphCanvas.appendChild(buildKnowledgeGraphLegend());

  if (adminGraphStatus) {
    const nodeCount = adminG6Graph.getNodes().length;
    const edgeCount = adminG6Graph.getEdges().length;
    const semCount  = (edgesRaw || []).filter(e => !['CONTAIN_TOPIC','INCLUDE_POINT','HAS_CATEGORY','CONTAINS'].includes(e.type)).length;
    adminGraphStatus.textContent = `阶段脊椎 · 节点 ${nodeCount} · 关系 ${edgeCount} · 语义/跨文化联系 ${semCount}`;
  }
}

// 使用自定义“开花”布局渲染图谱，强调阶段/知识点放射结构。
function renderBurstGraph(nodesRaw, edgesRaw, width, height) {
  const colorMap = {
    Stage: "#3b82f6",
    Topic: "#f97316",
    KnowledgePoint: "#22c55e",
    Skill: "#0ea5e9",
    Terminology: "#475569",
  };

  const stages = nodesRaw.filter((n) => n.label === "Stage");
  const topics = nodesRaw.filter((n) => n.label === "Topic" || n.label === "KnowledgeCategory");
  const points = nodesRaw.filter((n) =>
    ["KnowledgePoint", "Skill", "Terminology"].includes(n.label)
  );

  const topicMap = new Map(topics.map((t) => [t.key || t.id, t]));
  const pointMap = new Map(points.map((p) => [p.key || p.id, p]));
  const stageTopicCount = new Map();
  const topicPointCount = new Map();
  const topicParentStage = new Map();
  const pointParentTopic = new Map();
  const crossEdges = [];

  const stageTopicEdges = edgesRaw.filter((e) => e.type === "CONTAIN_TOPIC");
  const topicPointEdges = edgesRaw.filter(
    (e) => e.type === "INCLUDE_POINT" || e.type === "HAS_TOPIC"
  );

  const stageToTopics = new Map();
  stageTopicEdges.forEach((e) => {
    const sid = e.source || e.from;
    const tid = e.target || e.to;
    if (!sid || !tid) return;
    if (!stageToTopics.has(sid)) stageToTopics.set(sid, []);
    stageToTopics.get(sid).push(tid);
    stageTopicCount.set(sid, (stageTopicCount.get(sid) || 0) + 1);
    topicParentStage.set(tid, sid);
  });

  const topicToPoints = new Map();
  topicPointEdges.forEach((e) => {
    const tid = e.source || e.from;
    const pid = e.target || e.to;
    if (!tid || !pid) return;
    if (!topicToPoints.has(tid)) topicToPoints.set(tid, []);
    topicToPoints.get(tid).push(pid);
    topicPointCount.set(tid, (topicPointCount.get(tid) || 0) + 1);
    pointParentTopic.set(pid, tid);
  });

  // 收集跨Stage或知识点间的边
  edgesRaw.forEach((e) => {
    const src = e.source || e.from;
    const tgt = e.target || e.to;
    if (!src || !tgt) return;
    // 已经用于层级的边跳过
    if (e.type === "CONTAIN_TOPIC" || e.type === "INCLUDE_POINT" || e.type === "HAS_TOPIC") {
      return;
    }
    const srcStage = topicParentStage.get(src) || topicParentStage.get(pointParentTopic.get(src));
    const tgtStage = topicParentStage.get(tgt) || topicParentStage.get(pointParentTopic.get(tgt));
    const isCrossStage = srcStage && tgtStage && srcStage !== tgtStage;
    const isPointToPoint =
      ["KnowledgePoint", "Skill", "Terminology"].includes(pointMap.get(src)?.label) ||
      ["KnowledgePoint", "Skill", "Terminology"].includes(pointMap.get(tgt)?.label);
    if (isCrossStage || isPointToPoint) {
      crossEdges.push({
        source: src,
        target: tgt,
        label: e.type,
        style: {
          stroke: "rgba(148,163,184,0.35)",
          lineWidth: 1,
          lineDash: [5, 5],
          endArrow: false,
          opacity: 0.65,
        },
      });
    }
  });

  // === 搜索匹配：自动展开并高亮 ===
  const kw = (state.admin.graph.searchKeyword || "").trim().toLowerCase();
  const highlighted = new Set();
  const autoExpandedStages = new Set(expandedStages);
  const autoExpandedTopics = new Set(expandedTopics);
  if (kw) {
    nodesRaw.forEach((n) => {
      const text = (n.title || n.name || n.key || "").toLowerCase();
      if (!text.includes(kw)) return;
      const id = n.key || n.id;
      if (!id) return;
      highlighted.add(id);
      if (n.label === "Topic") {
        autoExpandedTopics.add(id);
        const parentStage = topicParentStage.get(id);
        if (parentStage) autoExpandedStages.add(parentStage);
      } else if (["KnowledgePoint", "Skill", "Terminology"].includes(n.label)) {
        const parentTopic = pointParentTopic.get(id);
        if (parentTopic) {
          autoExpandedTopics.add(parentTopic);
          const parentStage = topicParentStage.get(parentTopic);
          if (parentStage) autoExpandedStages.add(parentStage);
        }
      } else if (n.label === "Stage") {
        autoExpandedStages.add(id);
      }
    });
  }

  const center = { x: width / 2, y: height / 2 };
  const stageCount = stages.length || 1;
  const maxTopicCount = Math.max(1, ...stageTopicCount.values(), 1);
  const maxPointCount = Math.max(1, ...topicPointCount.values(), 1);
  const stageRadius =
    Math.max(200, Math.min(width, height) * 0.32) +
    Math.min(120, maxTopicCount * 8 + maxPointCount * 4);
  const topicRadialGap = 120;
  const pointRadialGap = 90;

  // 同步自动展开集合，便于后续点击保持状态
  const searchMode = Boolean(kw);
  if (searchMode) {
    expandedStages.clear();
    expandedTopics.clear();
    autoExpandedStages.forEach((id) => expandedStages.add(id));
    autoExpandedTopics.forEach((id) => expandedTopics.add(id));
  }
  const nodes = [];
  const edges = [];

  const placed = new Set();

  const polar = (cx, cy, r, angle) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  stages.forEach((stage, idx) => {
    const id = stage.key || stage.id;
    if (!id) return;
    const angle = (2 * Math.PI * idx) / stageCount;
    const pos = polar(center.x, center.y, stageRadius, angle);
    const stageHighlighted = highlighted.has(id);
    nodes.push({
      id,
      label: stage.title || stage.name || id,
      x: pos.x,
      y: pos.y,
      size: 46,
      style: {
        fill: colorMap.Stage,
        stroke: stageHighlighted ? "#22c55e" : "#2563eb",
        lineWidth: stageHighlighted ? 2 : 1.4,
      },
      nodeType: "Stage",
    });
    placed.add(id);

    if (!autoExpandedStages.has(id)) {
      return;
    }
    const topicIds =
      stageToTopics.get(id) ||
      topics
        .filter((t) => t.stage === stage.name || t.stageName === stage.name)
        .map((t) => t.key || t.id);
    const topicCount = topicIds.length || 1;
    const topicAngleSpan = Math.min(Math.PI / 2.2, 0.18 * topicCount); // tighter fan outward
    const topicAngleStep = topicCount > 1 ? topicAngleSpan / (topicCount - 1) : 0;
    topicIds.forEach((tid, tIdx) => {
      const topic = topicMap.get(tid);
      if (!topic) return;
      const offset = topicAngleStep * (tIdx - (topicCount - 1) / 2);
      const tAngle = angle + offset;
      const topicRadius =
        stageRadius +
        topicRadialGap +
        Math.min(80, (topicPointCount.get(tid) || 0) * 2); // push out heavy topics
      const tPos = polar(center.x, center.y, topicRadius, tAngle);
      const topicHighlighted = highlighted.has(tid);
      nodes.push({
        id: tid,
        label: topic.title || topic.name || tid,
        x: tPos.x,
        y: tPos.y,
        size: 32,
        type: "rect",
        style: {
          fill: colorMap.Topic,
          stroke: topicHighlighted ? "#22c55e" : "#f59e0b",
          lineWidth: topicHighlighted ? 2 : 1.2,
        },
        nodeType: "Topic",
      });
      edges.push({
        source: id,
        target: tid,
        style: { stroke: "rgba(148,163,184,0.45)", endArrow: true },
      });
      placed.add(tid);

      if (!autoExpandedTopics.has(tid)) return;
      const pointIds =
        topicToPoints.get(tid) ||
        points
          .filter((p) => p.topic === topic.name || p.topicName === topic.name)
          .map((p) => p.key || p.id);
      const pointCount = pointIds.length || 1;
      const pointAngleSpan = Math.min(Math.PI / 3.2, 0.16 * pointCount);
      const pointAngleStep = pointCount > 1 ? pointAngleSpan / (pointCount - 1) : 0;
      const basePointRadius =
        topicRadius + pointRadialGap + Math.min(60, pointCount * 1.8); // more children, push further
      pointIds.forEach((pid, pIdx) => {
        const point = pointMap.get(pid);
        if (!point) return;
        const pOffset = pointAngleStep * (pIdx - (pointCount - 1) / 2);
        const pAngle = tAngle + pOffset;
        const pPos = polar(center.x, center.y, basePointRadius, pAngle);
        const isHighlighted = highlighted.has(pid);
        nodes.push({
          id: pid,
          label: point.title || point.name || pid,
          x: pPos.x,
          y: pPos.y,
          size: 16,
          style: {
            fill: colorMap[point.label] || "#94a3b8",
            stroke: isHighlighted ? "#22c55e" : "rgba(15,23,42,0.35)",
            lineWidth: isHighlighted ? 1.8 : 1,
          },
          nodeType: point.label,
        });
        edges.push({
          source: tid,
          target: pid,
          style: { stroke: "rgba(148,163,184,0.35)", endArrow: false },
        });
        placed.add(pid);
      });
    });
  });

  adminG6Graph = new G6.Graph({
    container: adminGraphCanvas,
    width,
    height,
    layout: { type: "none" },
    modes: { default: ["drag-canvas", "zoom-canvas"] },
    defaultNode: {
      labelCfg: {
        position: "bottom",
        style: { fill: "#0f172a", fontSize: 12, opacity: 0.9 },
      },
    },
    defaultEdge: {
      type: "line",
      labelCfg: { style: { fill: "#94a3b8", fontSize: 10 } },
      style: { endArrow: true },
    },
    fitView: false,
    minZoom: 0.3,
    maxZoom: 3,
    fitCenter: true,
  });

  // 叠加跨Stage/点的虚线边
  const allEdges = edges.concat(crossEdges);

  adminG6Graph.data({ nodes, edges: allEdges });
  adminG6Graph.render();
  adminG6Graph.fitView(40);

  if (adminGraphStatus) {
    adminGraphStatus.textContent = `节点 ${nodes.length} · 关系 ${edges.length}`;
  }

  adminG6Graph.on("node:click", (evt) => {
    const item = evt.item;
    if (!item) return;
    const model = item.getModel();
    const nodeId = model.id;
    if (model.nodeType === "Stage") {
      if (expandedStages.has(nodeId)) expandedStages.delete(nodeId);
      else expandedStages.add(nodeId);
      renderAdminGraphNetwork();
      return;
    }
    if (model.nodeType === "Topic") {
      if (expandedTopics.has(nodeId)) expandedTopics.delete(nodeId);
      else expandedTopics.add(nodeId);
      renderAdminGraphNetwork();
      return;
    }
    handleGraphNodeSelection(nodeId);
  });
}

// 将原始 network 数据转换为层级树，供 G6 mini-map/树形使用。
function buildTreeData(network) {
  const nodes = network && Array.isArray(network.nodes) ? network.nodes : [];
  const edges = network && Array.isArray(network.edges) ? network.edges : [];
  const nodeMap = new Map();
  nodes.forEach((n) => {
    const key = n.key || n.id || n.name;
    if (!key) return;
    nodeMap.set(key, {
      id: key,
      key,
      name: n.title || n.name || key,
      type: n.label || n.nodeType,
      order: n.order || 0,
      stage: n.stage || n.stageName,
      topic: n.topic || n.topicName,
      children: [],
    });
  });

  const stages = [];
  const topics = new Map();
  const points = new Map();
  nodeMap.forEach((node, key) => {
    if (node.type === "Stage") stages.push(node);
    else if (node.type === "Topic") topics.set(key, node);
    else points.set(key, node);
  });

  const src = (e) => e.source || e.from;
  const tgt = (e) => e.target || e.to;

  edges.forEach((e) => {
    if (e.type !== "CONTAIN_TOPIC") return;
    const s = nodeMap.get(src(e));
    const t = topics.get(tgt(e));
    if (s && t) s.children.push(t);
  });

  edges.forEach((e) => {
    if (e.type !== "INCLUDE_POINT" && e.type !== "HAS_TOPIC") return;
    const t = topics.get(src(e));
    const p = points.get(tgt(e));
    if (t && p) t.children.push(p);
  });

  // Fallback by props
  topics.forEach((t) => {
    if (t.children.length === 0) {
      points.forEach((p) => {
        if ((p.topic && (p.topic === t.name || p.topic === t.key)) ||
            (p.stage && (p.stage === t.stage || p.stage === t.stageName))) {
          t.children.push(p);
        }
      });
    }
  });
  if (stages.every((s) => s.children.length === 0)) {
    topics.forEach((t) => {
      const stageName = t.stage || t.stageName || (t.key || "").split(":")[1];
      const s = stages.find((st) => st.name === stageName || st.key === `Stage:${stageName}`);
      if (s) s.children.push(t);
    });
  }

  stages.sort((a, b) => a.order - b.order || (a.name || "").localeCompare(b.name || ""));
  topics.forEach((t) => {
    t.children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    t.collapsed = true;
  });
  stages.forEach((s) => {
    s.children.sort((a, b) => (a.order || 0) - (b.order || 0));
    s.collapsed = false;
  });

  const children = stages.length > 0 ? stages : Array.from(topics.values());
  const rootChildren = children.length > 0 ? children : Array.from(points.values());

  return {
    id: "root",
    name: "root",
    collapsed: false,
    children: rootChildren,
  };
}

// 采用 G6 渲染（树形 + mini map），用于另一种视图模式。
function renderAdminGraphWithG6() {
  if (!adminGraphCanvas) return;
  if (adminGraphNetwork) {
    adminGraphNetwork.dispose();
    adminGraphNetwork = null;
  }
  if (adminG6Graph) {
    adminG6Graph.destroy();
    adminG6Graph = null;
  }

  const networkData = state.admin.graph.network || { nodes: [], edges: [] };
  const width = adminGraphCanvas.clientWidth || 800;
  const height = adminGraphCanvas.clientHeight || 420;

  adminGraphCanvas.innerHTML = "";

  const colorMap = {
    Stage: "#6c63ff",
    Topic: "#f97316",
    KnowledgeCategory: "#cbd5e1",
    Skill: "#0ea5e9",
    Terminology: "#475569",
    KnowledgePoint: "#22c55e",
    Chapter: "#67e8f9",
    Practice: "#0f766e",
    TheoryTopic: "#5b21b6",
    TheoryLesson: "#9a3412",
    ProcessStep: "#94a3b8",
  };

  const nodes = (networkData.nodes || []).map((n, idx, arr) => {
    const labelVisible =
      n.label === "Stage" || n.label === "Topic" || n.label === "KnowledgeCategory";
    let size = 24;
    if (n.label === "Stage") size = 46;
    else if (n.label === "Topic") size = 32;
    else if (n.label === "KnowledgeCategory") size = 26;
    else if (n.label === "KnowledgePoint") size = 20;
    else if (n.label === "Skill" || n.label === "Terminology") size = 20;
    return {
      id: n.key,
      label: labelVisible ? (n.title || n.name) : "",
      originLabel: n.title || n.name,
      type: n.label === "Topic" || n.label === "KnowledgeCategory" ? "rect" : "circle",
      style: {
        fill: colorMap[n.label] || "#94a3b8",
        stroke: "rgba(15,23,42,0.4)",
        lineWidth: 1.2,
      },
      size,
      nodeType: n.label,
    };
  });

  const edges = (networkData.edges || []).map((e) => {
    const showLabel = ["PRECEDES", "CONTAIN_TOPIC", "HAS_CATEGORY", "CONTAINS"].includes(e.type);
    return {
      source: e.source,
      target: e.target,
      label: showLabel ? (e.label || e.type) : "",
      style: {
        stroke: "rgba(148,163,184,0.45)",
        lineWidth: 1.1,
        endArrow: false,
      },
    };
  });

  adminG6Graph = new G6.Graph({
    container: adminGraphCanvas,
    width,
    height,
    layout: {
      type: "dagre",
      rankdir: "LR",
      nodesep: 40,
      ranksep: 120,
      controlPoints: true,
      preventOverlap: true,
      nodeSize: 30,
    },
    modes: {
      default: ["drag-canvas", "zoom-canvas", { type: "drag-node", enableDelegate: true }],
    },
    defaultNode: {
      labelCfg: {
        position: "bottom",
        style: { fill: "#eaf4ff", fontSize: 12, opacity: 0.9 },
      },
    },
    defaultEdge: {
      type: "polyline",
      labelCfg: {
        autoRotate: true,
        style: { fill: "#94a3b8", fontSize: 10 },
      },
      style: { endArrow: true },
    },
    animate: true,
  });

  adminG6Graph.data({ nodes, edges });
  adminG6Graph.on("node:click", (evt) => {
    const item = evt.item;
    if (!item) return;
    const id = item.getID();
    const rawNode = nodesRaw.find((n) => n.key === id);
    if (rawNode && rawNode.label === "Topic") {
      if (expandedTopics.has(id)) expandedTopics.delete(id);
      else expandedTopics.add(id);
      renderAdminGraph();
      return;
    }
    handleGraphNodeSelection(id);
  });
  adminG6Graph.render();
  adminG6Graph.fitView(20);
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
    if (adminGraphStatus) {
      const nodeCount = (networkData.nodes || []).length;
      const edgeCount = (networkData.edges || []).length;
      adminGraphStatus.textContent = `节点 ${nodeCount} · 关系 ${edgeCount}`;
    }
  } catch (error) {
    console.error("[Graph] refreshAdminGraph error", error);
    if (adminGraphStatus) {
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
