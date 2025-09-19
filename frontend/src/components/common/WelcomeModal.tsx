import React from 'react';
import { Modal, Typography, Tag, Space, Divider, Row, Col, Statistic } from 'antd';
import { RobotOutlined, ExperimentOutlined, CodeOutlined, HeartOutlined, FileTextOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      title={
        <Space>
          <RobotOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <span>欢迎使用黑胡子堡垒机！</span>
        </Space>
      }
      open={visible}
      onOk={onClose}
      onCancel={onClose}
      width={600}
      okText="开始使用"
      cancelButtonProps={{ style: { display: 'none' } }}
      centered
    >
      <div style={{ padding: '10px 0' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Tag icon={<ExperimentOutlined />} color="orange">
              实验项目
            </Tag>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              这是一个<Text strong>实验性项目</Text>，旨在验证 AI 编程是否能够从0到1构建可运行的大型企业级应用。
            </Paragraph>
          </div>

          <div>
            <Tag icon={<CodeOutlined />} color="red">
              学习交流
            </Tag>
            <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              <Text type="danger" strong>⚠️ 重要提示：</Text>本项目仅供 AI 编程技术交流与学习使用，
              <Text type="danger" strong>不可用于生产环境！</Text>
            </Paragraph>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Title level={5} style={{ marginBottom: 12 }}>
              <FileTextOutlined /> 项目规模统计
            </Title>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic 
                  title="后端代码" 
                  value={23806} 
                  suffix="行"
                  valueStyle={{ color: '#3f8600', fontSize: 20 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>52个Go文件</Text>
              </Col>
              <Col span={8}>
                <Statistic 
                  title="前端代码" 
                  value={27342} 
                  suffix="行"
                  valueStyle={{ color: '#1890ff', fontSize: 20 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>110个TS文件</Text>
              </Col>
              <Col span={8}>
                <Statistic 
                  title="总代码量" 
                  value={51148} 
                  suffix="行"
                  valueStyle={{ color: '#cf1322', fontSize: 20 }}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>100% AI编写</Text>
              </Col>
            </Row>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div>
            <Title level={5} style={{ marginBottom: 12 }}>
              <RobotOutlined /> AI 开发方式分布
            </Title>
            
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ width: '60px', height: 16, background: '#52c41a', borderRadius: 3 }} />
                  <Text style={{ marginLeft: 10, fontSize: 13 }}>15% - Cursor + 提示词</Text>
                  <Tag color="green" style={{ marginLeft: 8, fontSize: 10 }}>Pro</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 70 }}>
                  快速代码补全和简单功能实现
                </Text>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ width: '140px', height: 16, background: '#1890ff', borderRadius: 3 }} />
                  <Text style={{ marginLeft: 10, fontSize: 13 }}>35% - Claude Code + 提示词</Text>
                  <Tag color="blue" style={{ marginLeft: 8, fontSize: 10 }}>Max 5x</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 150 }}>
                  复杂功能开发和代码重构
                </Text>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ width: '200px', height: 16, background: '#722ed1', borderRadius: 3 }} />
                  <Text style={{ marginLeft: 10, fontSize: 13 }}>50% - Claude Code + SPECS工作流</Text>
                  <Tag color="purple" style={{ marginLeft: 8, fontSize: 10 }}>Max 20x</Tag>
                </div>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 210 }}>
                  系统化的功能设计与实现，从需求到代码的完整流程
                </Text>
              </div>
            </Space>
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div style={{ textAlign: 'center' }}>
            <Paragraph type="secondary" style={{ marginBottom: 4 }}>
              <HeartOutlined style={{ color: '#eb2f96' }} /> 感谢您的使用与支持！
            </Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
              让我们一起见证 AI 编程的未来
            </Paragraph>
          </div>
        </Space>
      </div>
    </Modal>
  );
};

export default WelcomeModal;