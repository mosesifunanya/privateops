/**
 * Scene definitions for the PrivateOps pitch video.
 *
 * Each scene has:
 *   id          - stable filename key
 *   label       - shown in the on-screen chrome
 *   narration   - text handed to the Gemini TTS voice
 *   render()    - returns the HTML for the animated scene
 *
 * The narration is written as a ~2 minute startup pitch: problem, solution,
 * how it works, live demo, architecture, differentiation, privacy model,
 * value and call to action.
 */

export const BRAND = {
  name: 'PrivateOps',
  accent: '#84cc16',
  accentSoft: '#a3e635',
  cyan: '#22d3ee',
  bg: '#04070d',
  panel: '#0b1220',
};

/* ------------------------------------------------------------------ */
/* shared scene chrome                                                 */
/* ------------------------------------------------------------------ */

const baseCss = `
  :root {
    --accent: ${BRAND.accent};
    --accent-soft: ${BRAND.accentSoft};
    --cyan: ${BRAND.cyan};
    --bg: ${BRAND.bg};
    --panel: ${BRAND.panel};
    --muted: #8ea0b8;
    --line: rgba(255,255,255,0.09);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; }
  body {
    background: var(--bg);
    color: #f4f7fb;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .mono { font-family: "SFMono-Regular", ui-monospace, Menlo, Consolas, "Liberation Mono", monospace; }

  /* Ambient background is pre-rendered to bg.png: the big blurred orbs are
     expensive to re-rasterise on every captured frame. */
  .amb {
    position: absolute; inset: 0;
    background-image: url('bg.png');
    background-size: 1920px 1080px;
    background-repeat: no-repeat;
  }

  .scene { position: relative; width: 1920px; height: 1080px; overflow: hidden; }

  /* top-left brand lockup */
  .lockup { position: absolute; top: 54px; left: 76px; display: flex; align-items: center; gap: 16px; z-index: 40; }
  .lockup .mark {
    width: 54px; height: 54px; border-radius: 15px; display: grid; place-items: center;
    background: linear-gradient(150deg, rgba(132,204,22,0.20), rgba(34,211,238,0.08));
    border: 1px solid rgba(132,204,22,0.35); color: var(--accent);
    box-shadow: 0 0 40px rgba(132,204,22,0.20);
  }
  .lockup .name { font-size: 27px; font-weight: 700; letter-spacing: -0.02em; }
  .lockup .sub { font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); margin-top: 3px; }

  .chip {
    display: inline-flex; align-items: center; gap: 10px;
    border: 1px solid rgba(132,204,22,0.30); background: rgba(132,204,22,0.09);
    color: var(--accent-soft); border-radius: 999px; padding: 9px 18px;
    font-size: 14px; font-weight: 650; letter-spacing: 0.14em; text-transform: uppercase;
  }
  .chip .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); }

  h1.huge { font-size: 118px; line-height: 1.03; letter-spacing: -0.035em; font-weight: 730; }
  h1.big  { font-size: 92px;  line-height: 1.06; letter-spacing: -0.03em; font-weight: 720; }
  .lede { font-size: 30px; line-height: 1.55; color: #c3cfdf; font-weight: 420; }
  .kicker { font-size: 20px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-weight: 640; }

  /* footer progress rule */
  .rule { position: absolute; left: 76px; right: 76px; bottom: 62px; height: 3px; background: rgba(255,255,255,0.10); border-radius: 3px; z-index: 40; }
  .rule span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--cyan)); border-radius: 3px; }
  .rule-label { position: absolute; left: 76px; bottom: 78px; font-size: 13px; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,255,255,0.42); z-index: 40; }

  /* animated entrance */
  @keyframes rise { from { opacity: 0; transform: translateY(34px); } to { opacity: 1; transform: none; } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-42px); } to { opacity: 1; transform: none; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(52px) scale(0.985); } to { opacity: 1; transform: none; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes zoomIn { from { transform: scale(1.16); } to { transform: scale(1); } }
  @keyframes drift  { from { transform: translateY(0); } to { transform: translateY(-16px); } }
  @keyframes drawLine { from { stroke-dashoffset: 1400; } to { stroke-dashoffset: 0; } }
  @keyframes pulse { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
  @keyframes sheen { from { background-position: -160% 0; } to { background-position: 260% 0; } }

  .a1 { animation: rise 0.9s cubic-bezier(.22,1,.36,1) both; }
  .a2 { animation: rise 0.9s cubic-bezier(.22,1,.36,1) 0.18s both; }
  .a3 { animation: rise 0.9s cubic-bezier(.22,1,.36,1) 0.36s both; }
  .a4 { animation: rise 0.9s cubic-bezier(.22,1,.36,1) 0.54s both; }
  .a5 { animation: fadeIn 1.1s ease 0.7s both; }
  .zoom { animation: zoomIn 1.5s cubic-bezier(.22,1,.36,1) both; }
  .drift { animation: drift 6s ease-in-out infinite alternate; }
`;

