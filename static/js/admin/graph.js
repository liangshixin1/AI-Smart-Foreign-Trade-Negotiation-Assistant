function describeGraphNodeKey(key) {
  if (typeof key !== "string") {
    return { label: "", id: "" };
  }
  const [label, ...rest] = key.split(":");
  return { label: label || "", id: rest.join(":") };
}

function renderAdminGraphKnowledgeList() {
  if (!adminGraphKnowledgeList) {
    return;
  }
  const network = state.admin.graph.network || { nodes: [] };
  const nodes = Array.isArray(network.nodes) ? network.nodes : [];
  const stages = nodes.filter((n) => n.label === "Stage");
  const points = nodes.filter((n) =>
    ["KnowledgePoint", "Skill", "Terminology"].includes(n.label)
  );
  const stageMap = {};
  stages.forEach((s) => {
    stageMap[s.title] = { stage: s, points: [] };
  });
  points.forEach((p) => {
    const stageName = p.stage || p.stageName;
    if (stageName && stageMap[stageName]) {
      stageMap[stageName].points.push(p);
    }
  });
  const stageList = Object.values(stageMap).sort((a, b) => (a.stage.order || 0) - (b.stage.order || 0));
  adminGraphKnowledgeList.innerHTML = "";
  if (stageList.length === 0) {
    const empty = document.createElement("li");
    empty.className = "rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-xs text-slate-500";
    empty.textContent = "暂无知识点数据或图谱尚未初始化。";
    adminGraphKnowledgeList.appendChild(empty);
    return;
  }
  stageList.forEach(({ stage, points }) => {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-800/70 bg-slate-950/60";
    const pointCount = points.length;
    const stageTitle = stage.title || stage.name;
    const listId = `stage-${stageTitle}-list`;
    li.innerHTML = `
      <button class="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-white">
        <span>${escapeHtmlText(stageTitle || "阶段")}</span>
        <span class="text-xs text-slate-400">${pointCount} 个知识点</span>
      </button>
      <div id="${listId}" class="space-y-2 px-3 pb-3 hidden"></div>
    `;
    adminGraphKnowledgeList.appendChild(li);
    const listEl = li.querySelector(`#${listId}`);
    const headerEl = li.querySelector("button");
    headerEl.addEventListener("click", () => {
      listEl.classList.toggle("hidden");
    });
    points
      .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
      .forEach((p) => {
        const item = document.createElement("div");
        item.className = "rounded-lg border border-slate-800/60 bg-slate-950/40 p-2 text-xs text-slate-200 cursor-pointer hover:border-emerald-400/60 flex items-center gap-2";

        const badge = document.createElement("span");
        badge.className = "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold";
        const nodeType = p.nodeType || p.label || "KnowledgePoint";
        const badgeMap = {
          Terminology: { label: "T", style: "bg-slate-200 text-slate-800" },
          Skill: { label: "S", style: "bg-cyan-200 text-cyan-900" },
          KnowledgePoint: { label: "K", style: "bg-amber-200 text-amber-900" },
        };
        const badgeMeta = badgeMap[nodeType] || badgeMap.KnowledgePoint;
        badge.textContent = badgeMeta.label;
        badge.className += ` ${badgeMeta.style}`;

        const title = document.createElement("span");
        title.textContent = p.title || p.key;

        item.appendChild(badge);
        item.appendChild(title);
        item.addEventListener("click", () => {
          handleGraphNodeSelection(p.key);
        });
        listEl.appendChild(item);
      });
  });
}

