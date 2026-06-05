const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const templatesRouter = require('./routes/templates');
const activitiesRouter = require('./routes/activities');
const tasksRouter = require('./routes/tasks');
const reportsRouter = require('./routes/reports');
const googleRouter = require('./routes/google');
const { requireAuth } = require('./middleware/auth');

app.use('/api/auth', authRouter);
// Google router handles auth per-route (callback is public for the OAuth redirect)
app.use('/api/google', googleRouter);
// All data endpoints require auth — middleware sets req.user
app.use('/api/users', requireAuth, usersRouter);
app.use('/api/templates', requireAuth, templatesRouter);
app.use('/api/activities', requireAuth, activitiesRouter);
app.use('/api/tasks', requireAuth, tasksRouter);
app.use('/api/reports', requireAuth, reportsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