/** Wrap scene markup in the shared shell. */
export function page(body, { progress = 0.1, label = '' } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}</style></head>
  <body>
    <div class="scene">
      <div class="amb"></div>
      <div class="lockup">
        <span class="mark">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.5l7 3.2v6.1c0 4.4-2.9 8.2-7 9.7-4.1-1.5-7-5.3-7-9.7V5.7z"/>
            <path d="M9.2 12.2l2 2 3.6-4"/>
          </svg>
        </span>
        <span>
          <span class="name">${BRAND.name}</span>
          <span class="sub">Privacy infrastructure</span>
        </span>
      </div>
      ${body}
      <div class="rule-label">${label}</div>
      <div class="rule"><span style="width:${Math.round(progress * 100)}%"></span></div>
    </div>
  </body></html>`;
}

/** A framed product screenshot with an animated zoom. */
function frame(src, { w = 1120, h = 640, cls = 'zoom', style = '', caption = '' } = {}) {
  return `<div class="shot-wrap ${cls}" style="width:${w}px;${style}">
    <div class="shot" style="height:${h}px">
      <img src="${src}" alt="">
      <div class="shot-glow"></div>
    </div>
    ${caption ? `<div class="shot-cap">${caption}</div>` : ''}
  </div>`;
}

/** Markup for the shared backdrop that scenes point at via bg.png. */
export function backgroundHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body { margin:0; padding:0; width:1920px; height:1080px; overflow:hidden; background:${BRAND.bg}; }
    .orb { position:absolute; border-radius:50%; filter:blur(90px); }
    .a { width:900px; height:900px; left:-180px; top:-320px; background:rgba(132,204,22,0.16); }
    .b { width:760px; height:760px; right:-160px; bottom:-300px; background:rgba(34,211,238,0.11); }
    .grid { position:absolute; inset:0;
      background-image:linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px);
      background-size:72px 72px;
      mask-image:radial-gradient(circle at 50% 42%, black 8%, transparent 78%);
      -webkit-mask-image:radial-gradient(circle at 50% 42%, black 8%, transparent 78%); }
    .vig { position:absolute; inset:0;
      background:radial-gradient(circle at 50% 45%, transparent 40%, rgba(0,0,0,0.62) 100%); }
  </style></head><body>
    <div class="orb a"></div><div class="orb b"></div>
    <div class="grid"></div><div class="vig"></div>
  </body></html>`;
}

const shotCss = `
  .shot-wrap { position: relative; border-radius: 20px; padding: 1px;
    background: linear-gradient(150deg, rgba(132,204,22,0.45), rgba(34,211,238,0.20), rgba(255,255,255,0.06));
    box-shadow: 0 40px 110px rgba(0,0,0,0.70); }
  .shot { position: relative; overflow: hidden; border-radius: 19px; background: #060a12; }
  .shot img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: top center; }
  .shot-glow { position: absolute; inset: 0; border-radius: 19px;
    background: linear-gradient(120deg, rgba(255,255,255,0.10), transparent 42%);
    pointer-events: none; }
  .shot-cap { margin-top: 14px; font-size: 15px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }
  .browser-bar { display: flex; align-items: center; gap: 10px; padding: 12px 16px;
    background: #0d1523; border-bottom: 1px solid var(--line); }
  .browser-bar i { width: 11px; height: 11px; border-radius: 50%; background: #33415554; display: block; }
  .browser-bar i:nth-child(1) { background: #f87171; } .browser-bar i:nth-child(2) { background: #fbbf24; } .browser-bar i:nth-child(3) { background: #34d399; }
  .url { margin-left: 10px; flex: 1; background: #060a12; border: 1px solid var(--line); border-radius: 9px;
    padding: 8px 14px; font-size: 15px; color: #a9bad0; display: flex; align-items: center; gap: 9px; }
  .url b { color: var(--accent); font-weight: 600; }
`;

export const extraCss = shotCss;

