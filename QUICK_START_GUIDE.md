# Quick Start Guide - Panchayat R&B Dashboard

## Getting Started in 3 Steps

### Step 1: Open the Dashboard
Navigate to your dashboard URL: `https://rb-pipeline-monitor.preview.emergentagent.com`

### Step 2: Import Your Data

**Using CSV File:**
1. Click "Choose File"
2. Select your project spreadsheet (.csv format)
3. Data loads automatically

**Using Google Sheets:**
1. Open your Google Sheet
2. Click **Share** → **Anyone with the link** (Viewer)
3. Copy the URL
4. Paste in "Connect Google Sheet" field
5. Click **Import Data**

### Step 3: Monitor Your Projects

**Dashboard Overview:**
- 🚨 **Red Alerts** - Urgent issues (bid validity expiring, G bottlenecks)
- 📋 **Pending AA** - Works awaiting Administrative Approval
- ⏳ **Pending Approvals** - Files at Division/Circle/Government
- 🚧 **Execution Phase** - Works in progress
- 🎯 **High Priority** - Tourist/Pravasipath routes

**Click any card** to see detailed list of projects in that category.

## Understanding the Dashboard

### Red Alerts 🚨
Two types of critical alerts:

1. **Bid Validity Expiring**
   - 120 days from Closing Date
   - Flagged when < 30 days remaining
   - Action: Fast-track approval process

2. **Government Bottleneck**
   - Files stuck at "G" for > 60 days
   - Action: Follow up with Government office

### Project Status
The dashboard shows current stage for each project:
- Block Estimate (BE) at D/C/G
- Technical Sanction (TS) at C/Govt
- DTP at D/C/G
- Tender stages (Online, Evaluation, Proposal)
- TA/LOA/WO/In Progress

### D/C/G Breakdown
- **D** = Division level
- **C** = Circle level
- **G** = Government level

Numbers show how many files are at each stage.

## Common Tasks

### View Project Details
1. Click on any project in the list
2. See all data fields
3. Click "Back to Dashboard" when done

### Search Projects
1. Click "View Full Data Table"
2. Use search box to find specific projects
3. Click any row for details

### Upload Fresh Data
1. Click "Upload New Data" button
2. Select new CSV or paste new Google Sheets URL
3. Dashboard updates automatically

## Tips

✅ **Keep your spreadsheet updated** - Dashboard reflects current data only  
✅ **Share Google Sheets properly** - Must be "Anyone with the link"  
✅ **Use consistent column names** - System auto-maps common variations  
✅ **Check Red Alerts daily** - Prevent bid validity expirations  
✅ **Monitor G Bottlenecks** - Follow up on stuck files  

## Column Requirements

Your spreadsheet should include these columns:
- Work Name
- Division (District)
- PAA Amount (Column H)
- PAA Date (Column I)
- BE Status (Column J) - must be D, C, or G
- AA Date
- TS Status (Column M)
- DTP Status (Column P)
- Closing Date (Column T) - for bid validity calculation
- Proposal Status (Column W)
- Dispatch Date (Column Y)
- LOA Date (Column Z)
- WO Date (Column AA)
- Column AC (for progress status)

## Troubleshooting

**Data not loading?**
- Check CSV file format
- Verify Google Sheet is shared publicly
- Ensure column headers are present

**Dates showing incorrectly?**
- System handles Excel date formats automatically
- Dates display as DD.MM.YYYY

**Status not calculating?**
- Verify BE Status has D, C, or G values
- Check that required date columns are filled

## Need Help?

Contact your system administrator or refer to:
- Full documentation: `/app/PROJECT_DOCUMENTATION.md`
- Sample data: `/app/sample_data.csv`

---

**Dashboard URL**: https://rb-pipeline-monitor.preview.emergentagent.com
