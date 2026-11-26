'use strict';
/* Zeon Energy Arcs 0.9.9.2 — shared by Web and Electron.
 * Full-span lightning: every main stroke is anchored to opposite boundaries.
 * Rendering only; no persistence, network, inputs or app services.
 */
(function(root){
  const PI=Math.PI,TAU=PI*2;
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function noise(n){const v=Math.sin(n*127.1+78.233)*43758.5453123;return v-Math.floor(v);}
  const palettes={
    mystic:{outer:[104,88,241],middle:[92,155,255],core:[210,239,255]},
    electric:{outer:[26,107,248],middle:[73,218,255],core:[245,254,255]}
  };
  const rgba=(a,alpha)=>'rgba('+a.join(',')+','+clamp(alpha,0,1).toFixed(3)+')';
  function anchors(mode,width,height,seed){
    const w=Math.max(2,width),h=Math.max(2,height);
    if(mode==='vertical'){
      return {start:[w*(.13+.74*noise(seed+4)),0],end:[w*(.13+.74*noise(seed+9)),h]};
    }
    if(mode==='horizontal'){
      return {start:[0,h*(.13+.74*noise(seed+4))],end:[w,h*(.13+.74*noise(seed+9))]};
    }
    return null;
  }
  function makePath(start,end,seed,roughness=.075){
    const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.hypot(dx,dy)||1;
    const nx=-dy/length,ny=dx/length;
    const count=Math.max(18,Math.min(40,Math.round(length/21)));
    const pts=[];
    for(let i=0;i<=count;i++){
      const f=i/count;
      // The endpoints are EXACT, never random positions in the middle of the frame.
      const envelope=Math.sin(PI*f);
      const wave=(Math.sin(f*TAU*4.7+seed*3.1)*.52+
        Math.sin(f*TAU*12.9+seed*1.6)*.30+
        Math.sin(f*TAU*21.7+seed*5.1)*.18);
      const jitter=(noise(seed*57+i*9.17)-.5)*.48;
      const offset=(wave+jitter)*roughness*length*envelope;
      pts.push([start[0]+dx*f+nx*offset,start[1]+dy*f+ny*offset]);
    }
    pts[0]=start.slice();pts[pts.length-1]=end.slice();
    return pts;
  }
  function sample(time,width,height,options={}){
    const variant=options.variant==='electric'?'electric':'mystic';
    const w=Number(width)||0,h=Number(height)||0;
    if(w<4||h<4||options.motion===false||clamp(options.intensity??65,0,100)===0)return {active:false};
    const interval=variant==='electric'?1.22:3.45;
    const duration=variant==='electric'?.35:.42;
    const t=Math.max(0,Number(time)||0);
    const index=Math.floor(t/interval);
    const age=t-index*interval;
    if(age>duration)return {active:false};
    const mode=options.mode|| (index%2===0?'vertical':'horizontal');
    const seed=index*13.73+17.91+(variant==='electric'?22:0);
    const fixed=options.start&&options.end?{start:options.start,end:options.end}:anchors(mode,w,h,seed);
    if(!fixed)return {active:false};
    const path=makePath(fixed.start,fixed.end,seed,variant==='electric'?.09:.067);
    const progress=clamp(age/duration,0,1);
    const fade=Math.pow(Math.sin(PI*progress),.68);
    return {active:true,variant,mode,path,start:fixed.start,end:fixed.end,progress,
      alpha:fade*clamp(options.intensity??65,0,100)/100};
  }
  function trace(ctx,points){
    ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);
  }
  function halo(ctx,p,r,col,alpha){
    const g=ctx.createRadialGradient(p[0],p[1],0,p[0],p[1],r);
    g.addColorStop(0,rgba(col,alpha));g.addColorStop(.27,rgba(col,alpha*.38));
    g.addColorStop(1,rgba(col,0));ctx.fillStyle=g;
    ctx.fillRect(p[0]-r,p[1]-r,r*2,r*2);
  }
  function draw(ctx,width,height,time,options={}){
    const bolt=sample(time,width,height,options);
    if(!bolt.active||bolt.alpha<.008)return bolt;
    const {path,alpha,progress,variant,start,end}=bolt;
    const palette=palettes[variant],scale=variant==='electric'?1.3:1;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';ctx.lineJoin='round';
    // Draw the ENTIRE connected stroke throughout the event. The illuminated
    // wave travels over it; there is never an orphaned segment in empty space.
    trace(ctx,path);ctx.strokeStyle=rgba(palette.outer,.22*alpha);
    ctx.lineWidth=8*scale;ctx.shadowColor=rgba(palette.outer,.6*alpha);
    ctx.shadowBlur=14*scale;ctx.stroke();ctx.shadowBlur=0;
    trace(ctx,path);ctx.strokeStyle=rgba(palette.middle,.75*alpha);
    ctx.lineWidth=2.45*scale;ctx.stroke();
    trace(ctx,path);ctx.strokeStyle=rgba(palette.core,.88*alpha);
    ctx.lineWidth=.8*scale;ctx.stroke();
    // A quick bright pulse sweeps from edge to edge while the endpoints stay fixed.
    const head=progress*(path.length-1),radius=variant==='electric'?5:4;
    const first=Math.max(0,Math.floor(head-radius)),last=Math.min(path.length-1,Math.ceil(head+radius));
    if(last>first){
      ctx.beginPath();ctx.moveTo(path[first][0],path[first][1]);
      for(let i=first+1;i<=last;i++)ctx.lineTo(path[i][0],path[i][1]);
      ctx.lineWidth=3.8*scale;ctx.strokeStyle=rgba(palette.core,.95*alpha);
      ctx.shadowColor=rgba(palette.middle,.85*alpha);ctx.shadowBlur=13*scale;ctx.stroke();
      ctx.shadowBlur=0;
    }
    // Origin and destination glow remain inside the same clipping context.
    halo(ctx,start,variant==='electric'?18:14,palette.middle,.26*alpha);
    halo(ctx,end,variant==='electric'?20:15,palette.core,.32*alpha);
    ctx.restore();
    return bolt;
  }
  root.ZeonEnergyArcs=Object.freeze({anchors,makePath,sample,draw});
})(window);
