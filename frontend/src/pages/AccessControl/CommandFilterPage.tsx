import React, { useState } from 'react';
import { Card, Tabs, Typography } from 'antd';
import {
  SecurityScanOutlined,
  GroupOutlined,
  FilterOutlined,
  // UnorderedListOutlined, // TODO: 命令列表功能暂时屏蔽
} from '@ant-design/icons';
import CommandGroupManagement from '../../components/commandFilter/CommandGroupManagement';
import CommandFilterManagement from '../../components/commandFilter/CommandFilterManagement';
// import CommandListManagement from '../../components/commandFilter/CommandListManagement'; // TODO: 命令列表功能暂时屏蔽

const { Title } = Typography;

const CommandFilterPage: React.FC = () => {
  const [activeKey, setActiveKey] = useState('command-filters');

  const tabItems = [
    {
      key: 'command-filters',
      label: (
        <span>
          <FilterOutlined />
          过滤规则
        </span>
      ),
      children: <CommandFilterManagement />,
    },
    // TODO: 命令列表功能暂时屏蔽，待后端API开发完成后启用
    // 后端需要实现 /command-filter/commands 相关API
    // 详见：.specs/开发命令过滤功能/requirements.md
    // {
    //   key: 'command-list',
    //   label: (
    //     <span>
    //       <UnorderedListOutlined />
    //       命令列表
    //     </span>
    //   ),
    //   children: <CommandListManagement />,
    // },
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