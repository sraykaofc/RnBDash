import { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, FileText, Clock, Building2, TrendingUp, Upload, Link2, ArrowLeft, ChevronRight } from 'lucide-react';
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
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number' || !isNaN(parseFloat(dateValue))) {
    return excelDateToJSDate(parseFloat(dateValue));
  }
  
  // Try parsing as ISO string
  try {
    const parsed = parseISO(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (e) {
    // Continue to other methods
  }
  
  // Try parsing as standard date string
  const date = new Date(dateValue);
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
  const handleGoogleSheetImport = () => {
    if (!googleSheetUrl) {
      toast.error('Please enter a Google Sheet URL');
      return;
    }
    
    // Convert to CSV export URL
    let csvUrl = googleSheetUrl;
    if (googleSheetUrl.includes('/edit')) {
      csvUrl = googleSheetUrl.replace('/edit', '/export?format=csv');
    } else if (!googleSheetUrl.includes('/export')) {
      csvUrl = `${googleSheetUrl}/export?format=csv`;
    }
    
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processData(results.data);
        toast.success(`Imported ${results.data.length} projects from Google Sheets!`);
      },
      error: (error) => {
        toast.error(`Error importing from Google Sheets: ${error.message}`);
      }
    });
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
        'Work Name': normalized['Work Name'] || normalized['Name'] || '',
        'Division': normalized['Division'] || normalized['Dist'] || '',
        'PAA Amount': normalized['PAA Amount'] || normalized['Column H'] || '',
        'PAA Date': normalized['PAA Date'] || normalized['Column I'] || '',
        'BE Status': normalized['BE Status'] || normalized['Column J'] || '',
        'AA Date': normalized['AA Date'] || '',
        'TS Status': normalized['TS Status'] || normalized['Column M'] || '',
        'DTP Status': normalized['DTP Status'] || normalized['Column P'] || '',
        'Online Date': normalized['Online Date'] || normalized['Column S'] || '',
        'Closing Date': normalized['Closing Date'] || normalized['Column T'] || '',
        'Opening Date': normalized['Opening Date'] || normalized['Column U'] || '',
        'Evaluation Date': normalized['Evaluation Date'] || normalized['Column V'] || '',
        'Proposal Status': normalized['Proposal Status'] || normalized['Column W'] || '',
        'Dispatch Date': normalized['Dispatch Date'] || normalized['Column Y'] || '',
        'LOA Date': normalized['LOA Date'] || normalized['Column Z'] || '',
        'WO Date': normalized['WO Date'] || normalized['Column AA'] || '',
        'Column AC': normalized['Column AC'] || normalized['Status'] || '',
        'Route Type': normalized['Route Type'] || '',
        ...normalized
      };
    });
    
    setProjects(processed);
  };
  
  // Calculate metrics
  const metrics = useMemo(() => {
    const redAlerts = [];
    const pendingAA = [];
    const pendingApprovals = [];
    const executionPhase = [];
    const highPriority = [];
    
    projects.forEach(project => {
      const closingDate = parseDate(project['Closing Date']);
      const dispatchDate = parseDate(project['Dispatch Date']);
      const beStatus = project['BE Status']?.trim();
      const paaDate = parseDate(project['PAA Date']);
      const aaDate = parseDate(project['AA Date']);
      const woDate = parseDate(project['WO Date']);
      const routeType = project['Route Type']?.toLowerCase() || '';
      
      // Red Alerts - Bid Validity
      if (closingDate) {
        const daysRemaining = 120 - differenceInDays(new Date(), closingDate);
        if (daysRemaining < 30 && daysRemaining > 0) {
          redAlerts.push({ ...project, alertType: 'Bid Validity', daysRemaining });
        }
      }
      
      // Red Alerts - G Bottleneck
      if (beStatus === 'G' && dispatchDate) {
        const daysAtG = differenceInDays(new Date(), dispatchDate);
        if (daysAtG > 60) {
          redAlerts.push({ ...project, alertType: 'G Bottleneck', daysAtG });
        }
      }
      
      // Pending AA Works
      if (paaDate && !aaDate && ['D', 'C', 'G'].includes(beStatus)) {
        pendingAA.push(project);
      }
      
      // Pending Approvals
      if (['D', 'C', 'G'].includes(beStatus) && !woDate) {
        pendingApprovals.push(project);
      }
      
      // Execution Phase
      if (woDate) {
        executionPhase.push(project);
      }
      
      // High Priority
      if (routeType.includes('tourist') || routeType.includes('pravasipath')) {
        highPriority.push(project);
      }
    });
    
    return { redAlerts, pendingAA, pendingApprovals, executionPhase, highPriority };
  }, [projects]);
  
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
      case 'pendingApprovals': return metrics.pendingApprovals;
      case 'executionPhase': return metrics.executionPhase;
      case 'highPriority': return metrics.highPriority;
      default: return [];
    }
  };
  
  const filteredList = getFilteredList();
  
  // Search filtered projects
  const searchedProjects = useMemo(() => {
    if (!searchQuery) return projects;
    return projects.filter(project => 
      Object.values(project).some(value => 
        String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [projects, searchQuery]);
  
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
                <p className="text-xs text-slate-500 mt-1">Make sure the sheet is shared with "Anyone with the link"</p>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Stats Cards */}
        {projects.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'pendingApprovals' ? 'ring-2 ring-orange-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'pendingApprovals' ? null : 'pendingApprovals')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Pending Approvals</p>
                      <p className="text-3xl font-bold text-orange-600 mt-2">{metrics.pendingApprovals.length}</p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-500" />
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
              
              <Card 
                className={`cursor-pointer transition-all hover:shadow-lg ${activeFilter === 'highPriority' ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setActiveFilter(activeFilter === 'highPriority' ? null : 'highPriority')}
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600">High Priority</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">{metrics.highPriority.length}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-500" />
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
                      {activeFilter === 'pendingApprovals' && '⏳ Approvals Pending'}
                      {activeFilter === 'executionPhase' && '🚧 Execution Phase'}
                      {activeFilter === 'highPriority' && '🎯 High Priority Routes'}
                    </CardTitle>
                    {(activeFilter === 'pendingAA' || activeFilter === 'pendingApprovals') && (
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
            
            {/* Pipeline Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: 'Division', count: getBreakdown(metrics.pendingApprovals).D },
                    { name: 'Circle', count: getBreakdown(metrics.pendingApprovals).C },
                    { name: 'Government', count: getBreakdown(metrics.pendingApprovals).G }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      <Cell fill="#3b82f6" />
                      <Cell fill="#10b981" />
                      <Cell fill="#8b5cf6" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
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
      
      {paaAmount && (
        <div className="text-xs font-bold text-slate-500 mb-1">
          PAA: {amountDisplay} Dt: {formatDate(paaDate)}
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