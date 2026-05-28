(function () {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  const LASER_VERT = `
precision highp float;
attribute vec3 position;
void main(){
  gl_Position = vec4(position, 1.0);
}
`;

  const LASER_FRAG = `
#ifdef GL_ES
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;
precision mediump int;

uniform float iTime;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform float uWispDensity;
uniform float uTiltScale;
uniform float uFlowTime;
uniform float uFogTime;
uniform float uBeamXFrac;
uniform float uBeamYFrac;
uniform float uFlowSpeed;
uniform float uVLenFactor;
uniform float uHLenFactor;
uniform float uFogIntensity;
uniform float uFogScale;
uniform float uWSpeed;
uniform float uWIntensity;
uniform float uFlowStrength;
uniform float uDecay;
uniform float uFalloffStart;
uniform float uFogFallSpeed;
uniform vec3 uColor;
uniform float uFade;

#define PI 3.14159265359
#define TWO_PI 6.28318530718
#define EPS 1e-6
#define EDGE_SOFT (DT_LOCAL*4.0)
#define DT_LOCAL 0.0038
#define TAP_RADIUS 6
#define R_H 150.0
#define R_V 150.0
#define FLARE_HEIGHT 16.0
#define FLARE_AMOUNT 8.0
#define FLARE_EXP 2.0
#define TOP_FADE_START 0.1
#define TOP_FADE_EXP 1.0
#define FLOW_PERIOD 0.5
#define FLOW_SHARPNESS 1.5

#define W_BASE_X 1.5
#define W_LAYER_GAP 0.25
#define W_LANES 10
#define W_SIDE_DECAY 0.5
#define W_HALF 0.01
#define W_AA 0.15
#define W_CELL 20.0
#define W_SEG_MIN 0.01
#define W_SEG_MAX 0.55
#define W_CURVE_AMOUNT 15.0
#define W_CURVE_RANGE (FLARE_HEIGHT - 3.0)
#define W_BOTTOM_EXP 10.0

#define FOG_ON 1
#define FOG_CONTRAST 1.2
#define FOG_OCTAVES 5
#define FOG_BOTTOM_BIAS 0.8
#define FOG_TILT_MAX_X 0.35
#define FOG_TILT_SHAPE 1.5
#define FOG_BEAM_MIN 0.0
#define FOG_BEAM_MAX 0.75
#define FOG_MASK_GAMMA 0.5
#define FOG_EXPAND_SHAPE 12.2
#define FOG_EDGE_MIX 0.5

#define HFOG_EDGE_START 0.20
#define HFOG_EDGE_END 0.98
#define HFOG_EDGE_GAMMA 1.4
#define HFOG_Y_RADIUS 25.0
#define HFOG_Y_SOFT 60.0

#define EDGE_X0 0.22
#define EDGE_X1 0.995
#define EDGE_X_GAMMA 1.25
#define EDGE_LUMA_T0 0.0
#define EDGE_LUMA_T1 2.0
#define DITHER_STRENGTH 1.0

float g(float x){return x<=0.00031308?12.92*x:1.055*pow(x,1.0/2.4)-0.055;}
float bs(vec2 p,vec2 q,float powr){
    float d=distance(p,q),f=powr*uFalloffStart,r=(f*f)/(d*d+EPS);
    return powr*min(1.0,r);
}
float bsa(vec2 p,vec2 q,float powr,vec2 s){
    vec2 d=p-q; float dd=(d.x*d.x)/(s.x*s.x)+(d.y*d.y)/(s.y*s.y),f=powr*uFalloffStart,r=(f*f)/(dd+EPS);
    return powr*min(1.0,r);
}
float tri01(float x){float f=fract(x);return 1.0-abs(f*2.0-1.0);}
float tauWf(float t,float tmin,float tmax){float a=smoothstep(tmin,tmin+EDGE_SOFT,t),b=1.0-smoothstep(tmax-EDGE_SOFT,tmax,t);return max(0.0,a*b);}
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+34.123);return fract(p.x*p.y);}
float vnoise(vec2 p){
    vec2 i=floor(p),f=fract(p);
    float a=h21(i),b=h21(i+vec2(1,0)),c=h21(i+vec2(0,1)),d=h21(i+vec2(1,1));
    vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float fbm2(vec2 p){
    float v=0.0,amp=0.6; mat2 m=mat2(0.86,0.5,-0.5,0.86);
    for(int i=0;i<FOG_OCTAVES;++i){v+=amp*vnoise(p); p=m*p*2.03+17.1; amp*=0.52;}
    return v;
}
float rGate(float x,float l){float a=smoothstep(0.0,W_AA,x),b=1.0-smoothstep(l,l+W_AA,x);return max(0.0,a*b);}
float flareY(float y){float t=clamp(1.0-(clamp(y,0.0,FLARE_HEIGHT)/max(FLARE_HEIGHT,EPS)),0.0,1.0);return pow(t,FLARE_EXP);}

float vWisps(vec2 uv,float topF){
    float y=uv.y,yf=(y+uFlowTime*uWSpeed)/W_CELL;
    float dRaw=clamp(uWispDensity,0.0,2.0),d=dRaw<=0.0?1.0:dRaw;
    float lanesF=floor(float(W_LANES)*min(d,1.0)+0.5);
    int lanes=int(max(1.0,lanesF));
    float sp=min(d,1.0),ep=max(d-1.0,0.0);
    float fm=flareY(max(y,0.0)),rm=clamp(1.0-(y/max(W_CURVE_RANGE,EPS)),0.0,1.0),cm=fm*rm;
    const float G=0.05; float xS=1.0+(FLARE_AMOUNT*W_CURVE_AMOUNT*G)*cm;
    float sPix=clamp(y/R_V,0.0,1.0),bGain=pow(1.0-sPix,W_BOTTOM_EXP),sum=0.0;
    for(int s=0;s<2;++s){
        float sgn=s==0?-1.0:1.0;
        for(int i=0;i<W_LANES;++i){
            if(i>=lanes) break;
            float off=W_BASE_X+float(i)*W_LAYER_GAP,xc=sgn*(off*xS);
            float dx=abs(uv.x-xc),lat=1.0-smoothstep(W_HALF,W_HALF+W_AA,dx),amp=exp(-off*W_SIDE_DECAY);
            float seed=h21(vec2(off,sgn*17.0)),yf2=yf+seed*7.0,ci=floor(yf2),fy=fract(yf2);
            float seg=mix(W_SEG_MIN,W_SEG_MAX,h21(vec2(ci,off*2.3)));
            float spR=h21(vec2(ci,off+sgn*31.0)),seg1=rGate(fy,seg)*step(spR,sp);
            if(ep>0.0){float spR2=h21(vec2(ci*3.1+7.0,off*5.3+sgn*13.0)); float f2=fract(fy+0.5); seg1+=rGate(f2,seg*0.9)*step(spR2,ep);}
            sum+=amp*lat*seg1;
        }
    }
    float span=smoothstep(-3.0,0.0,y)*(1.0-smoothstep(R_V-6.0,R_V,y));
    return uWIntensity*sum*topF*bGain*span;
}

void mainImage(out vec4 fc,in vec2 frag){
    vec2 C=iResolution.xy*.5; float invW=1.0/max(C.x,1.0);
    vec2 sc=(512.0/iResolution.xy)*.4;
    vec2 uv=(frag-C)*sc,off=vec2(uBeamXFrac*iResolution.x*sc.x,uBeamYFrac*iResolution.y*sc.y);
    vec2 uvc = uv - off;
    float a=0.0,b=0.0;
    float basePhase=1.5*PI+uDecay*.5; float tauMin=basePhase-uDecay; float tauMax=basePhase;
    float cx=clamp(uvc.x/(R_H*uHLenFactor),-1.0,1.0),tH=clamp(TWO_PI-acos(cx),tauMin,tauMax);
    for(int k=-TAP_RADIUS;k<=TAP_RADIUS;++k){
        float tu=tH+float(k)*DT_LOCAL,wt=tauWf(tu,tauMin,tauMax); if(wt<=0.0) continue;
        float spd=max(abs(sin(tu)),0.02),u=clamp((basePhase-tu)/max(uDecay,EPS),0.0,1.0),env=pow(1.0-abs(u*2.0-1.0),0.8);
        vec2 p=vec2((R_H*uHLenFactor)*cos(tu),0.0);
        a+=wt*bs(uvc,p,env*spd);
    }
    float yPix=uvc.y,cy=clamp(-yPix/(R_V*uVLenFactor),-1.0,1.0),tV=clamp(TWO_PI-acos(cy),tauMin,tauMax);
    for(int k=-TAP_RADIUS;k<=TAP_RADIUS;++k){
        float tu=tV+float(k)*DT_LOCAL,wt=tauWf(tu,tauMin,tauMax); if(wt<=0.0) continue;
        float yb=(-R_V)*cos(tu),s=clamp(yb/R_V,0.0,1.0),spd=max(abs(sin(tu)),0.02);
        float env=pow(1.0-s,0.6)*spd;
        float cap=1.0-smoothstep(TOP_FADE_START,1.0,s); cap=pow(cap,TOP_FADE_EXP); env*=cap;
        float ph=s/max(FLOW_PERIOD,EPS)+uFlowTime*uFlowSpeed;
        float fl=pow(tri01(ph),FLOW_SHARPNESS);
        env*=mix(1.0-uFlowStrength,1.0,fl);
        float yp=(-R_V*uVLenFactor)*cos(tu),m=pow(smoothstep(FLARE_HEIGHT,0.0,yp),FLARE_EXP),wx=1.0+FLARE_AMOUNT*m;
        vec2 sig=vec2(wx,1.0),p=vec2(0.0,yp);
        float mask=step(0.0,yp);
        b+=wt*bsa(uvc,p,mask*env,sig);
    }
    float sPix=clamp(yPix/R_V,0.0,1.0),topA=pow(1.0-smoothstep(TOP_FADE_START,1.0,sPix),TOP_FADE_EXP);
    float L=a+b*topA;
    float w=vWisps(vec2(uvc.x,yPix),topA);
    float fog=0.0;
#if FOG_ON
    vec2 fuv=uvc*uFogScale;
    float mAct=step(1.0,length(iMouse.xy)),nx=((iMouse.x-C.x)*invW)*mAct;
    float ax = abs(nx);
    float stMag = mix(ax, pow(ax, FOG_TILT_SHAPE), 0.35);
    float st = sign(nx) * stMag * uTiltScale;
    st = clamp(st, -FOG_TILT_MAX_X, FOG_TILT_MAX_X);
    vec2 dir=normalize(vec2(st,1.0));
    fuv+=uFogTime*uFogFallSpeed*dir;
    vec2 prp=vec2(-dir.y,dir.x);
    fuv+=prp*(0.08*sin(dot(uvc,prp)*0.08+uFogTime*0.9));
    float n=fbm2(fuv+vec2(fbm2(fuv+vec2(7.3,2.1)),fbm2(fuv+vec2(-3.7,5.9)))*0.6);
    n=pow(clamp(n,0.0,1.0),FOG_CONTRAST);
    float pixW = 1.0 / max(iResolution.y, 1.0);
#ifdef GL_OES_standard_derivatives
    float wL = max(fwidth(L), pixW);
#else
    float wL = pixW;
#endif
    float m0=pow(smoothstep(FOG_BEAM_MIN - wL, FOG_BEAM_MAX + wL, L),FOG_MASK_GAMMA);
    float bm=1.0-pow(1.0-m0,FOG_EXPAND_SHAPE); bm=mix(bm*m0,bm,FOG_EDGE_MIX);
    float yP=1.0-smoothstep(HFOG_Y_RADIUS,HFOG_Y_RADIUS+HFOG_Y_SOFT,abs(yPix));
    float nxF=abs((frag.x-C.x)*invW),hE=1.0-smoothstep(HFOG_EDGE_START,HFOG_EDGE_END,nxF); hE=pow(clamp(hE,0.0,1.0),HFOG_EDGE_GAMMA);
    float hW=mix(1.0,hE,clamp(yP,0.0,1.0));
    float bBias=mix(1.0,1.0-sPix,FOG_BOTTOM_BIAS);
    float browserFogIntensity = uFogIntensity;
    browserFogIntensity *= 1.8;
    float radialFade = 1.0 - smoothstep(0.0, 0.7, length(uvc) / 120.0);
    float safariFog = n * browserFogIntensity * bBias * bm * hW * radialFade;
    fog = safariFog;
#endif
    float LF=L+fog;
    float dith=(h21(frag)-0.5)*(DITHER_STRENGTH/255.0);
    float tone=g(LF+w);
    vec3 col=tone*uColor+dith;
    float alpha=clamp(g(L+w*0.6)+dith*0.6,0.0,1.0);
    float nxE=abs((frag.x-C.x)*invW),xF=pow(clamp(1.0-smoothstep(EDGE_X0,EDGE_X1,nxE),0.0,1.0),EDGE_X_GAMMA);
    float scene=LF+max(0.0,w)*0.5,hi=smoothstep(EDGE_LUMA_T0,EDGE_LUMA_T1,scene);
    float eM=mix(xF,1.0,hi);
    col*=eM; alpha*=eM;
    col*=uFade; alpha*=uFade;
    fc=vec4(col,alpha);
}

void main(){
  vec4 fc;
  mainImage(fc, gl_FragCoord.xy);
  gl_FragColor = fc;
}
`;

  function compileLaserShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function initLaserFlowField(container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'laser-flow-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false
    });
    if (!gl) return;

    const vert = compileLaserShader(gl, gl.VERTEX_SHADER, LASER_VERT);
    const frag = compileLaserShader(gl, gl.FRAGMENT_SHADER, LASER_FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);

    const uniforms = {};
    [
      'iTime', 'iResolution', 'iMouse', 'uWispDensity', 'uTiltScale', 'uFlowTime', 'uFogTime',
      'uBeamXFrac', 'uBeamYFrac', 'uFlowSpeed', 'uVLenFactor', 'uHLenFactor', 'uFogIntensity',
      'uFogScale', 'uWSpeed', 'uWIntensity', 'uFlowStrength', 'uDecay', 'uFalloffStart',
      'uFogFallSpeed', 'uColor', 'uFade'
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    const color = { r: 0x70 / 255, g: 0x7e / 255, b: 0xdc / 255 };
    gl.uniform1f(uniforms.uWispDensity, 4);
    gl.uniform1f(uniforms.uTiltScale, 0.01);
    gl.uniform1f(uniforms.uBeamXFrac, 0.1);
    gl.uniform1f(uniforms.uBeamYFrac, -0.50);
    gl.uniform1f(uniforms.uFlowSpeed, 0.56);
    gl.uniform1f(uniforms.uVLenFactor, 2.4);
    gl.uniform1f(uniforms.uHLenFactor, 0.57);
    gl.uniform1f(uniforms.uFogIntensity, 0.68);
    gl.uniform1f(uniforms.uFogScale, 0.28);
    gl.uniform1f(uniforms.uWSpeed, 27);
    gl.uniform1f(uniforms.uWIntensity, 1.7);
    gl.uniform1f(uniforms.uFlowStrength, 0.3);
    gl.uniform1f(uniforms.uDecay, 3);
    gl.uniform1f(uniforms.uFalloffStart, 1.2);
    gl.uniform1f(uniforms.uFogFallSpeed, 1.82);
    gl.uniform3f(uniforms.uColor, color.r, color.g, color.b);

    let dpr = 1;
    let width = 0;
    let height = 0;
    let flowTime = 0;
    let fogTime = 0;
    let fade = 0;
    let last = performance.now();
    const mouse = { x: 0, y: 0 };

    function resizeLaser() {
      const rect = container.getBoundingClientRect();
      dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(uniforms.iResolution, canvas.width, canvas.height, dpr);
    }

    function updateMouse(event) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (event.clientX - rect.left) * dpr;
      mouse.y = (rect.height - (event.clientY - rect.top)) * dpr;
    }

    function render(now) {
      const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
      last = now;
      flowTime += dt;
      fogTime += dt;
      fade = Math.min(1, fade + dt);

      const rect = container.getBoundingClientRect();
      if (rect.width !== width || rect.height !== height) resizeLaser();
      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible) {
        gl.useProgram(program);
        gl.uniform1f(uniforms.iTime, now / 1000);
        gl.uniform4f(uniforms.iMouse, mouse.x, mouse.y, 0, 0);
        gl.uniform1f(uniforms.uFlowTime, flowTime);
        gl.uniform1f(uniforms.uFogTime, fogTime);
        gl.uniform1f(uniforms.uFade, fade);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(render);
    }

    resizeLaser();
    canvas.addEventListener('pointermove', updateMouse, { passive: true });
    canvas.addEventListener('pointerdown', updateMouse, { passive: true });
    canvas.addEventListener('pointerleave', () => {
      mouse.x = 0;
      mouse.y = 0;
    }, { passive: true });
    requestAnimationFrame(render);
  }

  document.querySelectorAll('.laser-field').forEach(initLaserFlowField);

  const TWILIGHT_VERT = `
precision highp float;
attribute vec3 position;
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

  const TWILIGHT_FRAG = `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2  uRes;

