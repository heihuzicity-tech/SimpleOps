import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SecurityScanOutlined,
  GroupOutlined,
  FilterOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import CommandGroupManagement from '../../components/commandFilter/CommandGroupManagement';
import CommandFilterManagement from '../../components/commandFilter/CommandFilterManagement';
import CommandListManagement from '../../components/commandFilter/CommandListManagement';

const { Title } = Typography;

const CommandFilterPage: React.FC = () => {
  const [activeKey, setActiveKey] = useState('command-filters');

  const tabItems = [
    {
      key: 'command-filters',
      label: (
        <span>
          <FilterOutlined />
          命令策略
        </span>
      ),
      children: <CommandFilterManagement />,
    },
    {
      key: 'command-list',
      label: (
        <span>
          <UnorderedListOutlined />
          命令列表
        </span>
      ),
      children: <CommandListManagement />,
    },
    {
      key: 'command-groups',
      label: (
        <span>
          <GroupOutlined />
          命令组
        </span>
      ),
      children: <CommandGroupManagement />,
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
            管理命令组和过滤规则，控制用户在SSH会话中可执行的命令
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