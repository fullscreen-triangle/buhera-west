/**
 * AtmosphereSky — Pass 3 atmospheric ray-march rendered as the scene background.
 *
 * A fullscreen quad (depthTest=false, renderOrder=-1) that fires before
 * the terrain mesh so terrain pixels overwrite the ground-facing rays.
 *
 * Camera altitude is computed from the actual heightmap elevation at the
 * walker's (x,z) position so the atmosphere shader sees the correct
 * physical altitude above sea level (~1.7 m above terrain, not the
 * scaled Three.js world-unit position).
 */

import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildAtmosphereUniforms } from './atmosphereTexture'
import { atmosphereVertexShader, atmosphereFragmentShader } from './shaders/atmosphere'
import { sampleHeightmap } from './terrainSampling'

const EYE_HEIGHT_M = 1.7   // metres above terrain surface

export default function AtmosphereSky({ volume, sunDir, heightmap, radius = 10 }) {
  const { camera, size } = useThree()
  const uniformsRef = useRef(null)

  // Build atmosphere uniforms once per volume.
  // Side-effect disposal is intentional (Three.js resource lifecycle).
  const uniforms = useMemo(() => {
    if (!volume) return null
    const u = buildAtmosphereUniforms(volume, {
      stepMeters: 250,
      maxSteps:   200,
    })
    uniformsRef.current = u
    return u
  }, [volume]) // eslint-disable-line react-hooks/exhaustive-deps

  // Dispose WebGL texture on unmount.
  useEffect(() => {
    return () => { uniformsRef.current?.u_atmos_volume?.value?.dispose() }
  }, [])

  useFrame(() => {
    if (!uniforms || !camera) return

    const m   = camera.matrixWorld
    // Scale Three.js world units → metres for the atmosphere volume system.
    const mpu = volume.sizeMeters / (2 * radius)

    // Horizontal position centred on the volume origin.
    const cx = camera.position.x * mpu
    const cz = camera.position.z * mpu

    // Altitude: real elevation above sea level from the heightmap + eye height.
    // Without this the atmosphere shader would see an unrealistic km-scale altitude.
    let altM = 5.0
    if (heightmap) {
      const hNorm = sampleHeightmap(camera.position.x, camera.position.z, heightmap, radius)
      altM = Math.max(2.0, heightmap.floorM + hNorm * heightmap.rangeM + EYE_HEIGHT_M)
    }

    uniforms.u_camera_pos.value.set(cx, altM, cz)

    // Camera orientation — unit vectors, dimensionless.
    uniforms.u_cam_right  .value.setFromMatrixColumn(m, 0).normalize()
    uniforms.u_cam_up     .value.setFromMatrixColumn(m, 1).normalize()
    // Three.js camera looks down -Z locally; flip to get forward.
    uniforms.u_cam_forward.value.setFromMatrixColumn(m, 2).normalize().multiplyScalar(-1)

    uniforms.u_aspect.value = size.width / size.height
    uniforms.u_fov_y .value = (camera.fov * Math.PI) / 180

    if (sunDir) uniforms.u_sun_dir.value.copy(sunDir)
  })

  if (!uniforms) return null

  return (
    // renderOrder=-1 ensures this renders before the terrain mesh.
    // depthTest/depthWrite false so terrain pixels overwrite it correctly.
    <mesh renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        glslVersion={THREE.GLSL3}
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}
