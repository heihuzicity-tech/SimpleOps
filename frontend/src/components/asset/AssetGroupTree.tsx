import React, { useState, useEffect } from 'react';
import { Tree, Input, Card, Button, Modal, Form, message, Space, Popconfirm } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined,
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  CloudServerOutlined,
  HddOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

const { Search } = Input;

interface AssetGroupTreeProps {
  onSelect?: (selectedKeys: React.Key[], info: any) => void;
  onGroupChange?: () => void;
}

const AssetGroupTree: React.FC<AssetGroupTreeProps> = ({ onSelect, onGroupChange }) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [autoExpandParent, setAutoExpandParent] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 模拟的分组数据
  const mockGroups = [
    { id: 1, name: '生产环境', type: 'production', parentId: null },
    { id: 2, name: '测试环境', type: 'test', parentId: null },
    { id: 3, name: '开发环境', type: 'dev', parentId: null },
    { id: 4, name: 'Web服务器', type: 'production', parentId: 1 },
    { id: 5, name: '应用服务器', type: 'production', parentId: 1 },
    { id: 6, name: '数据库服务器', type: 'production', parentId: 1 },
    { id: 7, name: '测试服务器', type: 'test', parentId: 2 },
    { id: 8, name: '开发服务器', type: 'dev', parentId: 3 },
  ];

  const [groups, setGroups] = useState(mockGroups);

  useEffect(() => {
    const generateTreeData = (): DataNode[] => {
      const buildTree = (parentId: number | null): DataNode[] => {
        return groups
          .filter(group => group.parentId === parentId)
          .map(group => ({
            title: group.name,
            key: group.id.toString(),
            icon: getGroupIcon(group.type),
            children: buildTree(group.id),
          }));
      };

      return [
        {
          title: '全部资产',
          key: 'all',
          icon: <FolderOutlined />,
          children: buildTree(null),
        },
      ];
    };

    const data = generateTreeData();
    setTreeData(data);
    setExpandedKeys(['all']);
  }, [groups]);

  const getGroupIcon = (type: string) => {
    switch (type) {
      case 'production':
        return <CloudServerOutlined />;
      case 'test':
        return <HddOutlined />;
      case 'dev':
        return <HddOutlined />;
      default:
        return <FolderOutlined />;
    }
  };

  const onExpand = (newExpandedKeys: React.Key[]) => {
    setExpandedKeys(newExpandedKeys as string[]);
    setAutoExpandParent(false);
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setSearchValue(value);
    
    if (!value) {
      setExpandedKeys(['all']);
      setAutoExpandParent(false);
      return;
    }

    // 搜索功能
    const expandedKeys: string[] = [];
    const loop = (data: DataNode[]): void => {
      data.forEach((item) => {
        if (item.title && item.title.toString().toLowerCase().includes(value.toLowerCase())) {
          expandedKeys.push(item.key as string);
        }
        if (item.children) {
          loop(item.children);
        }
      });
    };
    loop(treeData);
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(true);
  };

  const handleAddGroup = () => {
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleSubmit = (values: any) => {
    // 模拟创建分组
    const newGroup = {
      id: Date.now(),
      name: values.name,
      type: values.type || 'general',
      parentId: values.parentId || null,
    };
    
    setGroups([...groups, newGroup]);
    setIsModalVisible(false);
    message.success('分组创建成功');
    
    if (onGroupChange) {
      onGroupChange();
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    // 检查是否有子分组
    const hasChildren = groups.some(group => group.parentId === parseInt(groupId));
    if (hasChildren) {
      message.error('该分组下还有子分组，请先删除子分组');
      return;
    }

    // 模拟删除分组
    setGroups(groups.filter(group => group.id !== parseInt(groupId)));
    message.success('分组删除成功');
    
    if (onGroupChange) {
      onGroupChange();
    }
  };

  const renderTreeNodes = (data: DataNode[]): DataNode[] => {
    return data.map((item) => {
      const index = item.title ? item.title.toString().toLowerCase().indexOf(searchValue.toLowerCase()) : -1;
      const beforeStr = item.title ? item.title.toString().substr(0, index) : '';
      const afterStr = item.title ? item.title.toString().substr(index + searchValue.length) : '';
      const title =
        index > -1 ? (
          <span>
            {beforeStr}
            <span style={{ color: '#f50' }}>{searchValue}</span>
            {afterStr}
          </span>
        ) : (
          <span>{item.title as React.ReactNode}</span>
        );

      // 添加删除操作（排除根节点）
      const titleWithAction = item.key !== 'all' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{title}</span>
          <Popconfirm
            title="确定要删除这个分组吗？"
            onConfirm={() => handleDeleteGroup(item.key as string)}
            placement="left"
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={{ opacity: 0.6 }}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </div>
      ) : title;

      if (item.children) {
        return {
          ...item,
          title: titleWithAction,
          icon: expandedKeys.includes(item.key as string) ? <FolderOpenOutlined /> : item.icon,
          children: renderTreeNodes(item.children),
        };
      }

      return {
        ...item,
        title: titleWithAction,
      };
    });
  };

  return (
    <Card 
      title="资产分组" 
      size="small"
      style={{ height: '100%' }}
      styles={{ body: { padding: '12px' } }}
      extra={
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAddGroup}
        >
          新建
        </Button>
      }
    >
      <Search
        style={{ marginBottom: 8 }}
        placeholder="搜索分组"
        onChange={onChange}
        prefix={<SearchOutlined />}
        size="small"
      />
      <Tree
        showIcon
        onExpand={onExpand}
        expandedKeys={expandedKeys}
        autoExpandParent={autoExpandParent}
        onSelect={onSelect}
        treeData={renderTreeNodes(treeData)}
        style={{ background: 'transparent' }}
        height={400}
      />

      <Modal
        title="新建分组"
        open={isModalVisible}
        onCancel={() => setIsModalVisible(false)}
        footer={null}
        width={400}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="分组名称"
            name="name"
            rules={[
              { required: true, message: '请输入分组名称' },
              { min: 2, max: 50, message: '名称长度为2-50个字符' },
            ]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>

          <Form.Item
            label="分组类型"
            name="type"
            rules={[{ required: true, message: '请选择分组类型' }]}
          >
            <select className="ant-select-selector" style={{ width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '0 8px' }}>
              <option value="">请选择分组类型</option>
              <option value="production">生产环境</option>
              <option value="test">测试环境</option>
              <option value="dev">开发环境</option>
              <option value="general">通用分组</option>
            </select>
          </Form.Item>

          <Form.Item
            label="父分组"
            name="parentId"
            tooltip="可选：选择父分组创建层级结构"
          >
            <select className="ant-select-selector" style={{ width: '100%', height: '32px', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '0 8px' }}>
              <option value="">无父分组（顶级分组）</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
              <Button onClick={() => setIsModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AssetGroupTree;