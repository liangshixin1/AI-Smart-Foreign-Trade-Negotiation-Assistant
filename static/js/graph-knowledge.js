// 知识点管理模块
// 提供完整的CRUD、搜索、过滤、Excel导入导出功能

// ========== 状态管理 ==========
const graphKnowledgeState = {
  allKnowledgePoints: [],
  filteredKnowledgePoints: [],
  categories: [],
  currentEditingPoint: null,
  filters: {
    search: '',
    category: '',
    difficulty: ''
  }
};

// ========== API调用函数 ==========

// 获取所有知识点列表（支持过滤）
async function fetchKnowledgePoints(filters = {}) {
  try {
    const params = new URLSearchParams();
    if (filters.category) params.append('category', filters.category);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    if (filters.search) params.append('search', filters.search);

    const url = `/api/graph/knowledge-points/enhanced${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetchWithAuth(url);

    if (!response.ok) {
      throw new Error(`获取知识点失败: ${response.status}`);
    }

    const data = await response.json();
    return data.knowledge_points || [];
  } catch (error) {
    console.error('获取知识点失败:', error);
    showStatus('admin-graph-form-status', `获取知识点失败: ${error.message}`, 'error');
    return [];
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

  listEl.innerHTML = points.map(point => {
    const isSelected = graphKnowledgeState.currentEditingPoint?.name === point.name;
    const difficultyColors = {
      beginner: 'text-green-400',
      intermediate: 'text-yellow-400',
      advanced: 'text-red-400'
    };
    const difficultyLabels = {
      beginner: '初级',
      intermediate: '中级',
      advanced: '高级'
    };

    return `
      <li class="group cursor-pointer rounded-lg border ${isSelected ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 hover:border-slate-600'} p-3 transition"
          data-knowledge-name="${escapeHtml(point.name)}"
          onclick="handleKnowledgePointClick('${escapeHtml(point.name)}')">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <h4 class="font-medium text-white text-sm truncate">${escapeHtml(point.name)}</h4>
            ${point.description ? `<p class="mt-1 text-xs text-slate-400 line-clamp-2">${escapeHtml(point.description)}</p>` : ''}
          </div>
          <div class="flex flex-col gap-1 items-end">
            ${point.difficulty ? `<span class="text-xs ${difficultyColors[point.difficulty] || 'text-slate-400'}">${difficultyLabels[point.difficulty] || point.difficulty}</span>` : ''}
            ${point.category ? `<span class="text-xs text-slate-500">${escapeHtml(point.category)}</span>` : ''}
          </div>
        </div>
        ${point.tags && point.tags.length > 0 ? `
          <div class="mt-2 flex flex-wrap gap-1">
            ${point.tags.slice(0, 3).map(tag => `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">${escapeHtml(tag)}</span>`).join('')}
            ${point.tags.length > 3 ? `<span class="text-xs px-2 py-0.5 text-slate-500">+${point.tags.length - 3}</span>` : ''}
          </div>
        ` : ''}
      </li>
    `;
  }).join('');
}

// 渲染分类下拉列表
function renderCategoryOptions() {
  const filterSelect = document.getElementById('admin-graph-filter-category');
  const formSelect = document.getElementById('admin-graph-form-category');

  const categories = graphKnowledgeState.categories;
  const optionsHTML = categories.map(cat =>
    `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
  ).join('');

  if (filterSelect) {
    const currentValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="">全部分类</option>' + optionsHTML;
    filterSelect.value = currentValue;
  }

  if (formSelect) {
    const currentValue = formSelect.value;
    formSelect.innerHTML = '<option value="">未分类</option>' + optionsHTML;
    formSelect.value = currentValue;
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
    document.getElementById('admin-graph-form-category').value = point.category || '';
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

  const data = {
    name: document.getElementById('admin-graph-form-name').value.trim(),
    category: document.getElementById('admin-graph-form-category').value || null,
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
function handleSearchAndFilter() {
  const searchValue = document.getElementById('admin-graph-search')?.value.toLowerCase() || '';
  const categoryValue = document.getElementById('admin-graph-filter-category')?.value || '';
  const difficultyValue = document.getElementById('admin-graph-filter-difficulty')?.value || '';

  graphKnowledgeState.filters = {
    search: searchValue,
    category: categoryValue,
    difficulty: difficultyValue
  };

  // 客户端过滤
  graphKnowledgeState.filteredKnowledgePoints = graphKnowledgeState.allKnowledgePoints.filter(point => {
    if (searchValue && !point.name.toLowerCase().includes(searchValue)) {
      return false;
    }
    if (categoryValue && point.category !== categoryValue) {
      return false;
    }
    if (difficultyValue && point.difficulty !== difficultyValue) {
      return false;
    }
    return true;
  });

  renderKnowledgePointsList();
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
  const points = await fetchKnowledgePoints();
  graphKnowledgeState.allKnowledgePoints = points;
  graphKnowledgeState.filteredKnowledgePoints = points;
  renderKnowledgePointsList();
}

// 加载分类列表
async function loadCategories() {
  const categories = await fetchCategories();
  graphKnowledgeState.categories = categories;
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
