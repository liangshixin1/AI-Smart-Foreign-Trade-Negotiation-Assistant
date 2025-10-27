let abilityRadarChart = null;
let currentStudentModalTab = null;
let activeExperienceModule = "chat";
let isScenarioCollapsed = false;

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
  const chapterLabel = chapter.displayTitle || chapter.title || "章节";
  selectedLevelTitle.textContent = `${chapterLabel}｜${section.title || "小节"}`;
  selectedLevelDescription.textContent = section.description || "";
  selectedLevelDetail.classList.remove("hidden");
  startLevelBtn.disabled = false;
  highlightSelectedLevel();
  updateAssignmentShortcut();
}

function setSelectedLevel(chapterId, sectionId) {
  if (!(state.expandedChapters instanceof Set)) {
    state.expandedChapters = new Set();
  }
  if (chapterId) {
    state.expandedChapters.add(chapterId);
  }
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

function ensureTheoryState() {
  if (!state.theory || typeof state.theory !== "object") {
    state.theory = { tree: [], selectedLessonId: null, lessonCache: new Map() };
  }
  if (!(state.theory.lessonCache instanceof Map)) {
    state.theory.lessonCache = new Map();
  }
}

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

function renderTheoryLessonContent(lessonDetail) {
  if (!theoryLessonTitleEl || !theoryLessonContentEl || !theoryLessonCodeEl) {
    return;
  }
  if (!lessonDetail) {
    theoryLessonTitleEl.textContent = "请选择理论学习小节";
    theoryLessonCodeEl.textContent = "";
    theoryLessonContentEl.innerHTML = "<p class=\"text-sm text-slate-400\">在左侧选择任意知识点即可查看内容。</p>";
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

function refreshStudentTheorySelection() {
  ensureTheoryState();
  const lessonId = state.theory.selectedLessonId;
  if (!lessonId) {
    renderTheoryLessonContent(null);
    return;
  }
  const cache = state.theory.lessonCache instanceof Map ? state.theory.lessonCache : null;
  const lessonDetail = cache ? cache.get(lessonId) : null;
  if (lessonDetail) {
    renderTheoryLessonContent(lessonDetail);
  }
}

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
}

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
  if (studentHomeSection) {
    studentHomeSection.classList.add("hidden");
  }
  if (theoryPanel) {
    theoryPanel.classList.add("hidden");
  }
  experienceSection.classList.remove("hidden");
  setActiveExperienceModule("chat");
  if (chatInputEl) {
    chatInputEl.disabled = false;
    chatInputEl.focus();
  }
  if (sendMessageBtn) {
    sendMessageBtn.disabled = false;
  }
  state.studentActiveView = "practice";
}

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

function hideExperience() {
  experienceSection.classList.add("hidden");
  if (chatInputEl) {
    chatInputEl.disabled = true;
  }
  if (sendMessageBtn) {
    sendMessageBtn.disabled = true;
  }
}

function goToLevelSelection({ clearSelection = false, showPanel = true } = {}) {
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
  renderCustomFields(scenario.customFields || []);
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
    refreshStudentTheorySelection();
  } catch (error) {
    console.error(error);
    alert(error.message || "加载章节失败");
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
      const existingMessage =
        state.messages[assistantIndex] &&
        typeof state.messages[assistantIndex] === "object"
          ? state.messages[assistantIndex].content || ""
          : "";
      fullReply = existingMessage && existingMessage !== "…"
        ? existingMessage
        : "（无有效回复）";
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



