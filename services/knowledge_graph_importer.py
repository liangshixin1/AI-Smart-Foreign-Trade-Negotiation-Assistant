"""
知识图谱导入服务 - 重构版

简洁的三表导入实现：
1. 谈判流程表 (Stage节点)
2. 知识点主表 (KnowledgePoint节点)
3. 案例库表 (Practice节点，可选)

设计原则：
- 单一职责：每个函数只做一件事
- 清晰的数据流：Excel -> 解析 -> 验证 -> 导入Neo4j
- 统一的错误处理
- 详细的日志记录
"""

from __future__ import annotations

import io
import logging
from typing import Dict, List, Optional, BinaryIO, Tuple
from dataclasses import dataclass, field
from datetime import datetime

try:
    import openpyxl
    EXCEL_AVAILABLE = True
except ImportError:
    EXCEL_AVAILABLE = False

LOGGER = logging.getLogger(__name__)


# ============================================
# 数据结构定义
# ============================================

@dataclass
class ImportError:
    """导入错误"""
    level: str  # ERROR / WARNING
    sheet: str  # 谈判流程 / 知识点主表 / 案例库表
    row: int
    field: str = ""
    value: str = ""
    message: str = ""
    suggestion: str = ""


@dataclass
class ImportStats:
    """导入统计"""
    total: int = 0
    created: int = 0
    updated: int = 0
    failed: int = 0

    @property
    def success_rate(self) -> str:
        if self.total == 0:
            return "0%"
        return f"{(self.created + self.updated) / self.total * 100:.1f}%"


@dataclass
class ImportResult:
    """导入结果"""
    success: bool
    stages: ImportStats = field(default_factory=ImportStats)
    knowledge_points: ImportStats = field(default_factory=ImportStats)
    practices: ImportStats = field(default_factory=ImportStats)
    relations: ImportStats = field(default_factory=ImportStats)
    errors: List[ImportError] = field(default_factory=list)
    warnings: List[ImportError] = field(default_factory=list)
    duration_seconds: float = 0.0

    def to_dict(self) -> Dict:
        """转换为字典格式"""
        return {
            "success": self.success,
            "statistics": {
                "stages": {
                    "total": self.stages.total,
                    "created": self.stages.created,
                    "updated": self.stages.updated,
                    "failed": self.stages.failed,
                    "success_rate": self.stages.success_rate,
                },
                "points": {
                    "total": self.knowledge_points.total,
                    "created": self.knowledge_points.created,
                    "updated": self.knowledge_points.updated,
                    "failed": self.knowledge_points.failed,
                    "success_rate": self.knowledge_points.success_rate,
                },
                "practices": {
                    "total": self.practices.total,
                    "created": self.practices.created,
                    "failed": self.practices.failed,
                    "success_rate": self.practices.success_rate,
                },
                "relations": {
                    "total": self.relations.total,
                    "created": self.relations.created,
                    "failed": self.relations.failed,
                    "success_rate": self.relations.success_rate,
                },
            },
            "errors": [
                {
                    "level": e.level,
                    "sheet": e.sheet,
                    "row": e.row,
                    "field": e.field,
                    "value": e.value,
                    "message": e.message,
                    "suggestion": e.suggestion,
                }
                for e in self.errors
            ],
            "warnings": [
                {
                    "level": w.level,
                    "sheet": w.sheet,
                    "row": w.row,
                    "field": w.field,
                    "value": w.value,
                    "message": w.message,
                    "suggestion": w.suggestion,
                }
                for w in self.warnings
            ],
            "execution_time": f"{self.duration_seconds:.2f}s",
        }


# ============================================
# 主导入类
# ============================================

