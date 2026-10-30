/*
 * FORM — Procedural Fine Art Engine
 * Deterministic, browser-local generative art. No model, API key, or network request.
 * Requires p5.js 1.9+ in global mode.
 */
(function (root) {
  'use strict';

  const VERSION = '2.1.0';

  const STYLES = [
    { id: 0, name: 'Luminous Color Field', ko: '빛의 색면', palette: [[25,29,39],[117,65,65],[190,119,89],[226,190,145],[239,224,199]], bg: [18,20,27], note: '넓은 색면과 흐릿한 경계, 겹쳐진 투명층을 이용해 색의 온도와 공간감을 만듭니다.' },
    { id: 1, name: 'Constructed Geometry', ko: '구축적 기하', palette: [[18,24,31],[231,220,195],[194,54,43],[48,91,133],[218,169,65]], bg: [232,225,209], note: '비대칭 격자, 제한된 원색, 두께가 다른 구조선을 통해 균형과 긴장을 구성합니다.' },
    { id: 2, name: 'Gesture & Ink', ko: '제스처와 먹', palette: [[20,23,27],[48,52,58],[116,73,55],[181,126,88],[228,218,197]], bg: [222,213,192], note: '속도와 압력이 다른 선의 중첩, 끊김, 여백을 통해 몸의 움직임을 흔적으로 남깁니다.' },
    { id: 3, name: 'Stratified Surface', ko: '퇴적된 표면', palette: [[34,42,48],[75,91,94],[147,145,126],[199,174,139],[224,213,190]], bg: [37,43,47], note: '수평으로 쌓인 안료층과 긁힌 흔적, 부분적인 노출을 통해 시간의 층위를 표현합니다.' },
    { id: 4, name: 'Topographic Flow', ko: '지형적 흐름', palette: [[23,45,53],[42,93,101],[104,139,129],[188,177,143],[219,205,173]], bg: [17,31,37], note: '연속적인 흐름선과 등고선의 밀도 차이로 보이지 않는 힘의 장을 시각화합니다.' },
    { id: 5, name: 'Optical Rhythm', ko: '광학적 리듬', palette: [[18,22,30],[241,235,218],[190,55,93],[32,148,143],[213,169,83]], bg: [236,231,216], note: '반복되는 파형의 위상과 간격을 미세하게 변화시켜 정지 화면 안에 진동을 만듭니다.' },
    { id: 6, name: 'Quiet Monument', ko: '고요한 기념비', palette: [[22,25,29],[78,84,86],[153,145,126],[207,194,169],[235,226,207]], bg: [224,217,200], note: '단순한 덩어리와 넓은 여백, 제한된 색으로 형태의 무게와 침묵을 강조합니다.' },
    { id: 7, name: 'Biomorphic Garden', ko: '생물형 정원', palette: [[29,57,49],[66,113,86],[139,158,116],[207,178,133],[225,211,184]], bg: [26,39,35], note: '세포·잎·씨앗을 연상시키는 유기적 형태를 반복하되 크기와 방향을 불규칙하게 변주합니다.' },
    { id: 8, name: 'Chromatic Pointillism', ko: '색점의 대기', palette: [[38,57,83],[80,119,150],[190,157,118],[226,203,163],[230,224,204]], bg: [33,48,65], note: '서로 다른 크기와 온도의 색점을 밀도 있게 배치해 빛과 공기의 인상을 쌓아 올립니다.' },
    { id: 9, name: 'Fractured Planes', ko: '분절된 평면', palette: [[25,34,49],[57,91,127],[142,83,86],[210,160,111],[232,219,193]], bg: [22,28,39], note: '잘린 다각형 평면과 겹침, 그림자, 색의 단차를 이용해 한 화면 안에 여러 공간을 만듭니다.' },
    { id: 10, name: 'Mineral & Gold', ko: '광물과 금박', palette: [[20,23,28],[69,70,66],[139,113,75],[198,166,100],[231,211,158]], bg: [16,19,23], note: '어두운 바탕 위에 금속성 맥과 광물 입자를 얹어 균열과 퇴적의 물성을 표현합니다.' },
    { id: 11, name: 'Atmospheric Impression', ko: '대기의 인상', palette: [[52,83,105],[104,139,155],[190,171,143],[224,197,155],[237,221,190]], bg: [48,70,84], note: '짧은 붓질과 색의 병치, 밝은 중심부를 통해 특정한 풍경보다 빛의 순간을 포착합니다.' }
  ];

  function hashSeed(value) {
    const str = String(value == null ? 'FORM' : value);
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function normalizeSeed(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return (Math.abs(Math.trunc(value)) >>> 0) || 1;
    const text = String(value == null ? '' : value).trim();
    if (/^\d+$/.test(text)) return (Number(text) >>> 0) || 1;
    return hashSeed(text || 'FORM');
  }

  function styleFor(id) {
    const n = Number.isFinite(Number(id)) ? Math.trunc(Number(id)) : 0;
    return STYLES[((n % STYLES.length) + STYLES.length) % STYLES.length];
  }

  function pick(p, list) { return list[Math.floor(p.random(list.length))]; }
  function rgba(p, c, a) { p.fill(c[0], c[1], c[2], a); }
  function stroke(p, c, a, weight) { p.stroke(c[0], c[1], c[2], a); p.strokeWeight(weight); }

  function radialWash(p, w, h, colors, seed) {
    const ctx = p.drawingContext;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    for (let i = 0; i < 5; i++) {
      const x = w * (0.18 + p.noise(seed * 0.001 + i * 3.7) * 0.64);
      const y = h * (0.16 + p.noise(seed * 0.002 + i * 5.1) * 0.68);
      const r = w * (0.24 + p.noise(i * 9.2 + seed) * 0.35);
      const c = colors[(i + 1) % colors.length];
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.24)`);
      g.addColorStop(0.55, `rgba(${c[0]},${c[1]},${c[2]},0.09)`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function paperAndFrame(p, w, h, style) {
    const light = style.bg.reduce((a, v) => a + v, 0) > 400;
    const ink = light ? [31, 31, 30] : [241, 235, 220];
    p.push();
    p.noFill();
    p.stroke(ink[0], ink[1], ink[2], 18);
    p.strokeWeight(w * 0.0012);
    p.rect(w * 0.026, h * 0.026, w * 0.948, h * 0.948);
    p.stroke(ink[0], ink[1], ink[2], 9);
    p.strokeWeight(w * 0.00055);
    p.rect(w * 0.035, h * 0.035, w * 0.93, h * 0.93);
    p.pop();
    // Restrained paper grain: sparse marks preserve clarity at preview and print sizes.
    p.push();
    for (let i = 0; i < Math.max(1200, Math.floor(w * 1.15)); i++) {
      const x = p.random(w), y = p.random(h), a = p.random(3, 13);
      p.stroke(ink[0], ink[1], ink[2], a);
      p.strokeWeight(p.random(w * 0.00025, w * 0.0007));
      p.point(x, y);
    }
    p.pop();
  }

  function colorField(p, w, h, pal) {
    const ctx = p.drawingContext;
    const cx = w * (0.35 + p.random(0.3)), cy = h * (0.32 + p.random(0.36));
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 8; i++) {
      const c = pick(p, pal), x = cx + p.random(-w * .18, w * .18), y = cy + p.random(-h * .2, h * .2);
      const rx = p.random(w * .18, w * .55), ry = p.random(h * .12, h * .42);
      const g = ctx.createRadialGradient(x, y, Math.min(rx, ry) * .08, x, y, Math.max(rx, ry));
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${p.random(.14,.27)})`);
      g.addColorStop(.55, `rgba(${c[0]},${c[1]},${c[2]},${p.random(.05,.12)})`);
      g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, p.random(-.25,.25), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    p.push();
    for (let i = 0; i < 18; i++) {
      const c = pick(p, pal), x = p.random(w * .08, w * .82), y = p.random(h * .08, h * .82);
      p.noStroke(); p.fill(c[0],c[1],c[2],p.random(8,25));
      p.ellipse(x,y,p.random(w*.12,w*.48),p.random(h*.025,h*.13));
    }
    p.pop();
  }

  function geometry(p, w, h, pal) {
    const m = w * .105, cols = 5, rows = 5;
    const xs = [m]; for (let i=1;i<cols;i++) xs.push(m + (w-2*m)*i/cols + p.random(-w*.035,w*.035)); xs.push(w-m);
    const ys = [m]; for (let i=1;i<rows;i++) ys.push(m + (h-2*m)*i/rows + p.random(-h*.035,h*.035)); ys.push(h-m);
    const dark = [18,21,25];
    p.push();
    // A quiet underlying grid anchors the irregular blocks.
    p.stroke(dark[0],dark[1],dark[2],105); p.strokeWeight(w*.0032);
    for(let i=0;i<xs.length;i++) p.line(xs[i],m,xs[i],h-m);
    for(let j=0;j<ys.length;j++) p.line(m,ys[j],w-m,ys[j]);
    const accents = pal.slice(1);
    for(let i=0;i<cols;i++) for(let j=0;j<rows;j++) {
      if(p.random() < .46) continue;
      const x=xs[i]+w*.003,y=ys[j]+h*.003,ww=xs[i+1]-xs[i]-w*.006,hh=ys[j+1]-ys[j]-h*.006;
      const c=pick(p,accents); p.noStroke(); p.fill(c[0],c[1],c[2],p.random(195,245)); p.rect(x,y,ww,hh);
      if(p.random()<.24){p.fill(245,238,220,35);p.rect(x+ww*.08,y+hh*.08,ww*.84,hh*.12);}
    }
    // Circular counterpoint and a deliberate open quadrant.
    p.noFill(); p.stroke(22,25,28,190); p.strokeWeight(w*.004);
    const cx=w*(.23+p.random(.48)),cy=h*(.22+p.random(.5)),r=w*p.random(.11,.22);
    p.circle(cx,cy,r*2); p.stroke(pal[2][0],pal[2][1],pal[2][2],220); p.strokeWeight(w*.012); p.arc(cx,cy,r*2.55,r*2.55,p.PI*.12,p.PI*1.18);
    p.pop();
  }

  function gesture(p, w, h, pal) {
    const focalX=w*(.32+p.random(.36)), focalY=h*(.3+p.random(.38));
    p.push(); p.noFill();
    for(let i=0;i<210;i++) {
      const c=pick(p,pal), spread=p.random(.04,.34), x0=focalX+p.random(-w*spread,w*spread), y0=focalY+p.random(-h*spread,h*spread);
      const len=p.random(18,72), phase=p.random(p.TWO_PI), weight=p.random(.0007,.0065)*w;
      p.stroke(c[0],c[1],c[2],p.random(24,112)); p.strokeWeight(weight);
      p.beginShape();
      for(let j=0;j<=len;j++) {
        const t=j/len, n=p.noise(i*.07,t*2.8);
        const x=x0 + (t-.5)*w*p.random(.05,.22) + Math.sin(t*5+phase)*w*.055 + (n-.5)*w*.035;
        const y=y0 + Math.sin(t*3.4+phase)*h*.12 + (t-.5)*h*p.random(.01,.1);
        p.curveVertex(x,y);
      }
      p.endShape();
    }
    // A few decisive, darker marks punctuate the field.
    for(let i=0;i<16;i++){
      const c=pal[i%pal.length],x=focalX+p.random(-w*.22,w*.22),y=focalY+p.random(-h*.18,h*.18);
      p.stroke(c[0],c[1],c[2],p.random(130,210));p.strokeWeight(w*p.random(.003,.012));
      p.line(x,y,x+p.random(-w*.12,w*.12),y+p.random(-h*.08,h*.08));
    }
    p.pop();
  }

  function strata(p,w,h,pal){
    p.push();
    const bands=42; let y=h*.07;
    for(let i=0;i<bands;i++){
      const bh=p.random(h*.006,h*.035), c=pick(p,pal);
      p.noStroke();p.fill(c[0],c[1],c[2],p.random(45,155));
      p.beginShape();p.vertex(0,y);
      for(let x=0;x<=w;x+=w/18) p.vertex(x,y+p.noise(i*.31,x*.002)*bh*1.8);
      p.vertex(w,y+bh);p.vertex(0,y+bh);p.endShape(p.CLOSE);
      if(p.random()<.7){p.stroke(231,220,195,p.random(12,55));p.strokeWeight(w*.0008);for(let k=0;k<8;k++){const sx=p.random(w),sy=y+p.random(bh);p.line(sx,sy,sx+p.random(w*.015,w*.12),sy+p.random(-h*.002,h*.002));}}
      y += bh*.8;
      if(y>h*.94) break;
    }
    // Incised vertical scratches and exposed underlayers.
    for(let i=0;i<115;i++){const x=p.random(w),yy=p.random(h);p.stroke(8,12,16,p.random(35,105));p.strokeWeight(p.random(w*.0005,w*.002));p.line(x,yy,x+p.random(-w*.008,w*.008),yy+p.random(h*.006,h*.09));}
    p.pop();
  }

  function topographic(p,w,h,pal){
    p.push();p.noFill();
    const cx=w*(.38+p.random(.24)),cy=h*(.34+p.random(.3));
    for(let band=0;band<115;band++){
      const c=pal[band%pal.length],base=w*(.06+band*.0038);
      p.stroke(c[0],c[1],c[2],p.map(band,0,114,35,125));p.strokeWeight(w*(.00045+(band%5)*.00014));p.beginShape();
      for(let a=0;a<=p.TWO_PI+.03;a+=.045){const n=p.noise(Math.cos(a)*2.1+band*.013,Math.sin(a)*2.1+band*.013);const r=base+(n-.5)*w*.105;p.curveVertex(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.78);}
      p.endShape();
    }
    // Flow filaments escape the contour system.
    for(let i=0;i<90;i++){let x=p.random(w),y=p.random(h);const c=pick(p,pal);p.stroke(c[0],c[1],c[2],70);p.strokeWeight(w*.00065);p.beginShape();for(let j=0;j<45;j++){p.vertex(x,y);const a=p.noise(x*.0025,y*.0025)*p.TWO_PI*2.3;x+=Math.cos(a)*w*.006;y+=Math.sin(a)*h*.006;}p.endShape();}
    p.pop();
  }

  function optical(p,w,h,pal){
    p.push();p.noFill();const cx=w*(.35+p.random(.3)),cy=h*(.3+p.random(.4));
    for(let i=0;i<190;i++){
      const c=pal[i%pal.length],amp=h*(.018+p.noise(i*.1)*.055),phase=i*.105,baseY=h*.12+i*h*.004;
      p.stroke(c[0],c[1],c[2],p.random(65,170));p.strokeWeight(w*(i%7===0?.0018:.0008));p.beginShape();
      for(let x=0;x<=w;x+=w*.006){const dx=(x-cx)/w;const envelope=Math.exp(-dx*dx*2.4);const y=baseY+Math.sin(x/w*18+phase)*amp*envelope+Math.sin(x/w*5-phase)*amp*.22;p.vertex(x,y);}
      p.endShape();
    }
    p.noFill();p.stroke(20,25,31,90);p.strokeWeight(w*.002);p.ellipse(cx,cy,w*.48,h*.32);p.pop();
  }

  function minimal(p,w,h,pal){
    p.push();const c=pick(p,pal.slice(1)),x=w*(.24+p.random(.3)),y=h*(.2+p.random(.32)),ww=w*p.random(.28,.48),hh=h*p.random(.32,.58);
    p.noStroke();p.fill(0,0,0,24);p.rect(x+ww*.025,y+hh*.025,ww,hh);
    p.fill(c[0],c[1],c[2],245);
    if(p.random()<.5){p.rect(x,y,ww,hh);p.fill(pal[0][0],pal[0][1],pal[0][2],80);p.rect(x+ww*.12,y+hh*.1,ww*.76,hh*.04);}
    else{p.ellipse(x+ww*.5,y+hh*.5,ww,hh);p.noFill();p.stroke(pal[2][0],pal[2][1],pal[2][2],150);p.strokeWeight(w*.003);p.ellipse(x+ww*.5,y+hh*.5,ww*1.17,hh*1.17);}
    p.stroke(35,38,38,140);p.strokeWeight(w*.001);p.line(w*.12,h*.83,w*.88,h*.83);
    p.noStroke();p.fill(pal[0][0],pal[0][1],pal[0][2],150);p.circle(w*.76,h*.22,w*.035);p.pop();
  }

  function biomorphic(p,w,h,pal){
    p.push();
    for(let i=0;i<34;i++){
      const x=p.random(w*.12,w*.88),y=p.random(h*.1,h*.9),r=p.random(w*.018,w*.09),c=pick(p,pal);
      p.push();p.translate(x,y);p.rotate(p.random(p.TWO_PI));p.noStroke();p.fill(c[0],c[1],c[2],p.random(80,180));p.ellipse(0,0,r*1.4,r*.62);
      p.noFill();p.stroke(232,222,193,p.random(25,90));p.strokeWeight(w*.0008);p.ellipse(0,0,r*1.55,r*.76);p.pop();
      if(i%3===0){p.stroke(c[0],c[1],c[2],90);p.strokeWeight(w*.001);p.noFill();p.beginShape();for(let j=0;j<30;j++){const a=j*.23+i;const rr=r*(.18+j/30);p.vertex(x+Math.cos(a)*rr,y+Math.sin(a)*rr*.7);}p.endShape();}
    }
    // Fine seed-like marks create a second scale.
    for(let i=0;i<1600;i++){const x=p.random(w),y=p.random(h),c=pick(p,pal);p.noStroke();p.fill(c[0],c[1],c[2],p.random(25,95));p.ellipse(x,y,w*.002,p.random(w*.002,w*.009));}
    p.pop();
  }

  function pointillism(p,w,h,pal){
    p.push();const cx=w*(.32+p.random(.36)),cy=h*(.28+p.random(.4));
    for(let i=0;i<13500;i++){
      const angle=p.random(p.TWO_PI),rad=Math.abs(p.randomGaussian())*w*.23;
      const x=cx+Math.cos(angle)*rad,y=cy+Math.sin(angle)*rad*.72;
      if(x<0||x>w||y<0||y>h)continue;
      const c=pick(p,pal),d=p.random(w*.0013,w*.009),a=p.random(75,205);
      p.noStroke();p.fill(c[0],c[1],c[2],a);p.ellipse(x,y,d,d*p.random(.65,1.3));
    }
    for(let i=0;i<70;i++){const c=pick(p,pal),x=cx+p.random(-w*.18,w*.18),y=cy+p.random(-h*.14,h*.14);p.noFill();p.stroke(c[0],c[1],c[2],65);p.strokeWeight(w*.0007);p.circle(x,y,p.random(w*.015,w*.06));}
    p.pop();
  }

  function fractured(p,w,h,pal){
    p.push();
    const cols=9,rows=9,pts=[];
    for(let y=0;y<=rows;y++){pts[y]=[];for(let x=0;x<=cols;x++)pts[y][x]=[x*w/cols+(x===0||x===cols?0:p.random(-w*.025,w*.025)),y*h/rows+(y===0||y===rows?0:p.random(-h*.025,h*.025))];}
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const a=pts[y][x],b=pts[y][x+1],c=pts[y+1][x+1],d=pts[y+1][x],col=pick(p,pal);
      p.noStroke();p.fill(col[0],col[1],col[2],p.random(115,225));p.beginShape();[a,b,c,d].forEach(v=>p.vertex(v[0],v[1]));p.endShape(p.CLOSE);
      if(p.random()<.3){p.fill(245,231,207,25);p.beginShape();p.vertex(a[0],a[1]);p.vertex(b[0],b[1]);p.vertex((a[0]+c[0])/2,(a[1]+c[1])/2);p.endShape(p.CLOSE);}
    }
    p.noFill();p.stroke(8,12,18,75);p.strokeWeight(w*.0013);for(let i=0;i<24;i++){p.beginShape();let x=p.random(w),y=p.random(h);for(let j=0;j<9;j++){p.vertex(x,y);x+=p.random(-w*.11,w*.11);y+=p.random(-h*.11,h*.11);}p.endShape();}
    p.pop();
  }

  function mineral(p,w,h,pal){
    p.push();
    // Deep mineral strata under the metallic veins.
    for(let i=0;i<65;i++){const c=pick(p,pal.slice(0,4)),y=p.random(h),hh=p.random(h*.002,h*.035);p.noStroke();p.fill(c[0],c[1],c[2],p.random(8,48));p.rect(0,y,w,hh);}
    for(let i=0;i<175;i++){
      let x=p.random(w),y=p.random(h),ang=p.random(p.TWO_PI),len=p.random(w*.025,w*.25);const c=pick(p,pal.slice(2));
      p.noFill();p.stroke(c[0],c[1],c[2],p.random(55,185));p.strokeWeight(p.random(w*.0006,w*.003));p.beginShape();
      for(let j=0;j<18;j++){const t=j/17;p.vertex(x+Math.cos(ang)*len*t+Math.sin(t*9+i)*w*.009,y+Math.sin(ang)*len*t+Math.cos(t*7+i)*h*.009);}p.endShape();
      if(i%4===0){p.stroke(245,215,144,160);p.strokeWeight(w*.0011);p.line(x,y,x+Math.cos(ang)*len*.55,y+Math.sin(ang)*len*.55);}
    }
    for(let i=0;i<2600;i++){const x=p.random(w),y=p.random(h),c=pick(p,pal.slice(2));p.noStroke();p.fill(c[0],c[1],c[2],p.random(20,100));p.circle(x,y,p.random(w*.0006,w*.003));}
    p.pop();
  }

  function impression(p,w,h,pal){
    p.push();
    // Broad underpainting and a quiet light source.
    const cx=w*(.36+p.random(.28)),cy=h*(.2+p.random(.35));
    const ctx=p.drawingContext;ctx.save();const g=ctx.createRadialGradient(cx,cy,0,cx,cy,w*.55);g.addColorStop(0,'rgba(248,226,179,.32)');g.addColorStop(.5,'rgba(180,188,175,.11)');g.addColorStop(1,'rgba(10,20,28,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.restore();
    for(let i=0;i<9200;i++){
      const x=p.random(w),y=p.random(h),dist=Math.hypot(x-cx,y-cy)/w,c=pick(p,pal),len=p.random(w*.003,w*.022),ang=p.noise(x*.002,y*.002)*p.TWO_PI*2;
      p.stroke(c[0],c[1],c[2],p.random(40,135));p.strokeWeight(p.random(w*.001,w*.0045));p.line(x,y,x+Math.cos(ang)*len*(1-dist*.25),y+Math.sin(ang)*len);
    }
    p.pop();
  }

  function addSignature(p,w,h,author,seed){
    const text=`${String(author||'UNTITLED').trim().slice(0,24).toUpperCase()}  /  FORM ${seed.toString(16).toUpperCase().padStart(8,'0')}`;
    p.push();p.textFont('monospace');p.textAlign(p.RIGHT,p.BOTTOM);p.textSize(Math.max(9,w*.013));p.noStroke();p.fill(0,0,0,80);const tw=p.textWidth(text);p.rect(w-tw-w*.045,h-w*.055,tw+w*.025,w*.025,1);p.fill(242,235,218,205);p.text(text,w-w*.032,h-w*.035);p.pop();
  }

  function render(p, seedValue, genreValue, author, options) {
    const seed=normalizeSeed(seedValue), style=styleFor(genreValue), w=p.width, h=p.height, pal=style.palette;
    p.randomSeed(seed);p.noiseSeed(seed);p.colorMode(p.RGB,255);p.angleMode(p.RADIANS);
    p.background(style.bg[0],style.bg[1],style.bg[2]);
    radialWash(p,w,h,pal,seed);
    switch(style.id){
      case 0: colorField(p,w,h,pal); break;
      case 1: geometry(p,w,h,pal); break;
      case 2: gesture(p,w,h,pal); break;
      case 3: strata(p,w,h,pal); break;
      case 4: topographic(p,w,h,pal); break;
      case 5: optical(p,w,h,pal); break;
      case 6: minimal(p,w,h,pal); break;
      case 7: biomorphic(p,w,h,pal); break;
      case 8: pointillism(p,w,h,pal); break;
      case 9: fractured(p,w,h,pal); break;
      case 10: mineral(p,w,h,pal); break;
      case 11: impression(p,w,h,pal); break;
    }
    paperAndFrame(p,w,h,style);
    if(!options || options.signature!==false) addSignature(p,w,h,author,seed);
  }

  function curatorialNote(styleId, seedValue){
    const style=styleFor(styleId), seed=normalizeSeed(seedValue);
    const variations=[
      '화면의 중심을 고정하기보다 시선이 머무는 지점을 여러 곳에 분산시켜 읽는 순서를 열어 둡니다.',
      '강한 형태와 비어 있는 영역의 비율이 작품의 긴장도를 결정하도록 구성했습니다.',
      '반복되는 단위에 작은 편차를 주어 기계적인 규칙과 우연한 흔적이 공존하도록 했습니다.',
      '색의 명도 차보다 투명도와 겹침을 중심으로 깊이감을 만들었습니다.'
    ];
    return { title: style.ko, method: style.note, reading: variations[seed % variations.length], seed: seed, disclaimer: '이 설명은 선택한 알고리즘과 시드에 따른 생성 규칙을 요약한 것으로, AI가 작품을 감상하거나 평가한 결과는 아닙니다.' };
  }

  root.ArtEngine={VERSION,STYLES,hashSeed,normalizeSeed,styleFor,render,curatorialNote};
})(typeof window!=='undefined'?window:globalThis);
