// 工作台核心类型定义

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
  };
  credentialInfo: {
    id: number;
    username: string;
    type: string;
  };
  closable: boolean;
  modified: boolean;
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  createdAt: Date;
  lastActivity: Date;
}

export interface WorkspaceState {
  tabs: TabInfo[];
  activeTabId: string;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  layout: 'horizontal' | 'vertical';
  preferences: WorkspacePreferences;
}

export interface WorkspacePreferences {
  autoReconnect: boolean;
  maxTabs: number;
  defaultTerminalSize: {
    width: number;
    height: number;
  };
  theme: 'light' | 'dark';
  fontSize: number;
}

export interface SessionState {
  sessionId: string;
  tabId: string;
  websocket: WebSocket | null;
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  lastActivity: Date;
  reconnectCount: number;
  errorMessage?: string;
}

export interface ConnectionHistoryItem {
  id: string;
  assetId: number;
  assetName: string;
  assetAddress: string;
  credentialId: number;
  username: string;
  connectedAt: Date;
  duration: number;
  status: 'success' | 'failed' | 'timeout';
}

export interface WorkspaceLayoutProps {
  // 工作台布局组件的属性
}

export interface TabContainerProps {
  tabs: TabInfo[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export interface SidePanelProps {
  width: number;
  collapsed: boolean;
  onAssetSelect: (asset: any) => void;
  onToggleCollapse: () => void;
  onWidthChange: (width: number) => void;
}

export interface ConnectionPanelProps {
  tab: TabInfo;
  isActive: boolean;
  onClose: () => void;
  onError: (error: Error) => void;
  onStatusChange: (status: TabInfo['connectionStatus']) => void;
}

// 工作台操作类型
export type WorkspaceAction = 
  | { type: 'ADD_TAB'; payload: TabInfo }
  | { type: 'CLOSE_TAB'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'UPDATE_TAB_STATUS'; payload: { tabId: string; status: TabInfo['connectionStatus'] } }
  | { type: 'UPDATE_TAB_TITLE'; payload: { tabId: string; title: string } }
  | { type: 'SET_SIDEBAR_WIDTH'; payload: number }
  | { type: 'TOGGLE_SIDEBAR_COLLAPSED' }
  | { type: 'SET_PREFERENCES'; payload: Partial<WorkspacePreferences> };

// 连接参数类型
export interface ConnectionParams {
  asset_id: number;
  credential_id: number;
  protocol: string;
  width?: number;
  height?: number;
}

// 连接测试结果
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  duration: number;
  error?: string;
}

// 工作台事件类型
export type WorkspaceEventType = 
  | 'tab_created'
  | 'tab_closed'
  | 'tab_activated'
  | 'connection_established'
  | 'connection_lost'
  | 'error_occurred';

export interface WorkspaceEvent {
  type: WorkspaceEventType;
  tabId: string;
  timestamp: Date;
  data?: any;
}