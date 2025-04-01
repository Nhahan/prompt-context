import path from 'path';
import fs from 'fs-extra';
import { ApiCallType } from '../domain/types';

/**
 * API call log entry structure
 */
interface ApiCallLogEntry {
  type: ApiCallType;
  timestamp: number;
  metadata: Record<string, unknown>;
  duration: number;
}

/**
 * Types of API calls for analytics tracking - 확장
 */
export enum ExtendedApiCallType {
  CONTEXT_MEMORY_HIT = 'context_memory_hit', // 컨텍스트 메모리 활용
  SEQUENTIAL_THINKING = 'sequential_thinking', // 순차적 사고 접근
  CONTEXT_VISUALIZATION = 'context_visualization', // 컨텍스트 시각화
}

/**
 * Analytics data structure for API calls
 */
export interface ApiCallAnalytics {
  timestamp: number;
  type: ApiCallType;
  duration?: number;
  metadata?: Record<string, unknown>;
  success?: boolean;
  contextUtilizationScore?: number; // 컨텍스트 활용 점수 (0-1)
}

/**
 * Context Utilization Score Model
 * 컨텍스트 활용 효과를 정량적으로 측정하는 모델
 */
export class ContextUtilizationMetrics {
  private static readonly MAX_SCORE = 1.0;

  /**
   * 컨텍스트 활용 점수 계산
   * @param params 점수 계산을 위한 매개변수
   * @returns 0-1 사이의 컨텍스트 활용 점수
   */
  static calculateScore(params: {
    similarityScore?: number; // 컨텍스트 유사도 점수
    messageCount?: number; // 컨텍스트 내 메시지 수
    hasSummary?: boolean; // 요약 존재 여부
    isSequentialThinking?: boolean; // 순차적 사고 접근 여부
    responseTime?: number; // 응답 시간 (ms)
  }): number {
    let score = 0.0;
    let factorsUsed = 0;

    // 유사도 점수 반영
    if (params.similarityScore !== undefined) {
      score += params.similarityScore;
      factorsUsed++;
    }

    // 메시지 수에 따른 가중치
    if (params.messageCount !== undefined) {
      const messageWeight = Math.min(params.messageCount / 10, 1.0);
      score += messageWeight;
      factorsUsed++;
    }

    // 요약 존재 여부
    if (params.hasSummary) {
      score += 0.3;
      factorsUsed++;
    }

    // 순차적 사고 접근
    if (params.isSequentialThinking) {
      score += 0.5;
      factorsUsed++;
    }

    // 응답 시간 (더 빠를수록 점수 높음, 최대 0.2)
    if (params.responseTime !== undefined) {
      const timeWeight = Math.max(0, 0.2 - params.responseTime / 10000);
      score += timeWeight;
      factorsUsed++;
    }

    // 평균 계산 (0과 나누는 것 방지)
    return factorsUsed > 0 ? Math.min(score / factorsUsed, this.MAX_SCORE) : 0;
  }
}

/**
 * Class to track and analyze API calls
 */
export class ApiAnalytics {
  private readonly logDir: string;
  private readonly todayLogFile: string;
  private initialized: boolean = false;
  private readonly retentionDays: number = 30; // Default retention period
  private analyticsDir: string;
  private calls: ApiCallAnalytics[] = [];
  private callsByType: Map<ApiCallType, ApiCallAnalytics[]> = new Map();
  private utilizationScores: number[] = []; // 컨텍스트 활용 점수 배열

  /**
   * Create a new API analytics instance
   * @param baseDir Base directory for log files
   * @param retentionDays Number of days to retain log data
   */
  constructor(baseDir?: string, retentionDays?: number) {
    this.logDir = baseDir
      ? path.join(baseDir, 'analytics')
      : path.join(process.cwd(), '.mcp-servers', 'prompt-context', 'analytics');
    fs.ensureDirSync(this.logDir);

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    this.todayLogFile = path.join(this.logDir, `api-calls-${dateStr}.json`);

    this.initialized = true;
    if (retentionDays && retentionDays > 0) {
      this.retentionDays = retentionDays;
    }

    // Clean up old logs on creation
    this.cleanupOldLogs();

    this.analyticsDir = baseDir
      ? path.join(baseDir, 'analytics')
      : path.join(process.cwd(), '.mcp-servers', 'prompt-context', 'analytics');
    fs.ensureDirSync(this.analyticsDir);
  }

