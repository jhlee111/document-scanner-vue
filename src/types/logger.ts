export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  component: string
  method?: string
  message: string
  data?: any
  performance?: {
    duration?: number
    memory?: number
    startTime?: number
  }
  context?: {
    userId?: string
    sessionId?: string
    route?: string
    userAgent?: string
  }
  stack?: string
}

export interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  enableRemote: boolean
  remoteEndpoint?: string
  enablePerformance: boolean
  enableContext: boolean
  maxLogEntries: number
  environment: 'development' | 'production' | 'test'
}

export interface PerformanceTimer {
  start: () => void
  end: (message?: string) => number
  mark: (label: string) => void
}

export interface ComponentLogger {
  debug: (message: string, data?: any) => void
  info: (message: string, data?: any) => void
  warn: (message: string, data?: any) => void
  error: (message: string, error?: Error, data?: any) => void
  time: (label?: string) => PerformanceTimer
  group: (label: string) => void
  groupEnd: () => void
}

export interface RemoteLogPayload {
  entries: LogEntry[]
  metadata: {
    userAgent: string
    url: string
    timestamp: string
    sessionId: string
  }
} 