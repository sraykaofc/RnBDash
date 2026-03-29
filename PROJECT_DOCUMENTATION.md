# Panchayat (R&B) Circle No. 2 Dashboard

## Overview
This is a comprehensive project monitoring dashboard for the Superintending Engineer, Panchayat (R&B) Circle No. 2, Rajkot. It covers project tracking for Amreli, Bhavnagar, Junagadh, Botad, Porbandar, and Gir Somnath districts.

## Key Features

### 🚨 Red Alerts
- **Bid Validity Expiring**: Automatically flags tenders with fewer than 30 days remaining (120-day validity from Closing Date)
- **Government Bottleneck**: Flags files stuck at Government (G) level for more than 60 days

### ⏳ Bottleneck Tracker (D/C/G)
Monitors the current location of files across:
- **Division (D)**
- **Circle (C)**
- **Government (G)**

Column Y is interpreted dynamically:
- **Before TA**: Dispatch Date (when file was sent to D/C/G)
- **After TA**: Final Approved Amount

### 📋 Pending AA Works
Tracks projects awaiting Administrative Approval:
- Has PAA Date but no AA Date
- BE Status must be D, C, or G
- Sorted by PAA Date (oldest first)
- Shows D/C/G breakdown

### 🎯 Interactive Dashboard
Five clickable stat cards:
1. **Red Alerts** (Red) - Critical issues requiring immediate attention
2. **Pending AA** (Purple) - Works awaiting Administrative Approval
3. **Pending Approvals** (Orange) - Files pending at D/C/G levels
4. **Execution Phase** (Green) - Works currently in progress
5. **High Priority** (Blue) - Tourist and Pravasipath routes

### 🔍 Status Calculation Logic
The system calculates the current status using this exact hierarchy:

1. **TA / LOA / WO / In Progress**
   - If Proposal Status = 'TA':
     - Both LOA & WO dates filled → Display Column AC value (e.g., "95% Complete")
     - Only LOA date filled → "LOA Level"
     - Neither filled → "WO Level"

2. **Tender Proposal**
   - If DTP Status = 'DTP' OR Proposal Status = D/C/G:
     - Evaluation Date filled → "Tender Under Evaluation" or "Tender Proposal at D/C/G"
     - Opening/Closing/Online Date filled → "Tender Online"
     - DTP Status = 'DTP' → "Pending for Online"

3. **DTP (Detailed Technical Proposal)**
   - If TS Status = 'TS' OR DTP Status = D/C/G:
     - "DTP at D" / "DTP at C" / "DTP at G"

4. **TS (Technical Sanction)**
   - If TS Status = 'C' → "TS at C"
   - If TS Status = 'G' → "TS at Govt"

5. **BE (Block Estimate) - Fallback**
   - "Block Estimate at D" / "Block Estimate at C" / "Block Estimate at G"

## Column Mapping

The application automatically maps these columns from your spreadsheet:

| Column Letter | Column Name | Description |
|--------------|-------------|-------------|
| H | PAA Amount | Preliminary Administrative Approval Amount |
| I | PAA Date | PAA Approval Date |
| J | BE Status | Block Estimate Status (D/C/G) |
| - | AA Date | Administrative Approval Date |
| M | TS Status | Technical Sanction Status |
| P | DTP Status | Detailed Technical Proposal Status |
| S | Online Date | Tender Online Date |
| T | Closing Date | Tender Closing Date (used for 120-day validity) |
| U | Opening Date | Tender Opening Date |
| V | Evaluation Date | Tender Evaluation Date |
| W | Proposal Status | Current Proposal Status (TA/D/C/G) |
| Y | Dispatch Date | File Dispatch Date (becomes Final Amount after TA) |
| Z | LOA Date | Letter of Acceptance Date |
| AA | WO Date | Work Order Date |
| AC | Column AC | Progress/Status value (e.g., "95% Complete") |
| - | Work Name | Name of the project/work |
| - | Division | District name |
| - | Route Type | Route classification (Tourist/Pravasipath) |

## How to Use

### 1. Import Data

**Option A: Upload CSV File**
1. Click "Choose File" button
2. Select your project data CSV file
3. Data will be automatically loaded and analyzed

**Option B: Connect Google Sheet**
1. Open your Google Sheet
2. Click Share → Change to "Anyone with the link" (Viewer access)
3. Copy the share URL
4. Paste into "Connect Google Sheet" field
5. Click "Import Data"

### 2. View Dashboard

After import, you'll see:
- 5 stat cards with key metrics
- Click any card to see the full list of projects in that category
- Charts showing pipeline distribution

### 3. Filter & Search

- **Filter by Category**: Click any stat card
- **Search**: Use the search box in data table view
- **View Details**: Click any project row to see all data

### 4. Project List View

Each project shows:
- **Line 1**: Work Name
- **Line 2**: PAA: [Amount] Lakh Dt: [Date]
- **Line 3**: [Division] • [Current Status]
- Badges for location (D/C/G) and alerts

### 5. Navigation

- **View Full Data Table**: See all projects in searchable table
- **Upload New Data**: Replace current dataset
- **Back to Dashboard**: Return from detail views

## Business Rules

### Tender Pipeline Flow
Projects follow this strict chronological path:
```
PAA → AA → TS → DTP → Online (Closing/Opening) → TA → LOA → WO → In Progress
```

### Critical Rules
1. **120-Day Bid Validity**: Starts from Closing Date
2. **Tender Cannot Open Before Close**: Opening Date must be after Closing Date
3. **TS Cannot Pre-date AA**: Technical Sanctions require Administrative Approval first
4. **30-Day Alert Threshold**: Critical alerts when bid validity < 30 days
5. **60-Day G Bottleneck**: Files stuck at Government level for > 60 days

## Data Format Requirements

### Date Formats Supported
- Excel serial numbers (e.g., 45000)
- ISO format (YYYY-MM-DD)
- Standard date strings
- DD.MM.YYYY display format

### Amount Format
- Numbers with or without "Lakh" suffix
- System automatically adds "Lakh" if missing
- Examples: "125.50" → "125.50 Lakh"

## Sample Data

A sample CSV file is available at `/app/sample_data.csv` with realistic project data demonstrating all features.

## Technical Stack

- **Frontend**: React 19
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI (shadcn/ui)
- **CSV Parsing**: papaparse
- **Date Handling**: date-fns
- **Charts**: recharts
- **Notifications**: sonner

## Notes

- All data processing happens in the browser (no backend storage)
- Data is not persisted - refresh requires re-upload
- Optimized for government/administrative workflow
- Fully responsive design
- Professional color scheme with semantic colors

## Support

For issues or questions, please contact the development team or refer to the system documentation.

---

**Superintending Engineer, Panchayat (R&B) Circle No. 2, Rajkot**
