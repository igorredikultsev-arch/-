/* Объёмная шина без библиотек: один фрагментный шейдер (raymarching), ~10 КБ.
   Tire3D.mount(canvas, opts) → { set(params), destroy() }.
   Шина и диск считаются формулами, надпись на боковине — из 2D-холста (название сервиса).
   Экономия: рисуем только пиксели внутри сферы вокруг колеса, плотность пикселей ≤ 1.5,
   стоп при уходе с экрана и в скрытой вкладке, при prefers-reduced-motion — один кадр. */
(function () {
  const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  const FS = `
precision highp float;
uniform vec2 uRes;
uniform float uYaw,uPitch,uSpin,uExp,uOff,uSpoke,uTrail,uScan;
uniform vec3 uAcc,uKey,uBg;
uniform float uOpaque;
uniform sampler2D uSide;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float box2(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
const float TAU=6.2831853;
vec3 toLocal(vec3 p){p.x-=uOff;p.xz=rot(uYaw)*p.xz;p.yz=rot(uPitch)*p.yz;return p;}
// x: расстояние, y: материал (1 резина, 2 диск, 3 тормозной диск, 4 суппорт, 5 гайки)
vec2 map(vec3 p0){
  vec3 p=toLocal(p0);
  vec3 s=p;s.xy=rot(uSpin)*s.xy;
  float r=length(s.xy),z=s.z,a=atan(s.y,s.x);
  // резина: скруглённое сечение, боковина чуть выпуклая
  float bul=.018*sin(3.14159*clamp((r-.6)/.4,0.,1.));
  float dt=box2(vec2(r-.80,z),vec2(.20,.20+bul),.11);
  if(r>.9){
    float N=60.;
    float az=abs(z);
    float sh=a*N/TAU+az*6.+step(.07,az)*.5;
    float dc=(.5-abs(fract(sh)-.5))*TAU*r/N-.010;
    float gz=abs(az-.07)-.010;
    float cut=max(.972-r,min(dc,gz));
    dt=max(dt,-cut);
  }
  vec2 res=vec2(dt,1.);
  // диск: обод, закраина, спицы, ступица
  float zf=.035+.11*smoothstep(.12,.56,r);
  float barrel=max(abs(r-.585)-.016,abs(z+.02)-.19);
  float lip=length(vec2(r-.605,z-.175))-.022;
  float sec=TAU/uSpoke;
  float am=mod(a+sec*.5,sec)-sec*.5;
  vec2 q=vec2(cos(am),sin(am))*r;
  float w=mix(.085,.05,smoothstep(.16,.56,r));
  float sp=abs(q.y)-w;
  float slot=abs(q.y)-smoothstep(.30,.56,r)*.016;
  sp=max(sp,-slot);
  float spoke=max(sp,abs(z-zf)-.03)-.004;
  spoke=max(spoke,r-.58);
  float hub=max(r-.16,abs(z-.04)-.045);
  float rim=smin(min(barrel,lip),spoke,.03);
  rim=smin(rim,hub,.04);
  if(rim<res.x)res=vec2(rim,2.);
  // гайки
  float ln=mod(a,sec)-sec*.5;
  vec2 lq=vec2(cos(ln),sin(ln))*r-vec2(.105,0.);
  float nut=max(length(lq)-.024,abs(z-.095)-.018);
  if(nut<res.x)res=vec2(nut,5.);
  // тормозной диск (крутится), суппорт (не крутится)
  float disc=max(max(r-.44,.17-r),abs(z+.035)-.014);
  if(disc<res.x)res=vec2(disc,3.);
  vec2 cp=p.xy;cp=rot(-.75)*cp;
  float cr=length(cp),ca=atan(cp.y,cp.x);
  float cal=max(max(abs(cr-.415)-.06,abs(ca)*cr-.13),abs(z+.025)-.05)-.012;
  if(cal<res.x)res=vec2(cal,4.);
  return res;
}
vec3 nrm(vec3 p){vec2 e=vec2(.0012,-.0012);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
vec3 env(vec3 d){
  float top=smoothstep(.55,.98,d.y);
  float strip=smoothstep(.06,.0,abs(d.x+.35))*smoothstep(.2,.6,d.y);
  float left=pow(max(0.,dot(d,normalize(vec3(-.9,.35,.5)))),18.);
  float back=pow(max(0.,dot(d,normalize(vec3(.95,.15,-.35)))),10.);
  vec3 c=vec3(.006)+vec3(.9,.92,.95)*top*.9+vec3(1.)*strip*.6+vec3(1.,.98,.95)*left*1.6;
  c+=uAcc*back*.7;
  c+=vec3(.03)*smoothstep(-.1,-.5,d.y);
  return c;
}
float ao(vec3 p,vec3 n){float o=0.,s=1.;for(int i=1;i<5;i++){float h=.025*float(i);o+=(h-map(p+n*h).x)*s;s*=.6;}return clamp(1.-2.2*o,0.,1.);}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*uRes)/uRes.y;
  vec3 ro=vec3(0.,0.,3.4),rd=normalize(vec3(uv*.78,-1.));
  vec3 cc=vec3(uOff,0.,0.);
  vec3 oc=ro-cc;float b=dot(oc,rd),c=dot(oc,oc)-1.08;float h=b*b-c;
  if(h<0.){gl_FragColor=vec4(uBg,uOpaque);return;}
  float t=-b-sqrt(h),tmax=-b+sqrt(h);vec2 m=vec2(1.,0.);bool hit=false;float md=1e9;
  for(int i=0;i<96;i++){vec3 p=ro+rd*t;m=map(p);md=min(md,m.x/t);if(m.x<.0007){hit=true;break;}t+=m.x*.8;if(t>tmax)break;}
  // мягкий край силуэта вместо «лесенки»
  if(!hit){float e=1.-smoothstep(0.,1.6/uRes.y,md);gl_FragColor=vec4(mix(uBg,vec3(.012),e*(1.-uOpaque)+e*uOpaque),max(uOpaque,e));return;}
  vec3 p=ro+rd*t,n=nrm(p),v=-rd,rf=reflect(rd,n);
  vec3 L=normalize(uKey);
  float dif=max(dot(n,L),0.),occ=ao(p,n);
  float fre=pow(1.-max(dot(n,v),0.),5.);
  vec3 col;
  if(m.y<1.5){
    vec3 lp=toLocal(p);vec3 sp=lp;sp.xy=rot(uSpin)*sp.xy;
    float letters=0.;
    if(sp.z>.12){vec2 tuv=sp.xy*.47+.5;letters=texture2D(uSide,vec2(tuv.x,1.-tuv.y)).r;}
    vec3 alb=mix(vec3(.016,.017,.019),vec3(.13),letters);
    float spec=pow(max(dot(rf,L),0.),24.)*(.10+letters*.35);
    col=alb*(dif*1.5+.08)+vec3(spec)+env(rf)*(.025+.4*fre);
    col*=occ;
  }else if(m.y<2.5){
    vec3 nl=n;nl.xz=rot(uYaw)*nl.xz;nl.yz=rot(uPitch)*nl.yz;
    float face=smoothstep(.75,.97,nl.z);
    vec3 base=mix(vec3(.16,.17,.18),vec3(.85,.87,.9),face);
    col=env(rf)*base*(.6+.4*fre)+base*dif*.25+vec3(pow(max(dot(rf,L),0.),70.))*(.3+.7*face);
    col*=.4+.6*occ;
  }else if(m.y<3.5){
    vec3 lp=toLocal(p);vec3 sp=lp;sp.xy=rot(uSpin)*sp.xy;
    float an=atan(sp.y,sp.x),rr=length(sp.xy);
    vec2 hc=vec2(fract(an*24./TAU)-.5,fract(rr*14.)-.5);float hole=step(length(hc*vec2(1.6,1.)),.22)*step(.25,rr)*step(rr,.41);
    vec3 base=vec3(.30)*(1.-hole*.85)*(.9+.1*sin(rr*400.));
    col=base*(dif*.8+.1)+env(rf)*.25*base*2.;col*=occ;
  }else if(m.y<4.5){
    col=uAcc*uAcc*(dif*1.3+.25)+env(rf)*.18+vec3(pow(max(dot(rf,L),0.),50.))*.5;col*=.5+.5*occ;
  }else{
    col=env(rf)*.8+vec3(.08)*dif;col*=occ;
  }
  // скан-линия (используется в направлении «Сканер»)
  if(uScan>0.){float sl=abs(p.x-uScan);col+=uAcc*smoothstep(.03,0.,sl)*1.2;}
  col*=uExp;
  col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  gl_FragColor=vec4(col,1.);
}`;

  function sideTexture(text, marks) {
    const S = 512, c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
    // Уровень текста на боковине: радиус 0.80 в координатах шины → 0.80*0.47*S
    const R = 0.80 * 0.47 * S;
    const draw = (str, size, weight, bottom) => {
      g.font = `${weight} ${size}px "Unbounded","Arial Black",sans-serif`;
      let tot = 0; const ws = [...str].map((ch) => { const w = g.measureText(ch).width + size * 0.06; tot += w; return w; });
      const r = bottom ? R + size * 0.35 : R;
      let ang = bottom ? tot / r / 2 : -tot / r / 2;
      [...str].forEach((ch, i) => {
        const d = ws[i] / r, mid = bottom ? ang - d / 2 : ang + d / 2;
        g.save(); g.rotate(mid); g.translate(0, bottom ? r : -r); g.fillText(ch, 0, 0); g.restore();
        ang += bottom ? -d : d;
      });
    };
    draw(text, 25, 800, false);
    draw(marks, 15, 600, true);
    return c;
  }

  function mount(canvas, opts = {}) {
    const gl = canvas.getContext("webgl", { alpha: !opts.bg, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: !!opts.bg });
    if (!gl) { canvas.dispatchEvent(new CustomEvent("tire3d:fail")); return null; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ["uRes", "uYaw", "uPitch", "uSpin", "uExp", "uOff", "uSpoke", "uTrail", "uScan", "uAcc", "uKey", "uSide", "uBg", "uOpaque"].forEach((k) => (U[k] = gl.getUniformLocation(pr, k)));
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const upTex = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sideTexture(opts.text || "ШИНОМОНТАЖ", opts.marks || "225/55 R17 • M+S")); };
    upTex();
    if (document.fonts) document.fonts.ready.then(() => { upTex(); draw(); });
    const P = Object.assign({ yaw: 0.55, pitch: -0.08, spin: 0, exp: 1, off: 0, spokes: 5, trail: 0, scan: 0, accent: [0.9, 0.12, 0.1], key: [-0.6, 0.7, 0.6] }, opts.params || {});
    let maxDpr = opts.maxDpr || 1.5;
    function resize() {
      const r = canvas.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, maxDpr);
      const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    }
    function draw() {
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      // След (размытие в движении) только на непрозрачном фоне: новый кадр смешивается со старым
      if (opts.bg && P.trail > 0) { gl.enable(gl.BLEND); gl.blendColor(0, 0, 0, 1 - P.trail); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); } else gl.disable(gl.BLEND);
      gl.uniform3fv(U.uBg, opts.bg || [0, 0, 0]); gl.uniform1f(U.uOpaque, opts.bg ? 1 : 0);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uYaw, P.yaw); gl.uniform1f(U.uPitch, P.pitch); gl.uniform1f(U.uSpin, P.spin);
      gl.uniform1f(U.uExp, P.exp); gl.uniform1f(U.uOff, P.off); gl.uniform1f(U.uSpoke, P.spokes);
      gl.uniform1f(U.uTrail, P.trail); gl.uniform1f(U.uScan, P.scan);
      gl.uniform3fv(U.uAcc, P.accent); gl.uniform3fv(U.uKey, P.key); gl.uniform1i(U.uSide, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // Автоподстройка: если кадр дольше ~28 мс, уменьшаем плотность пикселей
    let slow = 0, last = 0;
    function frameCost(now) { if (last) { const dt = now - last; if (dt > 28) slow++; else slow = Math.max(0, slow - 1); if (slow > 20 && maxDpr > 0.75) { maxDpr -= 0.25; slow = 0; } } last = now; }
    window.addEventListener("resize", draw);
    draw();
    return {
      set(p) { Object.assign(P, p); },
      draw(now) { frameCost(now); draw(); },
      get params() { return P; },
      destroy() { window.removeEventListener("resize", draw); },
    };
  }

  // ?t=секунды в адресе останавливает время: так снимаются кадры анимации
  const FZ = parseFloat(new URLSearchParams(location.search).get("t"));
  const now = () => (isNaN(FZ) ? performance.now() / 1000 : FZ);

  /** Простой цикл: tick(t) возвращает параметры; стоп вне экрана и в фоне. */
  function loop(canvas, tire, tick) {
    if (!isNaN(FZ)) { tire.set(Object.assign(tick(FZ), { trail: 0 })); tire.draw(0); return; }
    let visible = true, raf = 0, t0 = performance.now();
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(f); }, { threshold: 0 });
    io.observe(canvas);
    function f(now) { raf = 0; if (!visible || document.hidden) return; const p = tick((now - t0) / 1000); if (p) tire.set(p); tire.draw(now); if (!p || !p.stop) raf = requestAnimationFrame(f); }
    document.addEventListener("visibilitychange", () => { if (!document.hidden && !raf) raf = requestAnimationFrame(f); });
    raf = requestAnimationFrame(f);
  }

  window.Tire3D = { mount, loop, now, frozen: !isNaN(FZ) };
})();
