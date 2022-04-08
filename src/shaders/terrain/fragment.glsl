uniform sampler2D uTexture;
uniform float uTextureFrequency;
uniform float uTextureOffset;

uniform float uTime;
uniform float uHslHue; // 1.0
uniform float uHslHueOffset; // 0. degrees
uniform float uHslHueFrequency; //10.0
uniform float uHslLightness; //0.75
uniform float uHslLightnessVariation; //0.25
uniform float uHslLightnessFrequency; //20.0
uniform float uHslTimeFrequency;

varying vec2 vUv;
varying float vElevation;

#pragma glslify: hslToRgb = require('../partials/hslToRgb.glsl')
#pragma glslify: getPerlinNoise2d = require('../partials/getPerlinNoise2d.glsl')

vec3 getRainbowColor() {
    vec2 uv = vUv;
    uv.y += uTime * uHslTimeFrequency;
    float hue = getPerlinNoise2d(uv * uHslHueFrequency) * uHslHue + uHslHueOffset;
    float lightness = uHslLightness + getPerlinNoise2d(uv * uHslLightnessFrequency + 1234.5) * uHslLightnessVariation;
    vec3 hslColor = vec3(hue, 1.0, lightness);
    vec3 rainbowColor = hslToRgb(hslColor);
    return rainbowColor;
}

void main() {
    vec3 uColor = vec3(1.0, 1.0, 1.0);
    vec3 rainbowColor = getRainbowColor();
    vec4 textureColor = texture2D(uTexture, vec2(0.0, vElevation * uTextureFrequency + uTextureOffset)); // vElevation - кол-во уровней (кол-во линий)

//    float alpha = mod(vElevation * 10.0, 1.0);
//    alpha = step(0.95, alpha);

    float fadeSideAmplitude = 0.2;
    float sideAlpha = 1.0 - max(
        smoothstep(0.5 - fadeSideAmplitude, 0.5, abs(vUv.x - 0.5)),
        smoothstep(0.5 - fadeSideAmplitude, 0.5, abs(vUv.y - 0.5))
    );

    vec3 color = mix(rainbowColor, uColor, textureColor.r);
    gl_FragColor = vec4(color, textureColor.a * sideAlpha);
}