import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { AlertTriangle, FileText, Clock, Building2, TrendingUp, Upload, Link2, ArrowLeft, ChevronRight, FileCheck, FilePlus, Gavel, Clipboard, Handshake } from 'lucide-react';
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
  const onlineDate = parseDate(project['Online Date']);
  const closingDate = parseDate(project['Closing Date']);
  const openingDate = parseDate(project['Opening Date']);
  const evaluationDate = parseDate(project['Evaluation Date']);
  
  // TA / LOA / WO / In Progress
  if (proposalStatus === 'TA') {
    if (woDate && loaDate) {
      return acValue || 'In Progress';
    } else if (loaDate) {
      return 'LOA Level';
    } else {
      return 'WO Level';
    }
  }
  
  // Tender Proposal
  if (dtpStatus === 'DTP' || ['D', 'C', 'G'].includes(proposalStatus)) {
    if (evaluationDate) {
      if (proposalStatus === 'D') return 'Tender Proposal at D';
      if (proposalStatus === 'C') return 'Tender Proposal at C';
      if (proposalStatus === 'G') return 'Tender Proposal at G';
      return 'Tender Under Evaluation';
    }
    if (openingDate) return 'Tender Online';
    if (closingDate) return 'Tender Online';
    if (onlineDate) return 'Tender Online';
    if (dtpStatus === 'DTP') return 'Pending for Online';
  }
  
  // DTP
  if (tsStatus === 'TS' || ['D', 'C', 'G'].includes(dtpStatus)) {
    if (dtpStatus === 'D') return 'DTP at D';
    if (dtpStatus === 'C') return 'DTP at C';
    if (dtpStatus === 'G') return 'DTP at G';
  }
  
  // TS
  if (tsStatus === 'C') return 'TS at C';
  if (tsStatus === 'G') return 'TS at Govt';
  
  // BE Status
  if (beStatus === 'D') return 'Block Estimate at D';
  if (beStatus === 'C') return 'Block Estimate at C';
  if (beStatus === 'G') return 'Block Estimate at G';
  
  return 'Unknown Status';
};