uniform float uLineCount;
uniform float uWaveAmp;
uniform float uWaveFreq;
uniform float uLineThickness;
uniform float uLineGlow;
uniform vec3  uLineColor;
uniform float uLineIntensity;

uniform vec3  uPulseColor;
uniform float uPulseSpeed;
uniform float uPulseWidth;
uniform float uPulseIntensity;
uniform float uPulsePhase;
uniform float uPulseWidthScale;
uniform float uPulseBoost;

uniform float uChroma;
uniform vec3  uBg;
uniform float uAlpha;

vec3 sampleField(vec2 fragCoord) {
  vec2 uv = (fragCoord * 2.0 - uRes) / uRes.y;

  float sway = cos(uv.x * uWaveFreq) * uWaveAmp;
  float dist = abs(fract((uv.y + sway) * uLineCount) - 0.5);
  float lineMask = uLineGlow / max(dist, uLineThickness);
  vec3 col = uLineColor * uLineIntensity * lineMask;

  float pulse = abs(fract((uv.x - uPulsePhase) * uPulseSpeed) - 0.5);
  float bell  = exp(-pulse * pulse * uPulseWidth * uPulseWidthScale);
  float hot   = (uLineGlow * 0.5) / max(dist, uLineThickness * 0.1);
  col += uPulseColor * bell * hot * uPulseIntensity * uPulseBoost;

  return col;
}

