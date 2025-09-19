import { apiClient } from './apiClient';

export interface User {
  id: number;
  username: string;
  email: string;
  roles: Array<{
    id: number;
    name: string;
    description: string;
  }>;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface GetUsersParams {
  page?: number;
  page_size?: number;
  keyword?: string;
}

export interface GetUsersResponse {
  success: boolean;
  data: {
    items: User[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role_ids: number[];
}

export const getUsers = async (params: GetUsersParams = {}) => {
  const response = await apiClient.get<GetUsersResponse>('/users', { params });
  return response;
};

export const getUserById = async (id: number) => {
  const response = await apiClient.get<User>(`/users/${id}`);
  return response;
};

export const createUser = async (userData: CreateUserRequest) => {
  const response = await apiClient.post<{success: boolean, data: User}>('/users', userData);
  return response;
};

export const updateUser = async (id: number, userData: Partial<User>) => {
  const response = await apiClient.put<{success: boolean, data: User}>(`/users/${id}`, userData);
  return response;
};

export const deleteUser = async (id: number) => {
  const response = await apiClient.delete(`/users/${id}`);
  return response;
};

export const getRoles = async () => {
  const response = await apiClient.get('/roles');
  return response;
};

export const assignUserRoles = async (userId: number, roleIds: number[]) => {
  const response = await apiClient.post(`/users/${userId}/roles`, { role_ids: roleIds });
  return response;
}; 