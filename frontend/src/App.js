import { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AlertTriangle, FileText, Clock, Building2, TrendingUp, Upload, Link2, ArrowLeft, ChevronRight, FileCheck, FilePlus, Gavel, Clipboard, Handshake, Filter, Columns } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import './App.css';

// Utility to convert Excel serial date to JavaScript Date
const excelDateToJSDate = (serial) => {
  if (!serial || isNaN(serial)) return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate());
};

// Parse date from various formats
const parseDate = (dateValue) => {
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
const formatDate = (date) => {
  if (!date) return 'N/A';
  try {
    return format(date, 'dd.MM.yyyy');
  } catch {
    return 'Invalid Date';
  }
};

// Calculate current status based on hierarchy
const calculateCurrentStatus = (project) => {
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

// Predefined Google Sheet URL
const PREDEFINED_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1fvb5M7f-rajXCgPF7ntDiQaeD6mJwq_5jdo6TL_NsKQ/edit?gid=0#gid=0';

function App() {
  const [projects, setProjects] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState(PREDEFINED_SHEET_URL);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDataTable, setShowDataTable] = useState(false);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState(['Code', 'Work Name', 'Division', 'PAA Amount', 'PAA Date', 'Status']);
  const [columnFilters, setColumnFilters] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Auto-load predefined Google Sheet on initial page load
  useEffect(() => {
    if (isInitialLoad && projects.length === 0) {
      setIsInitialLoad(false);
      // Automatically import the predefined sheet silently
      handleGoogleSheetImport(true); // Pass true for silent mode
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoad, projects.length]);
  
  // Parse CSV data
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processData(results.data);
        toast.success(`Loaded ${results.data.length} projects successfully!`);
      },
      error: (error) => {
        toast.error(`Error parsing CSV: ${error.message}`);
      }
    });
  };
  
  // Import from Google Sheets
  const handleGoogleSheetImport = async (silent = false) => {
    if (!googleSheetUrl) {
      if (!silent) toast.error('Please enter a Google Sheet URL');
      return;
    }
    
    // Extract spreadsheet ID from URL
    let spreadsheetId = '';
    let gid = '0'; // default to first sheet
    
    try {
      // Handle different Google Sheets URL formats
      const urlPatterns = [
        /\/d\/([a-zA-Z0-9-_]+)/,
        /spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
        /key=([a-zA-Z0-9-_]+)/
      ];
      
      for (const pattern of urlPatterns) {
        const match = googleSheetUrl.match(pattern);
        if (match) {
          spreadsheetId = match[1];
          break;
        }
      }
      
      // Try to extract gid (sheet ID) if present
      const gidMatch = googleSheetUrl.match(/[#&]gid=([0-9]+)/);
      if (gidMatch) {
        gid = gidMatch[1];
      }
      
      if (!spreadsheetId) {
        if (!silent) toast.error('Invalid Google Sheets URL. Please check the URL and try again.');
        return;
      }
      
      // Construct CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      
      if (!silent) toast.loading('Importing from Google Sheets...');
      
      // Try direct fetch first
      try {
        const response = await fetch(csvUrl, {
          method: 'GET',
          mode: 'cors',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        
        // Parse CSV
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              processData(results.data);
              if (!silent) {
                toast.dismiss();
                toast.success(`Imported ${results.data.length} projects from Google Sheets!`);
              }
            } else {
              if (!silent) {
                toast.dismiss();
                toast.error('No data found in the sheet. Please check if the sheet has data.');
              }
            }
          },
          error: (error) => {
            if (!silent) {
              toast.dismiss();
              toast.error(`Error parsing CSV: ${error.message}`);
            }
          }
        });
        
      } catch (directError) {
        // If direct fetch fails due to CORS, try with CORS proxy
        console.log('Direct fetch failed, trying CORS proxy...', directError);
        
        const corsProxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl)}`;
        
        try {
          const proxyResponse = await fetch(corsProxyUrl);
          
          if (!proxyResponse.ok) {
            throw new Error('Failed to fetch through proxy');
          }
          
          const csvText = await proxyResponse.text();
          
          // Parse CSV
          Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              if (results.data && results.data.length > 0) {
                processData(results.data);
                if (!silent) {
                  toast.dismiss();
                  toast.success(`Imported ${results.data.length} projects from Google Sheets!`);
                }
              } else {
                if (!silent) {
                  toast.dismiss();
                  toast.error('No data found in the sheet.');
                }
              }
            },
            error: (error) => {
              if (!silent) {
                toast.dismiss();
                toast.error(`Error parsing CSV: ${error.message}`);
              }
            }
          });
          
        } catch (proxyError) {
          console.error('Proxy fetch also failed:', proxyError);
          if (!silent) {
            toast.dismiss();
            toast.error(
              'Unable to import from Google Sheets. Please ensure the sheet is shared as "Anyone with the link" and try again, or download the CSV and upload it directly.',
              { duration: 6000 }
            );
          }
        }
      }
      
    } catch (error) {
      console.error('Error importing from Google Sheets:', error);
      if (!silent) {
        toast.dismiss();
        toast.error('Failed to import. Please check the URL or try downloading the CSV and uploading it.');
      }
    }
  };
  
  // Process and normalize data
  const processData = (data) => {
    const processed = data.map((row, index) => {
      // Create normalized column mapping
      const normalized = {};
      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();
        normalized[trimmedKey] = typeof row[key] === 'string' ? row[key].trim() : row[key];
      });
      
      const result = {
        id: index,
        'Code': normalized['Code'] || normalized['Column B'] || normalized['B'] || '',
        'Work Name': normalized['Work Name'] || normalized['Name'] || normalized['Column E'] || normalized['E'] || '',
        'Division': normalized['Division'] || normalized['Dist'] || normalized['Column C'] || normalized['C'] || '',
        'PAA Amount': normalized['PAA Amount'] || normalized['PAA (Rs. Lakh)'] || normalized['Column H'] || normalized['H'] || '',
        'PAA Date': normalized['PAA Date'] || normalized['Column I'] || normalized['I'] || '',
        'BE Status': normalized['BE Status'] || normalized['Column J'] || normalized['J'] || '',
        'BE G Date': normalized['BE G Date'] || normalized['Column K'] || normalized['K'] || '', // Tracking date when sent to G
        'AA Amount': normalized['AA Amount'] || normalized['AA (Rs. Lakh)'] || normalized['Column K'] || normalized['K'] || '',
        'AA Date': normalized['AA Date'] || normalized['Column L'] || normalized['L'] || '',
        'TS Status': normalized['TS Status'] || normalized['Column M'] || normalized['M'] || '',
        'TS G Date': normalized['TS G Date'] || normalized['Column N'] || normalized['N'] || '', // Tracking date when sent to G
        'TS Amount': normalized['TS Amount'] || normalized['TS (Rs. Lakh)'] || normalized['Column N'] || normalized['N'] || '',
        'TS Date': normalized['TS Date'] || normalized['Column O'] || normalized['O'] || '',
        'DTP Status': normalized['DTP Status'] || normalized['Column P'] || normalized['P'] || '',
        'DTP G Date': normalized['DTP G Date'] || normalized['Column Q'] || normalized['Q'] || '', // Tracking date when sent to G
        'DTP Amount': normalized['DTP Amount'] || normalized['DTP (Rs. Lakh)'] || normalized['Column Q'] || normalized['Q'] || '',
        'DTP Date': normalized['DTP Date'] || normalized['Column R'] || normalized['R'] || '',
        'Closing Date': normalized['Closing Date'] || normalized['Column S'] || normalized['S'] || '',
        'Opened Date': normalized['Opened Date'] || normalized['Opening Date'] || normalized['Column T'] || normalized['T'] || '',
        'Agency Name': normalized['Agency Name'] || normalized['Column U'] || normalized['U'] || '',
        '% of Tender': normalized['% of Tender'] || normalized['Column V'] || normalized['V'] || '',
        'Proposal Status': normalized['Proposal Status'] || normalized['Column W'] || normalized['W'] || '',
        'Proposal G Date': normalized['Proposal G Date'] || normalized['Column X'] || normalized['X'] || '', // Tracking date when sent to G
        'Approved Amount': normalized['Approved Amount'] || normalized['Column X'] || normalized['X'] || '',
        'App. Date': normalized['App. Date'] || normalized['Approval Date'] || normalized['Column Y'] || normalized['Y'] || '',
        'LOA Date': normalized['LOA Date'] || normalized['Column Z'] || normalized['Z'] || '',
        'WO Date': normalized['WO Date'] || normalized['W.O. Date'] || normalized['Column AA'] || normalized['AA'] || '',
        'Column AC': normalized['Column AC'] || normalized['Status'] || normalized['AC'] || '',
        'Year': normalized['Year'] || normalized['Column AM'] || normalized['AM'] || '',
        'Time': normalized['Time'] || normalized['Column AN'] || normalized['AN'] || '',
        'Amount Category': normalized['Amount Category'] || normalized['Amount'] || normalized['Column AO'] || normalized['AO'] || '',
        'Year YYYY': normalized['Year YYYY'] || normalized['Year (YYYY)'] || normalized['Column AP'] || normalized['AP'] || '',
        'Route Type': normalized['Route Type'] || '',
        ...normalized
      };
      
      return result;
    });
    
    setProjects(processed);
  };
  
  // Get available divisions
  const availableDivisions = useMemo(() => {
    const divisions = new Set();
    projects.forEach(project => {
      const division = project['Division']?.trim();
      if (division) divisions.add(division);
    });
    
    // Sort divisions, but put "Circle" at the end if it exists
    const sorted = Array.from(divisions).sort();
    const circleIndex = sorted.findIndex(d => d.toLowerCase() === 'circle');
    if (circleIndex !== -1) {
      const circle = sorted.splice(circleIndex, 1)[0];
      sorted.push(circle);
    }
    
    return sorted;
  }, [projects]);
  
  // Filter projects by selected divisions
  const filteredProjects = useMemo(() => {
    if (selectedDivisions.length === 0) return projects;
    return projects.filter(project => 
      selectedDivisions.includes(project['Division']?.trim())
    );
  }, [projects, selectedDivisions]);
  
  // Calculate metrics
  const metrics = useMemo(() => {
    const redAlerts = [];
    const pendingAA = [];
    const pendingTS = [];
    const pendingDTP = [];
    const tenderLevel = [];
    const tenderApprovals = [];
    const loaWOLevel = [];
    const highPriority = [];
    
    filteredProjects.forEach(project => {
      const closingDate = parseDate(project['Closing Date']);
      const beStatus = project['BE Status']?.trim();
      const paaDate = parseDate(project['PAA Date']);
      const aaDate = parseDate(project['AA Date']);
      const tsStatus = project['TS Status']?.trim();
      const tsDate = parseDate(project['TS Date']);
      const dtpStatus = project['DTP Status']?.trim();
      const dtpDate = parseDate(project['DTP Date']);
      const proposalStatus = project['Proposal Status']?.trim();
      const openedDate = parseDate(project['Opened Date']);
      const agencyName = project['Agency Name']?.trim();
      const loaDate = parseDate(project['LOA Date']);
      const woDate = parseDate(project['WO Date']);
      const routeType = project['Route Type']?.toLowerCase() || '';
      const appDate = parseDate(project['App. Date']);
      
      // Get G tracking dates
      const beGDate = parseDate(project['BE G Date']);
      const tsGDate = parseDate(project['TS G Date']);
      const dtpGDate = parseDate(project['DTP G Date']);
      const proposalGDate = parseDate(project['Proposal G Date']);
      
      // === RED ALERTS SECTION ===
      
      // 1. Stuck at Govt Alert - Check columns J, M, P, W for status 'G'
      // BE Status = G (Column J), tracking date in Column K
      if (beStatus === 'G') {
        if (beGDate) {
          const daysStuck = differenceInDays(new Date(), beGDate);
          if (daysStuck > 15) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - BE', 
              daysStuck,
              stage: 'BE Status'
            });
          }
        } else {
          redAlerts.push({ 
            ...project, 
            alertType: 'Stuck at Govt - BE', 
            noDateFound: true,
            stage: 'BE Status'
          });
        }
      }
      
      // TS Status = G (Column M), tracking date in Column N
      if (tsStatus === 'G') {
        if (tsGDate) {
          const daysStuck = differenceInDays(new Date(), tsGDate);
          if (daysStuck > 15) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - TS', 
              daysStuck,
              stage: 'TS Status'
            });
          }
        } else {
          redAlerts.push({ 
            ...project, 
            alertType: 'Stuck at Govt - TS', 
            noDateFound: true,
            stage: 'TS Status'
          });
        }
      }
      
      // DTP Status = G (Column P), tracking date in Column Q
      if (dtpStatus === 'G') {
        if (dtpGDate) {
          const daysStuck = differenceInDays(new Date(), dtpGDate);
          if (daysStuck > 15) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - DTP', 
              daysStuck,
              stage: 'DTP Status'
            });
          }
        } else {
          redAlerts.push({ 
            ...project, 
            alertType: 'Stuck at Govt - DTP', 
            noDateFound: true,
            stage: 'DTP Status'
          });
        }
      }
      
      // Proposal Status = G (Column W), tracking date in Column X
      if (proposalStatus === 'G') {
        if (proposalGDate) {
          const daysStuck = differenceInDays(new Date(), proposalGDate);
          if (daysStuck > 15) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - Proposal', 
              daysStuck,
              stage: 'Proposal Status'
            });
          }
        } else {
          redAlerts.push({ 
            ...project, 
            alertType: 'Stuck at Govt - Proposal', 
            noDateFound: true,
            stage: 'Proposal Status'
          });
        }
      }
      
      // 2. Tender Alert - If P=DTP, W=D, and Closing Date (S) crossed >15 days
      if (dtpStatus === 'DTP' && proposalStatus === 'D' && closingDate) {
        const daysMissed = differenceInDays(new Date(), closingDate);
        if (daysMissed > 15) {
          redAlerts.push({ 
            ...project, 
            alertType: 'Tender Opening Missed', 
            daysMissed
          });
        }
      }
      
      // 3. Bid Validity Alert - Enhanced with P=DTP requirement
      if (dtpStatus === 'DTP' && closingDate) {
        const daysRemaining = 120 - differenceInDays(new Date(), closingDate);
        if (daysRemaining < 30 && daysRemaining > 0) {
          redAlerts.push({ 
            ...project, 
            alertType: 'Bid Validity Expiring', 
            daysRemaining 
          });
        }
      }
      
      // 4. LOA Alert - Tender App. Date (Y) crossing 15 days
      if (appDate && !loaDate) {
        const daysPending = differenceInDays(new Date(), appDate);
        if (daysPending > 15) {
          redAlerts.push({ 
            ...project, 
            alertType: 'LOA Pending', 
            daysPending
          });
        }
      }
      
      // 5. WO Alert - LOA Date (Z) crossed 20 days
      if (loaDate && !woDate) {
        const daysPending = differenceInDays(new Date(), loaDate);
        if (daysPending > 20) {
          redAlerts.push({ 
            ...project, 
            alertType: 'WO Pending', 
            daysPending
          });
        }
      }
      
      // Skip Dropped (X) and Old Completed (OC) works
      if (proposalStatus === 'X' || proposalStatus === 'OC') {
        return;
      }
      
      // Get Column AC status once
      const acStatus = project['Column AC']?.trim().toLowerCase() || '';
      
      // Pending AA Works - has PAA but no AA
      if (paaDate && !aaDate && ['D', 'C', 'G'].includes(beStatus)) {
        pendingAA.push(project);
      }
      
      // Pending TS - Column AC = "Not Started" AND Column M (TS Status) = D/C/G
      if (acStatus === 'not started' && ['D', 'C', 'G'].includes(tsStatus)) {
        pendingTS.push(project);
      }
      
      // Pending DTP - Column M = "TS" AND Column P (DTP Status) = D/C/G
      if (tsStatus === 'TS' && ['D', 'C', 'G'].includes(dtpStatus)) {
        pendingDTP.push(project);
      }
      
      // Tender Level - Column P = "DTP" AND Column W = "D"
      // Only count works where S,T,U,V status determines tender stage
      if (dtpStatus === 'DTP' && proposalStatus === 'D') {
        tenderLevel.push(project);
      }
      
      // Tender Approvals - Column P = "DTP" AND Column W = D/C/G AND ALL S,T,U,V have data
      const percentTender = project['% of Tender']?.trim();
      if (dtpStatus === 'DTP' && ['D', 'C', 'G'].includes(proposalStatus) && 
          closingDate && openedDate && agencyName && percentTender) {
        tenderApprovals.push(project);
      }
      
      // LOA-WO Level - Column AC = "Not Started" AND Column W = "TA"
      if (acStatus === 'not started' && proposalStatus === 'TA') {
        loaWOLevel.push(project);
      }
      
      // High Priority
      if (routeType.includes('tourist') || routeType.includes('pravasipath')) {
        highPriority.push(project);
      }
    });
    
    return { 
      redAlerts, 
      pendingAA, 
      pendingTS, 
      pendingDTP, 
      tenderLevel, 
      tenderApprovals, 
      loaWOLevel, 
      highPriority 
    };
  }, [filteredProjects]);
  
  // Get status distribution from Column AC
  const statusDistribution = useMemo(() => {
    const distribution = {
      'Not Started': 0,
      'In Progress': 0,
      'Phy. Completed': 0,
      'Completed': 0,
      'Stopped': 0
    };
    
    filteredProjects.forEach(project => {
      const status = project['Column AC']?.trim() || '';
      const statusLower = status.toLowerCase();
      
      // Check exact matches first, then partial matches
      if (statusLower === 'completed' || statusLower === 'complete') {
        distribution['Completed']++;
      } else if (statusLower === 'phy. completed' || statusLower === 'physically completed' || 
                 (statusLower.includes('phy') && statusLower.includes('complet'))) {
        distribution['Phy. Completed']++;
      } else if (statusLower === 'in progress' || statusLower.includes('progress') || 
                 statusLower.includes('%') || statusLower.includes('working')) {
        distribution['In Progress']++;
      } else if (statusLower === 'stopped' || statusLower === 'stop') {
        distribution['Stopped']++;
      } else if (statusLower === 'not started' || statusLower === '' || statusLower === 'pending') {
        distribution['Not Started']++;
      } else {
        // Default to In Progress for any other status with content
        distribution['In Progress']++;
      }
    });
    
    return distribution;
  }, [filteredProjects]);
  
  // Get breakdown by D/C/G based on filter type
  const getBreakdown = (list) => {
    const breakdown = { D: 0, C: 0, G: 0 };
    list.forEach(project => {
      let status;
      
      // Use different columns based on active filter
      if (activeFilter === 'pendingTS') {
        status = project['TS Status']?.trim(); // Column M
      } else if (activeFilter === 'pendingDTP') {
        status = project['DTP Status']?.trim(); // Column P
      } else if (activeFilter === 'tenderApprovals') {
        status = project['Proposal Status']?.trim(); // Column W
      } else {
        status = project['BE Status']?.trim(); // Column J (default)
      }
      
      if (status === 'D') breakdown.D++;
      else if (status === 'C') breakdown.C++;
      else if (status === 'G') breakdown.G++;
    });
    return breakdown;
  };
  
  // Get tender level breakdown (Ø:Pending, O:Online, E:Evaluation)
  const getTenderLevelBreakdown = (list) => {
    const breakdown = { pending: 0, online: 0, evaluation: 0 };
    list.forEach(project => {
      const closingDate = parseDate(project['Closing Date']);
      const openedDate = parseDate(project['Opened Date']);
      const agencyName = project['Agency Name']?.trim();
      
      if (!closingDate && !openedDate && !agencyName) {
        breakdown.pending++;
      } else if (closingDate && !openedDate) {
        breakdown.online++;
      } else if (closingDate && openedDate) {
        breakdown.evaluation++;
      }
    });
    return breakdown;
  };
  
  // Get LOA-WO breakdown
  const getLOAWOBreakdown = (list) => {
    const breakdown = { loa: 0, wo: 0 };
    list.forEach(project => {
      const loaDate = parseDate(project['LOA Date']);
      if (!loaDate) {
        breakdown.loa++;
      } else {
        breakdown.wo++;
      }
    });
    return breakdown;
  };
  
  // Get filtered list
  const getFilteredList = () => {
    if (!activeFilter) return [];
    switch (activeFilter) {
      case 'redAlerts': return metrics.redAlerts;
      case 'pendingAA': return metrics.pendingAA.sort((a, b) => {
        const dateA = parseDate(a['PAA Date']);
        const dateB = parseDate(b['PAA Date']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
      case 'pendingTS': return metrics.pendingTS.sort((a, b) => {
        // Sort by TS Status: D → C → G
        const statusOrder = { 'D': 1, 'C': 2, 'G': 3 };
        const statusA = a['TS Status']?.trim() || '';
        const statusB = b['TS Status']?.trim() || '';
        return (statusOrder[statusA] || 9) - (statusOrder[statusB] || 9);
      });
      case 'pendingDTP': return metrics.pendingDTP.sort((a, b) => {
        // Sort by DTP Status: D → C → G
        const statusOrder = { 'D': 1, 'C': 2, 'G': 3 };
        const statusA = a['DTP Status']?.trim() || '';
        const statusB = b['DTP Status']?.trim() || '';
        return (statusOrder[statusA] || 9) - (statusOrder[statusB] || 9);
      });
      case 'tenderLevel': return metrics.tenderLevel.sort((a, b) => {
        // Sort: Pending for Online → Tender Online → Tender Under Evaluation
        const getStage = (project) => {
          const closingDate = parseDate(project['Closing Date']);
          const openedDate = parseDate(project['Opened Date']);
          const agencyName = project['Agency Name']?.trim();
          
          if (!closingDate && !openedDate && !agencyName) return 1; // Pending
          if (closingDate && !openedDate) return 2; // Online
          if (closingDate && openedDate) return 3; // Evaluation
          return 4;
        };
        return getStage(a) - getStage(b);
      });
      case 'tenderApprovals': return metrics.tenderApprovals.sort((a, b) => {
        // Sort by Proposal Status: D → C → G
        const statusOrder = { 'D': 1, 'C': 2, 'G': 3 };
        const statusA = a['Proposal Status']?.trim() || '';
        const statusB = b['Proposal Status']?.trim() || '';
        return (statusOrder[statusA] || 9) - (statusOrder[statusB] || 9);
      });
      case 'loaWOLevel': return metrics.loaWOLevel.sort((a, b) => {
        // Sort: LOA Level first → WO Level
        const loaDateA = parseDate(a['LOA Date']);
        const loaDateB = parseDate(b['LOA Date']);
        if (!loaDateA && loaDateB) return -1; // A is LOA, B is WO
        if (loaDateA && !loaDateB) return 1;  // A is WO, B is LOA
        return 0;
      });
      case 'highPriority': return metrics.highPriority;
      default: return [];
    }
  };
  
  const filteredList = getFilteredList();
  
  // Search filtered projects
  const searchedProjects = useMemo(() => {
    if (!searchQuery) return filteredProjects;
    return filteredProjects.filter(project => 
      Object.values(project).some(value => 
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [filteredProjects, searchQuery]);
  
  // Render project details
  if (selectedProject) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Toaster position="top-right" />
        <div className="max-w-7xl mx-auto">
          <Button
            variant="outline"
            onClick={() => setSelectedProject(null)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{selectedProject['Work Name']}</CardTitle>
              <div className="flex gap-2 items-center text-sm text-slate-600 mt-2">
                <span>{selectedProject['Division']}</span>
                <span>•</span>
                <span>{calculateCurrentStatus(selectedProject)}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(selectedProject).map(([key, value]) => {
                  if (key === 'id') return null;
                  return (
                    <div key={key} className="border-b pb-2">
                      <div className="text-xs font-medium text-slate-500">{key}</div>
                      <div className="text-sm mt-1">{value || 'N/A'}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
          <Button
            variant="outline"
            onClick={() => setSelectedProject(null)}
            className="mt-4 w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  // Render full data table view
  if (showDataTable) {
    // Available columns for selection - ALL columns from the data
    const allColumns = [
      { key: 'Code', label: 'Code' },
      { key: 'Work Name', label: 'Work Name' },
      { key: 'Division', label: 'Division' },
      { key: 'PAA Amount', label: 'PAA Amount' },
      { key: 'PAA Date', label: 'PAA Date' },
      { key: 'Status', label: 'Status (Column AC)' },
      { key: 'BE Status', label: 'BE Status' },
      { key: 'AA Amount', label: 'AA Amount' },
      { key: 'AA Date', label: 'AA Date' },
      { key: 'TS Status', label: 'TS Status' },
      { key: 'TS Amount', label: 'TS Amount' },
      { key: 'TS Date', label: 'TS Date' },
      { key: 'DTP Status', label: 'DTP Status' },
      { key: 'DTP Amount', label: 'DTP Amount' },
      { key: 'DTP Date', label: 'DTP Date' },
      { key: 'Closing Date', label: 'Closing Date' },
      { key: 'Opened Date', label: 'Opened Date' },
      { key: 'Agency Name', label: 'Agency Name' },
      { key: '% of Tender', label: '% of Tender' },
      { key: 'Proposal Status', label: 'Proposal Status' },
      { key: 'Approved Amount', label: 'Approved Amount' },
      { key: 'App. Date', label: 'App. Date' },
      { key: 'LOA Date', label: 'LOA Date' },
      { key: 'WO Date', label: 'WO Date' },
      { key: 'Year', label: 'Year' },
      { key: 'Time', label: 'Time' },
      { key: 'Amount Category', label: 'Amount Category' },
      { key: 'Year YYYY', label: 'Year YYYY' },
      { key: 'Route Type', label: 'Route Type' }
    ];
    
    // Apply column filters
    const filteredByColumns = searchedProjects.filter(project => {
      return Object.entries(columnFilters).every(([column, filterValue]) => {
        if (!filterValue) return true;
        const projectValue = String(project[column] || '').toLowerCase();
        return projectValue.includes(filterValue.toLowerCase());
      });
    });
    
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Toaster position="top-right" />
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDataTable(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="flex gap-2 flex-1 max-w-2xl">
              <Input
                placeholder="Search all data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              
              <Popover open={showColumnSelector} onOpenChange={setShowColumnSelector}>
                <PopoverTrigger asChild>
                  <Button variant="outline">
                    <Columns className="w-4 h-4 mr-2" />
                    Columns
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm mb-2">Show Columns</h4>
                    {allColumns.map(col => (
                      <div key={col.key} className="flex items-center space-x-2">
                        <Checkbox
                          id={col.key}
                          checked={visibleColumns.includes(col.key)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setVisibleColumns([...visibleColumns, col.key]);
                            } else {
                              setVisibleColumns(visibleColumns.filter(c => c !== col.key));
                            }
                          }}
                        />
                        <label
                          htmlFor={col.key}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {col.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      {allColumns.map(col => {
                        if (!visibleColumns.includes(col.key)) return null;
                        return (
                          <th key={col.key} className="px-4 py-3 text-left">
                            <div className="space-y-1">
                              <div className="font-medium">{col.label}</div>
                              <Input
                                placeholder="Filter..."
                                value={columnFilters[col.key] || ''}
                                onChange={(e) => setColumnFilters({...columnFilters, [col.key]: e.target.value})}
                                className="h-7 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              />
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredByColumns.map((project) => (
                      <tr 
                        key={project.id} 
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedProject(project)}
                      >
                        {allColumns.map(col => {
                          if (!visibleColumns.includes(col.key)) return null;
                          
                          // Special handling for date columns
                          const dateColumns = ['PAA Date', 'AA Date', 'TS Date', 'DTP Date', 'Closing Date', 'Opened Date', 'App. Date', 'LOA Date', 'WO Date'];
                          const isDateColumn = dateColumns.includes(col.key);
                          
                          // Special handling for Status column (maps to Column AC)
                          let value = project[col.key];
                          if (col.key === 'Status') {
                            value = project['Column AC'];
                          }
                          
                          return (
                            <td key={col.key} className="px-4 py-3">
                              {isDateColumn ? formatDate(parseDate(value)) : (value || 'N/A')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Panchayat (R&B) Circle No. 2 Dashboard</h1>
          <p className="text-indigo-100">Superintending Engineer, Rajkot</p>
          <p className="text-sm text-indigo-200 mt-1">Amreli • Bhavnagar • Junagadh • Botad • Porbandar • Gir Somnath</p>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Upload Section */}
        {projects.length === 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Import Project Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Upload CSV File</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="flex-1"
                  />
                  <Upload className="w-5 h-5 text-slate-400" />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <label className="block text-sm font-medium mb-2">Connect Google Sheet</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste Google Sheets URL..."
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleGoogleSheetImport}>
                    <Link2 className="w-4 h-4 mr-2" />
                    Import Data
                  </Button>
                </div>
                <Alert className="mt-3 bg-blue-50 border-blue-200">
                  <AlertDescription className="text-xs text-slate-700">
                    <strong>How to share your Google Sheet:</strong>
                    <ol className="list-decimal ml-4 mt-1 space-y-1">
                      <li>Open your Google Sheet</li>
                      <li>Click the <strong>Share</strong> button (top right)</li>
                      <li>Under "General access", select <strong>"Anyone with the link"</strong></li>
                      <li>Set permission to <strong>"Viewer"</strong></li>
                      <li>Click <strong>Done</strong>, then copy and paste the URL here</li>
                    </ol>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Division Filter */}
        {projects.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium whitespace-nowrap">Filter by Division:</label>
                <div className="flex flex-wrap gap-2 flex-1">
                  {availableDivisions.map(division => (
                    <Button
                      key={division}
                      variant={selectedDivisions.includes(division) ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        // Single selection - toggle current division
                        setSelectedDivisions(prev => 
                          prev.includes(division) ? [] : [division]
                        );
                      }}
                      className="text-xs"
                    >
                      {division}
                    </Button>
                  ))}
                  {selectedDivisions.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDivisions([])}
                      className="text-xs text-slate-500"
                    >
                      Clear Filter
                    </Button>
                  )}
                </div>
                {selectedDivisions.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    Filtered: {selectedDivisions[0]}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Stats Cards */}
        {projects.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'redAlerts' ? 'ring-2 ring-red-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'redAlerts' ? null : 'redAlerts')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Red Alerts</p>
                      <p className="text-3xl font-bold text-red-600 mt-2">{metrics.redAlerts.length}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'pendingAA' ? 'ring-2 ring-purple-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'pendingAA' ? null : 'pendingAA')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pending AA</p>
                      <p className="text-3xl font-bold text-purple-600 mt-2">{metrics.pendingAA.length}</p>
                    </div>
                    <FileText className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'pendingTS' ? 'ring-2 ring-indigo-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'pendingTS' ? null : 'pendingTS')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pending TS</p>
                      <p className="text-3xl font-bold text-indigo-600 mt-2">{metrics.pendingTS.length}</p>
                    </div>
                    <FileCheck className="w-8 h-8 text-indigo-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'pendingDTP' ? 'ring-2 ring-cyan-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'pendingDTP' ? null : 'pendingDTP')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pending DTP</p>
                      <p className="text-3xl font-bold text-cyan-600 mt-2">{metrics.pendingDTP.length}</p>
                    </div>
                    <FilePlus className="w-8 h-8 text-cyan-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'tenderLevel' ? 'ring-2 ring-amber-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'tenderLevel' ? null : 'tenderLevel')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Tender Level</p>
                      <p className="text-3xl font-bold text-amber-600 mt-2">{metrics.tenderLevel.length}</p>
                    </div>
                    <Gavel className="w-8 h-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'tenderApprovals' ? 'ring-2 ring-orange-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'tenderApprovals' ? null : 'tenderApprovals')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Tender Approvals</p>
                      <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.tenderApprovals.length}</p>
                    </div>
                    <Clipboard className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'loaWOLevel' ? 'ring-2 ring-teal-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'loaWOLevel' ? null : 'loaWOLevel')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">LOA-WO Level</p>
                      <p className="text-3xl font-bold text-teal-600 mt-2">{metrics.loaWOLevel.length}</p>
                    </div>
                    <Handshake className="w-8 h-8 text-teal-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Active Filter List */}
            {activeFilter && (
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>
                      {activeFilter === 'redAlerts' && '🚨 Red Alerts'}
                      {activeFilter === 'pendingAA' && '📋 Pending AA Works'}
                      {activeFilter === 'pendingTS' && '🔧 Pending TS Works'}
                      {activeFilter === 'pendingDTP' && '📝 Pending DTP Works'}
                      {activeFilter === 'tenderLevel' && '📢 Tender Level Works'}
                      {activeFilter === 'tenderApprovals' && '✅ Tender Approvals'}
                      {activeFilter === 'loaWOLevel' && '🤝 LOA-WO Level'}
                      {activeFilter === 'highPriority' && '🎯 High Priority Routes'}
                    </CardTitle>
                    {/* D/C/G Breakdown for Pending AA, TS, DTP, Tender Approvals */}
                    {(activeFilter === 'pendingAA' || activeFilter === 'pendingTS' || activeFilter === 'pendingDTP' || activeFilter === 'tenderApprovals') && (
                      <div className="flex gap-2">
                        {(() => {
                          const breakdown = getBreakdown(filteredList);
                          return (
                            <>
                              <Badge variant="outline" className="bg-blue-50">D: {breakdown.D}</Badge>
                              <Badge variant="outline" className="bg-green-50">C: {breakdown.C}</Badge>
                              <Badge variant="outline" className="bg-purple-50">G: {breakdown.G}</Badge>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {/* Tender Level Breakdown (Ø:Pending, O:Online, E:Evaluation) */}
                    {activeFilter === 'tenderLevel' && (
                      <div className="flex gap-2">
                        {(() => {
                          const breakdown = getTenderLevelBreakdown(filteredList);
                          return (
                            <>
                              <Badge variant="outline" className="bg-gray-50">Ø: {breakdown.pending}</Badge>
                              <Badge variant="outline" className="bg-blue-50">O: {breakdown.online}</Badge>
                              <Badge variant="outline" className="bg-green-50">E: {breakdown.evaluation}</Badge>
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {/* LOA-WO Breakdown */}
                    {activeFilter === 'loaWOLevel' && (
                      <div className="flex gap-2">
                        {(() => {
                          const breakdown = getLOAWOBreakdown(filteredList);
                          return (
                            <>
                              <Badge variant="outline" className="bg-orange-50">LOA: {breakdown.loa}</Badge>
                              <Badge variant="outline" className="bg-teal-50">WO: {breakdown.wo}</Badge>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {filteredList.map((project) => (
                      <ProjectRow 
                        key={project.id} 
                        project={project} 
                        onClick={() => setSelectedProject(project)}
                        showAlert={activeFilter === 'redAlerts'}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Quick Actions */}
            <div className="flex gap-4 mb-6">
              <Button onClick={() => setShowDataTable(true)} variant="outline" className="flex-1">
                <FileText className="w-4 h-4 mr-2" />
                View Full Data Table
              </Button>
              <Button onClick={() => { setProjects([]); setActiveFilter(null); }} variant="outline">
                Upload New Data
              </Button>
            </div>
            
            {/* Project Status Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Project Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={[
                    { name: 'Not Started', count: statusDistribution['Not Started'], fill: '#94a3b8' },
                    { name: 'In Progress', count: statusDistribution['In Progress'], fill: '#3b82f6' },
                    { name: 'Phy. Completed', count: statusDistribution['Phy. Completed'], fill: '#f59e0b' },
                    { name: 'Completed', count: statusDistribution['Completed'], fill: '#10b981' },
                    { name: 'Stopped', count: statusDistribution['Stopped'], fill: '#ef4444' }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} fontSize={12} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      <LabelList 
                        dataKey="count" 
                        position="top" 
                        style={{ fontSize: '14px', fontWeight: 'bold', fill: '#1e293b' }}
                      />
                      {[
                        { fill: '#94a3b8' },
                        { fill: '#3b82f6' },
                        { fill: '#f59e0b' },
                        { fill: '#10b981' },
                        { fill: '#ef4444' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-4 border-t text-center">
                  <p className="text-lg font-bold text-slate-700">
                    Total Projects: {
                      statusDistribution['Not Started'] + 
                      statusDistribution['In Progress'] + 
                      statusDistribution['Phy. Completed'] + 
                      statusDistribution['Completed'] + 
                      statusDistribution['Stopped']
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
      
      {/* Footer */}
      <div className="bg-slate-100 border-t mt-12 py-4 px-6 text-center text-sm text-slate-600">
        <p>Superintending Engineer, Panchayat (R&B) Circle No. 2, Rajkot</p>
      </div>
    </div>
  );
}

// Project Row Component
function ProjectRow({ project, onClick, showAlert }) {
  const paaAmount = project['PAA Amount'];
  const paaDate = parseDate(project['PAA Date']);
  const division = project['Division'];
  const currentStatus = calculateCurrentStatus(project);
  const beStatus = project['BE Status']?.trim();
  
  return (
    <div 
      onClick={onClick}
      className="p-4 bg-white border rounded-lg hover:shadow-md transition-all cursor-pointer"
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-medium text-slate-900">{project['Work Name']}</h3>
        </div>
      </div>
      
      {(paaAmount || paaDate) && (
        <div className="text-xs font-bold text-slate-500 mb-1">
          PAA: {paaAmount || 'N/A'} Dt: {formatDate(paaDate)}
        </div>
      )}
      
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{division}</span>
        <span>•</span>
        <span>{currentStatus}</span>
      </div>
      
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {beStatus && (
          <Badge variant="outline" className="text-xs">
            {beStatus === 'D' && 'Division'}
            {beStatus === 'C' && 'Circle'}
            {beStatus === 'G' && 'Government'}
            {beStatus === 'AA' && 'AA Done'}
          </Badge>
        )}
        
        {/* Stuck at Govt Alerts */}
        {showAlert && project.alertType?.includes('Stuck at Govt') && (
          <Badge variant="destructive" className="text-xs">
            {project.noDateFound 
              ? `⚠️ ${project.stage}: No Date Found for Tracking`
              : `🚨 ${project.stage}: Stuck for ${project.daysStuck} days`
            }
          </Badge>
        )}
        
        {/* Tender Opening Missed Alert */}
        {showAlert && project.alertType === 'Tender Opening Missed' && (
          <Badge variant="destructive" className="text-xs">
            📢 Tender Opening Missed by {project.daysMissed} days
          </Badge>
        )}
        
        {/* Bid Validity Alert */}
        {showAlert && project.alertType === 'Bid Validity Expiring' && (
          <Badge variant="destructive" className="text-xs">
            ⏰ Bid Validity: {project.daysRemaining} days left
          </Badge>
        )}
        
        {/* LOA Pending Alert */}
        {showAlert && project.alertType === 'LOA Pending' && (
          <Badge variant="destructive" className="text-xs">
            📋 LOA Pending for {project.daysPending} days
          </Badge>
        )}
        
        {/* WO Pending Alert */}
        {showAlert && project.alertType === 'WO Pending' && (
          <Badge variant="destructive" className="text-xs">
            📝 WO Pending for {project.daysPending} days
          </Badge>
        )}
        
        {project['Route Type']?.toLowerCase().includes('tourist') && (
          <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">Tourist Route</Badge>
        )}
        
        {project['Route Type']?.toLowerCase().includes('pravasipath') && (
          <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">Pravasipath</Badge>
        )}
        
        <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />
      </div>
    </div>
  );
}

export default App;