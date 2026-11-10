import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { lightScene } from './assembly.js'

export function createPreview(canvas, root) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xe7ebdf)
  scene.fog = new THREE.Fog(0xe7ebdf, 3, 7)
  scene.add(root)
  lightScene(scene)

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({ color: 0xe1e6d7 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  scene.add(floor)

  const grid = new THREE.GridHelper(16, 64, 0xb0b9a6, 0xbdc6b4)
  grid.position.y = 0.001
  grid.material.transparent = true
  grid.material.opacity = 0.45
  scene.add(grid)

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
    camera.aspect = width / height
    camera.fov = camera.aspect < 1 ? 46 : 40
    camera.updateProjectionMatrix()
  }

  new ResizeObserver(resize).observe(canvas)

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
