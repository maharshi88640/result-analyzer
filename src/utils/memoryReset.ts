/**
 * Memory Reset & Fresh Start Utility
 * 
 * This utility provides comprehensive memory cleanup and application reset functionality
 * to give you a completely fresh start without memory leaks or accumulated state.
 */

interface ResetOptions {
  forceGC?: boolean;
  clearStorage?: boolean;
  resetReactState?: boolean;
  clearIntervals?: boolean;
  clearTimeouts?: boolean;
  reloadPage?: boolean;
}

interface ResetResult {
  success: boolean;
  memoryBefore: number;
  memoryAfter: number;
  freedMemory: number;
  actionsPerformed: string[];
}

/**
 * Force garbage collection if available
 */
const forceGarbageCollection = (): boolean => {
  try {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      (window as any).gc();
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Garbage collection not available:', error);
    return false;
  }
};

/**
 * Get current heap memory usage
 */
const getCurrentHeapSize = (): number => {
  try {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  } catch (error) {
    return 0;
  }
};

/**
 * Clear all intervals
 */
const clearAllIntervals = (): number => {
  let clearedCount = 0;
  // This is a safety measure - in practice, intervals should be managed with refs
  for (let i = 1; i < 999999; i++) {
    try {
      clearInterval(i);
      clearedCount++;
    } catch (error) {
      // No more intervals to clear
      break;
    }
  }
  return clearedCount;
};

/**
 * Clear all timeouts
 */
const clearAllTimeouts = (): number => {
  let clearedCount = 0;
  // This is a safety measure - in practice, timeouts should be managed with refs
  for (let i = 1; i < 999999; i++) {
    try {
      clearTimeout(i);
      clearedCount++;
    } catch (error) {
      // No more timeouts to clear
      break;
    }
  }
  return clearedCount;
};

/**
 * Clear localStorage
 */
const clearLocalStorage = (): number => {
  let clearedCount = 0;
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      localStorage.removeItem(key);
      clearedCount++;
    });
  } catch (error) {
    console.warn('Error clearing localStorage:', error);
  }
  return clearedCount;
};


/**
 * Clear sessionStorage
 */
const clearSessionStorage = (): number => {
  let clearedCount = 0;
  try {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      sessionStorage.removeItem(key);
      clearedCount++;
    });
  } catch (error) {
    console.warn('Error clearing sessionStorage:', error);
  }
  return clearedCount;
};

/**
 * Clear backend files via API
 */
