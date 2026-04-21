/** Default / example mainImage shader (from ShaderWall reference). */
export const SHADER_STUDIO_EXAMPLE = `// Plasma Globe — interactive with mouse
// Move mouse to shift the center

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;

    vec2 m = (iMouse.xy == vec2(0.0))
        ? vec2(0.0)
        : (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y;

    uv -= m * 0.3;

    float t = iTime * 0.7;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    float v = sin(r * 12.0 - t * 3.0);
    v += sin(uv.x * 8.0 + t * 1.5);
    v += sin(uv.y * 7.0 - t * 2.0);
    v += sin(r * 6.0 + a * 3.0 + t);
    v += cos(length(uv * vec2(3.0, 5.0)) - t * 2.5);

    v *= 0.5;

    vec3 col;
    col.r = 0.5 + 0.5 * sin(v * 2.0 + 0.0);
    col.g = 0.5 + 0.5 * sin(v * 2.0 + 2.094);
    col.b = 0.5 + 0.5 * sin(v * 2.0 + 4.189);

    col *= 1.0 - smoothstep(0.4, 0.9, r);

    fragColor = vec4(col, 1.0);
}`;
