let adminTheoryLessonEditor = null;
let challengeBubbleBlotRegistered = false;
let knowledgePointCardBlotRegistered = false;
let adminGraphNetwork = null;
let adminGraphSelectionKey = null;
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
  return payload;
}

function insertKnowledgeCardIntoEditor(payload, { replaceNode = null } = {}) {
  const normalized = normalizeKnowledgeCardPayload(payload);
  if (adminTheoryLessonEditor) {
    const quill = adminTheoryLessonEditor;
    const source = window.Quill ? window.Quill.sources.USER : undefined;
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
      const range = quill.getSelection(true);
      const index = range && typeof range.index === "number" ? range.index : quill.getLength();
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

function describeGraphNodeKey(key) {
  if (typeof key !== "string") {
    return { label: "", id: "" };
  }
  const [label, ...rest] = key.split(":");
  return { label: label || "", id: rest.join(":") };
}

function renderAdminGraphKnowledgeList() {
  if (!adminGraphKnowledgeList) {
    return;
  }
  const rawList = Array.isArray(state.admin.graph.knowledgePoints)
    ? state.admin.graph.knowledgePoints
    : [];
  const list = rawList
    .map((item) => ({
      name: extractKnowledgeName(item),
      summary: item.summary || "",
      practiceCount: typeof item.practiceCount === "number" ? item.practiceCount : 0,
      lessonCount: typeof item.lessonCount === "number" ? item.lessonCount : 0,
    }))
    .filter((record) => record.name);
  adminGraphKnowledgeList.innerHTML = "";
  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500";
    empty.textContent = "暂无知识点数据或图谱尚未初始化。";
    adminGraphKnowledgeList.appendChild(empty);
    return;
  }
  list.forEach((item) => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-800/70 bg-slate-950/60 p-3";
    const practiceCount = item.practiceCount || 0;
    const lessonCount = item.lessonCount || 0;
    li.innerHTML = `
      <p class="text-sm text-slate-200">${escapeHtmlText(item.name || "知识点")}</p>
      ${item.summary ? `<p class="mt-1 text-xs text-slate-400">${escapeHtmlText(item.summary)}</p>` : ""}
      <p class="text-xs text-slate-500">实战关卡：${practiceCount} · 理论课程：${lessonCount}</p>
    `;
    adminGraphKnowledgeList.appendChild(li);
  });
}

function renderAdminGraphSelection(detail) {
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
  const knowledgeEntries = normalizeKnowledgePayloadList(detail.knowledge || []);
  if (knowledgeEntries.length > 0) {
    const wrap = document.createElement("div");
    wrap.className = "mt-3 space-y-2";
    knowledgeEntries.forEach((kp) => {
      const card = document.createElement("div");
      card.className = "graph-knowledge-card";
      const title = document.createElement("p");
      title.className = "graph-knowledge-card__title";
      title.textContent = kp.name || "知识点";
      card.appendChild(title);
      const summaryText = kp.summary || "";
      let bodyPreview = "";
      if (!summaryText && kp.bodyHtml) {
        const temp = document.createElement("div");
        temp.innerHTML = sanitizeKnowledgeCardHtml(kp.bodyHtml);
        bodyPreview = (temp.textContent || "").trim();
      }
      if (summaryText || bodyPreview) {
        const summaryEl = document.createElement("p");
        summaryEl.className = "graph-knowledge-card__summary";
        summaryEl.textContent = summaryText || bodyPreview.slice(0, 120);
        card.appendChild(summaryEl);
      }
      if (Array.isArray(kp.tags) && kp.tags.length > 0) {
        const tagsLine = document.createElement("p");
        tagsLine.className = "graph-knowledge-card__summary";
        tagsLine.textContent = `标签：${kp.tags.join("、")}`;
        card.appendChild(tagsLine);
      }
      if (kp.anchorId) {
        const actions = document.createElement("div");
        actions.className = "graph-knowledge-card__actions";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "graph-knowledge-card__button";
        button.dataset.knowledgeAnchor = kp.anchorId;
        button.textContent = "定位到正文";
        actions.appendChild(button);
        card.appendChild(actions);
      }
      wrap.appendChild(card);
    });
    adminGraphSelection.appendChild(wrap);
  }
  if (Array.isArray(detail.relatedLessons) && detail.relatedLessons.length > 0) {
    const header = document.createElement("p");
    header.className = "mt-3 text-xs font-semibold text-emerald-400";
    header.textContent = "关联理论课程";
    adminGraphSelection.appendChild(header);
    const list = document.createElement("ul");
    list.className = "mt-1 space-y-1 text-xs text-slate-300";
    detail.relatedLessons.forEach((lesson) => {
      const li = document.createElement("li");
      const code = lesson.code ? `（${lesson.code}）` : "";
      li.textContent = `${lesson.title || lesson.id}${code}`;
      list.appendChild(li);
    });
    adminGraphSelection.appendChild(list);
  }
  if (Array.isArray(detail.relatedPractices) && detail.relatedPractices.length > 0) {
    const header = document.createElement("p");
    header.className = "mt-3 text-xs font-semibold text-sky-400";
    header.textContent = "关联实战关卡";
    adminGraphSelection.appendChild(header);
    const list = document.createElement("ul");
    list.className = "mt-1 space-y-1 text-xs text-slate-300";
    detail.relatedPractices.forEach((practice) => {
      const li = document.createElement("li");
      li.textContent = `${practice.title || practice.id}`;
      list.appendChild(li);
    });
    adminGraphSelection.appendChild(list);
  }
}

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

