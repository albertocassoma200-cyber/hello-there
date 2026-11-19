import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: "GTA Angola — Vida Sem Limites" },
    { name: "description", content: "Explora Luanda num mundo aberto 3D. Conduz, descobre a cidade e completa missões." },
    { property: "og:title", content: "GTA Angola — Vida Sem Limites" },
    { property: "og:description", content: "Uma aventura de mundo aberto inspirada em Luanda." },
  ] }),
});

type Vehicle = { root: THREE.Group; speed: number; occupied: boolean; color: number };
const clamp = (v:number,a:number,b:number) => Math.max(a,Math.min(b,v));

function Index() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const [money,setMoney] = useState(2500);
  const [mission,setMission] = useState(0);
  const [inCar,setInCar] = useState(false);
  const [paused,setPaused] = useState(false);
  const [night,setNight] = useState(false);
  const [message,setMessage] = useState("Bem-vindo a Luanda. Entra num carro ou explora a cidade!");
  const [speed,setSpeed] = useState(0);
  const pausedRef = useRef(false);
  const missionRef = useRef(0);
  useEffect(()=>{ pausedRef.current=paused; },[paused]);
  useEffect(()=>{ missionRef.current=mission; const g=gameRef.current; if(g?.marker){g.marker.position.set(mission===0?0:58,0,mission===0?-34:48);g.marker.visible=mission<2;} },[mission]);\n  const pausedRef = useRef(false);\n  const missionRef = useRef(0);\n  useEffect(()=>{ pausedRef.current=paused; },[paused]);\n  useEffect(()=>{ missionRef.current=mission; const g=gameRef.current; if(g?.marker){g.marker.position.set(mission===0?0:58,0,mission===0?-34:48);g.marker.visible=mission<2;} },[mission]);
  const [full,setFull] = useState(false);

  const interact = useCallback(() => {
    const g=gameRef.current; if(!g) return;
    if(g.vehicle) {
      g.vehicle.occupied=false; g.player.visible=true;
      g.player.position.copy(g.vehicle.root.position).add(new THREE.Vector3(2,0,2));
      g.vehicle=null; setInCar(false); setMessage("Saíste do veículo."); return;
    }
    let nearest:Vehicle|null=null, best=5.2;
    g.vehicles.forEach((v:Vehicle)=>{const d=v.root.position.distanceTo(g.player.position);if(d<best){best=d;nearest=v;}});
    if(nearest){nearest.occupied=true;g.vehicle=nearest;g.player.visible=false;setInCar(true);setMessage("Veículo pronto. Usa W/A/S/D para conduzir.");return;}
    const currentMission=missionRef.current;
    const target = currentMission===0 ? new THREE.Vector3(0,0,-34) : new THREE.Vector3(58,0,48);
    if(currentMission<2 && g.player.position.distanceTo(target)<7){setMission(currentMission+1);setMoney((m)=>m+5000);setMessage(currentMission===0?"Encomenda recolhida! Leva-a ao destino. +5.000 Kz":"Missão concluída! +5.000 Kz. Continua a explorar!");}
    else setMessage("Aproxima-te de um carro ou do marcador amarelo e prime E.");
  },[]);

  useEffect(()=>{
    const host=mountRef.current;if(!host)return;
    const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9bb8c6); scene.fog=new THREE.Fog(0x9bb8c6,75,230);
    const camera=new THREE.PerspectiveCamera(65,1,.1,500);
    const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:"high-performance"});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
    host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xd9edff,0x66513b,2.0));
    const sun=new THREE.DirectionalLight(0xffe0b1,3.1);sun.position.set(-55,90,45);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-100;sun.shadow.camera.right=100;sun.shadow.camera.top=100;sun.shadow.camera.bottom=-100;scene.add(sun);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(420,420),new THREE.MeshStandardMaterial({color:0x9c9a78,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
    const roadMat=new THREE.MeshStandardMaterial({color:0x343b40,roughness:.94});
    const lineMat=new THREE.MeshStandardMaterial({color:0xe7c978,emissive:0x5a4211});
    for(let i=-3;i<=3;i++){
      const x=i*28;const road=new THREE.Mesh(new THREE.BoxGeometry(9,.08,420),roadMat);road.position.set(x,.04,0);road.receiveShadow=true;scene.add(road);
      for(let z=-205;z<210;z+=12){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.1,5),lineMat);dash.position.set(x,.1,z);scene.add(dash);}
      const cross=new THREE.Mesh(new THREE.BoxGeometry(420,.08,9),roadMat);cross.position.set(0,.05,i*28);cross.receiveShadow=true;scene.add(cross);
    }
    const buildingMats=[0xc68d69,0xd5b98a,0x9eaaa8,0x788e9d,0xb9a18c,0x8c7868].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.88}));
    const glass=new THREE.MeshStandardMaterial({color:0x6f9ba8,metalness:.28,roughness:.24});
    for(let x=-180;x<=180;x+=14)for(let z=-180;z<=180;z+=14){
      if(Math.abs(x%28)<7 || Math.abs(z%28)<7)continue;
      if(Math.abs(x)<20&&Math.abs(z)<20)continue;
      const h=5+((Math.abs(x*7+z*3)%17));const w=6+(Math.abs(x+z)%4);
      const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,7),buildingMats[Math.abs(Math.floor(x+z))%buildingMats.length]);
      b.position.set(x,h/2,z);b.castShadow=true;b.receiveShadow=true;scene.add(b);
      const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.2,.25,7.2),new THREE.MeshStandardMaterial({color:0x514b43}));roof.position.set(x,h+.12,z);scene.add(roof);
      for(let yy=2;yy<h-1;yy+=2.5){const win=new THREE.Mesh(new THREE.BoxGeometry(.75,.95,.06),glass);win.position.set(x-w/2+.7,yy,z+3.54);scene.add(win);const win2=win.clone();win2.position.x=x+w/2-.7;scene.add(win2);}
    }
    // Luanda waterfront and promenade
    const sea=new THREE.Mesh(new THREE.PlaneGeometry(115,85),new THREE.MeshStandardMaterial({color:0x247e91,roughness:.3,metalness:.12}));sea.rotation.x=-Math.PI/2;sea.position.set(-118,.03,105);scene.add(sea);
    const sand=new THREE.Mesh(new THREE.PlaneGeometry(130,20),new THREE.MeshStandardMaterial({color:0xd7bd82}));sand.rotation.x=-Math.PI/2;sand.position.set(-112,.06,61);scene.add(sand);
    for(let i=0;i<13;i++){const palm=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.22,.38,5,8),new THREE.MeshStandardMaterial({color:0x805535}));trunk.position.y=2.5;palm.add(trunk);for(let j=0;j<7;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.42,4,5),new THREE.MeshStandardMaterial({color:0x286b3d}));leaf.position.y=5;leaf.rotation.z=Math.PI/2;leaf.rotation.y=j*Math.PI*2/7;leaf.position.x=Math.cos(j*Math.PI*2/7)*1.5;leaf.position.z=Math.sin(j*Math.PI*2/7)*1.5;palm.add(leaf);}palm.position.set(-165+i*8,0,54);scene.add(palm);}
    // Landmark tower
    const tower=new THREE.Mesh(new THREE.BoxGeometry(13,48,13),glass);tower.position.set(4,24,-72);tower.castShadow=true;scene.add(tower);
    const towerTop=new THREE.Mesh(new THREE.CylinderGeometry(1.4,2,8,12),new THREE.MeshStandardMaterial({color:0xd7b36a,metalness:.5}));towerTop.position.set(4,52,-72);scene.add(towerTop);
    // Player character: stylized detailed third-person model
    const player=new THREE.Group();
    const skin=new THREE.MeshStandardMaterial({color:0x8b5538,roughness:.8}),shirt=new THREE.MeshStandardMaterial({color:0x263d52}),pants=new THREE.MeshStandardMaterial({color:0x24282d}),shoe=new THREE.MeshStandardMaterial({color:0x111519});
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.85,5,10),shirt);torso.position.y=1.65;torso.castShadow=true;player.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.34,18,14),skin);head.position.y=2.55;head.castShadow=true;player.add(head);
    const hair=new THREE.Mesh(new THREE.SphereGeometry(.35,16,10,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0x171514}));hair.position.y=2.68;player.add(hair);
    for(const side of [-1,1]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.19,.72,4,8),pants);leg.position.set(side*.23,.57,0);player.add(leg);const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.65,4,8),skin);arm.position.set(side*.57,1.72,0);arm.rotation.z=side*.12;player.add(arm);const foot=new THREE.Mesh(new THREE.BoxGeometry(.3,.16,.48),shoe);foot.position.set(side*.23,.12,.08);player.add(foot);}
    player.position.set(0,0,0);scene.add(player);
    const vehicles:Vehicle[]=[];
    const makeCar=(x:number,z:number,color:number)=>{
      const root=new THREE.Group();const paint=new THREE.MeshStandardMaterial({color,metalness:.55,roughness:.28});const body=new THREE.Mesh(new THREE.BoxGeometry(2.25,.72,4.2),paint);body.position.y=.78;body.castShadow=true;root.add(body);
      const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.72,.78,2.05),new THREE.MeshStandardMaterial({color:0x253943,metalness:.35,roughness:.2}));cabin.position.set(0,1.42,-.25);root.add(cabin);
      const hood=new THREE.Mesh(new THREE.BoxGeometry(2.12,.18,1.05),paint);hood.position.set(0,1.02,1.48);root.add(hood);
      const wheelMat=new THREE.MeshStandardMaterial({color:0x17191c,roughness:.92}),rim=new THREE.MeshStandardMaterial({color:0xaeb8bc,metalness:.8,roughness:.25});
      for(const sx of [-1,1])for(const sz of [-1,1]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.22,16),wheelMat);wheel.rotation.z=Math.PI/2;wheel.position.set(sx*1.12,.43,sz*1.35);wheel.castShadow=true;root.add(wheel);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.235,12),rim);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);root.add(hub);}
      const lampMat=new THREE.MeshStandardMaterial({color:0xffe9b2,emissive:0x6c5124});for(const sx of [-.72,.72]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.38,.2,.08),lampMat);lamp.position.set(sx,.88,2.12);root.add(lamp);}
      root.position.set(x,0,z);scene.add(root);vehicles.push({root,speed:0,occupied:false,color});
    };
    makeCar(8,4,0xb72f27);makeCar(-12,-12,0xd8d9d3);makeCar(34,18,0x276b8a);makeCar(-38,28,0xc6a13d);makeCar(17,-45,0x46724b);
    // Mission marker
    const marker=new THREE.Group();const ring=new THREE.Mesh(new THREE.TorusGeometry(2.1,.13,8,40),new THREE.MeshStandardMaterial({color:0xffd34e,emissive:0x9b6410}));ring.rotation.x=Math.PI/2;ring.position.y=.15;marker.add(ring);const beam=new THREE.Mesh(new THREE.CylinderGeometry(.05,.8,3,16,1,true),new THREE.MeshBasicMaterial({color:0xffcf48,transparent:true,opacity:.22,side:THREE.DoubleSide}));beam.position.y=1.5;marker.add(beam);marker.position.set(0,0,-34);scene.add(marker);
    const keys=new Set<string>();let yaw=0,frame=0,lastSpeedUpdate=0;
    const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();};resize();const ro=new ResizeObserver(resize);ro.observe(host);
    const down=(e:KeyboardEvent)=>{const k=e.key.toLowerCase();if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k))e.preventDefault();keys.add(k);if(k==="e")interact();if(k==="escape")setPaused(p=>!p);};const up=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    let dragging=false,lastX=0;const pointerDown=(e:PointerEvent)=>{dragging=true;lastX=e.clientX;};const pointerMove=(e:PointerEvent)=>{if(dragging){yaw-=(e.clientX-lastX)*.004;lastX=e.clientX;}};const pointerUp=()=>dragging=false;
    renderer.domElement.addEventListener("pointerdown",pointerDown);window.addEventListener("pointermove",pointerMove);window.addEventListener("pointerup",pointerUp);
    gameRef.current={scene,camera,renderer,player,vehicles,vehicle:null,keys,marker};
    const clock=new THREE.Clock();
    const animate=(t:number)=>{frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.04);if(!pausedRef.current){
      const forward=keys.has("w")||keys.has("arrowup"),back=keys.has("s")||keys.has("arrowdown"),left=keys.has("a")||keys.has("arrowleft"),right=keys.has("d")||keys.has("arrowright");
      const actor:THREE.Group=gActor();function gActor(){return gameRef.current?.vehicle?.root??player;}
      if(gameRef.current?.vehicle){const v=gameRef.current.vehicle;const throttle=(forward?1:0)-(back?.7:0);v.speed=THREE.MathUtils.damp(v.speed,throttle*25,2.2,dt);if(left)actor.rotation.y+=2*dt*Math.sign(v.speed||1);if(right)actor.rotation.y-=2*dt*Math.sign(v.speed||1);actor.translateZ(-v.speed*dt);actor.position.x=clamp(actor.position.x,-195,195);actor.position.z=clamp(actor.position.z,-195,195);if(t-lastSpeedUpdate>180){if(t-lastSpeedUpdate>180){setSpeed(Math.round(Math.abs(v.speed)*4));lastSpeedUpdate=t;}lastSpeedUpdate=t;}}
      else{const moving=forward||backwardCheck(back);if(left)yaw+=2.4*dt;if(right)yaw-=2.4*dt;player.rotation.y=yaw;const dir=(forward?1:0)-(back?1:0);if(moving){player.translateZ(-dir*(keys.has("shift")?10:6)*dt);}player.position.x=clamp(player.position.x,-195,195);player.position.z=clamp(player.position.z,-195,195);if(t-lastSpeedUpdate>180){if(t-lastSpeedUpdate>180){setSpeed(0);lastSpeedUpdate=t;}lastSpeedUpdate=t;}}
      const follow=actor.position.clone().add(new THREE.Vector3(Math.sin(actor.rotation.y)*10,6.2,Math.cos(actor.rotation.y)*10));camera.position.lerp(follow,.095);camera.lookAt(actor.position.clone().add(new THREE.Vector3(0,1.5,0)));
      marker.rotation.y+=dt*.8;marker.position.y=.12+Math.sin(t*.002)*.12;
    }
    renderer.render(scene,camera);};
    function backwardCheck(v:boolean){return v;}
    frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);ro.disconnect();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);renderer.domElement.removeEventListener("pointerdown",pointerDown);window.removeEventListener("pointermove",pointerMove);window.removeEventListener("pointerup",pointerUp);renderer.dispose();if(host.contains(renderer.domElement))host.removeChild(renderer.domElement);scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const m=o.material;if(Array.isArray(m))m.forEach(x=>x.dispose());else m.dispose();}});gameRef.current=null;};
  },[interact]);

  useEffect(()=>{const g=gameRef.current;if(!g)return;g.scene.background=new THREE.Color(night?0x111b32:0x9bb8c6);g.scene.fog.color.set(night?0x111b32:0x9bb8c6);},[night]);
  const press=(key:string,on:boolean)=>{const g=gameRef.current;if(!g)return;if(on)g.keys.add(key);else g.keys.delete(key);};
  const toggleFull=async()=>{const el=document.getElementById("gta-frame");try{if(!document.fullscreenElement&&el){await el.requestFullscreen();setFull(true);}else if(document.fullscreenElement){await document.exitFullscreen();setFull(false);}}catch{setMessage("Ecrã inteiro não suportado neste navegador.");}};
  return <main className="gta-page"><div className="gta-shell">
    <header className="gta-header"><div className="gta-brand"><div className="gta-logo">GA</div><div><div className="gta-title">GTA ANGOLA</div><div className="gta-subtitle">VIDA SEM LIMITES · LUANDA, ANGOLA</div></div></div>
    <div className="gta-actions"><button onClick={()=>setNight(n=>!n)}>{night?"☀ DIA":"☾ NOITE"}</button><button onClick={()=>setPaused(p=>!p)}>{paused?"▶ CONTINUAR":"Ⅱ PAUSAR"}</button><button className="gta-gold" onClick={toggleFull}>{full?"SAIR DO ECRÃ INTEIRO":"⛶ ECRÃ INTEIRO"}</button></div></header>
    <section className="gta-stats"><div><small>CARTEIRA</small><strong>{money.toLocaleString("pt-PT")} Kz</strong></div><div><small>ESTADO</small><strong>{inCar?"A CONDUZIR":"A PÉ"}</strong></div><div><small>VELOCIDADE</small><strong>{speed} km/h</strong></div><div className="gta-objective"><small>OBJECTIVO</small><strong>{mission===0?"VAI AO MERCADO RECOLHER A ENCOMENDA":mission===1?"ENTREGA A ENCOMENDA NO DESTINO":"MISSÃO CONCLUÍDA · EXPLORA A CIDADE"}</strong></div></section>
    <section className="gta-frame" id="gta-frame"><div className="gta-world" ref={mountRef}/><div className="gta-location"><b>● AO VIVO</b><span>LUANDA · MUNDO ABERTO 3D</span></div><div className="gta-hint">{message}</div>{paused&&<div className="gta-paused"><div><h2>JOGO PAUSADO</h2><p>A cidade espera por ti.</p><button className="gta-gold" onClick={()=>setPaused(false)}>CONTINUAR</button></div></div>}
    <div className="gta-touch"><div className="gta-dpad"><button onPointerDown={()=>press("w",true)} onPointerUp={()=>press("w",false)} onPointerLeave={()=>press("w",false)}>▲</button><button onPointerDown={()=>press("a",true)} onPointerUp={()=>press("a",false)} onPointerLeave={()=>press("a",false)}>◀</button><button onPointerDown={()=>press("s",true)} onPointerUp={()=>press("s",false)} onPointerLeave={()=>press("s",false)}>▼</button><button onPointerDown={()=>press("d",true)} onPointerUp={()=>press("d",false)} onPointerLeave={()=>press("d",false)}>▶</button></div><button className="gta-action" onPointerDown={interact}>AÇÃO · E</button></div></section>
    <footer className="gta-footer"><span><kbd>W A S D</kbd> MOVER / CONDUZIR　 <kbd>E</kbd> INTERAGIR　 <kbd>SHIFT</kbd> CORRER</span><span>ARRASTA O RATO PARA RODAR A CÂMARA</span></footer>
  </div></main>;
}
