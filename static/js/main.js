function escapeDataSelector(value) {
  const stringValue = value === undefined || value === null ? "" : String(value);
  if (typeof window !== "undefined" && window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(stringValue);
  }
  return stringValue.replace(/['"\\]/g, "\\$&");
}

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

if (studentPracticeEntryBtn) {
  studentPracticeEntryBtn.addEventListener("click", () => {
    expandLevelSelection();
    updateSelectedLevelDetail();
    if (levelSelectionPanel && typeof levelSelectionPanel.scrollIntoView === "function") {
      levelSelectionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

if (studentTheoryEntryBtn) {
  studentTheoryEntryBtn.addEventListener("click", () => {
    enterTheoryMode({ scrollIntoView: true });
  });
}

if (levelsBackHomeBtn) {
  levelsBackHomeBtn.addEventListener("click", showStudentDashboardHome);
}

if (theoryBackHomeBtn) {
  theoryBackHomeBtn.addEventListener("click", showStudentDashboardHome);
}

if (adminTheoryTree) {
  adminTheoryTree.addEventListener("click", (event) => {
    const addTopicButton = event.target.closest("[data-admin-theory-add-topic]");
    if (addTopicButton) {
      createAdminTheoryTopicInline(addTopicButton.dataset.adminTheoryAddTopic || "");
      return;
    }
    const addLessonButton = event.target.closest("[data-admin-theory-add-lesson]");
    if (addLessonButton) {
      createAdminTheoryLessonInline(addLessonButton.dataset.adminTheoryAddLesson || "");
      return;
    }
    const removeTopicButton = event.target.closest("[data-admin-theory-remove-topic]");
    if (removeTopicButton) {
      deleteAdminTheoryTopicInline(removeTopicButton.dataset.adminTheoryRemoveTopic || "");
      return;
    }
    const removeLessonButton = event.target.closest("[data-admin-theory-remove-lesson]");
    if (removeLessonButton) {
      deleteAdminTheoryLessonInline(removeLessonButton.dataset.adminTheoryRemoveLesson || "");
      return;
    }
    const topicRow = event.target.closest("[data-admin-theory-topic-row]");
    if (topicRow && !event.target.closest("button")) {
      const topicId = topicRow.dataset.adminTheoryTopicRow || "";
      const topicInput = topicRow.querySelector("input[data-admin-theory-topic-title]");
      const needRefresh = topicId && state.admin.theory && state.admin.theory.selectedTopicId !== topicId;
      if (topicId && needRefresh) {
        selectAdminTheoryTopic(topicId);
        window.setTimeout(() => {
          const selector = `[data-admin-theory-topic-title="${escapeDataSelector(topicId)}"]`;
          const refreshedInput = adminTheoryTree.querySelector(selector);
          if (refreshedInput) {
            refreshedInput.focus();
            refreshedInput.select();
          }
        }, 0);
      } else if (topicInput && event.target !== topicInput) {
        topicInput.focus();
        topicInput.select();
      }
      return;
    }
    const lessonRow = event.target.closest("[data-admin-theory-lesson-row]");
    if (lessonRow && !event.target.closest("button")) {
      const lessonId = lessonRow.dataset.adminTheoryLessonRow || "";
      const lessonInput = lessonRow.querySelector("input[data-admin-theory-lesson-title]");
      const needRefresh =
        lessonId && state.admin.theory && state.admin.theory.selectedLessonId !== lessonId;
      if (lessonId && needRefresh) {
        selectAdminTheoryLesson(lessonId);
        window.setTimeout(() => {
          const selector = `[data-admin-theory-lesson-title="${escapeDataSelector(lessonId)}"]`;
          const refreshedInput = adminTheoryTree.querySelector(selector);
          if (refreshedInput) {
            refreshedInput.focus();
            refreshedInput.select();
          }
        }, 0);
      } else if (lessonInput && event.target !== lessonInput) {
        lessonInput.focus();
        lessonInput.select();
      }
    }
  });

  adminTheoryTree.addEventListener(
    "focusin",
    (event) => {
      const topicInput = event.target.closest("input[data-admin-theory-topic-title]");
      if (topicInput) {
        const topicId = topicInput.dataset.adminTheoryTopicTitle || "";
        if (topicId && state.admin.theory && state.admin.theory.selectedTopicId !== topicId) {
          selectAdminTheoryTopic(topicId);
          window.setTimeout(() => {
            const selector = `[data-admin-theory-topic-title="${escapeDataSelector(topicId)}"]`;
            const refreshedInput = adminTheoryTree.querySelector(selector);
            if (refreshedInput && refreshedInput !== document.activeElement) {
              refreshedInput.focus();
              refreshedInput.select();
            }
          }, 0);
        }
        return;
      }
      const lessonInput = event.target.closest("input[data-admin-theory-lesson-title]");
      if (lessonInput) {
        const lessonId = lessonInput.dataset.adminTheoryLessonTitle || "";
        if (lessonId && state.admin.theory && state.admin.theory.selectedLessonId !== lessonId) {
          selectAdminTheoryLesson(lessonId);
          window.setTimeout(() => {
            const selector = `[data-admin-theory-lesson-title="${escapeDataSelector(lessonId)}"]`;
            const refreshedInput = adminTheoryTree.querySelector(selector);
            if (refreshedInput && refreshedInput !== document.activeElement) {
              refreshedInput.focus();
              refreshedInput.select();
            }
          }, 0);
        }
      }
    },
    true,
  );

  adminTheoryTree.addEventListener("change", (event) => {
    const topicInput = event.target.closest("input[data-admin-theory-topic-title]");
    if (topicInput) {
      updateAdminTheoryTopicTitleInline(
        topicInput.dataset.adminTheoryTopicTitle || "",
        topicInput.value,
        topicInput,
      );
      return;
    }
    const lessonInput = event.target.closest("input[data-admin-theory-lesson-title]");
    if (lessonInput) {
      updateAdminTheoryLessonTitleInline(
        lessonInput.dataset.adminTheoryLessonTitle || "",
        lessonInput.value,
        lessonInput,
      );
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

if (insertKnowledgeBtn) {
  insertKnowledgeBtn.addEventListener("click", () => {
    if (typeof triggerAutoKnowledgeMatch === "function") {
      triggerAutoKnowledgeMatch();
    } else if (typeof openKnowledgeCardFromSelection === "function") {
      openKnowledgeCardFromSelection();
    } else {
      openKnowledgeCardModal();
    }
  });
}

if (typeof insertKnowledgeRagBtn !== "undefined" && insertKnowledgeRagBtn) {
  insertKnowledgeRagBtn.addEventListener("click", () => {
    if (typeof triggerRagMatchBeta === "function") {
      triggerRagMatchBeta();
    } else {
      openKnowledgeCardModal();
    }
  });
}

if (autoBuildGraphBtn && autoBuildGraphInput) {
  autoBuildGraphBtn.addEventListener("click", () => {
    autoBuildGraphInput.click();
  });
  autoBuildGraphInput.addEventListener("change", () => {
    if (typeof handleAutoBuildGraphUpload === "function") {
      handleAutoBuildGraphUpload();
    }
  });
}

if (insertChallengeBtn) {
  insertChallengeBtn.addEventListener("click", () => {
    const preferredSectionId = adminTheoryLessonSection ? adminTheoryLessonSection.value : "";
    openChallengeSelectorModal(preferredSectionId || null);
  });
}

if (adminTheoryDocxGlobalTrigger && adminTheoryDocxInput) {
  adminTheoryDocxGlobalTrigger.addEventListener("click", () => {
    adminTheoryDocxInput.click();
  });
}

if (adminTheoryDocxTrigger && adminTheoryDocxInput) {
  adminTheoryDocxTrigger.addEventListener("click", () => {
    adminTheoryDocxInput.click();
  });
}

if (adminTheoryDocxInput) {
  adminTheoryDocxInput.addEventListener("change", () => {
    handleAdminTheoryDocxUpload();
  });
}

if (adminTheoryDocxApply) {
  adminTheoryDocxApply.addEventListener("click", () => {
    applyAdminTheoryDocxImport();
  });
}

if (adminTheoryDocxPublish) {
  adminTheoryDocxPublish.addEventListener("click", () => {
    applyAdminTheoryDocxImport({ publish: true });
  });
}

if (adminTheoryDocxReset) {
  adminTheoryDocxReset.addEventListener("click", () => {
    clearAdminTheoryDocxImport();
  });
}

if (challengeSelectorClose) {
  challengeSelectorClose.addEventListener("click", () => {
    closeChallengeSelectorModal();
  });
}

if (challengeSelectorCancel) {
  challengeSelectorCancel.addEventListener("click", () => {
    closeChallengeSelectorModal();
  });
}

if (challengeSelectorConfirm) {
  challengeSelectorConfirm.addEventListener("click", () => {
    const chapterId = challengeSelectorChapter ? challengeSelectorChapter.value : "";
    const sectionId = challengeSelectorSection ? challengeSelectorSection.value : "";
    if (!chapterId || !sectionId) {
      alert("请选择章节与小节关卡");
      return;
    }
    const customLabel = challengeSelectorLabel ? challengeSelectorLabel.value.trim() : "";
    insertChallengeBubbleIntoEditor(chapterId, sectionId, customLabel);
    closeChallengeSelectorModal();
  });
}

if (challengeSelectorModal) {
  challengeSelectorModal.addEventListener("click", (event) => {
    if (
      event.target === challengeSelectorModal ||
      (event.target && event.target.classList && event.target.classList.contains("challenge-modal__backdrop"))
    ) {
      closeChallengeSelectorModal();
    }
  });
}

if (challengeSelectorChapter) {
  challengeSelectorChapter.addEventListener("change", () => {
    populateChallengeSelectorSections(challengeSelectorChapter.value, "");
    updateChallengeSelectorPreview();
  });
}

if (challengeSelectorSection) {
  challengeSelectorSection.addEventListener("change", () => {
    updateChallengeSelectorPreview();
  });
}

if (challengeSelectorLabel) {
  challengeSelectorLabel.addEventListener("input", () => {
    updateChallengeSelectorPreview();
  });
}

if (knowledgeCardClose) {
  knowledgeCardClose.addEventListener("click", () => {
    closeKnowledgeCardModal();
  });
}

if (knowledgeCardCancel) {
  knowledgeCardCancel.addEventListener("click", () => {
    closeKnowledgeCardModal();
  });
}

if (knowledgeCardConfirm) {
  knowledgeCardConfirm.addEventListener("click", () => {
    handleKnowledgeCardConfirm();
  });
}

if (knowledgeCardModal) {
  knowledgeCardModal.addEventListener("click", (event) => {
    if (
      event.target === knowledgeCardModal ||
      (event.target && event.target.classList && event.target.classList.contains("knowledge-modal__backdrop"))
    ) {
      closeKnowledgeCardModal();
    }
  });
}

if (knowledgeCardSearch) {
  knowledgeCardSearch.addEventListener("input", handleKnowledgeCardSearchInput);
}

if (knowledgeCardList) {
  knowledgeCardList.addEventListener("click", handleKnowledgeCardListClick);
}

if (knowledgeCardNew) {
  knowledgeCardNew.addEventListener("click", handleKnowledgeCardNew);
}

if (knowledgeCardImageInput) {
  knowledgeCardImageInput.addEventListener("change", handleKnowledgeCardImageChange);
}

if (knowledgeCardRemoveImageBtn) {
  knowledgeCardRemoveImageBtn.addEventListener("click", handleKnowledgeCardRemoveImage);
}

if (knowledgeCardInsertTableBtn) {
  knowledgeCardInsertTableBtn.addEventListener("click", handleKnowledgeCardInsertTable);
}

if (knowledgeCardClearBodyBtn) {
  knowledgeCardClearBodyBtn.addEventListener("click", handleKnowledgeCardClearBody);
}

if (adminGraphSelection) {
  adminGraphSelection.addEventListener("click", (event) => {
    const anchorButton = event.target.closest("[data-knowledge-anchor]");
    if (anchorButton) {
      const anchorId = anchorButton.dataset.knowledgeAnchor || "";
      if (anchorId) {
        scrollToKnowledgeCardAnchor(anchorId);
      }
    }
  });
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
    updateSelectedLevelDetail();
    if (levelSelectionPanel && typeof levelSelectionPanel.scrollIntoView === "function") {
      levelSelectionPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
      if (target === "graph") {
        // 初始化知识点管理功能
        if (typeof initGraphKnowledgeManagement === 'function' && !window._graphKnowledgeInitialized) {
          initGraphKnowledgeManagement();
          window._graphKnowledgeInitialized = true;
        }
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

if (adminGraphRefresh) {
  adminGraphRefresh.addEventListener("click", () => {
    refreshAdminGraph();
  });
}

if (typeof adminGraphSearch !== "undefined" && adminGraphSearch) {
  adminGraphSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      refreshAdminGraph();
    }
  });
}

if (adminGraphToggleRenderer) {
  adminGraphToggleRenderer.addEventListener("click", () => {
    adminGraphRenderer = "burst";
    adminGraphToggleRenderer.textContent = "当前 开花";
    adminGraphToggleRenderer.title = "Stage 环形开花布局";
    renderAdminGraphNetwork();
  });
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
refreshAdminGraph();
