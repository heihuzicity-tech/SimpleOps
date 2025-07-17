// 工作台相关类型定义

export interface TabInfo {
  id: string;
  title: string;
  type: 'ssh' | 'database' | 'rdp';
  sessionId?: string;
  assetInfo: {
    id: number;
    name: string;
    address: string;
    port: number;
    protocol: string;
    os_type?: string;
  };
  credentialInfo: {
    id: number;
    username: string;
    type: string;
    name: string;
  };
  closable: boolean;
  modified: boolean;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'error';
  error?: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface WorkspaceState {
  tabs: TabInfo[];
  activeTabId: string;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  layout: 'horizontal' | 'vertical';
  loading: boolean;
  error: string | null;
}

export interface ConnectionParams {
  asset_id: number;
  credential_id: number;
  protocol: string;
  width?: number;
  height?: number;
}

export interface ConnectionHistory {
  id: string;
  assetId: number;
  assetName: string;
  assetAddress: string;
  credentialId: number;
  username: string;
  protocol: string;
  connectedAt: Date;
  duration?: number;
  status: 'success' | 'failed' | 'timeout';
}

export interface WorkspaceSettings {
  defaultSidebarWidth: number;
  maxTabs: number;
  autoReconnect: boolean;
  reconnectInterval: number;
  terminalSettings: {
    fontSize: number;
    fontFamily: string;
    theme: string;
    cursorBlink: boolean;
  };
}