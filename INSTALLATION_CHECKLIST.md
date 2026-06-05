# Installation & Setup Checklist

## ✅ Pre-requisites
- [ ] Node.js v14+ installed
- [ ] npm installed  
- [ ] Internet connection for npm packages

## ✅ Installation Steps

### Step 1: Install Dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```
- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed

### Step 2: Verify Files
All required files should exist:
```
✓ backend/server.js
✓ backend/database.js
✓ backend/.env
✓ backend/routes/users.js
✓ backend/routes/templates.js
✓ backend/routes/activities.js
✓ backend/routes/handover.js
✓ backend/routes/reports.js
✓ frontend/index.html
✓ frontend/vite.config.js
✓ frontend/src/App.jsx
✓ frontend/src/main.jsx
✓ frontend/src/index.css
✓ frontend/src/utils/api.js
✓ frontend/src/pages/Dashboard.jsx
✓ frontend/src/pages/TemplateManagement.jsx
✓ frontend/src/pages/DailyTracking.jsx
✓ frontend/src/pages/HandoverReports.jsx
✓ frontend/src/pages/Reports.jsx
✓ frontend/src/pages/UserManagement.jsx
✓ README.md
✓ SETUP_GUIDE.md
✓ PROJECT_STRUCTURE.md
```
- [ ] All files present

### Step 3: Start Backend

Terminal 1:
```bash
cd backend
npm start
```

Expected output:
```
Server running on http://localhost:5000
Database initialized successfully
```

- [ ] Server started on port 5000
- [ ] Database initialized
- [ ] No error messages

### Step 4: Start Frontend

Terminal 2:
```bash
cd frontend
npm run dev
```

Expected output:
```
Local:   http://localhost:3000/
```

- [ ] Vite dev server started on port 3000
- [ ] No error messages
- [ ] Browser auto-opens to http://localhost:3000

## ✅ Initial Data Setup

### Step 1: Add Users (via UI)

Go to **Manajemen User** and add:

**Team Leaders:**
- [ ] Jhovan Hidayat (Jabodetabek)
- [ ] Ridho Valentin (Jabalnusra)
- [ ] Rofby Hidayari (Sumkalsulpap)

**Caretakers:**
- [ ] Suro Rahadi → assigned to Jhovan
- [ ] Taufiq Hadiyanto → assigned to Ridho
- [ ] Rahmat Hidayat → assigned to Rofby

### Step 2: Setup Templates

Go to **Template Aktivitas** for each team leader and add:

- [ ] Handling Enterprise (60 min)
- [ ] Meet Enterprise (45 min)
- [ ] Coaching Teams (30 min)
- [ ] Assign Leads (20 min)
- [ ] Meet Internal (30 min)
- [ ] Follow Up Data (45 min)
- [ ] Validasi H+1 (15 min)

### Step 3: Test Activity Input

Go to **Input Aktivitas**:
- [ ] Can select team leader
- [ ] Can select date
- [ ] Can add activity manually
- [ ] Template buttons appear
- [ ] Can use template for quick entry

### Step 4: Test Handover

Go to **Handover Report**:
- [ ] Can select team leader
- [ ] Can add handover report
- [ ] From/To user selection works
- [ ] Notes field accepts text

### Step 5: Test Reports

Go to **Laporan Produktivitas**:
- [ ] Can select team leader
- [ ] Period selection works
- [ ] Summary displays correctly
- [ ] Can view detailed activities
- [ ] **Export to Excel works** (key feature)

## ✅ Verification Tests

### Backend API Tests

Test with curl or Postman:

```bash
# Health check
curl http://localhost:5000/api/health

# Get users
curl http://localhost:5000/api/users

# Get categories
curl http://localhost:5000/api/users/categories

# Get sources
curl http://localhost:5000/api/users/sources
```

- [ ] All endpoints return 200 OK
- [ ] Data structure correct

### Frontend UI Tests

In browser (http://localhost:3000):

- [ ] Sidebar navigation works
- [ ] Can switch between pages
- [ ] Forms submit without errors
- [ ] Tables display data correctly
- [ ] Dropdowns populate with data
- [ ] Date pickers work
- [ ] Export button downloads Excel file
- [ ] Responsive on different window sizes

## ✅ Excel Export Test

1. Go to **Laporan Produktivitas**
2. Select a team leader
3. Click **📥 Export ke Excel**
4. Verify downloaded file:
   - [ ] Filename correct format
   - [ ] Contains 3 sheets: Ringkasan, Aktivitas Harian, Handover Report
   - [ ] Data matches on-screen display
   - [ ] Formatting readable
   - [ ] Numbers properly formatted

## ✅ Common Issues & Solutions

### Backend won't start
```
ERROR: Port 5000 already in use
Solution: Kill process on port 5000 or change PORT in .env
```
- [ ] Resolved if applicable

### Database errors
```
ERROR: database locked
Solution: Restart backend, delete productivity.db and restart
```
- [ ] Resolved if applicable

### Frontend can't connect to backend
```
Error: Cannot GET /api/...
Solution: Ensure backend is running on http://localhost:5000
```
- [ ] Backend running and accessible

### CORS errors
```
Access to XMLHttpRequest blocked by CORS policy
Solution: CORS already configured in Express
```
- [ ] No CORS errors in console

## ✅ Final Checklist

### Functionality
- [ ] Dashboard shows productivity data
- [ ] Templates can be created and edited
- [ ] Daily activities can be logged
- [ ] Handover reports can be documented
- [ ] Reports can be generated
- [ ] Excel export works
- [ ] User management works
- [ ] Multiple team leaders can be managed

### Performance
- [ ] Page loads < 2 seconds
- [ ] No console errors
- [ ] Database operations responsive
- [ ] Export completes < 5 seconds

### Data Integrity
- [ ] Team leader-caretaker relationships correct
- [ ] Activities linked to correct team leader
- [ ] Date filtering works correctly
- [ ] Total calculations accurate

### Ready for Production
- [ ] All features tested
- [ ] No critical bugs
- [ ] Documentation complete
- [ ] Setup guide available
- [ ] User can follow SETUP_GUIDE.md independently

## 📝 Sign-off

- [ ] All checklist items completed
- [ ] Application ready for use
- [ ] Team has access to documentation

**Date Completed:** _______________
**Verified By:** _______________

---

## 🚀 What's Next?

1. Train team on using the application
2. Start logging actual activities
3. Generate weekly reports
4. Review productivity trends
5. Adjust templates as needed
6. Consider future enhancements based on usage

For questions, refer to:
- SETUP_GUIDE.md for usage details
- PROJECT_STRUCTURE.md for technical details
- README.md for overview
