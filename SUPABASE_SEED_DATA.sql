-- ✅ COMPLETE SEED DATA SCRIPT - READY TO COPY & PASTE
-- Run this AFTER SUPABASE_CREATE_TABLES.sql

-- Insert Users
INSERT INTO users (id, name, role, team_leader_id, area, email) VALUES
(1, 'Aan Sayudi', 'supervisor', NULL, 'Jakarta', 'aan.sayudi@majoo.id'),
(4, 'Jhovan Hidayat', 'team_leader', NULL, 'Jabodetabek', 'jhovan@majoo.id'),
(5, 'Rofbi Hidayadi', 'team_leader', NULL, 'Sumkalsulpap', 'rofby.hidayadi@majoo.id'),
(6, 'Ridho Valentin', 'team_leader', NULL, 'Jabalnusra', 'ridho.valentin@majoo.id'),
(7, 'Suro Rahadi', 'caretaker', 4, NULL, 'suro.rahardi@majoo.id'),
(8, 'Taufiq Hadiyanto', 'caretaker', 6, NULL, 'taufiq.hadiyanto@majoo.id'),
(9, 'Rahmat Hidayat', 'caretaker', 5, NULL, 'rahmat.hidayat@majoo.id');

-- Insert Activity Categories
INSERT INTO activity_categories (id, name) VALUES
(8, 'Administrative & CRM Tasks'),
(9, 'Special Projects'),
(10, 'Enterprise'),
(11, 'Manage Teams'),
(16, 'Meet Internal'),
(23, 'Handling Enterprise'),
(24, 'Meet Enterprise'),
(25, 'Coaching Teams'),
(26, 'Assign Leads'),
(27, 'Follow Up Data'),
(28, 'Validasi H+1');

-- Insert Activity Sources
INSERT INTO activity_sources (id, name) VALUES
(6, 'CRM'),
(7, 'Email'),
(8, 'Daily Tasklist'),
(10, 'WhatsApp'),
(13, 'Phone'),
(16, 'Chat System'),
(17, 'Ticket System');
