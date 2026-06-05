# Project Structure - Productivity Tracker

## Folder Hierarchy

```
Productivity/
├── README.md                          # Project overview
├── SETUP_GUIDE.md                     # Setup & usage guide
├── PROJECT_STRUCTURE.md               # This file
├── package.json                       # Root package.json
├── .gitignore                         # Git ignore rules
│
├── backend/                           # Express.js Server
│   ├── server.js                      # Main server file
│   ├── database.js                    # SQLite database setup
│   ├── .env                           # Environment variables
│   ├── package.json                   # Backend dependencies
│   │
│   └── routes/                        # API Routes
│       ├── users.js                   # User management API
│       ├── templates.js               # Template management API
│       ├── activities.js              # Activity tracking API
│       ├── handover.js                # Handover reports API
│       └── reports.js                 # Reports & export API
│
└── frontend/                          # React.js Web App
    ├── index.html                     # HTML entry point
    ├── vite.config.js                 # Vite configuration
    ├── package.json                   # Frontend dependencies
    │
    └── src/
        ├── main.jsx                   # React entry point
        ├── App.jsx                    # Main app component
        ├── index.css                  # Global styles
        │
        ├── utils/
        │   └── api.js                 # Axios API client
        │
        └── pages/
            ├── Dashboard.jsx          # Dashboard page
            ├── TemplateManagement.jsx # Template setup page
            ├── DailyTracking.jsx      # Activity input page
            ├── HandoverReports.jsx    # Handover documentation
            ├── Reports.jsx            # Reports & export page
            └── UserManagement.jsx     # User management page
```

## File Descriptions

### Backend Files

#### `server.js`
- Express server setup
- CORS configuration
- Route mounting
- Health check endpoint

#### `database.js`
- SQLite database initialization
- Table creation (users, templates, activities, handovers, etc.)
- Default data seeding (categories, sources)

#### `routes/users.js`
- GET `/api/users` - List all users
- POST `/api/users` - Create new user
- GET `/api/users/categories` - List categories
- POST `/api/users/categories` - Add new category
- GET `/api/users/sources` - List sources
- POST `/api/users/sources` - Add new source

#### `routes/templates.js`
- GET `/api/templates/:teamLeaderId` - Get team leader templates
- POST `/api/templates` - Create template
- PUT `/api/templates/:id` - Update template
- DELETE `/api/templates/:id` - Delete template

#### `routes/activities.js`
- GET `/api/activities` - Query activities
- POST `/api/activities` - Log new activity
- PUT `/api/activities/:id` - Update activity
- DELETE `/api/activities/:id` - Delete activity

#### `routes/handover.js`
- GET `/api/handover/:teamLeaderId` - Get handover reports
- POST `/api/handover` - Create handover report
- PUT `/api/handover/:id` - Update report
- DELETE `/api/handover/:id` - Delete report

#### `routes/reports.js`
- GET `/api/reports/summary` - Get productivity summary
- GET `/api/reports/detailed` - Get detailed activity report
- POST `/api/reports/export` - Export to Excel

### Frontend Files

#### `App.jsx`
- Main application component
- Navigation sidebar
- Page routing logic
- Data loading and management

#### Pages

**Dashboard.jsx**
- Overview of team leader productivity
- Comparison with caretaker on-duty
- Period selection (daily, weekly, monthly)
- Summary statistics

**TemplateManagement.jsx**
- Setup default templates per team leader
- Manage activity categories and sources
- Edit/delete templates
- Add new categories and sources

**DailyTracking.jsx**
- Input daily activities
- Use templates for quick entry
- Manual activity creation
- Daily total minutes calculation

**HandoverReports.jsx**
- Document handover between team leader and caretaker
- Track date, user, and notes
- Date range filtering
- Full audit trail

**Reports.jsx**
- View productivity reports
- Multiple period options
- Detailed activity breakdown
- Excel export functionality

**UserManagement.jsx**
- Create team leaders and caretakers
- View team structure
- Team leader-caretaker relationship management

#### `index.css`
- Global styles
- Layout (sidebar + main content)
- Cards, forms, tables, buttons
- Color scheme and spacing
- Responsive design utilities

#### `utils/api.js`
- Axios instance configuration
- API base URL setup
- Request/response handling

## Database Schema

### Users Table
```sql
id (PK), name, role, team_leader_id (FK), area, email, created_at
```

### Activity Categories Table
```sql
id (PK), name, is_default, created_at
```

### Activity Sources Table
```sql
id (PK), name, created_at
```

### Templates Table
```sql
id (PK), team_leader_id (FK), category_id (FK), duration, source_id (FK), is_default, created_at, updated_at
```

### Daily Activities Table
```sql
id (PK), team_leader_id (FK), on_duty_user_id (FK), activity_date, category_id (FK), duration, source_id (FK), notes, created_at, updated_at
```

### Handover Reports Table
```sql
id (PK), team_leader_id (FK), from_user_id (FK), to_user_id (FK), handover_date, notes, created_at
```

## Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 5.x
- **Database:** SQLite with better-sqlite3
- **File Export:** ExcelJS (xlsx format)
- **Utilities:** date-fns, dotenv, cors

### Frontend
- **Library:** React 19.x
- **Build Tool:** Vite 8.x
- **HTTP Client:** Axios
- **Utilities:** date-fns, clsx

### Development
- **Package Manager:** npm
- **Version Control:** Git

## Key Features

### 1. Multi-Level Template System
- Supervisor sets default templates
- Team leaders can customize per their needs
- Templates include duration and source mapping

### 2. Activity Tracking in Minutes
- Daily log of all activities
- Supports custom activities beyond templates
- Tracks on-duty user (team leader or caretaker)

### 3. Handover Documentation
- Formal handover reports between team leader and caretaker
- Timestamps and detailed notes
- Full audit trail

### 4. Flexible Reporting
- Multiple period options (daily, weekly, monthly, custom)
- Summary and detailed views
- Excel export with 3 sheets (summary, activities, handovers)

### 5. Team Structure Management
- 3 Team Leaders with assigned areas
- 1 Caretaker per Team Leader
- Clear role definitions

## Getting Started

1. **Install dependencies:**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Start backend:**
   ```bash
   cd backend && npm start
   ```

3. **Start frontend (new terminal):**
   ```bash
   cd frontend && npm run dev
   ```

4. **Access application:**
   - Open `http://localhost:3000` in browser
   - Follow SETUP_GUIDE.md for initial setup

## Development Notes

- Database is auto-created on first run
- Default categories are seeded on initialization
- All timestamps use local timezone
- Export format is Excel 2007+ (.xlsx)
- Frontend uses proxy to backend on port 5000

## Future Enhancements

- User authentication & authorization
- Role-based access control
- Real-time notifications
- Mobile app
- Advanced analytics & charts
- Multi-language support
- Database backup/restore
- API documentation (Swagger)
