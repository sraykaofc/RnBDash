import { format, differenceInDays, parseISO } from 'date-fns';

// Utility to convert Excel serial date to JavaScript Date
export const excelDateToJSDate = (serial) => {
  if (!serial || isNaN(serial)) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
};

// Parse date from various formats
export const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  // Convert to string for parsing
  const dateStr = String(dateValue).trim();
  
  // Check for DD.MM.YYYY format (with dots)
  if (dateStr.includes('.') && dateStr.split('.').length === 3) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
      const year = parseInt(parts[2], 10);
      
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) return date;
      }
    }
  }
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number' || (!isNaN(parseFloat(dateValue)) && !dateStr.includes('.'))) {
    const serial = parseFloat(dateValue);
    if (serial > 1000) { // Only treat as serial if it's a large number
      return excelDateToJSDate(serial);
    }
  }
  
  // Try parsing as ISO string
  try {
    const parsed = parseISO(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (e) {
    // Continue to other methods
  }
  
  // Try parsing as standard date string
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) ? date : null;
};

// Format date for display
export const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    return format(date, 'dd.MM.yyyy');
  } catch {
    return 'Invalid Date';
  }
};

// Calculate current status based on hierarchy
export const calculateCurrentStatus = (project) => {
  const proposalStatus = project['Proposal Status']?.trim();
  const loaDate = parseDate(project['LOA Date']);
  const woDate = parseDate(project['WO Date']);
  const acValue = project['Column AC']?.trim();
  const dtpStatus = project['DTP Status']?.trim();
  const tsStatus = project['TS Status']?.trim();
  const beStatus = project['BE Status']?.trim();
  const closingDate = parseDate(project['Closing Date']);
  const openedDate = parseDate(project['Opened Date']);
  const agencyName = project['Agency Name']?.trim();
  
  // LOA-WO Level (for TA with AC = Not Started)
  if (proposalStatus === 'TA') {
    const acLower = acValue?.toLowerCase() || '';
    if (acLower === 'not started') {
      if (!loaDate) return 'LOA Level';
      if (loaDate && !woDate) return 'WO Level';
    }
    // Regular TA handling
    if (woDate && loaDate) {
      return acValue || 'In Progress';
    } else if (loaDate) {
      return 'LOA Level';
    } else {
      return 'WO Level';
    }
  }
  
  // Tender Level & Tender Approvals (P=DTP, W=D/C/G)
  if (dtpStatus === 'DTP' && proposalStatus === 'D') {
    // Tender Level - determine stage
    if (!closingDate && !openedDate && !agencyName) {
      return 'Pending for Online';
    } else if (closingDate && !openedDate) {
      return 'Tender Online';
    } else if (closingDate && openedDate && !agencyName) {
      return 'Tender Under Evaluation';
    }
  }
  
  // Tender Approvals - has agency, waiting for approval
  if (dtpStatus === 'DTP' && ['D', 'C', 'G'].includes(proposalStatus) && 
      (closingDate || openedDate || agencyName)) {
    if (proposalStatus === 'D') return 'Proposal at D';
    if (proposalStatus === 'C') return 'Proposal at C';
    if (proposalStatus === 'G') return 'Proposal at G';
  }
  
  // DTP
  if (tsStatus === 'TS' || ['D', 'C', 'G'].includes(dtpStatus)) {
    if (dtpStatus === 'D') return 'DTP at D';
    if (dtpStatus === 'C') return 'DTP at C';
    if (dtpStatus === 'G') return 'DTP at G';
  }
  
  // TS
  if (tsStatus === 'D') return 'TS at D';
  if (tsStatus === 'C') return 'TS at C';
  if (tsStatus === 'G') return 'TS at G';
  
  // BE Status
  if (beStatus === 'D') return 'Block Estimate at D';
  if (beStatus === 'C') return 'Block Estimate at C';
  if (beStatus === 'G') return 'Block Estimate at G';
  if (beStatus === 'AA') return 'AA Done';
  
  return 'Unknown Status';
};

export { differenceInDays };
