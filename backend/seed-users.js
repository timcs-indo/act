const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const db = new Database(path.join(__dirname, 'productivity.db'));
db.pragma('foreign_keys = ON');

// Password hashing function (same as in database.js)
function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Check and create users
try {
  // Check if users exist
  const existingUsers = db.prepare('SELECT id, name, email, role FROM users').all();
  console.log(`Current users in database: ${existingUsers.length}`);
  existingUsers.forEach(u => {
    console.log(`  - ${u.name} (${u.email}) - ${u.role}`);
  });

  // Create default users if they don't exist
  const defaultUsers = [
    {
      name: 'Aan Sayudi',
      email: 'aan.sayudi@majoo.id',
      role: 'supervisor',
      area: 'Jakarta'
    },
    {
      name: 'Team Leader 1',
      email: 'teamleader1@majoo.id',
      role: 'team_leader',
      team_leader_id: null,
      area: 'Jakarta'
    },
    {
      name: 'Caretaker 1',
      email: 'caretaker1@majoo.id',
      role: 'caretaker',
      team_leader_id: 2, // Will reference TL1
      area: 'Jakarta'
    }
  ];

  // Create supervisor first
  const supervisorEmail = defaultUsers[0].email.toLowerCase().trim();
  const checkUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(supervisorEmail);
  
  if (!checkUser) {
    console.log('\n📝 Creating default users...');
    
    // Insert supervisor
    const supervisorResult = db.prepare(`
      INSERT INTO users (name, email, role, area, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      defaultUsers[0].name,
      supervisorEmail,
      defaultUsers[0].role,
      defaultUsers[0].area,
      hashPassword('122333')
    );
    console.log(`✅ Created supervisor: ${defaultUsers[0].name} (ID: ${supervisorResult.lastInsertRowid})`);

    // Insert team leader
    const tlResult = db.prepare(`
      INSERT INTO users (name, email, role, area, password_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      defaultUsers[1].name,
      defaultUsers[1].email.toLowerCase().trim(),
      defaultUsers[1].role,
      defaultUsers[1].area,
      hashPassword('122333')
    );
    console.log(`✅ Created team leader: ${defaultUsers[1].name} (ID: ${tlResult.lastInsertRowid})`);

    // Insert caretaker
    const ctResult = db.prepare(`
      INSERT INTO users (name, email, role, team_leader_id, area, password_hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      defaultUsers[2].name,
      defaultUsers[2].email.toLowerCase().trim(),
      defaultUsers[2].role,
      tlResult.lastInsertRowid, // Reference the team leader we just created
      defaultUsers[2].area,
      hashPassword('122333')
    );
    console.log(`✅ Created caretaker: ${defaultUsers[2].name} (ID: ${ctResult.lastInsertRowid})`);

    console.log('\n✅ Default users created successfully!');
    console.log('\nYou can now login with:');
    console.log('  Email: aan.sayudi@majoo.id');
    console.log('  Password: 122333');
  } else {
    console.log(`\n✅ User already exists: ${supervisorEmail}`);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

db.close();
