// 用户相关的类型定义

import type { Timestamps, WithId } from './common';

export interface Role extends WithId {
  name: string;
  description: string;
}

export interface User extends WithId, Timestamps {
  username: string;
  email: string;
  roles: Role[];
  status: 'active' | 'inactive';
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role_ids: number[];
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role_ids?: number[];
  status?: 'active' | 'inactive';
}

export interface GetUsersParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}