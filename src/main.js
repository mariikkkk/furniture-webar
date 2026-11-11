import { createAssembly } from './assembly.js'
import { createPreview } from './preview.js'
import { startWebXr } from './webxr.js'
import { setupInstructions } from './instructions.js'
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
showDebug('Диагностика AR включена.')
const preview = createPreview(previewCanvas, assembly.root, element('panel'))

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
setupInstructions(assembly)
prepareAr()
