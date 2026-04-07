/**
 * Calculate current semester based on admission year
 * 
 * Logic:
 * - Semesters start in August (Fall/Odd) and January (Spring/Even)
 * - Semester 1: Aug Year → Dec Year
 * - Semester 2: Jan Year+1 → May Year+1
 * - Semester 3: Aug Year+1 → Dec Year+1
 * - etc.
 */
export function calculateSemester(admissionYear) {
  if (!admissionYear) return 1;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  
  // Calculate elapsed semesters
  let semester = 1;
  let semYear = admissionYear;
  let semMonth = 8; // August start
  
  while (true) {
    // Current semester start
    const semStart = new Date(semYear, semMonth - 1, 1);
    
    // Next semester start
    let nextSemYear, nextSemMonth;
    if (semMonth === 8) {
      // Fall semester ends Dec, next starts Jan
      nextSemYear = semYear + 1;
      nextSemMonth = 1;
    } else {
      // Spring semester ends May/June, next starts Aug
      nextSemYear = semYear;
      nextSemMonth = 8;
    }
    
    const nextSemStart = new Date(nextSemYear, nextSemMonth - 1, 1);
    
    if (now < nextSemStart) {
      break;
    }
    
    semester++;
    semYear = nextSemYear;
    semMonth = nextSemMonth;
    
    if (semester > 8) {
      semester = 8;
      break;
    }
  }
  
  return Math.min(Math.max(semester, 1), 8);
}

/**
 * Get semester label
 */
export function getSemesterLabel(sem) {
  const ordinals = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
  return ordinals[sem - 1] || `${sem}th`;
}

/**
 * Get accessible semesters for a student
 * Student in semester N can access N and N+1
 */
export function getAccessibleSemesters(currentSemester) {
  const accessible = [currentSemester];
  if (currentSemester < 8) {
    accessible.push(currentSemester + 1);
  }
  return accessible;
}
