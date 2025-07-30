import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SecurityScanOutlined,
  GroupOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import CommandGroupManagement from '../../components/commandFilter/CommandGroupManagement';
import CommandFilterManagement from '../../components/commandFilter/CommandFilterManagement';

const { Title } = Typography;

const CommandFilterPage: React.FC = () => {
  const [activeKey, setActiveKey] = useState('command-groups');

  const tabItems = [
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
    {
      key: 'command-filters',
      label: (
        <span>
          <FilterOutlined />
          命令过滤
        </span>
      ),
      children: <CommandFilterManagement />,
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