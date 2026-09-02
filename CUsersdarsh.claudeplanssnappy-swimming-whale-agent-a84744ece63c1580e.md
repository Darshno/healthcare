# Plan: Explore Bed, Hospital, Medicine, and Pharmacy Functionality

## Goal
Identify all functionality related to beds, hospitals, facilities, medicines, and pharmacies. Determine if these are hardcoded or managed via forms/APIs. Specifically find where doctors input hospital name, bed details, and medicine information.

## Steps

### 1. Explore Frontend Input Forms
- [ ] Analyze  and  for bed-related inputs.
- [ ] Analyze  for medicine-related inputs.
- [ ] Search for any other forms where doctors enter hospital/facility names.
- [ ] Check  and  to see if hospital info is collected during onboarding/auth.

### 2. Analyze Backend API Implementation
- [ ] Examine server\modules\facility` (controller, service) to see how facility/hospital data is handled.
- [ ] Check  for API route definitions related to these modules.

### 3. Inspect Data Models and Storage
- [ ] Review  and .
- [ ] Review  for related tables.
- [ ] Check  for client-side type definitions.

### 4. Identify Hardcoded Data
- [ ] Search for static arrays or objects containing hospital names, bed types, or medicine lists in the codebase.
- [ ] Check  or other store files for mock/hardcoded data.

### 5. Synthesize Findings
- [ ] Document all identified forms and APIs.
- [ ] Highlight any hardcoded sections.
- [ ] Specifically answer where the 'hospital name and bed details and stuff and medicine stuff' are entered.

