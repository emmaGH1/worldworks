// A bounded instanced overview. One renderer, no postprocess or shadows; DOM owns interaction.
import * as THREE from 'three';
import { layoutFor } from './scene';
import { JOBS, PEOPLE, type PersonId } from './jobs';
import { housesFor, type Plot } from './factory';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
export function createFactoryScene(canvas:HTMLCanvasElement,overlay:HTMLElement,plots:Plot[],abroad?:PersonId) {
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
    return {dispose(){overlay.classList.remove('fallback');},fly:async(_n:number)=>{},confirmed(_id:PersonId,_plot?:number){}};
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
  const boxes:Box[]=[],roofs:Box[]=[],spheres:Box[]=[],paths:{a:THREE.Vector3;b:THREE.Vector3;plot:number;portal:boolean}[]=[];
  function box(p:THREE.Vector3,s:THREE.Vector3,c:string,ry=0){boxes.push({p,s,c,ry});}
  function segment(a:THREE.Vector3,b:THREE.Vector3,c='#555e61',width=.32) {
    const d=b.clone().sub(a);boxes.push({p:a.clone().add(b).multiplyScalar(.5),s:V(width,.12,d.length()),c,q:new THREE.Quaternion().setFromUnitVectors(V(0,0,1),d.clone().normalize())});
  }
  function belt(a:THREE.Vector3,b:THREE.Vector3,plot:number,portal=false) { if(portal) {const start=a.clone().setY(1.2),mid=a.clone().add(b).multiplyScalar(.5).setY(5),end=b.clone().setY(1.2);segment(start,mid,'#ac94f2',.13);segment(mid,end,'#ac94f2',.13);paths.push({a:start,b:mid,plot,portal},{a:mid,b:end,plot,portal});return;} const elbow=V(b.x,.36,a.z);const start=a.clone().setY(.36),end=b.clone().setY(.36);segment(start,elbow,portal?'#8e73de':'#5e6966');segment(elbow,end,portal?'#8e73de':'#5e6966');paths.push({a:start,b:elbow,plot,portal},{a:elbow,b:end,plot,portal}); }
  box(V(0,-.9,0),V(90,.3,90),'#358d98');box(V(-1,-.35,0),phone()?V(27,1,40):V(35,1,31),'#d8bf96');box(V(-1,.16,0),phone()?V(26,.2,39):V(34,.2,30),'#89bd69');
  box(V(phone()?17:24,0,-6),V(8,1.2,10),'#adb9df');
  const roadA=phone()?V(0,.29,-18):V(-16,.29,0),roadB=phone()?V(0,.29,18):V(16,.29,0);segment(roadA,roadB,'#dac7a4',1.5);
  for(const p of plots) {
    const at=positions.get(`plot:${p.n}`)!;
    box(at.clone().setY(.3),V(8,.25,8),p.state==='locked'?'#758f6d':p.state==='next'?'#f6d983':'#f1e7d1');
    if(p.state!=='solved')continue;
    box(at.clone().add(V(-2.8,.9,0)),V(1.2,1.3,1.6),'#d49368');
    roofs.push({p:at.clone().add(V(-2.8,1.8,0)),s:V(1.1,.65,1.1),c:'#e75d63',ry:Math.PI/4});
    const L=layoutFor(JOBS[p.n-1],p.build,{people:JOBS[p.n-1].people});
    const local=(v:THREE.Vector3)=>at.clone().add(V(v.x*.28,.55,v.z*.52));
    const node=(id:string)=>local(L.nodes[id]??L.keys[id]??V());
    belt(at.clone().add(V(-2.2,0,0)),node('r'),p.n);
    for(const e of L.edges)belt(node(e.from),node(e.to),p.n);
    for(const [id,part] of Object.entries(p.build))if(part) {
      const pos=node(id);box(pos.clone().setY(.8),V(.85,.75,.85),colors[part.kind]);
      if(part.kind==='Splitter') spheres.push({p:pos.clone().setY(1.3),s:V(.28,.1,.28),c:'#fff4ce'});
      if(part.kind==='Portal') roofs.push({p:pos.clone().setY(1.4),s:V(.5,.7,.5),c:'#ada0ff'});
    }
    for(const output of housesFor(p.build,p.n===5?abroad:'chi')) {
      const house=positions.get(`house:${output.person}`);if(house)belt(node(output.socket),house,p.n,output.portal);
    }
  }
  for(const [id,pos] of positions)if(id.startsWith('house:')) {const person=id.slice(6) as PersonId;box(pos.clone().setY(.85),V(1.7,1.4,1.5),PEOPLE[person].shirt);roofs.push({p:pos.clone().setY(1.95),s:V(1.5,.9,1.4),c:person==='chi'?'#8b80d1':'#b75b48',ry:Math.PI/4});box(pos.clone().add(V(0,.55,.77)),V(.4,.8,.08),'#493f37');}
  function instances(items:Box[],geo:THREE.BufferGeometry) {
    const mesh=new THREE.InstancedMesh(own(geo),own(new THREE.MeshStandardMaterial({roughness:.8})),items.length);
    items.forEach((b,i)=>{dummy.position.copy(b.p);dummy.scale.copy(b.s);dummy.rotation.set(0,b.ry??0,0);if(b.q)dummy.quaternion.copy(b.q);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new THREE.Color(b.c));});scene.add(mesh);return mesh;
  }
  instances(boxes,new THREE.BoxGeometry());instances(roofs,new THREE.ConeGeometry(1,1,4));instances(spheres,new THREE.CylinderGeometry(1,1,1,12));
  const coinCount=Math.min(72,paths.length*2), coins=new THREE.InstancedMesh(own(new THREE.SphereGeometry(.13,8,6)),own(new THREE.MeshStandardMaterial({color:'#ffe06a',metalness:.3,roughness:.4})),coinCount);scene.add(coins);
  const count=plots.filter(p=>p.state==='solved').length*2;
  const customers=new THREE.InstancedMesh(own(new THREE.CapsuleGeometry(.16,.3,3,6)),own(new THREE.MeshStandardMaterial({color:'#f9d1a2'})),count);scene.add(customers);
  const heads=new THREE.InstancedMesh(own(new THREE.SphereGeometry(.15,8,6)),own(new THREE.MeshStandardMaterial({color:'#d6a078'})),count);scene.add(heads);
  customers.material.color.set('#df8a66');
  let t=0,raf=0,disposed=false,flyTo:THREE.Vector3|undefined,flyStart=0,flyResolve:(()=>void)|undefined;
  const origin=camera.position.clone(),target=phone()?V():V(3,0,0);
  const opened=performance.now();
  function resize(){
    r.setSize(innerWidth,innerHeight,false);camera.updateMatrixWorld();
    const pts=phone()?[V(-10,0,-16),V(10,0,-16),V(-10,0,17),V(10,0,17)]:[V(-18,0,-16),V(29,0,-16),V(-18,0,16),V(29,0,16)];
    const projected=pts.map(p=>p.clone().applyMatrix4(camera.matrixWorldInverse));
    const minX=Math.min(...projected.map(p=>p.x)),maxX=Math.max(...projected.map(p=>p.x)),minY=Math.min(...projected.map(p=>p.y)),maxY=Math.max(...projected.map(p=>p.y));
    const top=phone()?205:220,bottom=phone()?185:65,side=phone()?30:80;
    const scale=Math.max((maxX-minX)/(innerWidth-side*2),(maxY-minY)/Math.max(200,innerHeight-top-bottom));
    const cx=(minX+maxX)/2,cy=(minY+maxY)/2+(top-bottom)/2*scale;
    camera.left=cx-innerWidth/2*scale;camera.right=cx+innerWidth/2*scale;camera.top=cy+innerHeight/2*scale;camera.bottom=cy-innerHeight/2*scale;camera.updateProjectionMatrix();
  }
  function draw(dt=0) {
    if(disposed)return;
    if(!document.hidden&&!low)t+=dt;
    const animate=!low&&!document.hidden;
    if(!flyTo&&!low&&!stepped){camera.zoom=1+.65*Math.max(0,1-(performance.now()-opened)/650)**3;camera.updateProjectionMatrix();}
    for(let i=0;i<coinCount;i++) {const path=paths[i%Math.max(1,paths.length)];dummy.position.copy(path?.a??V(0,-20,0));if(path)dummy.position.lerp(path.b,(t*.16+i*.317)%1);dummy.position.y+=.17;dummy.rotation.set(0,t+i,0);dummy.scale.setScalar(animate?1:0);dummy.updateMatrix();coins.setMatrixAt(i,dummy.matrix);}coins.instanceMatrix.needsUpdate=true;
    for(let i=0;i<count;i++){const cycle=(t*.035+i/count)%1;const shop=positions.get(`plot:${plots.filter(p=>p.state==='solved')[i%Math.max(1,count/2)]?.n}`)??V();const approach=phone()?V(0,.29,shop.z):V(shop.x,.29,0);const counter=shop.clone().add(V(-2.8,0,0));if(cycle<.35)dummy.position.copy(roadA).lerp(approach,cycle/.35);else if(cycle<.5)dummy.position.copy(approach).lerp(counter,(cycle-.35)/.15);else if(cycle<.65)dummy.position.copy(counter);else if(cycle<.8)dummy.position.copy(counter).lerp(approach,(cycle-.65)/.15);else dummy.position.copy(approach).lerp(roadB,(cycle-.8)/.2);dummy.position.y=.85+Math.sin(t*5+i)*.04;dummy.scale.setScalar(low?0:1);dummy.rotation.set(0,0,0);dummy.updateMatrix();customers.setMatrixAt(i,dummy.matrix);dummy.position.y+=.4;dummy.updateMatrix();heads.setMatrixAt(i,dummy.matrix);}customers.instanceMatrix.needsUpdate=true;heads.instanceMatrix.needsUpdate=true;
    if(flyTo) {const f=Math.min(1,(performance.now()-flyStart)/550),ease=1-(1-f)**3;const dest=flyTo.clone().add(V(5,9,8));camera.position.lerpVectors(origin,dest,ease);camera.lookAt(target.clone().lerp(flyTo,ease));camera.zoom=1+ease*1.3;camera.updateProjectionMatrix();if(f===1){flyResolve?.();flyResolve=undefined;}}
    r.render(scene,camera);
    overlay.querySelectorAll<HTMLElement>('[data-factory-anchor]').forEach(el=>{const pos=positions.get(el.dataset.factoryAnchor!);if(!pos)return;const v=pos.clone().add(V(0,el.dataset.factoryAnchor!.startsWith('plot')?.7:2.7,el.dataset.factoryAnchor!.startsWith('plot')?-3.3:0)).project(camera);el.style.transform=`translate(${(v.x*.5+.5)*innerWidth}px,${(-v.y*.5+.5)*innerHeight}px) translate(-50%,-50%)`;});
  }
  let last=performance.now();function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(!document.hidden)draw(dt);raf=requestAnimationFrame(loop);}
  resize();draw();if(!stepped)raf=requestAnimationFrame(loop);
  const observer=new ResizeObserver(()=>{resize();draw();});observer.observe(canvas);
  (window as unknown as {__wwFactory:unknown}).__wwFactory={advance:(s:number)=>draw(s),info:()=>({calls:r.info.render.calls,triangles:r.info.render.triangles,coins:coinCount,customers:count,budget:{calls:150,triangles:120000}})};
  const timers:ReturnType<typeof setTimeout>[]=[];
  return {fly(n:number){if(low||stepped)return Promise.resolve();return new Promise<void>(resolve=>{flyTo=positions.get(`plot:${n}`);flyStart=performance.now();flyResolve=resolve;});},confirmed(id:PersonId,plotNumber?:number){const plot=plotNumber?plots.find(p=>p.n===plotNumber):plots.filter(p=>p.shipped&&housesFor(p.build,p.n===5?abroad:'chi').some(h=>h.person===id)).at(-1);const el=overlay.querySelector(`[data-factory-anchor="${plot?'plot:'+plot.n:'house:'+id}"]`);if(!el)return;const tag=document.createElement('strong');tag.className='j-real-coin';tag.textContent='TESTNET · confirmed';el.append(tag);timers.push(setTimeout(()=>tag.remove(),4000));},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();timers.forEach(clearTimeout);resources.forEach(v=>v.dispose());r.dispose();r.forceContextLoss();}};
}
