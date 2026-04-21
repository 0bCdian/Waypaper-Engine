import { buildFragmentShader, detectCubeChannels } from "./glslPrefix";

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
var VS2='#version 300 es\\nin vec2 _pos;\\nvoid main(){gl_Position=vec4(_pos,0.,1.);}';
var VS1='attribute vec2 _pos;\\nvoid main(){gl_Position=vec4(_pos,0.,1.);}';
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
  var mx=mouse.x*W,my=H-mouse.y*H,mcx=mouse.cx*W,mcy=H-mouse.cy*H;
  gl.uniform4f(u('iMouse'),mouse.down?mx:0,mouse.down?my:0,mouse.down?Math.abs(mcx):-Math.abs(mcx),mouse.click?Math.abs(mcy):-Math.abs(mcy));
  var d=new Date();
  gl.uniform4f(u('iDate'),d.getFullYear(),d.getMonth(),d.getDate(),d.getHours()*3600+d.getMinutes()*60+d.getSeconds()+d.getMilliseconds()/1000);
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
