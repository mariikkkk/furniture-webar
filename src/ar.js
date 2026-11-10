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

export function startAr(engine, canvas, root, onPlacement, onError) {
  const ray = new THREE.Raycaster()
  const center = new THREE.Vector2()
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const point = new THREE.Vector3()
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.095, 0.115, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc059, side: THREE.DoubleSide })
  )
  reticle.rotation.x = -Math.PI / 2
  reticle.visible = false

  let camera
  let placed = false
  let stopped = false

  function stop() {
    if (stopped) return
    stopped = true
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
        if (placed || !camera) return

        camera.updateMatrixWorld()
        ray.setFromCamera(center, camera)
        const tracksFloor = processCpuResult?.reality?.trackingStatus === 'NORMAL'
        const hit = tracksFloor && ray.ray.intersectPlane(floor, point)
        const ready = Boolean(hit && point.distanceTo(camera.position) < 4)
        reticle.visible = ready
        if (ready) reticle.position.copy(point).setY(0.005)
        onPlacement(ready)
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
    engine.run({ canvas })
  } catch (error) {
    stop()
    throw error
  }

  function place() {
    if (!reticle.visible) return
    placed = true
    reticle.visible = false
    root.position.copy(reticle.position)
    root.rotation.y = Math.atan2(camera.position.x - root.position.x, camera.position.z - root.position.z)
    root.visible = true
  }

  return { place, stop }
}
