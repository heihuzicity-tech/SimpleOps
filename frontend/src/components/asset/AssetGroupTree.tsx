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
import { getAssetGroups, createAssetGroup, deleteAssetGroup, AssetGroup } from '../../services/assetAPI';

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
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载资产分组数据
  const loadAssetGroups = async () => {
    try {
      setLoading(true);
      const response = await getAssetGroups({ page: 1, page_size: 100 });
      const groupsData = response.data.data || [];
      setGroups(groupsData);
    } catch (error) {
      console.error('加载资产分组失败:', error);
      message.error('加载资产分组失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssetGroups();
  }, []);

  useEffect(() => {
    const generateTreeData = (): DataNode[] => {
      // 将后端的扁平分组数据转换为树形结构
      const groupItems = groups.map(group => ({
        title: `${group.name} (${group.asset_count})`,
        key: group.id.toString(),
        icon: <FolderOutlined />,
        isLeaf: true,
      }));

      return [
        {
          title: '全部主机',
          key: 'all',
          icon: <FolderOutlined />,
          children: groupItems,
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

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      await createAssetGroup({
        name: values.name,
        description: values.description || '',
      });
      setIsModalVisible(false);
      message.success('分组创建成功');
      form.resetFields();
      
      // 重新加载分组数据
      await loadAssetGroups();
      
      if (onGroupChange) {
        onGroupChange();
      }
    } catch (error) {
      console.error('创建分组失败:', error);
      message.error('创建分组失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find(g => g.id === parseInt(groupId));
    if (!group) return;
    
    // 检查是否还有主机在该分组中
    if (group.asset_count > 0) {
      message.error('该分组下还有主机，请先移除主机');
      return;
    }

    try {
      setLoading(true);
      await deleteAssetGroup(parseInt(groupId));
      message.success('分组删除成功');
      
      // 重新加载分组数据
      await loadAssetGroups();
      
      if (onGroupChange) {
        onGroupChange();
      }
    } catch (error) {
      console.error('删除分组失败:', error);
      message.error('删除分组失败');
    } finally {
      setLoading(false);
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
            label="分组描述"
            name="description"
          >
            <Input.TextArea placeholder="请输入分组描述（可选）" rows={3} />
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