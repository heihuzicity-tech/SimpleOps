-- MySQL dump 10.13  Distrib 9.3.0, for macos14.7 (x86_64)
--
-- Host: 10.0.0.7    Database: bastion
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `asset_credentials`
--

DROP TABLE IF EXISTS `asset_credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_credentials` (
  `asset_id` bigint NOT NULL,
  `credential_id` bigint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`asset_id`,`credential_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_credential_id` (`credential_id`),
  CONSTRAINT `fk_asset_credentials_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_credentials_credential` FOREIGN KEY (`credential_id`) REFERENCES `credentials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产凭证关联表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_credentials`
--

LOCK TABLES `asset_credentials` WRITE;
/*!40000 ALTER TABLE `asset_credentials` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_credentials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_group_assets`
--

DROP TABLE IF EXISTS `asset_group_assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_group_assets` (
  `asset_group_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`asset_group_id`,`asset_id`),
  KEY `idx_asset_group_id` (`asset_group_id`),
  KEY `idx_asset_id` (`asset_id`),
  CONSTRAINT `fk_asset_group_assets_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asset_group_assets_group` FOREIGN KEY (`asset_group_id`) REFERENCES `asset_groups` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产分组关联表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_group_assets`
--

LOCK TABLES `asset_group_assets` WRITE;
/*!40000 ALTER TABLE `asset_group_assets` DISABLE KEYS */;
/*!40000 ALTER TABLE `asset_group_assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asset_groups`
--

DROP TABLE IF EXISTS `asset_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_groups` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `parent_id` bigint DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_parent_id` (`parent_id`),
  KEY `idx_name` (`name`),
  KEY `idx_sort_order` (`sort_order`),
  CONSTRAINT `fk_asset_groups_parent` FOREIGN KEY (`parent_id`) REFERENCES `asset_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产分组表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asset_groups`
--

LOCK TABLES `asset_groups` WRITE;
/*!40000 ALTER TABLE `asset_groups` DISABLE KEYS */;
INSERT INTO `asset_groups` VALUES (1,'生产服务器','生产服务器',NULL,0,'2025-07-19 16:36:01','2025-07-19 16:36:01',NULL);
/*!40000 ALTER TABLE `asset_groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `assets`
--

DROP TABLE IF EXISTS `assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'server' COMMENT '资产类型: server-服务器, database-数据库',
  `address` varchar(255) NOT NULL,
  `port` int DEFAULT '22',
  `protocol` varchar(10) DEFAULT 'ssh' COMMENT '协议: ssh, rdp, vnc, mysql, etc.',
  `tags` json DEFAULT NULL,
  `status` tinyint DEFAULT '1' COMMENT '状态: 1-启用, 0-禁用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_protocol` (`protocol`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='资产表 - 存储服务器和数据库等资产';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assets`
--

LOCK TABLES `assets` WRITE;
/*!40000 ALTER TABLE `assets` DISABLE KEYS */;
INSERT INTO `assets` VALUES (1,'开发服务器-01','server','192.168.1.10',22,'ssh','{\"env\": \"dev\", \"team\": \"backend\"}',1,'2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(2,'生产数据库-01','database','192.168.1.20',3306,'mysql','{\"env\": \"prod\", \"team\": \"dba\"}',1,'2025-07-19 08:31:53','2025-07-19 08:31:53',NULL);
/*!40000 ALTER TABLE `assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_statistics`
--

DROP TABLE IF EXISTS `audit_statistics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_statistics` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `date` date NOT NULL,
  `total_sessions` int DEFAULT '0',
  `active_sessions` int DEFAULT '0',
  `total_commands` int DEFAULT '0',
  `high_risk_commands` int DEFAULT '0',
  `total_users` int DEFAULT '0',
  `active_users` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='审计统计表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_statistics`
--

LOCK TABLES `audit_statistics` WRITE;
/*!40000 ALTER TABLE `audit_statistics` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_statistics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `command_logs`
--

DROP TABLE IF EXISTS `command_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `command_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `asset_id` bigint NOT NULL,
  `command` text NOT NULL,
  `output` text,
  `exit_code` int DEFAULT NULL,
  `risk` varchar(20) DEFAULT 'low' COMMENT '风险等级: low-低, medium-中, high-高',
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '命令执行时间，毫秒',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_risk` (`risk`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_command_logs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_command_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='命令日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `command_logs`
--

LOCK TABLES `command_logs` WRITE;
/*!40000 ALTER TABLE `command_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `command_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `credentials`
--

DROP TABLE IF EXISTS `credentials`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `credentials` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'password' COMMENT '凭证类型: password-密码, key-密钥',
  `username` varchar(100) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `private_key` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='凭证表 - 存储访问资产的认证信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `credentials`
--

LOCK TABLES `credentials` WRITE;
/*!40000 ALTER TABLE `credentials` DISABLE KEYS */;
/*!40000 ALTER TABLE `credentials` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_logs`
--

DROP TABLE IF EXISTS `login_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `ip` varchar(45) NOT NULL,
  `user_agent` text,
  `method` varchar(10) NOT NULL DEFAULT 'web',
  `status` varchar(20) NOT NULL DEFAULT 'success',
  `message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_ip` (`ip`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='登录日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_logs`
--

LOCK TABLES `login_logs` WRITE;
/*!40000 ALTER TABLE `login_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `operation_logs`
--

DROP TABLE IF EXISTS `operation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `operation_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `asset_id` bigint DEFAULT NULL,
  `action` varchar(50) NOT NULL COMMENT '操作类型: login-登录, logout-登出, ssh_connect-SSH连接, command-命令执行',
  `command` text,
  `result` text,
  `risk_level` varchar(10) DEFAULT 'low' COMMENT '风险级别: low-低, medium-中, high-高',
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_action` (`action`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_risk_level` (`risk_level`),
  KEY `idx_operation_logs_user_time` (`user_id`,`timestamp`),
  CONSTRAINT `fk_operation_logs_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `fk_operation_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='操作日志表 - 存储用户操作记录';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `operation_logs`
--

LOCK TABLES `operation_logs` WRITE;
/*!40000 ALTER TABLE `operation_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `operation_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `category` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `idx_permission_name` (`name`),
  KEY `idx_category` (`category`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='权限表 - 存储系统权限定义';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES (1,'user:create','创建用户','user','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(2,'user:read','查看用户','user','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(3,'user:update','更新用户','user','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(4,'user:delete','删除用户','user','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(5,'role:create','创建角色','role','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(6,'role:read','查看角色','role','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(7,'role:update','更新角色','role','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(8,'role:delete','删除角色','role','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(9,'asset:create','创建资产','asset','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(10,'asset:read','查看资产','asset','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(11,'asset:update','更新资产','asset','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(12,'asset:delete','删除资产','asset','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(13,'asset:connect','连接资产','asset','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(14,'audit:read','查看审计日志','audit','2025-07-19 08:31:53','2025-07-19 08:32:45',NULL),(15,'session:read','查看会话','session','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(16,'log:read','查看日志','log','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(17,'all','所有权限','system','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(18,'audit:cleanup','清理审计日志','audit','2025-07-19 08:32:45','2025-07-19 08:32:45',NULL),(19,'login_logs:read','查看登录日志','audit','2025-07-19 08:32:45','2025-07-19 08:32:45',NULL),(20,'operation_logs:read','查看操作日志','audit','2025-07-19 08:32:45','2025-07-19 08:32:45',NULL),(21,'session_records:read','查看会话记录','audit','2025-07-19 08:32:45','2025-07-19 08:32:45',NULL),(22,'command_logs:read','查看命令日志','audit','2025-07-19 08:32:45','2025-07-19 08:32:45',NULL);
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_permissions` (
  `role_id` bigint NOT NULL,
  `permission_id` bigint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_role_id` (`role_id`),
  KEY `idx_permission_id` (`permission_id`),
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色权限关联表 - 多对多关系';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_permissions`
--

LOCK TABLES `role_permissions` WRITE;
/*!40000 ALTER TABLE `role_permissions` DISABLE KEYS */;
INSERT INTO `role_permissions` VALUES (1,14,'2025-07-19 08:32:45'),(1,17,'2025-07-19 08:31:53'),(1,18,'2025-07-19 08:32:45'),(1,19,'2025-07-19 08:32:45'),(1,20,'2025-07-19 08:32:45'),(1,21,'2025-07-19 08:32:45'),(1,22,'2025-07-19 08:32:45'),(2,10,'2025-07-19 08:31:53'),(2,13,'2025-07-19 08:31:53'),(2,15,'2025-07-19 08:31:53'),(3,14,'2025-07-19 08:31:53'),(3,15,'2025-07-19 08:31:53'),(3,16,'2025-07-19 08:31:53'),(3,19,'2025-07-19 08:32:45'),(3,20,'2025-07-19 08:32:45'),(3,21,'2025-07-19 08:32:45'),(3,22,'2025-07-19 08:32:45');
/*!40000 ALTER TABLE `role_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `idx_role_name` (`name`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='角色表 - 存储系统角色定义';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin','系统管理员','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(2,'operator','运维人员','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL),(3,'auditor','审计员','2025-07-19 08:31:53','2025-07-19 08:31:53',NULL);
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_monitor_logs`
--

DROP TABLE IF EXISTS `session_monitor_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_monitor_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `event_type` varchar(20) NOT NULL,
  `event_data` text,
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会话监控日志表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_monitor_logs`
--

LOCK TABLES `session_monitor_logs` WRITE;
/*!40000 ALTER TABLE `session_monitor_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_monitor_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_records`
--

DROP TABLE IF EXISTS `session_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_records` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint NOT NULL,
  `username` varchar(50) NOT NULL,
  `asset_id` bigint NOT NULL,
  `asset_name` varchar(100) NOT NULL,
  `asset_address` varchar(255) NOT NULL,
  `credential_id` bigint NOT NULL,
  `protocol` varchar(10) NOT NULL COMMENT '协议: ssh, rdp, vnc',
  `ip` varchar(45) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'active' COMMENT '会话状态: active-活跃, closed-已关闭, timeout-超时',
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `duration` bigint DEFAULT NULL COMMENT '会话持续时间，秒',
  `record_path` varchar(255) DEFAULT NULL COMMENT '录制文件路径',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_credential_id` (`credential_id`),
  KEY `idx_protocol` (`protocol`),
  KEY `idx_ip` (`ip`),
  KEY `idx_status` (`status`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_session_records_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_records_credential` FOREIGN KEY (`credential_id`) REFERENCES `credentials` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_session_records_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会话记录表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_records`
--

LOCK TABLES `session_records` WRITE;
/*!40000 ALTER TABLE `session_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_records` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `session_warnings`
--

DROP TABLE IF EXISTS `session_warnings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `session_warnings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `warning_type` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `is_resolved` tinyint(1) DEFAULT '0',
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_warning_type` (`warning_type`),
  KEY `idx_is_resolved` (`is_resolved`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会话警告表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `session_warnings`
--

LOCK TABLES `session_warnings` WRITE;
/*!40000 ALTER TABLE `session_warnings` DISABLE KEYS */;
/*!40000 ALTER TABLE `session_warnings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint NOT NULL,
  `asset_id` bigint NOT NULL,
  `protocol` varchar(10) NOT NULL DEFAULT 'ssh',
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `status` varchar(20) DEFAULT 'active' COMMENT '会话状态: active-活跃, closed-已关闭, timeout-超时',
  `client_ip` varchar(45) DEFAULT NULL,
  `record_file` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  UNIQUE KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_asset_id` (`asset_id`),
  KEY `idx_start_time` (`start_time`),
  KEY `idx_status` (`status`),
  KEY `idx_sessions_user_time` (`user_id`,`start_time`),
  CONSTRAINT `fk_sessions_asset` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='会话记录表 - 存储用户访问会话';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `user_id` bigint NOT NULL,
  `role_id` bigint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_role_id` (`role_id`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户角色关联表 - 多对多关系';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roles`
--

LOCK TABLES `user_roles` WRITE;
/*!40000 ALTER TABLE `user_roles` DISABLE KEYS */;
INSERT INTO `user_roles` VALUES (1,1,'2025-07-19 08:31:53');
/*!40000 ALTER TABLE `user_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `status` tinyint DEFAULT '1' COMMENT '状态: 1-启用, 0-禁用',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `idx_username` (`username`),
  KEY `idx_status` (`status`),
  KEY `idx_deleted_at` (`deleted_at`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='用户表 - 存储系统用户信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','$2a$10$x/i8F9qXh.tmIbwkLROCyeQleavmD4t0qR2BBQJ2cs57DvwaLbTs.','admin@bastion.local',NULL,1,'2025-07-19 08:31:53','2025-07-19 08:31:53',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `websocket_connections`
--

DROP TABLE IF EXISTS `websocket_connections`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `websocket_connections` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `connection_id` varchar(100) NOT NULL,
  `session_id` varchar(100) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  `client_ip` varchar(45) NOT NULL,
  `user_agent` text,
  `connected_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `disconnected_at` timestamp NULL DEFAULT NULL,
  `status` varchar(20) DEFAULT 'connected',
  `last_ping` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `connection_id` (`connection_id`),
  UNIQUE KEY `idx_connection_id` (`connection_id`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_connected_at` (`connected_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='WebSocket连接表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `websocket_connections`
--

LOCK TABLES `websocket_connections` WRITE;
/*!40000 ALTER TABLE `websocket_connections` DISABLE KEYS */;
/*!40000 ALTER TABLE `websocket_connections` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-07-19 16:45:37
