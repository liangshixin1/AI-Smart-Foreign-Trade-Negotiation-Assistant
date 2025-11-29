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
