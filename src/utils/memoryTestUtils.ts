
/**
 * Memory Testing Utilities
 * 
 * This file contains utilities to test and monitor memory usage
 * to validate the memory leak fixes.
 */

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

interface MemoryTestResult {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  performance: {
    timestamp: number;
    navigationStart: number;
  };
}

/**
 * Get current memory usage information
 */
export const getMemoryInfo = (): MemoryStats | null => {
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
};

/**
 * Format memory size in human-readable format
 */
export const formatMemorySize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

/**
 * Monitor memory usage over time
 */
export class MemoryMonitor {
  private measurements: MemoryTestResult[] = [];
  private intervalId: NodeJS.Timeout | null = null;
  private readonly maxMeasurements = 100;

  start(intervalMs: number = 5000): void {
    this.stop(); // Stop any existing monitoring
    
    this.intervalId = setInterval(() => {
      const memoryInfo = getMemoryInfo();
      const perfNow = performance.now();
      const perfTimeOrigin = performance.timeOrigin;
      
      if (memoryInfo) {
        const measurement: MemoryTestResult = {
          timestamp: Date.now(),
          heapUsed: memoryInfo.heapUsed,
          heapTotal: memoryInfo.heapTotal,
          performance: {
            timestamp: perfNow,
            navigationStart: perfTimeOrigin,
          },
        };
        
        this.measurements.push(measurement);
        
        // Keep only the last maxMeasurements
        if (this.measurements.length > this.maxMeasurements) {
          this.measurements.shift();
        }
        
        // Log memory usage
        console.log(`[Memory Monitor] Used: ${formatMemorySize(memoryInfo.heapUsed)}, Total: ${formatMemorySize(memoryInfo.heapTotal)}`);
      }
    }, intervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getMeasurements(): MemoryTestResult[] {
    return [...this.measurements];
  }

  getAverageHeapUsage(): number {
    if (this.measurements.length === 0) return 0;
    const total = this.measurements.reduce((sum, m) => sum + m.heapUsed, 0);
    return total / this.measurements.length;
  }

  getPeakHeapUsage(): number {
    if (this.measurements.length === 0) return 0;
    return Math.max(...this.measurements.map(m => m.heapUsed));
  }

  getMemoryGrowth(): number {
    if (this.measurements.length < 2) return 0;
    const first = this.measurements[0];
    const last = this.measurements[this.measurements.length - 1];
    return last.heapUsed - first.heapUsed;
  }

  getReport(): string {
    const avg = this.getAverageHeapUsage();
    const peak = this.getPeakHeapUsage();
    const growth = this.getMemoryGrowth();
    const count = this.measurements.length;
    
    return `
Memory Monitor Report:
- Measurements: ${count}
- Average Heap Usage: ${formatMemorySize(avg)}
- Peak Heap Usage: ${formatMemorySize(peak)}
- Memory Growth: ${formatMemorySize(growth)}
- Status: ${growth > 0 ? '⚠️ Memory Growth Detected' : '✅ No Memory Growth'}
    `.trim();
  }
}

/**
 * Test file upload performance and memory usage
 */
export class UploadMemoryTester {
  private monitor = new MemoryMonitor();
  private results: Array<{
    fileName: string;
    fileSize: number;
    memoryBefore: number;
    memoryAfter: number;
    memoryPeak: number;
    duration: number;
  }> = [];

  startMonitoring(): void {
    console.log('[Upload Test] Starting memory monitoring...');
    this.monitor.start(1000); // Monitor every second
  }

  stopMonitoring(): string {
    console.log('[Upload Test] Stopping memory monitoring...');
    this.monitor.stop();
    return this.monitor.getReport();
  }

  /**
   * Test a file upload for memory leaks
   */
  async testFileUpload(
    fileName: string,
    fileSize: number,
    uploadFunction: () => Promise<void>
  ): Promise<void> {
    const memoryBefore = getMemoryInfo()?.heapUsed || 0;
    const startTime = performance.now();
    
    console.log(`[Upload Test] Starting test for ${fileName} (${formatMemorySize(fileSize)})`);
    console.log(`[Upload Test] Memory before: ${formatMemorySize(memoryBefore)}`);
    
    // Start monitoring if not already started
    if (!this.monitor) {
      this.startMonitoring();
    }
    
    try {
      await uploadFunction();
      
      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const memoryAfter = getMemoryInfo()?.heapUsed || 0;
      const peakMemory = this.monitor.getPeakHeapUsage();
      const duration = performance.now() - startTime;
      
      const result = {
        fileName,
        fileSize,
        memoryBefore,
        memoryAfter,
        memoryPeak: peakMemory,
        duration,
      };
      
      this.results.push(result);
      
      console.log(`[Upload Test] Completed ${fileName}:`);
      console.log(`  - Duration: ${duration.toFixed(2)}ms`);
      console.log(`  - Memory Before: ${formatMemorySize(memoryBefore)}`);
      console.log(`  - Memory After: ${formatMemorySize(memoryAfter)}`);
      console.log(`  - Memory Delta: ${formatMemorySize(memoryAfter - memoryBefore)}`);
      console.log(`  - Peak Memory: ${formatMemorySize(peakMemory)}`);
      
    } catch (error) {
      console.error(`[Upload Test] Error testing ${fileName}:`, error);
      throw error;
    }
  }

  getTestResults(): typeof this.results {
    return [...this.results];
  }

  getTestReport(): string {
    if (this.results.length === 0) {
      return 'No test results available.';
    }
    
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const totalMemoryGrowth = this.results.reduce((sum, r) => sum + (r.memoryAfter - r.memoryBefore), 0);
    const averageDuration = totalDuration / this.results.length;
    
    let report = '\n=== Upload Memory Test Report ===\n';
    report += `Tests Run: ${this.results.length}\n`;
    report += `Total Duration: ${totalDuration.toFixed(2)}ms\n`;
    report += `Average Duration: ${averageDuration.toFixed(2)}ms\n`;
    report += `Total Memory Growth: ${formatMemorySize(totalMemoryGrowth)}\n`;
    report += '\nIndividual Results:\n';
    
    this.results.forEach((result, index) => {
      const memoryDelta = result.memoryAfter - result.memoryBefore;
      const status = memoryDelta > 1024 * 1024 ? '⚠️' : '✅'; // Alert if growth > 1MB
      report += `${index + 1}. ${result.fileName}\n`;
      report += `   Duration: ${result.duration.toFixed(2)}ms\n`;
      report += `   Memory Growth: ${formatMemorySize(memoryDelta)} ${status}\n`;
    });
    
    const overallStatus = totalMemoryGrowth > 5 * 1024 * 1024 ? '⚠️' : '✅';
    report += `\nOverall Status: ${overallStatus} ${totalMemoryGrowth > 5 * 1024 * 1024 ? 'Memory leaks detected' : 'No memory leaks detected'}\n`;
    
    return report;
  }
}

/**
 * Performance profiler for React components
 */
export class ComponentProfiler {
  private renderCount = 0;
  private renderTimes: number[] = [];
  private memorySnapshots: number[] = [];

  startProfiling(): void {
    this.renderCount = 0;
    this.renderTimes = [];
    this.memorySnapshots = [];
    
    console.log('[Profiler] Starting component profiling...');
  }

  recordRender(renderTime: number): void {
    this.renderCount++;
    this.renderTimes.push(renderTime);
    
    const memoryInfo = getMemoryInfo();
    if (memoryInfo) {
      this.memorySnapshots.push(memoryInfo.heapUsed);
    }
  }

  getProfileReport(): string {
    if (this.renderTimes.length === 0) {
      return 'No render data available.';
    }
    
    const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    const maxRenderTime = Math.max(...this.renderTimes);
    
    let report = '\n=== Component Profile Report ===\n';
    report += `Total Renders: ${this.renderCount}\n`;
    report += `Average Render Time: ${avgRenderTime.toFixed(2)}ms\n`;
    report += `Max Render Time: ${maxRenderTime.toFixed(2)}ms\n`;
    
    if (this.memorySnapshots.length > 1) {
      const memoryGrowth = this.memorySnapshots[this.memorySnapshots.length - 1] - this.memorySnapshots[0];
      report += `Memory Growth: ${formatMemorySize(memoryGrowth)}\n`;
    }
    
    return report;
  }
}

// Global instances for easy testing
export const globalMemoryMonitor = new MemoryMonitor();
export const globalUploadTester = new UploadMemoryTester();
export const globalComponentProfiler = new ComponentProfiler();

// Auto-export for console testing
if (typeof window !== 'undefined') {
  (window as any).memoryTestUtils = {
    getMemoryInfo,
    formatMemorySize,
    globalMemoryMonitor,
    globalUploadTester,
    globalComponentProfiler,
  };
}