function App() {
  const [projects, setProjects] = useState([]);
  const [activeFilter, setActiveFilter] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDataTable, setShowDataTable] = useState(false);
  const [selectedDivisions, setSelectedDivisions] = useState([]);
  
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
  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) {
      toast.error('Please enter a Google Sheet URL');
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
        toast.error('Invalid Google Sheets URL. Please check the URL and try again.');
        return;
      }
      
      // Construct CSV export URL
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      
      toast.loading('Importing from Google Sheets...');
      
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
              toast.dismiss();
              toast.success(`Imported ${results.data.length} projects from Google Sheets!`);
            } else {
              toast.dismiss();
              toast.error('No data found in the sheet. Please check if the sheet has data.');
            }
          },
          error: (error) => {
            toast.dismiss();
            toast.error(`Error parsing CSV: ${error.message}`);
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
                toast.dismiss();
                toast.success(`Imported ${results.data.length} projects from Google Sheets!`);
              } else {
                toast.dismiss();
                toast.error('No data found in the sheet.');
              }
            },
            error: (error) => {
              toast.dismiss();
              toast.error(`Error parsing CSV: ${error.message}`);
            }
          });
          
        } catch (proxyError) {
          console.error('Proxy fetch also failed:', proxyError);
          toast.dismiss();
          toast.error(
            'Unable to import from Google Sheets. Please ensure the sheet is shared as "Anyone with the link" and try again, or download the CSV and upload it directly.',
            { duration: 6000 }
          );
        }
      }
      
    } catch (error) {
      console.error('Error importing from Google Sheets:', error);
      toast.dismiss();
      toast.error('Failed to import. Please check the URL or try downloading the CSV and uploading it.');
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
      
      return {
        id: index,
        'Work Name': normalized['Work Name'] || normalized['Name'] || normalized['A'] || '',
        'Division': normalized['Division'] || normalized['Dist'] || '',
        'PAA Amount': normalized['PAA Amount'] || normalized['Column H'] || normalized['H'] || '',
        'PAA Date': normalized['PAA Date'] || normalized['Column I'] || normalized['I'] || '',
        'BE Status': normalized['BE Status'] || normalized['Column J'] || normalized['J'] || '',
        'AA Amount': normalized['AA Amount'] || normalized['Column K'] || normalized['K'] || '',
        'AA Date': normalized['AA Date'] || normalized['Column L'] || normalized['L'] || '',
        'TS Status': normalized['TS Status'] || normalized['Column M'] || normalized['M'] || '',
        'TS Amount': normalized['TS Amount'] || normalized['Column N'] || normalized['N'] || '',
        'TS Date': normalized['TS Date'] || normalized['Column O'] || normalized['O'] || '',
        'DTP Status': normalized['DTP Status'] || normalized['Column P'] || normalized['P'] || '',
        'DTP Amount': normalized['DTP Amount'] || normalized['Column Q'] || normalized['Q'] || '',
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
        'Column AC': normalized['Column AC'] || normalized['AC'] || normalized['Status'] || '',
        'Year': normalized['Year'] || normalized['Column AM'] || normalized['AM'] || '',
        'Time': normalized['Time'] || normalized['Column AN'] || normalized['AN'] || '',
        'Amount Category': normalized['Amount Category'] || normalized['Column AO'] || normalized['AO'] || '',
        'Year YYYY': normalized['Year YYYY'] || normalized['Column AP'] || normalized['AP'] || '',
        'Route Type': normalized['Route Type'] || '',
        ...normalized
      };
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
    const executionPhase = [];
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
      
      // Red Alerts - Bid Validity
      if (closingDate) {
        const daysRemaining = 120 - differenceInDays(new Date(), closingDate);
        if (daysRemaining < 30 && daysRemaining > 0) {
          redAlerts.push({ ...project, alertType: 'Bid Validity', daysRemaining });
        }
      }
      
      // Red Alerts - G Bottleneck (at any stage)
      if (beStatus === 'G' || tsStatus === 'G' || dtpStatus === 'G' || proposalStatus === 'G') {
        // Check how long stuck at G
        const appDate = parseDate(project['App. Date']);
        if (appDate) {
          const daysAtG = differenceInDays(new Date(), appDate);
          if (daysAtG > 60) {
            redAlerts.push({ ...project, alertType: 'G Bottleneck', daysAtG });
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
      
      // Pending TS - has AA but no TS
      if (aaDate && !tsDate && ['D', 'C', 'G'].includes(tsStatus)) {
        pendingTS.push(project);
      }
      
      // Pending DTP - has TS but no DTP
      if (tsDate && !dtpDate && ['D', 'C', 'G'].includes(dtpStatus)) {
        pendingDTP.push(project);
      }
      
      // Tender Level - has DTP, in tender process but no TA
      if (dtpDate && proposalStatus !== 'TA' && !woDate) {
        // Check if in tender stage (has closing date or is pending for online)
        if (closingDate || ['D', 'C', 'G'].includes(proposalStatus)) {
          tenderLevel.push(project);
        }
      }
      
      // Tender Approvals - waiting for TA at D/C/G
      if (['D', 'C', 'G'].includes(proposalStatus) && agencyName) {
        tenderApprovals.push(project);
      }
      
      // LOA-WO Level - has TA but no WO
      if (proposalStatus === 'TA' && !woDate) {
        loaWOLevel.push(project);
      }
      
      // Execution Phase - has WO
      if (woDate) {
        executionPhase.push(project);
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
      executionPhase, 
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
      const status = project['Column AC']?.trim().toLowerCase() || '';
      
      if (status.includes('not started') || status === '') {
        distribution['Not Started']++;
      } else if (status.includes('progress') || status.includes('%')) {
        distribution['In Progress']++;
      } else if (status.includes('phy') && status.includes('complet')) {
        distribution['Phy. Completed']++;
      } else if (status.includes('completed') || status.includes('complete')) {
        distribution['Completed']++;
      } else if (status.includes('stop')) {
        distribution['Stopped']++;
      } else {
        // Default to In Progress for other statuses
        distribution['In Progress']++;
      }
    });
    
    return distribution;
  }, [filteredProjects]);
  
  // Get breakdown by D/C/G
  const getBreakdown = (list) => {
    const breakdown = { D: 0, C: 0, G: 0 };
    list.forEach(project => {
      const status = project['BE Status']?.trim();
      if (status === 'D') breakdown.D++;
      else if (status === 'C') breakdown.C++;
      else if (status === 'G') breakdown.G++;
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
        const dateA = parseDate(a['AA Date']);
        const dateB = parseDate(b['AA Date']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
      case 'pendingDTP': return metrics.pendingDTP.sort((a, b) => {
        const dateA = parseDate(a['TS Date']);
        const dateB = parseDate(b['TS Date']);
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });
      case 'tenderLevel': return metrics.tenderLevel;
      case 'tenderApprovals': return metrics.tenderApprovals;
      case 'loaWOLevel': return metrics.loaWOLevel;
      case 'executionPhase': return metrics.executionPhase;
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
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Toaster position="top-right" />
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="outline"
              onClick={() => setShowDataTable(false)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <Input
              placeholder="Search all data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>
          
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Work Name</th>
                      <th className="px-4 py-3 text-left font-medium">Division</th>
                      <th className="px-4 py-3 text-left font-medium">PAA Amount</th>
                      <th className="px-4 py-3 text-left font-medium">PAA Date</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                      <th className="px-4 py-3 text-left font-medium">BE Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchedProjects.map((project) => (
                      <tr 
                        key={project.id} 
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedProject(project)}
                      >
                        <td className="px-4 py-3">{project['Work Name']}</td>
                        <td className="px-4 py-3">{project['Division']}</td>
                        <td className="px-4 py-3">{project['PAA Amount']}</td>
                        <td className="px-4 py-3">{formatDate(parseDate(project['PAA Date']))}</td>
                        <td className="px-4 py-3">{calculateCurrentStatus(project)}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{project['BE Status']}</Badge>
                        </td>
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
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'executionPhase' ? 'ring-2 ring-green-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'executionPhase' ? null : 'executionPhase')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Execution Phase</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">{metrics.executionPhase.length}</p>
                    </div>
                    <Building2 className="w-8 h-8 text-green-500" />
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
                      {activeFilter === 'executionPhase' && '🚧 Execution Phase'}
                      {activeFilter === 'highPriority' && '🎯 High Priority Routes'}
                    </CardTitle>
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
  
  let amountDisplay = paaAmount;
  if (paaAmount && !String(paaAmount).toLowerCase().includes('lakh')) {
    amountDisplay = `${paaAmount} Lakh`;
  }
  
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
          PAA: {amountDisplay || 'N/A'} Dt: {formatDate(paaDate)}
        </div>
      )}
      
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>{division}</span>
        <span>•</span>
        <span>{currentStatus}</span>
      </div>
      
      <div className="flex items-center gap-2 mt-2">
        {beStatus && (
          <Badge variant="outline" className="text-xs">
            {beStatus === 'D' && 'Division'}
            {beStatus === 'C' && 'Circle'}
            {beStatus === 'G' && 'Government'}
            {beStatus === 'AA' && 'AA Done'}
          </Badge>
        )}
        
        {showAlert && project.alertType === 'Bid Validity' && (
          <Badge variant="destructive" className="text-xs">
            ⚠️ {project.daysRemaining} days left
          </Badge>
        )}
        
        {showAlert && project.alertType === 'G Bottleneck' && (
          <Badge variant="destructive" className="text-xs">
            ⚠️ Stuck for {project.daysAtG} days
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