import { createAssembly, lightScene } from './assembly.js'

const container = document.getElementById('camera')
const start = document.getElementById('start')
const status = document.getElementById('status')
const scanMessage = 'Наведите камеру на метку и держите её в кадре.'

start.addEventListener('click', async () => {
  start.disabled = true
  status.textContent = 'Запускаем камеру…'
  let tracker

  try {
    const { MindARThree } = await import('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-three.prod.js')
    const targetUrl = 'https://cdn.jsdelivr.net/gh/hiukim/mind-ar-js@1.2.5/examples/image-tracking/assets/card-example/card.mind'
    const response = await fetch(targetUrl)
    if (!response.ok) throw new Error('Не загрузились данные метки')
    const target = URL.createObjectURL(await response.blob())

    tracker = new MindARThree({ container, imageTargetSrc: target, uiLoading: 'no', uiScanning: 'no', uiError: 'no' })
    const { renderer, scene, camera } = tracker
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    lightScene(scene)

    const assembly = createAssembly()
    assembly.showStep(3, 3)
    assembly.root.rotation.x = Math.PI / 2
    assembly.root.scale.setScalar(0.48)

    const anchor = tracker.addAnchor(0)
    anchor.group.add(assembly.root)
    anchor.onTargetFound = () => { status.textContent = 'Метка найдена. Обойдите табурет, держа метку в кадре.' }
    anchor.onTargetLost = () => { status.textContent = 'Метка потеряна. Верните её в кадр.' }

    try {
      await tracker.start()
    } finally {
      URL.revokeObjectURL(target)
    }
    if (!anchor.visible) status.textContent = scanMessage
    start.hidden = true
    renderer.setAnimationLoop(() => renderer.render(scene, camera))
  } catch (error) {
    console.error(error)
    tracker?.video?.srcObject?.getTracks().forEach(track => track.stop())
    tracker?.renderer.dispose()
    container.replaceChildren()
    status.textContent = 'Камера или метка не загрузилась. Проверьте разрешение Chrome на доступ к камере и обновите страницу.'
  }
})
