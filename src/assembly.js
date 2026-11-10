import * as THREE from 'three'

const legs = [
  [-0.22, -0.22],
  [0.22, -0.22],
  [-0.22, 0.22],
  [0.22, 0.22]
]

const wood = new THREE.MeshStandardMaterial({ color: 0xc9975f, roughness: 0.73 })
const edge = new THREE.MeshStandardMaterial({ color: 0xa77748, roughness: 0.76 })
const steel = new THREE.MeshStandardMaterial({ color: 0x53584f, metalness: 0.45, roughness: 0.42 })
const slot = new THREE.MeshStandardMaterial({ color: 0x292a24 })
const orange = new THREE.MeshStandardMaterial({ color: 0xfba643, emissive: 0x8b4200 })
const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xd56418, side: THREE.DoubleSide })

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material)
  object.position.set(x, y, z)
  object.castShadow = true
  object.receiveShadow = true
  return object
}

function makeLeg() {
  const leg = new THREE.Group()
  leg.add(
    mesh(new THREE.CylinderGeometry(0.022, 0.032, 0.39, 12), wood),
    mesh(new THREE.BoxGeometry(0.138, 0.012, 0.075), edge, 0, -0.189),
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.001, 12), slot, -0.052, -0.182),
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.001, 12), slot, 0.052, -0.182)
  )
  return leg
}

function makeScrew() {
  const screw = new THREE.Group()
  screw.add(
    mesh(new THREE.CylinderGeometry(0.005, 0.003, 0.025, 12), steel, 0, -0.016),
    mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.007, 16), steel),
    mesh(new THREE.BoxGeometry(0.014, 0.001, 0.003), slot, 0, 0.004)
  )
  return screw
}

function progress(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export function createAssembly() {
  const root = new THREE.Group()
  const turn = new THREE.Group()
  const parts = new THREE.Group()
  root.add(turn)
  turn.add(parts)
  parts.position.y = -0.222

  const seat = mesh(new THREE.BoxGeometry(0.61, 0.046, 0.61), wood, 0, 0.026)
  const underside = mesh(new THREE.BoxGeometry(0.59, 0.003, 0.59), edge, 0, 0.05)
  parts.add(seat, underside)

  const legModels = legs.map(() => makeLeg())
  parts.add(...legModels)

  const screws = legs.flatMap(([x, z]) => [-0.052, 0.052].map(offset => {
    const model = makeScrew()
    const ring = mesh(new THREE.RingGeometry(0.016, 0.021, 28), ringMaterial, x + offset, 0.067, z)
    ring.rotation.x = -Math.PI / 2
    parts.add(model, ring)
    return { model, ring, x: x + offset, z }
  }))

  function showStep(timeline, activeStep) {
    legModels.forEach((leg, index) => {
      const [x, z] = legs[index]
      const amount = progress((timeline - index * 0.11) / 0.67)
      leg.position.set(
        THREE.MathUtils.lerp(Math.sign(x) * 0.58, x, amount),
        THREE.MathUtils.lerp(0.072, 0.248, amount) + Math.sin(Math.PI * amount) * 0.19,
        z
      )
      leg.rotation.z = (1 - amount) * Math.PI / 2
    })

    screws.forEach(({ model, ring, x, z }, index) => {
      const movement = (timeline - 1 - Math.floor(index / 2) * 0.13) / 0.61
      const approach = progress(movement / 0.72)
      const insert = progress((movement - 0.72) / 0.28)
      model.position.set(
        THREE.MathUtils.lerp((index - 3.5) * 0.062, x, approach),
        THREE.MathUtils.lerp(0.037, 0.145, approach) + Math.sin(Math.PI * approach) * 0.15 - insert * 0.078,
        THREE.MathUtils.lerp(0.47, z, approach)
      )
      model.rotation.y = -insert * Math.PI * 6
      model.children[1].material = activeStep === 2 ? orange : steel
      ring.visible = activeStep === 2
    })

    const flip = progress(timeline - 2)
    turn.position.y = 0.222 + Math.sin(Math.PI * flip) * 0.16
    turn.rotation.x = Math.PI * flip
  }

  showStep(0, 0)
  return { root, showStep }
}

export function lightScene(scene) {
  scene.add(new THREE.HemisphereLight(0xfff5de, 0x7d836e, 2.5))
  const sun = new THREE.DirectionalLight(0xfff5e5, 2.7)
  sun.position.set(-2, 4, 3)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -2
  sun.shadow.camera.right = 2
  sun.shadow.camera.top = 2
  sun.shadow.camera.bottom = -2
  sun.shadow.normalBias = 0.012
  scene.add(sun)
}
