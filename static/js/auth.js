function updateAuthUI() {
  if (state.auth.user) {
    authPanel.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    const display = state.auth.user.displayName || state.auth.user.username;
    const roleText = state.auth.user.role === "teacher" ? "教师" : "学生";
    if (userRoleLabel) {
      userRoleLabel.textContent = roleText;
    }
    if (userStatusLabel) {
      userStatusLabel.textContent = display;
    }
    if (adminProfileNameInput) {
      adminProfileNameInput.value =
        state.auth.user.role === "teacher"
          ? state.auth.user.displayName || state.auth.user.username || ""
          : "";
    }
    updateInlineStatus(adminProfileStatus, "");
    updateInlineStatus(adminPasswordStatus, "");
    if (state.auth.user.role === "student") {
      studentDashboard.classList.remove("hidden");
      adminPanel.classList.add("hidden");
      goToLevelSelection();
      closeStudentModal();
      if (studentTopControls) {
        studentTopControls.classList.remove("hidden");
      }
      if (changePasswordBtn) {
        changePasswordBtn.classList.remove("hidden");
      }
      loadStudentTheory();
    } else {
      studentDashboard.classList.add("hidden");
      hideExperience();
      adminPanel.classList.remove("hidden");
      closeStudentModal();
      renderAdminAnalytics(state.admin.analytics);
      activateAdminTab();
      if (studentTopControls) {
        studentTopControls.classList.add("hidden");
      }
      if (changePasswordBtn) {
        changePasswordBtn.classList.add("hidden");
      }
      closeStudentPasswordModal();
      ensureAdminTheoryState();
      renderAdminTheoryTree();
      updateAdminTheoryForms();
      loadAdminLevels();
      loadAdminTheory();
    }
  } else {
    authPanel.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    if (userRoleLabel) {
      userRoleLabel.textContent = "访客";
    }
    if (userStatusLabel) {
      userStatusLabel.textContent = "未登录";
    }
    studentDashboard.classList.add("hidden");
    adminPanel.classList.add("hidden");
    hideExperience();
    if (studentTopControls) {
      studentTopControls.classList.add("hidden");
    }
    if (changePasswordBtn) {
      changePasswordBtn.classList.add("hidden");
    }
    chatInputEl.value = "";
    chatInputEl.disabled = true;
    sendMessageBtn.disabled = true;
    resetEvaluation();
    state.messages = [];
    renderChat();
    closeStudentModal();
    closeStudentPasswordModal();
    state.theory = { tree: [], selectedLessonId: null, lessonCache: new Map() };
    if (theoryPanel) {
      theoryPanel.classList.add("hidden");
    }
  }
}



function handleLogin(event) {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  loginErrorEl.textContent = "";

  if (!username || !password) {
    loginErrorEl.textContent = "请输入账号和密码";
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "登录失败");
    }

    const data = await response.json();
    state.auth.token = data.token;
    state.auth.user = data.user;
    updateAuthUI();
    loginForm.reset();
    loginErrorEl.textContent = "";
    updateSessionControls();

    if (state.auth.user.role === "student") {
      await loadSessions();
      await loadStudentAssignments();
      await loadStudentDashboardInsights();
      showStudentDashboardHome();
    } else {
      await loadAdminStudents();
      await loadAdminAnalytics();
      await loadAdminLevels();
      await loadAdminBlueprints();
      await loadAdminAssignments();
    }
  } catch (error) {
    console.error(error);
    loginErrorEl.textContent = error.message || "登录失败";
  }
}



function handleLogout() {
  state.auth = { token: null, user: null };
  state.chapters = [];
  state.sessions = [];
  state.sessionId = null;
  state.messages = [];
  state.activeLevel = { chapterId: null, sectionId: null, difficulty: "balanced" };
  state.selectedLevel = { chapterId: null, sectionId: null };
  state.admin = {
    students: [],
    selectedStudentId: null,
    selectedSessionId: null,
    studentDetail: null,
    analytics: null,
    levels: [],
    selectedEditorChapterId: null,
    selectedEditorSectionId: null,
    blueprints: [],
    assignments: [],
    selectedBlueprintId: null,
    selectedAssignmentId: null,
  };
  state.studentInsights = null;
  state.studentAssignments = [];
  state.levelVictories = new Set();
  state.expandedChapters = new Set();
  sessionHistoryList.innerHTML = "";
  adminStudentList.innerHTML = "";
  adminStudentMeta.innerHTML = '<p class="text-slate-400">请选择学生查看详情</p>';
  adminSessionList.innerHTML = "";
  adminSessionScenario.innerHTML = "";
  adminSessionConversation.innerHTML = "";
  adminSessionEvaluation.innerHTML = "";
  if (studentAssignmentListEl) {
    studentAssignmentListEl.innerHTML = "";
  }
  if (studentAssignmentStatus) {
    studentAssignmentStatus.textContent = "";
  }
  if (adminAssignmentStatus) {
    adminAssignmentStatus.textContent = "";
  }
  if (adminBlueprintStatus) {
    adminBlueprintStatus.textContent = "";
  }
  if (adminStudentImportStatus) {
    adminStudentImportStatus.textContent = "";
  }
  if (adminStudentPasswordStatus) {
    adminStudentPasswordStatus.textContent = "";
  }
  if (studentPasswordStatus) {
    studentPasswordStatus.textContent = "";
  }
  updateInlineStatus(adminProfileStatus, "");
  updateInlineStatus(adminPasswordStatus, "");
  if (adminProfileNameInput) {
    adminProfileNameInput.value = "";
  }
  if (adminAssignmentForm) {
    adminAssignmentForm.reset();
  }
  populateAssignmentForm(null);
  populateAssignmentChapterOptions();
  populateAssignmentBlueprintOptions();
  renderAssignmentList();
  renderAssignmentStudents();
  if (adminBlueprintForm) {
    adminBlueprintForm.reset();
  }
  resetBlueprintForm();
  renderBlueprintList();
  if (adminStudentImportForm) {
    adminStudentImportForm.reset();
  }
  if (adminStudentPasswordForm) {
    adminStudentPasswordForm.reset();
  }
  if (studentPasswordForm) {
    studentPasswordForm.reset();
  }
  renderStudentInsights(null);
  renderAdminAnalytics(null);
  renderAdminLevelList();
  updateChapterForm();
  updateSectionForm();
  goToLevelSelection({ clearSelection: true });
  renderLevelMap();
  if (startAssignmentBtn) {
    startAssignmentBtn.dataset.assignmentId = "";
    startAssignmentBtn.disabled = true;
    startAssignmentBtn.removeAttribute("title");
    startAssignmentBtn.removeAttribute("aria-label");
  }
  closeStudentModal();
  closeStudentPasswordModal();
  activateAdminTab();
  updateAuthUI();
}



