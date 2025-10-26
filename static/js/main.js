if (startLevelBtn) {
  startLevelBtn.addEventListener("click", startLevel);
}

if (startAssignmentBtn) {
  startAssignmentBtn.addEventListener("click", () => {
    const assignmentId = startAssignmentBtn.dataset.assignmentId;
    if (!assignmentId) {
      if (studentAssignmentStatus) {
        studentAssignmentStatus.textContent = "请先选择关卡或等待教师分配案例挑战";
      }
      return;
    }
    startAssignmentSession(assignmentId);
  });
}

if (sendMessageBtn) {
  sendMessageBtn.addEventListener("click", sendMessage);
}

if (chatInputEl) {
  chatInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });
}

if (theoryTree) {
  theoryTree.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-theory-lesson-id]");
    if (!button) {
      return;
    }
    const lessonId = button.dataset.theoryLessonId;
    if (lessonId) {
      selectStudentTheoryLesson(lessonId);
    }
  });
}

if (theoryChallengeAction) {
  theoryChallengeAction.addEventListener("click", () => {
    ensureTheoryState();
    const lessonId = state.theory.selectedLessonId;
    if (!lessonId) {
      return;
    }
    const context = findTheoryLessonContext(lessonId);
    if (!context || !context.lesson.sectionId) {
      return;
    }
    setSelectedLevel(context.lesson.chapterId, context.lesson.sectionId);
    expandLevelSelection();
    if (levelSelectionPanel && typeof levelSelectionPanel.scrollIntoView === "function") {
      levelSelectionPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
}

if (adminTheoryTree) {
  adminTheoryTree.addEventListener("click", (event) => {
    const topicButton = event.target.closest("button[data-admin-theory-topic-id]");
    if (topicButton) {
      selectAdminTheoryTopic(topicButton.dataset.adminTheoryTopicId);
      return;
    }
    const lessonButton = event.target.closest("button[data-admin-theory-lesson-id]");
    if (lessonButton) {
      selectAdminTheoryLesson(lessonButton.dataset.adminTheoryLessonId);
    }
  });
}

if (adminTheoryCreateTopicBtn) {
  adminTheoryCreateTopicBtn.addEventListener("click", () => {
    enterAdminTheoryTopicCreateMode();
  });
}

if (adminTheoryCreateLessonBtn) {
  adminTheoryCreateLessonBtn.addEventListener("click", () => {
    enterAdminTheoryLessonCreateMode();
  });
}

if (adminTheoryTopicForm) {
  adminTheoryTopicForm.addEventListener("submit", saveAdminTheoryTopic);
}

if (adminTheoryTopicDeleteBtn) {
  adminTheoryTopicDeleteBtn.addEventListener("click", deleteAdminTheoryTopic);
}

if (adminTheoryLessonForm) {
  adminTheoryLessonForm.addEventListener("submit", saveAdminTheoryLesson);
}

if (adminTheoryLessonDeleteBtn) {
  adminTheoryLessonDeleteBtn.addEventListener("click", deleteAdminTheoryLesson);
}

if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", handleLogout);
}

if (changePasswordBtn) {
  changePasswordBtn.addEventListener("click", () => {
    if (state.auth.user && state.auth.user.role === "student") {
      openStudentPasswordModal();
    }
  });
}

if (studentPasswordModal) {
  studentPasswordModal.addEventListener("click", (event) => {
    if (event.target === studentPasswordModal) {
      closeStudentPasswordModal();
    }
  });
}

if (studentPasswordModalClose) {
  studentPasswordModalClose.addEventListener("click", () => {
    closeStudentPasswordModal();
  });
}

if (refreshSessionsBtn) {
  refreshSessionsBtn.addEventListener("click", () => {
    loadSessions();
    loadStudentAssignments();
  });
}

if (sessionHistoryList) {
  sessionHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-session-id]");
    if (!button) return;
    const sessionId = button.dataset.sessionId;
    loadStudentSession(sessionId);
  });
}

