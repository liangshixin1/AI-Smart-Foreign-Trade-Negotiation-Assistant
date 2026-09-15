/* [组件导读]
 * 业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
 * 用途：定义 Cytoscape 图形样式与各类高亮的视觉规则。
 * 为什么与边界：集中维护节点类型和证据状态的颜色，确保不同页面上的相同标记含义一致。
 * 结构：先看导出的类型或函数，再沿其调用的 API、工具与返回状态理解数据流。
 * [/组件导读] */
import type cytoscape from 'cytoscape'

/**
 * 知识图谱的视觉语义集中在此处，避免画布组件同时承担交互与样式职责。
 * 全景模式默认弱化关系线，仅在用户沿层级探索时突出完整关系链。
 */
export const knowledgeGraphStylesheet: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      label: '',
      width: 24,
      height: 24,
      'font-size': 10,
      'font-family': 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      'text-wrap': 'wrap',
      'text-max-width': '88px',
      'text-valign': 'bottom',
      'text-margin-y': 7,
      'background-color': '#76918a',
      'border-color': '#ffffff',
      'border-width': 2,
      color: '#22312b',
      'transition-property': 'opacity, background-color, border-width, width, height',
      'transition-duration': 220,
      'z-index': 10,
      'z-index-compare': 'manual',
      'text-events': 'yes',
    },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="teaching"]',
    style: {
      label: 'data(label)',
      shape: 'round-rectangle',
      'background-color': '#e8f2ee',
      'background-opacity': 0.78,
      'border-color': '#9bbfb0',
      'border-width': 1.4,
      padding: '36px',
      color: '#103f36',
      'font-size': 22,
      'font-weight': 800,
      'text-valign': 'top',
      'text-halign': 'left',
      'text-margin-x': 12,
      'text-margin-y': 14,
      'text-max-width': '250px',
      width: 520,
      height: 360,
      events: 'no',
      'text-events': 'no',
      'z-index': 0,
    },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="panorama"]',
    style: {
      label: 'data(label)',
      'background-color': '#0f5961',
      width: 96,
      height: 42,
      shape: 'round-rectangle',
      color: '#ffffff',
      'font-size': 11.5,
      'font-weight': 800,
      'text-valign': 'center',
      'text-margin-y': 0,
      'text-max-width': '86px',
      'border-color': '#d6ebe3',
      'border-width': 3,
    },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="context"]',
    style: {
      label: 'data(label)',
      'background-color': '#0f5961',
      width: 78,
      height: 36,
      shape: 'round-rectangle',
      color: '#ffffff',
      'font-size': 11,
      'font-weight': 800,
      'text-valign': 'center',
      'text-margin-y': 0,
      'text-max-width': '70px',
    },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="teaching"][focusedView="yes"]',
    style: { width: 760, height: 480 },
  },
  {
    selector: 'node[nodeType="phenomenon"]',
    style: {
      label: 'data(label)',
      'background-color': '#d8a64d',
      width: 38,
      height: 38,
      'font-size': 12.5,
      'font-weight': 700,
      'text-max-width': '98px',
    },
  },
  { selector: 'node[nodeType="phenomenon"][viewMode="panorama"]', style: { label: '' } },
  {
    selector: 'node[nodeType="scenario"]',
    style: {
      label: 'data(label)',
      'background-color': '#6f5aa8',
      width: 52,
      height: 34,
      shape: 'round-rectangle',
      'text-valign': 'top',
      'text-margin-y': -8,
      'font-weight': 700,
    },
  },
  {
    selector: 'node[viewMode="context"]',
    style: {
      label: 'data(label)',
      'font-size': 10.5,
      'text-max-width': '104px',
      'text-background-color': '#f7faf8',
      'text-background-opacity': 0.86,
      'text-background-padding': '2px',
    },
  },
  {
    selector: 'node[nodeType="scenario"][viewMode="context"]',
    style: { width: 62, height: 34, 'text-valign': 'bottom', 'text-margin-y': 7 },
  },
  {
    selector: 'node[nodeType="knowledge_point"]',
    style: {
      'background-color': '#6f8796',
      'border-color': '#3f7cac',
      width: 21,
      height: 21,
    },
  },
  { selector: 'node[nodeType="knowledge_resource"]', style: { 'background-color': '#6f8796' } },
  {
    selector: 'node[nodeType="strategy"], node[knowledgeType="Strategy"]',
    style: { 'background-color': '#2c7960', 'border-color': '#176b4d' },
  },
  { selector: 'node[knowledgeType="Correspondence"]', style: { 'border-color': '#7b61a8' } },
  { selector: 'node[knowledgeType="Cross-cultural"]', style: { 'border-color': '#a85f7b' } },
  { selector: 'node[knowledgeType="Legal"]', style: { 'border-color': '#315b7d' } },
  { selector: 'node[knowledgeType="Procedure"]', style: { 'border-color': '#2b8a83' } },
  { selector: 'node[knowledgeType="Risk"]', style: { 'border-color': '#b36b35' } },
  { selector: 'node[sharedCount > 1]', style: { 'border-width': 4, 'border-style': 'double' } },
  { selector: 'node[sharedCount = 2]', style: { width: 26, height: 26 } },
  { selector: 'node[sharedCount = 3]', style: { width: 29, height: 29 } },
  { selector: 'node[sharedCount >= 4]', style: { width: 33, height: 33 } },
  {
    selector: 'node[overlayAudience="student"][learningState="encountered"]',
    style: { 'border-color': '#4f91b5', 'border-width': 3 },
  },
  {
    selector: 'node[overlayAudience="student"][learningState="developing"]',
    style: { 'border-color': '#d39a31', 'border-width': 4 },
  },
  {
    selector: 'node[overlayAudience="student"][learningState="stable"]',
    style: { 'border-color': '#1d805f', 'border-width': 5 },
  },
  {
    selector: 'node[overlayAudience="student"][learningState="review"]',
    style: { 'border-color': '#bf625b', 'border-width': 5 },
  },
  {
    selector: 'node[overlayAudience="teacher"][score >= 0][score < 70]',
    style: { 'background-color': '#c66d63', 'border-color': '#9e463f' },
  },
  {
    selector: 'node[overlayAudience="teacher"][score >= 70][score < 82]',
    style: { 'background-color': '#d8a64d', 'border-color': '#b47c1d' },
  },
  {
    selector: 'node[overlayAudience="teacher"][score >= 82]',
    style: { 'background-color': '#3c9475', 'border-color': '#1d6d53' },
  },
  {
    selector:
      'node[nodeType="phenomenon"][overlayAudience="teacher"][overlaySize="medium"], node[nodeType="knowledge_point"][overlayAudience="teacher"][overlaySize="medium"], node[nodeType="knowledge_resource"][overlayAudience="teacher"][overlaySize="medium"], node[nodeType="strategy"][overlayAudience="teacher"][overlaySize="medium"]',
    style: { width: 32, height: 32 },
  },
  {
    selector:
      'node[nodeType="phenomenon"][overlayAudience="teacher"][overlaySize="large"], node[nodeType="knowledge_point"][overlayAudience="teacher"][overlaySize="large"], node[nodeType="knowledge_resource"][overlayAudience="teacher"][overlaySize="large"], node[nodeType="strategy"][overlayAudience="teacher"][overlaySize="large"]',
    style: { width: 40, height: 40 },
  },
  {
    selector: 'node[overlayEmphasis="history"]',
    style: { opacity: 0.54 },
  },
  {
    selector: 'node[overlayEmphasis="current_round"]',
    style: {
      'border-color': '#f1a72c',
      'border-width': 6,
      'overlay-color': '#f4bf5a',
      'overlay-opacity': 0.1,
      'overlay-padding': 7,
      'z-index': 24,
    },
  },
  {
    selector: 'node[overlayPhase="briefing"][overlayEmphasis="baseline"]',
    style: { opacity: 0.1 },
  },
  {
    selector: 'node[overlayPhase="briefing"][overlayEmphasis="current_round"]',
    style: { label: 'data(label)', opacity: 1 },
  },
  {
    selector: 'node[overlayPhase="briefing"][learningState="review"]',
    style: { 'border-color': '#bf625b', 'border-style': 'double', 'border-width': 7 },
  },
  {
    selector: 'edge[overlayPhase="briefing"][overlayEmphasis="baseline"]',
    style: { opacity: 0.012 },
  },
  {
    selector: 'node[overlayPhase="compass"]',
    style: { width: 8, height: 8, opacity: 0.16, 'border-width': 0, label: '' },
  },
  {
    selector: 'node[overlayPhase="compass"][nodeType="phenomenon"]',
    style: { width: 11, height: 11 },
  },
  {
    selector: 'node[overlayPhase="compass"][nodeType="stage"]',
    style: {
      label: 'data(stageSequenceLabel)',
      width: 76,
      height: 30,
      opacity: 0.52,
      'border-width': 2,
      'font-size': 8.5,
      'text-max-width': '68px',
    },
  },
  {
    selector: 'edge[overlayPhase="compass"]',
    style: { opacity: 0, width: 0.5, label: '' },
  },
  {
    selector: 'node[overlayPhase="compass"][overlayEmphasis="history"]',
    style: { opacity: 0.44, width: 11, height: 11 },
  },
  {
    selector: 'node[overlayPhase="compass"][overlayEmphasis="current_round"]',
    style: {
      label: 'data(label)',
      width: 27,
      height: 27,
      opacity: 1,
      'border-width': 4,
      'font-size': 10,
      'text-max-width': '82px',
    },
  },
  {
    selector: 'node[overlayPhase="compass"][nodeType="stage"][overlayEmphasis="current_round"]',
    style: { label: 'data(label)', width: 90, height: 38, 'font-size': 10.5 },
  },
  {
    selector: 'edge[overlayPhase="compass"][overlayEmphasis="current_round"]',
    style: { opacity: 0.9, width: 2.4 },
  },
  {
    selector: 'node[overlayPhase="replay"][overlayEmphasis="baseline"]',
    style: { opacity: 0.08 },
  },
  {
    selector: 'node[overlayPhase="replay"][overlayEmphasis="current_round"]',
    style: { label: 'data(label)', opacity: 1 },
  },
  {
    selector: 'edge[overlayPhase="replay"][overlayEmphasis="baseline"]',
    style: { opacity: 0.01 },
  },
  {
    selector:
      'node[overlayPhase="profile"][evidenceCount = 0], node[overlayPhase="teacher"][evidenceCount = 0]',
    style: { opacity: 0.07 },
  },
  {
    selector:
      'edge[overlayPhase="profile"][overlayEmphasis="baseline"], edge[overlayPhase="teacher"][overlayEmphasis="baseline"]',
    style: { opacity: 0.012 },
  },
  {
    selector:
      'node[overlayPhase="profile"][overlayEmphasis="current_round"], node[overlayPhase="teacher"][overlayEmphasis="current_round"]',
    style: { label: 'data(label)', opacity: 1 },
  },
  {
    selector: 'node[applicationState="applied_correctly"]',
    style: { 'background-color': '#2f9270', 'border-color': '#17684e' },
  },
  {
    selector: 'node[applicationState="applied_partially"]',
    style: { 'background-color': '#d6a243', 'border-color': '#a87518' },
  },
  {
    selector: 'node[applicationState="misapplied"]',
    style: { 'background-color': '#b96675', 'border-color': '#8f354a' },
  },
  {
    selector: 'node[applicationState="recalled_unused"]',
    style: { 'background-color': '#e2b354', 'border-color': '#9a721e', 'border-style': 'dashed' },
  },
  {
    selector: 'node[applicationState="missed_required"]',
    style: {
      'background-color': '#fff4f2',
      'border-color': '#c34f47',
      'border-style': 'dashed',
      'border-width': 5,
    },
  },
  {
    selector: 'node.is-newly-emphasized',
    style: {
      'overlay-color': '#f0a023',
      'overlay-opacity': 0.28,
      'overlay-padding': 14,
    },
  },
  {
    selector: 'node.show-label, node.is-hovered, node.is-focused, node.is-related',
    style: { label: 'data(label)' },
  },
  {
    selector: 'edge',
    style: {
      width: 0.9,
      label: '',
      'font-size': 8,
      color: '#5e6f68',
      'line-color': '#b8c6c0',
      'target-arrow-color': '#9eaaa4',
      'target-arrow-shape': 'none',
      'curve-style': 'bezier',
      opacity: 0.2,
      'text-background-color': '#ffffff',
      'text-background-opacity': 0.92,
      'text-background-padding': '2px',
      'transition-property': 'opacity, width, line-color',
      'transition-duration': 180,
      events: 'no',
    },
  },
  {
    selector: 'edge[viewMode="teaching"][crossStage="yes"]',
    style: { opacity: 0.035, 'line-style': 'dashed' },
  },
  {
    selector: 'edge[edgeType="CONTAINS_PHENOMENON"], edge[edgeType="CONTAINS_SCENARIO"]',
    style: { opacity: 0 },
  },
  { selector: 'edge[viewMode="panorama"]', style: { opacity: 0.025, width: 0.7 } },
  {
    selector: 'edge[viewMode="context"]',
    style: {
      opacity: 0.16,
      width: 1.2,
      'target-arrow-shape': 'triangle',
      'target-arrow-color': '#aebdb6',
    },
  },
  {
    selector: 'edge[viewMode="panorama"][edgeType="CONTAINS_PHENOMENON"]',
    style: { opacity: 0.1, width: 0.85, 'line-color': '#b9cfc6' },
  },
  {
    selector: 'edge[viewMode="panorama"][sharedEdge="yes"]',
    style: {
      opacity: 0.018,
      'curve-style': 'unbundled-bezier',
      'control-point-distances': 'data(curveDistance)',
      'control-point-weights': 0.5,
    },
  },
  {
    selector: 'edge[edgeType="STAGE_FLOW"]',
    style: {
      width: 2.4,
      opacity: 0.64,
      'line-color': '#78a696',
      'target-arrow-color': '#78a696',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
    },
  },
  {
    selector: 'edge.is-related',
    style: {
      width: 2.1,
      label: 'data(label)',
      opacity: 0.9,
      'line-color': '#3d7f6b',
      'target-arrow-color': '#3d7f6b',
      'target-arrow-shape': 'triangle',
      'z-index': 20,
    },
  },
  {
    selector: 'edge[overlayEmphasis="history"]',
    style: { opacity: 0.34, width: 1.4, 'line-color': '#8da69d' },
  },
  {
    selector: 'edge[overlayEmphasis="current_round"]',
    style: {
      opacity: 0.95,
      width: 2.8,
      'line-color': '#d88e19',
      'target-arrow-color': '#d88e19',
      'target-arrow-shape': 'triangle',
      'z-index': 22,
    },
  },
  { selector: 'node.is-dimmed, edge.is-dimmed', style: { opacity: 0.08 } },
  {
    selector: 'node.is-focused',
    style: {
      'border-width': 5,
      'border-color': '#142820',
      width: 48,
      height: 48,
      'z-index': 30,
    },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="teaching"].is-focused',
    style: { 'border-width': 3, width: 520, height: 360 },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="panorama"].is-focused',
    style: { 'border-width': 5, width: 108, height: 48 },
  },
  {
    selector: 'node[nodeType="stage"][viewMode="teaching"][focusedView="yes"].is-focused',
    style: { width: 760, height: 480 },
  },
]
