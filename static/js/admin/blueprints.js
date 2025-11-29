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

