// 知识点管理模块
// 提供完整的CRUD、搜索、过滤、Excel导入导出功能

// ========== 状态管理 ==========
const graphKnowledgeState = {
  allKnowledgePoints: [],
  filteredKnowledgePoints: [],
  categories: [],
  categoryTree: [],
  stats: { total: 0, categories: 0, difficulty: {} },
  smartAssist: { uncategorized: [], metadataSuggestions: [] },
  currentEditingPoint: null,
  activeCategoryKey: '',
  filters: {
    search: '',
    category: '',
    difficulty: ''
  }
};

let draggedKnowledgeName = null;

// ========== API调用函数 ==========

// 获取所有知识点列表（支持过滤）
async function fetchKnowledgePoints() {
  try {
    const response = await fetchWithAuth('/api/graph/knowledge-points/overview');

    if (!response.ok) {
      throw new Error(`获取知识点失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取知识点失败:', error);
    showStatus('admin-graph-category-status', `获取知识点失败: ${error.message}`, 'error');
    return { knowledge_points: [], category_tree: [], category_paths: [], stats: {}, knowledge_cards: [] };
  }
}

// 获取单个知识点详情
async function fetchKnowledgePoint(name) {
  try {
    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}`);

    if (!response.ok) {
      throw new Error(`获取知识点详情失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取知识点详情失败:', error);
    showStatus('admin-graph-form-status', `获取知识点详情失败: ${error.message}`, 'error');
    return null;
  }
}

// 创建新知识点
async function createKnowledgePoint(data) {
  try {
    const response = await fetchWithAuth('/api/graph/knowledge-points', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `创建知识点失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('创建知识点失败:', error);
    throw error;
  }
}

// 更新知识点
async function updateKnowledgePoint(name, data) {
  try {
    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `更新知识点失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('更新知识点失败:', error);
    throw error;
  }
}

// 删除知识点
async function deleteKnowledgePoint(name) {
  try {
    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`删除知识点失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('删除知识点失败:', error);
    throw error;
  }
}

// 添加前置依赖
async function addPrerequisite(knowledgePointName, prerequisiteName) {
  try {
    const response = await fetchWithAuth(
      `/api/graph/knowledge-points/${encodeURIComponent(knowledgePointName)}/prerequisites`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prerequisite_name: prerequisiteName })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '添加前置依赖失败');
    }

    return await response.json();
  } catch (error) {
    console.error('添加前置依赖失败:', error);
    throw error;
  }
}

// 添加关联关系
async function addRelation(knowledgePointName, relatedName, relationshipType = 'RELATED_TO') {
  try {
    const response = await fetchWithAuth(
      `/api/graph/knowledge-points/${encodeURIComponent(knowledgePointName)}/relations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          related_name: relatedName,
          relationship_type: relationshipType
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '添加关联失败');
    }

    return await response.json();
  } catch (error) {
    console.error('添加关联失败:', error);
    throw error;
  }
}

// 获取分类列表
async function fetchCategories() {
  try {
    const response = await fetchWithAuth('/api/graph/categories');

    if (!response.ok) {
      throw new Error(`获取分类失败: ${response.status}`);
    }

    const data = await response.json();
    return data.categories || [];
  } catch (error) {
    console.error('获取分类失败:', error);
    return [];
  }
}

// Excel导入
async function importExcelFile(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetchWithAuth('/api/graph/import/excel', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `导入失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('导入Excel失败:', error);
    throw error;
  }
}

// Excel导出
async function exportToExcel() {
  try {
    const response = await fetchWithAuth('/api/graph/export/excel');

    if (!response.ok) {
      throw new Error(`导出失败: ${response.status}`);
    }

    // 下载文件
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge_points_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true };
  } catch (error) {
    console.error('导出Excel失败:', error);
    throw error;
  }
}

// ========== UI渲染函数 ==========

