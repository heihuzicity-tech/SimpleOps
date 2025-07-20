#!/bin/bash

# Bastion 服务管理脚本
# 用法: ./manage.sh [start|stop|restart|status|logs]

BACKEND_DIR="./backend"
FRONTEND_DIR="./frontend"
BACKEND_BINARY="bastion"
BACKEND_PID_FILE="./backend/bastion-backend.pid"
FRONTEND_PID_FILE="./frontend/bastion-frontend.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查进程是否运行（基于PID文件）
is_process_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
            return 1
        fi
    fi
    return 1
}

# 检查后端服务是否运行（多种方式）
is_backend_running() {
    # 方式1: 检查PID文件
    if is_process_running "$BACKEND_PID_FILE"; then
        return 0
    fi
    
    # 方式2: 检查进程名
    if pgrep -f "$BACKEND_BINARY" > /dev/null; then
        return 0
    fi
    
    # 方式3: 检查端口占用
    if lsof -ti:8080 > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# 检查前端服务是否运行（多种方式）
is_frontend_running() {
    # 方式1: 检查PID文件
    if is_process_running "$FRONTEND_PID_FILE"; then
        return 0
    fi
    
    # 方式2: 检查端口占用
    if lsof -ti:3000 > /dev/null 2>&1; then
        return 0
    fi
    
    return 1
}

# 强制杀死进程
force_kill_process() {
    local name=$1
    local pids=$(pgrep -f "$name")
    if [ -n "$pids" ]; then
        log_warning "强制终止 $name 进程..."
        echo "$pids" | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

# 启动后端服务
start_backend() {
    log_info "启动后端服务..."
    
    if is_process_running "$BACKEND_PID_FILE"; then
        log_warning "后端服务已在运行"
        return 0
    fi
    
    # 强制清理可能存在的进程
    force_kill_process "$BACKEND_BINARY"
    
    # 切换到后端目录
    (cd "$BACKEND_DIR" && {
    
    # 编译后端
    log_info "编译后端..."
    if ! go build -o "$BACKEND_BINARY" .; then
        log_error "后端编译失败"
        return 1
    fi
    
    # 启动后端服务
    nohup ./"$BACKEND_BINARY" > ./bastion-backend.log 2>&1 &
    local backend_pid=$!
    mkdir -p "$(dirname "$BACKEND_PID_FILE")"
    echo "$backend_pid" > "$BACKEND_PID_FILE"
    
    # 等待服务启动
    sleep 3
    
    if is_process_running "$BACKEND_PID_FILE"; then
        log_success "后端服务启动成功 (PID: $backend_pid)"
        log_info "后端日志: tail -f ./backend/bastion-backend.log"
        return 0
    else
        log_error "后端服务启动失败"
        return 1
    fi
    })
}

# 启动前端服务
start_frontend() {
    log_info "启动前端服务..."
    
    if is_process_running "$FRONTEND_PID_FILE"; then
        log_warning "前端服务已在运行"
        return 0
    fi
    
    # 强制清理可能存在的进程
    force_kill_process "react-scripts start"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    # 切换到前端目录
    cd "$FRONTEND_DIR" || {
        log_error "无法进入前端目录: $FRONTEND_DIR"
        return 1
    }
    
    # 启动前端服务
    nohup npm start > ./bastion-frontend.log 2>&1 &
    local frontend_pid=$!
    mkdir -p "$(dirname "$FRONTEND_PID_FILE")"
    echo "$frontend_pid" > "$FRONTEND_PID_FILE"
    
    # 等待服务启动
    log_info "等待前端服务启动..."
    for i in {1..30}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_success "前端服务启动成功 (PID: $frontend_pid)"
            log_info "前端访问: http://localhost:3000"
            log_info "前端日志: tail -f ./frontend/bastion-frontend.log"
            return 0
        fi
        sleep 2
        echo -n "."
    done
    
    echo
    log_error "前端服务启动超时"
    return 1
}

# 停止后端服务
stop_backend() {
    log_info "停止后端服务..."
    
    if is_process_running "$BACKEND_PID_FILE"; then
        local pid=$(cat "$BACKEND_PID_FILE")
        kill "$pid" 2>/dev/null
        sleep 2
        
        if is_process_running "$BACKEND_PID_FILE"; then
            log_warning "优雅停止失败，强制终止..."
            kill -9 "$pid" 2>/dev/null
            sleep 1
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    # 强制清理残留进程
    force_kill_process "$BACKEND_BINARY"
    log_success "后端服务已停止"
}

# 停止前端服务
stop_frontend() {
    log_info "停止前端服务..."
    
    if is_process_running "$FRONTEND_PID_FILE"; then
        local pid=$(cat "$FRONTEND_PID_FILE")
        kill "$pid" 2>/dev/null
        sleep 2
        
        if is_process_running "$FRONTEND_PID_FILE"; then
            log_warning "优雅停止失败，强制终止..."
            kill -9 "$pid" 2>/dev/null
            sleep 1
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    # 强制清理残留进程
    force_kill_process "react-scripts start"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    log_success "前端服务已停止"
}

# 检查服务状态
check_status() {
    echo "=== Bastion 服务状态 ==="
    
    # 检查后端
    if is_backend_running; then
        # 尝试获取PID
        local backend_pid=""
        if [ -f "$BACKEND_PID_FILE" ]; then
            backend_pid=$(cat "$BACKEND_PID_FILE")
            log_success "后端服务: 运行中 (PID: $backend_pid)"
        else
            # 通过进程名获取PID
            backend_pid=$(pgrep -f "$BACKEND_BINARY" | head -1)
            if [ -n "$backend_pid" ]; then
                log_success "后端服务: 运行中 (PID: $backend_pid)"
            else
                log_success "后端服务: 运行中 (端口8080)"
            fi
        fi
        
        # 检查API健康状态
        if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
            log_success "后端API: 正常响应"
        else
            log_warning "后端API: 无响应"
        fi
    else
        log_error "后端服务: 未运行"
    fi
    
    # 检查前端
    if is_frontend_running; then
        # 尝试获取PID
        local frontend_pid=""
        if [ -f "$FRONTEND_PID_FILE" ]; then
            frontend_pid=$(cat "$FRONTEND_PID_FILE")
            log_success "前端服务: 运行中 (PID: $frontend_pid)"
        else
            # 通过端口获取PID
            frontend_pid=$(lsof -ti:3000 2>/dev/null | head -1)
            if [ -n "$frontend_pid" ]; then
                log_success "前端服务: 运行中 (PID: $frontend_pid)"
            else
                log_success "前端服务: 运行中 (端口3000)"
            fi
        fi
        
        # 检查前端访问
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            log_success "前端访问: 正常"
        else
            log_warning "前端访问: 无响应"
        fi
    else
        log_error "前端服务: 未运行"
    fi
    
    echo "========================="
}

# 查看日志
show_logs() {
    local service=$1
    case $service in
        "backend")
            log_info "显示后端日志..."
            tail -f ./backend/bastion-backend.log
            ;;
        "frontend")
            log_info "显示前端日志..."
            tail -f ./frontend/bastion-frontend.log
            ;;
        *)
            log_info "显示所有日志..."
            echo "=== 后端日志 ==="
            tail -20 ./backend/bastion-backend.log 2>/dev/null || echo "后端日志文件不存在"
            echo
            echo "=== 前端日志 ==="
            tail -20 ./frontend/bastion-frontend.log 2>/dev/null || echo "前端日志文件不存在"
            ;;
    esac
}

