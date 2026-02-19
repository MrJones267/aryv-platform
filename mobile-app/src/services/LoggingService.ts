/**
 * @fileoverview Centralized logging service for the ARYV mobile app
 * @author Oabona-Majoko
 * @created 2025-01-25
 * @lastModified 2025-01-25
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  data?: Record<string, unknown>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

interface LoggingConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStoredLogs: number;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class LoggingService {
  private config: LoggingConfig = {
    minLevel: __DEV__ ? 'debug' : 'warn',
    enableConsole: __DEV__,
    enableStorage: true,
    maxStoredLogs: 1000,
  };

  private logs: LogEntry[] = [];
  private listeners: Array<(entry: LogEntry) => void> = [];

  /**
   * Configure the logging service
   */
  configure(config: Partial<LoggingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if a log level should be logged based on config
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Format error object for logging
   */
  private formatError(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;

    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        code: (error as Error & { code?: string }).code,
      };
    }

    if (typeof error === 'string') {
      return { message: error };
    }

    return { message: String(error) };
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown,
    error?: unknown
  ): LogEntry {
    // Normalize data to Record<string, unknown> for storage
    const normalizedData = data === undefined ? undefined
      : (typeof data === 'object' && data !== null && !Array.isArray(data))
        ? data as Record<string, unknown>
        : { value: data };
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      data: normalizedData,
      error: this.formatError(error),
    };
  }

  /**
   * Store log entry
   */
  private storeLog(entry: LogEntry): void {
    if (!this.config.enableStorage) return;

    this.logs.push(entry);

    // Trim logs if exceeding max
    if (this.logs.length > this.config.maxStoredLogs) {
      this.logs = this.logs.slice(-this.config.maxStoredLogs);
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(entry);
      } catch {
        // Ignore listener errors
      }
    });
  }

  /**
   * Output to console
   */
  private consoleOutput(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const prefix = entry.context ? `[${entry.context}]` : '';
    const message = `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.data || '');
        break;
      case 'info':
        console.info(message, entry.data || '');
        break;
      case 'warn':
        console.warn(message, entry.data || '');
        break;
      case 'error':
        console.error(message, entry.error || entry.data || '');
        break;
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown,
    error?: unknown
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, context, data, error);
    this.storeLog(entry);
    this.consoleOutput(entry);
  }

  /**
   * Debug level logging
   */
  debug(message: string, context?: string, data?: unknown): void {
    this.log('debug', message, context, data);
  }

  /**
   * Info level logging
   */
  info(message: string, context?: string, data?: unknown): void {
    this.log('info', message, context, data);
  }

  /**
   * Warning level logging
   */
  warn(message: string, context?: string, data?: unknown): void {
    this.log('warn', message, context, data);
  }

  /**
   * Error level logging
   */
  error(message: string, error?: unknown, context?: string, data?: unknown): void {
    this.log('error', message, context, data, error);
  }

  /**
   * Create a scoped logger for a specific context
   */
  createLogger(context: string): ScopedLogger {
    return new ScopedLogger(this, context);
  }

  /**
   * Get stored logs
   */
  getLogs(filter?: { level?: LogLevel; context?: string; limit?: number }): LogEntry[] {
    let result = [...this.logs];

    if (filter?.level) {
      const minPriority = LOG_LEVEL_PRIORITY[filter.level];
      result = result.filter(log => LOG_LEVEL_PRIORITY[log.level] >= minPriority);
    }

    if (filter?.context) {
      result = result.filter(log => log.context === filter.context);
    }

    if (filter?.limit) {
      result = result.slice(-filter.limit);
    }

    return result;
  }

  /**
   * Clear stored logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Add a log listener
   */
  addListener(listener: (entry: LogEntry) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Export logs as JSON string
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

/**
 * Scoped logger for a specific context
 */
class ScopedLogger {
  constructor(
    private service: LoggingService,
    private context: string
  ) {}

  debug(message: string, data?: unknown): void {
    this.service.debug(message, this.context, data);
  }

  info(message: string, data?: unknown): void {
    this.service.info(message, this.context, data);
  }

  warn(message: string, data?: unknown): void {
    this.service.warn(message, this.context, data);
  }

  error(message: string, error?: unknown, data?: unknown): void {
    this.service.error(message, error, this.context, data);
  }
}

// Singleton instance
export const logger = new LoggingService();

// Export scoped logger type
export type { ScopedLogger };

export default logger;
