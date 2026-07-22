<template>
  <RoleWorkspaceLayout
    title="技术与教学数据工作区"
    description="管理教师案例的导入、评审与演示发布，同时维护三个独立 Agent 的连接配置。"
  >
    <KnowledgeGraphImportPanel />
    <LlmConfigPanel />
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import KnowledgeGraphImportPanel from '@/features/technician/components/KnowledgeGraphImportPanel.vue'
import LlmConfigPanel from '@/features/technician/components/LlmConfigPanel.vue'
</script>
