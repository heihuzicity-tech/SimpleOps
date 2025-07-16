import { message } from 'antd';
import { AppDispatch } from '../store';
import { testConnection } from '../store/assetSlice';

export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  message: string;
}

/**
 * 执行分层连接测试
 * 1. 先测试主机连通性（ping）
 * 2. 再测试具体服务（SSH/RDP等）
 */
export const performConnectionTest = async (
  dispatch: AppDispatch,
  asset: any,
  credentialId: number
): Promise<ConnectionTestResult> => {
  try {
    // 第一层：主机连通性测试
    message.info('正在测试主机连通性...');
    const pingResult = await dispatch(testConnection({
      asset_id: asset.id,
      credential_id: credentialId,
      test_type: 'ping'
    })).unwrap();
    
    if (!pingResult.result.success) {
      const errorMsg = `主机不可达: ${asset.address}`;
      message.error(errorMsg, 4);
      return {
        success: false,
        message: errorMsg
      };
    }
    
    // 第二层：服务端口测试
    let serviceTestType = 'ping';
    if (asset.type === 'server') {
      if (asset.protocol === 'ssh') serviceTestType = 'ssh';
      else if (asset.protocol === 'rdp') serviceTestType = 'rdp';
    } else if (asset.type === 'database') {
      serviceTestType = 'database';
    }
    
    if (serviceTestType !== 'ping') {
      message.info(`正在测试${serviceTestType.toUpperCase()}服务...`);
      const serviceResult = await dispatch(testConnection({
        asset_id: asset.id,
        credential_id: credentialId,
        test_type: serviceTestType as 'ping' | 'ssh' | 'rdp' | 'database'
      })).unwrap();
      
      if (serviceResult.result.success) {
        const successMsg = `${serviceTestType.toUpperCase()}服务正常 (延迟: ${serviceResult.result.latency}ms)`;
        message.success(successMsg, 3);
        return {
          success: true,
          latency: serviceResult.result.latency,
          message: successMsg
        };
      } else {
        const errorMsg = `${serviceTestType.toUpperCase()}服务异常: ${serviceResult.result.message}`;
        message.error(errorMsg, 4);
        return {
          success: false,
          message: errorMsg
        };
      }
    } else {
      const successMsg = `主机连通正常 (延迟: ${pingResult.result.latency}ms)`;
      message.success(successMsg, 3);
      return {
        success: true,
        latency: pingResult.result.latency,
        message: successMsg
      };
    }
  } catch (error: any) {
    const errorMsg = `连接测试异常: ${error.message}`;
    message.error(errorMsg, 4);
    return {
      success: false,
      message: errorMsg
    };
  }
};

/**
 * 快速测试连接（仅测试主机连通性）
 */
export const quickConnectionTest = async (
  dispatch: AppDispatch,
  asset: any,
  credentialId: number
): Promise<boolean> => {
  try {
    const result = await dispatch(testConnection({
      asset_id: asset.id,
      credential_id: credentialId,
      test_type: 'ping'
    })).unwrap();
    
    return result.result.success;
  } catch (error) {
    return false;
  }
};