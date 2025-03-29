/**
 * Module for API call analytics
 */

/**
 * API call type definition
 */
export enum ApiCallType {
  VECTOR_DB_ADD = 'vector_db_add',
  VECTOR_DB_SEARCH = 'vector_db_search',
  VECTOR_DB_DELETE = 'vector_db_delete',
  GRAPH_DB_ADD = 'graph_db_add',
  GRAPH_DB_SEARCH = 'graph_db_search',
  GRAPH_DB_DELETE = 'graph_db_delete',
  LLM_SUMMARIZE = 'llm_summarize',
  LLM_HIERARCHICAL_SUMMARIZE = 'llm_hierarchical_summarize',
  LLM_META_SUMMARIZE = 'llm_meta_summarize'
}

/**
 * API call information
 */
export interface ApiCallInfo {
  type: ApiCallType;
  timestamp: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * API statistics information
 */
export interface ApiStats {
  totalCalls: number;
  callsByType: Record<ApiCallType, number>;
  averageDuration?: Record<ApiCallType, number>;
}

/**
 * API call analyzer
 */
export class ApiAnalytics {
  private static instance: ApiAnalytics;
  private calls: ApiCallInfo[] = [];
  private callsByType: Map<ApiCallType, number> = new Map();
  private durationByType: Map<ApiCallType, number[]> = new Map();
  
  /**
   * Returns singleton instance
   */
  public static getInstance(): ApiAnalytics {
    if (!ApiAnalytics.instance) {
      ApiAnalytics.instance = new ApiAnalytics();
    }
    return ApiAnalytics.instance;
  }
  
  /**
   * Tracks API call
   * @param type API call type
   * @param metadata Additional metadata
   * @returns Function to end call tracking
   */
  public trackCall(type: ApiCallType, metadata?: Record<string, any>): () => void {
    const startTime = Date.now();
    const call: ApiCallInfo = {
      type,
      timestamp: startTime,
      metadata
    };
    
    this.calls.push(call);
    
    // Update call count by type
    const currentCount = this.callsByType.get(type) || 0;
    this.callsByType.set(type, currentCount + 1);
    
    // Return function to execute when call ends
    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      call.duration = duration;
      
      // Record duration by type
      if (!this.durationByType.has(type)) {
        this.durationByType.set(type, []);
      }
      this.durationByType.get(type)!.push(duration);
    };
  }
  
  /**
   * Returns call count for specific API call type
   * @param type API call type
   * @returns Call count
   */
  public getCallCount(type: ApiCallType): number {
    return this.callsByType.get(type) || 0;
  }
  
  /**
   * Returns call counts for all API call types
   * @returns Call counts by type
   */
  public getAllCallCounts(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [type, count] of this.callsByType.entries()) {
      result[type] = count;
    }
    return result;
  }
  
  /**
   * Returns API call statistics
   * @returns API statistics
   */
  public getStats(): ApiStats {
    const callsByType: Record<ApiCallType, number> = {} as Record<ApiCallType, number>;
    const averageDuration: Record<ApiCallType, number> = {} as Record<ApiCallType, number>;
    
    // Set default values for all ApiCallTypes
    Object.values(ApiCallType).forEach(type => {
      callsByType[type] = this.callsByType.get(type as ApiCallType) || 0;
      
      const durations = this.durationByType.get(type as ApiCallType) || [];
      if (durations.length > 0) {
        const totalDuration = durations.reduce((sum, d) => sum + d, 0);
        averageDuration[type] = totalDuration / durations.length;
      } else {
        averageDuration[type] = 0;
      }
    });
    
    return {
      totalCalls: this.calls.length,
      callsByType,
      averageDuration
    };
  }
  
  /**
   * Filters API call information within a specific time range
   * @param startTime Start time (milliseconds)
   * @param endTime End time (milliseconds)
   * @returns Filtered call information
   */
  public getCallsInTimeRange(startTime: number, endTime: number): ApiCallInfo[] {
    return this.calls.filter(call => 
      call.timestamp >= startTime && call.timestamp <= endTime
    );
  }
  
  /**
   * Reset all statistics
   */
  public reset(): void {
    this.calls = [];
    this.callsByType.clear();
    this.durationByType.clear();
  }
}

// Export singleton instance for convenience
export const apiAnalytics = ApiAnalytics.getInstance(); 