  /**
   * Track an API call for analytics
   * @param type Type of API call
   * @param metadata Optional metadata for the call
   * @param duration Optional duration of the call in ms
   * @param success Optional success status
   * @param utilizationScore Optional context utilization score
   */
  trackCall(
    type: ApiCallType,
    metadata?: Record<string, unknown>,
    duration?: number,
    success?: boolean,
    utilizationScore?: number
  ): void {
    const now = Date.now();

    // Calculate context utilization score if not provided
    if (utilizationScore === undefined) {
      utilizationScore = ContextUtilizationMetrics.calculateScore({
        similarityScore:
          typeof metadata?.similarity === 'number' ? (metadata.similarity as number) : undefined,
        messageCount:
          typeof metadata?.messageCount === 'number'
            ? (metadata.messageCount as number)
            : undefined,
        hasSummary:
          typeof metadata?.hasSummary === 'boolean' ? (metadata.hasSummary as boolean) : undefined,
        isSequentialThinking:
          typeof metadata?.isSequentialThinking === 'boolean'
            ? (metadata.isSequentialThinking as boolean)
            : undefined,
        responseTime: duration,
      });
    }

    const analytics: ApiCallAnalytics = {
      timestamp: now,
      type,
      metadata,
      duration,
      success,
      contextUtilizationScore: utilizationScore,
    };

    this.calls.push(analytics);

    // Store by type for easier retrieval
    if (!this.callsByType.has(type)) {
      this.callsByType.set(type, []);
    }
    this.callsByType.get(type)?.push(analytics);

    // Store utilization score
    if (utilizationScore !== undefined) {
      this.utilizationScores.push(utilizationScore);
    }

    // Auto-save analytics periodically (every 100 calls)
    if (this.calls.length % 100 === 0) {
      this.saveAnalytics().catch((err: Error) => {
        console.error(`[Analytics] Error auto-saving analytics: ${err}`);
      });
    }

    // Legacy behavior - write to daily log file
    this.logApiCall(type, metadata || {});
  }

  /**
   * 컨텍스트 활용 효과 측정 지표 보고
   * @returns 컨텍스트 활용에 대한 통계 정보
   */
  getUtilizationReport(): {
    averageScore: number;
    totalCalls: number;
    byType: Record<string, number>;
    historyTrend: Array<{ date: string; score: number }>;
  } {
    // 평균 점수 계산
    const avgScore =
      this.utilizationScores.length > 0
        ? this.utilizationScores.reduce((sum, score) => sum + score, 0) /
          this.utilizationScores.length
        : 0;

    // 유형별 호출 수 계산 (ApiCallType을 string으로 변환)
    const byType: Record<string, number> = {};

    // 기본 ApiCallType 처리
    for (const key in ApiCallType) {
      if (isNaN(Number(key))) {
        // 문자열 키만 처리
        const type = ApiCallType[key as keyof typeof ApiCallType];
        byType[type] = this.callsByType.get(type)?.length || 0;
      }
    }

    // 확장 ApiCallType 처리
    for (const key in ExtendedApiCallType) {
      if (isNaN(Number(key))) {
        // 문자열 키만 처리
        const type = ExtendedApiCallType[key as keyof typeof ExtendedApiCallType];
        byType[type] = 0; // 확장 유형은 현재 추적하지 않음
      }
    }

    // 날짜별 추세 계산 (최근 7일)
    const now = new Date();
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // 해당 날짜의 평균 점수 계산
      const dayStart = new Date(date).setHours(0, 0, 0, 0);
      const dayEnd = new Date(date).setHours(23, 59, 59, 999);

      const dayScores = this.calls
        .filter((call) => call.timestamp >= dayStart && call.timestamp <= dayEnd)
        .map((call) => call.contextUtilizationScore || 0);

      const dayAvg =
        dayScores.length > 0
          ? dayScores.reduce((sum, score) => sum + score, 0) / dayScores.length
          : 0;

      trend.push({
        date: dateStr,
        score: dayAvg,
      });
    }