# 主函数
main() {
    case $1 in
        "start")
            if [ "$2" = "backend" ]; then
                start_backend
            elif [ "$2" = "frontend" ]; then
                start_frontend
            else
                start_backend && start_frontend
            fi
            ;;
        "stop")
            if [ "$2" = "backend" ]; then
                stop_backend
            elif [ "$2" = "frontend" ]; then
                stop_frontend
            else
                stop_frontend && stop_backend
            fi
            ;;
        "restart")
            if [ "$2" = "backend" ]; then
                stop_backend && start_backend
            elif [ "$2" = "frontend" ]; then
                stop_frontend && start_frontend
            else
                stop_frontend && stop_backend
                sleep 2
                start_backend && start_frontend
            fi
            ;;
        "status")
            check_status
            ;;
        "logs")
            show_logs "$2"
            ;;
        *)
            echo "用法: $0 [start|stop|restart|status|logs] [backend|frontend]"
            echo
            echo "命令:"
            echo "  start [service]     启动服务"
            echo "  stop [service]      停止服务"
            echo "  restart [service]   重启服务"
            echo "  status              查看服务状态"
            echo "  logs [service]      查看日志"
            echo
            echo "服务:"
            echo "  backend             后端服务"
            echo "  frontend            前端服务"
            echo "  (不指定则为所有服务)"
            echo
            echo "示例:"
            echo "  $0 start            启动所有服务"
            echo "  $0 stop backend     停止后端服务"
            echo "  $0 restart frontend 重启前端服务"
            echo "  $0 status           查看服务状态"
            echo "  $0 logs backend     查看后端日志"
            exit 1
            ;;
    esac
}

main "$@"