// 渲染知识点列表
function renderKnowledgePointsList() {
  const listEl = document.getElementById('admin-graph-points-list');
  const emptyEl = document.getElementById('admin-graph-points-empty');

  if (!listEl) return;

  const points = graphKnowledgeState.filteredKnowledgePoints;

  if (points.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');

  const difficultyColors = {
    beginner: 'text-emerald-300',
    intermediate: 'text-amber-300',
    advanced: 'text-rose-300'
  };
  const difficultyLabels = {
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级'
  };

  listEl.innerHTML = points
    .map((point) => {
      const isSelected = graphKnowledgeState.currentEditingPoint?.name === point.name;
      const categoryText = point.category_path_text || '未分类';
      const tagChips = Array.isArray(point.tags)
        ? point.tags.slice(0, 4).map((tag) => `<span class="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">${escapeHtml(tag)}</span>`).join('')
        : '';
      const remainingTags = Array.isArray(point.tags) && point.tags.length > 4 ? `<span class="text-[11px] px-2 py-0.5 text-slate-500">+${point.tags.length - 4}</span>` : '';

      return `
        <li
          class="group relative cursor-pointer rounded-lg border ${isSelected ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 hover:border-slate-600'} p-3 transition"
          data-knowledge-name="${escapeHtml(point.name)}"
          draggable="true"
          onclick="handleKnowledgePointClick('${escapeHtml(point.name)}')"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <h4 class="truncate text-sm font-medium text-white">${escapeHtml(point.name)}</h4>
              ${point.description ? `<p class="mt-1 text-xs text-slate-400 line-clamp-2">${escapeHtml(point.description)}</p>` : ''}
            </div>
            <div class="flex flex-col items-end gap-1">
              ${point.difficulty ? `<span class="text-xs ${difficultyColors[point.difficulty] || 'text-slate-400'}">${difficultyLabels[point.difficulty] || point.difficulty}</span>` : ''}
              <span class="text-[11px] text-slate-500">${escapeHtml(categoryText)}</span>
            </div>
          </div>
          ${(tagChips || remainingTags)
            ? `<div class="mt-2 flex flex-wrap gap-1">${tagChips}${remainingTags}</div>`
            : ''}
          <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>关卡 ${point.practiceCount || 0} · 理论 ${point.lessonCount || 0}</span>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-0.5 text-[11px] text-slate-300 transition hover:border-sky-400 hover:text-sky-200"
                data-knowledge-insert="${escapeHtml(point.name)}"
              >
                插入理论
              </button>
              <span class="hidden text-slate-600 group-hover:block">拖拽调整分类</span>
            </div>
          </div>
        </li>
      `;
    })
    .join('');

  attachKnowledgeListHandlers();
}

// 渲染分类下拉列表
function renderCategoryOptions() {
  const filterSelect = document.getElementById('admin-graph-filter-category');
  const formSelect = document.getElementById('admin-graph-form-category');

  const categories = graphKnowledgeState.categories;
  const optionsHTML = categories
    .map((cat) => {
      const label = cat === '未分类' ? '未分类' : cat.replace(/\//g, ' / ');
      return `<option value="${escapeHtml(cat)}">${escapeHtml(label)}</option>`;
    })
    .join('');

  if (filterSelect) {
    const currentValue = graphKnowledgeState.filters.category || filterSelect.value;
    filterSelect.innerHTML = '<option value="">全部分类</option>' + optionsHTML;
    filterSelect.value = currentValue;
  }

  if (formSelect) {
    const currentValue = graphKnowledgeState.activeCategoryKey || formSelect.value;
    formSelect.innerHTML = '<option value="">未分类</option>' + optionsHTML;
    formSelect.value = currentValue;
  }
}

function buildCategoryTreeHtml(nodes, depth = 0) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }

  const difficultyBadges = {
    beginner: 'bg-emerald-500/20 text-emerald-200',
    intermediate: 'bg-amber-500/20 text-amber-200',
    advanced: 'bg-rose-500/20 text-rose-200'
  };

  return nodes
    .map((node) => {
      const pathKey = Array.isArray(node.path) && node.path.length > 0 ? node.path.join('/') : '未分类';
      const isActive = graphKnowledgeState.activeCategoryKey === pathKey;
      const indent = depth * 12;
      const knowledgePreview = Array.isArray(node.knowledge) ? node.knowledge.slice(0, 5) : [];
      const knowledgeHtml = knowledgePreview.length
        ? `<div class="mt-2 flex flex-wrap gap-1">${knowledgePreview
            .map((item) => {
              const diffClass = difficultyBadges[item.difficulty] || 'bg-slate-800 text-slate-300';
              return `<span class="inline-flex items-center gap-1 rounded-full ${diffClass} px-2 py-0.5 text-[10px]">${escapeHtml(item.name)}</span>`;
            })
            .join('')}${node.knowledge && node.knowledge.length > knowledgePreview.length ? `<span class="text-[10px] text-slate-500">+${node.knowledge.length - knowledgePreview.length}</span>` : ''}</div>`
        : '';
      const childHtml = buildCategoryTreeHtml(node.children || [], depth + 1);
      const baseClasses = isActive
        ? 'border-sky-500/70 bg-sky-500/10 text-sky-200'
        : 'border-slate-800 bg-slate-900/60 text-slate-200 hover:border-slate-600';

      return `
        <div class="space-y-2" style="margin-left:${indent}px">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition ${baseClasses}"
            data-category-path="${escapeHtml(pathKey)}"
            data-drop-target="category"
          >
            <span class="flex items-center gap-2">
              <span class="inline-flex h-5 min-w-[22px] items-center justify-center rounded bg-slate-800 text-[10px] text-slate-400">${Array.isArray(node.path) ? node.path.length : 0}</span>
              ${escapeHtml(node.name || '未分类')}
            </span>
            <span class="rounded-full bg-slate-800 px-2 text-[10px] text-slate-300">${node.count || 0}</span>
          </button>
          ${knowledgeHtml}
        </div>
        ${childHtml}
      `;
    })
    .join('');
}

function renderCategoryTree() {
  const container = document.getElementById('admin-graph-category-tree');
  if (!container) return;

  const tree = graphKnowledgeState.categoryTree;
  if (!Array.isArray(tree) || tree.length === 0) {
    container.innerHTML = '<p class="text-[11px] text-slate-500">暂无分类结构，可通过创建知识点后再拖拽整理。</p>';
    return;
  }

  container.innerHTML = buildCategoryTreeHtml(tree);

  const nodes = container.querySelectorAll('[data-category-path]');
  nodes.forEach((button) => {
    button.addEventListener('click', handleCategoryNodeClick);
    button.addEventListener('dragover', handleCategoryDragOver);
    button.addEventListener('dragleave', handleCategoryDragLeave);
    button.addEventListener('drop', handleCategoryDrop);
  });
}

function renderKnowledgeStats() {
  const stats = graphKnowledgeState.stats || {};
  const totalEl = document.getElementById('admin-graph-stats-total');
  const categoriesEl = document.getElementById('admin-graph-stats-categories');
  const difficultyEl = document.getElementById('admin-graph-stats-difficulty');
  const uncategorizedEl = document.getElementById('admin-graph-stats-uncategorized');
  const unlinkedEl = document.getElementById('admin-graph-stats-unlinked');

  if (totalEl) {
    totalEl.textContent = String(stats.total ?? 0);
  }
  if (categoriesEl) {
    categoriesEl.textContent = String(stats.categories ?? 0);
  }
  if (uncategorizedEl) {
    uncategorizedEl.textContent = String(stats.uncategorized ?? 0);
  }
  if (unlinkedEl) {
    unlinkedEl.textContent = String(stats.unlinked ?? 0);
  }
  if (difficultyEl) {
    const diffStats = stats.difficulty || {};
    const labels = { beginner: '初级', intermediate: '中级', advanced: '高级' };
    const order = ['beginner', 'intermediate', 'advanced'];
    const html = order
      .map((key) => {
        const count = diffStats[key] || 0;
        return `<div class="flex items-center justify-between text-[11px]"><span>${labels[key]}</span><span>${count}</span></div>`;
      })
      .join('');
    difficultyEl.innerHTML = html || '<p class="text-[11px] text-slate-500">暂无数据</p>';
  }
}