function renderAdminGraphSelection(detail) {
  showGraphDetailDrawer(detail);
  if (!adminGraphSelection) {
    return;
  }
  adminGraphSelection.innerHTML = "";
  if (!detail) {
    adminGraphSelection.innerHTML = '<p class="text-xs text-slate-500">请选择节点以查看详细信息。</p>';
    return;
  }
  if (detail.title) {
    const titleEl = document.createElement("p");
    titleEl.className = "text-sm font-semibold text-white";
    titleEl.textContent = detail.title;
    adminGraphSelection.appendChild(titleEl);
  }
  if (detail.subtitle) {
    const subtitleEl = document.createElement("p");
    subtitleEl.className = "text-xs text-slate-400";
    subtitleEl.textContent = detail.subtitle;
    adminGraphSelection.appendChild(subtitleEl);
  }
  const meta = Array.isArray(detail.meta) ? detail.meta.filter(Boolean) : [];
  if (meta.length > 0) {
    const list = document.createElement("ul");
    list.className = "mt-2 space-y-1 text-xs text-slate-400";
    meta.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    adminGraphSelection.appendChild(list);
  }
}

function showGraphDetailDrawer(detail) {
  const overlay = document.getElementById('graph-detail-overlay');
  const drawer = document.getElementById('graph-detail-drawer');
  if (!drawer || !overlay) return;
  if (!overlay._graphDrawerBound) {
    overlay._graphDrawerBound = true;
    overlay.addEventListener('click', hideGraphDetailDrawer);
  }
  document.getElementById('graph-detail-close')?.addEventListener('click', hideGraphDetailDrawer);
  overlay.classList.remove('hidden');
  drawer.classList.remove('hidden');
  setTimeout(() => drawer.classList.remove('translate-y-full'), 10);
  document.getElementById('graph-detail-title').textContent = detail?.title || '知识点详情';
  document.getElementById('graph-detail-subtitle').textContent = detail?.subtitle || '';
  const metaEl = document.getElementById('graph-detail-meta');
  metaEl.innerHTML = '';
  (detail?.meta || []).forEach((line) => {
    const li = document.createElement('p');
    li.textContent = line;
    metaEl.appendChild(li);
  });
  const bodyEl = document.getElementById('graph-detail-body');
  if (!bodyEl) {
    return;
  }
  let textEl = bodyEl.querySelector('[data-graph-detail-text]');
  if (!textEl) {
    textEl = document.createElement('div');
    textEl.dataset.graphDetailText = 'true';
    textEl.className = 'space-y-2';
    bodyEl.prepend(textEl);
  }
  const formEl = document.getElementById('admin-graph-form');
  const showForm = detail?.kind === 'KnowledgePoint';

  if (formEl) {
    formEl.style.display = showForm ? 'block' : 'none';
  }
  applyGraphDrawerTheme(showForm ? 'light' : 'dark');
  if (textEl) {
    if (showForm) {
      textEl.classList.add('hidden');
      textEl.innerHTML = '';
    } else {
      textEl.classList.remove('hidden');
      textEl.innerHTML = detail?.body || '<p class="text-xs text-slate-400">暂无详细内容</p>';
    }
  }
}

function hideGraphDetailDrawer() {
  const overlay = document.getElementById('graph-detail-overlay');
  const drawer = document.getElementById('graph-detail-drawer');
  if (!drawer || !overlay) return;
  if (!overlay._graphDrawerBound) {
    overlay._graphDrawerBound = true;
    overlay.addEventListener('click', hideGraphDetailDrawer);
  }
  drawer.classList.add('translate-y-full');
  setTimeout(() => {
    drawer.classList.add('hidden');
    overlay.classList.add('hidden');
  }, 180);
}

async function loadPracticeGraphDetail(practiceId) {
  try {
    const response = await fetchWithAuth(`/api/graph/practices/${practiceId}/related-lessons`);
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载关卡关联数据");
    }
    const data = await response.json();
    const practice = data.practice || {};
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];
    return {
      title: practice.title || practice.id || "实战关卡",
      subtitle: practice.description || "",
      meta: [
        practice.chapterId ? `所属章节：${practice.chapterId}` : "",
        typeof practice.orderIndex === "number" ? `排序权重：${practice.orderIndex}` : "",
        practice.expectsBargaining ? "博弈回合：开启" : "",
      ],
      knowledge: normalizeKnowledgePayloadList(practice.knowledgePoints || []),
      relatedLessons: lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title || lesson.id,
        code: lesson.code || "",
      })),
    };
  } catch (error) {
    console.error(error);
    return { title: "实战关卡", meta: [error.message || "加载失败"], knowledge: [] };
  }
}

