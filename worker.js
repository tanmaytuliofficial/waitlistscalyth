// Cloudflare Worker: worker.js

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // ENDPOINT: POST /api/waitlist
    if (request.method === 'POST' && url.pathname === '/api/waitlist') {
      try {
        const body = await request.json();
        
        // Basic honeypot check (if passed from frontend)
        if (body.honeypot) {
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const { email, name, role, interest, utm_source, utm_medium, utm_campaign, referrer } = body;
        
        if (!email || !email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: corsHeaders });
        }

        // 1. Check & Insert into Supabase
        const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/waitlist_signups`;
        const supabaseHeaders = {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        };

        const insertRes = await fetch(supabaseUrl, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({
            email, name, role, interest, utm_source, utm_medium, utm_campaign, referrer
          })
        });

        // Handle duplicate quietly
        if (insertRes.status === 409) {
          return new Response(JSON.stringify({ success: true, message: 'Already on waitlist.' }), { headers: corsHeaders });
        }

        if (!insertRes.ok) throw new Error('Database insertion failed');

        // 2. Send Email via Resend
        const emailHtml = `
          <h2>🚀 New Scalyth Waitlist Signup</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Name:</strong> ${name || 'N/A'}</p>
          <p><strong>Role:</strong> ${role || 'N/A'}</p>
          <p><strong>Interest:</strong> ${interest || 'N/A'}</p>
          <p><strong>Source:</strong> ${utm_source || 'Direct'}</p>
          <p><strong>Time:</strong> ${new Date().toISOString()}</p>
          <br/>
          <a href="${env.ADMIN_URL}">View Admin Dashboard</a>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Scalyth Waitlist <noreply@scalyth.com>',
            to: env.FOUNDER_EMAIL,
            subject: '🚀 New Scalyth Waitlist Signup',
            html: emailHtml
          })
        });

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: corsHeaders });
      }
    }

    // ENDPOINT: GET /api/admin/waitlist (Protected)
    if (request.method === 'GET' && url.pathname === '/api/admin/waitlist') {
      const authHeader = request.headers.get('Authorization');
      if (authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/waitlist_signups?select=*&order=created_at.desc`;
      const res = await fetch(supabaseUrl, {
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`
        }
      });
      const data = await res.json();
      
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};