import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SecurityScanOutlined,
  CodeOutlined,
  GroupOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import PolicyTable from '../../components/commandFilter/PolicyTable';
import CommandTable from '../../components/commandFilter/CommandTable';
import CommandGroupTable from '../../components/commandFilter/CommandGroupTable';
import InterceptLogTable from '../../components/commandFilter/InterceptLogTable';

const { Title } = Typography;

const CommandFilterPage: React.FC = () => {
  const [activeKey, setActiveKey] = useState('policies');

  const tabItems = [
    {
      key: 'policies',
      label: (
        <span>
          <SecurityScanOutlined />
          策略列表
        </span>
      ),
      children: <PolicyTable />,
    },
    {
      key: 'commands',
      label: (
        <span>
          <CodeOutlined />
          命令列表
        </span>
      ),
      children: <CommandTable />,
    },
    {
      key: 'command-groups',
      label: (
        <span>
          <GroupOutlined />
          命令组
        </span>
      ),
      children: <CommandGroupTable />,
    },
    {
      key: 'intercept-logs',
      label: (
        <span>
          <FileTextOutlined />
          拦截日志
        </span>
      ),
      children: <InterceptLogTable />,
    },
  ];

  return (
    <div>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>
            <SecurityScanOutlined style={{ marginRight: 8 }} />
            命令过滤管理
          </Title>
          <p style={{ color: '#666', marginTop: 8, marginBottom: 0 }}>
            管理SSH会话中的命令过滤策略，支持精确匹配和正则表达式匹配
          </p>
        </div>

        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          type="card"
          size="large"
          items={tabItems.map((item) => ({
            ...item,
            children: (
              <div style={{ minHeight: 400 }}>
                {item.children}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  );
};

export default CommandFilterPage;