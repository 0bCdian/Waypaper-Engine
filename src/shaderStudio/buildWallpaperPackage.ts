import { buildFragmentShader, detectCubeChannels } from "./glslPrefix";
import { normalizeInputKind, type PreparedMultipass } from "./shadertoyImport";

export type ShaderWebWallpaperFiles = {
  "waypaper.json": string;
  "index.html": string;
};

const DEFAULT_TITLE = "Shader wallpaper";

function minimalFallbackShader(): string {
  return `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  fragColor = vec4(uv, 0.5 + 0.5 * sin(iTime), 1.0);
}`;
}

/**
 * Build a v1 web wallpaper package (waypaper.json + self-contained index.html).
 * Precomputes fragment shaders for WebGL2 and WebGL1; runtime picks context then uses the matching source.
 */
export function buildShaderWebWallpaperFiles(opts: {
  shader: string;
  title: string;
}): ShaderWebWallpaperFiles {
  const raw = opts.shader.trim();
  const user = raw.length > 0 ? raw : minimalFallbackShader();
  const title = opts.title.trim() || DEFAULT_TITLE;

  const fragGl2 = buildFragmentShader(user, true).source;
  const fragGl1 = buildFragmentShader(user, false).source;
  const cubeJson = JSON.stringify(detectCubeChannels(user));

  const manifest = {
    waypaper: "1",
    title,
    entry: "index.html",
    capabilities: {
      pointer_interactive: true,
    },
  };

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;}
#c{display:block;width:100vw;height:100vh;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>window.__WP_FRAG_GL2=${JSON.stringify(fragGl2)};window.__WP_FRAG_GL1=${JSON.stringify(fragGl1)};window.__WP_CUBE__=${cubeJson};</script>
<script>
${PACKAGE_RUNTIME}
</script>
</body>
</html>`;

  return {
    "waypaper.json": JSON.stringify(manifest, null, 2) + "\n",
    "index.html": indexHtml,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Prevent JSON/string content from breaking out of <script>…</script>. */
function safeScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/<\/(script)/gi, "<\\/$1");
}

export type MultipassPassPayload = {
  name: string;
  kind: "buffer" | "image";
  body: string;
  outputId?: string;
  inputs: Array<{ channel: number; kind: string; id?: string }>;
};

export type MultipassPayload = {
  title: string;
  common: string;
  passes: MultipassPassPayload[];
};

/** Only buffer-kind inputs need an id (pointer to another pass's output); keyboard/texture/etc. have no id. */
function toInputRef(inp: {
  channel: number;
  id?: string;
  type?: string;
  ctype?: string;
}): { channel: number; kind: string; id?: string } {
  const kind = normalizeInputKind(inp);
  if (kind === "buffer" && inp.id) return { channel: inp.channel | 0, kind, id: inp.id };
  return { channel: inp.channel | 0, kind };
}

/**
 * Turn a {@link PreparedMultipass} into a minimal, runtime-ready JSON payload.
 * Buffer passes come first (export order), the image pass last -- matching `ShadertoyMultipassEngine.compile()`.
 */
export function serializeMultipass(prepared: PreparedMultipass): MultipassPayload {
  const passes: MultipassPassPayload[] = [];
  for (const buf of prepared.buffers) {
    const name = (buf.name as string) ?? "buffer";
    const body = prepared.bodies[name] ?? "";
    const outputId = buf.outputs?.[0]?.id;
    passes.push({
      name,
      kind: "buffer",
      body,
      outputId,
      inputs: (buf.inputs ?? []).map(toInputRef),
    });
  }
  const imgName = (prepared.image.name as string) ?? "image";
  passes.push({
    name: imgName,
    kind: "image",
    body: prepared.bodies[imgName] ?? "",
    inputs: (prepared.image.inputs ?? []).map(toInputRef),
  });
  return { title: prepared.title, common: prepared.commonSanitized.trim(), passes };
}

export function buildShaderMultipassWebWallpaperFiles(
  opts:
    | { prepared: PreparedMultipass; title: string }
    | { payload: MultipassPayload; title: string },
): ShaderWebWallpaperFiles {
  const title = opts.title.trim() || DEFAULT_TITLE;
  const payload: MultipassPayload =
    "payload" in opts
      ? { ...opts.payload }
      : serializeMultipass(opts.prepared);
  payload.title = title;

  const manifest = {
    waypaper: "1",
    title,
    entry: "index.html",
    capabilities: {
      pointer_interactive: true,
      keyboard_interactive: true,
    },
    shader: {
      kind: "multipass",
      passes: payload.passes.map((p) => ({ name: p.name, kind: p.kind })),
    },
  };

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000;}
#c{display:block;width:100vw;height:100vh;}
#err{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:1rem;color:#f55;font-family:monospace;white-space:pre-wrap;background:#111;}
</style>
</head>
<body>
<canvas id="c" tabindex="0"></canvas>
<script>window.__WP_MP__=${safeScriptJson(payload)};</script>
<script>
${PACKAGE_RUNTIME_MULTIPASS}
</script>
</body>
</html>`;

  return {
    "waypaper.json": JSON.stringify(manifest, null, 2) + "\n",
    "index.html": indexHtml,
  };
}

