# PresentSir – AttendAlert

A responsive attendance tracking and early-warning mini-project built with HTML, CSS, JavaScript, Node.js and Express. Data is stored in `data/db.json` so changes persist between runs.

## Features
- Faculty dashboard with Safe (>=75%), Warning (65–74%) and Critical (<65%) risk tiers.
- 30 seeded engineering students and five subjects.
- Attendance register with Present / Absent / Late options and Mark All Present.
- Live percentage and shortage calculations.
- Recovery estimator using `ceil((0.75 × totalHeld − attended) / 0.25)`.
- Risk filters, at-risk student list and mentor intervention notes.
- Student self-service dashboard preview.
- Simulated notification generation (does not send real email).
- Medical leave demo workflow (approved classes are removed from the held-class denominator).
- CSV import and attendance report export.
- Subject-wise attendance/marks scatter plot.
- Responsive desktop, tablet and mobile layout.

## Requirements
- Node.js 18 or newer
- Visual Studio Code

## Run in VS Code
1. Extract `PresentSir_AttendAlert.zip`.
2. Open Visual Studio Code.
3. Select **File → Open Folder** and choose `PresentSir_AttendAlert`.
4. Open **Terminal → New Terminal**.
5. Run `npm install` (internet is required the first time to install Express).
6. Run `npm start`.
7. Open `http://localhost:3000` in Chrome or another browser.

To stop the server, press `Ctrl + C` in the terminal.

## CSV import format
Use a CSV with these columns (header names are case-sensitive):
```csv
rollNo,subject,held,attended
26MVCSDR0001,Data Structures,20,16
26MVCSDR0002,Mathematics,22,19
```
The importer updates existing student/subject records. Student roll numbers and subject names must match the seeded data. Exported reports contain all student/subject combinations.

## Project structure
```text
PresentSir_AttendAlert/
├── data/
│   └── db.json             # Seed data and persistent demo records
├── public/
│   ├── index.html          # Application pages and UI structure
│   ├── styles.css          # Responsive design, components and animations
│   └── app.js              # UI logic, charts and API integration
├── package.json            # Dependencies and run scripts
├── server.js               # Express REST API and JSON persistence
└── README.md               # Setup and usage guide
```

## Demo notes
- The app uses sample data and is intended for a college mini-project demonstration.
- The notification hub creates simulated alert records only; it does not send real emails.
- The medical leave feature is a simplified demo workflow and does not verify uploaded certificates.
- For a production deployment, add authentication, role-based authorization, secure database storage, audit logs, file validation and a real email provider.
