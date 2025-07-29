import { BaseApiService } from '../base/BaseApiService';
import type { 
  LoginRequest, 
  TokenResponse, 
  UserProfile, 
  ChangePasswordRequest,
  RefreshTokenResponse 
} from '../types/auth';

export class AuthApiService extends BaseApiService {
  constructor() {
    super('');  // 使用空字符串，因为认证相关的API分布在不同路径
  }
  
  // 登录
  async login(credentials: LoginRequest): Promise<{
    success: boolean;
    data: TokenResponse;
  }> {
    const data = await this.post<TokenResponse>('/auth/login', credentials);
    return {
      success: true,
      data
    };
  }
  
  // 登出
  async logout(): Promise<{ success: boolean }> {
    // 注意：logout接口可能在根路径而不是/auth下
    await this.post('/logout');
    return {
      success: true
    };
  }
  
  // 获取当前用户信息
  async getCurrentUser(): Promise<{ success: boolean; data: UserProfile }> {
    // 注意：profile接口可能在根路径
    const data = await this.get<UserProfile>('/profile');
    return {
      success: true,
      data
    };
  }
  
  // 刷新Token
  async refreshToken(): Promise<{ success: boolean; data: RefreshTokenResponse }> {
    const data = await this.post<RefreshTokenResponse>('/auth/refresh');
    return {
      success: true,
      data
    };
  }
  
  // 修改密码
  async changePassword(passwordData: ChangePasswordRequest): Promise<{ success: boolean }> {
    // 注意：change-password接口可能在根路径
    await this.post('/change-password', passwordData);
    return {
      success: true
    };
  }
}

// 导出实例
export const authApiService = new AuthApiService();

// 导出函数式接口（向后兼容）
export const login = (credentials: LoginRequest) => authApiService.login(credentials);
export const logout = () => authApiService.logout();
export const getCurrentUser = () => authApiService.getCurrentUser();
export const refreshToken = () => authApiService.refreshToken();
export const changePassword = (data: ChangePasswordRequest) => authApiService.changePassword(data);