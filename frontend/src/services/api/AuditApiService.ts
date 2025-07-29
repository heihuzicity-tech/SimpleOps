import { BaseApiService } from '../base/BaseApiService';
import type { PaginatedResult } from '../types/common';
import type {
  LoginLog,
  OperationLog,
  SessionRecord,
  CommandLog,
  AuditStatistics,
  ActiveSession,
  SessionMonitorLog,
  MonitorStatistics,
  LoginLogListParams,
  OperationLogListParams,
  SessionRecordListParams,
  CommandLogListParams,
  TerminateSessionRequest,
  SessionWarningRequest,
  BatchDeleteRequest
} from '../types/audit';

export class AuditApiService extends BaseApiService {
  constructor() {
    super('/audit');
  }

  // ==================== 登录日志 ====================
  async getLoginLogs(params: LoginLogListParams = {}): Promise<{
    success: boolean;
    data: PaginatedResult<LoginLog>;
  }> {
    const data = await this.get<PaginatedResult<LoginLog>>(this.buildUrl('/login-logs'), params);
    return {
      success: true,
      data
    };
  }

  // ==================== 操作日志 ====================
  async getOperationLogs(params: OperationLogListParams = {}): Promise<{
    success: boolean;
    data: PaginatedResult<OperationLog>;
  }> {
    const data = await this.get<PaginatedResult<OperationLog>>(this.buildUrl('/operation-logs'), params);
    return {
      success: true,
      data
    };
  }

  async getOperationLog(id: number): Promise<{ success: boolean; data: OperationLog }> {
    const data = await this.get<OperationLog>(this.buildUrl(`/operation-logs/${id}`));
    return {
      success: true,
      data
    };
  }

  async deleteOperationLog(id: number): Promise<{ success: boolean }> {
    await this.delete(this.buildUrl(`/operation-logs/${id}`));
    return {
      success: true
    };
  }

  async batchDeleteOperationLogs(request: BatchDeleteRequest): Promise<{ success: boolean }> {
    await this.post(this.buildUrl('/operation-logs/batch/delete'), request);
    return {
      success: true
    };
  }

  // ==================== 会话记录 ====================
  async getSessionRecords(params: SessionRecordListParams = {}): Promise<{
    success: boolean;
    data: PaginatedResult<SessionRecord>;
  }> {
    const data = await this.get<PaginatedResult<SessionRecord>>(this.buildUrl('/session-records'), params);
    return {
      success: true,
      data
    };
  }

  async getSessionRecord(id: number): Promise<{ success: boolean; data: SessionRecord }> {
    const data = await this.get<SessionRecord>(this.buildUrl(`/session-records/${id}`));
    return {
      success: true,
      data
    };
  }

  async deleteSessionRecord(sessionId: string): Promise<{ success: boolean }> {
    await this.delete(this.buildUrl(`/session-records/${sessionId}`));
    return {
      success: true
    };
  }

  async batchDeleteSessionRecords(request: BatchDeleteRequest): Promise<{ success: boolean }> {
    await this.post(this.buildUrl('/session-records/batch/delete'), request);
    return {
      success: true
    };
  }

  // ==================== 命令日志 ====================
  async getCommandLogs(params: CommandLogListParams = {}): Promise<{
    success: boolean;
    data: PaginatedResult<CommandLog>;
  }> {
    const data = await this.get<PaginatedResult<CommandLog>>(this.buildUrl('/command-logs'), params);
    return {
      success: true,
      data
    };
  }

  async getCommandLog(id: number): Promise<{ success: boolean; data: CommandLog }> {
    const data = await this.get<CommandLog>(this.buildUrl(`/command-logs/${id}`));
    return {
      success: true,
      data
    };
  }

  // ==================== 统计数据 ====================
  async getAuditStatistics(): Promise<{ success: boolean; data: AuditStatistics }> {
    const data = await this.get<AuditStatistics>(this.buildUrl('/statistics'));
    return {
      success: true,
      data
    };
  }

