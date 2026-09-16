import {Canvas,useFrame} from '@react-three/fiber'
import {Bloom,EffectComposer} from '@react-three/postprocessing'
import {Float} from '@react-three/drei'
import {useMemo,useRef} from 'react'
import * as THREE from 'three'

function Triangle({direction,state}:{direction:string;state:string}){
  const mesh=useRef<THREE.Mesh>(null!)
  const halo=useRef<THREE.Mesh>(null!)

  const color=
    state.includes('EXIT')?'#ffffff':
    direction==='SHORT'?'#ff334f':
    state.includes('ARMED')?'#ffc247':
    '#00ff6a'

  const geometry=useMemo(()=>{
    const s=new THREE.Shape()
    s.moveTo(0,1.15)
    s.lineTo(-1,-.85)
    s.lineTo(1,-.85)
    s.lineTo(0,1.15)

    const g=new THREE.ExtrudeGeometry(s,{
      depth:.28,
      bevelEnabled:true,
      bevelThickness:.11,
      bevelSize:.09,
      bevelSegments:5,
    })
    g.center()
    return g
  },[])

  useFrame(({clock})=>{
    const t=clock.getElapsedTime()
    const armed=state.includes('ARMED')
    mesh.current.scale.setScalar(
      1+Math.sin(t*(armed?4.8:2.2))*(armed?.055:.024)
    )
    mesh.current.rotation.y=Math.sin(t*.35)*.14
    mesh.current.rotation.z=direction==='SHORT'?Math.PI:0
    halo.current.rotation.z+=.003
  })

  return <Float speed={1.2} floatIntensity={.13}>
    <group>
      <mesh ref={halo}>
        <torusGeometry args={[1.7,.015,8,140]}/>
        <meshBasicMaterial color={color} transparent opacity={.30}/>
      </mesh>
      <mesh ref={mesh} geometry={geometry}>
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={3.3}
          roughness={.16}
          metalness={.5}
          clearcoat={1}
        />
      </mesh>
    </group>
  </Float>
}

export function TriangleCore({direction,state}:{direction:string;state:string}){
  return <div className="triangle-core">
    <Canvas camera={{position:[0,0,5.3],fov:42}}>
      <ambientLight intensity={.24}/>
      <pointLight position={[2,2,3]} intensity={5} color="#00ff6a"/>
      <Triangle direction={direction} state={state}/>
      <EffectComposer>
        <Bloom luminanceThreshold={.12} intensity={2.2}/>
      </EffectComposer>
    </Canvas>
  </div>
}
