function createInitialState() {
  return {
    auth: {
      token: null,
      user: null,
    },
    chapters: [],
    sessionId: null,
    scenario: null,
    messages: [],
    sessions: [],
    selectedLevel: { chapterId: null, sectionId: null },
    activeLevel: { chapterId: null, sectionId: null, difficulty: "balanced" },
    isLevelSelectionCollapsed: false,
    expandedChapters: new Set(),
    theory: {
      tree: [],
      selectedLessonId: null,
      lessonCache: new Map(),
    },
    admin: {
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
      theory: {
        tree: [],
        selectedTopicId: null,
        selectedLessonId: null,
      },
    },
    studentInsights: null,
    studentAssignments: [],
    levelVictories: new Set(),
  };
}

const state = createInitialState();

function resetState() {
  const fresh = createInitialState();
  for (const key of Object.keys(fresh)) {
    state[key] = fresh[key];
  }
}

function replaceState(partial) {
  Object.keys(partial).forEach((key) => {
    state[key] = partial[key];
  });
}
