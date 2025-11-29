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

