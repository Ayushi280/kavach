import axios from 'axios'

// -------- CONFIG --------
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000'
export const DEMO_USER = 'demo_victim'

const client = axios.create({ baseURL: API_BASE, timeout: 15000 })

// -------- GEOLOCATION --------
let cachedCoords = null
let coordsRequested = false

export function requestLocation() {
  if (coordsRequested || !('geolocation' in navigator)) return
  coordsRequested = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      cachedCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
    },
    () => { cachedCoords = null },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
  )
}
export function getCoords() { return cachedCoords }

// -------- MOCK RISK WINDOW (powers the detector → breaker chain in mock mode) --------
const mockRisk = { open: false, until: 0, tactics: [], confidence: 0 }

function openMockRisk(tactics, confidence) {
  mockRisk.open = true
  mockRisk.until = Date.now() + 30 * 60 * 1000 // 30 min window
  mockRisk.tactics = tactics
  mockRisk.confidence = confidence
}
function riskIsOpen() {
  if (mockRisk.open && Date.now() > mockRisk.until) mockRisk.open = false
  return mockRisk.open
}

// -------- TACTIC DETECTION (mock mirror of backend) --------
const TACTIC_PATTERNS = {
  authority: /(cbi|police|पुलिस|सीबीआई|customs|rbi|income tax|court|warrant|officer|कावल्|சிபிஐ|காவல்)/i,
  isolation: /(don'?t tell|do not tell|alone|secret|किसी को मत|akele|video call पर|stay on the call|கூறாதீர்)/i,
  fear: /(arrest|गिरफ्तार|jail|जेल|warrant|suspended|block|கைது|urgent|तुरंत|immediately|last warning)/i,
  money_demand: /(transfer|पैसे|भेजो|pay|payment|upi|account|खाता|otp|ओटीपी|deposit|₹|rs\.?\s?\d)/i,
}
const TACTIC_LABELS = {
  authority: 'Authority impersonation',
  isolation: 'Isolation pressure',
  fear: 'Fear / urgency',
  money_demand: 'Money-transfer demand',
}

export function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi'
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te'
  if (/[\u0980-\u09FF]/.test(text)) return 'bn'
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu'
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa'
  return 'en'
}

function mockCheck(text) {
  const tactics = {
    authority: TACTIC_PATTERNS.authority.test(text),
    isolation: TACTIC_PATTERNS.isolation.test(text),
    fear: TACTIC_PATTERNS.fear.test(text),
    money_demand: TACTIC_PATTERNS.money_demand.test(text),
  }
  const activeKeys = Object.keys(tactics).filter((k) => tactics[k])
  const active_tactics = activeKeys.map((k) => TACTIC_LABELS[k])
  const is_scam = activeKeys.length >= 2
  const progression = Math.min(100, activeKeys.length * 25 + (is_scam ? 10 : 0))
  const confidence = is_scam
    ? Number(Math.min(0.999, 0.82 + activeKeys.length * 0.045).toFixed(3))
    : Number((0.7 + Math.random() * 0.25).toFixed(3))

  if (is_scam) openMockRisk(active_tactics, confidence)

  return {
    is_scam,
    verdict: is_scam ? 'scam' : 'safe',
    confidence,
    scam_probability: confidence,
    tactics,
    active_tactics,
    progression,
    tactic_source: 'keywords',
    risk_window_opened: is_scam,
    language: detectLanguage(text),
  }
}

// -------- ALERTS / STATS / GRAPH mocks (current shapes) --------
const TACTICS_POOL = Object.values(TACTIC_LABELS)
const CITIES = [
  ['Delhi', 'Hindi'], ['Mumbai', 'Marathi'], ['Bengaluru', 'Kannada'],
  ['Chennai', 'Tamil'], ['Hyderabad', 'Telugu'], ['Kolkata', 'Bengali'],
  ['Ahmedabad', 'Gujarati'], ['Pune', 'Marathi'], ['Jaipur', 'Hindi'],
  ['Lucknow', 'Hindi'], ['Kochi', 'Malayalam'], ['Amritsar', 'Punjabi'],
]

