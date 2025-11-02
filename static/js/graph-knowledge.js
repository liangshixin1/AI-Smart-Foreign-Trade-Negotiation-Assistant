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

// 获取扁平分类列表
async function fetchCategoriesFlat() {
  try {
    const response = await fetchWithAuth('/api/graph/categories/flat');

    if (!response.ok) {
      throw new Error(`获取分类失败: ${response.status}`);
    }

    const data = await response.json();
    return data.categories || [];
  } catch (error) {
    console.error('获取扁平分类列表失败:', error);
    return [];
  }
}

// 获取单个分类详情
async function fetchCategory(categoryId) {
  try {
    const response = await fetchWithAuth(`/api/graph/categories/${encodeURIComponent(categoryId)}`);

    if (!response.ok) {
      throw new Error(`获取分类详情失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('获取分类详情失败:', error);
    return null;
  }
}

// 创建新分类
async function createCategory(data) {
  try {
    const response = await fetchWithAuth('/api/graph/categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `创建分类失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('创建分类失败:', error);
    throw error;
  }
}

// 更新分类
async function updateCategory(categoryId, data) {
  try {
    const response = await fetchWithAuth(`/api/graph/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `更新分类失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('更新分类失败:', error);
    throw error;
  }
}

// 删除分类
async function deleteCategory(categoryId, moveToId = null) {
  try {
    const url = moveToId
      ? `/api/graph/categories/${encodeURIComponent(categoryId)}?move_to=${encodeURIComponent(moveToId)}`
      : `/api/graph/categories/${encodeURIComponent(categoryId)}`;

    const response = await fetchWithAuth(url, {
      method: 'DELETE'
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `删除分类失败: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('删除分类失败:', error);
    throw error;
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
    container.innerHTML = `
      <div class="space-y-2">
        <p class="text-[11px] text-slate-500">暂无分类结构</p>
        <button type="button" id="create-root-category-btn"
                class="rounded-lg border border-sky-500/50 bg-sky-500/10 px-3 py-2 text-sm text-sky-300 hover:bg-sky-500/20">
          ➕ 创建一级分类
        </button>
      </div>
    `;

    const createBtn = container.querySelector('#create-root-category-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => showCategoryEditDialog('create'));
    }
    return;
  }

  container.innerHTML = buildCategoryTreeHtml(tree);

  const nodes = container.querySelectorAll('[data-category-path]');
  nodes.forEach((button) => {
    button.addEventListener('click', handleCategoryNodeClick);
    button.addEventListener('contextmenu', (e) => {
      const categoryPath = button.dataset.categoryPath || '';
      showCategoryContextMenu(e, categoryPath);
    });
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
    document.getElementById('admin-graph-form-name').value = point.name || '';
    const categorySelect = document.getElementById('admin-graph-form-category');
    if (categorySelect) {
      const pathKey = Array.isArray(point.category_path) && point.category_path.length > 0
        ? point.category_path.join('/')
        : point.category_path_key || point.category || '';
      categorySelect.value = pathKey || '';
    }
    document.getElementById('admin-graph-form-description').value = point.description || '';
    document.getElementById('admin-graph-form-difficulty').value = point.difficulty || 'beginner';
    document.getElementById('admin-graph-form-importance').value = point.importance || 'medium';
    document.getElementById('admin-graph-form-duration').value = point.estimated_duration || '';
    document.getElementById('admin-graph-form-tags').value = point.tags ? point.tags.join(', ') : '';
    document.getElementById('admin-graph-form-content').value = point.content || '';

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

  document.getElementById('admin-graph-form-mode').value = '';
  document.getElementById('admin-graph-form-original-name').value = '';

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

    showStatus(
      'admin-graph-import-status',
      `导入成功！创建 ${result.created} 个，更新 ${result.updated} 个，失败 ${result.failed} 个。`,
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

// ========== 分类管理功能 ==========

// 显示分类编辑对话框
async function showCategoryEditDialog(mode = 'create', categoryId = null) {
  const parentCategories = await fetchCategoriesFlat();

  let category = null;
  if (mode === 'edit' && categoryId) {
    category = await fetchCategory(categoryId);
    if (!category) {
      alert('获取分类信息失败');
      return;
    }
  }

  const parentOptions = parentCategories
    .filter(c => c.id !== categoryId) // 不能选择自己作为父分类
    .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.path_text)}</option>`)
    .join('');

  const title = mode === 'create' ? '创建新分类' : '编辑分类';
  const confirmText = mode === 'create' ? '创建' : '保存';

  const dialogHTML = `
    <div id="category-edit-dialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-white">${title}</h3>

        <form id="category-edit-form" class="space-y-4">
          <div>
            <label class="block text-sm text-slate-300">分类ID <span class="text-rose-400">*</span></label>
            <input type="text" id="category-id-input" value="${category?.id || ''}" ${mode === 'edit' ? 'readonly' : ''}
                   class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white ${mode === 'edit' ? 'opacity-60' : ''}"
                   placeholder="如: my-category" required>
            <p class="mt-1 text-xs text-slate-500">唯一标识符，只能包含字母、数字、连字符</p>
          </div>

          <div>
            <label class="block text-sm text-slate-300">分类名称 <span class="text-rose-400">*</span></label>
            <input type="text" id="category-name-input" value="${category?.name || ''}"
                   class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                   placeholder="如: 我的分类" required>
          </div>

          <div>
            <label class="block text-sm text-slate-300">父分类</label>
            <select id="category-parent-input" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
              <option value="">无（一级分类）</option>
              ${parentOptions}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-slate-300">图标</label>
              <input type="text" id="category-icon-input" value="${category?.icon || '📁'}"
                     class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-2xl">
            </div>
            <div>
              <label class="block text-sm text-slate-300">颜色</label>
              <input type="color" id="category-color-input" value="${category?.color || '#6B7280'}"
                     class="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-800">
            </div>
          </div>

          <div>
            <label class="block text-sm text-slate-300">描述</label>
            <textarea id="category-description-input" rows="2"
                      class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                      placeholder="分类描述（可选）">${category?.description || ''}</textarea>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="category-dialog-cancel"
                    class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              取消
            </button>
            <button type="submit"
                    class="rounded-lg bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500">
              ${confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', dialogHTML);

  // 如果是编辑模式，设置父分类
  if (mode === 'edit' && category?.parent_id) {
    document.getElementById('category-parent-input').value = category.parent_id;
  }

  // 绑定事件
  document.getElementById('category-dialog-cancel').addEventListener('click', () => {
    document.getElementById('category-edit-dialog').remove();
  });

  document.getElementById('category-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      id: document.getElementById('category-id-input').value.trim(),
      name: document.getElementById('category-name-input').value.trim(),
      parent_id: document.getElementById('category-parent-input').value || null,
      icon: document.getElementById('category-icon-input').value.trim() || '📁',
      color: document.getElementById('category-color-input').value,
      description: document.getElementById('category-description-input').value.trim(),
    };

    try {
      if (mode === 'create') {
        await createCategory(data);
        showStatus('admin-graph-category-status', '分类创建成功！', 'success');
      } else {
        await updateCategory(categoryId, data);
        showStatus('admin-graph-category-status', '分类更新成功！', 'success');
      }

      document.getElementById('category-edit-dialog').remove();
      await loadKnowledgePoints();
    } catch (error) {
      alert(`操作失败: ${error.message}`);
    }
  });
}

// 显示分类删除确认对话框
async function showCategoryDeleteDialog(categoryId) {
  const category = await fetchCategory(categoryId);
  if (!category) {
    alert('获取分类信息失败');
    return;
  }

  if (category.children_count > 0) {
    alert(`该分类包含 ${category.children_count} 个子分类，请先删除或移动子分类。`);
    return;
  }

  const knowledgeCount = category.knowledge_count || 0;
  let moveToOptions = '';

  if (knowledgeCount > 0) {
    const categories = await fetchCategoriesFlat();
    moveToOptions = categories
      .filter(c => c.id !== categoryId)
      .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.path_text)}</option>`)
      .join('');
  }

  const dialogHTML = `
    <div id="category-delete-dialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h3 class="mb-4 text-lg font-semibold text-rose-400">删除分类</h3>

        <div class="space-y-4">
          <p class="text-sm text-slate-300">
            确定要删除分类 <strong class="text-white">${escapeHtml(category.name)}</strong> 吗？
          </p>

          ${knowledgeCount > 0 ? `
            <div class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p class="text-sm text-amber-200">
                该分类包含 <strong>${knowledgeCount}</strong> 个知识点
              </p>
              <div class="mt-3">
                <label class="block text-sm text-amber-200">将知识点移动到：</label>
                <select id="move-knowledge-to-select" class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white">
                  <option value="">不移动（标记为未分类）</option>
                  ${moveToOptions}
                </select>
              </div>
            </div>
          ` : ''}

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" id="delete-dialog-cancel"
                    class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              取消
            </button>
            <button type="button" id="delete-dialog-confirm"
                    class="rounded-lg bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-500">
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', dialogHTML);

  // 绑定事件
  document.getElementById('delete-dialog-cancel').addEventListener('click', () => {
    document.getElementById('category-delete-dialog').remove();
  });

  document.getElementById('delete-dialog-confirm').addEventListener('click', async () => {
    const moveToId = knowledgeCount > 0
      ? document.getElementById('move-knowledge-to-select').value || null
      : null;

    try {
      await deleteCategory(categoryId, moveToId);
      showStatus('admin-graph-category-status', '分类删除成功！', 'success');
      document.getElementById('category-delete-dialog').remove();
      await loadKnowledgePoints();
    } catch (error) {
      alert(`删除失败: ${error.message}`);
    }
  });
}

// 显示分类右键菜单
function showCategoryContextMenu(event, categoryPathKey) {
  event.preventDefault();
  event.stopPropagation();

  // 移除已有菜单
  const existingMenu = document.getElementById('category-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menuHTML = `
    <div id="category-context-menu" class="fixed z-50 min-w-[180px] rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
         style="left: ${event.clientX}px; top: ${event.clientY}px;">
      <button type="button" data-action="create-sub" class="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        ➕ 创建子分类
      </button>
      <button type="button" data-action="edit" class="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        ✏️ 编辑分类
      </button>
      <div class="my-1 border-t border-slate-700"></div>
      <button type="button" data-action="delete" class="w-full px-4 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10 hover:text-rose-300">
        🗑️ 删除分类
      </button>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', menuHTML);

  const menu = document.getElementById('category-context-menu');

  // 绑定菜单项点击事件
  menu.querySelector('[data-action="create-sub"]').addEventListener('click', () => {
    menu.remove();
    showCategoryEditDialog('create', categoryPathKey);
  });

  menu.querySelector('[data-action="edit"]').addEventListener('click', () => {
    menu.remove();
    showCategoryEditDialog('edit', categoryPathKey);
  });

  menu.querySelector('[data-action="delete"]').addEventListener('click', () => {
    menu.remove();
    showCategoryDeleteDialog(categoryPathKey);
  });

  // 点击其他地方关闭菜单
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };

  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
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
  window.removePrerequisite = removePrerequisite;
  window.removeRelation = removeRelation;
}
