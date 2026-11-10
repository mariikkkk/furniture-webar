import * as THREE from 'three'
import { lightScene } from './assembly.js'

export function startWebXr(overlay, root, onPlacement, onExit) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.095, 0.115, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffc059, side: THREE.DoubleSide })
  )
  reticle.visible = false
  lightScene(scene)
  scene.add(reticle, root)
  root.visible = false

  let session
  let hitSource
  let stopped = false
  let placed = false

  function dispose() {
    renderer.setAnimationLoop(null)
    renderer.dispose()
    reticle.geometry.dispose()
    reticle.material.dispose()
  }

  function stop() {
    if (stopped) return
    stopped = true
    if (session) session.end().catch(dispose)
  }

  function draw(time, frame) {
    if (!frame) return

    if (!placed) {
      const referenceSpace = renderer.xr.getReferenceSpace()
      const hit = frame.getHitTestResults(hitSource)[0]
      const pose = hit?.getPose(referenceSpace)
      reticle.visible = Boolean(pose)
      if (pose) {
        reticle.position.copy(pose.transform.position)
        reticle.quaternion.copy(pose.transform.orientation)
      }
      onPlacement(reticle.visible)
    }

    renderer.render(scene, camera)
  }

  async function start() {
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'local-floor', 'dom-overlay'],
        domOverlay: { root: overlay }
      })
      session.addEventListener('end', () => {
        queueMicrotask(() => {
          dispose()
          if (!stopped) {
            stopped = true
            onExit()
          }
        })
      }, { once: true })

      if (stopped) {
        await session.end()
        return
      }

      const viewer = await session.requestReferenceSpace('viewer')
      hitSource = await session.requestHitTestSource({ space: viewer })
      if (stopped) return
      await renderer.xr.setSession(session)
      if (!stopped) renderer.setAnimationLoop(draw)
    } catch (error) {
      if (!session) dispose()
      if (stopped) return
      console.error(error)
      onExit('Не удалось открыть WebXR. Проверьте Chrome и сервисы Google Play для AR.')
    }
  }

  start()

  function place() {
    if (!reticle.visible) return false
    root.position.copy(reticle.position)
    const view = renderer.xr.getCamera().position
    root.rotation.y = Math.atan2(view.x - root.position.x, view.z - root.position.z)
    root.visible = true
    placed = true
    reticle.visible = false
    return true
  }

  return { place, stop }
}
