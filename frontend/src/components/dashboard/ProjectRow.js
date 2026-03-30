import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';
import { parseDate, formatDate, calculateCurrentStatus } from '../../utils/helpers';

export function ProjectRow({ project, onClick, showAlert }) {
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
        
        {/* Bid Validity Crossed Alert (Expired) */}
        {showAlert && project.alertType === 'Bid Validity Crossed' && (
          <Badge variant="destructive" className="text-xs font-bold">
            🚨 Bid Validity Crossed by {project.daysCrossed} days
          </Badge>
        )}
        
        {/* Bid Validity Expiring Alert */}
        {showAlert && project.alertType === 'Bid Validity Expiring' && (
          <Badge variant="destructive" className="text-xs">
            ⏰ Bid Validity: {project.daysRemaining} days left
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
