# 第一阶段：构建阶段
FROM golang:1.21-alpine AS builder

# 设置阿里云Alpine镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 设置Go代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GO111MODULE=on

# 安装构建依赖
RUN apk add --no-cache git gcc musl-dev

# 设置工作目录
WORKDIR /build

# 复制go mod文件
COPY backend/go.mod backend/go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY backend/ ./

# 构建应用（静态编译）
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o bastion main.go

# 第二阶段：运行阶段
FROM alpine:latest

# 设置阿里云Alpine镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装运行时依赖
RUN apk add --no-cache ca-certificates tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 创建非root用户
RUN addgroup -g 1000 -S bastion && \
    adduser -u 1000 -S bastion -G bastion

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /build/bastion .

# 复制配置文件
COPY docker/backend/config.docker.yaml ./config/config.yaml

# 创建必要的目录
RUN mkdir -p recordings logs && \
    chown -R bastion:bastion /app

# 切换到非root用户
USER bastion

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/v1/health || exit 1

# 启动应用
CMD ["./bastion"]