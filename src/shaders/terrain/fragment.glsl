uniform sampler2D uTexture;
uniform float uTextureFrequency;

varying vec2 vUv;
varying float vElevation;

void main() {
    vec4 textureColor = texture2D(uTexture, vec2(0.0, vElevation * uTextureFrequency)); // vElevation - кол-во уровней (кол-во линий)

    float alpha = mod(vElevation * 10.0, 1.0);
    alpha = step(0.95, alpha);

    gl_FragColor = textureColor;
}