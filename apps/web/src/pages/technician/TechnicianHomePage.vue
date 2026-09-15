<!-- [组件导读]
业务名词：变更集是待评审的图谱改动；发布版是通过评审后可读取的图数据，模型配置按生成场景、对话和评价分用途。
用途：技术工作区首页，汇集模型配置、图谱导入和信用证环境检查。
逻辑：本页主要负责组合三个功能面板，具体请求与交互下沉到各面板及其状态模块。
结构：template 描述页面结构；script setup 声明依赖与逻辑，外观沿用共享样式。
阅读线索：子组件 CorrectionHealth、RoleWorkspaceLayout、KnowledgeGraphImportPanel、LlmConfigPanel。
为什么：将导入、评审和发布状态分开，避免把文件上传成功误当作教学内容已经对学生生效。
[/组件导读] -->
<template>
  <RoleWorkspaceLayout
    title="技术与教学数据工作区"
    description="管理教师案例的导入、评审与演示发布，同时维护三个独立 Agent 的连接配置。"
  >
    <CorrectionHealth />
    <KnowledgeGraphImportPanel />
    <LlmConfigPanel />
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import CorrectionHealth from '@/features/document-correction/components/CorrectionHealth.vue'
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import KnowledgeGraphImportPanel from '@/features/technician/components/KnowledgeGraphImportPanel.vue'
import LlmConfigPanel from '@/features/technician/components/LlmConfigPanel.vue'
</script>
