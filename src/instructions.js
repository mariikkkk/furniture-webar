import { steps } from './steps.js'

export function setupInstructions(assembly) {
  const element = id => document.getElementById(id)
  const back = element('back')
  const next = element('next')
  const replay = element('replay')
  let step = 0
  let animating = false

  function updateInstruction() {
    const { title, text, hardware } = steps[step]
    element('step-number').textContent = step === 0 ? 'Перед сборкой' : `Шаг ${step} из ${steps.length - 1}`
    element('step-title').textContent = title
    element('step-text').textContent = text
    element('hardware').hidden = !hardware
    if (hardware) {
      element('hardware-code').textContent = hardware.code
      element('hardware-text').textContent = hardware.text
    }

    back.disabled = animating || step === 0
    replay.disabled = animating || step === 0
    next.disabled = animating || step === steps.length - 1
  }

  function goToStep(from, to) {
    step = to
    animating = true
    updateInstruction()

    const start = performance.now()
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1400

    function draw(now) {
      const progress = duration ? Math.min(1, (now - start) / duration) : 1
      assembly.showStep(from + (to - from) * progress, step)

      if (progress < 1) {
        requestAnimationFrame(draw)
      } else {
        animating = false
        updateInstruction()
      }
    }

    assembly.showStep(from, step)
    requestAnimationFrame(draw)
  }

  back.addEventListener('click', () => goToStep(step, step - 1))
  next.addEventListener('click', () => goToStep(step, step + 1))
  replay.addEventListener('click', () => goToStep(step - 1, step))
  updateInstruction()
}
