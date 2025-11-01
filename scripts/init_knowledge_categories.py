#!/usr/bin/env python3
"""初始化知识分类数据

为外贸谈判实训平台创建初始的知识分类树结构
"""

import os
import sys

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import knowledge_service


def create_initial_categories():
    """创建初始的知识分类树"""

    categories = [
        # 一级分类
        {
            "id": "trade_basics",
            "name": "贸易基础",
            "code": "TB",
            "level": 1,
            "order_index": 0,
            "icon": "📚",
            "color": "#3b82f6",
            "description": "国际贸易基础知识",
        },
        {
            "id": "negotiation_skills",
            "name": "谈判技巧",
            "code": "NS",
            "level": 1,
            "order_index": 1,
            "icon": "🤝",
            "color": "#10b981",
            "description": "商务谈判技能和策略",
        },
        {
            "id": "legal_regulations",
            "name": "法律法规",
            "code": "LR",
            "level": 1,
            "order_index": 2,
            "icon": "⚖️",
            "color": "#8b5cf6",
            "description": "国际贸易相关法律法规",
        },
        {
            "id": "documents",
            "name": "贸易文档",
            "code": "DOC",
            "level": 1,
            "order_index": 3,
            "icon": "📄",
            "color": "#f59e0b",
            "description": "国际贸易常用文档",
        },

        # 贸易基础 - 二级分类
        {
            "id": "trade_terms",
            "name": "贸易术语",
            "code": "TT",
            "level": 2,
            "order_index": 0,
            "icon": "💼",
            "color": "#60a5fa",
            "description": "国际贸易术语详解",
            "parent_id": "trade_basics",
        },
        {
            "id": "payment_methods",
            "name": "支付方式",
            "code": "PM",
            "level": 2,
            "order_index": 1,
            "icon": "💳",
            "color": "#60a5fa",
            "description": "国际贸易支付方式",
            "parent_id": "trade_basics",
        },
        {
            "id": "logistics",
            "name": "物流运输",
            "code": "LOG",
            "level": 2,
            "order_index": 2,
            "icon": "🚢",
            "color": "#60a5fa",
            "description": "国际物流与运输",
            "parent_id": "trade_basics",
        },

        # 谈判技巧 - 二级分类
        {
            "id": "communication",
            "name": "沟通技巧",
            "code": "COMM",
            "level": 2,
            "order_index": 0,
            "icon": "💬",
            "color": "#34d399",
            "description": "商务沟通与交流技巧",
            "parent_id": "negotiation_skills",
        },
        {
            "id": "strategies",
            "name": "谈判策略",
            "code": "STRAT",
            "level": 2,
            "order_index": 1,
            "icon": "🎯",
            "color": "#34d399",
            "description": "谈判策略与方法",
            "parent_id": "negotiation_skills",
        },
        {
            "id": "case_studies",
            "name": "案例分析",
            "code": "CASE",
            "level": 2,
            "order_index": 2,
            "icon": "📋",
            "color": "#34d399",
            "description": "真实谈判案例分析",
            "parent_id": "negotiation_skills",
        },
    ]

    created_count = 0
    failed_count = 0

    print("🚀 开始创建知识分类...")
    print("=" * 60)

    for category in categories:
        try:
            result = knowledge_service.create_knowledge_category(**category)
            print(f"✅ 创建分类: {category['name']} ({category['id']})")
            created_count += 1
        except Exception as e:
            print(f"❌ 创建失败: {category['name']} - {str(e)}")
            failed_count += 1

    print("=" * 60)
    print(f"📊 创建完成: 成功 {created_count} 个，失败 {failed_count} 个")

    # 打印分类树
    print("\n🌳 当前分类树结构:")
    print_category_tree()


def print_category_tree():
    """打印分类树结构"""
    try:
        tree = knowledge_service.get_category_tree()
        for category in tree:
            print(f"\n{category['icon']} {category['name']} ({category['id']})")
            if category.get('children'):
                for child in category['children']:
                    print(f"  ├─ {child['icon']} {child['name']} ({child['id']})")
                    if child.get('children'):
                        for subchild in child['children']:
                            print(f"  │  └─ {subchild['icon']} {subchild['name']} ({subchild['id']})")
    except Exception as e:
        print(f"❌ 获取分类树失败: {str(e)}")


def assign_existing_knowledge_points():
    """将现有知识点分配到分类"""
    print("\n📌 开始分配现有知识点到分类...")

    # 定义知识点到分类的映射关系
    knowledge_mapping = {
        "FOB": "trade_terms",
        "CIF": "trade_terms",
        "CFR": "trade_terms",
        "EXW": "trade_terms",
        "L/C": "payment_methods",
        "T/T": "payment_methods",
        "D/P": "payment_methods",
        "D/A": "payment_methods",
    }

    try:
        # 获取所有知识点
        all_points = knowledge_service.list_knowledge_points()

        assigned_count = 0
        for point in all_points:
            name = point.get('name', '')
            # 查找映射
            for kp_name, category_id in knowledge_mapping.items():
                if kp_name in name or name in kp_name:
                    try:
                        knowledge_service.move_knowledge_point_to_category(
                            knowledge_name=name,
                            new_category_id=category_id,
                            order_index=0,
                            updated_by="init_script"
                        )
                        print(f"  ✅ {name} → {category_id}")
                        assigned_count += 1
                        break
                    except Exception as e:
                        print(f"  ❌ 分配失败: {name} - {str(e)}")

        print(f"\n📊 分配完成: 共分配 {assigned_count} 个知识点")

    except Exception as e:
        print(f"❌ 分配知识点失败: {str(e)}")


if __name__ == "__main__":
    print("🎓 外贸谈判知识分类初始化脚本")
    print("=" * 60)

    try:
        # 创建分类
        create_initial_categories()

        # 分配现有知识点
        assign_existing_knowledge_points()

        print("\n✨ 初始化完成！")

    except Exception as e:
        print(f"\n❌ 初始化失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
