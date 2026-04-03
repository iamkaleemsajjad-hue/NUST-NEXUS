import { VALID_DOMAINS, ADMIN_EMAIL } from '../config.js';

/**
 * Validate if an email belongs to NUST
 */
export function isValidNustEmail(email) {
  if (email === ADMIN_EMAIL) return true;
  const domain = email.split('@')[1];
  if (!domain) return false;
  return VALID_DOMAINS.includes(domain.toLowerCase());
}

/**
 * Parse NUST email to extract school, degree, year
 * Format examples:
 *   ali.bscs25seecs@seecs.edu.pk
 *   name.bsee24smme@smme.edu.pk
 */
export function parseNustEmail(email) {
  if (email === ADMIN_EMAIL) {
    return { name: 'Admin', degree: 'N/A', year: null, school: 'Admin', schoolCode: 'ADMIN' };
  }
  
  const domain = email.split('@')[1]?.toLowerCase();
  const localPart = email.split('@')[0]?.toLowerCase();
  
  // Determine school from domain
  const schoolMap = {
    'seecs.edu.pk': 'SEECS',
    'smme.edu.pk': 'SMME',
    'scme.edu.pk': 'SCME',
    'scee.nust.edu.pk': 'SCEE',
    'sada.nust.edu.pk': 'SADA',
    's3h.nust.edu.pk': 'S3H',
    'nbs.nust.edu.pk': 'NBS',
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
    'nust.edu.pk': 'NUST',
    'student.nust.edu.pk': 'NUST',
  };
  
  const schoolCode = schoolMap[domain] || 'Unknown';
  
  // Parse degree and year from local part
  // Pattern: name.degreeYYschool or name.degreeYY
  const parts = localPart.split('.');
  let degree = '';
  let year = null;
  let name = parts[0] || '';
  
  if (parts.length > 1) {
    const suffix = parts[parts.length - 1];
    
    // Common degree patterns
    const degreePatterns = [
      'bscs', 'bsse', 'bsee', 'bsai', 'bsds', 'bsme', 'bsce',
      'bba', 'bsid', 'barch', 'llb', 'mbbs', 'bsmme', 'bsche',
      'bsmath', 'bsphy', 'bsecon', 'bsmc', 'bspsych', 'bstelecom',
      'bsaero', 'bsbiotech'
    ];
    
    for (const dp of degreePatterns) {
      const idx = suffix.indexOf(dp);
      if (idx !== -1) {
        degree = dp.toUpperCase();
        // Extract year after degree code
        const afterDegree = suffix.substring(idx + dp.length);
        const yearMatch = afterDegree.match(/^(\d{2})/);
        if (yearMatch) {
          year = 2000 + parseInt(yearMatch[1]);
        }
        break;
      }
    }
    
    // If no degree found, try to find year pattern
    if (!degree) {
      const yearMatch = suffix.match(/(\d{2})/);
      if (yearMatch) {
        year = 2000 + parseInt(yearMatch[1]);
      }
    }
  }
  
  // Capitalize name
  name = name.charAt(0).toUpperCase() + name.slice(1);
  
  return {
    name,
    degree: degree || 'Unknown',
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
    'NUST': 'National University of Sciences & Technology',
  };
  return map[code] || code;
}
