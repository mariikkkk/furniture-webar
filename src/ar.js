import * as THREE from 'three'
import { lightScene } from './assembly.js'

export function loadArEngine() {
  if (window.XR8) return Promise.resolve(window.XR8)

  window.THREE = THREE
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1.0.0/dist/xr.js'
    script.crossOrigin = 'anonymous'
    script.dataset.preloadChunks = 'slam'

    function loaded() {
      clearTimeout(timeout)
      window.removeEventListener('xrloaded', loaded)
      resolve(window.XR8)
    }

    function failed() {
      clearTimeout(timeout)
      window.removeEventListener('xrloaded', loaded)
      script.remove()
      reject(new Error('Не удалось загрузить AR. Проверьте подключение к интернету.'))
    }

    const timeout = setTimeout(failed, 15000)
    script.onerror = failed
    window.addEventListener('xrloaded', loaded)
    document.head.append(script)
  })
}

export function startAr(engine, canvas, root, onPlacement, onError, onTracking) {
  const ray = new THREE.Raycaster()
  const center = new THREE.Vector2()
  const lowerCenter = new THREE.Vector2(0, -0.45)
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const point = new THREE.Vector3()
  const pointInFront = new THREE.Vector3()
  const lastCameraPosition = new THREE.Vector3()
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.095, 0.115, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc059, side: THREE.DoubleSide })
  )
  reticle.rotation.x = -Math.PI / 2
  reticle.visible = false

  let camera
  let placed = false
  let stopped = false
  let canPlaceInFront = false
  let lastFrameTime = 0

  function resizeCanvas() {
    const ratio = Math.min(window.devicePixelRatio, 2)
    const width = Math.round(canvas.clientWidth * ratio)
    const height = Math.round(canvas.clientHeight * ratio)
    if (!width || !height) return
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
  }

  const sizeObserver = new ResizeObserver(resizeCanvas)

  function stop() {
    if (stopped) return
    stopped = true
    sizeObserver.disconnect()
    try {
      engine.stop()
    } finally {
      engine.clearCameraPipelineModules()
      reticle.geometry.dispose()
      reticle.material.dispose()
    }
  }

  function fail(message) {
    requestAnimationFrame(() => {
      if (!stopped) onError(message)
    })
  }

  engine.XrController.configure({ scale: 'absolute' })
  engine.addCameraPipelineModules([
    engine.GlTextureRenderer.pipelineModule(),
    engine.Threejs.pipelineModule(),
    engine.XrController.pipelineModule(),
    {
      name: 'furniture',
      onStart() {
        resizeCanvas()
        const xr = engine.Threejs.xrScene()
        camera = xr.camera
        camera.position.set(0, 1.5, 0)
        lightScene(xr.scene)
        root.visible = false
        xr.scene.add(root, reticle)
        engine.XrController.updateCameraProjectionMatrix({
          origin: camera.position,
          facing: camera.quaternion
        })
      },
      onUpdate({ processCpuResult }) {
        if (!camera) return

        const tracking = processCpuResult?.reality
        const tracksFloor = tracking?.trackingStatus === 'NORMAL'
        const now = performance.now()
        const cameraJumped = lastFrameTime > 0 && now - lastFrameTime < 150
          && lastCameraPosition.distanceTo(camera.position) > 0.45
        lastCameraPosition.copy(camera.position)
        lastFrameTime = now
        if (placed && cameraJumped) {
          placed = false
          root.visible = false
        }
        if (placed) {
          root.visible = tracksFloor
          onTracking(tracksFloor)
          return
        }

        camera.updateMatrixWorld()
        camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert()
        ray.setFromCamera(center, camera)
        canPlaceInFront = tracksFloor && Boolean(tracking?.position)
        if (canPlaceInFront) {
          pointInFront.copy(ray.ray.direction).multiplyScalar(1.6).add(camera.position)
          pointInFront.y -= 0.15
        }
        let ready = false
        if (tracksFloor) {
          const hit = ray.ray.intersectPlane(floor, point)
          ready = Boolean(hit && point.distanceTo(camera.position) < 4)
          if (!ready) {
            ray.setFromCamera(lowerCenter, camera)
            const lowerHit = ray.ray.intersectPlane(floor, point)
            ready = Boolean(lowerHit && point.distanceTo(camera.position) < 4)
          }
        }
        reticle.visible = ready
        if (ready) reticle.position.copy(point).setY(0.005)
        const detail = `Трекинг: ${tracking?.trackingStatus ?? 'нет'}. Пол в пределах 4 м: ${ready ? 'да' : 'нет'}.`
        onPlacement(ready ? 'surface' : canPlaceInFront ? 'manual' : 'waiting', detail)
      },
      onCameraStatusChange({ status }) {
        if (status === 'failed') fail('Камера недоступна. Проверьте разрешение в браузере.')
      },
      onException(error) {
        console.error(error)
        fail('Не удалось запустить AR на этом устройстве. Можно продолжить в 3D.')
      }
    }
  ])

  try {
    resizeCanvas()
    engine.run({ canvas })
    sizeObserver.observe(canvas)
  } catch (error) {
    stop()
    throw error
  }

  function place() {
    if (!reticle.visible && !canPlaceInFront) return false
    placed = true
    root.position.copy(reticle.visible ? reticle.position : pointInFront)
    reticle.visible = false
    root.rotation.y = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z)
    root.visible = true
    return true
  }

  return { place, stop }
}
