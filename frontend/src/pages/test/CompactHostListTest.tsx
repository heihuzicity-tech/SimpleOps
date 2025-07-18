import React, { useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Collapse, 
  Badge, 
  Typography, 
  Menu, 
  Tree, 
  Button, 
  Drawer, 
  List, 
  Avatar,
  Space,
  Divider,
  Tag
} from 'antd';
import { 
  CaretRightOutlined, 
  DesktopOutlined, 
  UnorderedListOutlined,
  FolderOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  WindowsOutlined,
  AppleOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { DataNode } from 'antd/es/tree';
import './CompactHostListTest.css';

const { Title, Text } = Typography;

// 模拟数据
const mockGroups = [
  {
    id: 1,
    name: '生产环境',
    asset_count: 3,
    assets: [
      { id: 1, name: 'web-prod-01', address: '192.168.1.10', os_type: 'linux', protocol: 'ssh' },
      { id: 2, name: 'web-prod-02', address: '192.168.1.11', os_type: 'linux', protocol: 'ssh' },
      { id: 3, name: 'db-prod-01', address: '192.168.1.20', os_type: 'linux', protocol: 'ssh' }
    ]
  },
  {
    id: 2,
    name: '测试环境',
    asset_count: 2,
    assets: [
      { id: 4, name: 'web-test-01', address: '192.168.2.10', os_type: 'windows', protocol: 'rdp' },
      { id: 5, name: 'db-test-01', address: '192.168.2.20', os_type: 'linux', protocol: 'ssh' }
    ]
  },
  {
    id: 3,
    name: '开发环境',
    asset_count: 4,
    assets: [
      { id: 6, name: 'dev-web-01', address: '192.168.3.10', os_type: 'linux', protocol: 'ssh' },
      { id: 7, name: 'dev-web-02', address: '192.168.3.11', os_type: 'linux', protocol: 'ssh' },
      { id: 8, name: 'dev-db-01', address: '192.168.3.20', os_type: 'linux', protocol: 'ssh' },
      { id: 9, name: 'dev-cache-01', address: '192.168.3.30', os_type: 'linux', protocol: 'ssh' }
    ]
  }
];

const CompactHostListTest: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedHost, setSelectedHost] = useState<string>('');

  // 获取主机图标
  const getHostIcon = (asset: any) => {
    if (asset.name.includes('db')) return <DatabaseOutlined />;
    if (asset.name.includes('web')) return <GlobalOutlined />;
    if (asset.os_type === 'windows') return <WindowsOutlined />;
    return <DesktopOutlined />;
  };

  // 方案1: Collapse 折叠面板
  const CollapseDemo = () => (
    <Card title="方案1: Collapse 折叠面板" size="small">
      <Collapse 
        size="small"
        expandIcon={({ isActive }) => 
          <CaretRightOutlined rotate={isActive ? 90 : 0} />
        }
        ghost
        items={mockGroups.map(group => ({
          key: group.id,
          label: (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text>{group.name}</Text>
              <Badge count={group.asset_count} size="small" color="blue" />
            </div>
          ),
          children: (
            <div style={{ marginLeft: -24 }}>
              {group.assets.map(asset => (
                <div 
                  key={asset.id} 
                  style={{ 
                    padding: '6px 12px', 
                    cursor: 'pointer',
                    borderRadius: 4,
                    marginBottom: 2
                  }}
                  className="host-item"
                  onClick={() => setSelectedHost(asset.name)}
                >
                  <Space>
                    {getHostIcon(asset)}
                    <Text>{asset.name}</Text>
                    <Tag color={asset.os_type === 'linux' ? 'green' : 'blue'}>
                      {asset.protocol.toUpperCase()}
                    </Tag>
                  </Space>
                </div>
              ))}
            </div>
          )
        }))}
      />
    </Card>
  );

  // 方案2: Menu 菜单
  const MenuDemo = () => {
    const items: MenuProps['items'] = mockGroups.map(group => ({
      key: group.id,
      label: `${group.name} (${group.asset_count})`,
      icon: <FolderOutlined />,
      children: group.assets.map(asset => ({
        key: `asset-${asset.id}`,
        label: asset.name,
        icon: getHostIcon(asset)
      }))
    }));

    return (
      <Card title="方案2: Menu 菜单" size="small">
        <Menu
          mode="inline"
          inlineIndent={12}
          items={items}
          style={{ border: 'none' }}
          onSelect={({ key }) => {
            if (key.startsWith('asset-')) {
              const assetId = key.replace('asset-', '');
              const asset = mockGroups.flatMap(g => g.assets).find(a => a.id.toString() === assetId);
              if (asset) setSelectedHost(asset.name);
            }
          }}
        />
      </Card>
    );
  };

  // 方案3: 自定义紧凑树形
  const CompactTreeDemo = () => {
    const treeData: DataNode[] = mockGroups.map(group => ({
      title: `${group.name} (${group.asset_count})`,
      key: group.id,
      icon: <FolderOutlined />,
      children: group.assets.map(asset => ({
        title: (
          <Space>
            <span>{asset.name}</span>
            <Tag color={asset.os_type === 'linux' ? 'green' : 'blue'}>
              {asset.protocol.toUpperCase()}
            </Tag>
          </Space>
        ),
        key: `asset-${asset.id}`,
        icon: getHostIcon(asset),
        isLeaf: true
      }))
    }));

    return (
      <Card title="方案3: 自定义紧凑树形" size="small">
        <Tree
          showIcon
          switcherIcon={<CaretRightOutlined />}
          className="compact-tree"
          treeData={treeData}
          height={300}
          onSelect={(keys) => {
            if (keys.length > 0) {
              const key = keys[0] as string;
              if (key.startsWith('asset-')) {
                const assetId = key.replace('asset-', '');
                const asset = mockGroups.flatMap(g => g.assets).find(a => a.id.toString() === assetId);
                if (asset) setSelectedHost(asset.name);
              }
            }
          }}
        />
      </Card>
    );
  };

  // 方案4: 按钮 + 抽屉
  const DrawerDemo = () => (
    <Card title="方案4: 按钮 + 抽屉" size="small">
      <Button 
        type="primary" 
        icon={<UnorderedListOutlined />} 
        onClick={() => setDrawerOpen(true)}
        style={{ width: '100%' }}
      >
        打开主机清单
      </Button>
      
      <Drawer
        title="主机清单"
        placement="left"
        width={320}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <List
          dataSource={mockGroups}
          renderItem={group => (
            <List.Item style={{ padding: '8px 0' }}>
              <List.Item.Meta
                avatar={<Avatar size="small" style={{ backgroundColor: '#1890ff' }}>{group.asset_count}</Avatar>}
                title={group.name}
                description={
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    {group.assets.map(asset => (
                      <div 
                        key={asset.id}
                        style={{ 
                          padding: '4px 8px', 
                          backgroundColor: '#f5f5f5',
                          borderRadius: 4,
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          setSelectedHost(asset.name);
                          setDrawerOpen(false);
                        }}
                      >
                        <Space>
                          {getHostIcon(asset)}
                          <Text>{asset.name}</Text>
                          <Tag color={asset.os_type === 'linux' ? 'green' : 'blue'}>
                            {asset.protocol.toUpperCase()}
                          </Tag>
                        </Space>
                      </div>
                    ))}
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Drawer>
    </Card>
  );

  return (
    <div style={{ padding: 24, minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Title level={2}>主机清单UI方案对比测试</Title>
      
      {selectedHost && (
        <Card style={{ marginBottom: 16 }}>
          <Text strong>当前选中主机: </Text>
          <Tag color="green">{selectedHost}</Tag>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <CollapseDemo />
        </Col>
        <Col span={12}>
          <MenuDemo />
        </Col>
        <Col span={12}>
          <CompactTreeDemo />
        </Col>
        <Col span={12}>
          <DrawerDemo />
        </Col>
      </Row>

      <Divider />
      
      <Card title="方案对比分析" size="small">
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card size="small" title="Collapse 折叠面板">
              <Space direction="vertical" size={2}>
                <Text>✅ 空间利用率高</Text>
                <Text>✅ 视觉层次清晰</Text>
                <Text>✅ 支持Badge计数</Text>
                <Text>✅ 自定义样式灵活</Text>
                <Text>⚠️ 需要点击展开</Text>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="Menu 菜单">
              <Space direction="vertical" size={2}>
                <Text>✅ 交互体验流畅</Text>
                <Text>✅ 内置选中状态</Text>
                <Text>✅ 键盘导航支持</Text>
                <Text>✅ 符合操作习惯</Text>
                <Text>⚠️ 占用空间适中</Text>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="自定义紧凑树形">
              <Space direction="vertical" size={2}>
                <Text>✅ 保持原有体验</Text>
                <Text>✅ 功能完整</Text>
                <Text>✅ 支持搜索</Text>
                <Text>⚠️ 需要CSS调整</Text>
                <Text>⚠️ 空间节省有限</Text>
              </Space>
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small" title="按钮 + 抽屉">
              <Space direction="vertical" size={2}>
                <Text>✅ 最大化节省空间</Text>
                <Text>✅ 现代化体验</Text>
                <Text>✅ 支持复杂布局</Text>
                <Text>⚠️ 需要额外点击</Text>
                <Text>⚠️ 移动端友好</Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default CompactHostListTest;