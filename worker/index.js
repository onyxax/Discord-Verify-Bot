// Verify Hydra - Cloudflare Worker Edge Monolith
// Single-file production build. Dual-layer sequential validation.

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (method === 'GET' && path === '/auth') {
        return await serveAuthPage(url, env);
      }

      if (method === 'POST' && path === '/api/request-verification') {
        return await handleRequestVerification(request, env, corsHeaders);
      }

      if (method === 'POST' && path === '/api/callback') {
        return await handleCallback(request, env, corsHeaders);
      }

      return json({ message: 'Not found' }, 404, corsHeaders);
    } catch (err) {
      console.error('[Worker]', err.message);
      return json({ message: 'Internal server error' }, 500, corsHeaders);
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function getBearer(request) {
  const h = request.headers.get('Authorization');
  if (!h || !h.startsWith('Bearer ')) return null;
  return h.slice(7);
}

function supaHeaders(env) {
  return {
    'Content-Type': 'application/json',
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateCaptchaText() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG Captcha Generator
// ─────────────────────────────────────────────────────────────────────────────

function generateCaptchaSVG(text) {
  const width = 200;
  const height = 70;
  const colors = ['#ffffff', '#e0e0e0', '#cccccc', '#bbbbbb', '#dddddd'];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`;
  svg += `<rect width="${width}" height="${height}" fill="#0d0d0d"/>`;

  for (let i = 0; i < 6; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1" opacity="0.4"/>`;
  }

  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const color = colors[Math.floor(Math.random() * colors.length)];
    svg += `<circle cx="${cx}" cy="${cy}" r="1.5" fill="${color}" opacity="0.5"/>`;
  }

  const charWidth = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const x = charWidth * (i + 1);
    const y = 42 + Math.floor(Math.random() * 10) - 5;
    const rotate = Math.floor(Math.random() * 16) - 8;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 22 + Math.floor(Math.random() * 4);
    svg += `<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" fill="${color}" text-anchor="middle" font-weight="bold" transform="rotate(${rotate} ${x} ${y})">${text[i]}</text>`;
  }

  svg += '</svg>';
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Validation (Supabase)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSession(env, token) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/active_sessions?token=eq.${token}&select=*`,
    { method: 'GET', headers: supaHeaders(env) }
  );

  if (!res.ok) return null;
  const sessions = await res.json();
  return sessions && sessions.length > 0 ? sessions[0] : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared CSS - High Contrast Matte Black/White
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;background:#000;color:#ffffff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{max-width:460px;width:100%;padding:40px 32px;background:#0a0a0a;border:2px solid #333;border-radius:0}
.title{font-size:18px;font-weight:700;letter-spacing:4px;color:#ffffff;text-transform:uppercase;text-align:center;margin-bottom:8px}
.subtitle{font-size:11px;color:#888;text-align:center;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px}
.server-tag{font-size:13px;color:#ffffff;text-align:center;margin-bottom:28px;letter-spacing:1px;font-weight:600}
.field{margin-bottom:20px}
.label{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:8px;font-weight:600}
.val{font-size:13px;color:#ffffff;font-family:'Courier New',monospace;padding:12px 16px;background:#111;border:2px solid #333;border-radius:0}
.captcha-wrap{display:flex;justify-content:center;margin:24px 0}
.captcha-img-wrap{margin-bottom:16px;text-align:center}
.captcha-img-wrap img{border:2px solid #333;display:block;margin:0 auto}
.captcha-input{width:100%;padding:14px 16px;background:#111;border:2px solid #333;color:#ffffff;font-family:'Courier New',monospace;font-size:16px;letter-spacing:4px;text-align:center;border-radius:0;outline:none;transition:border-color .15s}
.captcha-input:focus{border-color:#ffffff}
.captcha-input::placeholder{color:#555}
.btn{width:100%;padding:14px 20px;background:#ffffff;color:#000000;border:none;border-radius:0;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .15s}
.btn:hover{background:#e0e0e0}
.btn:disabled{background:#222;color:#555;cursor:not-allowed;border:2px solid #333}
.msg{padding:14px 18px;border-radius:0;font-size:12px;text-align:center;display:none;margin-top:16px;font-weight:600;letter-spacing:0.5px}
.msg.ok{display:block;background:#0a1a0a;border:2px solid #1a5a1a;color:#5aff5a}
.msg.err{display:block;background:#1a0a0a;border:2px solid #5a1a1a;color:#ff5a5a}
.msg.proc{display:block;background:#0a0a1a;border:2px solid #1a1a5a;color:#5a5aff}
.stage-indicator{font-size:11px;color:#ffffff;text-align:center;margin-bottom:20px;letter-spacing:2px;text-transform:uppercase;font-weight:700;padding:10px 0;border-bottom:2px solid #333}
.hidden{display:none!important}
.foot{text-align:center;margin-top:28px;padding-top:16px;border-top:2px solid #222}
.foot span{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:3px;font-weight:600}
`;

const ERROR_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif;background:#000;color:#ffffff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{max-width:460px;width:100%;padding:40px 32px;background:#0a0a0a;border:2px solid #333;border-radius:0;text-align:center}
.title{font-size:16px;font-weight:700;letter-spacing:3px;color:#ff5a5a;text-transform:uppercase;margin-bottom:16px}
.desc{font-size:13px;color:#888;line-height:1.8;margin-bottom:24px}
.line{width:60px;height:2px;background:#333;margin:0 auto 24px}
.foot{text-align:center;margin-top:20px;padding-top:16px;border-top:2px solid #222}
.foot span{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:3px;font-weight:600}
`;

// ─────────────────────────────────────────────────────────────────────────────
// Error Card HTML
// ─────────────────────────────────────────────────────────────────────────────

function serveErrorCard(title, desc) {
  return html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Hydra</title>
<style>${ERROR_CSS}</style>
</head>
<body>
<div class="card">
  <div class="title">${title}</div>
  <div class="line"></div>
  <div class="desc">${desc}</div>
  <div class="foot"><span>Verify Hydra | Access Denied</span></div>
</div>
</body>
</html>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth - Token validation + embedded verification page
// ─────────────────────────────────────────────────────────────────────────────

async function serveAuthPage(url, env) {
  const token = url.searchParams.get('token');

  if (!token) {
    return serveErrorCard('404 - TOKEN NOT FOUND', 'No verification token was provided. Return to Discord and request a new link.');
  }

  const session = await fetchSession(env, token);

  if (!session) {
    return serveErrorCard('404 - TOKEN NOT FOUND', 'This verification token does not exist. Return to Discord and request a new link.');
  }

  if (session.status === 'verified') {
    return serveErrorCard('404 - TOKEN NOT FOUND', 'This token has already been used. Your account is verified. Return to Discord.');
  }

  if (new Date() > new Date(session.expires_at)) {
    return serveErrorCard('404 - TOKEN EXPIRED', 'This verification link has expired. Return to Discord and click "Verify my account" again.');
  }

  const guildName = session.guild_name || 'this server';
  const sitekey = env.HCAPTCHA_SITEKEY || '';

  const hasCaptchaText = !!session.captcha_text;
  const hasHcaptcha = !!sitekey;

  let securityLevel = 'hcaptcha';
  if (hasCaptchaText && hasHcaptcha) securityLevel = 'dual-layer';
  else if (hasCaptchaText) securityLevel = 'image-captcha';

  const captchaImage = hasCaptchaText ? generateCaptchaSVG(session.captcha_text) : '';

  const isDualLayer = securityLevel === 'dual-layer';
  const hcaptchaPassed = session.hcaptcha_passed;
  const showImageCaptcha = isDualLayer ? hcaptchaPassed : securityLevel === 'image-captcha';
  const showHcaptcha = isDualLayer ? !hcaptchaPassed : securityLevel === 'hcaptcha';

  return html(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Verify Hydra</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<div class="card">
  <div class="title">Verify Hydra</div>
  <div class="subtitle">Secure Access Gateway</div>
  <div class="server-tag">${guildName}</div>
  <div class="field">
    <div class="label">Session Token</div>
    <div class="val">${token.substring(0, 16)}...</div>
  </div>

  <div class="stage-indicator" id="stageIndicator">${isDualLayer && !hcaptchaPassed ? 'STAGE 1 OF 2: HCAPTCHA' : isDualLayer ? 'STAGE 2 OF 2: IMAGE CAPTCHA' : ''}</div>

  <div id="hcaptchaSection" class="${showHcaptcha ? '' : 'hidden'}">
    <div class="captcha-wrap" id="cw"></div>
  </div>

  <div id="imageSection" class="${showImageCaptcha ? '' : 'hidden'}">
    <div class="captcha-img-wrap">
      <img src="${captchaImage}" alt="Captcha" width="200" height="70"/>
    </div>
    <div class="field">
      <div class="label">Enter the text shown above</div>
      <input type="text" class="captcha-input" id="captchaInput" placeholder="Enter captcha text" autocomplete="off" spellcheck="false"/>
    </div>
  </div>

  <button class="btn" id="vb" disabled>Complete Verification</button>
  <div class="msg" id="mg"></div>
  <div class="foot"><span>Verify Hydra | Edge Verification</span></div>
</div>
<script>
(function(){
  var t="${token}";
  var sl="${securityLevel}";
  var dl=${isDualLayer};
  var hp=${hcaptchaPassed};
  var vb=document.getElementById("vb");
  var mg=document.getElementById("mg");
  var si=document.getElementById("stageIndicator");
  var hs=document.getElementById("hcaptchaSection");
  var is=document.getElementById("imageSection");
  var cr=null;
  var stage=hp?2:1;

  function sm(x,c){mg.textContent=x;mg.className="msg "+c}
  function updateUI(){
    if(dl){
      if(stage===1){hs.classList.remove("hidden");is.classList.add("hidden");si.textContent="STAGE 1 OF 2: HCAPTCHA"}
      else{hs.classList.add("hidden");is.classList.remove("hidden");si.textContent="STAGE 2 OF 2: IMAGE CAPTCHA"}
    }
  }

  if(sl==="image-captcha"){
    var ci=document.getElementById("captchaInput");
    ci.addEventListener("input",function(){vb.disabled=ci.value.trim().length<1});
  }else if(sl==="hcaptcha"){
    var sk="${sitekey}";
    if(sk){
      var s=document.createElement("script");
      s.src="https://js.hcaptcha.com/1/api.js?render=explicit";
      s.async=true;
      s.onload=function(){
        hcaptcha.render("cw",{sitekey:sk,size:"normal",theme:"dark",callback:function(r){cr=r;vb.disabled=false},"expired-callback":function(){cr=null;vb.disabled=true}});
      };
      document.head.appendChild(s);
    }else{vb.disabled=false}
  }else if(dl){
    var sk="${sitekey}";
    if(sk){
      var s=document.createElement("script");
      s.src="https://js.hcaptcha.com/1/api.js?render=explicit";
      s.async=true;
      s.onload=function(){
        hcaptcha.render("cw",{sitekey:sk,size:"normal",theme:"dark",callback:function(r){cr=r;vb.disabled=false},"expired-callback":function(){cr=null;vb.disabled=true}});
      };
      document.head.appendChild(s);
    }else{stage=2;updateUI();vb.disabled=true}
  }

  vb.onclick=function(){
    vb.disabled=true;
    sm("Processing verification...","proc");
    var payload={token:t};
    if(dl){
      if(stage===1){payload.hcaptcha_token=cr}
      else{payload.image_captcha=document.getElementById("captchaInput").value.trim()}
    }else if(sl==="image-captcha"){
      payload.image_captcha=document.getElementById("captchaInput").value.trim();
    }else{
      payload.hcaptcha_token=cr;
    }
    fetch("/api/callback",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)})
    .then(function(r){return r.json().then(function(d){return{ok:r.ok,data:d}})})
    .then(function(res){
      if(res.ok){
        if(res.data&&res.data.next_stage==="image_captcha"){
          stage=2;cr=null;updateUI();vb.disabled=true;
          var ci=document.getElementById("captchaInput");
          ci.addEventListener("input",function(){vb.disabled=ci.value.trim().length<1});
          sm("hCaptcha passed. Complete the image captcha below.","ok");
        }else{
          sm("Verification complete. You may close this window and return to Discord.","ok");
          vb.style.display="none";
        }
      }else{
        throw new Error(res.data.message||"Verification failed");
      }
    })
    .catch(function(e){
      sm(e.message||"An error occurred","err");
      vb.disabled=false;
    });
  };
})();
</script>
</body>
</html>`);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/request-verification
// ─────────────────────────────────────────────────────────────────────────────

async function handleRequestVerification(request, env, corsHeaders) {
  const key = getBearer(request);
  if (!key || key !== env.INTERNAL_API_KEY) {
    return json({ message: 'Unauthorized' }, 401, corsHeaders);
  }

  const { user_id, guild_id, guild_name, security_level } = await request.json();

  if (!user_id || !guild_id) {
    return json({ message: 'Missing user_id or guild_id' }, 400, corsHeaders);
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const insertData = {
    token,
    user_id,
    guild_id,
    guild_name: guild_name || '',
    hcaptcha_passed: false,
    status: 'pending',
    expires_at: expiresAt,
  };

  if (security_level === 'image-captcha' || security_level === 'dual-layer') {
    insertData.captcha_text = generateCaptchaText();
  }

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/active_sessions`, {
    method: 'POST',
    headers: { ...supaHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify(insertData),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[Worker] Supabase insert:', err);
    return json({ message: 'Failed to create verification session' }, 500, corsHeaders);
  }

  let baseUrl = (env.FRONTEND_BASE_URL || '').trim();
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  return json(
    { verification_url: `${baseUrl}/auth?token=${token}`, expires_at: expiresAt },
    200,
    corsHeaders
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/callback - Sequential dual-layer validation
// ─────────────────────────────────────────────────────────────────────────────

async function handleCallback(request, env, corsHeaders) {
  const { token, hcaptcha_token, image_captcha } = await request.json();

  if (!token) {
    return json({ message: 'Missing token' }, 400, corsHeaders);
  }

  const session = await fetchSession(env, token);

  if (!session) {
    return json({ message: 'Invalid or expired token' }, 404, corsHeaders);
  }

  if (session.status === 'verified') {
    return json({ message: 'Token already used' }, 409, corsHeaders);
  }

  if (new Date() > new Date(session.expires_at)) {
    await patchSession(env, token, 'expired');
    return json({ message: 'Token expired' }, 410, corsHeaders);
  }

  const hasCaptchaText = !!session.captcha_text;
  const sitekey = env.HCAPTCHA_SITEKEY || '';
  const isDualLayer = hasCaptchaText && !!sitekey;
  const isImageOnly = hasCaptchaText && !sitekey;
  const isHcaptchaOnly = !hasCaptchaText && !!sitekey;

  // Dual-Layer: Phase 1 (hCaptcha)
  if (isDualLayer && !session.hcaptcha_passed) {
    if (!hcaptcha_token) {
      return json({ message: 'hCaptcha response required' }, 403, corsHeaders);
    }

    const cRes = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.HCAPTCHA_SECRET,
        response: hcaptcha_token,
        sitekey: env.HCAPTCHA_SITEKEY,
      }),
    });

    const cData = await cRes.json();
    if (!cData.success) {
      return json({ message: 'hCaptcha verification failed' }, 403, corsHeaders);
    }

    await patchSessionField(env, token, 'hcaptcha_passed', true);

    return json({ message: 'hCaptcha passed', next_stage: 'image_captcha' }, 200, corsHeaders);
  }

  // Dual-Layer: Phase 2 (Image Captcha)
  if (isDualLayer && session.hcaptcha_passed) {
    if (!image_captcha) {
      return json({ message: 'Image captcha response required' }, 403, corsHeaders);
    }

    if (image_captcha.trim() !== session.captcha_text) {
      return json({ message: 'Incorrect captcha text' }, 403, corsHeaders);
    }

    await patchSession(env, token, 'verified');
    return json({ message: 'Verification complete' }, 200, corsHeaders);
  }

  // Image-Captcha Only
  if (isImageOnly) {
    if (!image_captcha) {
      return json({ message: 'Captcha response required' }, 403, corsHeaders);
    }

    if (image_captcha.trim() !== session.captcha_text) {
      return json({ message: 'Incorrect captcha text' }, 403, corsHeaders);
    }

    await patchSession(env, token, 'verified');
    return json({ message: 'Verification complete' }, 200, corsHeaders);
  }

  // hCaptcha Only
  if (isHcaptchaOnly || !hasCaptchaText) {
    if (!hcaptcha_token) {
      return json({ message: 'Captcha required' }, 403, corsHeaders);
    }

    const cRes = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.HCAPTCHA_SECRET,
        response: hcaptcha_token,
        sitekey: env.HCAPTCHA_SITEKEY,
      }),
    });

    const cData = await cRes.json();
    if (!cData.success) {
      return json({ message: 'Captcha verification failed' }, 403, corsHeaders);
    }

    await patchSession(env, token, 'verified');
    return json({ message: 'Verification complete' }, 200, corsHeaders);
  }

  return json({ message: 'Invalid security configuration' }, 500, corsHeaders);
}

async function patchSession(env, token, status) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/active_sessions?token=eq.${token}`, {
    method: 'PATCH',
    headers: supaHeaders(env),
    body: JSON.stringify({ status }),
  });
}

async function patchSessionField(env, token, field, value) {
  await fetch(`${env.SUPABASE_URL}/rest/v1/active_sessions?token=eq.${token}`, {
    method: 'PATCH',
    headers: supaHeaders(env),
    body: JSON.stringify({ [field]: value }),
  });
}
