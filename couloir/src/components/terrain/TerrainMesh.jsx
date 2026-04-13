/**
 * TerrainMesh — GPU-displaced terrain with partition-based material
 * classification and physically derived atmospheric scattering.
 *
 * The terrain is a high-resolution PlaneGeometry displaced in the vertex
 * shader by fractional Brownian motion.  The fragment shader classifies
 * material type from elevation and slope (the partition state), computes
 * PBR lighting, renders water with animated wave normals, and applies
 * Rayleigh + Mie scattering derived from the terrain's own state.
 *
 * No textures are loaded.  Everything is procedural on the GPU.
 */

import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { terrainVertexShader, terrainFragmentShader } from './shaders/terrain'

export default function TerrainMesh({
  size = 20,
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
  animate = true,
  offset = [0, 0],
}) {
  const meshRef = useRef()
  const { camera } = useThree()

  // sun direction from azimuth + elevation
  const sunDirection = useMemo(() => {
    const az = sunAzimuth
    const el = sunElevation
    return new THREE.Vector3(
      Math.cos(el) * Math.sin(az),
      Math.sin(el),
      Math.cos(el) * Math.cos(az)
    ).normalize()
  }, [sunAzimuth, sunElevation])

  // shader material (created once, uniforms updated per frame)
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: terrainVertexShader,
      fragmentShader: terrainFragmentShader,
      uniforms: {
        u_amplitude:    { value: amplitude },
        u_frequency:    { value: frequency },
        u_octaves:      { value: octaves },
        u_lacunarity:   { value: lacunarity },
        u_gain:         { value: gain },
        u_time:         { value: 0.0 },
        u_offset:       { value: new THREE.Vector2(offset[0], offset[1]) },
        u_waterLevel:   { value: waterLevel },
        u_sunDirection: { value: sunDirection },
        u_sunColor:     { value: new THREE.Vector3(1.0, 0.95, 0.85) },
        u_sunIntensity: { value: sunIntensity },
        u_cameraPosition: { value: new THREE.Vector3() },
      },
      side: THREE.DoubleSide,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // update uniforms when props change
  useMemo(() => {
    if (!material) return
    material.uniforms.u_amplitude.value = amplitude
    material.uniforms.u_frequency.value = frequency
    material.uniforms.u_octaves.value = octaves
    material.uniforms.u_lacunarity.value = lacunarity
    material.uniforms.u_gain.value = gain
    material.uniforms.u_waterLevel.value = waterLevel
    material.uniforms.u_sunDirection.value.copy(sunDirection)
    material.uniforms.u_sunIntensity.value = sunIntensity
    material.uniforms.u_offset.value.set(offset[0], offset[1])
  }, [material, amplitude, frequency, octaves, lacunarity, gain,
      waterLevel, sunDirection, sunIntensity, offset])

  // per-frame updates
  useFrame((state) => {
    if (!material) return
    if (animate) {
      material.uniforms.u_time.value = state.clock.elapsedTime
    }
    material.uniforms.u_cameraPosition.value.copy(camera.position)
  })

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      material={material}
    >
      <planeGeometry args={[size, size, segments, segments]} />
    </mesh>
  )
}