if (studentOptionButtons && studentOptionButtons.length > 0) {
  studentOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openStudentModal(button.dataset.studentOption);
    });
  });
}

if (studentModalTabButtons && studentModalTabButtons.length > 0) {
  studentModalTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateStudentModalTab(button.dataset.modalTab);
    });
  });
}

if (studentModalCloseBtn) {
  studentModalCloseBtn.addEventListener("click", () => {
    closeStudentModal();
  });
}

if (studentModalOverlay) {
  studentModalOverlay.addEventListener("click", (event) => {
    if (event.target === studentModalOverlay) {
      closeStudentModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && studentModalOverlay && !studentModalOverlay.classList.contains("hidden")) {
    closeStudentModal();
  }
});

if (reopenLevelMapBtn) {
  reopenLevelMapBtn.addEventListener("click", () => {
    expandLevelSelection();
    highlightSelectedLevel();
  });
}

if (levelMapContainer) {
  levelMapContainer.addEventListener("click", (event) => {
    const sectionNode = event.target.closest(".level-node");
    if (sectionNode) {
      setSelectedLevel(sectionNode.dataset.chapterId, sectionNode.dataset.sectionId);
      return;
    }
  });
}

if (resetSessionBtn) {
  resetSessionBtn.addEventListener("click", resetCurrentSession);
}

if (experienceTabButtons && experienceTabButtons.length > 0) {
  experienceTabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveExperienceModule(button.dataset.experienceTab);
    });
  });
}

if (scenarioCollapseBtn) {
  scenarioCollapseBtn.addEventListener("click", toggleScenarioPanel);
}

if (adminTabButtons) {
  adminTabButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const target = button.dataset.adminTab;
      activateAdminTab(target);
      if (target === "levels") {
        await loadAdminLevels();
      }
      if (target === "students") {
        await loadAdminStudents();
        await loadAdminAnalytics();
      }
      if (target === "assignments") {
        await loadAdminStudents();
        await loadAdminAssignments();
      }
      if (target === "blueprints") {
        await loadAdminBlueprints();
      }
      if (target === "theory") {
        await loadAdminLevels();
        await loadAdminTheory();
      }
    });
  });
}

if (adminStudentList) {
  adminStudentList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-student-id]");
    if (!button) return;
    const studentId = button.dataset.studentId;
    loadAdminStudentDetail(studentId);
  });
}

if (adminAssignmentForm) {
  adminAssignmentForm.addEventListener("submit", submitAssignment);
}

if (adminAssignmentChapter) {
  adminAssignmentChapter.addEventListener("change", () => {
    updateAssignmentSectionOptions();
    state.admin.selectedAssignmentId = null;
    renderAssignmentList();
    if (adminAssignmentStatus) {
      adminAssignmentStatus.textContent = "";
    }
    updateInlineStatus(adminAssignmentGeneratorStatus, "");
  });
}

if (adminAssignmentSection) {
  adminAssignmentSection.addEventListener("change", () => {
    updateInlineStatus(adminAssignmentGeneratorStatus, "");
  });
}

if (adminAssignmentList) {
  adminAssignmentList.addEventListener("click", (event) => {
    const item = event.target.closest("li[data-assignment-id]");
    if (!item) return;
    selectAdminAssignment(item.dataset.assignmentId);
  });
  adminAssignmentList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const item = event.target.closest("li[data-assignment-id]");
    if (!item) return;
    event.preventDefault();
    selectAdminAssignment(item.dataset.assignmentId);
  });
}

if (studentAssignmentListEl) {
  studentAssignmentListEl.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-assignment-id]");
    if (!button) return;
    startAssignmentSession(button.dataset.assignmentId);
  });
}

if (studentPasswordForm) {
  studentPasswordForm.addEventListener("submit", handleStudentPasswordChange);
}

if (adminProfileForm) {
  adminProfileForm.addEventListener("submit", handleAdminProfileUpdate);
}

if (adminPasswordForm) {
  adminPasswordForm.addEventListener("submit", handleAdminPasswordUpdate);
}

