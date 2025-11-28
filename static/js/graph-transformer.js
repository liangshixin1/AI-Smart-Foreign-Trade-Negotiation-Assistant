;(function (global) {
  function makeNode(raw) {
    return {
      id: raw.key || raw.id || raw.name,
      key: raw.key || raw.id || raw.name,
      name: raw.title || raw.name || raw.key,
      type: raw.label || raw.nodeType,
      order: raw.order || 0,
      stage: raw.stage || raw.stageName,
      topic: raw.topic || raw.topicName,
      children: [],
    };
  }

  function transformToTree(network) {
    const nodes = network && Array.isArray(network.nodes) ? network.nodes : [];
    const edges = network && Array.isArray(network.edges) ? network.edges : [];

    const nodeMap = new Map();
    nodes.forEach((n) => nodeMap.set(n.key, makeNode(n)));

    const stages = [];
    const topics = new Map();
    const points = new Map();

    nodes.forEach((n) => {
      const mapped = nodeMap.get(n.key);
      if (!mapped) return;
      if (n.label === "Stage") {
        stages.push(mapped);
      } else if (n.label === "Topic") {
        topics.set(n.key, mapped);
      } else if (n.label === "KnowledgePoint" || n.label === "Skill" || n.label === "Terminology") {
        points.set(n.key, mapped);
      }
    });

    const src = (e) => e.source || e.from;
    const tgt = (e) => e.target || e.to;

    // Stage -> Topic
    edges.forEach((e) => {
      if (e.type !== "CONTAIN_TOPIC") return;
      const stage = nodeMap.get(src(e));
      const topic = topics.get(tgt(e));
      if (stage && topic) {
        stage.children.push(topic);
      }
    });

    // Topic -> Point
    edges.forEach((e) => {
      if (e.type !== "INCLUDE_POINT" && e.type !== "HAS_TOPIC") return;
      const topic = topics.get(src(e));
      const point = points.get(tgt(e));
      if (topic && point) {
        topic.children.push(point);
      }
    });

    // Fallback: attach by stage/topic props when edges missing
    topics.forEach((t) => {
      if (t.children.length === 0) {
        points.forEach((p) => {
          if (p.topic && (p.topic === t.name || p.topic === t.key)) {
            t.children.push(p);
          } else if (p.stage && (p.stage === t.stage || p.stage === t.stageName)) {
            t.children.push(p);
          }
        });
      }
    });
    if (stages.every((s) => s.children.length === 0)) {
      topics.forEach((t) => {
        const stageName = t.stage || t.stageName || (t.key || "").split(":")[1];
        const stage = stages.find((s) => s.name === stageName || s.key === `Stage:${stageName}`);
        if (stage) stage.children.push(t);
      });
    }

    // 排序与折叠
    stages.sort((a, b) => a.order - b.order || (a.name || "").localeCompare(b.name || ""));
    topics.forEach((t) => {
      t.children.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      t.collapsed = true; // 默认折叠知识点
    });
    stages.forEach((s) => {
      s.children.sort((a, b) => (a.order || 0) - (b.order || 0));
      s.collapsed = false;
    });

    // 若仍无 Stage/Topic，退化为单节点集合
    const children = stages.length > 0 ? stages : Array.from(topics.values());
    const rootChildren = children.length > 0 ? children : Array.from(points.values());

    return {
      id: "root",
      name: "root",
      collapsed: false,
      children: rootChildren,
    };
  }

  global.GraphTransformer = {
    transformToTree,
  };
})(window);
