import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  message,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Card,
  Tooltip,
  Popconfirm,
  Select,
  Transfer
} from 'antd';
import type { TransferDirection } from 'antd/es/transfer';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  ExclamationCircleOutlined,
  UsergroupAddOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { hasAdminPermission } from '../utils/permissions';
import { getAssetsByGroup, batchMoveAssets, getGroupStatistics } from '../services/groupManageAPI';
import { apiClient } from '../services/apiClient';

const { Option } = Select;

interface Asset {
  id: number;
  name: string;
  type: string;
  os_type: string;
  address: string;
  port: number;
  protocol: string;
  status: number;
  group_id?: number;
  group?: AssetGroup;
}

interface AssetGroup {
  id: number;
  name: string;
  description: string;
  asset_count?: number;
  created_at?: string;
  updated_at?: string;
}

const GroupManagePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const [groups, setGroups] = useState<AssetGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AssetGroup | null>(null);
  const [assetModalVisible, setAssetModalVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AssetGroup | null>(null);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [groupAssets, setGroupAssets] = useState<Asset[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    loadGroups();
  }, []);

  // 权限检查
  if (!hasAdminPermission(user)) {
    return (
      <Card style={{ margin: '24px' }}>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#ff4d4f' }} />
          <h2>权限不足</h2>
          <p>只有管理员才能访问分组管理功能</p>
        </div>
      </Card>
    );
  }

  // 加载分组列表
  const loadGroups = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/asset-groups/?page=1&page_size=100');
      if (response.data.success) {
        setGroups(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      message.error('加载分组列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 创建/编辑分组
  const handleSaveGroup = async (values: any) => {
    try {
      const url = editingGroup ? `/asset-groups/${editingGroup.id}` : '/asset-groups';
      const method = editingGroup ? 'put' : 'post';
      
      const response = await apiClient[method](url, values);
      
      if (response.data.success) {
        message.success(editingGroup ? '分组更新成功' : '分组创建成功');
        setGroupModalVisible(false);
        setEditingGroup(null);
        form.resetFields();
        await loadGroups();
      }
    } catch (error) {
      console.error('Failed to save group:', error);
      message.error(editingGroup ? '分组更新失败' : '分组创建失败');
    }
  };

  // 删除分组
  const handleDeleteGroup = async (groupId: number) => {
    try {
      const response = await apiClient.delete(`/asset-groups/${groupId}`);
      if (response.data.success) {
        message.success('分组删除成功');
        await loadGroups();
      }
    } catch (error: any) {
      console.error('Failed to delete group:', error);
      if (error.response?.data?.error?.includes('associated assets')) {
        message.error('该分组下还有资产，无法删除');
      } else {
        message.error('分组删除失败');
      }
    }
  };

  // 打开资产管理模态框
  const handleManageAssets = async (group: AssetGroup) => {
    setSelectedGroup(group);
    setAssetModalVisible(true);
    
    // 加载该分组的资产
    try {
      const groupAssetsResponse = await getAssetsByGroup(group.id, {
        page: 1,
        page_size: 100
      });
      const groupAssetList = groupAssetsResponse.data.assets || [];
      setGroupAssets(groupAssetList);
      setTargetKeys(groupAssetList.map((a: Asset) => a.id.toString()));

      // 只加载未分组的资产作为可选项
      const ungroupedResponse = await getAssetsByGroup(null, {
        page: 1,
        page_size: 100
      });
      const ungroupedAssets = ungroupedResponse.data.assets || [];
      
      // 可选资产 = 未分组资产 + 当前分组已有的资产
      const availableAssets = [...ungroupedAssets, ...groupAssetList];
      setAvailableAssets(availableAssets);
    } catch (error) {
      console.error('Failed to load assets:', error);
      message.error('加载资产列表失败');
    }
  };

  // 处理资产分配变更
  const handleAssetChange = (newTargetKeys: React.Key[], direction: TransferDirection, moveKeys: React.Key[]) => {
    setTargetKeys(newTargetKeys as string[]);
  };

  // 保存资产分配
  const handleSaveAssets = async () => {
    if (!selectedGroup) return;

    try {
      // 获取原有的资产ID列表
      const originalAssetIds = groupAssets.map((a: Asset) => a.id);
      
      // 获取新的资产ID列表
      const newAssetIds = targetKeys.map(k => parseInt(k));
      
      // 找出需要移出的资产（从当前分组移出，变为未分组）
      const assetsToRemove = originalAssetIds.filter(id => !newAssetIds.includes(id));
      
      // 找出需要加入的资产（从未分组移入到当前分组）
      const assetsToAdd = newAssetIds.filter(id => !originalAssetIds.includes(id));
      
      // 移出资产到未分组
      if (assetsToRemove.length > 0) {
        await batchMoveAssets({
          asset_ids: assetsToRemove,
          target_group_id: null
        });
      }
      
      // 从未分组加入资产到当前分组
      if (assetsToAdd.length > 0) {
        await batchMoveAssets({
          asset_ids: assetsToAdd,
          target_group_id: selectedGroup.id
        });
      }
      
      const moveCount = assetsToRemove.length + assetsToAdd.length;
      if (moveCount > 0) {
        message.success(`资产分配更新成功，共变更 ${moveCount} 个资产`);
      } else {
        message.info('没有变更');
      }
      
      setAssetModalVisible(false);
      await loadGroups();
    } catch (error) {
      console.error('Failed to save assets:', error);
      message.error('资产分配更新失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <FolderOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '资产数量',
      dataIndex: 'asset_count',
      key: 'asset_count',
      width: 100,
      render: (count: number) => <Tag color="blue">{count || 0}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => text ? new Date(text).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: AssetGroup) => (
        <Space>
          <Button
            type="link"
            icon={<UsergroupAddOutlined />}
            onClick={() => handleManageAssets(record)}
          >
            管理资产
          </Button>
          <Tooltip title="编辑">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingGroup(record);
                setGroupModalVisible(true);
                form.setFieldsValue({
                  name: record.name,
                  description: record.description
                });
              }}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Popconfirm
              title="确定删除此分组吗？"
              description="删除后分组下的资产将变为未分组状态"
              onConfirm={() => handleDeleteGroup(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="link"
                icon={<DeleteOutlined />}
                danger
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card
      title="分组管理"
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingGroup(null);
            setGroupModalVisible(true);
            form.resetFields();
          }}
        >
          新建分组
        </Button>
      }
    >
      <Table
        columns={columns}
        dataSource={groups}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      {/* 分组编辑模态框 */}
      <Modal
        title={editingGroup ? '编辑分组' : '创建分组'}
        open={groupModalVisible}
        onCancel={() => {
          setGroupModalVisible(false);
          setEditingGroup(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} onFinish={handleSaveGroup} layout="vertical">
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分组描述"
            rules={[{ required: true, message: '请输入分组描述' }]}
          >
            <Input.TextArea placeholder="请输入分组描述" rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 资产管理模态框 */}
      <Modal
        title={`管理资产 - ${selectedGroup?.name}`}
        open={assetModalVisible}
        onCancel={() => {
          setAssetModalVisible(false);
          setSelectedGroup(null);
          setTargetKeys([]);
        }}
        onOk={handleSaveAssets}
        okText="保存"
        cancelText="取消"
        width={800}
      >
        <div style={{ marginBottom: '16px' }}>
          <p>管理分组资产：</p>
          <ul style={{ color: '#666', fontSize: '12px', margin: '8px 0' }}>
            <li>左侧显示"未分组"的资产，可以选择加入到当前分组</li>
            <li>右侧显示当前分组已有的资产，可以移出到"未分组"</li>
            <li>点击保存后生效</li>
          </ul>
        </div>
        <Transfer
          dataSource={availableAssets.map(asset => ({
            key: asset.id.toString(),
            title: `${asset.name} (${asset.address})`,
            description: `${asset.type === 'server' ? '服务器' : '数据库'} - ${asset.protocol?.toUpperCase() || 'SSH'}`,
            disabled: false,
          }))}
          targetKeys={targetKeys}
          onChange={handleAssetChange}
          render={item => item.title}
          listStyle={{
            width: 350,
            height: 400,
          }}
          titles={['未分组资产', `${selectedGroup?.name || '当前分组'}资产`]}
          showSearch
          filterOption={(inputValue, option) =>
            option.title.toLowerCase().includes(inputValue.toLowerCase())
          }
        />
      </Modal>
    </Card>
  );
};

export default GroupManagePage;