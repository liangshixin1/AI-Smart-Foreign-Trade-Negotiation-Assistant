// 知识分类树管理模块
// 支持拖拽排序、分类管理、知识点移动
// 🎯 低门槛 + 高效率 + 智能辅助

// ========== 状态管理 ==========
const knowledgeTreeState = {
  categories: [],
  knowledgePoints: [],
  expandedCategories: new Set(),
  draggedItem: null,
  draggedItemType: null, // 'category' or 'knowledge'
};

// ========== API调用函数 ==========

// 获取分类树（包含知识点）
async function fetchCategoryTreeWithKnowledge() {
  try {
    const response = await fetchWithAuth('/api/graph/categories/tree/with-knowledge');
    if (!response.ok) {
      throw new Error(`获取分类树失败: ${response.status}`);
    }
    const data = await response.json();
    return data.categories || [];
  } catch (error) {
    console.error('获取分类树失败:', error);
    showMessage('获取分类树失败: ' + error.message, 'error');
    return [];
  }
}

// 创建分类
async function createCategory(categoryData) {
  try {
    const response = await fetchWithAuth('/api/graph/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建分类失败');
    }
    return await response.json();
  } catch (error) {
    console.error('创建分类失败:', error);
    throw error;
  }
}

// 更新分类
async function updateCategory(categoryId, updates) {
  try {
    const response = await fetchWithAuth(`/api/graph/categories/${categoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '更新分类失败');
    }
    return await response.json();
  } catch (error) {
    console.error('更新分类失败:', error);
    throw error;
  }
}

// 删除分类
async function deleteCategory(categoryId) {
  try {
    const response = await fetchWithAuth(`/api/graph/categories/${categoryId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '删除分类失败');
    }
    return await response.json();
  } catch (error) {
    console.error('删除分类失败:', error);
    throw error;
  }
}

// 批量更新分类排序
async function reorderCategories(orders) {
  try {
    const response = await fetchWithAuth('/api/graph/categories/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    if (!response.ok) {
      throw new Error('更新分类排序失败');
    }
    return await response.json();
  } catch (error) {
    console.error('更新分类排序失败:', error);
    throw error;
  }
}

// 移动分类
async function moveCategory(categoryId, newParentId, orderIndex) {
  try {
    const response = await fetchWithAuth(`/api/graph/categories/${categoryId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newParentId, orderIndex })
    });
    if (!response.ok) {
      throw new Error('移动分类失败');
    }
    return await response.json();
  } catch (error) {
    console.error('移动分类失败:', error);
    throw error;
  }
}

// 批量更新知识点排序
async function reorderKnowledgePoints(categoryId, orders) {
  try {
    const response = await fetchWithAuth('/api/graph/knowledge-points/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId, orders })
    });
    if (!response.ok) {
      throw new Error('更新知识点排序失败');
    }
    return await response.json();
  } catch (error) {
    console.error('更新知识点排序失败:', error);
    throw error;
  }
}

// 移动知识点到新分类
async function moveKnowledgePoint(knowledgeName, newCategoryId, orderIndex) {
  try {
    const response = await fetchWithAuth(`/api/graph/knowledge-points/${encodeURIComponent(knowledgeName)}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newCategoryId, orderIndex })
    });
    if (!response.ok) {
      throw new Error('移动知识点失败');
    }
    return await response.json();
  } catch (error) {
    console.error('移动知识点失败:', error);
    throw error;
  }
}

// ========== UI渲染函数 ==========

// 初始化知识树视图
async function initKnowledgeTreeView() {
  const container = document.getElementById('knowledge-tree-container');
  if (!container) {
    console.warn('知识树容器不存在');
    return;
  }

  // 显示加载状态
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    // 获取分类树数据
    const categories = await fetchCategoryTreeWithKnowledge();
    knowledgeTreeState.categories = categories;

    // 渲染树形结构
    renderKnowledgeTree(container, categories);
  } catch (error) {
    container.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
  }
}

// 渲染知识树
function renderKnowledgeTree(container, categories) {
  container.innerHTML = `
    <div class="knowledge-tree-header">
      <h3>📚 知识分类树</h3>
      <div class="tree-actions">
        <button class="btn-add-category" onclick="showAddCategoryModal()">
          ➕ 新建分类
        </button>
        <button class="btn-expand-all" onclick="expandAllCategories()">
          📂 展开全部
        </button>
        <button class="btn-collapse-all" onclick="collapseAllCategories()">
          📁 收起全部
        </button>
      </div>
    </div>
    <div class="knowledge-tree-body">
      ${categories.length > 0 ? renderCategoryList(categories) : '<div class="empty-tree">暂无分类，点击上方按钮创建</div>'}
    </div>
  `;
}