class KnowledgeGraphImporter:
    """知识图谱导入器"""

    def __init__(self, neo4j_driver):
        """
        初始化导入器

        Args:
            neo4j_driver: Neo4j数据库驱动
        """
        self.driver = neo4j_driver

    def import_from_excel(
        self,
        excel_file: BinaryIO,
        created_by: str = "system",
    ) -> ImportResult:
        """
        从Excel文件导入知识图谱

        Args:
            excel_file: Excel文件流
            created_by: 创建者标识

        Returns:
            ImportResult: 导入结果
        """
        import time
        start_time = time.time()

        result = ImportResult(success=False)

        try:
            # 步骤1: 读取Excel文件内容
            LOGGER.info("步骤1: 读取Excel文件...")
            if hasattr(excel_file, 'read'):
                file_content = excel_file.read()
            else:
                file_content = excel_file

            # 步骤2: 解析三个表的数据
            LOGGER.info("步骤2: 解析Excel数据...")
            stages_data, stages_errors = self._parse_stages(file_content)
            result.errors.extend(stages_errors)

            points_data, points_errors = self._parse_knowledge_points(file_content)
            result.errors.extend(points_errors)

            practices_data, practices_errors = self._parse_practices(file_content)
            result.errors.extend(practices_errors)

            LOGGER.info(f"  解析结果: {len(stages_data)}个阶段, {len(points_data)}个知识点, {len(practices_data)}个案例")

            # 步骤3: 验证数据
            LOGGER.info("步骤3: 验证数据...")
            validation_errors, validation_warnings = self._validate_data(
                stages_data, points_data, practices_data
            )
            result.errors.extend(validation_errors)
            result.warnings.extend(validation_warnings)

            # 检查是否有致命错误
            if any(e.level == "ERROR" for e in result.errors):
                error_count = len([e for e in result.errors if e.level == "ERROR"])
                LOGGER.error(f"发现 {error_count} 个错误，停止导入")
                result.duration_seconds = time.time() - start_time
                return result

            # 步骤4: 导入到Neo4j
            LOGGER.info("步骤4: 导入到Neo4j...")
            self._import_to_neo4j(
                stages_data, points_data, practices_data,
                result, created_by
            )

            result.success = True
            result.duration_seconds = time.time() - start_time

            LOGGER.info(
                f"导入完成: "
                f"阶段={result.stages.created}创建, "
                f"知识点={result.knowledge_points.created}创建/{result.knowledge_points.updated}更新, "
                f"案例={result.practices.created}创建, "
                f"关系={result.relations.created}创建"
            )

        except Exception as e:
            LOGGER.exception("导入失败")
            result.errors.append(ImportError(
                level="ERROR",
                sheet="系统",
                row=0,
                message=f"系统错误: {str(e)}",
            ))
            result.duration_seconds = time.time() - start_time

        return result

    # ========================================
    # 解析方法
    # ========================================

    def _parse_stages(self, file_content: bytes) -> Tuple[List[Dict], List[ImportError]]:
        """
        解析谈判流程表

        Returns:
            (阶段数据列表, 错误列表)
        """
        errors = []
        stages = []

        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)

            # 查找"谈判流程"Sheet
            if "谈判流程" not in wb.sheetnames:
                errors.append(ImportError(
                    level="ERROR",
                    sheet="谈判流程",
                    row=0,
                    message="未找到'谈判流程'Sheet",
                    suggestion="请确保Excel文件包含名为'谈判流程'的Sheet",
                ))
                wb.close()
                return [], errors

            ws = wb["谈判流程"]

            # 读取表头（第1行）
            headers = [str(cell).strip() if cell else "" for cell in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]

            # 构建列索引映射
            col_map = {}
            for idx, header in enumerate(headers):
                clean_header = header.replace('*', '').strip()
                if clean_header == "阶段名称":
                    col_map["name"] = idx
                elif clean_header == "英文名称":
                    col_map["englishName"] = idx
                elif clean_header == "阶段描述":
                    col_map["description"] = idx
                elif clean_header == "难度级别":
                    col_map["difficulty"] = idx
                elif clean_header == "预计时长(天)":
                    col_map["estimatedDuration"] = idx
                elif clean_header == "图标":
                    col_map["icon"] = idx
                elif clean_header == "颜色":
                    col_map["color"] = idx

            # 检查必填列
            if "name" not in col_map:
                errors.append(ImportError(
                    level="ERROR",
                    sheet="谈判流程",
                    row=1,
                    field="阶段名称",
                    message="缺少必填列'阶段名称'",
                ))
                wb.close()
                return [], errors

            # 读取数据（从第3行开始，跳过表头和示例行）
            order = 0
            for row_idx, row in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
                # 跳过空行
                if not any(row):
                    continue

                # 提取字段
                name = str(row[col_map["name"]]).strip() if len(row) > col_map["name"] and row[col_map["name"]] else ""

                # 跳过没有名称的行
                if not name:
                    continue

                stage = {
                    "name": name,
                    "order": order,
                    "_row": row_idx,
                }
                order += 1

                # 可选字段
                if "englishName" in col_map and len(row) > col_map["englishName"] and row[col_map["englishName"]]:
                    stage["englishName"] = str(row[col_map["englishName"]]).strip()

                if "description" in col_map and len(row) > col_map["description"] and row[col_map["description"]]:
                    stage["description"] = str(row[col_map["description"]]).strip()

                if "difficulty" in col_map and len(row) > col_map["difficulty"] and row[col_map["difficulty"]]:
                    difficulty = str(row[col_map["difficulty"]]).strip()
                    # 中文转英文
                    difficulty_map = {"初级": "beginner", "中级": "intermediate", "高级": "advanced"}
                    stage["difficulty"] = difficulty_map.get(difficulty, difficulty)

                if "estimatedDuration" in col_map and len(row) > col_map["estimatedDuration"] and row[col_map["estimatedDuration"]]:
                    try:
                        stage["estimatedDuration"] = int(row[col_map["estimatedDuration"]])
                    except (ValueError, TypeError):
                        stage["estimatedDuration"] = 7

                if "icon" in col_map and len(row) > col_map["icon"] and row[col_map["icon"]]:
                    stage["icon"] = str(row[col_map["icon"]]).strip()

                if "color" in col_map and len(row) > col_map["color"] and row[col_map["color"]]:
                    stage["color"] = str(row[col_map["color"]]).strip()

                stages.append(stage)

            wb.close()

            if len(stages) == 0:
                errors.append(ImportError(
                    level="ERROR",
                    sheet="谈判流程",
                    row=0,
                    message="未找到任何阶段数据",
                    suggestion="请在'谈判流程'Sheet的第3行及以后添加阶段数据",
                ))

        except Exception as e:
            LOGGER.exception("解析谈判流程表失败")
            errors.append(ImportError(
                level="ERROR",
                sheet="谈判流程",
                row=0,
                message=f"解析失败: {str(e)}",
            ))

        return stages, errors

    def _parse_knowledge_points(self, file_content: bytes) -> Tuple[List[Dict], List[ImportError]]:
        """
        解析知识点主表

        Returns:
            (知识点数据列表, 错误列表)
        """
        errors = []
        points = []

        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)

            # 查找"知识点主表"Sheet
            sheet_name = None
            for possible_name in ["知识点主表", "知识点", "Sheet2"]:
                if possible_name in wb.sheetnames:
                    sheet_name = possible_name
                    break

            if not sheet_name:
                errors.append(ImportError(
                    level="WARNING",
                    sheet="知识点主表",
                    row=0,
                    message="未找到'知识点主表'Sheet",
                    suggestion="知识点导入将跳过",
                ))
                wb.close()
                return [], errors

            ws = wb[sheet_name]

            # 读取表头
            headers = [str(cell).strip() if cell else "" for cell in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]

            # 构建列索引映射
            col_map = {}
            for idx, header in enumerate(headers):
                clean_header = header.replace('*', '').strip()
                if clean_header == "知识点名称":
                    col_map["name"] = idx
                elif clean_header == "所属阶段":
                    col_map["stage"] = idx
                elif clean_header == "知识点类型":
                    col_map["type"] = idx
                elif clean_header == "难度":
                    col_map["difficulty"] = idx
                elif clean_header == "重要性":
                    col_map["importance"] = idx
                elif clean_header == "内容简介":
                    col_map["summary"] = idx
                elif clean_header == "详细描述":
                    col_map["description"] = idx
                elif clean_header == "章节":
                    col_map["chapter"] = idx

            # 检查必填列
            if "name" not in col_map:
                errors.append(ImportError(
                    level="ERROR",
                    sheet="知识点主表",
                    row=1,
                    field="知识点名称",
                    message="缺少必填列'知识点名称'",
                ))
                wb.close()
                return [], errors

            # 读取数据（从第3行开始）
            for row_idx, row in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
                # 跳过空行
                if not any(row):
                    continue

                # 提取字段
                name = str(row[col_map["name"]]).strip() if len(row) > col_map["name"] and row[col_map["name"]] else ""

                # 跳过没有名称的行
                if not name:
                    continue

                point = {
                    "name": name,
                    "_row": row_idx,
                }

                # 可选字段
                if "stage" in col_map and len(row) > col_map["stage"] and row[col_map["stage"]]:
                    point["stage"] = str(row[col_map["stage"]]).strip()

                if "type" in col_map and len(row) > col_map["type"] and row[col_map["type"]]:
                    point["type"] = str(row[col_map["type"]]).strip()

                if "difficulty" in col_map and len(row) > col_map["difficulty"] and row[col_map["difficulty"]]:
                    difficulty = str(row[col_map["difficulty"]]).strip()
                    difficulty_map = {"初级": "beginner", "中级": "intermediate", "高级": "advanced"}
                    point["difficulty"] = difficulty_map.get(difficulty, difficulty)

                if "importance" in col_map and len(row) > col_map["importance"] and row[col_map["importance"]]:
                    point["importance"] = str(row[col_map["importance"]]).strip()

                if "summary" in col_map and len(row) > col_map["summary"] and row[col_map["summary"]]:
                    point["summary"] = str(row[col_map["summary"]]).strip()

                if "description" in col_map and len(row) > col_map["description"] and row[col_map["description"]]:
                    point["description"] = str(row[col_map["description"]]).strip()

                if "chapter" in col_map and len(row) > col_map["chapter"] and row[col_map["chapter"]]:
                    point["chapter"] = str(row[col_map["chapter"]]).strip()

                points.append(point)

            wb.close()

        except Exception as e:
            LOGGER.exception("解析知识点主表失败")
            errors.append(ImportError(
                level="ERROR",
                sheet="知识点主表",
                row=0,
                message=f"解析失败: {str(e)}",
            ))

        return points, errors

    def _parse_practices(self, file_content: bytes) -> Tuple[List[Dict], List[ImportError]]:
        """
        解析案例库表（可选）

        Returns:
            (案例数据列表, 错误列表)
        """
        errors = []
        practices = []

        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), read_only=True, data_only=True)

            # 查找"案例库表"Sheet
            sheet_name = None
            for possible_name in ["案例库表", "案例库", "Sheet3"]:
                if possible_name in wb.sheetnames:
                    sheet_name = possible_name
                    break

            if not sheet_name:
                # 案例库是可选的，不报错
                wb.close()
                return [], errors

            ws = wb[sheet_name]

            # 读取表头
            headers = [str(cell).strip() if cell else "" for cell in next(ws.iter_rows(min_row=1, max_row=1, values_only=True))]

            # 构建列索引映射
            col_map = {}
            for idx, header in enumerate(headers):
                clean_header = header.replace('*', '').strip()
                if clean_header == "关联知识点":
                    col_map["knowledgePoint"] = idx
                elif clean_header == "案例标题":
                    col_map["title"] = idx
                elif clean_header == "案例场景":
                    col_map["scenario"] = idx
                elif clean_header == "案例内容":
                    col_map["content"] = idx

            # 读取数据（从第3行开始）
            for row_idx, row in enumerate(ws.iter_rows(min_row=3, values_only=True), start=3):
                # 跳过空行
                if not any(row):
                    continue

                practice = {"_row": row_idx}

                if "knowledgePoint" in col_map and len(row) > col_map["knowledgePoint"] and row[col_map["knowledgePoint"]]:
                    practice["knowledgePoint"] = str(row[col_map["knowledgePoint"]]).strip()

                if "title" in col_map and len(row) > col_map["title"] and row[col_map["title"]]:
                    practice["title"] = str(row[col_map["title"]]).strip()

                if "scenario" in col_map and len(row) > col_map["scenario"] and row[col_map["scenario"]]:
                    practice["scenario"] = str(row[col_map["scenario"]]).strip()

                if "content" in col_map and len(row) > col_map["content"] and row[col_map["content"]]:
                    practice["content"] = str(row[col_map["content"]]).strip()

                # 至少需要标题或内容
                if "title" in practice or "content" in practice:
                    practices.append(practice)

            wb.close()

        except Exception as e:
            LOGGER.exception("解析案例库表失败")
            errors.append(ImportError(
                level="WARNING",
                sheet="案例库表",
                row=0,
                message=f"解析失败: {str(e)}",
            ))

        return practices, errors

    # ========================================
    # 验证方法
    # ========================================

    def _validate_data(
        self,
        stages: List[Dict],
        points: List[Dict],
        practices: List[Dict],
    ) -> Tuple[List[ImportError], List[ImportError]]:
        """
        验证数据完整性

        Returns:
            (错误列表, 警告列表)
        """
        errors = []
        warnings = []

        # 建立阶段名称集合
        stage_names = {s["name"] for s in stages}

        # 建立知识点名称集合
        point_names = {p["name"] for p in points}

        # 验证知识点引用的阶段是否存在
        for point in points:
            if "stage" in point:
                if point["stage"] not in stage_names:
                    warnings.append(ImportError(
                        level="WARNING",
                        sheet="知识点主表",
                        row=point.get("_row", 0),
                        field="所属阶段",
                        value=point["stage"],
                        message=f"阶段'{point['stage']}'不存在",
                        suggestion=f"可用阶段: {', '.join(list(stage_names)[:5])}",
                    ))

        # 验证案例引用的知识点是否存在
        for practice in practices:
            if "knowledgePoint" in practice:
                if practice["knowledgePoint"] not in point_names:
                    warnings.append(ImportError(
                        level="WARNING",
                        sheet="案例库表",
                        row=practice.get("_row", 0),
                        field="关联知识点",
                        value=practice["knowledgePoint"],
                        message=f"知识点'{practice['knowledgePoint']}'不存在",
                        suggestion="该案例将被跳过",
                    ))

        return errors, warnings

    # ========================================
    # 导入方法
    # ========================================

    def _import_to_neo4j(
        self,
        stages: List[Dict],
        points: List[Dict],
        practices: List[Dict],
        result: ImportResult,
        created_by: str,
    ):
        """导入数据到Neo4j"""

        # 设置统计
        result.stages.total = len(stages)
        result.knowledge_points.total = len(points)
        result.practices.total = len(practices)

        # 第1步：创建Stage节点
        LOGGER.info(f"第1步: 创建 {len(stages)} 个Stage节点...")
        stage_names = set()
        for stage in stages:
            try:
                self._create_stage(stage, created_by)
                result.stages.created += 1
                stage_names.add(stage["name"])
                LOGGER.debug(f"  创建Stage: {stage['name']}")
            except Exception as e:
                LOGGER.error(f"  创建Stage失败 {stage['name']}: {e}")
                result.stages.failed += 1

        # 第2步：创建Stage之间的PRECEDES关系
        LOGGER.info(f"第2步: 创建Stage顺序关系...")
        sorted_stages = sorted(stages, key=lambda s: s.get("order", 0))
        for i in range(len(sorted_stages) - 1):
            from_stage = sorted_stages[i]["name"]
            to_stage = sorted_stages[i + 1]["name"]

            if from_stage in stage_names and to_stage in stage_names:
                try:
                    self._create_precedes_relation(from_stage, to_stage, created_by)
                    result.relations.created += 1
                    result.relations.total += 1
                    LOGGER.debug(f"  创建关系: {from_stage} -> {to_stage}")
                except Exception as e:
                    LOGGER.error(f"  创建关系失败 {from_stage}->{to_stage}: {e}")
                    result.relations.failed += 1
                    result.relations.total += 1

        # 第3步：创建KnowledgePoint节点
        LOGGER.info(f"第3步: 创建 {len(points)} 个KnowledgePoint节点...")
        point_names = set()
        point_stage_map = {}  # 记录知识点和阶段的对应关系

        for point in points:
            point_name = point["name"]
            stage_name = point.pop("stage", None)  # 移除stage字段，不存入节点
            point.pop("_row", None)  # 移除辅助字段

            try:
                # 检查是否已存在
                existing = self._get_knowledge_point(point_name)
                if existing:
                    self._update_knowledge_point(point_name, point)
                    result.knowledge_points.updated += 1
                    LOGGER.debug(f"  更新知识点: {point_name}")
                else:
                    self._create_knowledge_point(point)
                    result.knowledge_points.created += 1
                    LOGGER.debug(f"  创建知识点: {point_name}")

                point_names.add(point_name)
                if stage_name:
                    point_stage_map[point_name] = stage_name

            except Exception as e:
                LOGGER.error(f"  创建/更新知识点失败 {point_name}: {e}")
                result.knowledge_points.failed += 1

        # 第4步：创建Stage-KnowledgePoint的HAS_TOPIC关系
        LOGGER.info(f"第4步: 创建Stage-KnowledgePoint关系...")
        for point_name, stage_name in point_stage_map.items():
            if stage_name in stage_names and point_name in point_names:
                try:
                    self._create_has_topic_relation(stage_name, point_name, created_by)
                    result.relations.created += 1
                    result.relations.total += 1
                    LOGGER.debug(f"  创建关系: {stage_name} -> {point_name}")
                except Exception as e:
                    LOGGER.error(f"  创建关系失败 {stage_name}->{point_name}: {e}")
                    result.relations.failed += 1
                    result.relations.total += 1

        # 第5步：创建Practice节点和关系（如果有）
        if practices:
            LOGGER.info(f"第5步: 创建 {len(practices)} 个Practice节点...")
            for practice in practices:
                kp_name = practice.pop("knowledgePoint", None)
                practice.pop("_row", None)

                # 只有关联的知识点存在才创建
                if kp_name and kp_name in point_names:
                    try:
                        practice_id = self._create_practice(practice, created_by)
                        result.practices.created += 1
                        LOGGER.debug(f"  创建案例: {practice.get('title', practice_id)}")

                        # 创建关联关系
                        self._create_has_practice_relation(kp_name, practice_id, created_by)
                        result.relations.created += 1
                        result.relations.total += 1
                    except Exception as e:
                        LOGGER.error(f"  创建案例失败: {e}")
                        result.practices.failed += 1

    # ========================================
    # Neo4j操作方法
    # ========================================

    def _create_stage(self, stage: Dict, created_by: str):
        """创建Stage节点"""
        query = """
        MERGE (s:Stage {name: $name})
        SET s.englishName = $englishName,
            s.description = $description,
            s.difficulty = $difficulty,
            s.estimatedDuration = $estimatedDuration,
            s.icon = $icon,
            s.color = $color,
            s.updatedAt = datetime(),
            s.updatedBy = $createdBy
        ON CREATE SET
            s.createdAt = datetime(),
            s.createdBy = $createdBy
        RETURN s.name AS name
        """
        params = {
            "name": stage.get("name"),
            "englishName": stage.get("englishName", ""),
            "description": stage.get("description", ""),
            "difficulty": stage.get("difficulty", "intermediate"),
            "estimatedDuration": stage.get("estimatedDuration", 7),
            "icon": stage.get("icon", "🔵"),
            "color": stage.get("color", "#3B82F6"),
            "createdBy": created_by,
        }

        with self.driver.session() as session:
            session.run(query, params)

    def _create_precedes_relation(self, from_stage: str, to_stage: str, created_by: str):
        """创建PRECEDES关系"""
        query = """
        MATCH (s1:Stage {name: $from_stage})
        MATCH (s2:Stage {name: $to_stage})
        MERGE (s1)-[r:PRECEDES]->(s2)
        ON CREATE SET r.createdAt = datetime(), r.createdBy = $createdBy
        RETURN s1.name AS from, s2.name AS to
        """
        params = {
            "from_stage": from_stage,
            "to_stage": to_stage,
            "createdBy": created_by,
        }

        with self.driver.session() as session:
            session.run(query, params)

    def _get_knowledge_point(self, name: str) -> Optional[Dict]:
        """检查知识点是否存在"""
        query = "MATCH (k:KnowledgePoint {name: $name}) RETURN k"
        with self.driver.session() as session:
            result = session.run(query, {"name": name})
            record = result.single()
            return dict(record["k"]) if record else None

    def _create_knowledge_point(self, point: Dict):
        """创建知识点节点"""
        query = """
        CREATE (k:KnowledgePoint {
            name: $name,
            type: $type,
            difficulty: $difficulty,
            importance: $importance,
            summary: $summary,
            description: $description,
            chapter: $chapter,
            createdAt: datetime(),
            updatedAt: datetime()
        })
        RETURN k.name AS name
        """
        params = {
            "name": point.get("name"),
            "type": point.get("type", "concept"),
            "difficulty": point.get("difficulty", "intermediate"),
            "importance": point.get("importance", "recommended"),
            "summary": point.get("summary", ""),
            "description": point.get("description", ""),
            "chapter": point.get("chapter", ""),
        }

        with self.driver.session() as session:
            session.run(query, params)

    def _update_knowledge_point(self, name: str, point: Dict):
        """更新知识点节点"""
        query = """
        MATCH (k:KnowledgePoint {name: $name})
        SET k.type = $type,
            k.difficulty = $difficulty,
            k.importance = $importance,
            k.summary = $summary,
            k.description = $description,
            k.chapter = $chapter,
            k.updatedAt = datetime()
        RETURN k.name AS name
        """
        params = {
            "name": name,
            "type": point.get("type", "concept"),
            "difficulty": point.get("difficulty", "intermediate"),
            "importance": point.get("importance", "recommended"),
            "summary": point.get("summary", ""),
            "description": point.get("description", ""),
            "chapter": point.get("chapter", ""),
        }

        with self.driver.session() as session:
            session.run(query, params)

    def _create_has_topic_relation(self, stage_name: str, point_name: str, created_by: str):
        """创建HAS_TOPIC关系"""
        query = """
        MATCH (s:Stage {name: $stage_name})
        MATCH (k:KnowledgePoint {name: $point_name})
        MERGE (s)-[r:HAS_TOPIC]->(k)
        ON CREATE SET r.createdAt = datetime(), r.createdBy = $createdBy
        RETURN s.name AS stage, k.name AS point
        """
        params = {
            "stage_name": stage_name,
            "point_name": point_name,
            "createdBy": created_by,
        }

        with self.driver.session() as session:
            session.run(query, params)

    def _create_practice(self, practice: Dict, created_by: str) -> str:
        """创建Practice节点"""
        import hashlib
        practice_id = hashlib.md5(
            f"{practice.get('title', '')}{practice.get('content', '')}".encode()
        ).hexdigest()[:12]

        query = """
        CREATE (p:Practice {
            id: $id,
            title: $title,
            scenario: $scenario,
            content: $content,
            createdAt: datetime(),
            createdBy: $createdBy
        })
        RETURN p.id AS id
        """
        params = {
            "id": practice_id,
            "title": practice.get("title", ""),
            "scenario": practice.get("scenario", ""),
            "content": practice.get("content", ""),
            "createdBy": created_by,
        }

        with self.driver.session() as session:
            session.run(query, params)

        return practice_id

    def _create_has_practice_relation(self, point_name: str, practice_id: str, created_by: str):
        """创建HAS_PRACTICE关系"""
        query = """
        MATCH (k:KnowledgePoint {name: $point_name})
        MATCH (p:Practice {id: $practice_id})
        MERGE (k)-[r:HAS_PRACTICE]->(p)
        ON CREATE SET r.createdAt = datetime(), r.createdBy = $createdBy
        RETURN k.name AS point, p.id AS practice
        """
        params = {
            "point_name": point_name,
            "practice_id": practice_id,
            "createdBy": created_by,
        }

        with self.driver.session() as session:
            session.run(query, params)
