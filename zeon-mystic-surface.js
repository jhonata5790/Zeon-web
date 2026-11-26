'use strict';
/* Zeon Mystic Surface 0.9.9.3
 * A continuous, breathing spectral fire-bed spanning every pixel along the
 * banner's lower edge. The larger, independent flame tongues render above it.
 * Browser/Electron identical source; no storage, DOM or network dependencies.
 */
(function(root){
  const TAU=Math.PI*2;
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
  const rgba=(rgb,a)=>'rgba('+rgb.join(',')+','+clamp(a,0,1).toFixed(3)+')';
  const layers=[
    {color:[139,74,247],base:.153,rise:.076,speed:.43,alpha:.26},
    {color:[68,143,253],base:.111,rise:.053,speed:.62,alpha:.30},
    {color:[157,207,255],base:.056,rise:.030,speed:.77,alpha:.25}
  ];
  function topHeight(x,w,h,time,index,intensity){
    const layer=layers[index],u=x/Math.max(1,w),t=Math.max(0,Number(time)||0);
    const wave=.56+.22*Math.sin(u*TAU*(3.7+index)+t*layer.speed+index*1.7)
      +.14*Math.sin(u*TAU*(9.7+index*2)-t*.91+index)
      +.08*Math.sin(u*TAU*(18+index*3)+t*.63-index);
    // Positive minimum at EVERY x: no empty gaps along the bottom edge.
    return h*(layer.base+layer.rise*wave)*(.56+.44*clamp(intensity/100,0,1));
  }
  function draw(ctx,w,h,time,intensity=65){
    w=Number(w)||0;h=Number(h)||0;
    const p=clamp(intensity,0,100)/100;
    if(!ctx||w<4||h<4||p===0)return;
    const floor=h-.25,topBand=Math.max(19,h*.18);
    ctx.save();ctx.globalCompositeOperation='screen';
    // A smooth, full-width contact light means all flames grow from one source.
    const ground=ctx.createLinearGradient(0,floor-topBand,0,floor);
    ground.addColorStop(0,'rgba(75,86,235,0)');
    ground.addColorStop(.5,rgba([81,96,244],.075*p));
    ground.addColorStop(.83,rgba([116,83,246],.19*p));
    ground.addColorStop(1,rgba([72,161,255],.40*p));
    ctx.fillStyle=ground;ctx.fillRect(0,floor-topBand,w,topBand+1);
    const step=Math.max(5,Math.min(13,w/115));
    for(let li=0;li<layers.length;li++){
      const layer=layers[li];
      // Smooth, organic upper boundary across the full width. No isolated
      // triangles, circles or unattached patchwork at the root.
      const values=[];
      for(let x=0;x<w;x+=step)values.push([x,floor-topHeight(x,w,h,time,li,intensity)]);
      values.push([w,floor-topHeight(w,w,h,time,li,intensity)]);
      ctx.beginPath();ctx.moveTo(0,floor);ctx.lineTo(values[0][0],values[0][1]);
      for(let i=1;i<values.length;i++){
        const a=values[i-1],b=values[i];
        ctx.quadraticCurveTo(a[0],a[1],(a[0]+b[0])/2,(a[1]+b[1])/2);
      }
      const last=values[values.length-1];ctx.lineTo(last[0],last[1]);
      ctx.lineTo(w,floor+1);ctx.closePath();
      const maxH=h*(layer.base+layer.rise);
      const g=ctx.createLinearGradient(0,floor-maxH,0,floor);
      g.addColorStop(0,rgba(layer.color,0));
      g.addColorStop(.24,rgba(layer.color,.06*p));
      g.addColorStop(.66,rgba(layer.color,layer.alpha*.62*p));
      g.addColorStop(1,rgba(layer.color,layer.alpha*p));
      ctx.fillStyle=g;ctx.fill();
    }
    // Many smaller overlapping tongues join the few tall supernatural ribbons.
    // Their bases overlap at every x; tips move independently for organic fire.
    const count=Math.max(22,Math.min(92,Math.round(w/21)));
    const spacing=w/count;
    for(let i=0;i<count;i++){
      const seed=i*2.73+7.81,x=(i+.5)*spacing;
      const drift=Math.sin((Number(time)||0)*(.54+.17*(i%4))+seed)*spacing*.33;
      const height=h*(.09+.18*(.5+.5*Math.sin(seed*1.73+(Number(time)||0)*.46)))*(.68+.32*p);
      const half=spacing*(.66+.1*Math.sin(seed));
      const tipX=x+drift;
      ctx.beginPath();ctx.moveTo(x-half,floor);
      ctx.bezierCurveTo(x-half*.8,floor-height*.38,tipX-half*.38,floor-height*.79,tipX,floor-height);
      ctx.bezierCurveTo(tipX+half*.33,floor-height*.67,x+half*.75,floor-height*.25,x+half,floor);
      ctx.closePath();
      const tone=i%3===0?[149,80,247]:i%3===1?[83,153,255]:[150,195,255];
      const g=ctx.createLinearGradient(x,floor-height,tipX,floor);
      g.addColorStop(0,rgba(tone,0));
      g.addColorStop(.40,rgba(tone,.080*p));
      g.addColorStop(.78,rgba(tone,.14*p));
      g.addColorStop(1,rgba(tone,.24*p));
      ctx.fillStyle=g;ctx.fill();
    }
    // An unbroken, slightly animated luminous seam anchors the whole surface
    // to the actual banner edge without a hard white line.
    const edge=ctx.createLinearGradient(0,0,w,0);
    const pulse=.78+.22*Math.sin((Number(time)||0)*.82);
    edge.addColorStop(0,rgba([96,139,255],.19*p*pulse));
    edge.addColorStop(.23,rgba([147,93,255],.39*p*pulse));
    edge.addColorStop(.57,rgba([81,172,255],.41*p*pulse));
    edge.addColorStop(.8,rgba([170,88,255],.32*p*pulse));
    edge.addColorStop(1,rgba([96,139,255],.19*p*pulse));
    ctx.strokeStyle=edge;ctx.lineWidth=Math.max(1,Math.min(2,h*.009));
    ctx.beginPath();ctx.moveTo(0,floor-.6);ctx.lineTo(w,floor-.6);ctx.stroke();
    ctx.restore();
  }
  root.ZeonMysticSurface=Object.freeze({draw,topHeight});
})(window);
