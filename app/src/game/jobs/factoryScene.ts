// A bounded instanced overview. One renderer, no postprocess or shadows; DOM owns interaction.
import * as THREE from 'three';
import { simClock } from './simClock';
import { exact, partReason } from './reasoning';
import { type HouseTotals } from './factory';
import { layoutFor } from './scene';
import { JOBS, PEOPLE, type PersonId, type Ctx } from './jobs';
import { housesFor, type Plot } from './factory';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export function createFactoryScene(canvas:HTMLCanvasElement,overlay:HTMLElement,plots:Plot[],abroad?:PersonId,realMode=false,getCtx:()=>Ctx=()=>({})) {
  const demo=!plots.some(p=>p.state==='solved');
  if(demo)plots=plots.map((p,i)=>i? p : {...p,state:'solved',build:{r:{uid:'preview-s',kind:'Splitter',shares:[60,20,20]},'r.0':{uid:'preview-a',kind:'Payout',person:'ada'},'r.1':{uid:'preview-b',kind:'Payout',person:'bola'},'r.2':{uid:'preview-c',kind:'Payout',person:'chi'}}});
  const low=new URLSearchParams(location.search).get('lowfx')==='1', stepped=new URLSearchParams(location.search).get('step')==='1';
  const phone=()=>innerWidth<640;
  const positions=new Map<string,THREE.Vector3>();
  function positionPlots() {
    plots.forEach((p,i)=>positions.set(`plot:${p.n}`,phone()?V(i%2?5:-5,0,-10+Math.floor(i/2)*11):V(-11+(i%3)*10,0,i<3?-5:6)));
    const chiAbroad=plots[2].state==='solved';
    const ids:PersonId[]=['ada','bola','chi','dayo','you',...(abroad?[abroad]:[])];
    ids.forEach((id,i)=>positions.set(`house:${id}`,id==='chi'&&chiAbroad?V(phone()?17:24,0,-6):phone()?V(i%2?11:-11,0,-16+Math.floor(i/2)*13):V(-13+i*7,0,-13)));
  }
  positionPlots();
  let renderer:THREE.WebGLRenderer|undefined;
  try {if(new URLSearchParams(location.search).get('webgl')!=='0') renderer=new THREE.WebGLRenderer({canvas,antialias:!low});} catch { /* accessible plot grid */ }
  if(!renderer) {
    canvas.hidden=true;overlay.classList.add('fallback');
    (window as unknown as {__wwFactory:unknown}).__wwFactory={info:()=>({fallback:true,calls:0,triangles:0}),advance:()=>{}};
    return {dispose(){overlay.classList.remove('fallback');},fly:async(_n:number)=>{},setTotals(_t:HouseTotals){},arrive(_t:HouseTotals){},confirmed(_id:PersonId,_plot?:number){}};
  }
  const r=renderer, scene=new THREE.Scene();scene.background=new THREE.Color('#3f979d');
  r.setPixelRatio(Math.min(devicePixelRatio,low?1:1.5));r.outputColorSpace=THREE.SRGBColorSpace;
  scene.add(new THREE.HemisphereLight('#fff5dd','#49786c',2.4));const sun=new THREE.DirectionalLight('#fff2d5',2.5);sun.position.set(-15,30,12);scene.add(sun);
  const camera=new THREE.OrthographicCamera(-30,30,20,-20,.1,200);camera.position.copy(phone()?V(0,44,24):V(20,38,38));camera.lookAt(phone()?V():V(3,0,0));
  const resources:{dispose():void}[]=[];
  const own=<T extends {dispose():void}>(v:T)=>{resources.push(v);return v;};
  const colors={Splitter:'#efb939',Payout:'#34b3a5',Vault:'#a88e73',Gate:'#ff8b47',Worker:'#e04c82',Portal:'#8e73de'};
  const dummy=new THREE.Object3D();
  type Box={p:THREE.Vector3;s:THREE.Vector3;c:string;ry?:number; q?:THREE.Quaternion};
  const boxes:Box[]=[],beltBoxes:Box[]=[],roofs:Box[]=[],spheres:Box[]=[],rings:Box[]=[],shadows:Box[]=[],paths:{a:THREE.Vector3;b:THREE.Vector3;plot:number;portal:boolean;reason:()=>string}[]=[];
  function box(p:THREE.Vector3,s:THREE.Vector3,c:string,ry=0){boxes.push({p,s,c,ry});}
  function segment(a:THREE.Vector3,b:THREE.Vector3,c='#555e61',width=.32) {
    const d=b.clone().sub(a);if(d.length()<.001)return;(width===.32?beltBoxes:boxes).push({p:a.clone().add(b).multiplyScalar(.5),s:V(width,.12,d.length()),c,q:new THREE.Quaternion().setFromUnitVectors(V(0,0,1),d.clone().normalize())});
  }
  function belt(a:THREE.Vector3,b:THREE.Vector3,plot:number,portal=false,reason=()=> 'Coin Slot: 0.10 NEAR per simulated sale; real orders are separate.') { if(portal) {const start=a.clone().setY(1.2),mid=a.clone().add(b).multiplyScalar(.5).setY(5),end=b.clone().setY(1.2);segment(start,mid,'#ac94f2',.13);segment(mid,end,'#ac94f2',.13);paths.push({a:start,b:mid,plot,portal,reason},{a:mid,b:end,plot,portal,reason});return;} const elbow=V(b.x,.36,a.z);const start=a.clone().setY(.36),end=b.clone().setY(.36);segment(start,elbow,portal?'#8e73de':'#5e6966');segment(elbow,end,portal?'#8e73de':'#5e6966');paths.push({a:start,b:elbow,plot,portal,reason},{a:elbow,b:end,plot,portal,reason}); }
  box(V(0,-.9,0),V(90,.3,90),'#358d98');box(V(-1,-.35,0),phone()?V(27,1,40):V(35,1,31),'#d8bf96');box(V(-1,.16,0),phone()?V(26,.2,39):V(34,.2,30),'#89bd69');
  box(V(phone()?17:24,0,-6),V(8,1.2,10),'#adb9df');
  const roadA=phone()?V(0,.29,-18):V(-16,.29,0),roadB=phone()?V(0,.29,18):V(16,.29,0);segment(roadA,roadB,'#dac7a4',1.5);
  for(const p of plots) {
    const at=positions.get(`plot:${p.n}`)!;
    shadows.push({p:at.clone().setY(.44),s:V(2.4,.02,1.7),c:'#7da56b'});
    box(at.clone().setY(.3),V(8,.25,8),p.state==='locked'?'#758f6d':p.state==='next'?'#f6d983':'#f1e7d1');
    if(p.state!=='solved')continue;
    box(at.clone().add(V(-2.8,.9,0)),V(1.2,1.3,1.6),'#d49368');
    roofs.push({p:at.clone().add(V(-2.8,1.8,0)),s:V(1.1,.65,1.1),c:'#e75d63',ry:Math.PI/4});
    // Shop counter, striped awning and two supporting posts.
    box(at.clone().add(V(-2.8,1.1,.85)),V(1.8,.12,.8),'#fff0cd');
    for(let i=0;i<6;i++)box(at.clone().add(V(-3.55+i*.3,1.85,.55)),V(.3,.12,1.25),i%2?'#fff4d4':'#e75d63');
    for(const x of [-3.5,-2.1])box(at.clone().add(V(x,1,.95)),V(.08,1.8,.08),'#795644');
    // Gold flag only once a confirmed real receipt exists for this plot; a shipped plot without one gets a neutral flag.
    if(p.shipped&&realMode) {box(at.clone().add(V(3,1.5,-2)),V(.07,2.2,.07),'#705632');box(at.clone().add(V(3.5,2.4,-2)),V(1,.5,.08),p.confirmed?'#ffcf55':'#cfd6dc');}
    const L=layoutFor(JOBS[p.n-1],p.build,{people:JOBS[p.n-1].people});
    const local=(v:THREE.Vector3)=>at.clone().add(V(v.x*.28,.55,v.z*.52));
    const node=(id:string)=>local(L.nodes[id]??L.keys[id]??V());
    belt(at.clone().add(V(-2.2,0,0)),node('r'),p.n,false,()=>partReason(p.build,'r',getCtx()));
    for(const e of L.edges)belt(node(e.from),node(e.to),p.n,false,()=>partReason(p.build,e.to,getCtx()));
    for(const [id,part] of Object.entries(p.build))if(part) {
      const pos=node(id);positions.set(`part:${p.n}:${id}`,pos.clone().setY(1.4));
      if(part.kind==='Gate') {
        for(const x of [-.4,.4])box(pos.clone().add(V(x,.6,0)),V(.18,1.2,.3),colors.Gate);
        box(pos.clone().setY(1.5),V(1,.22,.35),colors.Gate);box(pos.clone().setY(1.05),V(.8,.12,.12),'#ffe3aa');
      } else if(part.kind==='Portal') {
        box(pos.clone().setY(.7),V(1.1,.2,1.1),'#63529c');
        rings.push({p:pos.clone().setY(1.35),s:V(.6,.6,.6),c:'#beacff'});
        for(let k=0;k<5;k++){const a=k*1.5;spheres.push({p:pos.clone().add(V(Math.cos(a)*.34,.9+Math.sin(a)*.34,.04)),s:V(.09,.09,.09),c:'#fff3ff'});}
      } else {
        box(pos.clone().setY(.8),V(.85,.75,.85),colors[part.kind]);
        if(part.kind==='Splitter') {spheres.push({p:pos.clone().setY(1.23),s:V(.39,.08,.39),c:'#fff4ce'});['#ed6381','#51b8d9','#7bbd68'].forEach((c,i)=>spheres.push({p:pos.clone().add(V((i-1)*.24,.76,.44)),s:V(.09,.09,.09),c}));box(pos.clone().add(V(.08,1.3,0)),V(.06,.05,.4),'#594839');}
        if(part.kind==='Vault') {box(pos.clone().setY(1.23),V(.94,.16,.94),'#d4b781');box(pos.clone().add(V(0,.85,.45)),V(.22,.22,.08),'#ffe491');}
        if(part.kind==='Payout') {box(pos.clone().add(V(0,1.5,0)),V(.06,1.2,.06),'#745b45');box(pos.clone().add(V(.25,1.95,0)),V(.5,.32,.07),PEOPLE[part.person??'ada'].shirt);}
        if(part.kind==='Worker')rings.push({p:pos.clone().setY(1.45),s:V(.24,.24,.24),c:'#ffe195'});
      }
    }
    for(const output of housesFor(p.build,p.n===5?abroad:'chi')) {
      const house=positions.get(`house:${output.person}`);if(house)belt(node(output.socket),house,p.n,output.portal,()=>partReason(p.build,output.socket,getCtx()));
    }
  }
  for(const [id,pos] of positions)if(id.startsWith('house:')) {const person=id.slice(6) as PersonId;box(pos.clone().setY(.85),V(1.7,1.4,1.5),PEOPLE[person].shirt);roofs.push({p:pos.clone().setY(1.95),s:V(1.5,.9,1.4),c:person==='chi'?'#8b80d1':'#b75b48',ry:Math.PI/4});box(pos.clone().add(V(0,.55,.77)),V(.4,.8,.08),'#493f37');}
  function instances(items:Box[],geo:THREE.BufferGeometry) {
    const mesh=own(new THREE.InstancedMesh(own(geo),own(new THREE.MeshStandardMaterial({roughness:.8})),items.length));
    items.forEach((b,i)=>{dummy.position.copy(b.p);dummy.scale.copy(b.s);dummy.rotation.set(0,b.ry??0,0);if(b.q)dummy.quaternion.copy(b.q);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(b.c));});scene.add(mesh);return mesh;
  }
  const arrowCanvas=document.createElement('canvas');arrowCanvas.width=32;arrowCanvas.height=64;const ac=arrowCanvas.getContext('2d')!;ac.fillStyle='#56615b';ac.fillRect(0,0,32,64);ac.strokeStyle='#dedbb4';ac.lineWidth=3;for(const y of [12,44]){ac.beginPath();ac.moveTo(6,y+7);ac.lineTo(16,y);ac.lineTo(26,y+7);ac.stroke();}
  const beltTexture=own(new THREE.CanvasTexture(arrowCanvas));beltTexture.wrapS=beltTexture.wrapT=THREE.RepeatWrapping;beltTexture.colorSpace=THREE.SRGBColorSpace;
  const beltMesh=instances(beltBoxes,new THREE.BoxGeometry());beltMesh.material=own(new THREE.MeshStandardMaterial({map:beltTexture,roughness:.95}));
  const houseBoxIndices=boxes.map((b,i)=>positions.has(`house:ada`) && b.s.x===1.7?i:-1).filter(i=>i>=0);
  const boxMesh=instances(boxes,new THREE.BoxGeometry());const ringMesh=instances(rings,new THREE.TorusGeometry(1,.18,6,18));instances(shadows,new THREE.CylinderGeometry(1,1,1,24));instances(roofs,new THREE.ConeGeometry(1,1,4));instances(spheres,new THREE.CylinderGeometry(1,1,1,12));
  const coinCount=Math.min(paths.length*2,160), coins=own(new THREE.InstancedMesh(own(new THREE.SphereGeometry(.13,8,6)),own(new THREE.MeshStandardMaterial({color:'#ffe06a',metalness:.3,roughness:.4})),coinCount));scene.add(coins);
  const count=plots.filter(p=>p.state==='solved').length*2;
  const customers=own(new THREE.InstancedMesh(own(new THREE.CapsuleGeometry(.16,.3,3,6)),own(new THREE.MeshStandardMaterial({color:'#f9d1a2'})),count));scene.add(customers);
  const heads=own(new THREE.InstancedMesh(own(new THREE.SphereGeometry(.15,8,6)),own(new THREE.MeshStandardMaterial({color:'#d6a078'})),count));scene.add(heads);
  customers.material.color.set('#df8a66');
  const houseIds=[...positions.keys()].filter(k=>k.startsWith('house:'));
  let savedTotals:HouseTotals={};const arrivals=new Map<PersonId,number>();
  const piles=own(new THREE.InstancedMesh(own(new THREE.CylinderGeometry(.19,.19,.09,10)),own(new THREE.MeshStandardMaterial({color:'#ffda55',metalness:.35,roughness:.5})),houseIds.length*18));scene.add(piles);
  const arrows=own(new THREE.InstancedMesh(own(new THREE.ConeGeometry(.10,.24,3)),own(new THREE.MeshBasicMaterial({color:'#e5e2c2'})),paths.length*3));scene.add(arrows);
  let t=1.7,raf=0,disposed=false,flyTo:THREE.Vector3|undefined,flyStart=0,flyResolve:(()=>void)|undefined;
  const origin=camera.position.clone(),target=phone()?V():V(3,0,0);
  const opened=performance.now();
  function resize(){
    r.setSize(innerWidth,innerHeight,false);camera.updateMatrixWorld();
    const pts=phone()?[V(-13,0,-18),V(22,0,-18),V(-13,0,19),V(22,0,19)]:[V(-18,0,-16),V(29,0,-16),V(-18,0,16),V(29,0,16)];
    const projected=pts.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse));
    const minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x)),minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y));
    const top=phone()?205:220,bottom=phone()?185:65,side=phone()?30:80;
    const scale=Math.max((maxX-minX)/(innerWidth-side*2),(maxY-minY)/Math.max(200,innerHeight-top-bottom));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2+(top-bottom)/2*scale;
    camera.left=cx-innerWidth/2*scale;camera.right=cx+innerWidth/2*scale;camera.top=cy+innerHeight/2*scale;camera.bottom=cy-innerHeight/2*scale;camera.updateProjectionMatrix();
  }
  function draw(dt=0) {
    if(disposed)return;
    if(!document.hidden&&!low)t+=simClock.delta(dt,true);
    const animate=!low&&!document.hidden;
    beltTexture.offset.y=-t*.4;
    rings.forEach((ring,i)=>{dummy.position.copy(ring.p);dummy.scale.copy(ring.s);dummy.rotation.set(0,0,t*.7);dummy.updateMatrix();ringMesh.setMatrixAt(i,dummy.matrix);});ringMesh.instanceMatrix.needsUpdate=true;
    if(!flyTo&&!low&&!stepped){camera.zoom=1+.65*Math.max(0,1-(performance.now()-opened)/650)**3;camera.updateProjectionMatrix();}
    for(let i=0;i<coinCount;i++) {const path=paths[i%Math.max(1,paths.length)];dummy.position.copy(path?.a??V(0,-20,0));if(path)dummy.position.lerp(path.b,(t*.16+i*.317)%1);dummy.position.y+=.17;dummy.rotation.set(0,t+i,0);dummy.scale.setScalar(animate?1:0);dummy.updateMatrix();coins.setMatrixAt(i,dummy.matrix);}coins.instanceMatrix.needsUpdate=true;
    for(let i=0;i<count;i++){const cycle=(t*.035+i/count)%1;const shop=positions.get(`plot:${plots.filter(p=>p.state==='solved')[i%Math.max(1,count/2)]?.n}`)??V();const approach=phone()?V(0,.29,shop.z):V(shop.x,.29,0);const counter=shop.clone().add(V(-2.8,0,0));if(cycle<.35)dummy.position.copy(roadA).lerp(approach,cycle/.35);else if(cycle<.5)dummy.position.copy(approach).lerp(counter,(cycle-.35)/.15);else if(cycle<.65)dummy.position.copy(counter);else if(cycle<.8)dummy.position.copy(counter).lerp(approach,(cycle-.65)/.15);else dummy.position.copy(approach).lerp(roadB,(cycle-.8)/.2);dummy.position.y=.85+Math.sin(t*5+i)*.04;positions.set(`customer:${i}`,dummy.position.clone());dummy.scale.setScalar(low?0:1);dummy.rotation.set(0,0,0);dummy.updateMatrix();customers.setMatrixAt(i,dummy.matrix);dummy.position.y+=.4;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);}customers.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;
    if(flyTo) {const f=Math.min(1,(performance.now()-flyStart)/550),ease=1-(1-f)**3;const dest=flyTo.clone().add(V(5,9,8));camera.position.lerpVectors(origin,dest,ease);camera.lookAt(target.clone().lerp(flyTo,ease));camera.zoom=1+ease*1.3;camera.updateProjectionMatrix();if(f===1){flyResolve?.();flyResolve=undefined;}}
    paths.forEach((path,i)=>{for(let k=0;k<3;k++){dummy.position.copy(path.a).lerp(path.b,(t*.16+k/3)%1);dummy.position.y+=.09;dummy.scale.setScalar(path.portal?0:1);dummy.rotation.set(Math.PI/2,0,-Math.atan2(path.b.x-path.a.x,path.b.z-path.a.z));dummy.updateMatrix();arrows.setMatrixAt(i*3+k,dummy.matrix);}});arrows.instanceMatrix.needsUpdate=true;
    houseIds.forEach((key,h)=>{const id=key.slice(6) as PersonId,pos=positions.get(key)!,total=savedTotals[id],n=total?Math.min(18,Number(total.near/10n**22n+total.wei/10n**14n)):0;
      for(let k=0;k<18;k++){dummy.position.copy(pos).add(V(.95+(k%3)*.22,.4+Math.floor(k/3)*.1,.5));dummy.rotation.set(0,0,0);dummy.scale.setScalar(k<n?1:0);dummy.updateMatrix();piles.setMatrixAt(h*18+k,dummy.matrix);}
      const bi=houseBoxIndices[h];if(bi!==undefined){const b=boxes[bi],age=t-(arrivals.get(id)??-100),bounce=age<.8?Math.sin(age/.8*Math.PI)*.12:0;dummy.position.copy(b.p);dummy.scale.copy(b.s).multiply(V(1,1+bounce,1));dummy.updateMatrix();boxMesh.setMatrixAt(bi,dummy.matrix);}
    });piles.instanceMatrix.needsUpdate=true;boxMesh.instanceMatrix.needsUpdate=true;
    r.render(scene,camera);
    // Hit areas follow actual belt segments and walking people; no extra draw calls.
    paths.forEach((path,i)=>{positions.set(`belt:${i}`,path.a.clone().lerp(path.b,.5).setY(.6));const hit=overlay.querySelector<HTMLElement>(`[data-factory-anchor="belt:${i}"]`);if(hit)hit.dataset.reason='Belt · simulated preview: '+path.reason();});
    overlay.querySelectorAll<HTMLElement>('[data-factory-anchor]').forEach(el=>{const pos=positions.get(el.dataset.factoryAnchor!);if(!pos)return;const v=pos.clone().add(V(0,el.dataset.factoryAnchor!.startsWith('plot')?2.8:2.7,el.dataset.factoryAnchor!.startsWith('plot')?-3.3:0)).project(camera);el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-50%)`;});
  }
  let last=performance.now();function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden)draw(dt);raf=requestAnimationFrame(loop);}
  const hitAreas:HTMLElement[]=[];
  paths.forEach((path,i)=>{const el=document.createElement('button');el.className='j-factory-hit j-factory-belt-hit';el.dataset.factoryAnchor=`belt:${i}`;el.setAttribute('aria-label','Inspect factory belt');el.dataset.reason='Belt · simulated preview: '+path.reason();overlay.append(el);hitAreas.push(el);});
  for(let i=0;i<count;i++){const el=document.createElement('button');el.className='j-factory-hit';el.dataset.factoryAnchor=`customer:${i}`;el.setAttribute('aria-label','Inspect simulated customer');el.dataset.reason='Simulated customer: buys one loaf for 0.10 NEAR. Factory traffic never submits real orders.';overlay.append(el);hitAreas.push(el);}
  resize();draw();if(!stepped)raf=requestAnimationFrame(loop);
  const observer=new ResizeObserver(()=>{resize();draw();});observer.observe(canvas);
  (window as unknown as {__wwFactory:unknown}).__wwFactory={advance:(s:number)=>draw(s),info:()=>({calls:r.info.render.calls,triangles:r.info.render.triangles,coins:coinCount,customers:count,budget:{calls:150,triangles:120000}})};
  const timers:ReturnType<typeof setTimeout>[]=[];
  return {setTotals(totals:HouseTotals){savedTotals=totals;draw();},arrive(totals:HouseTotals){for(const [id,value] of Object.entries(totals)){if(!value)continue;arrivals.set(id as PersonId,t);const el=overlay.querySelector(`[data-factory-anchor="house:${id}"]`);if(el){el.querySelector('.j-sim-arrival')?.remove();const tag=document.createElement('strong');tag.className='j-sim-arrival';tag.textContent=value.wei>0n?`+${exact(value.wei,18)} ETH`:`+${exact(value.near)} NEAR`;el.append(tag);timers.push(setTimeout(()=>tag.remove(),1800));}}},fly(n:number){if(low||stepped)return Promise.resolve();return new Promise<void>(resolve=>{flyTo=positions.get(`plot:${n}`);flyStart=performance.now();flyResolve=resolve;});},confirmed(id:PersonId,plotNumber?:number){const plot=plotNumber?plots.find(p=>p.n===plotNumber):plots.filter(p=>p.shipped&&housesFor(p.build,p.n===5?abroad:'chi').some(h=>h.person===id)).at(-1);const el=overlay.querySelector(`[data-factory-anchor="${plot?'plot:'+plot.n:'house:'+id}"]`);if(!el)return;const tag=document.createElement('strong');tag.className='j-real-coin';tag.textContent='TESTNET · confirmed';el.append(tag);timers.push(setTimeout(()=>tag.remove(),4000));},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();timers.forEach(clearTimeout);hitAreas.forEach(el=>el.remove());resources.forEach(v=>v.dispose());r.dispose();if(!canvas.isConnected)r.forceContextLoss();}};
}
