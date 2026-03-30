import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Columns } from 'lucide-react';
import { Toaster } from 'sonner';
import { parseDate, formatDate } from '../../utils/helpers';
import { ALL_COLUMNS } from '../../utils/constants';

export function DataTable({ 
  projects, 
  onBack, 
  onProjectClick,
  searchQuery,
  onSearchChange 
}) {
  const [visibleColumns, setVisibleColumns] = useState([
    'Code', 'Work Name', 'Division', 'PAA Amount', 'PAA Date', 'Status'
  ]);
  const [columnFilters, setColumnFilters] = useState({});
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  
  // Apply column filters
  const filteredProjects = projects.filter(project => {
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
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <div className="flex gap-2 flex-1 max-w-2xl">
            <Input
              placeholder="Search all data..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
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
                  {ALL_COLUMNS.map(col => (
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
                <thead className="bg-slate-100 border-b sticky top-0">
                  <tr>
                    {ALL_COLUMNS.map(col => {
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
                  {filteredProjects.map((project) => (
                    <tr 
                      key={project.id} 
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => onProjectClick(project)}
                    >
                      {ALL_COLUMNS.map(col => {
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
