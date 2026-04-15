/**
 * TerrainMesh — GPU-displaced terrain on a dense PlaneGeometry grid,
 * clipped to a circle in the fragment shader.  PlaneGeometry gives us
 * the regular vertex grid needed for proper fBm displacement + normals.
 * The circular shape comes from the shader discarding fragments outside
 * u_radius, with an edge-fade in the vertex shader for smooth falloff.
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainVertexShader, terrainFragmentShader } from './shaders/terrain'

export default function TerrainMesh({
  radius = 10,
  segments = 512,
  amplitude = 3.0,
  frequency = 1.2,
  octaves = 8,
  lacunarity = 2.0,
  gain = 0.5,
  waterLevel = 0.25,
  sunAzimuth = 0.8,
  sunElevation = 0.6,
  sunIntensity = 1.4,
  wireframe = false,
  animate = true,
  offset = [0, 0],
}) {
  const matRef = useRef()
  const { camera } = useThree()

  // create shader material once
  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        u_amplitude:      { value: amplitude },
        u_frequency:      { value: frequency },
        u_octaves:        { value: octaves },
        u_lacunarity:     { value: lacunarity },
        u_gain:           { value: gain },
        u_time:           { value: 0.0 },
        u_offset:         { value: new THREE.Vector2(offset[0], offset[1]) },
        u_waterLevel:     { value: waterLevel },
        u_sunDirection:   { value: new THREE.Vector3(0.5, 0.6, 0.5).normalize() },
        u_sunColor:       { value: new THREE.Vector3(1.0, 0.95, 0.85) },
        u_sunIntensity:   { value: sunIntensity },
        u_cameraPosition: { value: new THREE.Vector3() },
        u_wireframe:      { value: 0.0 },
        u_radius:         { value: radius },
      },
      side: THREE.DoubleSide,
      wireframe: false,
    })
    matRef.current = mat
    return mat
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // push prop changes into uniforms
  useEffect(() => {
    const m = matRef.current
    if (!m) return
    m.uniforms.u_amplitude.value = amplitude
    m.uniforms.u_frequency.value = frequency
    m.uniforms.u_octaves.value = octaves
    m.uniforms.u_lacunarity.value = lacunarity
    m.uniforms.u_gain.value = gain
    m.uniforms.u_waterLevel.value = waterLevel
    m.uniforms.u_sunIntensity.value = sunIntensity
    m.uniforms.u_offset.value.set(offset[0], offset[1])
    m.uniforms.u_radius.value = radius
    m.uniforms.u_wireframe.value = wireframe ? 1.0 : 0.0
    m.wireframe = wireframe

    const az = sunAzimuth
    const el = sunElevation
    m.uniforms.u_sunDirection.value.set(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az)
    ).normalize()
  }, [amplitude, frequency, octaves, lacunarity, gain, waterLevel,
      sunAzimuth, sunElevation, sunIntensity, wireframe,
      offset, radius])

  // per-frame: time + camera
  useFrame((state) => {
    const m = matRef.current
    if (!m) return
    if (animate) m.uniforms.u_time.value = state.clock.elapsedTime
    m.uniforms.u_cameraPosition.value.copy(camera.position)
  })

  // PlaneGeometry sized to 2*radius, centered at origin, then
  // rotated to XZ plane.  The shader clips to a circle of u_radius.
  const side = radius * 2
  return (
    <mesh
      key={`terrain-${segments}`}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <planeGeometry args={[side, side, segments, segments]} />
    </mesh>
  )
}
