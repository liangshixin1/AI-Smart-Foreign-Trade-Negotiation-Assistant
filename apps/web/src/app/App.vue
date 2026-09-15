<!-- [组件导读]
业务名词：Attempt 是一次训练记录；学生负责练习，教师查看所属班级学情，技术人员维护平台运行配置。
用途：应用最外层入口，将当前地址对应的页面放入 RouterView。
逻辑：本文件只提供路由出口；角色判断和页面跳转应沿 app/router/index.ts 阅读。
结构：template 描述页面结构；script setup 声明依赖与逻辑，外观沿用共享样式。
为什么：页面由路由统一选择，避免在根组件重复维护角色与业务分支。
[/组件导读] -->
<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>
