import { createAssembly } from './assembly.js'
import { createPreview } from './preview.js'
import { loadArEngine, startAr } from './ar.js'
import { startWebXr } from './webxr.js'
import { steps } from './steps.js'
import './style.css'

const assembly = createAssembly()
const element = id => document.getElementById(id)
const previewCanvas = element('preview')
const arCanvas = element('ar-view')
const arToggle = element('ar-toggle')
const placeButton = element('place')
const sceneHelp = element('scene-help')
const instructions = element('instructions')
const debugAr = new URLSearchParams(window.location.search).get('debug') === 'ar'
const back = element('back')
const next = element('next')
const replay = element('replay')
const preview = createPreview(previewCanvas, assembly.root, element('panel'))

let step = 0
let animating = false
let engine
let ar
let useWebXr = false

function showMessage(message = '') {
  sceneHelp.textContent = message
  sceneHelp.hidden = !message
}

async function prepareAr() {
  arToggle.disabled = true
  arToggle.textContent = 'Загрузка AR…'
  try {
    useWebXr = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false) ?? false
    if (!useWebXr) engine = await loadArEngine()
    arToggle.textContent = 'Открыть в AR'
    showMessage()
  } catch (error) {
    arToggle.textContent = 'Повторить загрузку AR'
    showMessage(error.message)
  } finally {
    arToggle.disabled = false
  }
}

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

function closeAr(message) {
  try {
    ar?.stop()
  } finally {
    ar = undefined
    arCanvas.hidden = true
    previewCanvas.hidden = false
    preview.resume()
    placeButton.hidden = true
    placeButton.disabled = true
    instructions.hidden = false
    showMessage(message)
    arToggle.textContent = 'Открыть в AR'
  }
}

function toggleAr() {
  if (ar) {
    closeAr()
    return
  }

  if (!window.isSecureContext || (!useWebXr && !navigator.mediaDevices)) {
    showMessage('Для AR откройте страницу по HTTPS на телефоне с камерой.')
    return
  }

  if (!useWebXr && !engine) {
    prepareAr()
    return
  }

  preview.pause()
  previewCanvas.hidden = true
  arCanvas.hidden = useWebXr
  placeButton.textContent = 'Поставить здесь'
  placeButton.hidden = false
  instructions.hidden = true
  showMessage('Запускаем AR…')
  arToggle.textContent = 'Вернуться в 3D'

  function showPlacement(mode, detail) {
    let message = 'Наведите камеру на пол и слегка подвигайте телефон'
    if (mode === 'surface') message = 'Поверхность найдена'
    if (mode === 'manual') message = 'Ищем поверхность. Можно поставить модель перед собой.'
    if (debugAr) message += ` | ${useWebXr ? 'WebXR' : '8th Wall'}. ${detail}`
    if (sceneHelp.textContent !== message) showMessage(message)
    const label = mode === 'manual' ? 'Поставить перед собой' : 'Поставить здесь'
    if (placeButton.textContent !== label) placeButton.textContent = label
    placeButton.disabled = mode === 'waiting'
  }

  try {
    ar = useWebXr
      ? startWebXr(document.querySelector('.app'), assembly.root, showPlacement, closeAr)
      : startAr(engine, arCanvas, assembly.root, showPlacement, closeAr)
  } catch (error) {
    console.error(error)
    closeAr('Не удалось запустить AR. Можно продолжить в 3D.')
  }
}

arToggle.addEventListener('click', toggleAr)
placeButton.addEventListener('click', () => {
  if (!ar?.place()) return
  placeButton.hidden = true
  instructions.hidden = false
  showMessage()
})
back.addEventListener('click', () => goToStep(step, step - 1))
next.addEventListener('click', () => goToStep(step, step + 1))
replay.addEventListener('click', () => goToStep(step - 1, step))
updateInstruction()
if (window.isSecureContext && (navigator.xr || navigator.mediaDevices)) prepareAr()
