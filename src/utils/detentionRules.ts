import { GTURule, StudentAcademicHistory } from '../types/detention';

/**
 * GTU Detention Rules - AY 2018-19 onwards
 * Clear semester-wise specific detention rule summary
 */
export const GTU_DETENTION_RULES: Record<number, GTURule> = {
  // Sem 1 → Sem 2
  2: {
    targetSemester: 2,
    requiredSemesters: [],
    description: "No detention rule",
    isDetainedIf: "N/A - No detention rule"
  },
  
  // Sem 2 → Sem 3  
  3: {
    targetSemester: 3,
    requiredSemesters: [],
    description: "No detention rule",
    isDetainedIf: "N/A - No detention rule"
  },
  
  // Sem 3 → Sem 4
  4: {
    targetSemester: 4,
    requiredSemesters: [],
    description: "No detention rule", 
    isDetainedIf: "N/A - No detention rule"
  },
  
  // Sem 4 → Sem 5
  5: {
    targetSemester: 5,
    requiredSemesters: [1, 2],
    description: "MUST pass Sem 1 & Sem 2",
    isDetainedIf: "If Sem 1 or Sem 2 not cleared → DETAINED"
  },
  
  // Sem 5 → Sem 6
  6: {
    targetSemester: 6,
    requiredSemesters: [3, 4],
    description: "MUST pass Sem 3 & Sem 4",
    isDetainedIf: "If Sem 3 or Sem 4 not cleared → DETAINED"
  },
  
  // Sem 6 → Sem 7
  7: {
    targetSemester: 7,
    requiredSemesters: [5],
    description: "MUST pass Sem 5",
    isDetainedIf: "If Sem 5 not cleared → DETAINED"
  },
  
  // Sem 7 → Sem 8
  8: {
    targetSemester: 8,
    requiredSemesters: [5, 6],
    description: "MUST pass Sem 5 & Sem 6",
    isDetainedIf: "If Sem 5 or Sem 6 not cleared → DETAINED"
  },
  
  // Sem 8 → Sem 9
  9: {
    targetSemester: 9,
    requiredSemesters: [7],
    description: "MUST pass Sem 7",
    isDetainedIf: "If Sem 7 not cleared → DETAINED"
  },
  
  // Sem 9 → Sem 10
  10: {
    targetSemester: 10,
    requiredSemesters: [7, 8],
    description: "MUST pass Sem 7 & Sem 8",
    isDetainedIf: "If Sem 7 or Sem 8 not cleared → DETAINED"
  }
};

/**
 * Check if a student should be detained based on GTU rules
 */
export function shouldStudentBeDetained(
  currentSemester: number,
  clearedSemesters: number[]
): { isDetained: boolean; reason: string; requiredSemesters: number[] } {
  
  // For semesters 1-4, no detention rule applies
  if (currentSemester <= 4) {
    return {
      isDetained: false,
      reason: "No detention rule for this semester transition",
      requiredSemesters: []
    };
  }
  
  // Get the rule for the target semester
  const rule = GTU_DETENTION_RULES[currentSemester];
  if (!rule) {
    return {
      isDetained: false,
      reason: "No detention rule defined for this semester",
      requiredSemesters: []
    };
  }
  
  // Check if all required semesters are cleared
  const missingSemesters = rule.requiredSemesters.filter(
    requiredSem => !clearedSemesters.includes(requiredSem)
  );
  
  if (missingSemesters.length > 0) {
    return {
      isDetained: true,
      reason: `Detained because required semesters are not cleared: ${missingSemesters.join(', ')}`,
      requiredSemesters: rule.requiredSemesters
    };
  }
  
  return {
    isDetained: false,
    reason: "All required semesters cleared",
    requiredSemesters: rule.requiredSemesters
  };
}

/**
 * Get detention rule description for a specific semester
 */
export function getDetentionRuleForSemester(semester: number): GTURule | null {
  return GTU_DETENTION_RULES[semester] || null;
}

/**
 * Get all detention rules (for display purposes)
 */
export function getAllDetentionRules(): GTURule[] {
  return Object.values(GTU_DETENTION_RULES);
}

/**
 * Check if a student is at risk of detention based on current performance
 */
export function assessDetentionRisk(
  currentSemester: number,
  clearedSemesters: number[],
  currentBacklogCount: number,
  failedCoreSubjects: string[] = []
): 'high' | 'medium' | 'low' {
  
  const detentionCheck = shouldStudentBeDetained(currentSemester, clearedSemesters);
  
  // Already detained
  if (detentionCheck.isDetained) {
    return 'high';
  }
  
  // High risk factors
  const highRiskFactors = [
    currentBacklogCount >= 3,
    failedCoreSubjects.length >= 2,
    currentSemester >= 7 && currentBacklogCount >= 2
  ];
  
  // Medium risk factors
  const mediumRiskFactors = [
    currentBacklogCount === 2,
    failedCoreSubjects.length === 1,
    currentSemester >= 5 && currentBacklogCount >= 1
  ];
  
  if (highRiskFactors.some(factor => factor)) {
    return 'high';
  }
  
  if (mediumRiskFactors.some(factor => factor)) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Get detention statistics for reporting
 */
export function getDetentionStatistics(rules: GTURule[]) {
  const totalRules = rules.length;
  const noDetentionRules = rules.filter(rule => rule.requiredSemesters.length === 0).length;
  const detentionRules = rules.filter(rule => rule.requiredSemesters.length > 0).length;
  
  return {
    totalRules,
    noDetentionRules,
    detentionRules,
    detentionStartsFromSemester: 5,
    summary: "Detention happens when mandatory earlier-semester subjects are not cleared before entering the next semester"
  };
}

/**
 * Validate detention rules consistency
 */
export function validateDetentionRules(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check if rules are defined for all semesters 2-10
  for (let sem = 2; sem <= 10; sem++) {
    if (!GTU_DETENTION_RULES[sem]) {
      errors.push(`Missing detention rule for semester ${sem}`);
    }
  }
  
  // Validate rule consistency
  Object.entries(GTU_DETENTION_RULES).forEach(([semester, rule]) => {
    const semNum = parseInt(semester);
    
    // Check if required semesters are valid
    rule.requiredSemesters.forEach(requiredSem => {
      if (requiredSem >= semNum) {
        errors.push(`Invalid rule: Semester ${semNum} cannot require semester ${requiredSem}`);
      }
      if (requiredSem < 1 || requiredSem > 10) {
        errors.push(`Invalid required semester ${requiredSem} in rule for semester ${semester}`);
      }
    });
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