function renderSmartAssist() {
  const container = document.getElementById('admin-graph-smart-assist-list');
  const emptyState = document.getElementById('admin-graph-smart-assist-empty');
  if (!container) return;

  const assist = graphKnowledgeState.smartAssist || {};
  const uncategorized = Array.isArray(assist.uncategorized) ? assist.uncategorized : [];
  const metadataSuggestions = Array.isArray(assist.metadataSuggestions) ? assist.metadataSuggestions : [];

  const sections = [];

  if (uncategorized.length > 0) {
    const chips = uncategorized
      .slice(0, 6)
      .map((item) => {
        const usage = (item.practiceCount || 0) + (item.lessonCount || 0);
        const usageLabel = usage > 0 ? `${usage} 个引用` : '尚未引用';
        return `
          <span class="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            ${escapeHtml(item.name)}
            <span class="text-amber-200/80">${escapeHtml(usageLabel)}</span>
          </span>
        `;
      })
      .join('');
    sections.push(`
      <div class="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="text-xs font-semibold text-amber-200">待分类知识点</h4>
            <p class="text-[11px] text-amber-100/80">拖拽或使用快捷筛选，快速整理知识树。</p>
          </div>
          <button type="button" class="rounded-lg border border-amber-400/60 px-2 py-0.5 text-[11px] text-amber-100 hover:border-amber-200" data-assist-filter="uncategorized">
            筛选查看
          </button>
        </div>
        <div class="flex flex-wrap gap-2">${chips}</div>
      </div>
    `);
  }

  if (metadataSuggestions.length > 0) {
    const cards = metadataSuggestions
      .map((item) => {
        const tags = Array.isArray(item.preview?.tags)
          ? item.preview.tags
              .map(
                (tag) => `<span class="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] text-sky-200">${escapeHtml(tag)}</span>`
              )
              .join('')
          : '';
        const summary = item.preview?.description
          ? `<p class="text-[11px] text-slate-300/80 line-clamp-2">${escapeHtml(item.preview.description)}</p>`
          : '';
        return `
          <div class="space-y-2 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3">
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="text-xs font-semibold text-sky-200">${escapeHtml(item.name)}</h4>
                <p class="text-[11px] text-slate-300/70">${escapeHtml(item.reason || '自动补全')}</p>
              </div>
              <button type="button" class="rounded-lg border border-sky-400 px-2 py-0.5 text-[11px] text-sky-100 hover:border-sky-200" data-assist-metadata="${escapeHtml(item.name)}">
                一键补全
              </button>
            </div>
            ${summary}
            ${tags ? `<div class="flex flex-wrap gap-1">${tags}</div>` : ''}
          </div>
        `;
      })
      .join('');
    sections.push(cards);
  }

  if (sections.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  container.innerHTML = sections.join('');

  container.querySelectorAll('[data-assist-filter="uncategorized"]').forEach((button) => {
    button.addEventListener('click', handleAssistFilterUncategorized);
  });
  container.querySelectorAll('[data-assist-metadata]').forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.assistMetadata;
      if (name) {
        handleAssistMetadataApply(name);
      }
    });
  });
}

function attachKnowledgeListHandlers() {
  const listEl = document.getElementById('admin-graph-points-list');
  if (!listEl) return;

  listEl.querySelectorAll('[data-knowledge-insert]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const name = button.dataset.knowledgeInsert;
      handleKnowledgeInsertFromList(name);
    });
  });

  listEl.querySelectorAll('li[data-knowledge-name]').forEach((item) => {
    item.addEventListener('dragstart', handleKnowledgeDragStart);
    item.addEventListener('dragend', handleKnowledgeDragEnd);
  });
}

function handleKnowledgeDragStart(event) {
  const item = event.currentTarget;
  if (!item) return;
  draggedKnowledgeName = item.dataset.knowledgeName || '';
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedKnowledgeName);
  }
  item.classList.add('opacity-70');
}

function handleKnowledgeDragEnd(event) {
  const item = event.currentTarget;
  if (item) {
    item.classList.remove('opacity-70');
  }
  draggedKnowledgeName = null;
  clearCategoryDropHighlight();
}

function clearCategoryDropHighlight() {
  document.querySelectorAll('[data-drop-target="category"]').forEach((node) => {
    node.classList.remove('border-sky-400', 'text-sky-200');
  });
}

function handleCategoryDragOver(event) {
  if (!draggedKnowledgeName) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
  event.currentTarget.classList.add('border-sky-400', 'text-sky-200');
}

function handleCategoryDragLeave(event) {
  event.currentTarget.classList.remove('border-sky-400', 'text-sky-200');
}

function handleCategoryDrop(event) {
  if (!draggedKnowledgeName) return;
  event.preventDefault();
  const target = event.currentTarget;
  target.classList.remove('border-sky-400', 'text-sky-200');
  const pathKey = target.dataset.categoryPath || '';
  const knowledgeName = draggedKnowledgeName;
  draggedKnowledgeName = null;
  moveKnowledgeToCategory(knowledgeName, pathKey);
}

function handleCategoryNodeClick(event) {
  event.preventDefault();
  const button = event.currentTarget;
  const pathKey = button.dataset.categoryPath || '';

  if (graphKnowledgeState.activeCategoryKey === pathKey) {
    graphKnowledgeState.activeCategoryKey = '';
    graphKnowledgeState.filters.category = '';
  } else {
    graphKnowledgeState.activeCategoryKey = pathKey;
    graphKnowledgeState.filters.category = pathKey;
  }

  const filterSelect = document.getElementById('admin-graph-filter-category');
  if (filterSelect) {
    filterSelect.value = graphKnowledgeState.filters.category;
  }

  applyKnowledgeFilters();
  renderCategoryTree();
}

function handleKnowledgeInsertFromList(name) {
  if (!name || typeof window === 'undefined' || typeof window.openKnowledgeCardModal !== 'function') {
    return;
  }
  const records =
    state.admin &&
    state.admin.graph &&
    Array.isArray(state.admin.graph.knowledgePoints)
      ? state.admin.graph.knowledgePoints
      : [];
  const matched = records.find((item) => item.name === name);
  const payload = matched
    ? {
        name: matched.name,
        summary: matched.summary || '',
        bodyHtml: matched.bodyHtml || '',
        imageUrl: matched.imageUrl || '',
        imageAlt: matched.imageAlt || '',
        knowledgeId: matched.knowledgeId || '',
        tags: matched.tags || []
      }
    : { name };
  window.openKnowledgeCardModal(payload, null);
}

