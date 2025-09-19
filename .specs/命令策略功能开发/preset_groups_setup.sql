-- 设置新创建的命令组为预设组
UPDATE command_groups SET is_preset = 1 WHERE name IN (
  '危险命令-数据库操作',
  '危险命令-进程管理',
  '危险命令-用户管理',
  '危险命令-软件包管理',
  '危险命令-网络安全',
  '危险命令-系统配置'
);

-- 验证预设组设置
SELECT id, name, is_preset, created_at FROM command_groups WHERE is_preset = 1 ORDER BY id;