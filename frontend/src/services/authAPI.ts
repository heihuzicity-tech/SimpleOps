import axios from 'axios';
import { apiClient } from './apiClient';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
}

export const login = async (credentials: LoginRequest) => {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  return response;
};

export const logout = async () => {
  const response = await apiClient.post('/auth/logout');
  return response;
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/profile');
  return response;
};

export const refreshToken = async () => {
  const response = await apiClient.post('/auth/refresh');
  return response;
};

export const changePassword = async (data: {
  old_password: string;
  new_password: string;
}) => {
  const response = await apiClient.post('/auth/change-password', data);
  return response;
}; 