let adminTheoryLessonEditor = null;
let challengeBubbleBlotRegistered = false;
let knowledgePointCardBlotRegistered = false;
const knowledgeCardModalState = {
  editingNode: null,
  selectedKnowledge: null,
  imageDataUrl: "",
  indexRecords: [],
};

function sanitizeKnowledgeCardHtml(html) {
  const value = typeof html === "string" ? html : "";
  if (typeof window !== "undefined" && window.DOMPurify && typeof window.DOMPurify.sanitize === "function") {
    return window.DOMPurify.sanitize(value, { USE_PROFILES: { html: true } });
  }
  return value;
}

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

function escapeHtmlText(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value) {
  return (value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");
}

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

function handleKnowledgeCardNew() {
  knowledgeCardModalState.selectedKnowledge = null;
  knowledgeCardModalState.imageDataUrl = "";
  resetKnowledgeCardForm();
  renderKnowledgeCardList({ keyword: knowledgeCardSearch ? knowledgeCardSearch.value : "", selectedName: "" });
  if (knowledgeCardStatus) {
    knowledgeCardStatus.textContent = "";
  }
}

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

function handleKnowledgeCardRemoveImage() {
  knowledgeCardModalState.imageDataUrl = "";
  resetKnowledgeCardForm(knowledgeCardModalState.selectedKnowledge || null);
}

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

function handleKnowledgeCardClearBody() {
  if (!knowledgeCardBodyEditor) {
    return;
  }
  knowledgeCardBodyEditor.innerHTML = "";
}

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

function normalizeMatchText(value) {
  return (value || "")
    .toString()
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractMatchTokens(selectionText) {
  const normalized = normalizeMatchText(selectionText);
  if (!normalized) {
    return [];
  }
  const raw = normalized.split(/[^a-zA-Z0-9\u4e00-\u9fa5]+/);
  const filtered = raw.map((t) => t.trim()).filter((t) => t.length > 1);
  return Array.from(new Set(filtered)).slice(0, 30);
}

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

function clearKnowledgeMatchDebug() {
  if (!adminTheoryMatchDebug) {
    return;
  }
  adminTheoryMatchDebug.textContent = "";
  adminTheoryMatchDebug.classList.add("hidden");
}

let knowledgeBubbleEl = null;

function hideKnowledgeSelectionBubble() {
  if (knowledgeBubbleEl) {
    knowledgeBubbleEl.remove();
    knowledgeBubbleEl = null;
  }
}

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

function triggerAutoKnowledgeMatch() {
  const selection = getEditorSelectionContent();
  if (selection && selection.text && selection.text.length > 0) {
    handleBubbleMatchClick();
  } else {
    openKnowledgeCardModal();
  }
}

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

function setAdminTheoryEditorContent(html) {
  const content = typeof html === "string" ? html : "";
  if (adminTheoryLessonEditor) {
    adminTheoryLessonEditor.clipboard.dangerouslyPasteHTML(content || "<p><br></p>");
    syncKnowledgePointsFromEditor({ updateCache: false });
  } else if (adminTheoryLessonContent) {
    adminTheoryLessonContent.value = content;
  }
}

function getAdminTheoryEditorContent() {
  if (adminTheoryLessonEditor) {
    return adminTheoryLessonEditor.root.innerHTML;
  }
  if (adminTheoryLessonContent) {
    return adminTheoryLessonContent.value;
  }
  return "";
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

function readKnowledgeFromTextarea(element) {
  if (!element) {
    return [];
  }
  return splitLines(element.value);
}

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
