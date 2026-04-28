const FIRE_CRACKLE_KEY = 'ember_fire_crackle'

export function isFireCrackleEnabled() {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(FIRE_CRACKLE_KEY) === 'true'
}

export function playFireCrackle() {
  if (!isFireCrackleEnabled()) return
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const duration = 0.4
    const sampleCount = Math.floor(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer

    const lowPass = ctx.createBiquadFilter()
    lowPass.type = 'lowpass'
    lowPass.frequency.value = 1800

    const gain = ctx.createGain()
    const now = ctx.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)

    source.connect(lowPass)
    lowPass.connect(gain)
    gain.connect(ctx.destination)
    source.start(now)
    source.stop(now + duration)
  } catch {}
}
