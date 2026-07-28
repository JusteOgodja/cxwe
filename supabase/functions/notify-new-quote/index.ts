import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    ?? 'ogodjajusteluc@gmail.com';
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'noreply@redmac.ma';

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const record = (payload.record ?? payload) as Record<string, unknown>;
  const isSample = record.sample_request === true;
  const type = isSample ? 'Demande d\'échantillon' : 'Demande de devis';

  const subject = `[Morocco Food Export] Nouvelle ${type.toLowerCase()} reçue`;

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <h2 style="color:#B91C1C;margin-bottom:8px">📥 ${type}</h2>
      <p style="color:#44403c;font-size:14px;margin-bottom:24px">
        Une nouvelle demande vient d'être soumise sur la plateforme Morocco Food Export.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        ${Object.entries(record)
          .filter(([k]) => !['id','created_at','updated_at','status'].includes(k))
          .map(([k, v]) => v ? `
            <tr>
              <td style="padding:6px 12px 6px 0;color:#78716c;font-weight:600;white-space:nowrap;vertical-align:top">${k.replace(/_/g,' ')}</td>
              <td style="padding:6px 0;color:#1c1917">${String(v)}</td>
            </tr>` : '')
          .join('')}
      </table>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e7e5e4"/>
      <p style="font-size:12px;color:#a8a29e">
        Morocco Food Export · Casablanca, Maroc
      </p>
    </div>
  `;

  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set — email would be:', { subject, to: ADMIN_EMAIL });
    return new Response(JSON.stringify({ ok: true, dry_run: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      subject,
      html,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
});
