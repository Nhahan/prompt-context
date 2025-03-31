import path from 'path';
import fs from 'fs-extra';
import { ApiCallType } from '../domain/types';

/**
 * API call log entry structure
 */
interface ApiCallLogEntry {
  type: ApiCallType;
  timestamp: number;
  metadata: Record<string, any>;
  duration: number;
}

/**
 * Class to track and analyze API calls
 */
export class ApiAnalytics {
  private readonly logDir: string;
  private readonly todayLogFile: string;
  private initialized: boolean = false;
  private readonly retentionDays: number = 30; // Default retention period

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
  }

  /**
   * Track an API call
   * @param callType Type of API call
   * @param metadata Additional call metadata
   * @returns A function to stop timing the call (if timing is needed)
   */
  trackCall(callType: ApiCallType, metadata: Record<string, any> = {}): (() => void) | undefined {
    if (!this.initialized) return;

    const startTime = Date.now();
    const callData: ApiCallLogEntry = {
      type: callType,
      timestamp: startTime,
      metadata,
      duration: 0, // Will be updated when the call completes
    };

    // Write to log file
    try {
      let todayLog: ApiCallLogEntry[] = [];
      if (fs.existsSync(this.todayLogFile)) {
        try {
          todayLog = fs.readJsonSync(this.todayLogFile);
        } catch (e) {
          console.error('[ApiAnalytics] Error reading log file, starting new log:', e);
        }
      }

      // Add the call data without duration initially
      todayLog.push(callData);
      fs.writeJsonSync(this.todayLogFile, todayLog, { spaces: 2 });

      // Return a function to stop timing
      return () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        // Find and update the call data with duration
        try {
          const updatedLog: ApiCallLogEntry[] = fs.readJsonSync(this.todayLogFile);
          const callIndex = updatedLog.findIndex(
            (call: ApiCallLogEntry) =>
              call.timestamp === startTime &&
              call.type === callType &&
              JSON.stringify(call.metadata) === JSON.stringify(metadata)
          );

          if (callIndex !== -1) {
            updatedLog[callIndex].duration = duration;
            fs.writeJsonSync(this.todayLogFile, updatedLog, { spaces: 2 });
          }
        } catch (e) {
          console.error('[ApiAnalytics] Error updating call duration:', e);
        }
      };
    } catch (error) {
      console.error('[ApiAnalytics] Error tracking API call:', error);
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
