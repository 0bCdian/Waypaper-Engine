#!/usr/bin/env python3
"""
Convert a Shadertoy JSON export (e.g. from shadertoy.com → Export → Shader) into a
self-contained HTML file that runs the shader on a fullscreen WebGL2 canvas.

Usage:
  python3 convert.py shader.json wallpaper.html

Limitations (v1):
  - WebGL2 / GLSL ES 3.00 only (texture(), texelFetch(), etc.).
  - Supported pass types: common, buffer, image. Not: sound, cubemap, webcam.
  - Texture inputs with /media/... paths are not loaded; a black 1×1 texture is used.
  - Multipass uses Shadertoy-style previous-frame reads for buffer→buffer and
    self-feedback; Image samples buffers after they are written for the current frame.
  - Buffer ping-pong targets use RGBA32F (needs EXT_color_buffer_float), matching Shadertoy.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


_FLOAT_F_SUFFIX_RE = re.compile(r"\b(\d+\.\d+)f\b", re.IGNORECASE)
_INT_F_SUFFIX_RE = re.compile(r"\b(\d+)f\b", re.IGNORECASE)
_PREPROC_SPACING_RE = re.compile(
    r"(^|\n)(\s*)#\s+(define|undef|if|ifdef|ifndef|else|elif|endif|error|pragma|line)\b",
    re.MULTILINE,
)


def strip_invalid_float_suffix(code: str) -> str:
    """GLSL ES rejects C-style `1.0f` / `36f` literals; drop the `f`."""
    code = _FLOAT_F_SUFFIX_RE.sub(r"\1", code)
    code = _INT_F_SUFFIX_RE.sub(lambda m: f"{m.group(1)}.0", code)
    return code


def normalize_preprocessor_spacing(code: str) -> str:
    return _PREPROC_SPACING_RE.sub(lambda m: f"{m.group(1)}{m.group(2)}#{m.group(3)}", code)


def sanitize_user_glsl(code: str) -> str:
    """Drop directives that conflict with our #version 300 es wrapper and patch common non-GLSL-ES literals."""
    out_lines: list[str] = []
    for line in code.splitlines():
        s = line.strip()
        if re.match(r"#\s*version\b", s):
            continue
        if re.match(r"#\s*pragma\s+shader_stage\b", s):
            continue
        if re.match(r"#\s*extension\s+GL_EXT_samplerless_texture_functions\b", s):
            continue
        out_lines.append(line)
    cleaned = "\n".join(out_lines).strip() + "\n"
    cleaned = normalize_preprocessor_spacing(cleaned)
    cleaned = strip_invalid_float_suffix(cleaned)
    return cleaned


def collect_common_code(renderpasses: list[dict[str, Any]]) -> str:
    parts = [p["code"] for p in renderpasses if str(p.get("type", "")).lower() == "common"]
    return "\n\n".join(parts).strip()


