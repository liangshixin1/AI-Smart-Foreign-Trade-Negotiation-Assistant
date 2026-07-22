#!/bin/bash
# Neo4j Local Setup Script
# 本地Neo4j环境一键配置脚本

set -e  # 遇到错误立即退出

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    print_info "检查Docker环境..."

    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装！请先安装Docker。"
        print_info "访问: https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose未安装！请先安装Docker Compose。"
        exit 1
    fi

    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        print_error "Docker未运行！请启动Docker Desktop或Docker服务。"
        exit 1
    fi

    print_success "Docker环境正常"
}

# 检查端口是否被占用
check_ports() {
    print_info "检查端口占用情况..."

    if lsof -Pi :7474 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "端口7474已被占用，Neo4j Browser可能无法访问"
        print_info "请停止占用该端口的服务，或修改docker-compose.neo4j.yml中的端口映射"
    fi

    if lsof -Pi :7687 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        print_warning "端口7687已被占用，应用可能无法连接Neo4j"
        print_info "请停止占用该端口的服务，或修改docker-compose.neo4j.yml中的端口映射"
    fi
}

# 创建.env文件
setup_env_file() {
    print_info "配置环境变量..."

    if [ -f ".env" ]; then
        print_warning ".env文件已存在，跳过创建"
        return
    fi

    if [ ! -f ".env.example" ]; then
        print_error ".env.example文件不存在！"
        exit 1
    fi

    cp .env.example .env
    print_success "已创建.env文件"
    print_info "请编辑.env文件，填入你的OpenAI API Key等配置"
}

# 启动Neo4j
start_neo4j() {
    print_info "启动Neo4j服务..."

    # 检查docker-compose文件
    if [ ! -f "docker-compose.neo4j.yml" ]; then
        print_error "docker-compose.neo4j.yml文件不存在！"
        exit 1
    fi

    # 启动服务
    docker-compose -f docker-compose.neo4j.yml up -d

    print_success "Neo4j服务已启动"
    print_info "等待Neo4j启动完成..."

    # 等待健康检查通过（最多60秒）
    local max_attempts=30
    local attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker inspect foreign-trade-neo4j 2>/dev/null | grep -q '"Health": *{' ; then
            health_status=$(docker inspect foreign-trade-neo4j | grep '"Status":' | grep -o '"[^"]*"' | tail -1 | tr -d '"')
            if [ "$health_status" = "healthy" ]; then
                print_success "Neo4j启动成功！"
                return
            fi
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done

    print_warning "Neo4j可能仍在启动中，请稍等片刻"
}

# 运行数据库迁移
run_migration() {
    print_info "运行知识图谱增强迁移..."

    if [ ! -f "migrations/001_enhance_knowledge_graph.py" ]; then
        print_warning "迁移脚本不存在，跳过"
        return
    fi

    # 检查Python依赖
    if ! python3 -c "import neo4j" 2>/dev/null; then
        print_warning "neo4j Python包未安装，跳过迁移"
        print_info "请运行: pip install neo4j"
        return
    fi

    # 运行迁移
    if python3 migrations/001_enhance_knowledge_graph.py; then
        print_success "数据库迁移成功！"
    else
        print_error "数据库迁移失败！请查看错误信息"
        return 1
    fi
}

# 显示访问信息
show_access_info() {
    echo ""
    echo "========================================="
    print_success "Neo4j本地环境配置完成！"
    echo "========================================="
    echo ""
    echo "📦 Neo4j Browser:"
    echo "   URL: http://localhost:7474"
    echo "   用户名: neo4j"
    echo "   密码: 使用 .env 中自行设置的强密码"
    echo ""
    echo "🔌 应用连接配置:"
    echo "   NEO4J_URI=neo4j://localhost:7687"
    echo "   NEO4J_USER=neo4j"
    echo "   NEO4J_PASSWORD=CHANGE_ME"
    echo ""
    echo "📝 下一步操作:"
    echo "   1. 访问 http://localhost:7474 验证Neo4j"
    echo "   2. 编辑 .env 文件，配置OpenAI API Key"
    echo "   3. 运行: pip install -r requirements.txt"
    echo "   4. 运行: python app.py"
    echo "   5. 访问: http://localhost:5000"
    echo ""
    echo "🛠️  常用命令:"
    echo "   查看日志: docker-compose -f docker-compose.neo4j.yml logs -f"
    echo "   重启服务: docker-compose -f docker-compose.neo4j.yml restart"
    echo "   停止服务: docker-compose -f docker-compose.neo4j.yml stop"
    echo "   完全移除: docker-compose -f docker-compose.neo4j.yml down -v"
    echo ""
    echo "📚 文档:"
    echo "   本地部署: docs/NEO4J_LOCAL_SETUP.md"
    echo "   知识图谱Schema: docs/KNOWLEDGE_GRAPH_SCHEMA.md"
    echo ""
    echo "========================================="
}

# 主函数
main() {
    echo ""
    echo "========================================="
    echo "  外贸谈判助手 - Neo4j本地环境配置"
    echo "========================================="
    echo ""

    # 检查是否在项目根目录
    if [ ! -f "docker-compose.neo4j.yml" ]; then
        print_error "请在项目根目录运行此脚本！"
        exit 1
    fi

    # 执行各个步骤
    check_docker
    check_ports
    setup_env_file
    start_neo4j

    # 询问是否运行迁移
    echo ""
    read -p "是否运行数据库迁移脚本？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        run_migration
    fi

    show_access_info
}

# 运行主函数
main
