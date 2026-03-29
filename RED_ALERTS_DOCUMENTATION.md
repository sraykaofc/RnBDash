# Red Alerts System - Enhanced Documentation

## Overview
The Red Alerts system has been significantly enhanced to provide comprehensive tracking of project bottlenecks, delays, and critical deadlines across multiple stages of the project lifecycle.

**IMPORTANT**: All alerts require **Column AC = "Not Started"** to trigger. This ensures alerts focus only on projects that haven't begun execution yet.

**Alert Sorting Priority**: Alerts are automatically sorted by urgency:
1. Bid Validity Expiring (Priority 1 - Most Urgent)
2. Stuck at Government (Priority 2)
3. Tender Opening Missed (Priority 3)
4. LOA Pending (Priority 4)
5. WO Pending (Priority 5)

## Alert Types

### 1. 🚨 Stuck at Government Alert
**Purpose**: Track files that have been sent to Government (G) and are pending for more than 15 days.

**Trigger Conditions**:
- **Column AC = "Not Started"** (Required)
- **BE Status (Column J)** = 'G' → Checks tracking date in **Column K**
- **TS Status (Column M)** = 'G' → Checks tracking date in **Column N**
- **DTP Status (Column P)** = 'G' → Checks tracking date in **Column Q**
- **Proposal Status (Column W)** = 'G' → Checks tracking date in **Column X**

**Alert Logic**:
- If tracking date is present AND more than 15 days have passed:
  - Shows: `🚨 [Stage] Status: Stuck for X days`
  - Example: `🚨 TS Status: Stuck for 45 days`

- If tracking date is missing:
  - Shows: `⚠️ [Stage] Status: No Date Found for Tracking`
  - Example: `⚠️ DTP Status: No Date Found for Tracking`

**Data Format**: Tracking dates must be in DD.MM.YYYY format (e.g., 15.03.2024)

---

### 2. 📢 Tender Opening Missed Alert
**Purpose**: Identify tenders where the opening date has been missed.

**Trigger Conditions**:
- **Column AC = "Not Started"** (Required)
- **Column P (DTP Status)** = 'DTP'
- **Column W (Proposal Status)** = 'D'
- **Column S (Closing Date)** crossed more than 15 days ago

**Alert Display**:
- Shows: `📢 Tender Opening Missed by X days`
- Example: `📢 Tender Opening Missed by 23 days`

**Use Case**: Helps track tenders that should have been opened but were delayed.

---

### 3. ⏰ Bid Validity Expiring Alert (Enhanced)
**Purpose**: Alert when the 120-day bid validity period is approaching expiration.

**Trigger Conditions**:
- **Column AC = "Not Started"** (Required)
- **Column P (DTP Status)** = 'DTP' *(NEW requirement)*
- **Column S (Closing Date)** exists
- Days remaining = 120 days - (Today - Closing Date)
- Alert when days remaining < 30 and > 0

**Alert Display**:
- Shows: `⏰ Bid Validity: X days left`
- Example: `⏰ Bid Validity: 12 days left`

**Note**: Previously, this alert didn't check DTP Status. Now it only triggers for projects at DTP stage.

---

### 4. 📋 LOA Pending Alert
**Purpose**: Track delays in issuing Letter of Award (LOA) after tender approval.

**Trigger Conditions**:
- **Column AC = "Not Started"** (Required)
- **Column Y (Tender App. Date)** exists and crossed more than 15 days
- **Column Z (LOA Date)** is empty (LOA not yet issued)

**Alert Display**:
- Shows: `📋 LOA Pending for X days`
- Example: `📋 LOA Pending for 425 days`

**Use Case**: Monitors the time gap between tender approval and LOA issuance.

---

### 5. 📝 WO Pending Alert
**Purpose**: Track delays in issuing Work Order (WO) after LOA.

**Trigger Conditions**:
- **Column AC = "Not Started"** (Required)
- **Column Z (LOA Date)** exists and more than 20 days have passed
- **Column AA (WO Date)** is empty (WO not yet issued)

**Alert Display**:
- Shows: `📝 WO Pending for X days`
- Example: `📝 WO Pending for 35 days`

**Use Case**: Ensures timely work order issuance after LOA, preventing project execution delays.

---

## Column Mapping Reference

| Column | Field Name | Purpose |
|--------|------------|---------|
| J | BE Status | Block Estimate status (D/C/G/AA) |
| K | BE G Date | Tracking date when BE sent to Government |
| M | TS Status | Technical Sanction status (D/C/G/TS) |
| N | TS G Date | Tracking date when TS sent to Government |
| P | DTP Status | Detailed Technical Proposal status (D/C/G/DTP) |
| Q | DTP G Date | Tracking date when DTP sent to Government |
| S | Closing Date | Tender closing date |
| W | Proposal Status | Proposal/Tender status (D/C/G/TA/X/OC) |
| X | Proposal G Date | Tracking date when Proposal sent to Government |
| Y | App. Date | Tender Approval Date |
| Z | LOA Date | Letter of Award Date |
| AA | WO Date | Work Order Date |

