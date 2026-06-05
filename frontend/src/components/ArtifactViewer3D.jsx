import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  build3dTextureFromArtifacts,
  buildDisplacementImageFromMask,
} from '../utils/build3dTexture.js'

const PLANE_SLAB_WIDTH = 5
const PLANE_SLAB_HEIGHT = 3.5
const PLANE_SLAB_DEPTH = 0.2
const PLANE_SLAB_SEGMENTS = 64
/** 손상 위치 입체 강조 — 실제 복원이 아닌 미세 굴곡 */
const DISPLACEMENT_SCALE = 0.055
/** BoxGeometry face order: +x,-x,+y,-y,+z,-z — texture on +z (front) */
const PLANE_FRONT_FACE_INDEX = 4

const SHAPES = {
  sphere: () => new THREE.SphereGeometry(2, 64, 64),
  cylinder: () => new THREE.CylinderGeometry(1.5, 1.5, 4, 64),
  plane: () =>
    new THREE.BoxGeometry(
      PLANE_SLAB_WIDTH,
      PLANE_SLAB_HEIGHT,
      PLANE_SLAB_DEPTH,
      PLANE_SLAB_SEGMENTS,
      PLANE_SLAB_SEGMENTS,
      2,
    ),
}

function createSideMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x4a4035,
    roughness: 0.78,
    metalness: 0.04,
  })
}

function createTexturedMaterial() {
  return new THREE.MeshStandardMaterial({
    map: null,
    roughness: 0.55,
    metalness: 0.05,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    depthWrite: true,
  })
}

function buildMeshForShape(shapeType) {
  const geometry = (SHAPES[shapeType] ?? SHAPES.sphere)()

  if (shapeType === 'plane') {
    const side = createSideMaterial()
    const front = createTexturedMaterial()
    const materials = [side, side, side, side, front, side]
    const mesh = new THREE.Mesh(geometry, materials)
    return {
      mesh,
      geometry,
      material: front,
      materials,
      isPlaneSlab: true,
    }
  }

  const material = createTexturedMaterial()
  const mesh = new THREE.Mesh(geometry, material)
  return {
    mesh,
    geometry,
    material,
    materials: null,
    isPlaneSlab: false,
  }
}

function clearPlaneDisplacement(rt) {
  if (!rt.materials) return
  const front = rt.materials[PLANE_FRONT_FACE_INDEX]
  front.displacementMap = null
  front.displacementScale = 0
  front.displacementBias = 0
  front.needsUpdate = true
  if (rt.displacementTexture) {
    rt.displacementTexture.dispose()
    rt.displacementTexture = null
  }
}

function disposeMeshResources(rt) {
  clearPlaneDisplacement(rt)
  if (rt.texture) {
    rt.texture.dispose()
    rt.texture = null
  }
  if (rt.materials) {
    rt.materials.forEach((m) => {
      m.map = null
      m.dispose()
    })
    rt.materials = null
  } else if (rt.material) {
    rt.material.map = null
    rt.material.dispose()
    rt.material = null
  }
  if (rt.geometry) {
    rt.geometry.dispose()
    rt.geometry = null
  }
}

function replaceMeshShape(rt, shapeType) {
  rt.scene.remove(rt.mesh)
  disposeMeshResources(rt)

  const built = buildMeshForShape(shapeType)
  rt.mesh = built.mesh
  rt.geometry = built.geometry
  rt.material = built.material
  rt.materials = built.materials
  rt.isPlaneSlab = built.isPlaneSlab
  rt.scene.add(rt.mesh)

  if (rt.texture) {
    applyTextureToMesh(rt, rt.texture)
  }
  if (rt.isPlaneSlab && rt.displacementTexture) {
    applyDisplacementToPlaneFront(rt, rt.displacementTexture)
  }
}

function applyTextureToMesh(rt, texture) {
  if (rt.isPlaneSlab && rt.materials) {
    const front = rt.materials[PLANE_FRONT_FACE_INDEX]
    front.map = texture
    front.needsUpdate = true
    rt.material = front
  } else if (rt.material) {
    rt.material.map = texture
    rt.material.needsUpdate = true
  }
}

function applyDisplacementToPlaneFront(rt, displacementTexture) {
  if (!rt.isPlaneSlab || !rt.materials) return
  const front = rt.materials[PLANE_FRONT_FACE_INDEX]
  front.displacementMap = displacementTexture
  front.displacementScale = DISPLACEMENT_SCALE
  front.displacementBias = 0
  front.needsUpdate = true
}

function getCameraPosition(shapeType) {
  switch (shapeType) {
    case 'cylinder':
      return new THREE.Vector3(0, 1.5, 7)
    case 'plane':
      return new THREE.Vector3(0.8, 0.4, 6.8)
    default:
      return new THREE.Vector3(0, 0.5, 6.5)
  }
}

export default function ArtifactViewer3D({
  artifactSrc,
  artifactOverlaySrc,
  maskSrc,
  shapeType,
  overlayStrength,
  active,
}) {
  const containerRef = useRef(null)
  const runtimeRef = useRef(null)

  useEffect(() => {
    if (!active || !containerRef.current || !artifactOverlaySrc) return undefined

    const container = containerRef.current
    const width = container.clientWidth || 640
    const height = container.clientHeight || 400

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a1220)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.copy(getCameraPosition(shapeType))

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.65)
    const directional = new THREE.DirectionalLight(0xffffff, 0.9)
    directional.position.set(4, 6, 8)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(-4, 2, 5)
    scene.add(ambient, directional, fill)

    const built = buildMeshForShape(shapeType)
    scene.add(built.mesh)

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
      mesh: built.mesh,
      material: built.material,
      materials: built.materials,
      isPlaneSlab: built.isPlaneSlab,
      geometry: built.geometry,
      texture: null,
      displacementTexture: null,
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
      disposeMeshResources(rt)
      rt.renderer.dispose()
      if (rt.renderer.domElement.parentNode === container) {
        container.removeChild(rt.renderer.domElement)
      }
      runtimeRef.current = null
    }
  }, [active, artifactOverlaySrc])

  useEffect(() => {
    const rt = runtimeRef.current
    if (!active || !rt || rt.disposed || !artifactOverlaySrc) return undefined

    let cancelled = false

    async function applyTextures() {
      try {
        const img = await build3dTextureFromArtifacts(
          artifactSrc,
          artifactOverlaySrc,
          overlayStrength,
        )
        if (cancelled || rt.disposed) return

        if (rt.texture) rt.texture.dispose()
        const texture = new THREE.Texture(img)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
        rt.texture = texture
        applyTextureToMesh(rt, texture)

        clearPlaneDisplacement(rt)
        if (rt.isPlaneSlab && maskSrc) {
          const dispImg = await buildDisplacementImageFromMask(
            maskSrc,
            img.width,
            img.height,
          )
          if (cancelled || rt.disposed) return

          const dispTex = new THREE.Texture(dispImg)
          dispTex.colorSpace = THREE.NoColorSpace
          dispTex.needsUpdate = true
          rt.displacementTexture = dispTex
          applyDisplacementToPlaneFront(rt, dispTex)
        }
      } catch (e) {
        console.error('3D texture update failed', e)
      }
    }

    applyTextures()
    return () => {
      cancelled = true
    }
  }, [active, artifactSrc, artifactOverlaySrc, overlayStrength, maskSrc, shapeType])

  useEffect(() => {
    const rt = runtimeRef.current
    if (!active || !rt || rt.disposed) return

    replaceMeshShape(rt, shapeType)
    rt.camera.position.copy(getCameraPosition(shapeType))
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
