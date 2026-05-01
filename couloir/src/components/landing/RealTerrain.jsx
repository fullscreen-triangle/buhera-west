/**
 * RealTerrain — rectangular satellite-textured terrain plane.
 *
 * Y-up convention.  Square plane sized to `sizeMeters` × `sizeMeters`,
 * lying on the XZ plane with the centre at world origin.
 *
 * Vertex shader displaces the plane by sampling a Float32 heightmap
 * texture; height in metres is recovered from
 *   y = heightNorm * (heightRange) + heightFloor
 *
 * Fragment shader is a basic PBR-ish Lambert + Blinn-Phong with the
 * satellite texture as albedo.  No partition-state classification —
 * just clean rendering of real-world data.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const VERT = /* glsl */ `
uniform sampler2D u_heightmap;
uniform float u_amplitude;        // metres of full vertical range
uniform float u_size;             // metres across (X & Z)

varying vec2 vUv;
varying float vElevation;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;

void main(){
  vUv = uv;

  // sample heightmap at uv — value is normalised [0, 1]
  float h = texture2D(u_heightmap, vec2(uv.x, 1.0 - uv.y)).r;
  vElevation = h;

  // displace
  vec3 displaced = position;
  displaced.y += h * u_amplitude;

  // finite-diff normal in plane-local space
  float texelSize = 1.0 / 768.0;
  float hR = texture2D(u_heightmap, vec2(uv.x + texelSize, 1.0 - uv.y)).r;
  float hU = texture2D(u_heightmap, vec2(uv.x, 1.0 - (uv.y + texelSize))).r;
  // world-space delta per texel: u_size / 768 metres
  float dx = u_size * texelSize;
  vec3 tangent  = normalize(vec3(dx, (hR - h) * u_amplitude, 0.0));
  vec3 binormal = normalize(vec3(0.0, (hU - h) * u_amplitude, dx));
  vec3 n = normalize(cross(tangent, binormal));

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * n);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

const FRAG = /* glsl */ `
uniform sampler2D u_satellite;
uniform vec3      u_sunDir;        // normalised, pointing FROM surface TO sun
uniform vec3      u_sunColor;
uniform float     u_sunIntensity;
uniform vec3      u_ambientSky;
uniform vec3      u_ambientGround;

varying vec2  vUv;
varying float vElevation;
varying vec3  vWorldNormal;
varying vec3  vWorldPosition;

void main(){
  vec3 albedo = texture2D(u_satellite, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  // gentle altitude tint (cooler at high elevation)
  albedo = mix(albedo, vec3(0.85, 0.88, 0.95), smoothstep(0.7, 1.0, vElevation) * 0.3);

  vec3 N = normalize(vWorldNormal);
  vec3 L = normalize(u_sunDir);
  float NdotL = max(dot(N, L), 0.0);

  // hemisphere ambient
  float hemi = dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
  vec3 ambient = mix(u_ambientGround, u_ambientSky, hemi);

  // simple Lambert + slight specular sheen
  vec3 diffuse = albedo * (ambient + u_sunColor * u_sunIntensity * NdotL);

  vec3 V = normalize(cameraPosition - vWorldPosition);
  vec3 H = normalize(L + V);
  float NdotH = max(dot(N, H), 0.0);
  float spec = pow(NdotH, 32.0) * 0.06 * NdotL;

  vec3 color = diffuse + vec3(spec);

  // tone & gamma
  color = color / (color + vec3(1.0));
  color = pow(color, vec3(1.0 / 2.2));
  gl_FragColor = vec4(color, 1.0);
}
`

function makeHeightTexture(hm) {
  const t = new THREE.DataTexture(
    hm.data, hm.width, hm.height,
    THREE.RedFormat, THREE.FloatType,
  )
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

function makeSatelliteTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.needsUpdate = true
  return t
}

export default function RealTerrain({
  heightmap,             // { data, width, height, minHeightM, maxHeightM, ... }
  satelliteCanvas,       // HTMLCanvasElement
  sizeMeters = 1150,     // world XZ extent
  segments = 256,
  sunAzimuth = 1.2,      // radians (0 = N, π/2 = E)
  sunElevation = 0.85,   // radians above horizon
}) {
  const matRef = useRef()
  const heightTexRef = useRef()
  const satTexRef = useRef()

  // textures
  const heightTex = useMemo(
    () => heightmap ? makeHeightTexture(heightmap) : null,
    [heightmap],
  )
  const satTex = useMemo(
    () => satelliteCanvas ? makeSatelliteTexture(satelliteCanvas) : null,
    [satelliteCanvas],
  )

  // sun direction
  const sunDir = useMemo(() => {
    const d = new THREE.Vector3(
      Math.cos(sunElevation) * Math.sin(sunAzimuth),  // X (east)
      Math.sin(sunElevation),                          // Y (up)
      -Math.cos(sunElevation) * Math.cos(sunAzimuth), // Z (north = -Z; flip cosine)
    )
    return d.normalize()
  }, [sunAzimuth, sunElevation])

  // amplitude in metres = elevation range
  const amplitudeM = heightmap ? heightmap.rangeM : 100

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        u_heightmap:     { value: heightTex },
        u_satellite:     { value: satTex },
        u_amplitude:     { value: amplitudeM },
        u_size:          { value: sizeMeters },
        u_sunDir:        { value: sunDir },
        u_sunColor:      { value: new THREE.Vector3(1.0, 0.96, 0.88) },
        u_sunIntensity:  { value: 1.2 },
        u_ambientSky:    { value: new THREE.Vector3(0.45, 0.55, 0.72) },
        u_ambientGround: { value: new THREE.Vector3(0.18, 0.16, 0.14) },
      },
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // push uniform updates
  useEffect(() => {
    const m = material
    if (!m) return
    if (heightTex) m.uniforms.u_heightmap.value = heightTex
    if (satTex)    m.uniforms.u_satellite.value = satTex
    m.uniforms.u_amplitude.value = amplitudeM
    m.uniforms.u_size.value = sizeMeters
    m.uniforms.u_sunDir.value.copy(sunDir)
  }, [material, heightTex, satTex, amplitudeM, sizeMeters, sunDir])

  // dispose old textures
  useEffect(() => {
    if (heightTexRef.current && heightTexRef.current !== heightTex) {
      heightTexRef.current.dispose()
    }
    heightTexRef.current = heightTex
  }, [heightTex])
  useEffect(() => {
    if (satTexRef.current && satTexRef.current !== satTex) {
      satTexRef.current.dispose()
    }
    satTexRef.current = satTex
  }, [satTex])

  if (!heightmap || !satelliteCanvas) return null

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      material={material}
    >
      <planeGeometry args={[sizeMeters, sizeMeters, segments, segments]} />
    </mesh>
  )
}
