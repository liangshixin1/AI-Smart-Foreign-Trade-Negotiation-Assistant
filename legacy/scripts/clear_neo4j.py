#!/usr/bin/env python3
"""清空Neo4j知识图谱数据库

使用方法：
    python scripts/clear_neo4j.py
"""

import os
import sys

# 添加项目根目录到Python路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)


def clear_neo4j_database():
    """清空Neo4j数据库中的所有节点和关系"""
    try:
        from neo4j import GraphDatabase

        # Neo4j连接配置
        NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://localhost:7687")
        NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
        NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "CHANGE_ME")

        print(f"🔗 正在连接到Neo4j数据库: {NEO4J_URI}")

        # 创建驱动
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

        # 验证连接
        driver.verify_connectivity()
        print("✅ 连接成功！")

        # 统计当前节点数
        with driver.session() as session:
            result = session.run("MATCH (n) RETURN count(n) as count")
            node_count = result.single()["count"]
            print(f"📊 当前数据库中有 {node_count} 个节点")

            if node_count == 0:
                print("✨ 数据库已经是空的！")
                driver.close()
                return

            # 确认操作
            confirm = input(f"\n⚠️  确认要删除所有 {node_count} 个节点吗？(输入 'yes' 确认): ")
            if confirm.lower() != 'yes':
                print("❌ 操作已取消")
                driver.close()
                return

            print("\n🗑️  正在删除所有节点和关系...")

            # 分批删除（避免内存溢出）
            batch_size = 1000
            deleted_total = 0

            while True:
                result = session.run(f"""
                    MATCH (n)
                    WITH n LIMIT {batch_size}
                    DETACH DELETE n
                    RETURN count(n) as deleted
                """)
                deleted = result.single()["deleted"]

                if deleted == 0:
                    break

                deleted_total += deleted
                print(f"  已删除 {deleted_total} 个节点...")

            print(f"✅ 成功删除 {deleted_total} 个节点！")

            # 验证清空结果
            result = session.run("MATCH (n) RETURN count(n) as count")
            remaining = result.single()["count"]

            if remaining == 0:
                print("🎉 数据库已完全清空！")
            else:
                print(f"⚠️  警告：还剩余 {remaining} 个节点")

        driver.close()
        print("\n💡 提示：现在可以重新导入知识图谱数据了")

    except ImportError:
        print("❌ 错误：未安装 neo4j 库")
        print("请运行: pip install neo4j")
        sys.exit(1)
    except Exception as e:
        print(f"❌ 错误：{str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    print("=" * 60)
    print("  Neo4j 知识图谱数据库清空工具")
    print("=" * 60)
    print()
    clear_neo4j_database()
