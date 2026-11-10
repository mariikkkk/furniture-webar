import { createAssembly } from './assembly.js'
import { createPreview } from './preview.js'
import { loadArEngine, startAr } from './ar.js'
import { steps } from './steps.js'
import './style.css'

const assembly = createAssembly()
const element = id => document.getElementById(id)
const previewCanvas = element('preview')
const arCanvas = element('ar-view')
const arToggle = element('ar-toggle')
const placeButton = element('place')
const sceneHelp = element('scene-help')
const back = element('back')
const next = element('next')
const replay = element('replay')
const preview = createPreview(previewCanvas, assembly.root)

let step = 0
let animating = false
let engine
let ar

const progress = steps.map(({ label }) => {
  const item = document.createElement('li')
  item.textContent = label
  element('progress').append(item)
  return item
})

function updateInstruction() {
  const { title, text, hardware } = steps[step]
  element('step-number').textContent = step === 0 ? 'ПЕРЕД СБОРКОЙ' : `ШАГ ${step} ИЗ ${steps.length - 1}`
  element('step-title').textContent = title
  element('step-text').textContent = text
  element('hardware').hidden = !hardware
  if (hardware) {
    element('hardware-code').textContent = hardware.code
    element('hardware-text').textContent = hardware.text
  }

  progress.forEach((item, index) => {
    if (index === step) item.setAttribute('aria-current', 'step')
    else item.removeAttribute('aria-current')
  })

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

function closeAr(message = 'Перетаскивайте, чтобы повернуть модель') {
  try {
    ar?.stop()
  } finally {
    ar = undefined
    arCanvas.hidden = true
    previewCanvas.hidden = false
    preview.resume()
    placeButton.hidden = true
    placeButton.disabled = true
    element('scene-label').textContent = '3D-ПРОСМОТР'
    sceneHelp.textContent = message
    arToggle.textContent = 'Открыть в AR'
  }
}

async function toggleAr() {
  if (ar) {
    closeAr()
    return
  }

  if (!window.isSecureContext || !navigator.mediaDevices) {
    sceneHelp.textContent = 'Для AR откройте страницу по HTTPS на телефоне с камерой.'
    return
  }

  if (!engine) {
    arToggle.disabled = true
    sceneHelp.textContent = 'Загружаем AR…'
    try {
      engine = await loadArEngine()
      arToggle.textContent = 'Включить камеру'
      sceneHelp.textContent = 'Нажмите «Включить камеру» и разрешите доступ.'
    } catch (error) {
      sceneHelp.textContent = error.message
    } finally {
      arToggle.disabled = false
    }
    return
  }

  preview.pause()
  previewCanvas.hidden = true
  arCanvas.hidden = false
  placeButton.hidden = false
  sceneHelp.textContent = 'Разрешите доступ к камере'
  element('scene-label').textContent = 'ДОПОЛНЕННАЯ РЕАЛЬНОСТЬ'
  arToggle.textContent = 'Вернуться в 3D'

  try {
    ar = startAr(engine, arCanvas, assembly.root, ready => {
      const message = ready ? 'Поставьте комплект на пол' : 'Наведите камеру на пол и слегка подвигайте телефон'
      if (sceneHelp.textContent !== message) sceneHelp.textContent = message
      placeButton.disabled = !ready
    }, closeAr)
  } catch (error) {
    console.error(error)
    closeAr('Не удалось запустить AR. Можно продолжить в 3D.')
  }
}

arToggle.addEventListener('click', toggleAr)
placeButton.addEventListener('click', () => {
  ar.place()
  placeButton.hidden = true
  sceneHelp.textContent = 'Модель размещена. Выберите шаг сборки.'
})
back.addEventListener('click', () => goToStep(step, step - 1))
next.addEventListener('click', () => goToStep(step, step + 1))
replay.addEventListener('click', () => goToStep(step - 1, step))
updateInstruction()