RUNTIME_JS = r"""
(function () {
  "use strict";

  const ST = JSON.parse(document.getElementById("st-json").textContent);

  const VERT = `#version 300 es
layout(location = 0) in vec2 a_position;
void main(){gl_Position=vec4(a_position,0.0,1.0);}`;

  const FRAG_PREFIX = `
precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform int iFrame;
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
uniform vec3 iChannelResolution[4];
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform sampler2D iChannel2;
uniform sampler2D iChannel3;
out vec4 waypaper_outColor;
`;

  const FRAG_SUFFIX = `
void main() {
  // Shadertoy fragCoord is Y-up (origin bottom-left), same as gl_FragCoord.
  // Passing it unchanged keeps ivec2(fragCoord) consistent with texelFetch-based
  // store()/load() macros used for multipass state (camera quaternions, etc.).
  vec2 fc = gl_FragCoord.xy;
  vec4 col;
  mainImage(col, fc);
  waypaper_outColor = col;
}
`;

  function el(tag, id) {
    const e = document.createElement(tag);
    if (id) e.id = id;
    return e;
  }

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) || "compile failed";
      gl.deleteShader(sh);
      throw new Error(log);
    }
    return sh;
  }

  function link(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) || "link failed";
      gl.deleteProgram(p);
      throw new Error(log);
    }
    return p;
  }

  function makeBufferTexRGBA32F(gl, w, h) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  function clearFboBlack(gl, fbo, w, h) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function makeFbo(gl, tex) {
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error("framebuffer incomplete: " + st);
    return fb;
  }

  function blackTex(gl) {
    const t = gl.createTexture();
    const one = new Uint8Array([0, 0, 0, 255]);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, one);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  function keyboardTex(gl) {
    const w = 256;
    const h = 2;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const z = new Uint8Array(w * h * 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, z);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return { tex: t, w, h, keys: new Set(), data: z };
  }

  function updateKeyboard(kb) {
    const { w, h, data, keys } = kb;
    data.fill(0);
    for (const k of keys) {
      if (k >= 0 && k < w) {
        data[k * 4] = 255;
      }
    }
    const gl = kb.gl;
    gl.bindTexture(gl.TEXTURE_2D, kb.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  function bindChannel(gl, locSam, unit, tex) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(locSam, unit);
  }

  function setChannelResolutions(gl, p, res) {
    for (let i = 0; i < 4; i++) {
      const loc = gl.getUniformLocation(p, "iChannelResolution[" + i + "]");
      if (loc) gl.uniform3f(loc, res[i][0], res[i][1], res[i][2]);
    }
  }

  function setGlobals(gl, p, uni, w, h, time, dt, frame, mouse, dateVec) {
    gl.useProgram(p);
    gl.uniform3f(uni.iResolution, w, h, 1);
    gl.uniform1f(uni.iTime, time);
    gl.uniform1f(uni.iTimeDelta, dt);
    gl.uniform1i(uni.iFrame, frame);
    gl.uniform4f(uni.iMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
    gl.uniform4f(uni.iDate, dateVec[0], dateVec[1], dateVec[2], dateVec[3]);
    gl.uniform1f(uni.iSampleRate, 44100);
  }

  function getUniforms(gl, p) {
    return {
      iResolution: gl.getUniformLocation(p, "iResolution"),
      iTime: gl.getUniformLocation(p, "iTime"),
      iTimeDelta: gl.getUniformLocation(p, "iTimeDelta"),
      iFrame: gl.getUniformLocation(p, "iFrame"),
      iMouse: gl.getUniformLocation(p, "iMouse"),
      iDate: gl.getUniformLocation(p, "iDate"),
      iSampleRate: gl.getUniformLocation(p, "iSampleRate"),
      iChannel0: gl.getUniformLocation(p, "iChannel0"),
      iChannel1: gl.getUniformLocation(p, "iChannel1"),
      iChannel2: gl.getUniformLocation(p, "iChannel2"),
      iChannel3: gl.getUniformLocation(p, "iChannel3"),
    };
  }

  function buildProgram(gl, common, userBody) {
    const frag =
      "#version 300 es\n" +
      FRAG_PREFIX +
      "\n" +
      common +
      "\n" +
      userBody +
      "\n" +
      FRAG_SUFFIX;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
    return link(gl, vs, fs);
  }

  function inputKind(inp) {
    const raw = inp.ctype != null ? inp.ctype : inp.type;
    return (raw || "").toString().toLowerCase();
  }

  function resolveInputs(pass, idToState, phase, kb, black, dummyRes) {
    const channels = [black, black, black, black];
    const res = [
      dummyRes,
      dummyRes,
      dummyRes,
      dummyRes,
    ];
    for (const inp of pass.inputs || []) {
      const ch = inp.channel | 0;
      if (ch < 0 || ch > 3) continue;
      const kind = inputKind(inp);
      if (kind === "keyboard") {
        channels[ch] = kb.tex;
        res[ch] = [kb.w, kb.h, 1];
      } else if (kind === "buffer") {
        const st = idToState[inp.id];
        if (!st) continue;
        const t = phase === "buffer" ? st.readTex : st.writeTex;
        channels[ch] = t;
        res[ch] = [st.w, st.h, 1];
      } else {
        channels[ch] = black;
        res[ch] = [1, 1, 1];
      }
    }
    return { channels, res };
  }

  function drawQuad(gl) {
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const canvas = document.getElementById("c");
  canvas.tabIndex = 0;
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) {
    document.body.innerHTML = "<pre>WebGL2 is required.</pre>";
    return;
  }

  const rp = ST.renderpass || [];
  const commonBlock = (ST.__sanitized_common || "").trim();
  const buffersRaw = rp.filter((p) => String(p.type || "").toLowerCase() === "buffer");
  const imagePass = rp.find((p) => String(p.type || "").toLowerCase() === "image");

  /* Buffer execution order = order in the export (Shadertoy tab order). Do not
     topological-sort on buffer links: multipass reads are previous-frame, and
     mutual A↔B style references are not real compile-time DAG edges. */
  const buffers = buffersRaw.slice();

  if (!imagePass) {
    document.body.innerHTML = "<pre>No image pass in export.</pre>";
    return;
  }

  const bodyByName = ST.__pass_bodies || {};

  const bufStates = [];
  const idToState = {};

  if (buffers.length > 0 && !gl.getExtension("EXT_color_buffer_float")) {
    document.body.innerHTML =
      "<pre>Multipass buffers need WebGL2 EXT_color_buffer_float (RGBA32F render targets).\nThis browser or GPU does not expose it.</pre>";
    return;
  }

  const programs = {
    buffers: [],
    image: null,
  };

  try {
    for (const p of buffers) {
      const body = bodyByName[p.name] || "";
      programs.buffers.push(buildProgram(gl, commonBlock ? commonBlock + "\n" : "", body));
    }
    programs.image = buildProgram(gl, commonBlock ? commonBlock + "\n" : "", bodyByName[imagePass.name] || "");
  } catch (e) {
    document.body.innerHTML = "<pre>Shader compile/link error:\n" + String(e.message || e) + "</pre>";
    console.error(e);
    return;
  }

  const uniBuf = programs.buffers.map((p) => getUniforms(gl, p));
  const uniImg = getUniforms(gl, programs.image);

  const kb = keyboardTex(gl);
  kb.gl = gl;
  const black = blackTex(gl);
  const dummyRes = [1, 1, 1];

  let w = 0;
  let h = 0;

  function allocTargets() {
    for (const st of bufStates) {
      if (st.readTex) {
        gl.deleteTexture(st.readTex);
        gl.deleteTexture(st.writeTex);
        gl.deleteFramebuffer(st.readFbo);
        gl.deleteFramebuffer(st.writeFbo);
      }
      st.w = w;
      st.h = h;
      st.readTex = makeBufferTexRGBA32F(gl, w, h);
      st.writeTex = makeBufferTexRGBA32F(gl, w, h);
      st.readFbo = makeFbo(gl, st.readTex);
      st.writeFbo = makeFbo(gl, st.writeTex);
      clearFboBlack(gl, st.readFbo, w, h);
      clearFboBlack(gl, st.writeFbo, w, h);
    }
  }

  for (let i = 0; i < buffers.length; i++) {
    const p = buffers[i];
    const oid = (p.outputs || [])[0].id;
    const st = { pass: p, outputId: oid, readTex: null, writeTex: null, readFbo: null, writeFbo: null, w: 0, h: 0 };
    bufStates.push(st);
    idToState[oid] = st;
  }

  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  let t0 = performance.now() / 1000;
  let tPrev = t0;
  let frame = 0;
  const mouse = [0, 0, -1, -1];
  let mouseDown = false;

  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = (1 - (e.clientY - rect.top) / rect.height) * canvas.height;
    mouse[2] = mouse[0] = x;
    mouse[3] = mouse[1] = y;
  });
  canvas.addEventListener("mouseup", () => {
    mouseDown = false;
    mouse[2] = -Math.abs(mouse[0]);
    mouse[3] = -Math.abs(mouse[1]);
  });
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = (1 - (e.clientY - rect.top) / rect.height) * canvas.height;
    mouse[0] = x;
    mouse[1] = y;
    if (mouseDown) {
      mouse[2] = x;
      mouse[3] = y;
    }
  });
  window.addEventListener("keydown", (e) => kb.keys.add(e.keyCode));
  window.addEventListener("keyup", (e) => kb.keys.delete(e.keyCode));

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nw = Math.max(2, Math.floor(window.innerWidth * dpr));
    const nh = Math.max(2, Math.floor(window.innerHeight * dpr));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    allocTargets();
  }

  function frameLoop(now) {
    resize();
    updateKeyboard(kb);

    const time = now / 1000;
    const dt = Math.max(1e-6, time - tPrev);
    tPrev = time;

    const d = new Date();
    const dateVec = [
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
      d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000,
    ];

    for (let i = 0; i < buffers.length; i++) {
      const p = buffers[i];
      const prog = programs.buffers[i];
      const u = uniBuf[i];
      const st = bufStates[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.writeFbo);
      gl.viewport(0, 0, w, h);
      setGlobals(gl, prog, u, w, h, time, dt, frame, mouse, dateVec);
      const { channels, res } = resolveInputs(p, idToState, "buffer", kb, black, dummyRes);
      setChannelResolutions(gl, prog, res);
      for (let ch = 0; ch < 4; ch++) {
        bindChannel(gl, u["iChannel" + ch], ch, channels[ch]);
      }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      drawQuad(gl);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    setGlobals(gl, programs.image, uniImg, w, h, time, dt, frame, mouse, dateVec);
    const { channels, res } = resolveInputs(imagePass, idToState, "image", kb, black, dummyRes);
    setChannelResolutions(gl, programs.image, res);
    for (let ch = 0; ch < 4; ch++) {
      bindChannel(gl, uniImg["iChannel" + ch], ch, channels[ch]);
    }
    gl.useProgram(programs.image);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    drawQuad(gl);

    for (const st of bufStates) {
      const tmp = st.readTex;
      st.readTex = st.writeTex;
      st.writeTex = tmp;
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.readFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, st.readTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, st.writeFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, st.writeTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    frame++;
    requestAnimationFrame(frameLoop);
  }

  requestAnimationFrame(frameLoop);
})();
""".strip()