function applyKnowledgeFilters() {
  const searchValue = (graphKnowledgeState.filters.search || '').trim().toLowerCase();
  const difficultyValue = graphKnowledgeState.filters.difficulty || '';
  const categoryKey = graphKnowledgeState.activeCategoryKey || graphKnowledgeState.filters.category || '';

  graphKnowledgeState.filteredKnowledgePoints = graphKnowledgeState.allKnowledgePoints.filter((point) => {
    const name = point.name || '';
    const description = point.description || '';
    const tags = Array.isArray(point.tags) ? point.tags : [];

    if (searchValue) {
      const matchesSearch =
        name.toLowerCase().includes(searchValue) ||
        description.toLowerCase().includes(searchValue) ||
        tags.some((tag) => tag.toLowerCase().includes(searchValue));
      if (!matchesSearch) {
        return false;
      }
    }

    if (difficultyValue && point.difficulty !== difficultyValue) {
      return false;
    }

    if (categoryKey) {
      if (categoryKey === '未分类') {
        if (point.category_path_key && point.category_path_key !== '未分类') {
          return false;
        }
      } else if (point.category_path_key !== categoryKey) {
        return false;
      }
    }

    return true;
  });

  renderKnowledgePointsList();
}

async function moveKnowledgeToCategory(name, categoryPathKey, options = {}) {
  if (!name) return;

  const statusId = options.statusElementId || 'admin-graph-category-status';
  try {
    showStatus(statusId, `正在调整「${name}」的分类...`, 'info');

    const payload = {};
    if (categoryPathKey && categoryPathKey !== '未分类') {
      payload.category_path = categoryPathKey
        .split('/')
        .map((segment) => segment.trim())
        .filter((segment) => segment);
    } else {
      payload.category_path = [];
    }

    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(name)}/category`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `更新分类失败: ${response.status}`);
    }

    showStatus(statusId, '分类已更新', 'success');
    await loadKnowledgePoints();
  } catch (error) {
    console.error('更新分类失败:', error);
    showStatus(statusId, `分类更新失败: ${error.message}`, 'error');
  }
}

// 显示表单（编辑或新建）
function showForm(mode = 'create', point = null) {
  const form = document.getElementById('admin-graph-form');
  const emptyState = document.getElementById('admin-graph-form-empty');
  const formTitle = document.getElementById('admin-graph-form-title');
  const deleteBtn = document.getElementById('admin-graph-form-delete');
  const cancelBtn = document.getElementById('admin-graph-form-cancel');
  const modeInput = document.getElementById('admin-graph-form-mode');
  const originalNameInput = document.getElementById('admin-graph-form-original-name');

  if (emptyState) emptyState.style.display = 'none';
  if (form) form.style.display = 'block';

  if (formTitle) {
    formTitle.textContent = mode === 'create' ? '新建知识点' : '编辑知识点';
  }

  if (deleteBtn) {
    deleteBtn.classList.toggle('hidden', mode === 'create');
  }

  if (cancelBtn) {
    cancelBtn.classList.remove('hidden');
  }

  if (modeInput) modeInput.value = mode;

  // 填充表单数据
  if (point) {
    if (originalNameInput) originalNameInput.value = point.name;
    setFieldValue('admin-graph-form-name', point.name || '');
    const pathKey = Array.isArray(point.category_path) && point.category_path.length > 0
      ? point.category_path.join('/')
      : point.category_path_key || point.category || '';
    setFieldValue('admin-graph-form-category', pathKey || '');
    setFieldValue('admin-graph-form-description', point.description || '');
    setFieldValue('admin-graph-form-difficulty', point.difficulty || 'beginner');
    setFieldValue('admin-graph-form-importance', point.importance || 'medium');
    setFieldValue('admin-graph-form-duration', point.estimated_duration || '');
    setFieldValue('admin-graph-form-tags', point.tags ? point.tags.join(', ') : '');
    setFieldValue('admin-graph-form-content', point.content || '');

    // 渲染前置依赖和关联
    renderPrerequisites(point.prerequisites || []);
    renderRelations(point.relations || []);
  } else {
    // 重置表单
    resetForm();
    const categorySelect = document.getElementById('admin-graph-form-category');
    if (categorySelect) {
      categorySelect.value = graphKnowledgeState.activeCategoryKey || '';
    }
  }

  graphKnowledgeState.currentEditingPoint = point;
}

// 隐藏表单
function hideForm() {
  const form = document.getElementById('admin-graph-form');
  const emptyState = document.getElementById('admin-graph-form-empty');

  if (form) form.style.display = 'none';
  if (emptyState) emptyState.style.display = 'block';

  resetForm();
  graphKnowledgeState.currentEditingPoint = null;

  // 清除列表选中状态
  renderKnowledgePointsList();
}

// 重置表单
function resetForm() {
  const form = document.getElementById('admin-graph-form');
  if (form) form.reset();

  setFieldValue('admin-graph-form-mode', '');
  setFieldValue('admin-graph-form-original-name', '');

  renderPrerequisites([]);
  renderRelations([]);

  const categorySelect = document.getElementById('admin-graph-form-category');
  if (categorySelect) {
    categorySelect.value = graphKnowledgeState.activeCategoryKey || '';
  }
}

// 渲染前置依赖
function renderPrerequisites(prerequisites) {
  const container = document.getElementById('admin-graph-form-prerequisites');
  if (!container) return;

  if (prerequisites.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500">暂无前置依赖</p>';
    return;
  }

  container.innerHTML = prerequisites.map(prereq => `
    <span class="inline-flex items-center gap-1 rounded-lg border border-sky-500/50 bg-sky-500/10 px-2 py-1 text-xs text-sky-300">
      ${escapeHtml(prereq)}
      <button type="button" onclick="removePrerequisite('${escapeHtml(prereq)}')"
              class="ml-1 hover:text-sky-100">✕</button>
    </span>
  `).join('');
}

// 渲染关联知识点
function renderRelations(relations) {
  const container = document.getElementById('admin-graph-form-relations');
  if (!container) return;

  if (relations.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-500">暂无关联</p>';
    return;
  }

  container.innerHTML = relations.map(rel => `
    <span class="inline-flex items-center gap-1 rounded-lg border border-purple-500/50 bg-purple-500/10 px-2 py-1 text-xs text-purple-300">
      ${escapeHtml(rel)}
      <button type="button" onclick="removeRelation('${escapeHtml(rel)}')"
              class="ml-1 hover:text-purple-100">✕</button>
    </span>
  `).join('');
}

// ========== 事件处理函数 ==========

// 点击知识点列表项
async function handleKnowledgePointClick(name) {
  try {
    showStatus('admin-graph-form-status', '加载中...', 'info');
    const point = await fetchKnowledgePoint(name);

    if (point) {
      showForm('edit', point);
      showStatus('admin-graph-form-status', '', '');
    }
  } catch (error) {
    showStatus('admin-graph-form-status', `加载失败: ${error.message}`, 'error');
  }
}

// 新增知识点按钮
function handleAddKnowledgeClick() {
  showForm('create', null);
}

// 表单提交
async function handleFormSubmit(event) {
  event.preventDefault();

  const mode = document.getElementById('admin-graph-form-mode').value;
  const originalName = document.getElementById('admin-graph-form-original-name').value;

  const categoryRawValue = document.getElementById('admin-graph-form-category').value || '';
  const normalizedCategoryRaw = categoryRawValue === '未分类' ? '' : categoryRawValue;
  const categoryPath = normalizedCategoryRaw
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment);

  const data = {
    name: document.getElementById('admin-graph-form-name').value.trim(),
    category: categoryPath.length > 0 ? categoryPath[categoryPath.length - 1] : null,
    category_path: categoryPath,
    description: document.getElementById('admin-graph-form-description').value.trim() || null,
    difficulty: document.getElementById('admin-graph-form-difficulty').value,
    importance: document.getElementById('admin-graph-form-importance').value,
    estimated_duration: parseInt(document.getElementById('admin-graph-form-duration').value) || null,
    tags: document.getElementById('admin-graph-form-tags').value
      .split(',')
      .map(t => t.trim())
      .filter(t => t),
    content: document.getElementById('admin-graph-form-content').value.trim() || null
  };

  try {
    showStatus('admin-graph-form-status', '保存中...', 'info');

    if (mode === 'create') {
      await createKnowledgePoint(data);
      showStatus('admin-graph-form-status', '创建成功！', 'success');
    } else {
      await updateKnowledgePoint(originalName, data);
      showStatus('admin-graph-form-status', '更新成功！', 'success');
    }

    // 刷新列表
    await loadKnowledgePoints();

    // 如果是创建，切换到编辑模式
    if (mode === 'create') {
      const point = await fetchKnowledgePoint(data.name);
      if (point) {
        showForm('edit', point);
      }
    }

    setTimeout(() => {
      showStatus('admin-graph-form-status', '', '');
    }, 2000);
  } catch (error) {
    showStatus('admin-graph-form-status', `保存失败: ${error.message}`, 'error');
  }
}

// 删除知识点
async function handleDeleteClick() {
  const name = document.getElementById('admin-graph-form-original-name').value;

  if (!name) return;

  if (!confirm(`确定要删除知识点 "${name}" 吗？此操作不可恢复。`)) {
    return;
  }

  try {
    showStatus('admin-graph-form-status', '删除中...', 'info');
    await deleteKnowledgePoint(name);
    showStatus('admin-graph-form-status', '删除成功！', 'success');

    // 刷新列表并隐藏表单
    await loadKnowledgePoints();
    hideForm();
  } catch (error) {
    showStatus('admin-graph-form-status', `删除失败: ${error.message}`, 'error');
  }
}

// 取消编辑
function handleCancelClick() {
  hideForm();
}

// 搜索和过滤
function handleSearchAndFilter({ preserveActiveCategory = false } = {}) {
  const searchInput = document.getElementById('admin-graph-search');
  const categorySelect = document.getElementById('admin-graph-filter-category');
  const difficultySelect = document.getElementById('admin-graph-filter-difficulty');

  graphKnowledgeState.filters.search = searchInput ? searchInput.value : '';
  graphKnowledgeState.filters.category = categorySelect ? categorySelect.value : '';
  graphKnowledgeState.filters.difficulty = difficultySelect ? difficultySelect.value : '';

  if (!preserveActiveCategory) {
    graphKnowledgeState.activeCategoryKey = graphKnowledgeState.filters.category;
  }

  applyKnowledgeFilters();
  renderCategoryTree();
}

function handleAssistFilterUncategorized() {
  graphKnowledgeState.activeCategoryKey = '未分类';
  graphKnowledgeState.filters.category = '未分类';

  const categorySelect = document.getElementById('admin-graph-filter-category');
  if (categorySelect) {
    categorySelect.value = '未分类';
  }

  applyKnowledgeFilters();
  renderCategoryTree();
  renderKnowledgePointsList();
  showStatus('admin-graph-assist-status', '已筛选未分类知识点', 'info');
}

async function handleAssistMetadataApply(name) {
  if (!name) return;

  const assist = graphKnowledgeState.smartAssist || {};
  const suggestions = Array.isArray(assist.metadataSuggestions) ? assist.metadataSuggestions : [];
  const suggestion = suggestions.find((item) => item.name === name);
  if (!suggestion) {
    showStatus('admin-graph-assist-status', '未找到可用的智能补全建议', 'error');
    return;
  }

  const payload = { ...suggestion.fields };

  if (Array.isArray(payload.tags)) {
    payload.tags = payload.tags.slice();
  }

  try {
    showStatus('admin-graph-assist-status', `正在补全「${name}」...`, 'info');
    await updateKnowledgePoint(name, payload);
    showStatus('admin-graph-assist-status', '已根据知识卡片补全信息', 'success');
    await loadKnowledgePoints();

    if (graphKnowledgeState.currentEditingPoint?.name === name) {
      const refreshed = await fetchKnowledgePoint(name);
      if (refreshed) {
        showForm('edit', refreshed);
      }
    }
  } catch (error) {
    console.error('智能补全失败:', error);
    showStatus('admin-graph-assist-status', `补全失败: ${error.message}`, 'error');
  }
}

// Excel导入
async function handleImportExcel() {
  const fileInput = document.getElementById('admin-graph-import-file');
  if (!fileInput) return;

  fileInput.click();
}

async function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    showStatus('admin-graph-import-status', `正在导入 ${file.name}...`, 'info');

    const result = await importExcelFile(file);

    const stats = result.statistics || {};
    const stages = stats.stages || {};
    const topics = stats.topics || {};
    const points = stats.points || {};
    const topicsByStage = result.topicsByStage || {};
    const topicSummary = Object.keys(topicsByStage).length
      ? Object.entries(topicsByStage)
          .map(([stage, count]) => `${stage}:${count}`)
          .join('，')
      : '无';

    showStatus(
      'admin-graph-import-status',
      `导入成功：阶段 ${stages.created || 0}/${stages.total || 0}，主题 ${topics.created || 0}/${topics.total || 0}（${topicSummary}），知识点 新建${points.created || 0} 更新${points.updated || 0} 失败${points.failed || 0}`,
      'success'
    );

    // 刷新列表
    await loadKnowledgePoints();

    // 清空文件选择
    event.target.value = '';
  } catch (error) {
    showStatus('admin-graph-import-status', `导入失败: ${error.message}`, 'error');
  }
}

// Excel导出
async function handleExportExcel() {
  try {
    showStatus('admin-graph-import-status', '正在导出...', 'info');
    await exportToExcel();
    showStatus('admin-graph-import-status', '导出成功！', 'success');

    setTimeout(() => {
      showStatus('admin-graph-import-status', '', '');
    }, 2000);
  } catch (error) {
    showStatus('admin-graph-import-status', `导出失败: ${error.message}`, 'error');
  }
}

// ========== 智能批量导入功能（新）==========

// 下载批量导入模板
async function downloadBatchTemplate() {
  try {
    showStatus('batch-import-status', '正在生成模板...', 'info');

    const response = await fetchWithAuth('/api/graph/import/batch/template?include_existing=true');
    if (!response.ok) {
      throw new Error(`下载模板失败: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '知识图谱批量导入模板.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    showStatus('batch-import-status', '模板下载成功！请打开Excel填写数据', 'success');
    setTimeout(() => showStatus('batch-import-status', '', ''), 3000);
  } catch (error) {
    console.error('下载模板失败:', error);
    showStatus('batch-import-status', `下载模板失败: ${error.message}`, 'error');
  }
}

