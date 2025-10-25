let adminTheoryLessonEditor = null;
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
    state.admin.theory = { tree: [], selectedTopicId: null, selectedLessonId: null };
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

function populateAdminTheoryTopicOptions() {
  if (!adminTheoryLessonTopic) {
    return;
  }
  const items = collectAdminTheoryTopics();
  adminTheoryLessonTopic.innerHTML = "";
  if (items.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无理论目录";
    adminTheoryLessonTopic.appendChild(option);
    adminTheoryLessonTopic.disabled = true;
    return;
  }
  adminTheoryLessonTopic.disabled = false;
  items.forEach(({ chapter, topic }) => {
    const option = document.createElement("option");
    option.value = topic.id;
    const chapterLabel = chapter.chapterTitle || chapter.chapterId || chapter.id;
    option.textContent = `${chapterLabel}｜${topic.title || topic.id}`;
    adminTheoryLessonTopic.appendChild(option);
  });
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

function renderAdminTheoryTree() {
  if (!adminTheoryTree) {
    return;
  }
  ensureAdminTheoryState();
  const tree = Array.isArray(state.admin.theory.tree) ? state.admin.theory.tree : [];
  adminTheoryTree.innerHTML = "";

  if (tree.length === 0) {
    const empty = document.createElement("div");
    empty.className = "rounded-3xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400";
    empty.textContent = "暂无理论学习目录";
    adminTheoryTree.appendChild(empty);
    return;
  }

  const activeTopicId = state.admin.theory.selectedTopicId;
  const activeLessonId = state.admin.theory.selectedLessonId;

  tree.forEach((chapter) => {
    const card = document.createElement("div");
    card.className = "rounded-3xl border border-slate-800 bg-slate-900/40 p-4";

    const header = document.createElement("div");
    header.className = "flex flex-col gap-1";
    const title = document.createElement("p");
    title.className = "text-sm font-semibold text-slate-200";
    title.textContent = chapter.chapterTitle || chapter.chapterId || "章节";
    header.appendChild(title);
    if (chapter.chapterDescription) {
      const desc = document.createElement("p");
      desc.className = "text-xs text-slate-500";
      desc.textContent = chapter.chapterDescription;
      header.appendChild(desc);
    }
    card.appendChild(header);

    const topics = Array.isArray(chapter.topics) ? chapter.topics : [];
    topics.forEach((topic) => {
      const topicCard = document.createElement("div");
      topicCard.className = "mt-3 rounded-2xl border border-slate-800/70 bg-slate-900/50 p-3";

      const topicButton = document.createElement("button");
      topicButton.type = "button";
      topicButton.dataset.adminTheoryTopicId = topic.id;
      topicButton.className = "flex w-full flex-col gap-1 rounded-xl border px-3 py-2 text-left transition";
      const isTopicActive = topic.id === activeTopicId;
      if (isTopicActive) {
        topicButton.classList.add(
          "border-blue-400/60",
          "bg-blue-500/10",
          "text-blue-100",
          "shadow",
          "shadow-blue-500/20",
        );
      } else {
        topicButton.classList.add(
          "border-slate-800/60",
          "bg-slate-900/30",
          "text-slate-100",
          "hover:border-blue-400/50",
          "hover:text-blue-100",
        );
      }
      const topicLabel = document.createElement("span");
      topicLabel.className = "text-sm font-semibold";
      topicLabel.textContent = topic.code ? `${topic.code} ${topic.title || ""}` : topic.title || topic.id;
      topicButton.appendChild(topicLabel);
      if (topic.summary) {
        const summary = document.createElement("span");
        summary.className = isTopicActive ? "text-xs text-blue-200" : "text-xs text-slate-400";
        summary.textContent = topic.summary;
        topicButton.appendChild(summary);
      }
      topicCard.appendChild(topicButton);

      const lessons = Array.isArray(topic.lessons) ? topic.lessons : [];
      const lessonList = document.createElement("div");
      lessonList.className = "mt-2 space-y-2";
      lessons.forEach((lesson) => {
        const lessonButton = document.createElement("button");
        lessonButton.type = "button";
        lessonButton.dataset.adminTheoryLessonId = lesson.id;
        lessonButton.className = "flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2 text-left transition";
        const isActiveLesson = lesson.id === activeLessonId;
        if (isActiveLesson) {
          lessonButton.classList.add(
            "border-emerald-400/70",
            "bg-emerald-500/10",
            "text-emerald-100",
            "shadow",
            "shadow-emerald-500/20",
          );
        } else {
          lessonButton.classList.add(
            "border-slate-800/60",
            "bg-slate-900/30",
            "text-slate-100",
            "hover:border-emerald-400/50",
            "hover:text-emerald-100",
          );
        }
        if (lesson.code) {
          const code = document.createElement("span");
          code.className = isActiveLesson
            ? "text-[10px] uppercase tracking-widest text-emerald-300"
            : "text-[10px] uppercase tracking-widest text-slate-400";
          code.textContent = lesson.code;
          lessonButton.appendChild(code);
        }
        const lessonTitle = document.createElement("span");
        lessonTitle.className = "text-sm font-medium";
        lessonTitle.textContent = lesson.title || lesson.id;
        lessonButton.appendChild(lessonTitle);
        if (lesson.sectionTitle) {
          const linked = document.createElement("span");
          linked.className = isActiveLesson ? "text-xs text-emerald-200" : "text-xs text-slate-400";
          linked.textContent = `关卡：${lesson.sectionTitle}`;
          lessonButton.appendChild(linked);
        }
        lessonList.appendChild(lessonButton);
      });
      if (lessons.length === 0) {
        const empty = document.createElement("p");
        empty.className = "rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30 px-3 py-2 text-xs text-slate-500";
        empty.textContent = "暂无三级内容";
        lessonList.appendChild(empty);
      }
      topicCard.appendChild(lessonList);
      card.appendChild(topicCard);
    });

    adminTheoryTree.appendChild(card);
  });
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
  adminTheoryLessonEditor = new window.Quill(adminTheoryLessonEditorHost, {
    theme: "snow",
    placeholder: "请在此编写理论学习的富文本内容…",
  });
}

function setAdminTheoryEditorContent(html) {
  const content = typeof html === "string" ? html : "";
  if (adminTheoryLessonEditor) {
    adminTheoryLessonEditor.clipboard.dangerouslyPasteHTML(content || "<p><br></p>");
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

function updateAdminTheoryForms() {
  ensureAdminTheoryState();
  if (adminTheoryTopicForm) {
    const mode = adminTheoryTopicForm.dataset.mode || "edit";
    const topicId = state.admin.theory.selectedTopicId;
    const topicContext = topicId ? findAdminTheoryTopic(topicId) : null;
    if (mode === "create") {
      adminTheoryTopicForm.classList.remove("hidden");
      adminTheoryTopicForm.dataset.mode = "create";
      if (adminTheoryTopicChapter) {
        const options = Array.from(adminTheoryTopicChapter.options || []);
        adminTheoryTopicChapter.value = options.length > 0 ? options[0].value : "";
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
    return;
  }
  initAdminTheoryLessonEditor();
  const mode = adminTheoryLessonForm.dataset.mode || "edit";
  const lessonId = state.admin.theory.selectedLessonId;
  const lessonContext = lessonId ? findAdminTheoryLesson(lessonId) : null;
  if (mode === "create") {
    const topics = collectAdminTheoryTopics();
    if (topics.length === 0) {
      adminTheoryLessonForm.classList.add("hidden");
      updateInlineStatus(adminTheoryLessonStatus, "请先创建理论目录后再添加内容。", "muted");
      return;
    }
    adminTheoryLessonForm.classList.remove("hidden");
    adminTheoryLessonForm.dataset.mode = "create";
    adminTheoryLessonForm.dataset.lessonId = "";
    const preferredTopicId = state.admin.theory.selectedTopicId || topics[0].topic.id;
    if (adminTheoryLessonTopic) {
      adminTheoryLessonTopic.value = preferredTopicId;
    }
    if (adminTheoryLessonCode) adminTheoryLessonCode.value = "";
    if (adminTheoryLessonTitle) adminTheoryLessonTitle.value = "";
    if (adminTheoryLessonOrder) adminTheoryLessonOrder.value = "";
    if (adminTheoryLessonSection) adminTheoryLessonSection.value = "";
    setAdminTheoryEditorContent("<p><br></p>");
    if (adminTheoryLessonDeleteBtn) adminTheoryLessonDeleteBtn.disabled = true;
    updateInlineStatus(adminTheoryLessonStatus, "填写内容后保存，即可发布给学生查看。", "muted");
  } else if (lessonContext) {
    adminTheoryLessonForm.classList.remove("hidden");
    adminTheoryLessonForm.dataset.mode = "edit";
    adminTheoryLessonForm.dataset.lessonId = lessonContext.lesson.id;
    if (adminTheoryLessonTopic) {
      adminTheoryLessonTopic.value = lessonContext.topic.id;
    }
    if (adminTheoryLessonCode) adminTheoryLessonCode.value = lessonContext.lesson.code || "";
    if (adminTheoryLessonTitle) adminTheoryLessonTitle.value = lessonContext.lesson.title || "";
    if (adminTheoryLessonOrder) {
      adminTheoryLessonOrder.value =
        lessonContext.lesson.orderIndex !== null && lessonContext.lesson.orderIndex !== undefined
          ? lessonContext.lesson.orderIndex
          : "";
    }
    if (adminTheoryLessonSection) {
      adminTheoryLessonSection.value = lessonContext.lesson.sectionId || "";
    }
    setAdminTheoryEditorContent(lessonContext.lesson.contentHtml || "<p><br></p>");
    if (adminTheoryLessonDeleteBtn) adminTheoryLessonDeleteBtn.disabled = false;
    updateInlineStatus(adminTheoryLessonStatus, "", "muted");
  } else {
    adminTheoryLessonForm.classList.add("hidden");
    if (adminTheoryLessonDeleteBtn) adminTheoryLessonDeleteBtn.disabled = true;
    updateInlineStatus(adminTheoryLessonStatus, "请选择理论内容以编辑，或新建一个内容小节。", "muted");
  }
}

function enterAdminTheoryTopicCreateMode() {
  ensureAdminTheoryState();
  if (!adminTheoryTopicForm) {
    return;
  }
  adminTheoryTopicForm.dataset.mode = "create";
  state.admin.theory.selectedTopicId = null;
  state.admin.theory.selectedLessonId = null;
  renderAdminTheoryTree();
  updateAdminTheoryForms();
}

function enterAdminTheoryLessonCreateMode() {
  ensureAdminTheoryState();
  if (!adminTheoryLessonForm) {
    return;
  }
  adminTheoryLessonForm.dataset.mode = "create";
  state.admin.theory.selectedLessonId = null;
  renderAdminTheoryTree();
  updateAdminTheoryForms();
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

    populateAdminTheoryTopicOptions();
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
    const response = await fetchWithAuth(`/api/admin/theory/topics/${topicId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    await loadAdminTheory();
    adminTheoryTopicForm.dataset.mode = "edit";
    updateInlineStatus(adminTheoryTopicStatus, "理论目录已删除", "success");
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
  const mode = adminTheoryLessonForm.dataset.mode || "edit";
  const topicId = adminTheoryLessonTopic ? adminTheoryLessonTopic.value : "";
  const payload = {
    topicId,
    code: adminTheoryLessonCode ? adminTheoryLessonCode.value.trim() : "",
    title: adminTheoryLessonTitle ? adminTheoryLessonTitle.value.trim() : "",
    contentHtml: getAdminTheoryEditorContent(),
  };
  if (adminTheoryLessonOrder && adminTheoryLessonOrder.value.trim() !== "") {
    payload.orderIndex = Number(adminTheoryLessonOrder.value);
  }
  if (adminTheoryLessonSection) {
    payload.sectionId = adminTheoryLessonSection.value;
  }
  try {
    if (mode === "create") {
      const response = await fetchWithAuth("/api/admin/theory/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "创建理论内容失败");
      }
      const data = await response.json();
      const newLessonId = data.lesson && data.lesson.id;
      const targetTopicId = data.lesson && data.lesson.topicId ? data.lesson.topicId : topicId;
      await loadAdminTheory({ focusTopicId: targetTopicId, focusLessonId: newLessonId });
      adminTheoryLessonForm.dataset.mode = "edit";
      updateInlineStatus(adminTheoryLessonStatus, "理论内容已创建", "success");
    } else {
      const lessonId = adminTheoryLessonForm.dataset.lessonId;
      if (!lessonId) {
        throw new Error("未选择理论内容");
      }
      const response = await fetchWithAuth(`/api/admin/theory/lessons/${lessonId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "保存失败");
      }
      await loadAdminTheory({ focusTopicId: topicId, focusLessonId: lessonId, keepSelection: true });
      updateInlineStatus(adminTheoryLessonStatus, "理论内容已保存", "success");
    }
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
    const response = await fetchWithAuth(`/api/admin/theory/lessons/${lessonId}`, {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "删除失败");
    }
    const topicId = adminTheoryLessonTopic ? adminTheoryLessonTopic.value : null;
    await loadAdminTheory({ focusTopicId: topicId });
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
  } catch (error) {
    console.error(error);
    alert(error.message || "保存小节失败");
  }
}

async function deleteAdminSection() {


function loadAdminStudents() {
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



function loadAdminStudentDetail(studentId) {
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



function loadAdminSessionDetail(sessionId) {
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



function loadAdminAnalytics() {
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



function loadAdminBlueprints() {
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



function loadAdminAssignments() {
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



function submitBlueprint(event) {
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



function deleteBlueprint(blueprintId) {
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



function submitAssignment(event) {
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



function handleAdminProfileUpdate(event) {
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



function handleAdminPasswordUpdate(event) {
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



function handleAdminStudentPasswordReset(event) {
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



function handleStudentImport(event) {
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


