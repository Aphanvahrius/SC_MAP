'use strict';
/*
 * Shared visual-effect builders for the 3-D views (star field + system close-up).
 */
import * as THREE from 'three';

/* A transparent "neon liquid" disc lying in the local XZ plane: slow glowing
 * ripples emanate from the centre. Additive, semi-transparent, see-through.
 * Used as the reference-plane effect in the star field (centred on Sol) and as
 * the orientation surface in the system close-up (centred on the star). */
export function buildRipple(radius, waves) {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uRadius: { value: radius },
            uWaves: { value: waves || 14 }      // ripple crests across the disc radius
        },
        vertexShader: [
            'varying vec2 vP;',
            'void main() {',
            '  vP = position.xy;',                       // circle geometry lies in XY
            '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
            '}'
        ].join('\n'),
        fragmentShader: [
            'uniform float uTime; uniform float uRadius; uniform float uWaves;',
            'varying vec2 vP;',
            'void main() {',
            '  float r = length(vP);',
            '  float fade = 1.0 - smoothstep(0.0, uRadius, r);',
            '  float k1 = uWaves * 6.28318 / uRadius;',
            '  float w1 = pow(max(sin(r * k1 - uTime * 0.9), 0.0), 3.0);',       // main ripples
            '  float w2 = pow(max(sin(r * k1 * 0.37 - uTime * 0.35 + 1.7), 0.0), 5.0);', // slow swell
            '  float a = (w1 * 0.20 + w2 * 0.12 + 0.045) * fade;',               // tangible, see-through
            '  gl_FragColor = vec4(vec3(0.20, 0.62, 1.0) * a * 1.4, a);',        // neon blue
            '}'
        ].join('\n'),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 96), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = -1;
    return mesh;
}
