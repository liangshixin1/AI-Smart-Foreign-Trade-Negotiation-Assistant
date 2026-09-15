<!-- [组件导读]
业务名词：图谱把业务阶段、商务现象、知识点和策略连成关系；Scaffold 是某次训练固定的学习支持库，overlay 是证据高亮层。
用途：将简化 Markdown 正文显示为标题、段落、引用和列表行。
逻辑：逐行识别有限的前缀，再由 Vue 文本插值渲染；它不是完整 Markdown 解析器，不把输入当作任意 HTML 执行。
结构：template 描述页面结构；script setup 声明输入、状态和事件；style 定义外观。
为什么：有限语法配合文本插值，避免把教师正文当作可执行 HTML；需要更多语法时应扩展解析规则并验证安全边界。
[/组件导读] -->
<template>
  <article class="markdown-content">
    <template v-for="(block, index) in blocks" :key="`${block.kind}-${String(index)}`">
      <h1 v-if="block.kind === 'h1'">{{ block.text }}</h1>
      <h2 v-else-if="block.kind === 'h2'">{{ block.text }}</h2>
      <h3 v-else-if="block.kind === 'h3'">{{ block.text }}</h3>
      <blockquote v-else-if="block.kind === 'quote'">{{ block.text }}</blockquote>
      <li v-else-if="block.kind === 'list'">{{ block.text }}</li>
      <p v-else>{{ block.text }}</p>
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type BlockKind = 'h1' | 'h2' | 'h3' | 'quote' | 'list' | 'paragraph'
interface Block {
  kind: BlockKind
  text: string
}
const props = defineProps<{ source: string }>()
const blocks = computed<Block[]>(() =>
  props.source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith('### ')) return { kind: 'h3', text: line.slice(4) }
      if (line.startsWith('## ')) return { kind: 'h2', text: line.slice(3) }
      if (line.startsWith('# ')) return { kind: 'h1', text: line.slice(2) }
      if (line.startsWith('> ')) return { kind: 'quote', text: line.slice(2) }
      if (/^[-*]\s/.test(line)) return { kind: 'list', text: line.slice(2) }
      return { kind: 'paragraph', text: line }
    }),
)
</script>

<style scoped>
.markdown-content {
  max-width: 76ch;
  color: var(--color-ink);
  line-height: 1.75;
}
h1,
h2,
h3 {
  margin: 1.5em 0 0.5em;
  line-height: 1.25;
}
h1 {
  font-size: 1.7rem;
}
h2 {
  font-size: 1.25rem;
}
h3 {
  font-size: 1rem;
}
blockquote {
  margin: var(--space-4) 0;
  padding: var(--space-3) var(--space-4);
  border-left: 3px solid var(--color-primary);
  color: var(--color-muted);
  background: var(--color-primary-soft);
}
li {
  margin-left: 1.3rem;
}
</style>
