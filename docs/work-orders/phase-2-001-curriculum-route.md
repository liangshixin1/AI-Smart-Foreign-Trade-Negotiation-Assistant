# 阶段 2-001 完成报告：3-1 课程资产、路线与准备页

## 1. 实际完成内容

- 将 `chapter-3-section-1` 迁移为独立课程、章节、小节、训练模板、三用途提示词和结构化量规 YAML。
- 场景提示只含学生可见任务约束；对话提示中的成本、价格底线和 BATNA 只保存在服务端内容资产。
- 建立 `Course/CourseVersion/Chapter/TrainingUnit/TrainingTemplate/PromptTemplate/Rubric` 数据模型。
- 建立 `Classroom/Enrollment`，学生当前课程必须通过有效班级成员关系解析。
- 新增 Alembic `20260714_0002`，从认证骨架升级到课程与教学组织模型。
- 新增显式、幂等的 `import-curriculum`，校验提示变量、引用、先修和量规权重；同版本内容哈希变化返回冲突。
- 新增开发班级 seed 命令，不在应用启动时自动导入或初始化。
- 实现 `GET /api/v1/courses/current/map` 和 `GET /api/v1/units/{unit_id}`；教师访问学生路线端点返回 403。
- 学生首页由占位页升级为课程进度头和章节路线，小节可进入训练准备页查看目标、时长、模式和评价维度。
- “开始训练”保持禁用并明确标注下一工单接入，避免在 Attempt 未实现前制造假流程。

## 2. 修改文件

- `content/curriculum/course.yaml`
- `content/curriculum/chapters/chapter-03.yaml`
- `content/training-templates/price-negotiation.yaml`
- `content/prompts/{scenario,conversation,evaluation}/*.yaml`
- `content/rubrics/negotiation.yaml`
- `apps/api/alembic/versions/20260714_0002_curriculum_slice.py`
- `apps/api/app/modules/classrooms/*`
- `apps/api/app/modules/curriculum/*`
- `apps/api/app/db/base.py`, `db/types.py`, `main.py`, `cli.py`
- `apps/api/tests/test_curriculum.py` 及相关 fixture/迁移测试
- `apps/web/src/features/curriculum/*`
- `apps/web/src/pages/student/StudentHomePage.vue`
- `apps/web/src/pages/student/UnitPreparationPage.vue`
- `apps/web/src/app/router/index.ts`

## 3. 数据库迁移

`20260714_0002` 新增：`courses`, `course_versions`, `chapters`, `training_units`, `training_templates`, `prompt_templates`, `rubrics`, `classrooms`, `enrollments`。

真实空库命令成功依次执行 0001、0002；随后真实执行：

```text
Development users are ready.
Curriculum version ready: 1.0.0-slice.1 (e665974d6e62)
Development classroom and enrollment are ready.
```

## 4. 测试命令与真实结果

最终 `pnpm check`：

- Prettier、Ruff format：通过。
- ESLint、Ruff lint：通过。
- Vue TypeScript：通过。
- Mypy strict：33 个源文件无问题。
- Web：2 个文件、4 个测试通过。
- API：11 个测试通过，覆盖内容导入幂等、路线/小节访问和角色越权。
- Vite build：76 modules transformed，成功。
- 文件行数：通过；迁移 importer 拆分 repository 后 service 文件低于 200 行。

## 5. 尚未解决

- 当前课程版本有且只有 3-1，一个小节不代表 20 小节已迁移。
- `completed_units` 暂为 0，状态暂为 `available`；必须等待 Attempt/ProgressRecord 后由服务器确定性计算。
- 训练准备页还没有动态场景，开始按钮按设计禁用。
- PostgreSQL CI 和生产 Cookie 认证仍是前一工单记录的部署硬门槛。

## 6. 验收对照

| 标准                       | 结果                                |
| -------------------------- | ----------------------------------- |
| 版本化内容拆分             | 通过                                |
| 三提示词独立且变量校验     | 通过                                |
| 量规权重校验               | 通过                                |
| 发布版本内容哈希与幂等导入 | 通过                                |
| 学生按班级取得当前课程     | 通过                                |
| 教师不能冒用学生路线 API   | 通过                                |
| 路线和准备页为 Vue SFC     | 通过                                |
| API 不散落在页面           | 通过，集中在 feature API/composable |
| 全质量门                   | 通过                                |
