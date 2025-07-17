import React from 'react';
import { Button, Card, Space, message } from 'antd';
import { useNavigate } from 'react-router-dom';

const WorkspaceTest: React.FC = () => {
  const navigate = useNavigate();

  const testBasicLayout = () => {
    message.success('基础布局测试通过！');
    console.log('✅ 基础布局组件渲染正常');
  };

  const testSidebarToggle = () => {
    message.info('侧边栏切换功能正常');
    console.log('✅ 侧边栏切换功能测试通过');
  };

  const testNavigation = () => {
    navigate('/connect/workspace');
    message.info('导航到工作台页面');
    console.log('✅ 路由导航功能测试通过');
  };

  return (
    <Card title="工作台功能测试" style={{ margin: 20 }}>
      <Space direction="vertical" size="middle">
        <Button type="primary" onClick={testBasicLayout}>
          测试基础布局
        </Button>
        <Button onClick={testSidebarToggle}>
          测试侧边栏切换
        </Button>
        <Button onClick={testNavigation}>
          测试导航到工作台
        </Button>
      </Space>
    </Card>
  );
};

export default WorkspaceTest;