import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildCompositedImage } from '../utils/build3dTexture.js'

const SHAPES = {
  sphere: () => new THREE.SphereGeometry(2, 64, 64),
  cylinder: () => new THREE.CylinderGeometry(1.5, 1.5, 4, 64),
  plane: () => new THREE.PlaneGeometry(5, 5),
}

function createGeometry(shapeType) {
  const factory = SHAPES[shapeType] ?? SHAPES.sphere
  return factory()
}

function getCameraPosition(shapeType) {
  switch (shapeType) {
    case 'cylinder':
      return new THREE.Vector3(0, 1.5, 7)
    case 'plane':
      return new THREE.Vector3(0, 0, 7)
    default:
      return new THREE.Vector3(0, 0.5, 6.5)
  }
}

export default function ArtifactViewer3D({
  originalSrc,
  overlaySrc,
  shapeType,
  overlayOpacity,
  active,
}) {
  const containerRef = useRef(null)
  const runtimeRef = useRef(null)

  useEffect(() => {
    if (!active || !containerRef.current || !originalSrc) return undefined

    const container = containerRef.current
    const width = container.clientWidth || 640
    const height = container.clientHeight || 400

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a1220)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.copy(getCameraPosition(shapeType))

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.55)
    const directional = new THREE.DirectionalLight(0xffffff, 0.85)
    directional.position.set(4, 6, 8)
    scene.add(ambient, directional)

    const geometry = createGeometry(shapeType)
    const material = new THREE.MeshStandardMaterial({
      map: null,
      roughness: 0.65,
      metalness: 0.08,
      side: shapeType === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 3
    controls.maxDistance = 14

    runtimeRef.current = {
      scene,
      camera,
      renderer,
      controls,
      mesh,
      material,
      geometry,
      texture: null,
      frameId: null,
      disposed: false,
    }

    const onResize = () => {
      const rt = runtimeRef.current
      if (!rt || rt.disposed) return
      const w = container.clientWidth || width
      const h = container.clientHeight || height
      rt.camera.aspect = w / h
      rt.camera.updateProjectionMatrix()
      rt.renderer.setSize(w, h)
    }
    window.addEventListener('resize', onResize)

    const animate = () => {
      const rt = runtimeRef.current
      if (!rt || rt.disposed) return
      rt.frameId = requestAnimationFrame(animate)
      rt.controls.update()
      rt.renderer.render(rt.scene, rt.camera)
    }
    animate()

    return () => {
      window.removeEventListener('resize', onResize)
      const rt = runtimeRef.current
      if (!rt) return
      rt.disposed = true
      if (rt.frameId) cancelAnimationFrame(rt.frameId)
      rt.controls.dispose()
      if (rt.texture) rt.texture.dispose()
      rt.material.map = null
      rt.material.dispose()
      rt.geometry.dispose()
      rt.renderer.dispose()
      if (rt.renderer.domElement.parentNode === container) {
        container.removeChild(rt.renderer.domElement)
      }
      runtimeRef.current = null
    }
  }, [active])

  useEffect(() => {
    const rt = runtimeRef.current
    if (!active || !rt || rt.disposed || !originalSrc) return undefined

    let cancelled = false

    async function applyTexture() {
      try {
        const img = await buildCompositedImage(originalSrc, overlaySrc, overlayOpacity)
        if (cancelled || rt.disposed) return

        if (rt.texture) rt.texture.dispose()
        const texture = new THREE.Texture(img)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
        rt.texture = texture
        rt.material.map = texture
        rt.material.needsUpdate = true
      } catch (e) {
        console.error('3D texture update failed', e)
      }
    }

    applyTexture()
    return () => {
      cancelled = true
    }
  }, [active, originalSrc, overlaySrc, overlayOpacity])

  useEffect(() => {
    const rt = runtimeRef.current
    if (!active || !rt || rt.disposed) return

    const oldGeometry = rt.mesh.geometry
    const newGeometry = createGeometry(shapeType)
    rt.mesh.geometry = newGeometry
    rt.geometry = newGeometry
    oldGeometry.dispose()

    rt.material.side = shapeType === 'plane' ? THREE.DoubleSide : THREE.FrontSide
    rt.material.needsUpdate = true
    rt.camera.position.copy(getCameraPosition(shapeType))
    rt.controls.target.set(0, shapeType === 'cylinder' ? 0 : 0, 0)
    rt.controls.update()
  }, [shapeType, active])

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[320px] w-full overflow-hidden rounded-xl border border-navy-border bg-navy-dark"
      aria-label="3D Damage Preview viewer"
    />
  )
}
