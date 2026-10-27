const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'waitlist_data.json');
const LOG_FILE = path.join(ROOT, 'emails_dispatched.log');
const NOTIFICATION_EMAIL = 'info@scalyth.tech';

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function readWaitlist() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Error reading waitlist data:', err);
  }
  return [];
}

function saveWaitlist(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving waitlist data:', err);
  }
}

async function sendNotificationEmail(signup) {
  const logEntry = `[${new Date().toISOString()}] EMAIL DISPATCH TO ${NOTIFICATION_EMAIL} & scalyth@gmail.com | Name: ${signup.name} | Email: ${signup.email} | Role: ${signup.role} | Source: ${signup.utm_source}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch(e) {}

  console.log(`\n======================================================`);
  console.log(`>>> 📧 NOTIFICATION DISPATCHED TO: ${NOTIFICATION_EMAIL} & scalyth@gmail.com`);
  console.log(`>>> Subject: 🚀 New Scalyth Waitlist Signup: ${signup.name} (${signup.role})`);
  console.log(`>>> User Email: ${signup.email}`);
  console.log(`>>> Time: ${signup.created_at}`);
  console.log(`======================================================\n`);

  // 1. Dispatch via FormSubmit directly to scalyth@gmail.com and info@scalyth.tech
  try {
    await fetch('https://formsubmit.co/ajax/scalyth@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Referer': 'https://waitlist.scalyth.tech'
      },
      body: JSON.stringify({
        _subject: `⚡ New Scalyth Waitlist Lead: ${signup.name} (${signup.role})`,
        _template: 'table',
        _captcha: 'false',
        _cc: 'info@scalyth.tech',
        'Full Name': signup.name,
        'User Email': signup.email,
        'Role': signup.role,
        'Traffic Source': signup.utm_source,
        'Signup Time': new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST'
      })
    });
    console.log('>>> FormSubmit email dispatch triggered.');
  } catch (err) {
    console.error('>>> FormSubmit dispatch error:', err.message);
  }

  // 2. If RESEND_API_KEY is available in environment
  if (process.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Scalyth Waitlist <noreply@scalyth.tech>',
          to: [NOTIFICATION_EMAIL, 'scalyth@gmail.com'],
          subject: `🚀 New Scalyth Waitlist Signup: ${signup.name} (${signup.role})`,
          html: `
            <h2>New Scalyth Waitlist Signup</h2>
            <p><strong>Name:</strong> ${signup.name}</p>
            <p><strong>Email:</strong> ${signup.email}</p>
            <p><strong>Role:</strong> ${signup.role}</p>
            <p><strong>Source:</strong> ${signup.utm_source}</p>
            <p><strong>Time:</strong> ${signup.created_at}</p>
          `
        })
      });
      console.log('>>> Resend API dispatch successful.');
    } catch(err) {
      console.error('>>> Resend dispatch failed:', err.message);
    }
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ENDPOINT: POST /api/waitlist
  if (req.method === 'POST' && url.pathname === '/api/waitlist') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = (payload.email || '').trim().toLowerCase();
        const name = (payload.name || '').trim();
        const role = (payload.role || '').trim();
        const utm_source = (payload.utm_source || 'organic').trim();

        if (!email || !email.includes('@')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Valid email required' }));
          return;
        }

        const data = readWaitlist();
        let existing = data.find(item => item.email.toLowerCase() === email);

        if (!existing) {
          const newEntry = {
            id: Date.now(),
            name: name || 'Anonymous',
            email: email,
            role: role || 'Member',
            utm_source: utm_source,
            created_at: new Date().toISOString()
          };
          data.unshift(newEntry);
          saveWaitlist(data);

          // Dispatch email to info@scalyth.tech
          await sendNotificationEmail(newEntry);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Spot secured!', 
          count: data.length,
          name: name,
          role: role
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Server error' }));
      }
    });
    return;
  }

  // ENDPOINT: GET /api/waitlist (Count & recent masked for social proof)
  if (req.method === 'GET' && url.pathname === '/api/waitlist') {
    const data = readWaitlist();
    const maskedRecent = data.slice(0, 8).map(item => {
      const n = (item.name || 'Member').trim();
      const maskedName = n.length > 2 ? `${n[0]}***${n[n.length - 1]}` : `${n[0]}*`;
      return {
        maskedName: maskedName,
        role: item.role || 'Operator',
        created_at: item.created_at
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      count: data.length,
      recent: maskedRecent
    }));
    return;
  }

  // ENDPOINT: GET /api/admin/waitlist (For Dashboard)
  if (req.method === 'GET' && url.pathname === '/api/admin/waitlist') {
    const data = readWaitlist();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // ROUTE: /dashboard -> dashboard.html
  if (url.pathname === '/dashboard' || url.pathname === '/dashboard.html') {
    const dashFile = path.join(ROOT, 'dashboard.html');
    if (fs.existsSync(dashFile)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(dashFile).pipe(res);
      return;
    }
  }

  // STATIC FILE SERVING
  let safePath = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  let filePath = path.join(ROOT, safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(ROOT, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading file');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`>>> SCALYTH WAITLIST SERVER LIVE: http://localhost:${PORT}`);
  console.log(`>>> DASHBOARD: http://localhost:${PORT}/dashboard`);
  console.log(`>>> NOTIFICATION DESTINATION: ${NOTIFICATION_EMAIL}`);
  console.log(`======================================================\n`);
});
