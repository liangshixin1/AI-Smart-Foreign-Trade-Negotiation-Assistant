<template>
  <RoleWorkspaceLayout
    title="教学内容编辑"
    description="维护节点的理论精讲、视频与 PPT；草稿不会对学生开放。"
  >
    <nav><RouterLink to="/teacher/knowledge-graph">← 返回教学知识图谱</RouterLink></nav>
    <p v-if="loading" class="state">正在加载节点内容…</p>
    <form v-else-if="content" class="editor" @submit.prevent="save">
      <label>标题<input v-model.trim="form.title" required maxlength="255" /></label>
      <label>摘要<textarea v-model="form.summary" rows="3" /></label>
      <section class="asset-section">
        <div class="section-heading">
          <div>
            <span>教学媒体</span>
            <h2>上传讲解视频与演示文稿</h2>
          </div>
          <p>文件由系统受控保存，教师和学生可在页面内直接预览。</p>
        </div>
        <div class="assets-grid">
          <LearningAssetUploader
            kind="video"
            :asset="videoAsset"
            :busy="saving"
            @upload="uploadAsset"
            @remove="deleteAsset"
          />
          <LearningAssetUploader
            kind="slides"
            :asset="slidesAsset"
            :busy="saving"
            @upload="uploadAsset"
            @remove="deleteAsset"
          />
        </div>
        <LearningMediaGallery
          v-if="content.assets.length"
          :node-id="content.node_id"
          :assets="content.assets"
          audience="teacher"
        />
      </section>
      <div class="markdown-heading">
        <div>
          <span>理论精讲</span>
          <h2>Markdown 学习正文</h2>
        </div>
        <p>建议按学习目标、关键概念、案例和自测问题组织。</p>
      </div>
      <label class="markdown"
        ><span class="sr-only">理论精讲（Markdown）</span
        ><textarea v-model="form.markdown_body" rows="22" required />
      </label>
      <footer>
        <select v-model="form.status" aria-label="发布状态">
          <option value="draft">保存为草稿</option>
          <option value="published">发布给学生</option>
        </select>
        <button type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存内容' }}</button>
      </footer>
      <p v-if="message" aria-live="polite">{{ message }}</p>
    </form>
    <section v-else class="state error" role="alert">
      <p>{{ message }}</p>
      <button type="button" @click="reload">重试</button>
    </section>
  </RoleWorkspaceLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import RoleWorkspaceLayout from '@/app/layouts/RoleWorkspaceLayout.vue'
import LearningAssetUploader from '@/features/knowledge-graph/components/LearningAssetUploader.vue'
import LearningMediaGallery from '@/features/knowledge-graph/components/LearningMediaGallery.vue'
import { useTeacherLearningContent } from '@/features/knowledge-graph/composables/useLearningContent'

const route = useRoute()
const { content, form, loading, saving, message, reload, save, uploadAsset, deleteAsset } =
  useTeacherLearningContent(String(route.params.nodeId))
const videoAsset = computed(
  () => content.value?.assets.find((asset) => asset.kind === 'video') ?? null,
)
const slidesAsset = computed(
  () => content.value?.assets.find((asset) => asset.kind === 'slides') ?? null,
)
</script>

<style scoped>
nav {
  margin-bottom: var(--space-4);
}
nav a {
  color: var(--color-primary);
  font-weight: 700;
}
.editor {
  display: grid;
  gap: var(--space-4);
  padding: clamp(1rem, 3vw, 2rem);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}
label {
  display: grid;
  gap: var(--space-2);
  font-size: 0.82rem;
  font-weight: 700;
}
input,
textarea,
select {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-ink);
  background: white;
  font: inherit;
}
.markdown textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.55;
}
.asset-section {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.assets-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.section-heading,
.markdown-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: var(--space-4);
}
.section-heading span,
.markdown-heading span {
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 800;
}
.section-heading h2,
.markdown-heading h2,
.section-heading p,
.markdown-heading p {
  margin: 0;
}
.section-heading h2,
.markdown-heading h2 {
  margin-top: 0.15rem;
  font-size: 1rem;
}
.section-heading p,
.markdown-heading p {
  max-width: 36rem;
  color: var(--color-muted);
  font-size: 0.78rem;
}
footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}
footer select {
  width: auto;
}
button {
  padding: var(--space-3) var(--space-5);
  border: 0;
  border-radius: var(--radius-sm);
  color: white;
  background: var(--color-primary);
}
.state {
  padding: var(--space-8);
  text-align: center;
}
.error {
  color: var(--color-danger);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (max-width: 720px) {
  .assets-grid {
    grid-template-columns: 1fr;
  }
  .section-heading,
  .markdown-heading {
    display: grid;
  }
}
</style>
