import { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AlertTriangle, FileText, Clock, TrendingUp, Upload, Link2, ArrowLeft, FileCheck, FilePlus, Gavel, Clipboard, Handshake } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { parseDate, formatDate, calculateCurrentStatus, differenceInDays } from './utils/helpers';
import { PREDEFINED_SHEET_URL } from './utils/constants';
import { Login } from './components/dashboard/Login';
import { ProjectDetails } from './components/dashboard/ProjectDetails';
import { DataTable } from './components/dashboard/DataTable';
import { ProjectRow } from './components/dashboard/ProjectRow';
import './App.css';

function App() {
  const [projects, setProjects] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState(PREDEFINED_SHEET_URL);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDataTable, setShowDataTable] = useState(false);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is already logged in (from localStorage)
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Handle logout
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
  };
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
        'AA Amount': normalized['AA Amount'] || normalized['AA (Rs. Lakh)'] || normalized['Column K'] || normalized['K'] || '',
        'AA Date': normalized['AA Date'] || normalized['Column L'] || normalized['L'] || '',
        'TS Status': normalized['TS Status'] || normalized['Column M'] || normalized['M'] || '',
        'TS Amount': normalized['TS Amount'] || normalized['TS (Rs. Lakh)'] || normalized['Column N'] || normalized['N'] || '',
        'TS Date': normalized['TS Date'] || normalized['Column O'] || normalized['O'] || '',
        'DTP Status': normalized['DTP Status'] || normalized['Column P'] || normalized['P'] || '',
        'DTP Amount': normalized['DTP Amount'] || normalized['DTP (Rs. Lakh)'] || normalized['Column Q'] || normalized['Q'] || '',
        'DTP Date': normalized['DTP Date'] || normalized['Column R'] || normalized['R'] || '',
        'Closing Date': normalized['Closing Date'] || normalized['Column S'] || normalized['S'] || '',
        'Opened Date': normalized['Opened Date'] || normalized['Opening Date'] || normalized['Column T'] || normalized['T'] || '',
        'Agency Name': normalized['Agency Name'] || normalized['Column U'] || normalized['U'] || '',
        '% of Tender': normalized['% of Tender'] || normalized['Column V'] || normalized['V'] || '',
        'Proposal Status': normalized['Proposal Status'] || normalized['Column W'] || normalized['W'] || '',
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
      
      // Get Column AC status early - needed for all alerts
      const acStatus = project['Column AC']?.trim().toLowerCase() || '';
      
      // === RED ALERTS SECTION ===
      // IMPORTANT: All alerts require Column AC = "Not Started"
      
      if (acStatus === 'not started') {
        // 1. Bid Validity Alert - Enhanced with P=DTP requirement
        // Don't show bid validity alerts when tender is approved (W='TA' and Y has date)
        const tenderApproved = proposalStatus === 'TA' && appDate;
        
        if (dtpStatus === 'DTP' && closingDate && !tenderApproved) {
          const daysRemaining = 120 - differenceInDays(new Date(), closingDate);
          
          // Bid Validity CROSSED (already expired) - TOP PRIORITY
          if (daysRemaining <= 0) {
            const daysCrossed = Math.abs(daysRemaining);
            redAlerts.push({ 
              ...project, 
              alertType: 'Bid Validity Crossed',
              alertPriority: 0.5, // Higher than expiring
              daysCrossed
            });
          }
          // Bid Validity EXPIRING (< 30 days remaining)
          else if (daysRemaining < 30) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Bid Validity Expiring',
              alertPriority: 1,
              daysRemaining 
            });
          }
        }
        
        // 2. Stuck at Govt Alert - Based on previous stage completion date
        // BE Status = G (waiting for AA approval) - use PAA Date (Column I) - >30 days
        if (beStatus === 'G' && paaDate) {
          const daysStuck = differenceInDays(new Date(), paaDate);
          if (daysStuck > 30) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - BE',
              alertPriority: 2,
              daysStuck,
              stage: 'BE Status',
              fromDate: 'PAA Date'
            });
          }
        }
        
        // TS Status = G (waiting for TS approval) - use AA Date (Column L) - >30 days
        if (tsStatus === 'G' && aaDate) {
          const daysStuck = differenceInDays(new Date(), aaDate);
          if (daysStuck > 30) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - TS',
              alertPriority: 2,
              daysStuck,
              stage: 'TS Status',
              fromDate: 'AA Date'
            });
          }
        }
        
        // DTP Status = G (waiting for DTP approval) - use TS Date (Column O) - >30 days
        if (dtpStatus === 'G' && tsDate) {
          const daysStuck = differenceInDays(new Date(), tsDate);
          if (daysStuck > 30) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Stuck at Govt - DTP',
              alertPriority: 2,
              daysStuck,
              stage: 'DTP Status',
              fromDate: 'TS Date'
            });
          }
        }
        
        // Proposal Status = G (waiting for tender approval) - use DTP Date or Opened Date - >60 days
        if (proposalStatus === 'G') {
          const dtpApprovalDate = parseDate(project['DTP Date']);
          const referenceDate = dtpApprovalDate || openedDate;
          
          if (referenceDate) {
            const daysStuck = differenceInDays(new Date(), referenceDate);
            if (daysStuck > 60) {
              redAlerts.push({ 
                ...project, 
                alertType: 'Stuck at Govt - Proposal',
                alertPriority: 2,
                daysStuck,
                stage: 'Proposal Status',
                fromDate: dtpApprovalDate ? 'DTP Date' : 'Opened Date'
              });
            }
          }
        }
        
        // 3. Tender Alert - If P=DTP, W=D, and Closing Date (S) crossed >15 days
        if (dtpStatus === 'DTP' && proposalStatus === 'D' && closingDate) {
          const daysMissed = differenceInDays(new Date(), closingDate);
          if (daysMissed > 15) {
            redAlerts.push({ 
              ...project, 
              alertType: 'Tender Opening Missed',
              alertPriority: 3,
              daysMissed
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
              alertPriority: 4,
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
              alertPriority: 5,
              daysPending
            });
          }
        }
      }
      
      // Skip Dropped (X) and Old Completed (OC) works
      if (proposalStatus === 'X' || proposalStatus === 'OC') {
        return;
      }
      
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
    
    // Sort Red Alerts by priority:
    // 0.5. Bid Validity Crossed (MOST URGENT - already expired)
    // 1. Bid Validity Expiring
    // 2. Stuck at Govt (BE, TS, DTP, Proposal)
    // 3. Tender Opening Missed
    // 4. LOA Pending
    // 5. WO Pending
    redAlerts.sort((a, b) => {
      if (a.alertPriority !== b.alertPriority) {
        return a.alertPriority - b.alertPriority;
      }
      // If same priority, sort by urgency
      if (a.daysCrossed !== undefined && b.daysCrossed !== undefined) {
        return b.daysCrossed - a.daysCrossed; // Higher crossed days = more urgent
      }
      if (a.daysRemaining !== undefined && b.daysRemaining !== undefined) {
        return a.daysRemaining - b.daysRemaining; // Lower remaining days = more urgent
      }
      if (a.daysStuck !== undefined && b.daysStuck !== undefined) {
        return b.daysStuck - a.daysStuck; // Higher stuck days = more urgent
      }
      if (a.daysMissed !== undefined && b.daysMissed !== undefined) {
        return b.daysMissed - a.daysMissed; // Higher missed days = more urgent
      }
      if (a.daysPending !== undefined && b.daysPending !== undefined) {
        return b.daysPending - a.daysPending; // Higher pending days = more urgent
      }
      return 0;
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
    
    // Use filteredProjects (respects division filter) for chart
    filteredProjects.forEach(project => {
      const status = project['Column AC']?.trim() || '';
      
      // Match EXACT status values from Column AC only
      if (status === 'Not Started') {
        distribution['Not Started']++;
      } else if (status === 'In Progress') {
        distribution['In Progress']++;
      } else if (status === 'Phy. Completed') {
        distribution['Phy. Completed']++;
      } else if (status === 'Completed') {
        distribution['Completed']++;
      } else if (status === 'Stopped') {
        distribution['Stopped']++;
      }
      // Ignore any other values (don't count them)
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
      <ProjectDetails 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)} 
      />
    );
  }
  
  // Render full data table view
  if (showDataTable) {
    return (
      <DataTable 
        projects={searchedProjects}
        onBack={() => setShowDataTable(false)}
        onProjectClick={(project) => setSelectedProject(project)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      {/* Login Screen */}
      {!isAuthenticated ? (
        <Login onLoginSuccess={() => setIsAuthenticated(true)} />
      ) : (
        <>
      {/* Full Page Views for All Stat Cards */}
      {activeFilter ? (
        <div className="min-h-screen bg-slate-50">
          {/* Dynamic Header based on filter type */}
          <div className={`sticky top-0 z-50 text-white py-6 px-6 shadow-lg ${
            activeFilter === 'redAlerts' ? 'bg-gradient-to-r from-red-600 to-red-800' :
            activeFilter === 'pendingAA' ? 'bg-gradient-to-r from-purple-600 to-purple-800' :
            activeFilter === 'pendingTS' ? 'bg-gradient-to-r from-blue-600 to-blue-800' :
            activeFilter === 'pendingDTP' ? 'bg-gradient-to-r from-cyan-600 to-cyan-800' :
            activeFilter === 'tenderLevel' ? 'bg-gradient-to-r from-orange-600 to-orange-800' :
            activeFilter === 'tenderApprovals' ? 'bg-gradient-to-r from-green-600 to-green-800' :
            activeFilter === 'loaWOLevel' ? 'bg-gradient-to-r from-teal-600 to-teal-800' :
            'bg-gradient-to-r from-indigo-600 to-indigo-800'
          }`}>
            <div className="max-w-7xl mx-auto">
              <Button
                variant="outline"
                onClick={() => setActiveFilter(null)}
                className={`mb-4 bg-white hover:bg-opacity-90 border-white ${
                  activeFilter === 'redAlerts' ? 'text-red-600' :
                  activeFilter === 'pendingAA' ? 'text-purple-600' :
                  activeFilter === 'pendingTS' ? 'text-blue-600' :
                  activeFilter === 'pendingDTP' ? 'text-cyan-600' :
                  activeFilter === 'tenderLevel' ? 'text-orange-600' :
                  activeFilter === 'tenderApprovals' ? 'text-green-600' :
                  activeFilter === 'loaWOLevel' ? 'text-teal-600' :
                  'text-indigo-600'
                }`}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-3xl font-bold mb-2">
                {activeFilter === 'redAlerts' && '🚨 Red Alerts'}
                {activeFilter === 'pendingAA' && '📋 Pending AA Works'}
                {activeFilter === 'pendingTS' && '🔧 Pending TS Works'}
                {activeFilter === 'pendingDTP' && '📝 Pending DTP Works'}
                {activeFilter === 'tenderLevel' && '📢 Tender Level Works'}
                {activeFilter === 'tenderApprovals' && '✅ Tender Approvals'}
                {activeFilter === 'loaWOLevel' && '🤝 LOA-WO Level'}
                {activeFilter === 'highPriority' && '🎯 High Priority Routes'}
              </h1>
              
              {/* Breakdown badges */}
              <div className="flex gap-2 flex-wrap mt-3">
                {activeFilter === 'redAlerts' && (() => {
                  const breakdown = {
                    BE: metrics.redAlerts.filter(p => p.alertType === 'Stuck at Govt - BE').length,
                    TS: metrics.redAlerts.filter(p => p.alertType === 'Stuck at Govt - TS').length,
                    DTP: metrics.redAlerts.filter(p => p.alertType === 'Stuck at Govt - DTP').length,
                    Proposal: metrics.redAlerts.filter(p => p.alertType === 'Stuck at Govt - Proposal').length,
                    Tender: metrics.redAlerts.filter(p => p.alertType === 'Bid Validity Crossed' || p.alertType === 'Bid Validity Expiring' || p.alertType === 'Tender Opening Missed').length,
                    LOA: metrics.redAlerts.filter(p => p.alertType === 'LOA Pending').length,
                    WO: metrics.redAlerts.filter(p => p.alertType === 'WO Pending').length
                  };
                  return (
                    <>
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">BE: {breakdown.BE}</Badge>
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">TS: {breakdown.TS}</Badge>
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">DTP: {breakdown.DTP}</Badge>
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Tender: {breakdown.Tender + breakdown.Proposal}</Badge>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">LOA: {breakdown.LOA}</Badge>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">WO: {breakdown.WO}</Badge>
                    </>
                  );
                })()}
                
                {(activeFilter === 'pendingAA' || activeFilter === 'pendingTS' || activeFilter === 'pendingDTP' || activeFilter === 'tenderApprovals') && (() => {
                  const breakdown = getBreakdown(
                    activeFilter === 'redAlerts' ? metrics.redAlerts :
                    activeFilter === 'pendingAA' ? metrics.pendingAA :
                    activeFilter === 'pendingTS' ? metrics.pendingTS :
                    activeFilter === 'pendingDTP' ? metrics.pendingDTP :
                    activeFilter === 'tenderApprovals' ? metrics.tenderApprovals :
                    []
                  );
                  return (
                    <>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">D: {breakdown.D}</Badge>
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">C: {breakdown.C}</Badge>
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">G: {breakdown.G}</Badge>
                    </>
                  );
                })()}
                
                {activeFilter === 'tenderLevel' && (() => {
                  const breakdown = getTenderLevelBreakdown(metrics.tenderLevel);
                  return (
                    <>
                      <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-100">Ø: {breakdown.pending}</Badge>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">O: {breakdown.online}</Badge>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">E: {breakdown.evaluation}</Badge>
                    </>
                  );
                })()}
                
                {activeFilter === 'loaWOLevel' && (() => {
                  const breakdown = getLOAWOBreakdown(metrics.loaWOLevel);
                  return (
                    <>
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">LOA: {breakdown.loa}</Badge>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">WO: {breakdown.wo}</Badge>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
          
          {/* Content Section */}
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="space-y-3">
              {(() => {
                const list = 
                  activeFilter === 'redAlerts' ? metrics.redAlerts :
                  activeFilter === 'pendingAA' ? metrics.pendingAA :
                  activeFilter === 'pendingTS' ? metrics.pendingTS :
                  activeFilter === 'pendingDTP' ? metrics.pendingDTP :
                  activeFilter === 'tenderLevel' ? metrics.tenderLevel :
                  activeFilter === 'tenderApprovals' ? metrics.tenderApprovals :
                  activeFilter === 'loaWOLevel' ? metrics.loaWOLevel :
                  activeFilter === 'highPriority' ? metrics.highPriority :
                  [];
                  
                return list.map((project) => (
                  <ProjectRow 
                    key={project.id} 
                    project={project} 
                    onClick={() => setSelectedProject(project)}
                    showAlert={activeFilter === 'redAlerts'}
                  />
                ));
              })()}
            </div>
          </div>
        </div>
      ) : (
        <>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">R&B Circle No. 2 Dashboard</h1>
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
        </>
      )}
      </>
      )}
    </div>
  );
}

export default App;
