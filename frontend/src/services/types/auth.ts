// 认证相关的类型定义

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  roles: Array<{
    id: number;
    name: string;
    description: string;
  }>;
  permissions?: string[];
  last_login?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}