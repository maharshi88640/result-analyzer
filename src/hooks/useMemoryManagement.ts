import { useRef, useEffect, useCallback } from 'react';

interface MemoryManagerOptions {
  enableCleanup?: boolean;
  enableMonitoring?: boolean;
  cleanupInterval?: number;
}

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

/**
 * Custom hook for managing memory cleanup and preventing memory leaks
 * Helps prevent common memory leak patterns in React applications
 */
export const useMemoryManagement = (options: MemoryManagerOptions = {}) => {
  const {
    enableCleanup = true,
    enableMonitoring = false,
    cleanupInterval = 30000, // 30 seconds
  } = options;

  const cleanupFunctionsRef = useRef<Set<() => void>>(new Set());
  const timeoutRefsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const intervalRefsRef = useRef<Set<NodeJS.Timeout>>(new Set());
  const isMonitoringRef = useRef(false);

  // Register cleanup functions to be called on unmount
  const registerCleanup = useCallback((cleanupFn: () => void) => {
    if (enableCleanup) {
      cleanupFunctionsRef.current.add(cleanupFn);
      return () => cleanupFunctionsRef.current.delete(cleanupFn);
    }
    return () => {};
  }, [enableCleanup]);

  // Safe timeout creation with automatic cleanup
  const createSafeTimeout = useCallback((callback: () => void, delay?: number | undefined) => {
    const timeoutId = setTimeout(() => {
      timeoutRefsRef.current.delete(timeoutId);
      callback();
    }, delay);
    
    timeoutRefsRef.current.add(timeoutId);
    
    // Return cleanup function
    return () => {
      clearTimeout(timeoutId);
      timeoutRefsRef.current.delete(timeoutId);
    };
  }, []);

  // Safe interval creation with automatic cleanup
  const createSafeInterval = useCallback((callback: () => void, delay?: number | undefined) => {
    const intervalId = setInterval(callback, delay);
    intervalRefsRef.current.add(intervalId);
    
    // Return cleanup function
    return () => {
      clearInterval(intervalId);
      intervalRefsRef.current.delete(intervalId);
    };
  }, []);

  // Get current memory stats if available
  const getMemoryStats = useCallback((): MemoryStats | null => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        heapUsed: memory.usedJSHeapSize,
        heapTotal: memory.totalJSHeapSize,
        external: memory.jsExternalSize,
        arrayBuffers: memory.arrayBufferJSHeapSize,
      };
    }
    return null;
  }, []);

  // Force garbage collection if available
  const forceGC = useCallback(() => {
    if ('gc' in window) {
      (window as any).gc();
    }
  }, []);

  // Clear all registered resources
  const cleanupAll = useCallback(() => {
    // Clear all timeouts
    timeoutRefsRef.current.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    timeoutRefsRef.current.clear();

    // Clear all intervals
    intervalRefsRef.current.forEach(intervalId => {
      clearInterval(intervalId);
    });
    intervalRefsRef.current.clear();

    // Call all registered cleanup functions
    cleanupFunctionsRef.current.forEach(cleanupFn => {
      try {
        cleanupFn();
      } catch (error) {
        console.warn('Error in cleanup function:', error);
      }
    });
    cleanupFunctionsRef.current.clear();
  }, []);

  // Monitor memory usage
  const startMonitoring = useCallback(() => {
    if (!enableMonitoring || isMonitoringRef.current) return;

    isMonitoringRef.current = true;
    const monitorInterval = setInterval(() => {
      const stats = getMemoryStats();
      if (stats) {
        const heapUsedMB = (stats.heapUsed / 1024 / 1024).toFixed(2);
        const heapTotalMB = (stats.heapTotal / 1024 / 1024).toFixed(2);
        
        console.log(`[Memory] Used: ${heapUsedMB}MB / ${heapTotalMB}MB`);
        
        // Alert if memory usage is concerning (> 100MB)
        if (stats.heapUsed > 100 * 1024 * 1024) {
          console.warn(`[Memory] High memory usage detected: ${heapUsedMB}MB`);
        }
      }
    }, cleanupInterval);

    return () => {
      clearInterval(monitorInterval);
      isMonitoringRef.current = false;
    };
  }, [enableMonitoring, cleanupInterval, getMemoryStats]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAll();
    };
  }, [cleanupAll]);

  return {
    registerCleanup,
    createSafeTimeout,
    createSafeInterval,
    getMemoryStats,
    forceGC,
    cleanupAll,
    startMonitoring,
  };
};

/**
 * Hook for preventing duplicate API calls
 */
export const useApiDeduplication = () => {
  const pendingRequestsRef = useRef<Map<string, Promise<any>>>(new Map());

  const deduplicateRequest = useCallback(async (
    key: string,
    requestFn: () => Promise<any>
  ): Promise<any> => {
    // If request is already pending, return the existing promise
    if (pendingRequestsRef.current.has(key)) {
      return pendingRequestsRef.current.get(key);
    }

    // Create new request
    const requestPromise = requestFn()
      .then(result => {
        // Remove from pending requests after successful completion
        pendingRequestsRef.current.delete(key);
        return result;
      })
      .catch(error => {
        // Remove from pending requests on error
        pendingRequestsRef.current.delete(key);
        throw error;
      });

    // Store the pending request
    pendingRequestsRef.current.set(key, requestPromise);

    return requestPromise;
  }, []);

  const cancelRequest = useCallback((key: string) => {
    pendingRequestsRef.current.delete(key);
  }, []);

  const cancelAllRequests = useCallback(() => {
    pendingRequestsRef.current.clear();
  }, []);

  return {
    deduplicateRequest,
    cancelRequest,
    cancelAllRequests,
  };
};

