# [导读] 所属业务: 教学知识图谱、学习内容与证据。
# [导读] 业务名词: 图谱用节点与关系表达阶段、商务现象、知识点和策略; Scaffold 是本次训练固定的学
# [导读] 习支持库。
# [导读] 用途与原因: 定义专家图谱到平台课程场景的绑定配置; 平台关卡关联属于扩展, 不应改写专家原
# [导读] 始节点。
# [导读] 结构: V3ScenarioBinding。
# [导读] 提醒: graph_version 与 node_key 一起定位内容; 显示短名不等于稳定编号, 历史证据不能随当
# [导读] 前图谱重写。
from __future__ import annotations

from typing import TypedDict


class V3ScenarioBinding(TypedDict):
    """课程场景对专家事实层的稳定、可审计教学映射。"""

    id: str
    stage_id: str
    title: str
    unit: str
    mode: str
    phenomenon_ids: tuple[str, ...]


# 场景属于平台课程映射, 不属于专家事实表。这里只保存稳定绑定所需的最小字段;
# 教学任务、角色、量规仍由 curriculum/training/assessment 模块负责。
V3_SCENARIOS: tuple[V3ScenarioBinding, ...] = (
    {
        "id": "S01",
        "stage_id": "S1",
        "title": "初次接触：索取目录",
        "unit": "初次接触：索取目录",
        "mode": "商务邮件",
        "phenomenon_ids": ("P1.05", "P1.07"),
    },
    {
        "id": "S02",
        "stage_id": "S1",
        "title": "发出具体询盘",
        "unit": "发出具体询盘",
        "mode": "商务邮件",
        "phenomenon_ids": ("P1.02", "P1.03"),
    },
    {
        "id": "S03",
        "stage_id": "S1",
        "title": "催询与条件探询",
        "unit": "催询与条件探询",
        "mode": "商务邮件",
        "phenomenon_ids": ("P1.01", "P1.06"),
    },
    {
        "id": "S04",
        "stage_id": "S2",
        "title": "识别虚盘并催实盘",
        "unit": "应对虚盘",
        "mode": "谈判对话",
        "phenomenon_ids": ("P2.01", "P2.05"),
    },
    {
        "id": "S05",
        "stage_id": "S2",
        "title": "审核实盘条款",
        "unit": "接收实盘并理解其约束力",
        "mode": "谈判对话",
        "phenomenon_ids": ("P2.02", "P2.07"),
    },
    {
        "id": "S06",
        "stage_id": "S3",
        "title": "价格还盘攻防",
        "unit": "价格还盘攻防",
        "mode": "谈判对话",
        "phenomenon_ids": ("P2.04", "P3.04", "P3.07"),
    },
    {
        "id": "S07",
        "stage_id": "S3",
        "title": "付款与交期磋商",
        "unit": "多维度磋商：付款与交期还盘",
        "mode": "谈判对话",
        "phenomenon_ids": ("P3.01", "P3.04", "P3.06"),
    },
    {
        "id": "S08",
        "stage_id": "S3",
        "title": "有条件接受与成交",
        "unit": "终局博弈：有条件接受、反建议与成交",
        "mode": "谈判对话",
        "phenomenon_ids": ("P3.02", "P4.02", "P4.03"),
    },
    {
        "id": "S09",
        "stage_id": "S4",
        "title": "确认成交",
        "unit": "确认成交与拟备销售确认书",
        "mode": "商务邮件",
        "phenomenon_ids": ("P4.03", "P4.05"),
    },
    {
        "id": "S10",
        "stage_id": "S4",
        "title": "催开信用证",
        "unit": "催开信用证",
        "mode": "商务邮件",
        "phenomenon_ids": ("P4.07",),
    },
    {
        "id": "S11",
        "stage_id": "S5",
        "title": "包装与唛头磋商",
        "unit": "包装与唛头磋商",
        "mode": "谈判对话",
        "phenomenon_ids": ("P5.01", "P5.02", "P5.08"),
    },
    {
        "id": "S12",
        "stage_id": "S5",
        "title": "分批转船与催装",
        "unit": "分批/转船磋商与催装",
        "mode": "谈判对话",
        "phenomenon_ids": ("P5.04", "P5.05", "P5.07"),
    },
    {
        "id": "S13",
        "stage_id": "S6",
        "title": "信用证审核改证",
        "unit": "信用证审核与改证",
        "mode": "单证审阅",
        "phenomenon_ids": ("P6.02", "P7.03"),
    },
    {
        "id": "S14",
        "stage_id": "S6",
        "title": "交单结汇与装运通知",
        "unit": "交单结汇与装运通知",
        "mode": "商务邮件",
        "phenomenon_ids": ("P5.05", "P6.02"),
    },
    {
        "id": "S15",
        "stage_id": "S7",
        "title": "检验条款磋商",
        "unit": "检验条款磋商",
        "mode": "谈判对话",
        "phenomenon_ids": ("P7.01", "P7.02", "P7.04", "P7.06"),
    },
    {
        "id": "S16",
        "stage_id": "S8",
        "title": "保险险别磋商",
        "unit": "投保险别磋商",
        "mode": "谈判对话",
        "phenomenon_ids": ("P8.01", "P8.02", "P8.06"),
    },
    {
        "id": "S17",
        "stage_id": "S8",
        "title": "仲裁条款磋商",
        "unit": "仲裁条款磋商",
        "mode": "谈判对话",
        "phenomenon_ids": ("P8.03", "P8.04", "P8.05", "P8.07"),
    },
    {
        "id": "S18",
        "stage_id": "S9",
        "title": "提出质量索赔",
        "unit": "提出质量索赔",
        "mode": "商务邮件",
        "phenomenon_ids": ("P9.01", "P9.03", "P9.04"),
    },
    {
        "id": "S19",
        "stage_id": "S9",
        "title": "应对卖方抗辩",
        "unit": "应对抗辩，证据反驳",
        "mode": "谈判对话",
        "phenomenon_ids": ("P9.04", "P9.05", "P9.07"),
    },
    {
        "id": "S20",
        "stage_id": "S9",
        "title": "理赔和解",
        "unit": "理赔和解",
        "mode": "谈判对话",
        "phenomenon_ids": ("P9.02", "P9.06", "P9.08"),
    },
)