async function loadLessonGraphDetail(lessonId) {
  try {
    const response = await fetchWithAuth(`/api/graph/theory-lessons/${lessonId}/related-practices`);
    if (!response.ok) {
      if (response.status === 503) {
        throw new Error("知识图谱服务暂不可用");
      }
      throw new Error("无法加载理论关联数据");
    }
    const data = await response.json();
    const lesson = data.lesson || {};
    const practices = Array.isArray(data.practices) ? data.practices : [];
    return {
      title: lesson.title || lesson.id || "理论课程",
      subtitle: lesson.code ? `课程编号：${lesson.code}` : "",
      meta: [lesson.topicId ? `所属主题：${lesson.topicId}` : ""],
      knowledge: normalizeKnowledgePayloadList(lesson.knowledgePoints || []),
      relatedPractices: practices.map((practice) => ({
        id: practice.id,
        title: practice.title || practice.id,
      })),
    };
  } catch (error) {
    console.error(error);
    return { title: "理论课程", meta: [error.message || "加载失败"], knowledge: [] };
  }
}

function buildKnowledgePointDetail(name) {
  const record = Array.isArray(state.admin.graph.knowledgePoints)
    ? state.admin.graph.knowledgePoints.find((item) => item.name === name)
    : null;
  const practiceCount = record && typeof record.practiceCount === "number" ? record.practiceCount : 0;
  const lessonCount = record && typeof record.lessonCount === "number" ? record.lessonCount : 0;
  const summary = record && record.summary ? record.summary : "";
  return {
    title: name,
    subtitle: summary,
    meta: [`关联实战：${practiceCount}`, `关联理论：${lessonCount}`],
  };
}

function buildChapterDetail(chapterId) {
  const chapter = findAdminChapter(chapterId);
  if (!chapter) {
    return { title: chapterId, meta: ["尚未在系统中维护详细信息"] };
  }
  const sections = Array.isArray(chapter.sections) ? chapter.sections : [];
  return {
    title: chapter.title || chapterId,
    subtitle: chapter.description || "",
    meta: [`关卡数量：${sections.length}`],
    relatedPractices: sections.map((section) => ({ id: section.id, title: section.title })),
  };
}

function buildProcessDetail(processId) {
  const node = (state.admin.graph.network && state.admin.graph.network.nodes || []).find(
    (item) => item.key === `ProcessStep:${processId}`,
  );
  return {
    title: (node && node.title) || processId,
    subtitle: node && node.subtitle ? node.subtitle : "",
  };
}

