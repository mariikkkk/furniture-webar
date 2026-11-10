import { createAssembly } from './assembly.js'
import { createPreview } from './preview.js'
import { startWebXr } from './webxr.js'
import { steps } from './steps.js'
import './style.css'

const assembly = createAssembly()
const element = id => document.getElementById(id)
const previewCanvas = element('preview')
const arToggle = element('ar-toggle')
const repositionButton = element('reposition')
const placeButton = element('place')
const sceneHelp = element('scene-help')
const arMode = element('ar-mode')
const instructions = element('instructions')
const debugAr = new URLSearchParams(window.location.search).get('debug') === 'ar'
const arDebug = element('ar-debug')
const back = element('back')
const next = element('next')
const replay = element('replay')
showDebug('Диагностика AR включена.')
const preview = createPreview(previewCanvas, assembly.root, element('panel'))

let step = 0
let animating = false
let ar

function showMessage(message = '') {
  sceneHelp.textContent = message
  sceneHelp.hidden = !message
}

function showDebug(message) {
  if (!debugAr || arDebug.textContent === message) return
  arDebug.textContent = message
  arDebug.hidden = false
}

async function prepareAr() {
  showDebug('Диагностика AR. Проверяем поддержку WebXR.')
  const supported = await navigator.xr?.isSessionSupported('immersive-ar').catch(() => false)
  arToggle.disabled = !supported
  arToggle.textContent = supported ? 'Открыть в AR' : 'AR недоступен'
  arMode.textContent = supported ? 'AR: WebXR' : 'WebXR недоступен. Можно продолжить в 3D.'
  arMode.hidden = false
  showDebug(supported ? 'WebXR доступен. Нажмите «Открыть в AR».' : 'Браузер не предоставил режим immersive-ar.')
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
    previewCanvas.hidden = false
    preview.resume()
    placeButton.hidden = true
    placeButton.disabled = true
    repositionButton.hidden = true
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

  preview.pause()
  previewCanvas.hidden = true
  placeButton.textContent = 'Поставить здесь'
  placeButton.hidden = false
  instructions.hidden = true
  showMessage('Запускаем AR…')
  showDebug('WebXR. Запрашиваем AR-сессию.')
  arToggle.textContent = 'Вернуться в 3D'

  function showPlacement(mode, detail) {
    placeButton.hidden = false
    instructions.hidden = true
    let message = 'Наведите камеру на пол и слегка подвигайте телефон'
    if (mode === 'surface') message = 'Поверхность найдена'
    if (mode === 'manual') message = 'Ищем поверхность. Можно поставить модель перед собой.'
    showDebug(`WebXR. ${detail}`)
    if (sceneHelp.textContent !== message) showMessage(message)
    const label = mode === 'manual' ? 'Поставить перед собой' : 'Поставить здесь'
    if (placeButton.textContent !== label) placeButton.textContent = label
    placeButton.disabled = mode === 'waiting'
  }

  function showTracking(status) {
    let message = ''
    if (status === 'jump') message = 'Положение резко изменилось. Нажмите «Переставить».'
    if (status === 'camera-lost' || status === 'anchor-lost') {
      message = 'Потеряли привязку. Наведите камеру на место установки и задержитесь.'
    }
    if (status === 'recovering') message = 'Восстанавливаем привязку…'
    if (status === 'camera-lost') showDebug('WebXR потерял положение камеры.')
    if (status === 'anchor-lost') showDebug('WebXR видит камеру, но потерял якорь модели.')
    if (sceneHelp.textContent !== message) showMessage(message)
  }

  try {
    ar = startWebXr(element('overlay'), assembly.root, showPlacement, closeAr, showDebug, showTracking)
  } catch (error) {
    console.error(error)
    closeAr('Не удалось запустить AR. Можно продолжить в 3D.')
  }
}

arToggle.addEventListener('click', toggleAr)
placeButton.addEventListener('click', () => {
  if (!ar?.place()) return
  placeButton.hidden = true
  repositionButton.hidden = false
  instructions.hidden = false
  showMessage()
})
repositionButton.addEventListener('click', () => {
  ar.reposition()
  repositionButton.hidden = true
  placeButton.hidden = false
  placeButton.disabled = true
  instructions.hidden = true
  showMessage('Наведите камеру на пол и слегка подвигайте телефон')
})
back.addEventListener('click', () => goToStep(step, step - 1))
next.addEventListener('click', () => goToStep(step, step + 1))
replay.addEventListener('click', () => goToStep(step - 1, step))
updateInstruction()
prepareAr()