void main() {
  vec2 fragCoord = vUv * uRes;

  vec2 ndc = vUv - 0.5;
  vec2 offset = ndc * length(ndc) * uChroma * 0.5;

  vec3 r = sampleField(fragCoord + offset * uRes);
  vec3 g = sampleField(fragCoord);
  vec3 b = sampleField(fragCoord - offset * uRes);

  vec3 col = vec3(r.r, g.g, b.b);
  col = clamp(col, 0.0, 1.0);
  col = mix(uBg, col + uBg * (1.0 - clamp(dot(col, vec3(1.0)), 0.0, 1.0)), 1.0);

  gl_FragColor = vec4(col, uAlpha);
}
`;

  function hexToRgb(hex) {
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!match) return [0, 0, 0];
    return [
      parseInt(match[1], 16) / 255,
      parseInt(match[2], 16) / 255,
      parseInt(match[3], 16) / 255
    ];
  }

  function initTwilightLines(container) {
    const canvas = document.createElement('canvas');
    canvas.className = 'twilight-lines-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(canvas);

    const gl = canvas.getContext('webgl', {
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false
    });
    if (!gl) return;

    const vert = compileLaserShader(gl, gl.VERTEX_SHADER, TWILIGHT_VERT);
    const frag = compileLaserShader(gl, gl.FRAGMENT_SHADER, TWILIGHT_FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);

    const uniforms = {};
    [
      'uTime', 'uRes', 'uLineCount', 'uWaveAmp', 'uWaveFreq', 'uLineThickness',
      'uLineGlow', 'uLineColor', 'uLineIntensity', 'uPulseColor', 'uPulseSpeed',
      'uPulseWidth', 'uPulseIntensity', 'uPulsePhase', 'uPulseWidthScale',
      'uPulseBoost', 'uChroma', 'uBg', 'uAlpha'
    ].forEach((name) => {
      uniforms[name] = gl.getUniformLocation(program, name);
    });

    const line = hexToRgb('#4D33CC');
    const pulse = hexToRgb('#CC4D4D');
    const bg = hexToRgb('#000000');
    gl.uniform1f(uniforms.uLineCount, 2);
    gl.uniform1f(uniforms.uWaveAmp, 0.5);
    gl.uniform1f(uniforms.uWaveFreq, 1.8);
    gl.uniform1f(uniforms.uLineThickness, 0.05);
    gl.uniform1f(uniforms.uLineGlow, 0.01);
    gl.uniform3f(uniforms.uLineColor, line[0], line[1], line[2]);
    gl.uniform1f(uniforms.uLineIntensity, 3);
    gl.uniform3f(uniforms.uPulseColor, pulse[0], pulse[1], pulse[2]);
    gl.uniform1f(uniforms.uPulseSpeed, 0.25);
    gl.uniform1f(uniforms.uPulseWidth, 35);
    gl.uniform1f(uniforms.uPulseIntensity, 5.5);
    gl.uniform1f(uniforms.uChroma, 0.05);
    gl.uniform3f(uniforms.uBg, bg[0], bg[1], bg[2]);
    gl.uniform1f(uniforms.uAlpha, 1);

    let dpr = 1;
    let width = 0;
    let height = 0;
    let last = performance.now();
    let pulseWidthScale = 1;
    const pointer = {
      active: false,
      nx: 0.5,
      ny: 0.5,
      targetPhase: 0,
      smoothedPhase: 0,
      timePhase: 0,
      click: 0,
      wasActive: false
    };

    function resizeTwilight() {
      const rect = container.getBoundingClientRect();
      dpr = clamp(window.devicePixelRatio || 1, 1, 1.5);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    }

    function updatePointer(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.nx = (event.clientX - rect.left) / Math.max(rect.width, 1);
      pointer.ny = (event.clientY - rect.top) / Math.max(rect.height, 1);
      pointer.active = true;
    }

    function render(now) {
      const delta = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
      last = now;

      const rect = container.getBoundingClientRect();
      if (rect.width !== width || rect.height !== height) resizeTwilight();
      const aspect = width / Math.max(height, 1);

      if (pointer.active) {
        pointer.targetPhase = (pointer.nx * 2 - 1) * aspect;
        pointer.smoothedPhase += (pointer.targetPhase - pointer.smoothedPhase) * 0.12;
        gl.uniform1f(uniforms.uPulsePhase, pointer.smoothedPhase);
        pulseWidthScale = 0.5 + (1 - pointer.ny) * 1.5;
        gl.uniform1f(uniforms.uPulseWidthScale, pulseWidthScale);
      } else {
        if (pointer.wasActive) pointer.timePhase = pointer.smoothedPhase;
        pointer.timePhase += delta;
        pointer.smoothedPhase += (pointer.timePhase - pointer.smoothedPhase) * 0.15;
        gl.uniform1f(uniforms.uPulsePhase, pointer.smoothedPhase);
        pulseWidthScale += (1 - pulseWidthScale) * 0.1;
        gl.uniform1f(uniforms.uPulseWidthScale, pulseWidthScale);
      }
      pointer.wasActive = pointer.active;
      pointer.click = Math.max(0, pointer.click - delta * 2.5);

      const visible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (visible) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uniforms.uTime, now / 1000);
        gl.uniform1f(uniforms.uPulseBoost, 1 + pointer.click * 1.5);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(render);
    }

    resizeTwilight();
    gl.uniform1f(uniforms.uPulseWidthScale, 1);
    canvas.addEventListener('pointermove', updatePointer, { passive: true });
    canvas.addEventListener('pointerenter', updatePointer, { passive: true });
    canvas.addEventListener('pointerleave', () => {
      pointer.active = false;
    }, { passive: true });
    canvas.addEventListener('pointerdown', (event) => {
      updatePointer(event);
      pointer.click = 1;
    }, { passive: true });
    requestAnimationFrame(render);
  }

  document.querySelectorAll('.twilight-lines').forEach(initTwilightLines);

  const dots = document.querySelectorAll('.dot-field');
  window.addEventListener('pointermove', (event) => {
    const x = (event.clientX / window.innerWidth * 100).toFixed(2) + '%';
    const y = (event.clientY / window.innerHeight * 100).toFixed(2) + '%';
    dots.forEach((el) => {
      el.style.setProperty('--mx', x);
      el.style.setProperty('--my', y);
    });
  }, { passive: true });

  const canvas = document.getElementById('splash-cursor');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let hue = 205;
  const splashes = [];
  const pointer = { x: -9999, y: -9999, px: -9999, py: -9999 };

  function resize() {
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function addSplash(x, y, force) {
    hue = (hue + 18) % 360;
    splashes.push({
      x,
      y,
      r: 6 + force * 0.07,
      life: 1,
      hue,
      vx: (Math.random() - .5) * force * .01,
      vy: (Math.random() - .5) * force * .01
    });
    if (splashes.length > 26) splashes.splice(0, splashes.length - 26);
  }

  function onPointerMove(event) {
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;

    const dx = pointer.x - pointer.px;
    const dy = pointer.y - pointer.py;
    const speed = Math.sqrt(dx * dx + dy * dy);
    if (speed > 7) addSplash(pointer.x, pointer.y, clamp(speed, 8, 64));
  }

  function onPointerDown(event) {
    for (let i = 0; i < 4; i += 1) {
      addSplash(event.clientX + (Math.random() - .5) * 20, event.clientY + (Math.random() - .5) * 20, 42 + Math.random() * 26);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = splashes.length - 1; i >= 0; i -= 1) {
      const splash = splashes[i];
      splash.x += splash.vx;
      splash.y += splash.vy;
      splash.r += .9 + (1 - splash.life) * 3.2;
      splash.life *= .925;

      const gradient = ctx.createRadialGradient(splash.x, splash.y, 0, splash.x, splash.y, splash.r);
      gradient.addColorStop(0, `hsla(${splash.hue}, 96%, 68%, ${splash.life * .42})`);
      gradient.addColorStop(.42, `hsla(${(splash.hue + 48) % 360}, 96%, 64%, ${splash.life * .22})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(splash.x, splash.y, splash.r, 0, Math.PI * 2);
      ctx.fill();

      if (splash.life < .025) splashes.splice(i, 1);
    }

    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  requestAnimationFrame(draw);
})();
