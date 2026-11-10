import * as THREE from 'three'
import { AR } from 'js-aruco2'
import { POS } from 'js-aruco2/src/posit1.js'
import { createAssembly, lightScene } from './assembly.js'

const container = document.getElementById('camera')
const viewport = document.getElementById('camera-viewport')
const start = document.getElementById('start')
const status = document.getElementById('status')
const markerId = 42
const markerWidth = 1
const searchMessage = 'Наведите камеру на квадратную метку целиком.'
const foundMessage = 'Метка найдена. Держите все четыре угла в кадре.'

start.addEventListener('click', async () => {
  start.disabled = true
  status.textContent = 'Запускаем камеру…'
  let stream
  let renderer

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } })
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.srcObject = stream
    container.append(video)
    await video.play()

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    container.append(renderer.domElement)
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100)
    const anchor = new THREE.Group()
    anchor.visible = false
    scene.add(anchor)
    lightScene(scene)

    const assembly = createAssembly()
    assembly.showStep(3, 3)
    assembly.root.rotation.x = Math.PI / 2
    assembly.root.scale.setScalar(0.8)
    anchor.add(assembly.root)

    const detector = new AR.Detector({ dictionaryName: 'ARUCO_MIP_36h12', maxHammingDistance: 3 })
    const frame = document.createElement('canvas')
    const context = frame.getContext('2d', { willReadFrequently: true })
    const rotation = new THREE.Matrix4()
    const orientation = new THREE.Quaternion()
    const position = new THREE.Vector3()
    let estimatePose
    let lastScan = -Infinity
    let lastSeen = -Infinity

    function fitCamera() {
      const { videoWidth, videoHeight } = video
      if (!videoWidth || !videoHeight || !viewport.clientWidth || !viewport.clientHeight) return

      const scale = Math.min(viewport.clientWidth / videoWidth, viewport.clientHeight / videoHeight)
      const width = Math.round(videoWidth * scale)
      const height = Math.round(videoHeight * scale)
      container.style.width = `${width}px`
      container.style.height = `${height}px`
      renderer.setSize(width, height, false)

      const scanScale = Math.min(1, 640 / Math.max(videoWidth, videoHeight))
      frame.width = Math.round(videoWidth * scanScale)
      frame.height = Math.round(videoHeight * scanScale)
      const focalLength = Math.max(frame.width, frame.height) * 0.78
      estimatePose = new POS.Posit(markerWidth, focalLength)
      camera.aspect = frame.width / frame.height
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(frame.height / (2 * focalLength)))
      camera.updateProjectionMatrix()
    }

    function draw(time) {
      if (!estimatePose || video.readyState < 2 || time - lastScan < 50) return
      lastScan = time
      context.drawImage(video, 0, 0, frame.width, frame.height)
      const pixels = context.getImageData(0, 0, frame.width, frame.height)
      const marker = detector.detect(pixels).find(candidate => candidate.id === markerId)

      if (marker) {
        const corners = marker.corners.map(({ x, y }) => ({ x: x - frame.width / 2, y: frame.height / 2 - y }))
        const { bestRotation, bestTranslation, bestError } = estimatePose.pose(corners)
        const [x, y, z] = bestTranslation
        if (Number.isFinite(bestError) && bestError >= 0 && bestError <= 5 && Number.isFinite(x + y + z) && z > 0) {
          const [rowX, rowY, rowZ] = bestRotation
          rotation.set(
            rowX[0], rowX[1], -rowX[2], 0,
            rowY[0], rowY[1], -rowY[2], 0,
            -rowZ[0], -rowZ[1], rowZ[2], 0,
            0, 0, 0, 1
          )
          orientation.setFromRotationMatrix(rotation)
          position.set(x, y, -z)
          const blend = anchor.visible ? 0.55 : 1
          anchor.position.lerp(position, blend)
          anchor.quaternion.slerp(orientation, blend)
          lastSeen = time
        }
      }

      const visible = time - lastSeen < 180
      if (visible !== anchor.visible) {
        anchor.visible = visible
        status.textContent = visible ? foundMessage : 'Метка потеряна. Верните её целиком в кадр.'
      }
      renderer.render(scene, camera)
    }

    status.textContent = searchMessage
    start.hidden = true
    fitCamera()
    const observer = new ResizeObserver(fitCamera)
    observer.observe(viewport)
    video.addEventListener('resize', fitCamera)
    renderer.setAnimationLoop(draw)
  } catch (error) {
    console.error(error)
    stream?.getTracks().forEach(track => track.stop())
    renderer?.dispose()
    container.replaceChildren()
    start.disabled = false
    status.textContent = 'Не удалось открыть камеру. Проверьте разрешение браузера и попробуйте снова.'
  }
})
