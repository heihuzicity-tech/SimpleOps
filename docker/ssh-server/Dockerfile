FROM ubuntu:22.04

# 避免交互式提示
ENV DEBIAN_FRONTEND=noninteractive

# 设置阿里云Ubuntu镜像源
RUN sed -i 's/archive.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list && \
    sed -i 's/security.ubuntu.com/mirrors.aliyun.com/g' /etc/apt/sources.list

# 更新包列表并安装必要软件
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    vim \
    net-tools \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# 创建SSH运行目录
RUN mkdir /var/run/sshd

# 配置SSH允许密码认证和root登录
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    echo "PermitRootLogin yes" >> /etc/ssh/sshd_config && \
    echo "PasswordAuthentication yes" >> /etc/ssh/sshd_config

# 设置root密码
RUN echo 'root:123' | chpasswd

# 创建测试用户并设置密码
RUN useradd -m -s /bin/bash testuser && \
    echo 'testuser:testpass' | chpasswd && \
    usermod -aG sudo testuser

# 配置sudo不需要密码（可选，方便测试）
RUN echo 'testuser ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# 生成SSH主机密钥
RUN ssh-keygen -A

# 创建启动脚本
COPY docker/ssh-server/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 暴露SSH端口
EXPOSE 22

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD service ssh status || exit 1

# 启动SSH服务
ENTRYPOINT ["/entrypoint.sh"]