    return {
      averageScore: avgScore,
      totalCalls: this.calls.length,
      byType,
      historyTrend: trend,
    };
  }

  /**
   * 분석 데이터 저장
   */
  async saveAnalytics(): Promise<void> {
    const analyticsFilePath = path.join(this.analyticsDir, 'context-utilization.json');

    try {
      const data = {
        timestamp: Date.now(),
        calls: this.calls,
        utilizationReport: this.getUtilizationReport(),
      };

      await fs.writeJSON(analyticsFilePath, data, { spaces: 2 });
    } catch (error) {
      console.error('[Analytics] Failed to save analytics data:', error);
      throw error;
    }
  }

  /**
   * Write an API call to the log file
   * @param callType Type of API call
   * @param metadata Call metadata
   * @returns Cleanup function or undefined if logging disabled
   */
  private logApiCall(
    callType: ApiCallType,
    metadata: Record<string, unknown> = {}
  ): (() => void) | undefined {
    if (!this.initialized) {
      return;
    }

    const startTime = Date.now();

    try {
      const logs: ApiCallLogEntry[] = [];
      if (fs.existsSync(this.todayLogFile)) {
        try {
          const existingLogs = fs.readJSONSync(this.todayLogFile);
          if (Array.isArray(existingLogs)) {
            logs.push(...existingLogs);
          }
        } catch (e) {
          // Log file exists but is not valid JSON, start fresh
          console.error(`[Analytics] Error reading log file: ${e}`);
        }
      }

      const logEntry: ApiCallLogEntry = {
        type: callType,
        timestamp: startTime,
        metadata,
        duration: 0, // Will be updated by cleanup function
      };
      logs.push(logEntry);

      fs.writeJSONSync(this.todayLogFile, logs, { spaces: 2 });

      // Return cleanup function
      return () => {
        try {
          // Update duration in the log entry
          logEntry.duration = Date.now() - startTime;

          // Update the log file
          if (fs.existsSync(this.todayLogFile)) {
            try {
              const updatedLogs = fs.readJSONSync(this.todayLogFile);
              if (Array.isArray(updatedLogs)) {
                // Find and update the log entry
                const index = updatedLogs.findIndex(
                  (entry) => entry.timestamp === logEntry.timestamp && entry.type === logEntry.type
                );
                if (index !== -1) {
                  updatedLogs[index] = logEntry;
                  fs.writeJSONSync(this.todayLogFile, updatedLogs, { spaces: 2 });
                }
              }
            } catch (e) {
              console.error(`[Analytics] Error updating log file: ${e}`);
            }
          }
        } catch (e) {
          console.error(`[Analytics] Error in cleanup function: ${e}`);
        }
      };
    } catch (e) {
      console.error(`[Analytics] Error logging API call: ${e}`);
      return;
    }
  }

  /**
   * Clean up log files older than retention period
   */
  private cleanupOldLogs(): void {
    try {
      const files = fs.readdirSync(this.logDir);
      const now = new Date();

      for (const file of files) {
        if (!file.startsWith('api-calls-') || !file.endsWith('.json')) continue;

        // Extract date from filename
        const dateStr = file.replace('api-calls-', '').replace('.json', '');
        const fileDate = new Date(dateStr);

        // Check if file is older than retention period
        const diffDays = Math.floor((now.getTime() - fileDate.getTime()) / (1000 * 3600 * 24));
        if (diffDays > this.retentionDays) {
          fs.unlinkSync(path.join(this.logDir, file));
          console.log(`[ApiAnalytics] Removed old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('[ApiAnalytics] Error cleaning up old logs:', error);
    }
  }
}