function randomAlert(offsetSec = 0) {
  const [location, language] = CITIES[Math.floor(Math.random() * CITIES.length)]
  const shuffled = [...TACTICS_POOL].sort(() => Math.random() - 0.5)
  return {
    id: 'a' + Math.random().toString(36).slice(2, 9),
    user_id: 'u' + Math.random().toString(36).slice(2, 8),
    confidence: Number((0.86 + Math.random() * 0.13).toFixed(3)),
    active_tactics: shuffled.slice(0, 1 + Math.floor(Math.random() * 3)),
    language,
    location,
    time: new Date(Date.now() - offsetSec * 1000).toISOString(),
  }
}
const seededAlerts = Array.from({ length: 12 }, (_, i) => randomAlert(i * 15))

function mockStats() {
  return {
    active_threats: 8 + Math.floor(Math.random() * 6),
    blocked_today: 340 + Math.floor(Math.random() * 20),
    victims_protected: 1240 + Math.floor(Math.random() * 8),
    total_checks: 5230 + Math.floor(Math.random() * 40),
  }
}

function mockFraudGraph() {
  const nodes = [], links = []
  ;['r1', 'r2', 'r3'].forEach((ring, ri) => {
    const scammer = { id: `s${ri}`, label: `+91-98${ri}${ri}XX`, type: 'scammer', ring }
    nodes.push(scammer)
    for (let m = 0; m < 2; m++) {
      nodes.push({ id: `m${ri}${m}`, label: `Acct 48${ri}${m + 1}`, type: 'mule', ring })
      links.push({ source: scammer.id, target: `m${ri}${m}` })
    }
    const vc = 3 + Math.floor(Math.random() * 3)
    for (let v = 0; v < vc; v++) {
      nodes.push({ id: `v${ri}${v}`, label: `Victim ${ri}${v + 1}`, type: 'victim', ring })
      links.push({ source: scammer.id, target: `v${ri}${v}` })
      if (Math.random() > 0.4) links.push({ source: `v${ri}${v}`, target: `m${ri}${v % 2}` })
    }
  })
  links.push({ source: 'm00', target: 's1' })
  links.push({ source: 'm10', target: 's2' })
  return { nodes, links }
}

const MOCK_HONEYPOT = {
  transcript: [
    {
      scammer: 'Sir, this is CBI Mumbai. Your Aadhaar is linked to a narcotics parcel. Pay a verification deposit immediately.',
      honeypot: 'Oh no! Please help me sir. Where do I send the money?',
      extracted: {},
    },
    {
      scammer: 'Transfer ₹49,999 to UPI 9999999999@examplepay right now.',
      honeypot: 'Writing it down… 9999999999@examplepay. And if UPI fails?',
      extracted: { upi_ids: ['9999999999@examplepay'] },
    },
    {
      scammer: 'Then NEFT to account 123456789012, IFSC EXMP0001234. Do not tell anyone.',
      honeypot: 'Account 123456789012. Yes sir, I will not tell anyone.',
      extracted: { account_numbers: ['123456789012'] },
    },
  ],
  extracted: { upi_ids: ['9999999999@examplepay'], account_numbers: ['123456789012'] },
}

// -------- PUBLIC API --------
export async function checkMessage(text, userId = DEMO_USER) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 550))
    return mockCheck(text)
  }
  const coords = getCoords()
  const { data } = await client.post('/check', {
    text,
    user_id: userId,
    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
  })
  return data
}

export async function checkAudio(audioBlob, userId = DEMO_USER) {
  const form = new FormData()
  form.append('file', audioBlob)
  form.append('user_id', userId)
  const coords = getCoords()
  if (coords) {
    form.append('latitude', String(coords.latitude))
    form.append('longitude', String(coords.longitude))
  }
  const { data } = await client.post('/check-audio', form)
  return data
}