---

## Alert Hierarchy & Workflow

```
Project Initiation
    ↓
BE Stage → [Stuck at Govt - BE] if at G > 15 days
    ↓
TS Stage → [Stuck at Govt - TS] if at G > 15 days
    ↓
DTP Stage → [Stuck at Govt - DTP] if at G > 15 days
    ↓
Tender Stage → [Tender Opening Missed] if closing date > 15 days
              → [Bid Validity Expiring] if < 30 days left
    ↓
Tender Approval → [Stuck at Govt - Proposal] if at G > 15 days
    ↓
LOA Stage → [LOA Pending] if approval date > 15 days
    ↓
WO Stage → [WO Pending] if LOA date > 20 days
    ↓
Project Execution
```

---

## Data Entry Guidelines

### For Government Tracking Dates (Columns K, N, Q, X):
1. **When to enter**: Immediately when a file is sent to Government (when status changes to 'G')
2. **Format**: DD.MM.YYYY (e.g., 15.03.2024)
3. **Important**: Without these dates, you'll get "No Date Found for Tracking" alerts

### Date Format Examples:
✅ Correct: `15.03.2024`, `01.12.2023`, `28.02.2025`
❌ Incorrect: `15/03/2024`, `2024-03-15`, `15-3-24`

---

## Alert Thresholds Summary

| Alert Type | Threshold | Column Check |
|------------|-----------|--------------|
| Stuck at Govt | > 15 days | K, N, Q, X (based on J, M, P, W status) |
| Tender Opening Missed | > 15 days | S (Closing Date) |
| Bid Validity Expiring | < 30 days remaining (of 120) | S (Closing Date) |
| LOA Pending | > 15 days | Y (App. Date) |
| WO Pending | > 20 days | Z (LOA Date) |

---

## Testing Status

✅ **Implemented and Tested**:
- All 5 alert types are working
- **Column AC = "Not Started" condition applied to all alerts**
- **Alert sorting by priority working correctly**
- Red Alerts count: **56** (filtered for "Not Started" projects only)
- Bid Validity alerts showing first (Priority 1): 6 days, 11 days, 21 days, 24 days remaining
- Stuck at Govt alerts showing second (Priority 2): "No Date Found for Tracking" alerts visible
- Date parsing working correctly for DD.MM.YYYY format

📊 **Current Alert Distribution** (Based on test data):
- **Bid Validity Expiring**: Showing first (most urgent)
- **Stuck at Govt**: Multiple alerts with "No Date Found for Tracking" warnings
- Other alert types: Distribution depends on actual project data in Google Sheet

**Key Improvement**: Alert count reduced from 262 to 56 after adding Column AC filter, providing more focused and actionable alerts.

---

## Future Enhancements

Potential improvements for consideration:
1. **Alert Categorization**: Separate stat cards for each alert type
2. **Priority Levels**: Color-code alerts by severity (15-30 days = yellow, >30 days = red)
3. **Alert History**: Track when alerts were first triggered
4. **Email Notifications**: Automated alerts for critical delays
5. **Export Functionality**: Download alert reports in Excel/PDF format

---

## Technical Implementation Notes

**Files Modified**:
- `/app/frontend/src/App.js` (processData function, metrics calculation, ProjectRow component)

**New Columns Added to Data Model**:
- `BE G Date` (Column K)
- `TS G Date` (Column N)
- `DTP G Date` (Column Q)
- `Proposal G Date` (Column X)

**Alert Badge Display**:
- All alerts show in red destructive badge style
- Emojis used for quick visual identification
- Responsive flex-wrap layout for multiple alerts

---

## User Guide

### How to View Red Alerts:
1. Click on the "Red Alerts" stat card on the dashboard
2. Scroll through the list of projects with active alerts
3. Each project shows:
   - Work name and PAA details
   - Division and current status
   - Alert badge(s) with specific details

### How to Clear Alerts:
- **Stuck at Govt**: Update the status from 'G' to next stage (D/C/AA/TS/DTP/TA)
- **Tender Opening Missed**: Update Proposal Status or take corrective action
- **Bid Validity Expiring**: Expedite tender process or request validity extension
- **LOA Pending**: Issue LOA and enter date in Column Z
- **WO Pending**: Issue WO and enter date in Column AA

---

*Last Updated: March 29, 2026*
*Version: 2.0 - Enhanced Red Alerts System*
