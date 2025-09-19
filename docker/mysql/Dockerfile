FROM mysql:8.0

# 设置环境变量
ENV MYSQL_ROOT_PASSWORD=password123
ENV MYSQL_DATABASE=bastion
ENV MYSQL_CHARSET=utf8mb4
ENV MYSQL_COLLATION=utf8mb4_unicode_ci

# 设置MySQL配置
RUN echo "[mysqld]" > /etc/mysql/conf.d/custom.cnf && \
    echo "character-set-server=utf8mb4" >> /etc/mysql/conf.d/custom.cnf && \
    echo "collation-server=utf8mb4_unicode_ci" >> /etc/mysql/conf.d/custom.cnf && \
    echo "max_connections=200" >> /etc/mysql/conf.d/custom.cnf && \
    echo "default-authentication-plugin=mysql_native_password" >> /etc/mysql/conf.d/custom.cnf

# 复制初始化脚本
COPY docker/mysql/init/*.sql /docker-entrypoint-initdb.d/

# 暴露端口
EXPOSE 3306

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD mysqladmin ping -h localhost -u root -p${MYSQL_ROOT_PASSWORD} || exit 1