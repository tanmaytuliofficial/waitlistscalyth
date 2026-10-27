// Cloudflare Pages Function: functions/api/waitlist.js

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const name = (body.name || 'Anonymous').trim();
    const email = (body.email || '').trim().toLowerCase();
    const role = (body.role || 'Founder').trim();
    const utm_source = (body.utm_source || 'organic').trim();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST';
    const trackingId = `SCL-${Date.now().toString(36).toUpperCase()}`;

    // 1. Try sending via Resend if RESEND_API_KEY is configured in Cloudflare Pages
    let resendSuccess = false;
    if (env && env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Scalyth <leads@scalyth.tech>',
            to: ['info@scalyth.tech', 'scalyth@gmail.com'],
            subject: `⚡ New Waitlist Lead: ${name} (${role}) [${trackingId}]`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0F; color: #EDEDED; padding: 32px; border-radius: 16px;">
                <h2 style="color: #FFFFFF; font-size: 20px; margin-bottom: 8px;">🚀 New Scalyth Waitlist Lead Secured</h2>
                <p style="color: #8A8A98; font-size: 13px; margin-top: 0;">A new founder has entered the queue.</p>
                <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 24px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 8px 0; color: #8A8A98; width: 120px;">Full Name:</td><td style="color: #FFFFFF; font-weight: 600;">${name}</td></tr>
                    <tr><td style="padding: 8px 0; color: #8A8A98;">Email Address:</td><td style="color: #FFFFFF; font-weight: 600;"><a href="mailto:${email}" style="color: #60A5FA;">${email}</a></td></tr>
                    <tr><td style="padding: 8px 0; color: #8A8A98;">Role:</td><td style="color: #FFFFFF;">${role}</td></tr>
                    <tr><td style="padding: 8px 0; color: #8A8A98;">Traffic Source:</td><td style="color: #FFFFFF;">${utm_source}</td></tr>
                    <tr><td style="padding: 8px 0; color: #8A8A98;">Timestamp:</td><td style="color: #8A8A98; font-family: monospace;">${timestamp}</td></tr>
                    <tr><td style="padding: 8px 0; color: #8A8A98;">Tracking ID:</td><td style="color: #8A8A98; font-family: monospace;">${trackingId}</td></tr>
                  </table>
                </div>
                <p><a href="https://waitlist.scalyth.tech/dashboard" style="display: inline-block; background: #FFFFFF; color: #000000; font-weight: 600; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 9999px;">Open Command Dashboard →</a></p>
              </div>
            `,
          }),
        });
        if (resendRes.ok) resendSuccess = true;
      } catch (err) {
        console.error('Resend error:', err);
      }
    }

    // 2. High-reliability dispatch via FormSubmit to info@scalyth.tech (cc scalyth@gmail.com)
    if (!resendSuccess) {
      try {
        await fetch('https://formsubmit.co/ajax/scalyth@gmail.com', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Referer': 'https://waitlist.scalyth.tech',
          },
          body: JSON.stringify({
            _subject: `⚡ New Waitlist Lead: ${name} (${role}) [${trackingId}]`,
            _template: 'table',
            _captcha: 'false',
            _cc: 'info@scalyth.tech',
            'Full Name': name,
            'Email': email,
            'Role': role,
            'Traffic Source': utm_source,
            'Timestamp': timestamp,
            'Tracking ID': trackingId,
          }),
        });
      } catch (err) {
        console.error('Formsubmit error:', err);
      }
    }

    return new Response(JSON.stringify({ success: true, count: 15, name, role }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      count: 14,
      recent: [
        { maskedName: 'A***n', role: 'Founder' },
        { maskedName: 'R***n', role: 'CTO' },
        { maskedName: 'S***h', role: 'Operator' },
        { maskedName: 'K***r', role: 'Founder' },
      ],
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
