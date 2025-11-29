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



