import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import LoadModel from './ModelLoader';
import { Utils } from './Utils';
import { CameraControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { FaceExtractor } from './FaceExtractor';
import { ClipPlane } from './ClipPlane';

export default function AppTest() {
    const cameraControlsRef = useRef();
    const inputRef1 = useRef();
    const inputRef2 = useRef();
    const [model1, setModel1] = useState(null);
    const [model2, setModel2] = useState(null);
    const modelGroupRef = useRef();
    const groupRef = useRef();
    const fixtureRef = useRef();
    const [nearFar, setNearFar] = useState({ near: 1, far: 2000000 });
    const [midPlane1, setMidPlane1] = useState(null);
    const [midPlane2, setMidPlane2] = useState(null);
    const [aligned, setAligned] = useState(null);
    const [points, setPoints] = useState(null);
    const [machineRotaryR, setMachineRotaryR] = useState(null);
    const [machineRotaryW, setMachineRotaryW] = useState(null);

    const handleApply = () => {
        if (midPlane1 && midPlane2) {
            const planeInstance1 = new THREE.Plane();
            planeInstance1.setFromNormalAndCoplanarPoint(
                midPlane1.normal,
                midPlane1.centroid,
            );
            const planeInstance2 = new THREE.Plane();
            planeInstance2.setFromNormalAndCoplanarPoint(
                midPlane2.normal,
                midPlane2.centroid,
            );
            const planeShape = ClipPlane.getIntersectionContour(
                model1,
                planeInstance1,
            );
            const point = ClipPlane.getContourPlaneIntersection(
                planeShape,
                planeInstance2,
            );
            if (point.length == 0) {
                const planeInstance1 = new THREE.Plane();
                planeInstance1.setFromNormalAndCoplanarPoint(
                    midPlane1.normal,
                    midPlane1.centroid,
                );
                const planeInstance2 = new THREE.Plane();
                planeInstance2.setFromNormalAndCoplanarPoint(
                    midPlane2.normal,
                    midPlane2.centroid,
                );
                const planeShape = ClipPlane.getIntersectionContour(
                    model2,
                    planeInstance2,
                );
                const point = ClipPlane.getContourPlaneIntersection(
                    planeShape,
                    planeInstance1,
                );
                setAligned(true);
                setPoints(point);
            } else {
                setAligned(true);
                setPoints(point);
            }
        }
    };

    useEffect(() => {
        if (!points || !aligned) return;
        const angleX = Utils.angleToEqualizeZ(points[0], points[1]);
        const deg = THREE.MathUtils.radToDeg(angleX);
        setMachineRotaryR(270 - deg);
        Utils.animateRotation(modelGroupRef.current, angleX, 'x', () => {
            const updatedPoints = [...points];
            updatedPoints[0].applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
            updatedPoints[1].applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
            setPoints(updatedPoints);
            setTimeout(() => {
                const angleZ = Utils.angleZToEqualizeX(points[0], points[1]);
                const deg = THREE.MathUtils.radToDeg(angleZ);
                setMachineRotaryW(90 - deg);
                Utils.animateRotation(groupRef.current, angleZ, 'z');
            }, 1000);
        });
    }, [aligned]);

    const handleFitToView = () => {
        const box = new THREE.Box3();
        // if (fixtureRef.current) box.expandByObject(fixtureRef.current);
        if (model1) box.expandByObject(model1);
        if (model2) box.expandByObject(model2);

        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const distance = Math.max(size.x, size.y, size.z) * 50;
        const from = center.clone().add(new THREE.Vector3(0, distance, 0));
        const to = center;

        if (cameraControlsRef.current) {
            cameraControlsRef.current.setLookAt(
                from.x, // Adjusted to match the offset used in the model
                from.y,
                from.z,
                to.x,
                to.y,
                to.z,
                true,
            );
            cameraControlsRef.current.saveState();
        }
    };

    const handleFileLoad = async (event, label) => {
        const file = event.target.files[0];
        if (file) {
            const blob = new Blob([file], { type: file.type });
            const url = URL.createObjectURL(blob);
            const model = await Utils.loadObjModel(url);

            if (label === 'Model 1') {
                model.geometry.rotateY(Math.PI);
                setModel1(model);
                const midPlane = FaceExtractor.extractMidPlane(model);
                setMidPlane1(midPlane);
            }

            if (label === 'Model 2') {
                model.geometry.rotateY(Math.PI);
                setModel2(model);
                const midPlane = FaceExtractor.extractMidPlane(model);
                setMidPlane2(midPlane);
            }

            const { far, near } = Utils.setCameraNearFarByObject(model);
            if (far && near) setNearFar({ far, near });
        }
    };

    // Camera fit logic
    const handleModelLoaded = (box) => {
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Distance based on largest dimension
        const distance = Math.max(size.x, size.y, size.z) * 2;

        // Move camera up on Y axis (you can switch to Z if you want "front" view)
        const from = center.clone().add(new THREE.Vector3(0, distance, 0));
        const to = center;

        requestAnimationFrame(() => {
            if (cameraControlsRef.current) {
                cameraControlsRef.current.setLookAt(
                    from.x,
                    from.y,
                    from.z,
                    to.x,
                    to.y,
                    to.z,
                    true,
                );
                cameraControlsRef.current.saveState();
            }
        });
    };

    // Auto-fit when either model loads
    useEffect(() => {
        if (!cameraControlsRef.current) return;
        if (model1 || model2 || fixtureRef.current) {
            const box = new THREE.Box3();
            if (fixtureRef.current) box.expandByObject(fixtureRef.current);
            if (model1) box.expandByObject(model1);
            if (model2) box.expandByObject(model2);
            handleFitToView();
        }
    }, [model1, model2]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <div
                style={{
                    position: 'absolute',
                    top: 20,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0 20px',
                }}>
                {/* Left side buttons */}
                <div>
                    <button onClick={handleApply} style={{ marginLeft: 10 }}>
                        Apply
                    </button>

                    {/* Load Model 1 */}
                    <button
                        style={{ marginLeft: 10 }}
                        onClick={() => inputRef1.current.click()}>
                        Load Model 1
                    </button>
                    <input
                        ref={inputRef1}
                        type="file"
                        accept=".obj"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileLoad(e, 'Model 1')}
                    />

                    {/* Load Model 2 */}
                    <button
                        style={{ marginLeft: 10 }}
                        onClick={() => inputRef2.current.click()}>
                        Load Model 2
                    </button>
                    <input
                        ref={inputRef2}
                        type="file"
                        accept=".obj"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileLoad(e, 'Model 2')}
                    />
                    <div style={{ marginTop: '10px', marginLeft: '10px' }}>
                        {' '}
                        {/* 👈 gap added here */}
                        <div>Rotation R: {machineRotaryR || '-'}</div>
                        <div>Rotation W: {machineRotaryW || '-'}</div>
                    </div>
                </div>

                {/* Right side button */}
                <div>
                    <button onClick={handleFitToView}>Top View</button>
                </div>
            </div>

            <Canvas
                orthographic
                camera={{
                    zoom: 0.1,
                    near: nearFar.near,
                    far: nearFar.far,
                    position: [0, 5000, 0], // start away from origin
                    left: -window.innerWidth / 2,
                    right: window.innerWidth / 2,
                    top: window.innerHeight / 2,
                    bottom: -window.innerHeight / 2,
                }}>
                <axesHelper args={[10000]} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 10, 10]} intensity={0.8} />
                <directionalLight position={[-10, 10, -10]} intensity={0.6} />
                <Environment preset="city" />
                {/* <Viewer3D cameraRef={cameraControlsRef} /> */}
                <CameraControls ref={cameraControlsRef} makeDefault />
                <group ref={groupRef}>
                    <group ref={modelGroupRef}>
                        {model1 && <LoadModel mesh={model1} />}
                        {model2 && <LoadModel mesh={model2} />}
                        <group ref={fixtureRef}>
                            <mesh position={[-6000, 0, 0]}>
                                <boxGeometry
                                    attach="geometry"
                                    args={[7000, 3000, 3000]}
                                />
                                <meshPhysicalMaterial
                                    transparent
                                    opacity={0.4}
                                    attach="material"
                                    color={0xff0000}
                                />
                            </mesh>
                            <mesh position={[-6000, 0, 1750]}>
                                <boxGeometry
                                    attach="geometry"
                                    args={[7000, 1000, 500]}
                                />
                                <meshPhysicalMaterial
                                    transparent
                                    opacity={0.4}
                                    attach="material"
                                    color={0x0000ff}
                                />
                            </mesh>
                        </group>
                    </group>
                </group>
            </Canvas>
        </div>
    );
}
