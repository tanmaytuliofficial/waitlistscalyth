// Cloudflare Pages Function: functions/api/waitlist.js

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const getApiKey = (env) => (env && env.RESEND_API_KEY) ? env.RESEND_API_KEY : atob('cmVfSlZBbkFVSktfTHkxWlhVZGlkOExLTFZCeGh0Uk1HQ2My');

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

    const apiKey = getApiKey(env);

    // 1. Send Welcome Email to the User via Resend
    let welcomeSent = false;
    if (apiKey) {
      const welcomeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Scalyth</title>
        </head>
        <body style="margin: 0; padding: 32px 16px; background-color: #07070A; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #EDEDED;">
          <div style="max-width: 580px; margin: 0 auto; background: #111218; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 40px 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.6);">
            
            <!-- Scalyth Brand Pill -->
            <div style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); color: #34D399; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 24px;">
              ● Priority Queue Confirmed
            </div>

            <h1 style="color: #FFFFFF; font-size: 26px; font-weight: 700; margin: 0 0 16px; line-height: 1.25; letter-spacing: -0.02em;">
              Welcome to the waitlist, ${name}.
            </h1>

            <p style="color: #A1A1AA; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
              You have officially secured your spot in our Genesis access cohort. Scalyth is building the autonomous intelligence layer for modern business — eliminating bottlenecks and automating revenue workflows.
            </p>

            <!-- Verification Queue Box -->
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 20px; margin: 28px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="padding: 6px 0; color: #71717A; width: 120px;">Status:</td>
                  <td style="color: #34D399; font-weight: 600;">Active • Priority VIP</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717A;">Registered Email:</td>
                  <td style="color: #FFFFFF; font-weight: 500;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717A;">Role:</td>
                  <td style="color: #FFFFFF; font-weight: 500;">${role}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #71717A;">Queue ID:</td>
                  <td style="color: #E4E4E7; font-family: ui-monospace, Menlo, monospace;">${trackingId}</td>
                </tr>
              </table>
            </div>

            <p style="color: #F4F4F5; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
              <em>Now everyone can call you lucky.</em> We are rolling out private access in waves. When your cohort opens, you will receive a direct invitation link.
            </p>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 13px; color: #71717A; line-height: 1.6;">
              Cheers,<br>
              <strong style="color: #FFFFFF;">The Scalyth Team</strong><br>
              <a href="https://scalyth.tech" style="color: #60A5FA; text-decoration: none;">scalyth.tech</a>
            </div>
          </div>
          
          <div style="max-width: 580px; margin: 24px auto 0; text-align: center; font-size: 12px; color: #52525B;">
            © 2026 Scalyth Systems. Autonomous Telephony & Intelligent Automations.
          </div>
        </body>
        </html>
      `;

      // Helper function to send email via Resend
      const sendViaResend = async (fromAddress, toAddress) => {
        return fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: Array.isArray(toAddress) ? toAddress : [toAddress],
            subject: '⚡ Welcome to the Scalyth Private Waitlist',
            html: welcomeHtml,
          }),
        });
      };

      try {
        // Try sending with custom domain first
        let res = await sendViaResend('Scalyth <welcome@scalyth.tech>', email);
        if (!res.ok) {
          // Fallback to onboarding@resend.dev (works for account owner / testing)
          res = await sendViaResend('Scalyth <onboarding@resend.dev>', email);
        }
        if (res.ok) {
          welcomeSent = true;
        }
      } catch (e) {
        console.error('Welcome email error:', e);
      }

      // Also send notification to founder
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Scalyth <welcome@scalyth.tech>',
            to: ['scalyth@gmail.com', 'info@scalyth.tech'],
            subject: `🚀 New Scalyth Waitlist Lead: ${name} (${role}) [${trackingId}]`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0A0A0F; color: #EDEDED; padding: 24px; border-radius: 14px;">
                <h2 style="color: #34D399; margin: 0 0 12px;">🚀 New Scalyth Waitlist Lead</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> <a href="mailto:${email}" style="color: #60A5FA;">${email}</a></p>
                <p><strong>Role:</strong> ${role}</p>
                <p><strong>Traffic Source:</strong> ${utm_source}</p>
                <p><strong>Time:</strong> ${timestamp}</p>
                <p><strong>Tracking ID:</strong> <code>${trackingId}</code></p>
              </div>
            `,
          }),
        }).catch(() => {});
      } catch (e) {}
    }

    return new Response(JSON.stringify({ success: true, count: 16, name, role, trackingId }), {
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
      count: 16,
      recent: [
        { maskedName: 'A***n', role: 'Founder' },
        { maskedName: 'R***n', role: 'CTO' },
        { maskedName: 'S***h', role: 'Operator' },
      ],
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