def build_html(st_data: dict[str, Any], sanitized_common: str, pass_bodies: dict[str, str]) -> str:
    payload = {
        **st_data,
        "__sanitized_common": sanitized_common,
        "__pass_bodies": pass_bodies,
    }
    json_text = json.dumps(payload, ensure_ascii=False)
    title = (st_data.get("info") or {}).get("name") or "Shadertoy wallpaper"
    esc_title = (
        title.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>{esc_title}</title>
  <style>
    html, body {{ margin: 0; height: 100%; overflow: hidden; background: #000; }}
    canvas#c {{ display: block; width: 100vw; height: 100vh; }}
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <script type="application/json" id="st-json">{json_text}</script>
  <script>
{RUNTIME_JS}
  </script>
</body>
</html>
"""


def main() -> int:
    ap = argparse.ArgumentParser(description="Shadertoy JSON export → WebGL2 wallpaper HTML")
    ap.add_argument("input_json", type=Path, help="Exported Shadertoy .json")
    ap.add_argument("output_html", type=Path, help="Output .html path")
    args = ap.parse_args()

    raw = args.input_json.read_text(encoding="utf-8", errors="replace")
    st_data = json.loads(raw)
    renderpasses: list[dict[str, Any]] = st_data.get("renderpass") or []

    common = collect_common_code(renderpasses)
    sanitized_common = sanitize_user_glsl(common) if common else ""

    pass_bodies: dict[str, str] = {}
    for p in renderpasses:
        t = str(p.get("type", "")).lower()
        if t in ("buffer", "image"):
            name = p.get("name") or t
            pass_bodies[name] = sanitize_user_glsl(p.get("code") or "")

    html = build_html(st_data, sanitized_common, pass_bodies)
    args.output_html.parent.mkdir(parents=True, exist_ok=True)
    args.output_html.write_text(html, encoding="utf-8")
    print(f"Wrote {args.output_html}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
