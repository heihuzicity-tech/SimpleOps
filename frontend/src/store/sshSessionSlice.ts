import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { SSHSessionResponse, SSHSessionRequest, ConnectionStatus } from '../types/ssh';
import { sshAPI } from '../services/sshAPI';

interface SSHSessionState {
  sessions: SSHSessionResponse[];
  activeSessions: Record<string, ConnectionStatus>;
  loading: boolean;
  error: string | null;
}

const initialState: SSHSessionState = {
  sessions: [],
  activeSessions: {},
  loading: false,
  error: null,
};

// 获取会话列表
export const fetchSessions = createAsyncThunk(
  'sshSession/fetchSessions',
  async () => {
    return await sshAPI.getSessions();
  }
);

// 创建新会话
export const createSession = createAsyncThunk(
  'sshSession/createSession',
  async (params: SSHSessionRequest) => {
    return await sshAPI.createSession(params);
  }
);

// 关闭会话
export const closeSession = createAsyncThunk(
  'sshSession/closeSession',
  async (sessionId: string) => {
    await sshAPI.closeSession(sessionId);
    return sessionId;
  }
);

const sshSessionSlice = createSlice({
  name: 'sshSession',
  initialState,
  reducers: {
    setConnectionStatus: (state, action: PayloadAction<{ sessionId: string; status: ConnectionStatus }>) => {
      state.activeSessions[action.payload.sessionId] = action.payload.status;
    },
    removeActiveSession: (state, action: PayloadAction<string>) => {
      delete state.activeSessions[action.payload];
    },
    clearError: (state) => {
      state.error = null;
    },
    updateSessionStatus: (state, action: PayloadAction<{ sessionId: string; status: SSHSessionResponse['status'] }>) => {
      const session = state.sessions.find(s => s.id === action.payload.sessionId);
      if (session) {
        session.status = action.payload.status;
      }
    }
  },
  extraReducers: (builder) => {
    builder
      // 获取会话列表
      .addCase(fetchSessions.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.loading = false;
        state.sessions = action.payload;
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '获取会话列表失败';
        state.sessions = []; // 确保sessions始终是数组
      })
      // 创建会话
      .addCase(createSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.loading = false;
        state.sessions.push(action.payload);
      })
      .addCase(createSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || '创建会话失败';
      })
      // 关闭会话
      .addCase(closeSession.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter(session => session.id !== action.payload);
        delete state.activeSessions[action.payload];
      });
  },
});

export const { setConnectionStatus, removeActiveSession, clearError, updateSessionStatus } = sshSessionSlice.actions;
export default sshSessionSlice.reducer;