if (adminStudentImportForm) {
  adminStudentImportForm.addEventListener("submit", handleStudentImport);
}

if (adminStudentPasswordForm) {
  adminStudentPasswordForm.addEventListener("submit", handleAdminStudentPasswordReset);
}

if (adminBlueprintForm) {
  adminBlueprintForm.addEventListener("submit", submitBlueprint);
}

if (adminAssignmentGenerateBtn) {
  adminAssignmentGenerateBtn.addEventListener(
    "click",
    handleAssignmentScenarioGeneration,
  );
}

if (adminBlueprintGenerateBtn) {
  adminBlueprintGenerateBtn.addEventListener(
    "click",
    handleBlueprintScenarioGeneration,
  );
}

if (adminBlueprintChapter) {
  adminBlueprintChapter.addEventListener("change", () => {
    updateBlueprintSectionOptions();
    updateInlineStatus(adminBlueprintGeneratorStatus, "");
  });
}

if (adminBlueprintSection) {
  adminBlueprintSection.addEventListener("change", () => {
    updateInlineStatus(adminBlueprintGeneratorStatus, "");
  });
}

if (adminBlueprintReset) {
  adminBlueprintReset.addEventListener("click", (event) => {
    event.preventDefault();
    state.admin.selectedBlueprintId = null;
    resetBlueprintForm();
    renderBlueprintList();
    if (adminBlueprintStatus) {
      adminBlueprintStatus.textContent = "已切换至空白蓝图";
    }
  });
}

if (adminBlueprintList) {
  adminBlueprintList.addEventListener("click", async (event) => {
    const editButton = event.target.closest("button[data-action='edit']");
    if (editButton) {
      event.preventDefault();
      selectAdminBlueprint(editButton.dataset.blueprintId);
      return;
    }
    const deleteButton = event.target.closest("button[data-action='delete']");
    if (deleteButton) {
      event.preventDefault();
      const blueprintId = deleteButton.dataset.blueprintId;
      if (!blueprintId) return;
      if (!confirm("确认删除该蓝图？")) {
        return;
      }
      await deleteBlueprint(blueprintId);
    }
  });
}

if (adminSessionList) {
  adminSessionList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-session-id]");
    if (!button) return;
    const sessionId = button.dataset.sessionId;
    loadAdminSessionDetail(sessionId);
  });
}

if (levelChapterList) {
  levelChapterList.addEventListener("click", (event) => {
    const chapterButton = event.target.closest("button[data-chapter-id]");
    if (chapterButton && !event.target.closest("button[data-section-id]")) {
      const chapterId = chapterButton.dataset.chapterId;
      selectEditorChapter(chapterId);
      return;
    }
    const sectionButton = event.target.closest("button[data-section-id]");
    if (sectionButton) {
      selectEditorChapter(sectionButton.dataset.chapterId);
      selectEditorSection(sectionButton.dataset.sectionId);
    }
  });
}

if (levelCreateChapterBtn) {
  levelCreateChapterBtn.addEventListener("click", createAdminChapter);
}

if (levelCreateSectionBtn) {
  levelCreateSectionBtn.addEventListener("click", createAdminSection);
}

if (levelSaveChapterBtn) {
  levelSaveChapterBtn.addEventListener("click", saveAdminChapter);
}

if (levelDeleteChapterBtn) {
  levelDeleteChapterBtn.addEventListener("click", deleteAdminChapter);
}

if (levelSaveSectionBtn) {
  levelSaveSectionBtn.addEventListener("click", saveAdminSection);
}

if (levelDeleteSectionBtn) {
  levelDeleteSectionBtn.addEventListener("click", deleteAdminSection);
}

window.addEventListener("resize", updateExperienceLayout);
updateExperienceLayout();

initTokenEditors();
renderStudentInsights(null);
renderAdminAnalytics(null);
activateStudentTab();
activateAdminTab();
updateSessionControls();
loadLevels();
updateAuthUI();