// 批量导入
async function handleBatchImport() {
  const pointsFileInput = document.getElementById('batch-import-points-file');
  const examplesFileInput = document.getElementById('batch-import-examples-file');

  if (!pointsFileInput) return;

  const pointsFile = pointsFileInput.files[0];
  if (!pointsFile) {
    showStatus('batch-import-status', '请选择知识点主表文件', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('points_file', pointsFile);

  // 案例库表是可选的
  const examplesFile = examplesFileInput?.files[0];
  if (examplesFile) {
    formData.append('examples_file', examplesFile);
  }

  formData.append('mode', 'merge');

  try {
    showStatus('batch-import-status', '正在导入，请稍候...', 'info');
    showBatchImportProgress('开始解析Excel文件...');

    const response = await fetchWithAuth('/api/graph/import/batch', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `导入失败: ${response.status}`);
    }

    const result = await response.json();

    // 显示详细结果
    displayBatchImportResult(result);

    // 如果成功，刷新列表
    if (result.success) {
      await loadKnowledgePoints();
      // 清空文件选择
      pointsFileInput.value = '';
      if (examplesFileInput) examplesFileInput.value = '';
    }

  } catch (error) {
    console.error('批量导入失败:', error);
    showStatus('batch-import-status', `导入失败: ${error.message}`, 'error');
    hideBatchImportProgress();
  }
}

// 预校验批量导入数据
async function validateBatchImport() {
  const pointsFileInput = document.getElementById('batch-import-points-file');
  const examplesFileInput = document.getElementById('batch-import-examples-file');

  if (!pointsFileInput) return;

  const pointsFile = pointsFileInput.files[0];
  if (!pointsFile) {
    showStatus('batch-import-status', '请选择知识点主表文件', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('points_file', pointsFile);

  const examplesFile = examplesFileInput?.files[0];
  if (examplesFile) {
    formData.append('examples_file', examplesFile);
  }

  try {
    showStatus('batch-import-status', '正在检查数据...', 'info');

    const response = await fetchWithAuth('/api/graph/import/batch/validate', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `检查失败: ${response.status}`);
    }

    const result = await response.json();

    // 显示校验结果
    displayValidationResult(result);

  } catch (error) {
    console.error('数据校验失败:', error);
    showStatus('batch-import-status', `数据校验失败: ${error.message}`, 'error');
  }
}

// 显示校验结果
function displayValidationResult(result) {
  const { valid, errors, warnings, preview } = result;

  const resultDiv = document.getElementById('batch-import-validation-result');
  if (!resultDiv) return;

  let html = '<div class="validation-result">';

  // 预览统计
  html += '<div class="validation-preview">';
  html += '<h4>📊 数据预览</h4>';
  html += `<p>知识点: ${preview.points_count} 个</p>`;
  html += `<p>关系: ${preview.relations_count} 条</p>`;
  html += `<p>案例: ${preview.examples_count} 个</p>`;
  html += '</div>';

  // 错误列表
  if (errors && errors.length > 0) {
    html += '<div class="validation-errors">';
    html += '<h4 style="color: #dc3545;">❌ 错误 (' + errors.length + ')</h4>';
    html += '<div class="error-list">';
    errors.forEach(err => {
      html += '<div class="error-item">';
      html += `<strong>${err.table} - 第${err.row}行</strong>`;
      if (err.field) html += ` - ${err.field}`;
      html += `<br>${err.message}`;
      if (err.suggestion) {
        html += `<br><span style="color: #0066cc;">💡 建议: ${err.suggestion}</span>`;
      }
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
  }

  // 警告列表
  if (warnings && warnings.length > 0) {
    html += '<div class="validation-warnings">';
    html += '<h4 style="color: #ffc107;">⚠️ 警告 (' + warnings.length + ')</h4>';
    html += '<div class="warning-list">';
    warnings.forEach(warn => {
      html += '<div class="warning-item">';
      html += `<strong>${warn.table} - 第${warn.row}行</strong>`;
      if (warn.field) html += ` - ${warn.field}`;
      html += `<br>${warn.message}`;
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
  }

  // 总结
  if (valid) {
    html += '<div class="validation-summary success">';
    html += '<h4 style="color: #28a745;">✅ 数据校验通过，可以导入！</h4>';
    html += '</div>';
    showStatus('batch-import-status', '数据校验通过！', 'success');
  } else {
    html += '<div class="validation-summary error">';
    html += '<h4 style="color: #dc3545;">❌ 数据校验失败，请修正错误后重试</h4>';
    html += '</div>';
    showStatus('batch-import-status', '数据校验失败，请查看错误详情', 'error');
  }

  html += '</div>';

  resultDiv.innerHTML = html;
  resultDiv.style.display = 'block';
}

// 显示批量导入结果
function displayBatchImportResult(result) {
  const { success, statistics, errors, warnings, execution_time } = result;

  const resultDiv = document.getElementById('batch-import-result');
  if (!resultDiv) {
    // 如果没有专门的结果div，使用状态消息
    if (success) {
      const msg = `✅ 导入成功！\n` +
        `知识点: ${statistics.points.created}创建/${statistics.points.updated}更新\n` +
        `关系: ${statistics.relations.created}创建\n` +
        `案例: ${statistics.examples.created}创建\n` +
        `用时: ${execution_time}`;
      showStatus('batch-import-status', msg.replace(/\n/g, '<br>'), 'success');
    } else {
      showStatus('batch-import-status', '导入失败，请查看错误详情', 'error');
    }
    return;
  }

  let html = '<div class="import-result">';

  // 统计信息
  html += '<div class="import-stats">';
  html += '<h4>📊 导入统计</h4>';
  html += '<table class="stats-table">';
  html += '<tr><th></th><th>总数</th><th>创建</th><th>更新</th><th>失败</th><th>成功率</th></tr>';
  html += `<tr><td>知识点</td><td>${statistics.points.total}</td><td>${statistics.points.created}</td><td>${statistics.points.updated}</td><td>${statistics.points.failed}</td><td>${statistics.points.success_rate}</td></tr>`;
  html += `<tr><td>关系</td><td>${statistics.relations.total}</td><td>${statistics.relations.created}</td><td>-</td><td>${statistics.relations.failed}</td><td>${statistics.relations.success_rate}</td></tr>`;
  html += `<tr><td>案例</td><td>${statistics.examples.total}</td><td>${statistics.examples.created}</td><td>-</td><td>${statistics.examples.failed}</td><td>${statistics.examples.success_rate}</td></tr>`;
  html += '</table>';
  html += `<p>用时: ${execution_time}</p>`;
  html += '</div>';

  // 错误信息
  if (errors && errors.length > 0) {
    html += '<div class="import-errors">';
    html += '<h4 style="color: #dc3545;">错误详情</h4>';
    errors.forEach(err => {
      html += `<div class="error-item">${err.message}</div>`;
    });
    html += '</div>';
  }

  // 警告信息
  if (warnings && warnings.length > 0) {
    html += '<div class="import-warnings">';
    html += '<h4 style="color: #ffc107;">警告信息</h4>';
    warnings.forEach(warn => {
      html += `<div class="warning-item">${warn.message}</div>`;
    });
    html += '</div>';
  }

  html += '</div>';

  resultDiv.innerHTML = html;
  resultDiv.style.display = 'block';

  if (success) {
    showStatus('batch-import-status', '导入成功！详见下方统计', 'success');
  } else {
    showStatus('batch-import-status', '导入完成，但有部分失败', 'warning');
  }

  hideBatchImportProgress();
}

// 显示导入进度
function showBatchImportProgress(message) {
  const progressDiv = document.getElementById('batch-import-progress');
  if (progressDiv) {
    progressDiv.innerHTML = `<div class="progress-message">${message}</div>`;
    progressDiv.style.display = 'block';
  }
}

// 隐藏导入进度
function hideBatchImportProgress() {
  const progressDiv = document.getElementById('batch-import-progress');
  if (progressDiv) {
    progressDiv.style.display = 'none';
  }
}

// 添加前置依赖对话框
async function handleAddPrerequisite() {
  const currentName = document.getElementById('admin-graph-form-name').value;
  const availablePoints = graphKnowledgeState.allKnowledgePoints
    .filter(p => p.name !== currentName)
    .map(p => p.name);

  if (availablePoints.length === 0) {
    alert('暂无其他知识点可选');
    return;
  }

  const selected = prompt('请输入前置依赖知识点名称：\n\n可选知识点：\n' + availablePoints.join('\n'));

  if (selected && availablePoints.includes(selected)) {
    const currentPrereqs = graphKnowledgeState.currentEditingPoint?.prerequisites || [];
    if (!currentPrereqs.includes(selected)) {
      currentPrereqs.push(selected);
      renderPrerequisites(currentPrereqs);

      if (graphKnowledgeState.currentEditingPoint) {
        graphKnowledgeState.currentEditingPoint.prerequisites = currentPrereqs;
      }
    }
  }
}

// 添加关联对话框
async function handleAddRelation() {
  const currentName = document.getElementById('admin-graph-form-name').value;
  const availablePoints = graphKnowledgeState.allKnowledgePoints
    .filter(p => p.name !== currentName)
    .map(p => p.name);

  if (availablePoints.length === 0) {
    alert('暂无其他知识点可选');
    return;
  }

  const selected = prompt('请输入关联知识点名称：\n\n可选知识点：\n' + availablePoints.join('\n'));

  if (selected && availablePoints.includes(selected)) {
    const currentRelations = graphKnowledgeState.currentEditingPoint?.relations || [];
    if (!currentRelations.includes(selected)) {
      currentRelations.push(selected);
      renderRelations(currentRelations);

      if (graphKnowledgeState.currentEditingPoint) {
        graphKnowledgeState.currentEditingPoint.relations = currentRelations;
      }
    }
  }
}

// 移除前置依赖
function removePrerequisite(name) {
  if (!graphKnowledgeState.currentEditingPoint) return;

  const prereqs = graphKnowledgeState.currentEditingPoint.prerequisites || [];
  const index = prereqs.indexOf(name);
  if (index > -1) {
    prereqs.splice(index, 1);
    graphKnowledgeState.currentEditingPoint.prerequisites = prereqs;
    renderPrerequisites(prereqs);
  }
}

// 移除关联
function removeRelation(name) {
  if (!graphKnowledgeState.currentEditingPoint) return;

  const relations = graphKnowledgeState.currentEditingPoint.relations || [];
  const index = relations.indexOf(name);
  if (index > -1) {
    relations.splice(index, 1);
    graphKnowledgeState.currentEditingPoint.relations = relations;
    renderRelations(relations);
  }
}

// ========== 初始化和加载数据 ==========

// 加载知识点列表
async function loadKnowledgePoints() {
  const overview = await fetchKnowledgePoints();

  const points = overview.knowledge_points || [];
  graphKnowledgeState.allKnowledgePoints = points;

  graphKnowledgeState.categoryTree = Array.isArray(overview.category_tree) ? overview.category_tree : [];
  graphKnowledgeState.stats = overview.stats || { total: points.length, categories: 0, difficulty: {} };
  graphKnowledgeState.smartAssist = overview.assist || { uncategorized: [], metadataSuggestions: [] };

  const categoryPaths = Array.isArray(overview.category_paths) ? overview.category_paths : [];
  const categorySet = new Set(categoryPaths);
  categorySet.add('未分类');
  graphKnowledgeState.categories = Array.from(categorySet);

  if (graphKnowledgeState.activeCategoryKey && !categorySet.has(graphKnowledgeState.activeCategoryKey)) {
    graphKnowledgeState.activeCategoryKey = '';
  }
  if (graphKnowledgeState.filters.category && !categorySet.has(graphKnowledgeState.filters.category)) {
    graphKnowledgeState.filters.category = '';
  }

  if (state.admin && state.admin.graph) {
    state.admin.graph.knowledgePoints = overview.knowledge_cards || [];
  }

  renderCategoryOptions();
  renderKnowledgeStats();
  applyKnowledgeFilters();
  renderCategoryTree();
  renderSmartAssist();
}

// 加载分类列表
async function loadCategories() {
  const categories = await fetchCategories();
  if (categories.length === 0) {
    return;
  }
  const merged = new Set([...(graphKnowledgeState.categories || []), ...categories]);
  graphKnowledgeState.categories = Array.from(merged);
  renderCategoryOptions();
}

// 初始化知识点管理功能
function initGraphKnowledgeManagement() {
  // 绑定事件监听器
  const addBtn = document.getElementById('admin-graph-add-knowledge');
  if (addBtn) {
    addBtn.addEventListener('click', handleAddKnowledgeClick);
  }

  const form = document.getElementById('admin-graph-form');
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  const deleteBtn = document.getElementById('admin-graph-form-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', handleDeleteClick);
  }

  const cancelBtn = document.getElementById('admin-graph-form-cancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', handleCancelClick);
  }

  const searchInput = document.getElementById('admin-graph-search');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchAndFilter);
  }

  const categoryFilter = document.getElementById('admin-graph-filter-category');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', handleSearchAndFilter);
  }

  const difficultyFilter = document.getElementById('admin-graph-filter-difficulty');
  if (difficultyFilter) {
    difficultyFilter.addEventListener('change', handleSearchAndFilter);
  }

  const resetButton = document.getElementById('admin-graph-category-reset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      graphKnowledgeState.activeCategoryKey = '';
      graphKnowledgeState.filters.category = '';
      const filterSelect = document.getElementById('admin-graph-filter-category');
      if (filterSelect) {
        filterSelect.value = '';
      }
      applyKnowledgeFilters();
      renderCategoryTree();
    });
    resetButton.addEventListener('dragover', handleCategoryDragOver);
    resetButton.addEventListener('dragleave', handleCategoryDragLeave);
    resetButton.addEventListener('drop', handleCategoryDrop);
  }

  const importBtn = document.getElementById('admin-graph-import-excel');
  if (importBtn) {
    importBtn.addEventListener('click', handleImportExcel);
  }

  const fileInput = document.getElementById('admin-graph-import-file');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelected);
  }

  const exportBtn = document.getElementById('admin-graph-export-excel');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExportExcel);
  }

  const downloadTemplate = document.getElementById('admin-graph-download-template');
  if (downloadTemplate) {
    downloadTemplate.removeAttribute('href');
    downloadTemplate.addEventListener('click', (event) => {
      event.preventDefault();
      downloadBatchTemplate();
    });
  }

  const addPrereqBtn = document.getElementById('admin-graph-form-add-prerequisite');
  if (addPrereqBtn) {
    addPrereqBtn.addEventListener('click', handleAddPrerequisite);
  }

  const addRelationBtn = document.getElementById('admin-graph-form-add-relation');
  if (addRelationBtn) {
    addRelationBtn.addEventListener('click', handleAddRelation);
  }

  // 加载初始数据
  loadKnowledgePoints();
  loadCategories();
}

// ========== 工具函数 ==========

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showStatus(elementId, message, type) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const colors = {
    success: 'text-emerald-300',
    error: 'text-rose-300',
    info: 'text-sky-300'
  };

  el.textContent = message;
  el.className = `text-xs ${colors[type] || 'text-slate-400'}`;
}

// 导出全局函数供HTML onclick使用
if (typeof window !== 'undefined') {
  window.handleKnowledgePointClick = handleKnowledgePointClick;
  window.showKnowledgeGraphForm = showForm;
  window.removePrerequisite = removePrerequisite;
  window.removeRelation = removeRelation;
}

// 安全设置表单字段的值，避免缺失元素时报错
function setFieldValue(id, value) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('[Graph] Field not found:', id);
    return;
  }
  el.value = value ?? '';
}
