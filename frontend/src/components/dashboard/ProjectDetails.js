import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Toaster } from 'sonner';
import { parseDate, formatDate, calculateCurrentStatus } from '../../utils/helpers';

export function ProjectDetails({ project, onBack }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-gradient-to-r from-slate-700 to-slate-900 text-white py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <Button
            variant="outline"
            onClick={onBack}
            className="mb-3 bg-white text-slate-700 hover:bg-slate-50 border-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">{project['Work Name']}</h1>
          <div className="flex gap-2 items-center text-sm text-white mt-2 flex-wrap">
            <span>{project['Division']}</span>
            <span>•</span>
            <span>{calculateCurrentStatus(project)}</span>
            {project['PAA Amount'] && (
              <>
                <span>•</span>
                <span>PAA: {project['PAA Amount']}</span>
              </>
            )}
            {project['PAA Date'] && (
              <>
                <span>•</span>
                <span>PAA Dt: {formatDate(parseDate(project['PAA Date']))}</span>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Project Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(project).map(([key, value]) => {
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
      </div>
    </div>
  );
}