/**
 * Wallpaper-only runtime: WebGL2 + frag GL2, else WebGL1 + frag GL1.
 */
const PACKAGE_RUNTIME = `'use strict';
(function(){
var canvas=document.getElementById('c');
var gl=null,isGL2=false,fragSrc='',quad=null,program=null,uni={},def2=[null,null,null,null],defC=[null,null,null,null];
var cube=window.__WP_CUBE__||[false,false,false,false];
var play=true,start=performance.now(),pauseT=0,pauseAt=0,fi=0,last=0,dt=0,raf=null,resize=1;
var mouse={x:0,y:0,cx:0,cy:0,down:0,click:0};
var VS2='#version 300 es\\nlayout(location=0) in vec2 _pos;\\nvoid main(){gl_Position=vec4(_pos,0.,1.);}';
var VS1='attribute vec2 _pos;void main(){gl_Position=vec4(_pos,0.,1.);}';
function initGL(){
  var o={antialias:false,alpha:false,premultipliedAlpha:false,preserveDrawingBuffer:false};
  var c2=canvas.getContext('webgl2',o);
  if(c2){gl=c2;isGL2=true;fragSrc=window.__WP_FRAG_GL2||'';}
  else{gl=canvas.getContext('webgl',o)||canvas.getContext('experimental-webgl',o);isGL2=false;fragSrc=window.__WP_FRAG_GL1||'';}
  if(!gl)return false;
  quad=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  for(var i=0;i<4;i++){
    gl.activeTexture(gl.TEXTURE0+i);
    var t2=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,t2);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
    def2[i]=t2;
    var tc=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP,tc);
    for(var f=0;f<6;f++)gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X+f,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    defC[i]=tc;
  }
  new ResizeObserver(function(){resize=1;}).observe(canvas);
  document.addEventListener('mousemove',function(e){mouse.x=e.clientX/window.innerWidth;mouse.y=e.clientY/window.innerHeight;});
  document.addEventListener('mousedown',function(e){mouse.x=mouse.cx=e.clientX/window.innerWidth;mouse.y=mouse.cy=e.clientY/window.innerHeight;mouse.down=1;mouse.click=1;});
  document.addEventListener('mouseup',function(){mouse.down=0;});
  return true;
}
function compileShader(type,src){
  var s=gl.createShader(type);
  gl.shaderSource(s,src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){var i=gl.getShaderInfoLog(s)||'';gl.deleteShader(s);throw i;}
  return s;
}
function linkProgram(vs,fs){
  if(program){gl.deleteProgram(program);program=null;uni={};}
  var p=gl.createProgram();
  gl.attachShader(p,vs);gl.attachShader(p,fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){var e=gl.getProgramInfoLog(p)||'';gl.deleteProgram(p);throw e;}
  program=p;
}
function build(vsrc,fsrc){
  var vs=compileShader(gl.VERTEX_SHADER,vsrc);
  var fs=compileShader(gl.FRAGMENT_SHADER,fsrc);
  linkProgram(vs,fs);
}
function u(n){if(uni[n]===undefined)uni[n]=gl.getUniformLocation(program,n);return uni[n];}
function sync(){
  var pr=window.devicePixelRatio||1;
  var dw=Math.floor(canvas.clientWidth*pr),dh=Math.floor(canvas.clientHeight*pr);
  if(canvas.width!==dw||canvas.height!==dh){canvas.width=dw;canvas.height=dh;gl.viewport(0,0,dw,dh);}
  resize=0;
}
function time(){if(!play)return pauseAt;return (performance.now()-start)/1000-pauseT;}
function frame(now){
  raf=requestAnimationFrame(frame);
  if(resize)sync();
  if(!program)return;
  if(!play){last=now;return;}
  dt=last>0?(now-last)/1000:0;last=now;
  var t=time();
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  var ap=gl.getAttribLocation(program,'_pos');
  gl.enableVertexAttribArray(ap);
  gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
  var W=canvas.width,H=canvas.height;
  gl.uniform3f(u('iResolution'),W,H,W/H);
  gl.uniform1f(u('iTime'),t);
  gl.uniform1f(u('iTimeDelta'),dt);
  gl.uniform1i(u('iFrame'),fi);
  gl.uniform1f(u('iSampleRate'),44100);
  var fr=u('iFrameRate');if(fr)gl.uniform1f(fr,dt>1e-8?1.0/dt:0);
  for(var ci=0;ci<4;ci++){
    var cr=u('iChannelResolution['+ci+']');if(cr)gl.uniform3f(cr,1,1,1);
    var ct=u('iChannelTime['+ci+']');if(ct)gl.uniform1f(ct,0);
  }
  var mx=mouse.x*W,my=H-mouse.y*H,mcx=mouse.cx*W,mcy=H-mouse.cy*H;
  gl.uniform4f(u('iMouse'),mouse.down?mx:0,mouse.down?my:0,mouse.down?Math.abs(mcx):-Math.abs(mcx),mouse.click?Math.abs(mcy):-Math.abs(mcy));
  var d=new Date();
  gl.uniform4f(u('iDate'),d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours()*3600+d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1000);
  for(var i=0;i<4;i++){
    gl.activeTexture(gl.TEXTURE0+i);
    if(cube[i])gl.bindTexture(gl.TEXTURE_CUBE_MAP,defC[i]);else gl.bindTexture(gl.TEXTURE_2D,def2[i]);
    gl.uniform1i(u('iChannel'+i),i);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  mouse.click=0;fi++;
}
if(!initGL()){document.body.innerHTML='<p style=color:#f55;font-family:monospace;padding:1rem>WebGL unavailable</p>';return;}
try{
  build(isGL2?VS2:VS1,fragSrc);
}catch(e){
  document.body.innerHTML='<pre style=color:#f55;font-family:monospace;padding:1rem;white-space:pre-wrap>'+String(e)+'</pre>';
  return;
}
raf=requestAnimationFrame(frame);
})();`;

