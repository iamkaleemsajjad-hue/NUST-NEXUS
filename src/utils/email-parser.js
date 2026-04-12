import { VALID_DOMAINS, ADMIN_EMAIL } from '../config.js';

/**
 * Validate if an email belongs to NUST
 */
export function isValidNustEmail(email) {
  if (ADMIN_EMAIL && email === ADMIN_EMAIL) return true;
  const domain = email.split('@')[1];
  if (!domain) return false;
  return VALID_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Full degree abbreviation → full name mapping
 */
const DEGREE_MAP = {
  // SEECS
  'bscs': 'Bachelor of Science in Computer Science',
  'bsds': 'Bachelor of Science in Data Science',
  'bsai': 'Bachelor of Science in Artificial Intelligence',
  'bsse': 'Bachelor of Software Engineering',
  'bee': 'Bachelor of Electrical Engineering',
  'bce': 'Bachelor of Computer Engineering',
  // SMME
  'bsme': 'Bachelor of Mechanical Engineering',
  'bae': 'Bachelor of Aerospace Engineering',
  // SCME
  'bche': 'Bachelor of Chemical Engineering',
  'bmme': 'Bachelor of Metallurgy & Materials Engineering',
  // SCEE
  'bece': 'Bachelor of Civil Engineering',
  'beenv': 'Bachelor of Environmental Engineering',
  'bgeo': 'Bachelor of Geoinformatics Engineering',
  'bses': 'Bachelor of Science in Environmental Science',
  // NBC
  'bseng': 'Bachelor of Science in English (Language & Literature)',
  // CAE
  'bav': 'Bachelor of Avionics Engineering',
  // CEME
  'bmtn': 'Bachelor of Mechatronics Engineering',
  // MCS
  'beis': 'Bachelor of Engineering in Information Security',
  // NBS
  'bsthm': 'BS in Tourism & Hospitality Management',
  'bba': 'Bachelor of Business Administration',
  'bsaf': 'BS in Accounting & Finance',
  // SADA
  'bid': 'Bachelor of Industrial Design',
  'barch': 'Bachelor of Architecture',
  // NIPCONS
  'bmas': 'Bachelor of Military Art & Science',
  // S3H
  'bseco': 'BS Economics',
  'bsmc': 'BS Mass Communication',
  'bspsy': 'BS Psychology',
  'blas': 'BS Liberal Arts & Humanities',
  'bpa': 'Bachelor of Public Administration',
  // NLS
  'llb': 'Bachelor of Laws',
  // ASAB
  'bsbt': 'BS Biotechnology',
  'bsfst': 'BS Food Science & Technology',
  'bsag': 'BS in Agriculture',
  // SNS
  'bsmath': 'BSc Mathematics',
  'bsphy': 'BSc Physics',
  'bsche': 'BSc Chemistry',
  // NSHS
  'mbbs': 'MBBS',
  'bshnd': 'BS Human Nutrition & Dietetics',
  // SINES
  'bsbi': 'BS Bioinformatics',
  // Legacy/alternate abbreviations
  'bsee': 'Bachelor of Electrical Engineering',
  'ug': 'Bachelor of Mechanical Engineering',
};

/**
 * School code → full name mapping
 */
const SCHOOL_MAP = {
  'seecs': 'SEECS',
  'smme': 'SMME',
  'scme': 'SCME',
  'scee': 'SCEE',
  'sada': 'SADA',
  's3h': 'S3H',
  'nbs': 'NBS',
  'asab': 'ASAB',
  'sns': 'SNS',
  'nls': 'NLS',
  'ceme': 'CEME',
  'mcs': 'MCS',
  'mce': 'MCE',
  'cae': 'CAE',
  'pnec': 'PNEC',
  'igis': 'IGIS',
  'iese': 'IESE',
  'nice': 'NICE',
  'uspcase': 'USPCASE',
  'nbc': 'NBC',
  'nshs': 'NSHS',
  'sines': 'SINES',
  'nipcons': 'NIPCONS',
  'jsppl': 'JSPPL',
  'nust': 'NUST',
};

/**
 * Parse NUST email to extract school, degree, year
 * 
 * Format: name.degreeYYschoolcode@domain
 * Example: mmalik.ug25smme@student.nust.edu.pk
 *          jkhokhar.bee25seecs@seecs.edu.pk
 *          mali.bscs25seecs@seecs.edu.pk
 *          mali.bsme25ceme@nust.edu.pk
 *          mali.bsbt25asab@nust.edu.pk
 * 
 * The school code is in the local part AFTER the year digits.
 * The degree code is in the local part BEFORE the year digits.
 */
export function parseNustEmail(email) {
  if (ADMIN_EMAIL && email === ADMIN_EMAIL) {
    return { name: 'Admin', degree: 'N/A', year: null, school: 'Admin', schoolCode: 'ADMIN' };
  }

  const localPart = email.split('@')[0]?.toLowerCase() || '';
  const parts = localPart.split('.');
  const name = parts[0] || '';

  let degree = 'Unknown';
  let degreeFull = 'Unknown';
  let year = null;
  let schoolCode = 'Unknown';

  if (parts.length > 1) {
    // The suffix is everything after the dot: e.g. "bee25seecs", "ug25smme", "bscs25seecs"
    const suffix = parts[parts.length - 1];

    // Pattern: <degree><YY><schoolcode>
    // Find the 2-digit year (first occurrence of consecutive digits)
    const yearMatch = suffix.match(/(\d{2})/);

    if (yearMatch) {
      const yearIndex = yearMatch.index;
      year = 2000 + parseInt(yearMatch[1]);
      
      // Everything before the year is the degree abbreviation
      const degreeAbbr = suffix.substring(0, yearIndex);
      
      // Everything after the year is the school code
      const schoolAbbr = suffix.substring(yearIndex + 2);

      // Look up degree
      if (degreeAbbr && DEGREE_MAP[degreeAbbr]) {
        degree = degreeAbbr.toUpperCase();
        degreeFull = DEGREE_MAP[degreeAbbr];
      } else if (degreeAbbr) {
        degree = degreeAbbr.toUpperCase();
        degreeFull = degreeAbbr.toUpperCase();
      }

      // Look up school from the local part suffix (after year)
      if (schoolAbbr && SCHOOL_MAP[schoolAbbr]) {
        schoolCode = SCHOOL_MAP[schoolAbbr];
      } else if (schoolAbbr) {
        schoolCode = schoolAbbr.toUpperCase();
      }
    } else {
      // No year found — try to extract something useful
      // Try matching the longest degree abbreviation
      const sortedDegrees = Object.keys(DEGREE_MAP).sort((a, b) => b.length - a.length);
      for (const dp of sortedDegrees) {
        if (suffix.startsWith(dp)) {
          degree = dp.toUpperCase();
          degreeFull = DEGREE_MAP[dp];
          const rest = suffix.substring(dp.length);
          if (rest && SCHOOL_MAP[rest]) {
            schoolCode = SCHOOL_MAP[rest];
          }
          break;
        }
      }
    }
  }

  // Fallback: try to get school from domain if not found in local part
  if (schoolCode === 'Unknown') {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    const domainSchoolMap = {
      'seecs.edu.pk': 'SEECS',
      'smme.edu.pk': 'SMME',
      'scme.edu.pk': 'SCME',
      'scee.nust.edu.pk': 'SCEE',
      'sada.nust.edu.pk': 'SADA',
      's3h.nust.edu.pk': 'S3H',
      'nbs.nust.edu.pk': 'NBS',
      'nbs.edu.pk': 'NBS',
      'asab.nust.edu.pk': 'ASAB',
      'sns.nust.edu.pk': 'SNS',
      'nls.nust.edu.pk': 'NLS',
      'ceme.nust.edu.pk': 'CEME',
      'mcs.edu.pk': 'MCS',
      'mce.nust.edu.pk': 'MCE',
      'cae.nust.edu.pk': 'CAE',
      'pnec.nust.edu.pk': 'PNEC',
      'igis.nust.edu.pk': 'IGIS',
      'iese.nust.edu.pk': 'IESE',
      'nice.nust.edu.pk': 'NICE',
      'uspcase.nust.edu.pk': 'USPCASE',
      'nbc.nust.edu.pk': 'NBC',
      'nust.edu.pk': 'NUST',
      'student.nust.edu.pk': 'NUST',
    };
    schoolCode = domainSchoolMap[domain] || 'Unknown';
  }

  // Capitalize name
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    name: displayName,
    degree: degreeFull !== 'Unknown' ? degreeFull : degree,
    degreeAbbr: degree,
    year,
    school: schoolCode,
    schoolCode,
  };
}