function buildProcessDetail(processId) {
  const node = (state.admin.graph.network && state.admin.graph.network.nodes || []).find(
    (item) => item.key === `ProcessStep:${processId}`,
  );
  return {
    title: (node && node.title) || processId,
    subtitle: node && node.subtitle ? node.subtitle : "",
  };
}

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
  } else if (label === "KnowledgePoint") {
    detail = buildKnowledgePointDetail(id);
  } else if (label === "Chapter") {
    detail = buildChapterDetail(id);
  } else if (label === "ProcessStep") {
    detail = buildProcessDetail(id);
  } else {
    detail = { title: nodeKey, meta: ["暂未提供详细信息"] };
  }
  if (adminGraphSelectionKey !== nodeKey) {
    return;
  }
  renderAdminGraphSelection(detail);
}

function renderAdminGraphNetwork() {
  if (!adminGraphCanvas) {
    return;
  }
  const networkData = state.admin.graph.network || { nodes: [], edges: [] };
  if (!window.vis || !window.vis.Network) {
    if (adminGraphStatus) {
      adminGraphStatus.textContent = "可视化库未加载，无法渲染图谱";
    }
    return;
  }
  adminGraphCanvas.innerHTML = "";
  const nodes = new window.vis.DataSet(
    (networkData.nodes || []).map((node) => ({
      id: node.key,
      label: node.title,
      title: node.subtitle || node.title,
      group: node.label,
    })),
  );
  const edges = new window.vis.DataSet(
    (networkData.edges || []).map((edge) => ({
      from: edge.source,
      to: edge.target,
      label: edge.type,
      arrows: "to",
    })),
  );
  if (adminGraphNetwork) {
    adminGraphNetwork.destroy();
    adminGraphNetwork = null;
  }
  const options = {
    nodes: {
      shape: "dot",
      size: 14,
      font: { color: "#e2e8f0", size: 12 },
      borderWidth: 1,
    },
    edges: {
      color: "#64748b",
      smooth: { type: "dynamic" },
      font: { color: "#94a3b8", size: 10, align: "middle" },
    },
    physics: {
      stabilization: true,
      barnesHut: { gravitationalConstant: -4200, springLength: 160, springConstant: 0.04 },
    },
    groups: {
      Chapter: { color: { background: "#312e81", border: "#6366f1" } },
      Practice: { color: { background: "#0f766e", border: "#2dd4bf" } },
      TheoryTopic: { color: { background: "#5b21b6", border: "#a855f7" } },
      TheoryLesson: { color: { background: "#9a3412", border: "#fb923c" } },
      KnowledgePoint: { color: { background: "#78350f", border: "#facc15" } },
      ProcessStep: { color: { background: "#14532d", border: "#22c55e" } },
    },
    interaction: { hover: true, tooltipDelay: 120 },
  };
  adminGraphNetwork = new window.vis.Network(adminGraphCanvas, { nodes, edges }, options);
  adminGraphNetwork.on("selectNode", (params) => {
    const key = params.nodes && params.nodes[0];
    if (key) {
      handleGraphNodeSelection(key);
    }
  });
  adminGraphNetwork.on("deselectNode", () => {
    adminGraphSelectionKey = null;
    renderAdminGraphSelection(null);
  });
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
    const [networkResp, knowledgeResp] = await Promise.all([
      fetchWithAuth("/api/graph/network?limit=400"),
      fetchWithAuth("/api/graph/knowledge-points"),
    ]);
    if (!networkResp.ok) {
      if (networkResp.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载知识图谱");
    }
    const networkData = await networkResp.json();
    state.admin.graph.network = networkData || { nodes: [], edges: [] };
    if (knowledgeResp.ok) {
      const knowledgeData = await knowledgeResp.json();
      state.admin.graph.knowledgePoints = knowledgeData.knowledgePoints || [];
    }
    renderAdminGraphKnowledgeList();
    renderAdminGraphNetwork();
    if (adminGraphStatus) {
      const nodeCount = (networkData.nodes || []).length;
      const edgeCount = (networkData.edges || []).length;
      adminGraphStatus.textContent = `节点 ${nodeCount} · 关系 ${edgeCount}`;
    }
  } catch (error) {
    console.error(error);
    if (adminGraphStatus) {
      adminGraphStatus.textContent = error.message || "加载知识图谱失败";
    }
  }
}

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
  updateInlineStatus(adminTheoryDocxStatus, `正在解析 ${file.name}...`, "muted");
  if (adminTheoryDocxApply) {
    adminTheoryDocxApply.disabled = true;
  }
  if (adminTheoryDocxPublish) {
    adminTheoryDocxPublish.disabled = true;
  }
  try {
    const response = await fetchWithAuth("/api/admin/theory/import-docx", {
      method: "POST",
      body: formData,
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
    updateInlineStatus(adminTheoryDocxStatus, error.message || "解析失败", "error");
    if (adminTheoryDocxInput) {
      adminTheoryDocxInput.value = "";
    }
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
  const actionLabel = publish ? "正在生成并发布理论内容..." : "正在生成章节与目录草稿...";
  updateInlineStatus(adminTheoryDocxStatus, actionLabel, "muted");
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
        }
      }
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

function getAdminLevelChapters() {
  return Array.isArray(state.admin.levels) ? state.admin.levels : [];
}

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

function closeChallengeSelectorModal() {
  if (!challengeSelectorModal) {
    return;
  }
  challengeSelectorModal.classList.add("hidden");
}

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

function enterAdminTheoryLessonCreateMode(preferredTopicId = null) {
  ensureAdminTheoryState();
  const targetTopicId = (preferredTopicId || state.admin.theory.selectedTopicId || "").trim();
  if (!targetTopicId) {
    alert("请先选择二级小节");
    return;
  }
  createAdminTheoryLessonInline(targetTopicId);
}

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


