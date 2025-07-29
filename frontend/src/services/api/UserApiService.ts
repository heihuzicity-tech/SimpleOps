import { BaseApiService } from '../base/BaseApiService';
import type { PaginatedResult } from '../types/common';
import type { User, CreateUserRequest, UpdateUserRequest, GetUsersParams } from '../types/user';

export class UserApiService extends BaseApiService {
  constructor() {
    super('/users');
  }
  
  // 保持原有接口不变，方便迁移
  async getUsers(params: GetUsersParams = {}): Promise<{
    success: boolean;
    data: PaginatedResult<User>;
  }> {
    // 内部使用BaseApiService的方法
    const data = await this.get<PaginatedResult<User>>(this.endpoint, params);
    return {
      success: true,
      data
    };
  }
  
  async getUserById(id: number): Promise<{ success: boolean; data: User }> {
    const data = await this.get<User>(this.buildUrl(`/${id}`));
    return {
      success: true,
      data
    };
  }
  
  async createUser(userData: CreateUserRequest): Promise<{ success: boolean; data: User }> {
    const data = await this.post<User>(this.endpoint, userData);
    return {
      success: true,
      data
    };
  }
  
  async updateUser(id: number, userData: UpdateUserRequest): Promise<{ success: boolean; data: User }> {
    const data = await this.put<User>(this.buildUrl(`/${id}`), userData);
    return {
      success: true,
      data
    };
  }
  
  async deleteUser(id: number): Promise<{ success: boolean }> {
    await this.delete(this.buildUrl(`/${id}`));
    return {
      success: true
    };
  }
  
  // 特有方法
  async assignUserRoles(userId: number, roleIds: number[]): Promise<{ success: boolean; data: User }> {
    const data = await this.post<User>(this.buildUrl(`/${userId}/roles`), { role_ids: roleIds });
    return {
      success: true,
      data
    };
  }
}

// 导出实例，保持向后兼容
export const userApiService = new UserApiService();

// 导出原有的函数式接口（向后兼容）
export const getUsers = (params?: GetUsersParams) => userApiService.getUsers(params);
export const getUserById = (id: number) => userApiService.getUserById(id);
export const createUser = (userData: CreateUserRequest) => userApiService.createUser(userData);
export const updateUser = (id: number, userData: UpdateUserRequest) => userApiService.updateUser(id, userData);
export const deleteUser = (id: number) => userApiService.deleteUser(id);
export const assignUserRoles = (userId: number, roleIds: number[]) => userApiService.assignUserRoles(userId, roleIds);