async function openKnowledgePointEditor(name, selectionKey = null) {
  if (!name || typeof window === "undefined" || typeof window.showKnowledgeGraphForm !== "function") {
    return;
  }
  const statusFn = typeof showStatus === "function" ? showStatus : null;
  if (selectionKey && adminGraphSelectionKey !== selectionKey) {
    return;
  }
  try {
    if (statusFn) {
      statusFn("admin-graph-form-status", "加载中...", "info");
    }
    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}`);
    if (!response.ok) {
      throw new Error(`加载知识点失败: ${response.status}`);
    }
    const data = await response.json();
    if (selectionKey && adminGraphSelectionKey !== selectionKey) {
      return;
    }
    window.showKnowledgeGraphForm("edit", data);
    if (statusFn) {
      statusFn("admin-graph-form-status", "", "");
    }
  } catch (error) {
    console.error("[Graph] load knowledge point detail failed", error);
    if (statusFn) {
      statusFn("admin-graph-form-status", `加载失败: ${error.message}`, "error");
    }
  }
}

async function handleGraphNodeSelection(nodeKey) {
  adminGraphSelectionKey = nodeKey;
  if (!nodeKey) {
    renderAdminGraphSelection(null);
    return;
  }
  renderAdminGraphSelection({ title: "加载中...", meta: [] });
  const { label, id } = describeGraphNodeKey(nodeKey);
  let detail = null;
  if (label === "Practice") {
    detail = await loadPracticeGraphDetail(id);
  } else if (label === "TheoryLesson") {
    detail = await loadLessonGraphDetail(id);
  } else if (["KnowledgePoint", "Skill", "Terminology"].includes(label)) {
    detail = buildKnowledgePointDetail(id);
  } else if (label === "Chapter") {
    detail = buildChapterDetail(id);
  } else if (label === "ProcessStep") {
    detail = buildProcessDetail(id);
  } else {
    detail = { title: nodeKey, meta: ["暂未提供详细信息"] };
  }
  detail.kind = label;
  detail.id = detail.id || id;
  if (adminGraphSelectionKey !== nodeKey) {
    return;
  }
  renderAdminGraphSelection(detail);
  if (["KnowledgePoint", "Skill", "Terminology"].includes(label)) {
    await openKnowledgePointEditor(id, nodeKey);
  }
}

function ensureGraphDrawerLightStyles() {
  if (document.getElementById('graph-drawer-light-style')) return;
  const style = document.createElement('style');
  style.id = 'graph-drawer-light-style';
  style.textContent = `
    #graph-detail-drawer.graph-drawer-light {
      background: radial-gradient(120% 120% at 15% 0%, rgba(18, 32, 52, 0.95), rgba(10, 20, 35, 0.9)) !important;
      color: #eaf4ff !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      backdrop-filter: blur(18px);
      box-shadow: 0 30px 70px -32px rgba(0, 0, 0, 0.6);
    }
    #graph-detail-drawer.graph-drawer-light h4,
    #graph-detail-drawer.graph-drawer-light p,
    #graph-detail-drawer.graph-drawer-light label,
    #graph-detail-drawer.graph-drawer-light span {
      color: #eaf4ff !important;
      letter-spacing: 0.04em;
    }
    #graph-detail-drawer.graph-drawer-light label {
      text-transform: uppercase;
      color: #c3d5e8 !important;
      font-weight: 600;
      font-size: 11px;
    }
    #graph-detail-drawer.graph-drawer-light input,
    #graph-detail-drawer.graph-drawer-light select,
    #graph-detail-drawer.graph-drawer-light textarea {
      background: rgba(255, 255, 255, 0.08) !important;
      color: #eaf4ff !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      border-radius: 12px;
      transition: all 0.2s ease;
    }
    #graph-detail-drawer.graph-drawer-light input:focus,
    #graph-detail-drawer.graph-drawer-light select:focus,
    #graph-detail-drawer.graph-drawer-light textarea:focus {
      border-color: rgba(106, 196, 201, 0.7) !important;
      box-shadow: 0 0 0 2px rgba(106, 196, 201, 0.25);
      background: rgba(255, 255, 255, 0.12) !important;
      outline: none;
    }
    #graph-detail-drawer.graph-drawer-light .grid {
      gap: 14px;
    }
    #graph-detail-drawer.graph-drawer-light button {
      background: rgba(255, 255, 255, 0.06) !important;
      color: #e2e8f0 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 12px;
    }
    #graph-detail-drawer.graph-drawer-light .chip,
    #graph-detail-drawer.graph-drawer-light .tag,
    #graph-detail-drawer.graph-drawer-light .badge {
      background: rgba(106, 196, 201, 0.18) !important;
      color: #0f172a !important;
      border: 1px solid rgba(106, 196, 201, 0.35) !important;
    }
    #graph-detail-drawer.graph-drawer-light #admin-graph-form-submit {
      background: #6ac4c9 !important;
      color: #0f172a !important;
      border-color: #6ac4c9 !important;
      box-shadow: 0 0 20px -5px rgba(106, 196, 201, 0.5);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    #graph-detail-drawer.graph-drawer-light #admin-graph-form-status {
      color: #cbd5e1 !important;
    }
    #graph-detail-drawer.graph-drawer-light .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
    }
    #graph-detail-drawer.graph-drawer-light .custom-scrollbar::-webkit-scrollbar-thumb {
      background-color: rgba(255, 255, 255, 0.12);
      border-radius: 10px;
    }
    #graph-detail-drawer.graph-drawer-light .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background-color: rgba(255, 255, 255, 0.2);
    }
  `;
  document.head.appendChild(style);
}

function applyGraphDrawerTheme(mode) {
  const drawer = document.getElementById('graph-detail-drawer');
  if (!drawer) return;
  if (mode === 'light') {
    ensureGraphDrawerLightStyles();
    drawer.classList.add('graph-drawer-light');
  } else {
    drawer.classList.remove('graph-drawer-light');
    drawer.style.background = '';
    drawer.style.color = '';
  }
}

function renderAdminGraphNetwork() {
  if (!adminGraphCanvas || !window.G6) {
    return;
  }

  if (adminGraphNetwork) {
    adminGraphNetwork.dispose();
    adminGraphNetwork = null;
  }
  if (adminG6Graph) {
    adminG6Graph.destroy();
    adminG6Graph = null;
  }

  const networkData = state.admin.graph.network || { nodes: [], edges: [] };
  const treeData = buildTreeData(networkData);
  if (!treeData || !Array.isArray(treeData.children) || treeData.children.length === 0) {
    if (adminGraphStatus) {
      adminGraphStatus.textContent = "暂无可展示的节点，请检查数据或关系";
    }
    return;
  }
  const totalNodes = (networkData.nodes || []).length;
  const totalEdges = (networkData.edges || []).length;
  const width = adminGraphCanvas.clientWidth || 960;
  const height = adminGraphCanvas.clientHeight || 820;

  const stageColor = '#3b82f6';
  const topicColor = '#f97316';
  const pointColor = '#22c55e';

  adminG6Graph = new G6.TreeGraph({
    container: adminGraphCanvas,
    width,
    height,
    linkCenter: true,
    fitView: true,
    modes: {
      default: ['drag-canvas', 'zoom-canvas'],
    },
    defaultNode: {
      style: {
        radius: 8,
        lineWidth: 1,
      },
      labelCfg: {
        position: 'right',
        offset: 8,
        style: {
          fontSize: 12,
          fill: '#0f172a',
        },
      },
    },
    defaultEdge: {
      type: 'cubic-horizontal',
      style: {
        stroke: 'rgba(148,163,184,0.8)',
        lineWidth: 1.2,
      },
    },
    layout: {
      type: 'compactBox',
      direction: 'LR',
      getId: (d) => d.id,
      getHeight: () => 20,
      getWidth: (d) => (d.type === 'Stage' ? 140 : d.type === 'Topic' ? 120 : 10),
      getVGap: () => 18,
      getHGap: () => 60,
    },
  });

  adminG6Graph.node((node) => {
    if (node.type === 'Stage') {
      return {
        type: 'rect',
        size: [140, 36],
        style: { fill: stageColor, stroke: '#2563eb', radius: 10, lineWidth: 1.4 },
        labelCfg: { style: { fill: '#fff', fontWeight: 700, fontSize: 13 } },
      };
    }
    if (node.type === 'Topic') {
      return {
        type: 'rect',
        size: [120, 30],
        style: { fill: topicColor, stroke: '#f59e0b', radius: 8, lineWidth: 1.2 },
        labelCfg: { style: { fill: '#fff', fontWeight: 600, fontSize: 12 } },
      };
    }
    return {
      type: 'circle',
      size: 8,
      style: { fill: pointColor, stroke: '#16a34a', lineWidth: 1 },
      labelCfg: { position: 'right', offset: 6, style: { fill: '#0f172a', fontSize: 11 } },
    };
  });

  adminG6Graph.data(treeData);
  adminG6Graph.render();
  adminG6Graph.fitView(60);

  if (adminGraphStatus) {
    adminGraphStatus.textContent = `节点 ${totalNodes} · 关系 ${totalEdges}`;
  }

  adminG6Graph.on('node:click', (evt) => {
    const item = evt.item;
    if (!item) return;
    const model = item.getModel();
    if (model.children && model.children.length) {
      model.collapsed = !model.collapsed;
      adminG6Graph.layout();
      adminG6Graph.fitView(60);
    } else if (model.key) {
      handleGraphNodeSelection(model.key);
    }
  });

  window.addEventListener('resize', () => {
    if (adminG6Graph) {
      const w = adminGraphCanvas?.clientWidth || 800;
      const h = adminGraphCanvas?.clientHeight || 820;
      adminG6Graph.changeSize(w, h);
      adminG6Graph.fitView(60);
    }
  });
}

function buildTreeData(network) {
  const nodes = network && Array.isArray(network.nodes) ? network.nodes : [];
  const edges = network && Array.isArray(network.edges) ? network.edges : [];
  const nodeMap = new Map();
  nodes.forEach((n) => {
    const key = n.key || n.id || n.name;
    if (!key) return;
    nodeMap.set(key, {
      id: key,
      key,
      name: n.title || n.name || key,
      type: n.label || n.nodeType,
      order: n.order || 0,
      stage: n.stage || n.stageName,
      topic: n.topic || n.topicName,
      children: [],
    });
  });

  const stages = [];
  const topics = new Map();
  const points = new Map();
  nodeMap.forEach((node, key) => {
    if (node.type === "Stage") stages.push(node);
    else if (node.type === "Topic") topics.set(key, node);
    else points.set(key, node);
  });

  const src = (e) => e.source || e.from;
  const tgt = (e) => e.target || e.to;

  edges.forEach((e) => {
    if (e.type !== "CONTAIN_TOPIC") return;
    const s = nodeMap.get(src(e));
    const t = topics.get(tgt(e));
    if (s && t) s.children.push(t);
  });

  edges.forEach((e) => {
    if (e.type !== "INCLUDE_POINT" && e.type !== "HAS_TOPIC") return;
    const t = topics.get(src(e));
    const p = points.get(tgt(e));
    if (t && p) t.children.push(p);
  });

  // Fallback by props
  topics.forEach((t) => {
    if (t.children.length === 0) {
      points.forEach((p) => {
        if ((p.topic && (p.topic === t.name || p.topic === t.key)) ||
            (p.stage && (p.stage === t.stage || p.stage === t.stageName))) {
          t.children.push(p);
        }
      });
    }
  });
  if (stages.every((s) => s.children.length === 0)) {
    topics.forEach((t) => {
      const stageName = t.stage || t.stageName || (t.key || "").split(":")[1];
      const s = stages.find((st) => st.name === stageName || st.key === `Stage:${stageName}`);
      if (s) s.children.push(t);
    });
  }

  stages.sort((a, b) => a.order - b.order || (a.name || "").localeCompare(b.name || ""));
  topics.forEach((t) => {
    t.children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    t.collapsed = true;
  });
  stages.forEach((s) => {
    s.children.sort((a, b) => (a.order || 0) - (b.order || 0));
    s.collapsed = false;
  });

  const children = stages.length > 0 ? stages : Array.from(topics.values());
  const rootChildren = children.length > 0 ? children : Array.from(points.values());

  return {
    id: "root",
    name: "root",
    collapsed: false,
    children: rootChildren,
  };
}

function renderAdminGraphWithG6() {
  if (!adminGraphCanvas) return;
  if (adminGraphNetwork) {
    adminGraphNetwork.dispose();
    adminGraphNetwork = null;
  }
  if (adminG6Graph) {
    adminG6Graph.destroy();
    adminG6Graph = null;
  }

  const networkData = state.admin.graph.network || { nodes: [], edges: [] };
  const width = adminGraphCanvas.clientWidth || 800;
  const height = adminGraphCanvas.clientHeight || 420;

  adminGraphCanvas.innerHTML = "";

  const colorMap = {
    Stage: "#6c63ff",
    Topic: "#f97316",
    KnowledgeCategory: "#cbd5e1",
    Skill: "#0ea5e9",
    Terminology: "#475569",
    KnowledgePoint: "#22c55e",
    Chapter: "#67e8f9",
    Practice: "#0f766e",
    TheoryTopic: "#5b21b6",
    TheoryLesson: "#9a3412",
    ProcessStep: "#94a3b8",
  };

  const nodes = (networkData.nodes || []).map((n, idx, arr) => {
    const labelVisible =
      n.label === "Stage" || n.label === "Topic" || n.label === "KnowledgeCategory";
    let size = 24;
    if (n.label === "Stage") size = 46;
    else if (n.label === "Topic") size = 32;
    else if (n.label === "KnowledgeCategory") size = 26;
    else if (n.label === "KnowledgePoint") size = 20;
    else if (n.label === "Skill" || n.label === "Terminology") size = 20;
    return {
      id: n.key,
      label: labelVisible ? (n.title || n.name) : "",
      originLabel: n.title || n.name,
      type: n.label === "Topic" || n.label === "KnowledgeCategory" ? "rect" : "circle",
      style: {
        fill: colorMap[n.label] || "#94a3b8",
        stroke: "rgba(15,23,42,0.4)",
        lineWidth: 1.2,
      },
      size,
      nodeType: n.label,
    };
  });

  const edges = (networkData.edges || []).map((e) => {
    const showLabel = ["PRECEDES", "CONTAIN_TOPIC", "HAS_CATEGORY", "CONTAINS"].includes(e.type);
    return {
      source: e.source,
      target: e.target,
      label: showLabel ? (e.label || e.type) : "",
      style: {
        stroke: "rgba(148,163,184,0.45)",
        lineWidth: 1.1,
        endArrow: false,
      },
    };
  });

  adminG6Graph = new G6.Graph({
    container: adminGraphCanvas,
    width,
    height,
    layout: {
      type: "dagre",
      rankdir: "LR",
      nodesep: 40,
      ranksep: 120,
      controlPoints: true,
      preventOverlap: true,
      nodeSize: 30,
    },
    modes: {
      default: ["drag-canvas", "zoom-canvas", { type: "drag-node", enableDelegate: true }],
    },
    defaultNode: {
      labelCfg: {
        position: "bottom",
        style: { fill: "#eaf4ff", fontSize: 12, opacity: 0.9 },
      },
    },
    defaultEdge: {
      type: "polyline",
      labelCfg: {
        autoRotate: true,
        style: { fill: "#94a3b8", fontSize: 10 },
      },
      style: { endArrow: true },
    },
    animate: true,
  });

  adminG6Graph.data({ nodes, edges });
  adminG6Graph.on("node:click", (evt) => {
    const item = evt.item;
    if (!item) return;
    const id = item.getID();
    const rawNode = nodesRaw.find((n) => n.key === id);
    if (rawNode && rawNode.label === "Topic") {
      if (expandedTopics.has(id)) expandedTopics.delete(id);
      else expandedTopics.add(id);
      renderAdminGraph();
      return;
    }
    handleGraphNodeSelection(id);
  });
  adminG6Graph.render();
  adminG6Graph.fitView(20);
}

async function refreshAdminGraph() {
