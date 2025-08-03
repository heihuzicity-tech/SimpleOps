#!/bin/bash

# ========================================
# Bastion 数据库快速恢复脚本
# 自动化执行数据库表结构恢复
# ========================================

set -e  # 遇到错误立即退出

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RECOVERY_SQL="${SCRIPT_DIR}/database_structure_recovery.sql"
VALIDATE_SQL="${SCRIPT_DIR}/validate_database_structure.sql"
LOG_FILE="${SCRIPT_DIR}/recovery_$(date +%Y%m%d_%H%M%S).log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "$(date '+%Y-%m-%d %H:%M:%S') $1" | tee -a "$LOG_FILE"
}

log_info() {
    log "${BLUE}[INFO]${NC} $1"
}

log_success() {
    log "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    log "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    log "${RED}[ERROR]${NC} $1"
}

# 显示横幅
show_banner() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "  Bastion 数据库结构紧急恢复工具"
    echo "  Database Structure Recovery Tool"
    echo "========================================"
    echo -e "${NC}"
}

# 检查先决条件
check_prerequisites() {
    log_info "检查系统先决条件..."
    
    # 检查MySQL客户端
    if ! command -v mysql &> /dev/null; then
        log_error "MySQL客户端未安装或不在PATH中"
        exit 1
    fi
    
    # 检查恢复脚本文件
    if [[ ! -f "$RECOVERY_SQL" ]]; then
        log_error "恢复脚本文件不存在: $RECOVERY_SQL"
        exit 1
    fi
    
    if [[ ! -f "$VALIDATE_SQL" ]]; then
        log_error "验证脚本文件不存在: $VALIDATE_SQL"
        exit 1
    fi
    
    log_success "先决条件检查通过"
}

# 获取数据库连接参数
get_db_config() {
    echo -e "${YELLOW}请输入数据库连接信息:${NC}"
    
    # 数据库主机
    read -p "数据库主机 [localhost]: " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    # 数据库端口
    read -p "数据库端口 [3306]: " DB_PORT
    DB_PORT=${DB_PORT:-3306}
    
    # 数据库用户名
    read -p "数据库用户名 [root]: " DB_USER
    DB_USER=${DB_USER:-root}
    
    # 数据库密码
    read -s -p "数据库密码: " DB_PASSWORD
    echo
    
    # 数据库名称
    read -p "数据库名称 [bastion]: " DB_NAME
    DB_NAME=${DB_NAME:-bastion}
    
    # MySQL连接参数
    MYSQL_CMD="mysql -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD"
    
    log_info "数据库配置: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
}

# 测试数据库连接
test_db_connection() {
    log_info "测试数据库连接..."
    
    if $MYSQL_CMD -e "SELECT 1;" &>/dev/null; then
        log_success "数据库连接测试通过"
    else
        log_error "数据库连接失败，请检查连接参数"
        exit 1
    fi
}

# 检查数据库是否存在
check_database_exists() {
    log_info "检查数据库是否存在..."
    
    if $MYSQL_CMD -e "USE $DB_NAME;" &>/dev/null; then
        log_success "数据库 '$DB_NAME' 存在"
    else
        log_warning "数据库 '$DB_NAME' 不存在，将尝试创建"
        
        read -p "是否创建数据库 '$DB_NAME'? [y/N]: " create_db
        if [[ $create_db =~ ^[Yy]$ ]]; then
            $MYSQL_CMD -e "CREATE DATABASE $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
            log_success "数据库 '$DB_NAME' 创建成功"
        else
            log_error "需要数据库才能继续恢复"
            exit 1
        fi
    fi
}

# 备份现有数据（如果存在）
backup_existing_data() {
    log_info "检查是否需要备份现有数据..."
    
    table_count=$($MYSQL_CMD $DB_NAME -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" -N 2>/dev/null || echo "0")
    
    if [[ $table_count -gt 0 ]]; then
        log_warning "发现数据库中存在 $table_count 个表"
        read -p "是否备份现有数据? [y/N]: " backup_data
        
        if [[ $backup_data =~ ^[Yy]$ ]]; then
            backup_file="${SCRIPT_DIR}/backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
            log_info "正在备份到: $backup_file"
            
            mysqldump -h$DB_HOST -P$DB_PORT -u$DB_USER -p$DB_PASSWORD $DB_NAME > "$backup_file"
            log_success "备份完成: $backup_file"
        fi
    fi
}

# 执行恢复脚本
execute_recovery() {
    log_info "开始执行数据库结构恢复..."
    
    # 显示进度
    echo -e "${YELLOW}正在恢复表结构，请稍候...${NC}"
    
    # 执行恢复脚本
    if $MYSQL_CMD $DB_NAME < "$RECOVERY_SQL" 2>>"$LOG_FILE"; then
        log_success "数据库结构恢复完成"
    else
        log_error "恢复脚本执行失败，请查看日志: $LOG_FILE"
        exit 1
    fi
}

# 执行验证
execute_validation() {
    log_info "开始验证数据库结构完整性..."
    
    # 执行验证脚本并捕获输出
    validation_output="${SCRIPT_DIR}/validation_$(date +%Y%m%d_%H%M%S).txt"
    
    if $MYSQL_CMD $DB_NAME < "$VALIDATE_SQL" > "$validation_output" 2>>"$LOG_FILE"; then
        log_success "验证脚本执行完成"
        
        # 检查验证结果
        if grep -q "数据库结构恢复成功" "$validation_output"; then
            log_success "🎉 数据库结构验证通过！"
        else
            log_warning "验证发现一些问题，请查看详细报告: $validation_output"
        fi
    else
        log_error "验证脚本执行失败，请查看日志: $LOG_FILE"
        exit 1
    fi
}

# 显示恢复后信息
show_post_recovery_info() {
    echo
    echo -e "${GREEN}========================================"
    echo "  数据库结构恢复完成！"
    echo "========================================"
    echo -e "${NC}"
    
    echo -e "${YELLOW}重要提醒:${NC}"
    echo "1. 默认管理员账户:"
    echo "   用户名: admin"
    echo "   密码: admin123"
    echo "   ⚠️  请立即修改默认密码！"
    echo
    echo "2. 默认角色配置:"
    echo "   - admin: 系统管理员（所有权限）"
    echo "   - operator: 运维人员（资产访问权限）"
    echo "   - auditor: 审计员（审计查看权限）"
    echo
    echo "3. 下一步操作:"
    echo "   - 修改管理员密码"
    echo "   - 检查权限配置"
    echo "   - 恢复业务数据（如有备份）"
    echo "   - 重启相关服务"
    echo
    echo -e "${BLUE}日志文件: $LOG_FILE${NC}"
    echo -e "${BLUE}验证报告: ${validation_output:-'未生成'}${NC}"
}

# 主函数
main() {
    show_banner
    
    # 确认执行
    echo -e "${RED}⚠️  注意: 此操作将重建数据库表结构！${NC}"
    read -p "确认继续? [y/N]: " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 0
    fi
    
    # 开始恢复流程
    log_info "开始数据库结构恢复流程..."
    
    check_prerequisites
    get_db_config
    test_db_connection
    check_database_exists
    backup_existing_data
    execute_recovery
    execute_validation
    show_post_recovery_info
    
    log_success "数据库结构恢复流程完成！"
}

# 错误处理
trap 'log_error "脚本执行过程中发生错误，请查看日志: $LOG_FILE"' ERR

# 执行主函数
main "$@"