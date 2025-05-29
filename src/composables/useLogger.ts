import { getCurrentInstance, onMounted, onUnmounted, onErrorCaptured } from 'vue'
import type { ComponentLogger, PerformanceTimer } from '../types/logger'
import { logger } from '../utils/logger'

/**
 * Vue 3 composable for component-level logging
 * Automatically detects component name and provides scoped logging methods
 */
export function useLogger(customComponentName?: string): ComponentLogger {
  // Get component name from Vue instance
  const instance = getCurrentInstance()
  const componentName = customComponentName || 
    (instance as any)?.type?.name || 
    (instance as any)?.type?.__name || 
    'UnknownComponent'

  // Track component lifecycle
  onMounted(() => {
    logger.debug(componentName, 'Component mounted')
  })

  onUnmounted(() => {
    logger.debug(componentName, 'Component unmounted')
  })

  // Capture component errors
  onErrorCaptured((error, instance, info) => {
    logger.error(
      componentName,
      `Component error captured: ${info}`,
      error,
      { 
        errorInfo: info,
        componentInstance: (instance as any)?.type?.name || 'Unknown'
      }
    )
    
    // Return false to prevent the error from propagating further
    return false
  })

  // Create performance timer
  const createTimer = (label?: string): PerformanceTimer => {
    const timerLabel = label || `${componentName}-timer-${Date.now()}`
    let startTime: number | null = null
    const marks: Array<{ label: string; time: number }> = []

    return {
      start() {
        startTime = performance.now()
        logger.time(timerLabel)
        logger.debug(componentName, `Timer started: ${timerLabel}`)
      },

      end(message?: string): number {
        if (startTime === null) {
          logger.warn(componentName, `Timer "${timerLabel}" was not started`)
          return 0
        }

        const duration = logger.timeEnd(timerLabel, componentName, message)
        startTime = null
        return duration || 0
      },

      mark(markLabel: string): void {
        if (startTime === null) {
          logger.warn(componentName, `Cannot mark timer "${timerLabel}" - not started`)
          return
        }

        const markTime = performance.now() - startTime
        marks.push({ label: markLabel, time: markTime })
        logger.debug(componentName, `Timer mark: ${markLabel}`, { time: `${markTime.toFixed(2)}ms` })
      }
    }
  }

  // Group logging for related operations
  let groupDepth = 0

  const group = (label: string): void => {
    if (groupDepth === 0) {
      logger.info(componentName, `▼ ${label}`)
    } else {
      logger.info(componentName, `${'  '.repeat(groupDepth)}▼ ${label}`)
    }
    groupDepth++
  }

  const groupEnd = (): void => {
    if (groupDepth > 0) {
      groupDepth--
      const prefix = groupDepth > 0 ? '  '.repeat(groupDepth) : ''
      logger.info(componentName, `${prefix}▲ Group end`)
    }
  }

  // Return the component logger interface
  return {
    debug(message: string, data?: any): void {
      logger.debug(componentName, message, data)
    },

    info(message: string, data?: any): void {
      logger.info(componentName, message, data)
    },

    warn(message: string, data?: any): void {
      logger.warn(componentName, message, data)
    },

    error(message: string, error?: Error, data?: any): void {
      logger.error(componentName, message, error, data)
    },

    time(label?: string): PerformanceTimer {
      return createTimer(label)
    },

    group,
    groupEnd
  }
}

/**
 * Composable for method-level logging with automatic entry/exit logging
 */
export function useMethodLogger(methodName: string, componentName?: string) {
  const componentLogger = useLogger(componentName)
  
  return {
    ...componentLogger,
    
    /**
     * Wrap a method with automatic entry/exit logging
     */
    wrapMethod<T extends (...args: any[]) => any>(fn: T, customMethodName?: string): T {
      const actualMethodName = customMethodName || methodName
      
      return ((...args: any[]) => {
        const timer = componentLogger.time(`${actualMethodName}-execution`)
        
        componentLogger.debug(`→ Entering ${actualMethodName}`, { args })
        timer.start()
        
        try {
          const result = fn(...args)
          
          // Handle async functions
          if (result instanceof Promise) {
            return result
              .then((asyncResult) => {
                const duration = timer.end()
                componentLogger.debug(
                  `← Exiting ${actualMethodName} (async)`, 
                  { result: asyncResult, duration: `${duration.toFixed(2)}ms` }
                )
                return asyncResult
              })
              .catch((error) => {
                timer.end()
                componentLogger.error(
                  `✗ Error in ${actualMethodName}`, 
                  error, 
                  { args }
                )
                throw error
              })
          }
          
          // Handle sync functions
          const duration = timer.end()
          componentLogger.debug(
            `← Exiting ${actualMethodName}`, 
            { result, duration: `${duration.toFixed(2)}ms` }
          )
          return result
          
        } catch (error) {
          timer.end()
          componentLogger.error(
            `✗ Error in ${actualMethodName}`, 
            error as Error, 
            { args }
          )
          throw error
        }
      }) as T
    },

    /**
     * Log method entry manually
     */
    enter(data?: any): PerformanceTimer {
      const timer = componentLogger.time(`${methodName}-execution`)
      componentLogger.debug(`→ Entering ${methodName}`, data)
      timer.start()
      return timer
    },

    /**
     * Log method exit manually
     */
    exit(timer: PerformanceTimer, result?: any): void {
      const duration = timer.end()
      componentLogger.debug(
        `← Exiting ${methodName}`, 
        { result, duration: `${duration.toFixed(2)}ms` }
      )
    }
  }
}

/**
 * Composable for logging user interactions
 */
export function useInteractionLogger(componentName?: string) {
  const componentLogger = useLogger(componentName)
  
  return {
    ...componentLogger,
    
    /**
     * Log user click events
     */
    logClick(element: string, data?: any): void {
      componentLogger.info(`User clicked: ${element}`, data)
    },

    /**
     * Log form submissions
     */
    logFormSubmit(formName: string, data?: any): void {
      componentLogger.info(`Form submitted: ${formName}`, data)
    },

    /**
     * Log file uploads
     */
    logFileUpload(fileName: string, fileSize: number, fileType: string): void {
      componentLogger.info('File uploaded', { 
        fileName, 
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)}MB`, 
        fileType 
      })
    },

    /**
     * Log navigation events
     */
    logNavigation(from: string, to: string): void {
      componentLogger.info('Navigation', { from, to })
    }
  }
} 