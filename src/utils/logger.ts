import { LogLevel } from '../types/logger'
import type { LogEntry, LoggerConfig, RemoteLogPayload } from '../types/logger'
import { nanoid } from 'nanoid'

// Environment detection
const isDevelopment = (import.meta as any).env?.DEV ?? process.env?.NODE_ENV === 'development'
const isProduction = (import.meta as any).env?.PROD ?? process.env?.NODE_ENV === 'production'
const isBrowser = typeof window !== 'undefined'

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level: isDevelopment ? LogLevel.DEBUG : LogLevel.WARN,
  enableConsole: true,
  enableRemote: isProduction,
  enablePerformance: isDevelopment,
  enableContext: true,
  maxLogEntries: 1000,
  environment: isDevelopment ? 'development' : isProduction ? 'production' : 'test'
}

// Session ID for tracking
const SESSION_ID = nanoid()

// Log buffer for remote sending
let logBuffer: LogEntry[] = []

// Performance monitoring
const performanceMarks = new Map<string, number>()

class Logger {
  private config: LoggerConfig
  private logEntries: LogEntry[] = []

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level
  }

  private createLogEntry(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    method?: string,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      method,
      message,
      data
    }

    // Add context if enabled
    if (this.config.enableContext && isBrowser) {
      entry.context = {
        sessionId: SESSION_ID,
        route: window.location?.pathname,
        userAgent: navigator.userAgent
      }
    }

    // Add stack trace for errors
    if (error) {
      entry.stack = error.stack
    }

    return entry
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString()
    const component = entry.component ? `[${entry.component}]` : ''
    const method = entry.method ? `::${entry.method}` : ''
    
    return `${timestamp} ${component}${method} ${entry.message}`
  }

  private getConsoleMethod(level: LogLevel): 'error' | 'warn' | 'info' | 'log' {
    switch (level) {
      case LogLevel.ERROR:
        return 'error'
      case LogLevel.WARN:
        return 'warn'
      case LogLevel.INFO:
        return 'info'
      case LogLevel.DEBUG:
      default:
        return 'log'
    }
  }

  private outputToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return

    const method = this.getConsoleMethod(entry.level)
    const message = this.formatConsoleMessage(entry)

    if (entry.data) {
      ;(console as any)[method](message, entry.data)
    } else {
      ;(console as any)[method](message)
    }

    // Add stack trace for errors
    if (entry.stack && entry.level === LogLevel.ERROR) {
      console.error(entry.stack)
    }
  }

  private addToBuffer(entry: LogEntry): void {
    logBuffer.push(entry)
    
    // Maintain buffer size
    if (logBuffer.length > this.config.maxLogEntries) {
      logBuffer = logBuffer.slice(-this.config.maxLogEntries)
    }

    // Store in instance buffer too
    this.logEntries.push(entry)
    if (this.logEntries.length > this.config.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxLogEntries)
    }
  }

  private async sendToRemote(entries: LogEntry[]): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return

    try {
      const payload: RemoteLogPayload = {
        entries,
        metadata: {
          userAgent: navigator?.userAgent || 'Unknown',
          url: window?.location?.href || 'Unknown',
          timestamp: new Date().toISOString(),
          sessionId: SESSION_ID
        }
      }

      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
    } catch (error) {
      // Silently fail remote logging to avoid infinite loops
      console.warn('Failed to send logs to remote endpoint:', error)
    }
  }

  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    method?: string,
    error?: Error
  ): void {
    // Early return for performance in production
    if (!this.shouldLog(level)) return

    const entry = this.createLogEntry(level, component, message, data, method, error)
    
    // Add to buffer
    this.addToBuffer(entry)

    // Output to console (development or important messages)
    if (isDevelopment || level >= LogLevel.WARN) {
      this.outputToConsole(entry)
    }

    // Send to remote for errors in production
    if (isProduction && level >= LogLevel.ERROR) {
      this.sendToRemote([entry])
    }
  }

  // Public logging methods
  debug(component: string, message: string, data?: any, method?: string): void {
    // No-op in production for performance
    if (isProduction) return
    this.log(LogLevel.DEBUG, component, message, data, method)
  }

  info(component: string, message: string, data?: any, method?: string): void {
    this.log(LogLevel.INFO, component, message, data, method)
  }

  warn(component: string, message: string, data?: any, method?: string): void {
    this.log(LogLevel.WARN, component, message, data, method)
  }

  error(component: string, message: string, error?: Error, data?: any, method?: string): void {
    this.log(LogLevel.ERROR, component, message, data, method, error)
  }

  // Performance timing
  time(label: string): void {
    if (!this.config.enablePerformance) return
    performanceMarks.set(label, performance.now())
  }

  timeEnd(label: string, component: string, message?: string): number | undefined {
    if (!this.config.enablePerformance) return

    const startTime = performanceMarks.get(label)
    if (!startTime) {
      this.warn('Logger', `Timer "${label}" was not started`)
      return
    }

    const duration = performance.now() - startTime
    performanceMarks.delete(label)

    const logMessage = message || `Timer "${label}" completed`
    this.debug(component, logMessage, { duration: `${duration.toFixed(2)}ms` })

    return duration
  }

  // Memory usage (browser only)
  memory(component: string, label?: string): void {
    if (!this.config.enablePerformance || !isBrowser) return

    // @ts-ignore - performance.memory is not in all browsers
    const memory = (performance as any).memory
    if (!memory) return

    const memoryInfo = {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024)
    }

    const message = label ? `Memory usage - ${label}` : 'Memory usage'
    this.debug(component, message, memoryInfo)
  }

  // Batch send logs to remote
  async flushLogs(): Promise<void> {
    if (logBuffer.length === 0) return

    const logsToSend = [...logBuffer]
    logBuffer = []

    await this.sendToRemote(logsToSend)
  }

  // Get recent logs
  getRecentLogs(count = 50): LogEntry[] {
    return this.logEntries.slice(-count)
  }

  // Update configuration
  configure(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Get current configuration
  getConfig(): LoggerConfig {
    return { ...this.config }
  }
}

// Create default logger instance
export const logger = new Logger()

// Export factory function for custom loggers
export function createLogger(config?: Partial<LoggerConfig>): Logger {
  return new Logger(config)
}

// Export logger class for advanced usage
export { Logger } 