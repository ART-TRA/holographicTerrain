varying vec2 vUv;

void main() {
  float distanceToCenter = length(vUv - 0.5);
  gl_FragColor = vec4(vUv, 1.0, distanceToCenter);
}