/**
 * Get the school full name from code
 */
export function getSchoolFullName(code) {
  const map = {
    'SEECS': 'School of Electrical Engineering & Computer Science',
    'SMME': 'School of Mechanical & Manufacturing Engineering',
    'SCME': 'School of Chemical & Materials Engineering',
    'SCEE': 'School of Civil & Environmental Engineering',
    'SADA': 'School of Art, Design & Architecture',
    'S3H': 'School of Social Sciences & Humanities',
    'NBS': 'NUST Business School',
    'ASAB': 'Atta-ur-Rahman School of Applied Biosciences',
    'SNS': 'School of Natural Sciences',
    'NLS': 'NUST Law School',
    'CEME': 'College of Electrical & Mechanical Engineering',
    'MCS': 'Military College of Signals',
    'MCE': 'Military College of Engineering',
    'CAE': 'College of Aeronautical Engineering',
    'PNEC': 'Pakistan Navy Engineering College',
    'IGIS': 'Institute of Geographical Information Systems',
    'IESE': 'Institute of Environmental Sciences & Engineering',
    'NICE': 'NUST Institute of Civil Engineering',
    'USPCASE': 'US-Pakistan Center for Advanced Studies in Energy',
    'NBC': 'NUST Balochistan Campus',
    'NSHS': 'NUST School of Health Sciences',
    'SINES': 'School of Interdisciplinary Engineering & Science',
    'NIPCONS': 'NUST Institute of Peace & Conflict Studies',
    'JSPPL': 'Institute of Public Policy & Leadership',
    'NUST': 'National University of Sciences & Technology',
    'ADMIN': 'Administrator',
  };
  return map[code] || code;
}
