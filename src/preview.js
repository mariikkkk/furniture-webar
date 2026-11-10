import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { lightScene } from './assembly.js'

export function createPreview(canvas, root, panel) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xeeeeee)
  scene.add(root)
  lightScene(scene)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.ShadowMaterial({ opacity: 0.2 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 30)
  camera.position.set(0.62, 1.52, 1.69)
  const orbit = new OrbitControls(camera, canvas)
  orbit.target.set(0, 0.05, 0)
  orbit.minDistance = 0.55
  orbit.maxDistance = 5
  orbit.maxPolarAngle = Math.PI / 2 - 0.08
  orbit.enablePan = false
  orbit.update()

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height) return
    renderer.setSize(width, height, false)
    const visibleHeight = height - panel.clientHeight
    const halfAngle = Math.tan(THREE.MathUtils.degToRad(20))
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfAngle * height / Math.min(width, visibleHeight)))
    camera.setViewOffset(width, height, 0, panel.clientHeight / 2, width, height)
  }

  const sizeObserver = new ResizeObserver(resize)
  sizeObserver.observe(canvas)
  sizeObserver.observe(panel)

  function resume() {
    scene.add(root)
    root.position.set(0, 0, 0)
    root.rotation.set(0, 0, 0)
    root.visible = true
    resize()
    renderer.setAnimationLoop(() => renderer.render(scene, camera))
  }

  resume()
  return { resume, pause: () => renderer.setAnimationLoop(null) }
}
