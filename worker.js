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
        
        // Basic honeypot check
        if (body.honeypot) {
          return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
        }

        const { email, name, role, utm_source, utm_medium, utm_campaign, referrer } = body;
        
        if (!email || !email.includes('@')) {
          return new Response(JSON.stringify({ error: 'Invalid email' }), { status: 400, headers: corsHeaders });
        }

        // 1. Check & Insert into Supabase (if configured)
        if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
          const supabaseUrl = `${env.SUPABASE_URL}/rest/v1/waitlist_signups`;
          const supabaseHeaders = {
            'apikey': env.SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          };

          try {
            await fetch(supabaseUrl, {
              method: 'POST',
              headers: supabaseHeaders,
              body: JSON.stringify({
                email, name, role, utm_source, utm_medium, utm_campaign, referrer
              })
            });
          } catch(dbErr) {
            console.error('Supabase error:', dbErr);
          }
        }

        // 2. Dispatch Email Notification directly to info@scalyth.tech & scalyth@gmail.com
        try {
          await fetch('https://formsubmit.co/ajax/scalyth@gmail.com', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Referer': 'https://waitlist.scalyth.tech'
            },
            body: JSON.stringify({
              _subject: `⚡ New Scalyth Waitlist Lead: ${name || email} (${role || 'Member'})`,
              _template: 'table',
              _captcha: 'false',
              _cc: 'info@scalyth.tech',
              'Full Name': name || 'Anonymous',
              'User Email': email,
              'Role': role || 'Member',
              'Traffic Source': utm_source || 'Direct',
              'Submitted At': new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST'
            })
          });
        } catch(mailErr) {
          console.error('Formsubmit error:', mailErr);
        }

        return new Response(JSON.stringify({ success: true, count: 12 }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: corsHeaders });
      }
    }

    // ENDPOINT: GET /api/admin/waitlist (Protected)
    if (request.method === 'GET' && url.pathname === '/api/admin/waitlist') {
      const authHeader = request.headers.get('Authorization');
      if (env.ADMIN_SECRET && authHeader !== `Bearer ${env.ADMIN_SECRET}`) {
        return new Response('Unauthorized', { status: 401, headers: corsHeaders });
      }

      if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
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

      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
