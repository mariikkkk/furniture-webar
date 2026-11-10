import * as THREE from 'three'
import { lightScene } from './assembly.js'

export function startWebXr(overlay, root, onPlacement, onExit, onStatus) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local')

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const viewPosition = new THREE.Vector3()
  const pointInFront = new THREE.Vector3()
  const surfaceNormal = new THREE.Vector3()
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
  let lowerHitSource
  let stopped = false
  let placed = false
  let canPlaceInFront = false

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
      const viewer = frame.getViewerPose(referenceSpace)
      canPlaceInFront = Boolean(viewer)
      if (viewer) {
        viewPosition.copy(viewer.transform.position)
        pointInFront.set(0, 0, -1.6).applyQuaternion(viewer.transform.orientation)
        pointInFront.add(viewPosition).y -= 0.15
      }

      const hits = frame.getHitTestResults(hitSource)
      const lowerHits = lowerHitSource ? frame.getHitTestResults(lowerHitSource) : []
      const poses = [...hits, ...lowerHits].map(hit => hit.getPose(referenceSpace))
      const pose = poses.find(candidate => {
        if (!candidate) return false
        return surfaceNormal.set(0, 1, 0).applyQuaternion(candidate.transform.orientation).y > 0.85
      })
      reticle.visible = Boolean(pose)
      if (pose) {
        reticle.position.copy(pose.transform.position)
        reticle.quaternion.copy(pose.transform.orientation)
      }
      const detail = `Положение телефона: ${viewer ? 'есть' : 'нет'}. Пересечений: ${hits.length + lowerHits.length}.`
      onPlacement(reticle.visible ? 'surface' : canPlaceInFront ? 'manual' : 'waiting', detail)
    }

    renderer.render(scene, camera)
  }

  async function start() {
    try {
      session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test', 'dom-overlay'],
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

      onStatus(`WebXR запущен. Оверлей: ${session.domOverlayState?.type ?? 'нет'}.`)
      const viewer = await session.requestReferenceSpace('viewer')
      hitSource = await session.requestHitTestSource({ space: viewer })
      if (!stopped && typeof XRRay === 'function') {
        const offsetRay = new XRRay(undefined, { x: 0, y: -0.3, z: -1, w: 0 })
        lowerHitSource = await session.requestHitTestSource({ space: viewer, offsetRay }).catch(() => null)
      }
      if (stopped) return
      await renderer.xr.setSession(session)
      if (!stopped) renderer.setAnimationLoop(draw)
    } catch (error) {
      if (!session) dispose()
      if (stopped) return
      console.error(error)
      const message = error.name === 'NotAllowedError' || error.name === 'SecurityError'
        ? 'Chrome не разрешил запустить AR. Проверьте разрешения сайта и камеры.'
        : 'Не удалось открыть WebXR. Проверьте Chrome и сервисы Google Play для AR.'
      onExit(message)
    }
  }

  start()

  function place() {
    if (!reticle.visible && !canPlaceInFront) return false
    root.position.copy(reticle.visible ? reticle.position : pointInFront)
    root.rotation.y = Math.atan2(viewPosition.x - root.position.x, viewPosition.z - root.position.z)
    root.visible = true
    placed = true
    reticle.visible = false
    return true
  }

  return { place, stop }
}