  async cleanupAuditLogs(): Promise<{ success: boolean; message: string }> {
    const response = await this.post<{ message: string }>(this.buildUrl('/cleanup'));
    return {
      success: true,
      message: response.message || '清理完成'
    };
  }

  // ==================== 实时监控 ====================
  async getActiveSessions(params: SessionRecordListParams = {}): Promise<{
    success: boolean;
    data: PaginatedResult<ActiveSession>;
  }> {
    const data = await this.get<PaginatedResult<ActiveSession>>(this.buildUrl('/active-sessions'), params);
    return {
      success: true,
      data
    };
  }

  async terminateSession(sessionId: string, request: TerminateSessionRequest): Promise<{ success: boolean }> {
    await this.post(this.buildUrl(`/sessions/${sessionId}/terminate`), request);
    return {
      success: true
    };
  }

  async sendSessionWarning(sessionId: string, request: SessionWarningRequest): Promise<{ success: boolean }> {
    await this.post(this.buildUrl(`/sessions/${sessionId}/warning`), request);
    return {
      success: true
    };
  }

  async getMonitorStatistics(): Promise<{ success: boolean; data: MonitorStatistics }> {
    const data = await this.get<MonitorStatistics>(this.buildUrl('/monitor/statistics'));
    return {
      success: true,
      data
    };
  }

  async getSessionMonitorLogs(sessionId: string, params: { page?: number; page_size?: number } = {}): Promise<{
    success: boolean;
    data: PaginatedResult<SessionMonitorLog>;
  }> {
    const data = await this.get<PaginatedResult<SessionMonitorLog>>(
      this.buildUrl(`/sessions/${sessionId}/monitor-logs`),
      params
    );
    return {
      success: true,
      data
    };
  }

  async markWarningAsRead(warningId: number): Promise<{ success: boolean }> {
    await this.post(this.buildUrl(`/warnings/${warningId}/read`));
    return {
      success: true
    };
  }
}

// 导出实例
export const auditApiService = new AuditApiService();

// 导出类中的所有方法作为独立函数（向后兼容）
export const getLoginLogs = (params?: LoginLogListParams) => auditApiService.getLoginLogs(params);
export const getOperationLogs = (params?: OperationLogListParams) => auditApiService.getOperationLogs(params);
export const getOperationLog = (id: number) => auditApiService.getOperationLog(id);
export const deleteOperationLog = (id: number) => auditApiService.deleteOperationLog(id);
export const batchDeleteOperationLogs = (request: BatchDeleteRequest) => auditApiService.batchDeleteOperationLogs(request);
export const getSessionRecords = (params?: SessionRecordListParams) => auditApiService.getSessionRecords(params);
export const getSessionRecord = (id: number) => auditApiService.getSessionRecord(id);
export const deleteSessionRecord = (sessionId: string) => auditApiService.deleteSessionRecord(sessionId);
export const batchDeleteSessionRecords = (request: BatchDeleteRequest) => auditApiService.batchDeleteSessionRecords(request);
export const getCommandLogs = (params?: CommandLogListParams) => auditApiService.getCommandLogs(params);
export const getCommandLog = (id: number) => auditApiService.getCommandLog(id);
export const getAuditStatistics = () => auditApiService.getAuditStatistics();
export const cleanupAuditLogs = () => auditApiService.cleanupAuditLogs();
export const getActiveSessions = (params?: SessionRecordListParams) => auditApiService.getActiveSessions(params);
export const terminateSession = (sessionId: string, request: TerminateSessionRequest) => auditApiService.terminateSession(sessionId, request);
export const sendSessionWarning = (sessionId: string, request: SessionWarningRequest) => auditApiService.sendSessionWarning(sessionId, request);
export const getMonitorStatistics = () => auditApiService.getMonitorStatistics();
export const getSessionMonitorLogs = (sessionId: string, params?: { page?: number; page_size?: number }) => auditApiService.getSessionMonitorLogs(sessionId, params);
export const markWarningAsRead = (warningId: number) => auditApiService.markWarningAsRead(warningId);