export async function paymentIntent({ amount, payee = 'unknown@upi', newPayee = false, userId = DEMO_USER }) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 600))
    if (!riskIsOpen()) return { decision: 'ALLOW', reason: 'No active scam risk detected.', amount }
    if (amount <= 2000 && !newPayee) {
      return {
        decision: 'WARN',
        reason: "You're inside an active scam-risk window. This payment is small enough to proceed, but please confirm it's genuinely yours to make.",
        amount,
        active_tactics: mockRisk.tactics,
        advice: 'If anyone asked you to make this payment during a call, hang up and confirm with family before proceeding.',
      }
    }
    return {
      decision: 'HOLD',
      reason: 'This transfer matches an active scam-call risk window. Kavach has paused it to protect you.',
      cooldown_sec: 30,
      amount,
      active_tactics: mockRisk.tactics,
      advice: 'Real police/CBI never demand money. Call a family member before doing anything.',
    }
  }
  const { data } = await client.post('/payment-intent', {
    user_id: userId, amount, payee, new_payee: newPayee,
  })
  return data
}

export async function riskStatus(userId = DEMO_USER) {
  if (USE_MOCK) {
    if (!riskIsOpen()) return { at_risk: false }
    return {
      at_risk: true,
      reason: 'Active scam-call risk window',
      confidence: mockRisk.confidence,
      active_tactics: mockRisk.tactics,
      seconds_left: Math.max(0, Math.floor((mockRisk.until - Date.now()) / 1000)),
    }
  }
  const { data } = await client.get(`/risk-status/${userId}`)
  return data
}

export async function clearRisk(userId = DEMO_USER) {
  if (USE_MOCK) {
    mockRisk.open = false
    return { risk_open: false }
  }
  const { data } = await client.post(`/clear-risk/${userId}`)
  return data
}

export async function familyAlert({ victimName = "Ramesh's mother", activeTactics = [], confidence = 0.98, victimId = DEMO_USER }) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 700))
    return { sent: true, status_code: 200, mock: true }
  }
  const { data } = await client.post('/family-alert', {
    victim_id: victimId,
    victim_name: victimName,
    active_tactics: activeTactics,
    confidence,
  })
  return data
}

// Returns an object URL for an <audio> element, or null
export async function guardianVoice({ language = 'hi', tactics = { money_demand: true } }) {
  if (USE_MOCK) {
    // Mock: use browser speech synthesis instead of a real MP3
    const msg = language === 'hi'
      ? 'सावधान! यह एक स्कैम कॉल हो सकती है। पैसे मत भेजिए। अपने परिवार से बात कीजिए।'
      : 'Warning! This may be a scam call. Do not send money. Talk to your family first.'
    const u = new SpeechSynthesisUtterance(msg)
    u.lang = language === 'hi' ? 'hi-IN' : 'en-IN'
    window.speechSynthesis.speak(u)
    return null
  }
  const res = await fetch(`${API_BASE}/guardian-voice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, tactics }),
  })
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

export async function honeypotDemo() {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300))
    return MOCK_HONEYPOT
  }
  const { data } = await client.get('/honeypot-demo')
  return data
}

export async function getAlerts() {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 120))
    return seededAlerts
  }
  const { data } = await client.get('/alerts')
  return data
}

export async function reportPhone(detectionId, phone) {
  // Attach the caller's number (user-typed) to a detection so it reaches the
  // Cyber Cell incident list. No-op in mock mode.
  if (USE_MOCK) return { saved: true, mock: true }
  const { data } = await client.post(`/report-phone/${detectionId}`, { scammer_phone: phone })
  return data
}

export async function getStats() {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 100))
    return mockStats()
  }
  const { data } = await client.get('/stats')
  return data
}

export async function getFraudGraph() {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 200))
    return mockFraudGraph()
  }
  const { data } = await client.get('/fraud-graph')
  return data
}

export function _simulateAlert() {
  seededAlerts.unshift(randomAlert(0))
  if (seededAlerts.length > 40) seededAlerts.pop()
}

export const TACTIC_META = [
  { key: 'authority', label: 'Authority' },
  { key: 'isolation', label: 'Isolation' },
  { key: 'fear', label: 'Fear / urgency' },
  { key: 'money_demand', label: 'Money demand' },
]

export const LANGUAGE_NAMES = {
  en: 'English', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', bn: 'Bengali',
  gu: 'Gujarati', kn: 'Kannada', ml: 'Malayalam', pa: 'Punjabi', mr: 'Marathi',
}