/**
 * Multipass wallpaper runtime: mirrors ShadertoyMultipassEngine
 *  - WebGL2 + EXT_color_buffer_float required (RGBA32F ping-pong buffers).
 *  - Common tab is prepended to every buffer + image fragment.
 *  - fragCoord = gl_FragCoord.xy (Shadertoy Y-up) keeps store()/load() texel indices aligned.
 *  - Inputs: buffer (ping-pong read of prior-frame or current-frame write), keyboard (256x2), else 1x1 black.
 */
const PACKAGE_RUNTIME_MULTIPASS = `'use strict';
(function(){
var MP=window.__WP_MP__;
var canvas=document.getElementById('c');
function fail(msg){var e=document.createElement('pre');e.id='err';e.textContent=msg;document.body.appendChild(e);}
if(!MP||!canvas)return;
var gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:false,stencil:false,premultipliedAlpha:false,preserveDrawingBuffer:false});
if(!gl){fail('WebGL2 is required for this wallpaper.');return;}
if(!gl.getExtension('EXT_color_buffer_float')){fail('This wallpaper needs EXT_color_buffer_float (RGBA32F render targets), like Shadertoy.');return;}
var VERT='#version 300 es\\nlayout(location=0) in vec2 _pos;\\nvoid main(){gl_Position=vec4(_pos,0.,1.);}';
var FRAG_PREFIX='precision highp float;\\nprecision highp int;\\nuniform vec3 iResolution;\\nuniform float iTime;\\nuniform float iTimeDelta;\\nuniform int iFrame;\\nuniform float iFrameRate;\\nuniform vec4 iMouse;\\nuniform vec4 iDate;\\nuniform float iSampleRate;\\nuniform vec3 iChannelResolution[4];\\nuniform float iChannelTime[4];\\nuniform sampler2D iChannel0;\\nuniform sampler2D iChannel1;\\nuniform sampler2D iChannel2;\\nuniform sampler2D iChannel3;\\nout vec4 waypaper_st_out;\\n';
var FRAG_SUFFIX='\\nvoid main(){vec2 fc=gl_FragCoord.xy;vec4 col;mainImage(col,fc);waypaper_st_out=col;}';
var quad=gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER,quad);
gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
function compile(ty,src,label){var s=gl.createShader(ty);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){var i=gl.getShaderInfoLog(s)||'';gl.deleteShader(s);throw new Error(label+': '+i);}return s;}
function link(vs,fs,label){var p=gl.createProgram();gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(p,gl.LINK_STATUS)){var i=gl.getProgramInfoLog(p)||'';gl.deleteProgram(p);throw new Error(label+': '+i);}return p;}
function makeBufTex(w,h){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,null);gl.bindTexture(gl.TEXTURE_2D,null);return t;}
function makeFbo(tex){var f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);var st=gl.checkFramebufferStatus(gl.FRAMEBUFFER);gl.bindFramebuffer(gl.FRAMEBUFFER,null);if(st!==gl.FRAMEBUFFER_COMPLETE)throw new Error('framebuffer incomplete: '+st);return f;}
function clearFbo(f,w,h){gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}
function blackTex(){var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));gl.bindTexture(gl.TEXTURE_2D,null);return t;}
function keyboardTex(){var w=256,h=2;var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);var z=new Uint8Array(w*h*4);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,z);gl.bindTexture(gl.TEXTURE_2D,null);return{tex:t,w:w,h:h,data:z,keys:new Set()};}
function updateKb(kb){kb.data.fill(0);kb.keys.forEach(function(k){if(k>=0&&k<kb.w)kb.data[k*4]=255;});gl.bindTexture(gl.TEXTURE_2D,kb.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,kb.w,kb.h,gl.RGBA,gl.UNSIGNED_BYTE,kb.data);gl.bindTexture(gl.TEXTURE_2D,null);}
function uniLoc(p,n){return gl.getUniformLocation(p,n);}
var common=MP.common?MP.common+'\\n':'';
var passes=[];
var idToState={};
try{
  for(var i=0;i<MP.passes.length;i++){
    var pass=MP.passes[i];
    var frag='#version 300 es\\n'+FRAG_PREFIX+common+pass.body+FRAG_SUFFIX;
    var vs=compile(gl.VERTEX_SHADER,VERT,'vs:'+pass.name);
    var fs=compile(gl.FRAGMENT_SHADER,frag,'fs:'+pass.name);
    var prog=link(vs,fs,pass.name);
    var u={};['iResolution','iTime','iTimeDelta','iFrame','iFrameRate','iMouse','iDate','iSampleRate','iChannel0','iChannel1','iChannel2','iChannel3'].forEach(function(n){u[n]=uniLoc(prog,n);});
    for(var ci=0;ci<4;ci++){u['iChannelResolution['+ci+']']=uniLoc(prog,'iChannelResolution['+ci+']');u['iChannelTime['+ci+']']=uniLoc(prog,'iChannelTime['+ci+']');}
    var st={pass:pass,prog:prog,uni:u,readTex:null,writeTex:null,readFbo:null,writeFbo:null,w:0,h:0};
    passes.push(st);
    if(pass.kind==='buffer'&&pass.outputId)idToState[pass.outputId]=st;
  }
}catch(e){fail(String(e.message||e));return;}
var kb=keyboardTex();
var black=blackTex();
function alloc(w,h){
  for(var i=0;i<passes.length;i++){
    var st=passes[i];
    if(st.pass.kind!=='buffer')continue;
    if(st.readTex){gl.deleteTexture(st.readTex);gl.deleteTexture(st.writeTex);gl.deleteFramebuffer(st.readFbo);gl.deleteFramebuffer(st.writeFbo);}
    st.w=w;st.h=h;
    st.readTex=makeBufTex(w,h);st.writeTex=makeBufTex(w,h);
    st.readFbo=makeFbo(st.readTex);st.writeFbo=makeFbo(st.writeTex);
    clearFbo(st.readFbo,w,h);clearFbo(st.writeFbo,w,h);
  }
}
function resolveInputs(pass,phase){
  var channels=[black,black,black,black];
  var res=[[1,1,1],[1,1,1],[1,1,1],[1,1,1]];
  var list=pass.inputs||[];
  for(var j=0;j<list.length;j++){
    var inp=list[j];
    var ch=inp.channel|0;
    if(ch<0||ch>3)continue;
    if(inp.kind==='keyboard'){channels[ch]=kb.tex;res[ch]=[kb.w,kb.h,1];}
    else if(inp.kind==='buffer'&&inp.id&&idToState[inp.id]){
      var st=idToState[inp.id];
      channels[ch]=phase==='buffer'?st.readTex:st.writeTex;
      res[ch]=[st.w,st.h,1];
    } else {channels[ch]=black;res[ch]=[1,1,1];}
  }
  return {channels:channels,res:res};
}
function setGlobals(st,W,H,t,dt,frameIdx,mouseVec,dateVec){
  var u=st.uni;
  if(u.iResolution)gl.uniform3f(u.iResolution,W,H,1);
  if(u.iTime)gl.uniform1f(u.iTime,t);
  if(u.iTimeDelta)gl.uniform1f(u.iTimeDelta,dt);
  if(u.iFrame)gl.uniform1i(u.iFrame,frameIdx);
  if(u.iFrameRate)gl.uniform1f(u.iFrameRate,dt>1e-8?1.0/dt:0);
  if(u.iMouse)gl.uniform4f(u.iMouse,mouseVec[0],mouseVec[1],mouseVec[2],mouseVec[3]);
  if(u.iDate)gl.uniform4f(u.iDate,dateVec[0],dateVec[1],dateVec[2],dateVec[3]);
  if(u.iSampleRate)gl.uniform1f(u.iSampleRate,44100);
}
function bindChannel(loc,unit,tex){if(!loc)return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(loc,unit);}
var resizeFlag=1;
new ResizeObserver(function(){resizeFlag=1;}).observe(canvas);
function sync(){
  var pr=window.devicePixelRatio||1;
  var dw=Math.max(2,Math.floor(canvas.clientWidth*pr));
  var dh=Math.max(2,Math.floor(canvas.clientHeight*pr));
  if(canvas.width!==dw||canvas.height!==dh){canvas.width=dw;canvas.height=dh;alloc(dw,dh);}
  resizeFlag=0;
}
var mouse={x:0,y:0,cx:0,cy:0,down:0,click:0};
function nxy(e){var r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];}
canvas.addEventListener('mousemove',function(e){var p=nxy(e);mouse.x=p[0];mouse.y=p[1];});
canvas.addEventListener('mousedown',function(e){var p=nxy(e);mouse.x=mouse.cx=p[0];mouse.y=mouse.cy=p[1];mouse.down=1;mouse.click=1;});
canvas.addEventListener('mouseup',function(){mouse.down=0;});
canvas.addEventListener('mouseleave',function(){mouse.down=0;});
window.addEventListener('keydown',function(e){kb.keys.add(e.keyCode);});
window.addEventListener('keyup',function(e){kb.keys.delete(e.keyCode);});
var start=performance.now(),lastNow=0,frameIdx=0;
function frame(now){
  requestAnimationFrame(frame);
  if(resizeFlag)sync();
  var W=canvas.width,H=canvas.height;
  if(W<2||H<2)return;
  updateKb(kb);
  var t=(now-start)/1000;
  var dt=lastNow>0?(now-lastNow)/1000:0;lastNow=now;
  var d=new Date();
  var dateVec=[d.getFullYear(),d.getMonth()+1,d.getDate(),d.getHours()*3600+d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1000];
  var mx=mouse.x*W,my=H-mouse.y*H,mcx=mouse.cx*W,mcy=H-mouse.cy*H;
  var mouseVec=[mouse.down?mx:0,mouse.down?my:0,mouse.down?Math.abs(mcx):-Math.abs(mcx),mouse.click?Math.abs(mcy):-Math.abs(mcy)];
  for(var i=0;i<passes.length;i++){
    var st=passes[i];
    var phase=st.pass.kind==='buffer'?'buffer':'image';
    if(phase==='buffer'){gl.bindFramebuffer(gl.FRAMEBUFFER,st.writeFbo);gl.viewport(0,0,W,H);}
    else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,W,H);}
    gl.useProgram(st.prog);
    setGlobals(st,W,H,t,dt,frameIdx,mouseVec,dateVec);
    var inp=resolveInputs(st.pass,phase);
    for(var ci=0;ci<4;ci++){
      var cr=st.uni['iChannelResolution['+ci+']'];if(cr)gl.uniform3f(cr,inp.res[ci][0],inp.res[ci][1],inp.res[ci][2]);
      var ct=st.uni['iChannelTime['+ci+']'];if(ct)gl.uniform1f(ct,0);
      bindChannel(st.uni['iChannel'+ci],ci,inp.channels[ci]);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER,quad);
    var ap=gl.getAttribLocation(st.prog,'_pos');
    gl.enableVertexAttribArray(ap);
    gl.vertexAttribPointer(ap,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  for(var k=0;k<passes.length;k++){
    var sb=passes[k];
    if(sb.pass.kind!=='buffer')continue;
    var tmp=sb.readTex;sb.readTex=sb.writeTex;sb.writeTex=tmp;
    gl.bindFramebuffer(gl.FRAMEBUFFER,sb.readFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sb.readTex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,sb.writeFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sb.writeTex,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  }
  mouse.click=0;frameIdx++;
}
requestAnimationFrame(frame);
})();`;