const clearBackendFiles = async (): Promise<boolean> => {
  try {
    const userEmail = localStorage.getItem('user') 
      ? JSON.parse(localStorage.getItem('user')!).email 
      : null;
    
    if (!userEmail) {
      console.warn('No user email found, skipping backend cleanup');
      return false;
    }

    const response = await fetch('/api/clear-user-files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userEmail,
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: JSON.stringify({ clearAll: true })
    });

    if (!response.ok) {
      throw new Error(`Backend cleanup failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Backend files cleared:', result);
    return true;
  } catch (error) {
    console.error('❌ Failed to clear backend files:', error);
    return false;
  }
};

/**
 * Reset React state (this would need to be called from within React components)
 */
const resetReactState = (): boolean => {
  try {
    // Clear React DevTools profiler if available
    if ((window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__.supportsFiber = true;
    }
    
    // Clear any React-related global state
    delete (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    
    return true;
  } catch (error) {
    console.warn('Error resetting React state:', error);
    return false;
  }
};

/**
 * The main memory reset function
 */
export const performMemoryReset = async (options: ResetOptions = {}): Promise<ResetResult> => {
  const {
    forceGC = true,
    clearStorage = true,
    resetReactState: resetReact = true,
    clearIntervals = true,
    clearTimeouts = true,
    reloadPage = false,
  } = options;

  const actionsPerformed: string[] = [];
  const memoryBefore = getCurrentHeapSize();
  
  console.log('🧹 Starting comprehensive memory reset...');
  console.log(`📊 Memory before reset: ${(memoryBefore / 1024 / 1024).toFixed(2)}MB`);


  try {
    // Step 1: Clear backend files if clearing storage
    if (clearStorage) {
      const backendCleared = await clearBackendFiles();
      if (backendCleared) {
        actionsPerformed.push('Cleared all backend files');
      }
    }

    // Step 2: Clear storage
    if (clearStorage) {
      const localCleared = clearLocalStorage();
      const sessionCleared = clearSessionStorage();
      actionsPerformed.push(`Cleared ${localCleared} localStorage items, ${sessionCleared} sessionStorage items`);
    }

    // Step 2: Clear intervals
    if (clearIntervals) {
      const intervalsCleared = clearAllIntervals();
      actionsPerformed.push(`Cleared ${intervalsCleared} intervals`);
    }

    // Step 3: Clear timeouts
    if (clearTimeouts) {
      const timeoutsCleared = clearAllTimeouts();
      actionsPerformed.push(`Cleared ${timeoutsCleared} timeouts`);
    }

    // Step 4: Reset React state
    if (resetReact) {
      const reactReset = resetReactState();
      if (reactReset) {
        actionsPerformed.push('Reset React state and devtools');
      }
    }

    // Step 5: Force garbage collection multiple times
    if (forceGC) {
      let gcSuccess = 0;
      for (let i = 0; i < 3; i++) {
        if (forceGarbageCollection()) {
          gcSuccess++;
          // Small delay between GC calls
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      actionsPerformed.push(`Performed ${gcSuccess} garbage collection cycles`);
    }

    // Step 6: Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 7: Get final memory measurement
    const memoryAfter = getCurrentHeapSize();
    const freedMemory = memoryBefore - memoryAfter;

    console.log(`📊 Memory after reset: ${(memoryAfter / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🆓 Memory freed: ${(freedMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log('✅ Memory reset completed!');

    // Step 8: Reload page if requested
    if (reloadPage) {
      actionsPerformed.push('Reloading page...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }

    return {
      success: true,
      memoryBefore,
      memoryAfter,
      freedMemory,
      actionsPerformed,
    };

  } catch (error) {
    console.error('❌ Error during memory reset:', error);
    return {
      success: false,
      memoryBefore,
      memoryAfter: getCurrentHeapSize(),
      freedMemory: 0,
      actionsPerformed: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
};

/**
 * Emergency memory reset - aggressive cleanup
 */
export const emergencyMemoryReset = async (): Promise<ResetResult> => {
  console.log('🚨 EMERGENCY MEMORY RESET - Maximum cleanup mode');
  
  const result = await performMemoryReset({
    forceGC: true,
    clearStorage: true,
    resetReactState: true,
    clearIntervals: true,
    clearTimeouts: true,
    reloadPage: false, // Don't reload automatically in emergency mode
  });

  // If memory usage is still high after cleanup, suggest page reload
  if (result.memoryAfter > 50 * 1024 * 1024) { // 50MB threshold
    console.warn('⚠️ Memory usage still high after cleanup. Consider reloading the page.');
    if (confirm('Memory usage is still high. Would you like to reload the page for a completely fresh start?')) {
      window.location.reload();
    }
  }

  return result;
};


/**
 * Quick memory reset - minimal cleanup for regular use
 */
export const quickMemoryReset = async (): Promise<ResetResult> => {
  console.log('⚡ Quick memory reset - lightweight cleanup');
  
  return performMemoryReset({
    forceGC: true,
    clearStorage: true, // Always clear backend files
    resetReactState: false,
    clearIntervals: false,
    clearTimeouts: false,
    reloadPage: false,
  });
};

/**
 * Schedule periodic memory cleanup
 */
export const startPeriodicCleanup = (intervalMinutes: number = 10) => {
  const intervalMs = intervalMinutes * 60 * 1000;
  
  console.log(`🔄 Starting periodic cleanup every ${intervalMinutes} minutes`);
  
  const cleanupInterval = setInterval(async () => {
    console.log('🧹 Performing scheduled memory cleanup...');
    await quickMemoryReset();
  }, intervalMs);

  return () => {
    clearInterval(cleanupInterval);
    console.log('⏹️ Periodic cleanup stopped');
  };
};


// Global access for console usage
if (typeof window !== 'undefined') {
  (window as any).memoryReset = {
    performMemoryReset,
    emergencyMemoryReset,
    quickMemoryReset,
    startPeriodicCleanup,
    forceGarbageCollection,
    getCurrentHeapSize,
  };
  
  // Auto-start periodic cleanup disabled - removed automatic cleanup
  // Users can manually trigger cleanup when needed
}

export default {
  performMemoryReset,
  emergencyMemoryReset,
  quickMemoryReset,
  startPeriodicCleanup,
  forceGarbageCollection,
  getCurrentHeapSize,
};