/* ------------------------------------------------------------------ */
/* scenes                                                              */
/* ------------------------------------------------------------------ */

export const SCENES = [
  {
    id: '01-hook',
    label: '01 · The problem space',
    progress: 0.06,
    narration:
      "AI agents are starting to move real money. But every guardrail you give them has to live somewhere — and right now, that somewhere is public.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:flex; align-items:center; padding:0 120px;">
        <div style="max-width:1180px">
          <div class="chip a1"><span class="dot"></span> Midnight Network · Preprod</div>
          <h1 class="huge a2" style="margin-top:34px">
            Verify AI actions.<br>
            <span style="background:linear-gradient(100deg,var(--accent),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent">Keep the rules private.</span>
          </h1>
          <p class="lede a3" style="margin-top:34px; max-width:900px">
            Privacy-preserving authorization where the agent proves it was allowed
            to act — without ever revealing the policy behind the decision.
          </p>
        </div>
      </div>`,
        { progress: 0.06, label: 'PrivateOps · product pitch' },
      ),
  },

  {
    id: '02-problem',
    label: '02 · The problem',
    progress: 0.16,
    narration:
      "Today, authorization means exposure. Spending limits, thresholds, approval policies — they sit in plain text, on a server or on-chain. So the moment you prove an agent was allowed to act, you reveal exactly what it was allowed to do.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:grid; grid-template-columns:600px 1fr; gap:64px; align-items:center; padding:0 110px;">
        <div>
          <div class="kicker a1">The problem</div>
          <h1 class="big a2" style="margin-top:22px">Proving permission<br><span style="color:#fb7185">reveals the rule.</span></h1>
          <p class="lede a3" style="margin-top:28px">
            A spending limit is only a guardrail if it is enforced. But every
            enforcement point today is readable by whoever holds the ledger.
          </p>
        </div>
        <div style="position:relative">
          ${frame('code-contract.png', { w: 1180, h: 520, style: 'margin-left:auto' })}
          <div style="position:absolute; left:-34px; top:96px; display:flex; align-items:center; gap:14px; animation:slideIn .8s ease .9s both">
            <div style="width:4px; height:74px; background:#fb7185; border-radius:4px"></div>
            <div style="background:#1a0d12; border:1px solid rgba(251,113,133,0.45); border-radius:14px; padding:16px 22px; box-shadow:0 20px 50px rgba(0,0,0,.6)">
              <div style="font-size:13px; letter-spacing:.18em; text-transform:uppercase; color:#fb7185; font-weight:700">Exposed</div>
              <div class="mono" style="font-size:19px; margin-top:8px; color:#ffd9de">policyLimit = 500</div>
            </div>
          </div>
        </div>
      </div>`,
        { progress: 0.16, label: '02 · The problem' },
      ),
  },

  {
    id: '03-solution',
    label: '03 · The solution',
    progress: 0.27,
    narration:
      "PrivateOps changes that. It is privacy-preserving authorization built on the Midnight Network. The policy stays private, and only the outcome becomes public.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; padding:0 120px;">
        <div class="kicker a1">The solution</div>
        <h1 class="huge a2" style="margin-top:22px; max-width:1500px">
          A zero-knowledge proof<br>instead of a public policy.
        </h1>
        <div class="a3" style="display:flex; gap:22px; margin-top:60px">
          ${[
            ['Private policy', 'Supplied as witness data', 'lock'],
            ['Local proof', 'Generated in the browser', 'bolt'],
            ['Public result', 'Verifiable on-chain', 'check'],
          ]
            .map(
              ([t, d, icon], i) => `
            <div style="flex:1; background:linear-gradient(160deg,rgba(255,255,255,.05),rgba(255,255,255,.015));
                        border:1px solid var(--line); border-radius:22px; padding:34px 32px; animation:fadeIn .8s ease ${0.5 + i * 0.15}s both">
              <div style="display:flex; justify-content:space-between; align-items:center">
                <span class="mono" style="font-size:15px; color:var(--muted)">0${i + 1}</span>
                <span style="width:46px;height:46px;border-radius:14px;display:grid;place-items:center;background:rgba(132,204,22,.10);border:1px solid rgba(132,204,22,.30);color:var(--accent)">
                  ${icon === 'lock'
                    ? '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>'
                    : icon === 'bolt'
                      ? '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4.5 13.5H11l-1 8.5L19 10h-6.5z"/></svg>'
                      : '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 12.5l5 5 10-11"/></svg>'}
                </span>
              </div>
              <div style="font-size:30px; font-weight:660; margin-top:28px">${t}</div>
              <div style="font-size:21px; color:var(--muted); margin-top:12px; line-height:1.5">${d}</div>
            </div>`,
            )
            .join('')}
        </div>
      </div>`,
        { progress: 0.27, label: '03 · The solution' },
      ),
  },

  {
    id: '04-how',
    label: '04 · How it works',
    progress: 0.40,
    narration:
      "Here's the flow. The agent submits an action amount. The private policy limit is supplied as witness data inside the Compact circuit. The circuit proves one thing: that the action is within the limit, then discloses only the amount and the boolean result.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; padding:0 120px;">
        <div class="kicker a1">How it works</div>
        <h1 class="big a2" style="margin-top:18px">One circuit. Two public values.</h1>

        <div class="a3" style="display:flex; align-items:center; gap:18px; margin-top:56px">
          ${[
            ['Private policy', 'getPolicyLimit()', 'hidden', 'lock'],
            ['authorizeAction()', 'Compact circuit', 'proof', 'shield'],
            ['Public result', 'amount · authorized', 'ledger', 'check'],
          ]
            .map(
              ([t, s, tag, icon], i) => `
            ${i > 0 ? `<div style="flex:0 0 116px; display:flex; align-items:center; justify-content:center">
              <svg width="116" height="26" viewBox="0 0 116 26" fill="none">
                <line x1="0" y1="13" x2="92" y2="13" stroke="rgba(132,204,22,.65)" stroke-width="2" stroke-dasharray="8 8" style="stroke-dasharray:1400;animation:drawLine 1.1s ease ${0.7 + i * 0.3}s both"/>
                <path d="M92 6l12 7-12 7z" fill="rgba(132,204,22,.85)"/>
              </svg></div>` : ''}
            <div style="flex:1; position:relative; border-radius:22px; padding:34px 30px;
                        background:linear-gradient(165deg,rgba(255,255,255,.055),rgba(255,255,255,.012));
                        border:1px solid ${tag === 'hidden' ? 'rgba(251,113,133,.34)' : tag === 'ledger' ? 'rgba(132,204,22,.36)' : 'var(--line)'}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <span style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:${tag === 'hidden' ? 'rgba(251,113,133,.10)' : 'rgba(132,204,22,.10)'};border:1px solid ${tag === 'hidden' ? 'rgba(251,113,133,.30)' : 'rgba(132,204,22,.30)'};color:${tag === 'hidden' ? '#fb7185' : 'var(--accent)'}">
                  ${icon === 'lock'
                    ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>'
                    : icon === 'shield'
                      ? '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.5l7 3.2v6.1c0 4.4-2.9 8.2-7 9.7-4.1-1.5-7-5.3-7-9.7V5.7z"/></svg>'
                      : '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 12.5l5 5 10-11"/></svg>'}
                </span>
                <span class="mono" style="font-size:13px; letter-spacing:.16em; text-transform:uppercase; padding:7px 13px; border-radius:999px;
                    border:1px solid ${tag === 'hidden' ? 'rgba(251,113,133,.34)' : 'rgba(132,204,22,.30)'};
                    color:${tag === 'hidden' ? '#fb7185' : 'var(--accent)'}">${tag}</span>
              </div>
              <div style="font-size:31px; font-weight:660; margin-top:30px">${t}</div>
              <div class="mono" style="font-size:20px; color:var(--muted); margin-top:11px">${s}</div>
            </div>`,
            )
            .join('')}
        </div>

        <p class="lede a4" style="margin-top:52px; max-width:1300px">
          The witness never touches public state — so the threshold is never disclosed.
        </p>
      </div>`,
        { progress: 0.4, label: '04 · How it works' },
      ),
  },

  {
    id: '05-demo',
    label: '05 · Live product demo',
    progress: 0.58,
    kind: 'clip',
    clip: 'live-journey.webm',
    narration:
      "This is the live app, deployed on Vercel. Connect a Midnight-compatible wallet — 1AM, Nocturne, NuFi and others are auto-detected. Enter the action amount, and prove authorization. The proof is generated locally in the browser, and the private policy is never rendered anywhere in the interface.",
    html: () => '',
  },

  {
    id: '06-architecture',
    label: '06 · Architecture',
    progress: 0.70,
    narration:
      "Under the hood, a Next.js front-end talks to Midnight.js on Preprod. One Compact contract, one circuit — authorizeAction — with a single witness, getPolicyLimit, which never touches public state.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:grid; grid-template-columns:1.05fr 1fr; gap:56px; align-items:center; padding:0 110px;">
        <div>
          <div class="kicker a1">Architecture</div>
          <h1 class="big a2" style="margin-top:20px">Browser to ledger,<br>nothing public in between.</h1>
          <div class="a3" style="margin-top:44px; display:flex; flex-direction:column; gap:14px">
            ${[
              ['Next.js · React · TypeScript', 'Front-end and wallet connect'],
              ['Midnight.js providers', 'Proof · private state · indexer'],
              ['Compact contract', 'authorizeAction on Preprod'],
            ]
              .map(
                ([t, d]) => `
              <div style="display:flex; gap:16px; align-items:center; background:rgba(255,255,255,.035); border:1px solid var(--line); border-radius:16px; padding:20px 24px">
                <span style="width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 18px rgba(132,204,22,.9)"></span>
                <div>
                  <div style="font-size:24px; font-weight:640">${t}</div>
                  <div style="font-size:18px; color:var(--muted); margin-top:5px">${d}</div>
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </div>
        <div style="position:relative">
          ${frame('architecture.png', { w: 960, h: 700, style: 'margin-left:auto' })}
          <div style="position:absolute; right:-38px; bottom:44px; animation:slideUp .8s ease .9s both;
                      background:#0a1017; border:1px solid rgba(132,204,22,.34); border-radius:16px; padding:18px 24px; box-shadow:0 24px 60px rgba(0,0,0,.65)">
            <div style="font-size:13px; letter-spacing:.18em; text-transform:uppercase; color:var(--accent); font-weight:700">Witness</div>
            <div class="mono" style="font-size:19px; margin-top:8px; color:#dcecc0">getPolicyLimit()</div>
            <div style="font-size:15px; color:var(--muted); margin-top:6px">never disclosed</div>
          </div>
        </div>
      </div>`,
        { progress: 0.7, label: '06 · Architecture' },
      ),
  },

  {
    id: '07-different',
    label: '07 · Differentiation',
    progress: 0.81,
    narration:
      "What makes this different? Traditional access control proves nothing without exposing the rule. Public on-chain limits stay visible forever. PrivateOps gives you verifiable authorization — a proof others can trust, while the threshold stays hidden.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; padding:0 120px;">
        <div class="kicker a1">Differentiation</div>
        <h1 class="big a2" style="margin-top:18px">Everyone else has to choose.</h1>
        <div class="a3" style="display:grid; grid-template-columns:repeat(3,1fr); gap:24px; margin-top:54px">
          <div style="border:1px solid var(--line); border-radius:22px; padding:36px 32px; background:rgba(255,255,255,.028)">
            <div class="mono" style="font-size:14px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted)">Traditional access control</div>
            <div style="font-size:29px; font-weight:650; margin-top:24px; color:#fb7185">Rule exposed</div>
            <div style="font-size:20px; color:var(--muted); margin-top:14px; line-height:1.55">Anyone who can verify can also read your policy.</div>
          </div>
          <div style="border:1px solid var(--line); border-radius:22px; padding:36px 32px; background:rgba(255,255,255,.028)">
            <div class="mono" style="font-size:14px; letter-spacing:.16em; text-transform:uppercase; color:var(--muted)">Public on-chain limits</div>
            <div style="font-size:29px; font-weight:650; margin-top:24px; color:#fbbf24">Permanent exposure</div>
            <div style="font-size:20px; color:var(--muted); margin-top:14px; line-height:1.55">The threshold is visible to every observer, forever.</div>
          </div>
          <div style="border:1px solid rgba(132,204,22,.42); border-radius:22px; padding:36px 32px;
                      background:linear-gradient(165deg,rgba(132,204,22,.13),rgba(34,211,238,.05));
                      box-shadow:0 30px 90px rgba(132,204,22,.14)">
            <div class="mono" style="font-size:14px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent)">PrivateOps</div>
            <div style="font-size:29px; font-weight:650; margin-top:24px">Verifiable + private</div>
            <div style="font-size:20px; color:#cfe3ae; margin-top:14px; line-height:1.55">Trust the proof. Never need the secret.</div>
          </div>
        </div>
      </div>`,
        { progress: 0.81, label: '07 · Differentiation' },
      ),
  },

  {
    id: '08-privacy',
    label: '08 · Privacy model',
    progress: 0.89,
    narration:
      "And we are precise about it. Public: the network, the contract, the action amount, and the result. Private: the policy itself. It hides the rule, not the transaction.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:center; padding:0 110px;">
        <div>
          <div class="kicker a1">Privacy model</div>
          <h1 class="big a2" style="margin-top:20px">Selective disclosure,<br>stated plainly.</h1>
          <div class="a3" style="display:flex; gap:20px; margin-top:46px">
            <div style="flex:1; border:1px solid rgba(132,204,22,.34); background:rgba(132,204,22,.07); border-radius:20px; padding:28px 26px">
              <div style="font-size:14px; letter-spacing:.18em; text-transform:uppercase; color:var(--accent); font-weight:700">Public</div>
              <ul style="list-style:none; margin-top:20px; display:flex; flex-direction:column; gap:12px; font-size:21px; color:#dbe6f2">
                <li>Midnight Preprod network</li><li>Contract address</li><li>Action amount</li><li>Authorization result</li>
              </ul>
            </div>
            <div style="flex:1; border:1px solid rgba(251,113,133,.34); background:rgba(251,113,133,.06); border-radius:20px; padding:28px 26px">
              <div style="font-size:14px; letter-spacing:.18em; text-transform:uppercase; color:#fb7185; font-weight:700">Private</div>
              <ul style="list-style:none; margin-top:20px; display:flex; flex-direction:column; gap:12px; font-size:21px; color:#f2dde2">
                <li>Policy threshold</li><li>Witness input</li><li>Private state</li><li>Rule behind the proof</li>
              </ul>
            </div>
          </div>
        </div>
        <div style="position:relative">
          ${frame('live-privacy.png', { w: 1120, h: 620, style: 'margin-left:auto' })}
        </div>
      </div>`,
        { progress: 0.89, label: '08 · Privacy model' },
      ),
  },

  {
    id: '09-value',
    label: '09 · Why it matters',
    progress: 0.94,
    narration:
      "That is the primitive agent infrastructure has been missing. You can audit the decision, without ever seeing the secret behind it.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 160px;">
        <div class="kicker a1">Why it matters</div>
        <h1 class="huge a2" style="margin-top:26px; max-width:1560px">
          Auditable decisions.<br><span style="background:linear-gradient(100deg,var(--accent),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent">Invisible secrets.</span>
        </h1>
        <p class="lede a3" style="margin-top:36px; max-width:1150px">
          Compliance, treasury guardrails, delegated agents and machine-to-machine
          payments — any flow that needs a verified rule without leaking the rule.
        </p>
      </div>`,
        { progress: 0.94, label: '09 · Why it matters' },
      ),
  },

  {
    id: '10-cta',
    label: '10 · Try it',
    progress: 1.0,
    narration:
      "PrivateOps. Prove authorization without revealing the private rule behind it. Live on Midnight Preprod — contract, code and live demo are linked in the repository.",
    html: () =>
      page(
        `
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
        <div class="a1" style="width:104px;height:104px;border-radius:30px;display:grid;place-items:center;
             background:linear-gradient(150deg,rgba(132,204,22,.22),rgba(34,211,238,.08));
             border:1px solid rgba(132,204,22,.4); color:var(--accent); box-shadow:0 0 80px rgba(132,204,22,.30)">
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.5l7 3.2v6.1c0 4.4-2.9 8.2-7 9.7-4.1-1.5-7-5.3-7-9.7V5.7z"/><path d="M9.2 12.2l2 2 3.6-4"/>
          </svg>
        </div>
        <h1 class="big a2" style="margin-top:38px">PrivateOps</h1>
        <p class="lede a3" style="margin-top:22px; max-width:1150px">
          Prove authorization without revealing the private rule behind it.
        </p>
        <div class="a4" style="display:flex; gap:16px; margin-top:44px; align-items:center">
          <span class="chip"><span class="dot"></span> Live on Preprod</span>
          <span class="chip" style="border-color:rgba(34,211,238,.32); background:rgba(34,211,238,.08); color:#a5eefb">Deployed on Vercel</span>
        </div>
        <div class="a5 mono" style="margin-top:40px; font-size:19px; color:var(--muted)">github.com/mosesifunanya/privateops</div>
      </div>`,
        { progress: 1, label: '10 · Try it' },
      ),
  },
];

export const TOTAL_NARRATION_WORDS = SCENES.reduce(
  (n, s) => n + s.narration.split(/\s+/).length,
  0,
);
