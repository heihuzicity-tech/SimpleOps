import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import userReducer from './userSlice';
import assetReducer from './assetSlice';
import credentialReducer from './credentialSlice';
import sshSessionReducer from './sshSessionSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    user: userReducer,
    asset: assetReducer,
    credential: credentialReducer,
    sshSession: sshSessionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch; 