// 渲染分类列表
function renderCategoryList(categories, level = 0) {
  return categories.map((category, index) => {
    const isExpanded = knowledgeTreeState.expandedCategories.has(category.id);
    const hasChildren = category.children && category.children.length > 0;
    const hasKnowledge = category.knowledgePoints && category.knowledgePoints.length > 0;

    return `
      <div class="tree-category"
           data-category-id="${category.id}"
           data-level="${level}"
           draggable="true"
           ondragstart="handleCategoryDragStart(event, '${category.id}')"
           ondragover="handleDragOver(event)"
           ondrop="handleCategoryDrop(event, '${category.id}')"
           ondragend="handleDragEnd(event)">

        <div class="category-header">
          <span class="category-toggle" onclick="toggleCategory('${category.id}')">
            ${hasChildren || hasKnowledge ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>
          <span class="category-icon">${category.icon || '📁'}</span>
          <span class="category-name">${category.name}</span>
          <span class="category-count">(${(category.knowledgePoints || []).length})</span>
          <div class="category-actions">
            <button class="btn-edit" onclick="editCategory('${category.id}')" title="编辑分类">✏️</button>
            <button class="btn-add-sub" onclick="showAddSubCategoryModal('${category.id}')" title="添加子分类">➕</button>
            <button class="btn-delete" onclick="confirmDeleteCategory('${category.id}')" title="删除分类">🗑️</button>
          </div>
        </div>

        ${isExpanded ? `
          <div class="category-content">
            ${hasKnowledge ? `
              <div class="knowledge-list">
                ${renderKnowledgeList(category.knowledgePoints, category.id)}
              </div>
            ` : ''}
            ${hasChildren ? `
              <div class="subcategories">
                ${renderCategoryList(category.children, level + 1)}
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// 渲染知识点列表
function renderKnowledgeList(knowledgePoints, categoryId) {
  return knowledgePoints.map((kp, index) => `
    <div class="tree-knowledge-item"
         data-knowledge-name="${kp.name}"
         data-category-id="${categoryId}"
         draggable="true"
         ondragstart="handleKnowledgeDragStart(event, '${kp.name}', '${categoryId}')"
         ondragover="handleDragOver(event)"
         ondrop="handleKnowledgeDrop(event, '${categoryId}', ${index})"
         ondragend="handleDragEnd(event)">

      <span class="knowledge-icon">${getKnowledgeIcon(kp.type)}</span>
      <span class="knowledge-name">${kp.name}</span>
      ${kp.difficulty ? `<span class="knowledge-badge badge-${kp.difficulty}">${getDifficultyLabel(kp.difficulty)}</span>` : ''}
      ${kp.tags && kp.tags.length > 0 ? `<span class="knowledge-tags">${kp.tags.slice(0, 2).join(', ')}</span>` : ''}
      <div class="knowledge-actions">
        <button class="btn-edit" onclick="editKnowledgePoint('${kp.name}')" title="编辑知识点">✏️</button>
      </div>
    </div>
  `).join('');
}

// ========== 拖拽处理函数 ==========

// 处理分类拖拽开始
function handleCategoryDragStart(event, categoryId) {
  knowledgeTreeState.draggedItem = categoryId;
  knowledgeTreeState.draggedItemType = 'category';
  event.target.style.opacity = '0.5';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/html', event.target.innerHTML);
}

// 处理知识点拖拽开始
function handleKnowledgeDragStart(event, knowledgeName, categoryId) {
  knowledgeTreeState.draggedItem = { name: knowledgeName, categoryId };
  knowledgeTreeState.draggedItemType = 'knowledge';
  event.target.style.opacity = '0.5';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/html', event.target.innerHTML);
}

// 处理拖拽悬停
function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
  return false;
}

// 处理分类拖放
async function handleCategoryDrop(event, targetCategoryId) {
  event.stopPropagation();
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  if (knowledgeTreeState.draggedItemType === 'category') {
    const draggedCategoryId = knowledgeTreeState.draggedItem;
    if (draggedCategoryId !== targetCategoryId) {
      try {
        // 移动分类到目标分类下
        await moveCategory(draggedCategoryId, targetCategoryId, 0);
        showMessage('分类移动成功', 'success');
        await initKnowledgeTreeView(); // 重新加载树
      } catch (error) {
        showMessage('移动失败: ' + error.message, 'error');
      }
    }
  } else if (knowledgeTreeState.draggedItemType === 'knowledge') {
    const { name } = knowledgeTreeState.draggedItem;
    try {
      // 移动知识点到目标分类
      await moveKnowledgePoint(name, targetCategoryId, 0);
      showMessage('知识点移动成功', 'success');
      await initKnowledgeTreeView(); // 重新加载树
    } catch (error) {
      showMessage('移动失败: ' + error.message, 'error');
    }
  }

  return false;
}

// 处理知识点拖放
async function handleKnowledgeDrop(event, categoryId, index) {
  event.stopPropagation();
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  if (knowledgeTreeState.draggedItemType === 'knowledge') {
    const { name, categoryId: sourceCategoryId } = knowledgeTreeState.draggedItem;

    if (sourceCategoryId !== categoryId || true) { // 允许同分类内排序
      try {
        await moveKnowledgePoint(name, categoryId, index);
        showMessage('知识点移动成功', 'success');
        await initKnowledgeTreeView(); // 重新加载树
      } catch (error) {
        showMessage('移动失败: ' + error.message, 'error');
      }
    }
  }

  return false;
}

// 处理拖拽结束
function handleDragEnd(event) {
  event.target.style.opacity = '1';
  document.querySelectorAll('.drag-over').forEach(el => {
    el.classList.remove('drag-over');
  });
  knowledgeTreeState.draggedItem = null;
  knowledgeTreeState.draggedItemType = null;
}

// ========== 分类管理函数 ==========

// 切换分类展开/收起
function toggleCategory(categoryId) {
  if (knowledgeTreeState.expandedCategories.has(categoryId)) {
    knowledgeTreeState.expandedCategories.delete(categoryId);
  } else {
    knowledgeTreeState.expandedCategories.add(categoryId);
  }
  const container = document.getElementById('knowledge-tree-container');
  if (container) {
    renderKnowledgeTree(container, knowledgeTreeState.categories);
  }
}

// 展开所有分类
function expandAllCategories() {
  function addAllIds(categories) {
    categories.forEach(cat => {
      knowledgeTreeState.expandedCategories.add(cat.id);
      if (cat.children) {
        addAllIds(cat.children);
      }
    });
  }
  addAllIds(knowledgeTreeState.categories);
  const container = document.getElementById('knowledge-tree-container');
  if (container) {
    renderKnowledgeTree(container, knowledgeTreeState.categories);
  }
}

// 收起所有分类
function collapseAllCategories() {
  knowledgeTreeState.expandedCategories.clear();
  const container = document.getElementById('knowledge-tree-container');
  if (container) {
    renderKnowledgeTree(container, knowledgeTreeState.categories);
  }
}

// 显示添加分类模态框
function showAddCategoryModal(parentId = null) {
  const modal = createCategoryModal({
    title: parentId ? '添加子分类' : '新建分类',
    parentId,
    onSave: async (data) => {
      try {
        await createCategory(data);
        showMessage('分类创建成功', 'success');
        await initKnowledgeTreeView();
        modal.close();
      } catch (error) {
        showMessage('创建失败: ' + error.message, 'error');
      }
    }
  });
  modal.show();
}

// 显示添加子分类模态框
function showAddSubCategoryModal(parentId) {
  showAddCategoryModal(parentId);
}

// 编辑分类
function editCategory(categoryId) {
  // 找到分类数据
  const category = findCategoryById(knowledgeTreeState.categories, categoryId);
  if (!category) {
    showMessage('分类不存在', 'error');
    return;
  }

  const modal = createCategoryModal({
    title: '编辑分类',
    category,
    onSave: async (data) => {
      try {
        await updateCategory(categoryId, data);
        showMessage('分类更新成功', 'success');
        await initKnowledgeTreeView();
        modal.close();
      } catch (error) {
        showMessage('更新失败: ' + error.message, 'error');
      }
    }
  });
  modal.show();
}

// 确认删除分类
async function confirmDeleteCategory(categoryId) {
  if (confirm('确定要删除这个分类吗？此操作不可恢复。')) {
    try {
      await deleteCategory(categoryId);
      showMessage('分类删除成功', 'success');
      await initKnowledgeTreeView();
    } catch (error) {
      showMessage('删除失败: ' + error.message, 'error');
    }
  }
}

// 编辑知识点（调用原有的编辑功能）
function editKnowledgePoint(name) {
  if (window.showEditKnowledgePointModal) {
    window.showEditKnowledgePointModal(name);
  } else {
    showMessage('知识点编辑功能未加载', 'error');
  }
}

// ========== 辅助函数 ==========

// 递归查找分类
function findCategoryById(categories, categoryId) {
  for (const cat of categories) {
    if (cat.id === categoryId) return cat;
    if (cat.children) {
      const found = findCategoryById(cat.children, categoryId);
      if (found) return found;
    }
  }
  return null;
}

// 获取知识点类型图标
function getKnowledgeIcon(type) {
  const icons = {
    concept: '💡',
    skill: '🎯',
    document: '📄',
    case: '📋',
    tool: '🔧',
    theory: '📖',
    regulation: '⚖️'
  };
  return icons[type] || '📌';
}

// 获取难度标签
function getDifficultyLabel(difficulty) {
  const labels = {
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级'
  };
  return labels[difficulty] || difficulty;
}

// 创建分类模态框
function createCategoryModal({ title, category, parentId, onSave }) {
  const modalHtml = `
    <div class="modal-overlay" id="category-modal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" onclick="closeCategoryModal()">×</button>
        </div>
        <div class="modal-body">
          <form id="category-form">
            <div class="form-group">
              <label>分类ID *</label>
              <input type="text" name="id" value="${category?.id || ''}" ${category ? 'readonly' : ''} required>
            </div>
            <div class="form-group">
              <label>分类名称 *</label>
              <input type="text" name="name" value="${category?.name || ''}" required>
            </div>
            <div class="form-group">
              <label>分类代码</label>
              <input type="text" name="code" value="${category?.code || ''}">
            </div>
            <div class="form-group">
              <label>图标</label>
              <input type="text" name="icon" value="${category?.icon || '📁'}">
            </div>
            <div class="form-group">
              <label>颜色</label>
              <input type="color" name="color" value="${category?.color || '#6B7280'}">
            </div>
            <div class="form-group">
              <label>描述</label>
              <textarea name="description">${category?.description || ''}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" onclick="closeCategoryModal()">取消</button>
          <button class="btn-save" onclick="saveCategoryForm()">保存</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('category-modal');

  return {
    show: () => modal.style.display = 'flex',
    close: () => {
      modal.remove();
    },
    onSave
  };
}

// 关闭分类模态框
function closeCategoryModal() {
  const modal = document.getElementById('category-modal');
  if (modal) modal.remove();
}

// 保存分类表单
async function saveCategoryForm() {
  const form = document.getElementById('category-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());

  // 触发保存回调（通过全局变量传递）
  if (window.currentCategoryModalSave) {
    await window.currentCategoryModalSave(data);
  }
}

// 显示消息
function showMessage(message, type = 'info') {
  // 使用现有的showStatus函数或者创建自定义的消息提示
  if (window.showStatus) {
    showStatus('admin-graph-form-status', message, type);
  } else {
    alert(message);
  }
}

// 暴露到全局
window.initKnowledgeTreeView = initKnowledgeTreeView;
window.toggleCategory = toggleCategory;
window.expandAllCategories = expandAllCategories;
window.collapseAllCategories = collapseAllCategories;
window.showAddCategoryModal = showAddCategoryModal;
window.showAddSubCategoryModal = showAddSubCategoryModal;
window.editCategory = editCategory;
window.confirmDeleteCategory = confirmDeleteCategory;
window.editKnowledgePoint = editKnowledgePoint;
window.handleCategoryDragStart = handleCategoryDragStart;
window.handleKnowledgeDragStart = handleKnowledgeDragStart;
window.handleDragOver = handleDragOver;
window.handleCategoryDrop = handleCategoryDrop;
window.handleKnowledgeDrop = handleKnowledgeDrop;
window.handleDragEnd = handleDragEnd;
window.closeCategoryModal = closeCategoryModal;
window.saveCategoryForm = saveCategoryForm;
