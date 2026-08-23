const pool = require('./pool')
const bcrypt = require('bcryptjs')
require('dotenv').config()

async function seed() {
  const client = await pool.connect()
  try {
    // Default admin user — CHANGE PASSWORD after first login!
    const hash = await bcrypt.hash('Admin@ATD2024!', 12)
    await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['ATD Admin', 'admin@atdalliance.co.za', hash, 'admin'])

    // Sample tickets
    const sampleTickets = [
      { ref: 'INC-24081', title: 'MES terminal cannot sync production orders', requester: 'Body Shop - Line 2', cat: 'Application Development', svc: 'MES / Production Apps', pri: 'Critical', status: 'In Progress', owner: 'AppDev Team', site: 'Plant A', sla: 18 },
      { ref: 'INC-24077', title: 'Wi-Fi dropouts affecting handheld scanners', requester: 'Warehouse Operations', cat: 'Infrastructure', svc: 'Network', pri: 'High', status: 'Assigned', owner: 'Infrastructure Team', site: 'Parts Warehouse', sla: 39 },
      { ref: 'REQ-11892', title: 'Create new VPN profile for engineering supplier', requester: 'Engineering Systems', cat: 'Infrastructure', svc: 'Access / Security', pri: 'Medium', status: 'Waiting Approval', owner: 'Security Admin', site: 'HQ', sla: 71 },
      { ref: 'INC-24069', title: 'Warranty claims API returning timeout errors', requester: 'Dealer Support', cat: 'Application Development', svc: 'Integration/API', pri: 'High', status: 'Investigating', owner: 'Integration Squad', site: 'Cloud', sla: 26 },
      { ref: 'REQ-11888', title: 'Install CAD workstation software bundle', requester: 'Product Design', cat: 'Infrastructure', svc: 'End-user Computing', pri: 'Low', status: 'Scheduled', owner: 'Desktop Support', site: 'R&D Centre', sla: 92 },
      { ref: 'CHG-09031', title: 'Deploy supplier portal patch to staging', requester: 'Application Owner', cat: 'Application Development', svc: 'Change Management', pri: 'Medium', status: 'Change Window', owner: 'DevOps', site: 'Azure', sla: 64 },
    ]

   for (const t of sampleTickets) {
  await client.query(`
    INSERT INTO tickets (
      ticket_ref,
      title,
      description,
      requester_id,
      priority,
      status,
      workspace
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT (ticket_ref) DO NOTHING
  `, [
    t.ref,
    t.title,
    "",
    1,
    t.pri,
    t.status,
    "IT"
  ]);
}


    // Asset health
    const assets = [
      { name: 'Core Network', icon: 'Network', status: 'Healthy', score: 98 },
      { name: 'Production Servers', icon: 'Server', status: 'Warning', score: 82 },
      { name: 'MES Applications', icon: 'Factory', status: 'Degraded', score: 76 },
      { name: 'SQL Cluster', icon: 'Database', status: 'Healthy', score: 94 },
    ]
    for (const a of assets) {
      await client.query(`
        INSERT INTO asset_health (name, icon, status, score)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (name) DO UPDATE SET status=$3, score=$4, updated_at=NOW()
      `, [a.name, a.icon, a.status, a.score])
    }

    console.log('✅  Seed complete')
    console.log('   Admin login: admin@atdalliance.co.za / Admin@ATD2024!')
    console.log('   ⚠️   Change this password immediately after first login!')
  } catch (err) {
    console.error('❌  Seed failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
