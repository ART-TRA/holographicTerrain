uniform vec3 uVignetteColor;
uniform vec3 uOverlayColor;
uniform float uVignetteOffset;
uniform float uVignetteMultiplier;
uniform float uOverlayAlpha; //интенсив-ть цвета

varying vec2 vUv;

void main() {
  float distanceToCenter = smoothstep(0.0, 1.0, length(vUv - 0.5));

  //уход в fade
  float vignetteStreight = clamp(distanceToCenter * uVignetteMultiplier + uVignetteOffset, 0.0, 1.0);
  vec3 color = mix(uVignetteColor, uOverlayColor, (1.0 - vignetteStreight) * uOverlayAlpha);

  float alpha = vignetteStreight + uOverlayAlpha;

  gl_FragColor = vec4(color, alpha);
}
