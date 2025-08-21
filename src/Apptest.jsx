import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import LoadModel from './ModelLoader';
import { Utils } from './Utils';
import { CameraControls, Environment, Sphere } from '@react-three/drei';
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
    const [blade1YPoints, setBlade1YPoints] = useState(null);
    const [blade2YPoints, setBlade2YPoints] = useState(null);
    const [blade1Far, setBlade1Far] = useState(null);
    const [blade2Far, setBlade2Far] = useState(null);

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
        Utils.animateRotation(modelGroupRef.current, angleX, 'x').then(() => {
            const updatedPoints = [...points];
            updatedPoints[0].applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
            updatedPoints[1].applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
            setPoints(updatedPoints);
            const angleZ = Utils.angleZToEqualizeX(points[0], points[1]);
            const deg = THREE.MathUtils.radToDeg(angleZ);
            setMachineRotaryW(90 - deg);
            Utils.animateRotation(groupRef.current, angleZ, 'z').then(() => {
                const updatedPoints = [...points];
                updatedPoints[0].applyAxisAngle(
                    new THREE.Vector3(0, 0, 1),
                    angleZ,
                );
                updatedPoints[1].applyAxisAngle(
                    new THREE.Vector3(0, 0, 1),
                    angleZ,
                );
                setPoints(updatedPoints);
                const { highest, lowest } = Utils.getMeshHighestLowest(model1);
                const { highest: highest2, lowest: lowest2 } =
                    Utils.getMeshHighestLowest(model2);
                const line = new THREE.Line3(points[0], points[1]);
                const blade1FarPoint = Utils.getFarthestPointFromLine(
                    model1,
                    line,
                );
                console.log(blade1FarPoint.point);
                const blade2FarPoint = Utils.getFarthestPointFromLine(
                    model2,
                    line,
                );
                setBlade1Far(blade1FarPoint);
                setBlade2Far(blade2FarPoint);
                setBlade1YPoints([highest, lowest]);
                setBlade2YPoints([highest2, lowest2]);
            });
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
    const handleFrontView = () => {
        const box = new THREE.Box3();
        if (model1) box.expandByObject(model1);
        if (model2) box.expandByObject(model2);

        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const distance = Math.max(size.x, size.y, size.z) * 50;
        const from = center.clone().add(new THREE.Vector3(0, 0, distance));
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
            const mesh = await Utils.loadObjModel(url);

            if (label === 'Model 1') {
                mesh.geometry.rotateY(Math.PI);
                setModel1(mesh);
                const midPlane = FaceExtractor.extractMidPlane(mesh);
                setMidPlane1(midPlane);
            }

            if (label === 'Model 2') {
                mesh.geometry.rotateY(Math.PI);
                setModel2(mesh);
                const midPlane = FaceExtractor.extractMidPlane(mesh);
                setMidPlane2(midPlane);
            }

            const { far, near } = Utils.setCameraNearFarByObject(mesh);
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
                        {blade1YPoints && (
                            <>
                                <div>
                                    Blade1 Top Most Point:{' '}
                                    <Vec3Display vec={blade1YPoints[0]} />
                                </div>
                                <div>
                                    Blade1 Bottom Most Point:{' '}
                                    <Vec3Display vec={blade1YPoints[1]} />
                                </div>
                            </>
                        )}
                        {blade2YPoints && (
                            <>
                                <div>
                                    Blade2 Top Most Point:{' '}
                                    <Vec3Display vec={blade2YPoints[0]} />
                                </div>
                                <div>
                                    Blade2 Bottom Most Point:{' '}
                                    <Vec3Display vec={blade2YPoints[1]} />
                                </div>
                            </>
                        )}
                        {points && (
                            <>
                                <div>
                                    Intersection Top Point:{' '}
                                    <Vec3Display vec={points[0]} />
                                </div>
                                <div>
                                    Intersection Bottom Point:{' '}
                                    <Vec3Display vec={points[1]} />
                                </div>
                            </>
                        )}
                        {blade1Far && (
                            <>
                                <div>
                                    Blade 1 Farthest Point:{' '}
                                    <Vec3Display vec={blade1Far.point} />
                                </div>
                            </>
                        )}
                        {blade2Far && (
                            <>
                                <div>
                                    Blade 2 Farthest Point:{' '}
                                    <Vec3Display vec={blade2Far.point} />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right side button */}
                <div>
                    <button onClick={handleFitToView}>Top View</button>
                    <button onClick={handleFrontView}>Front View</button>
                </div>
            </div>

            <Canvas
                orthographic
                camera={{
                    zoom: 0.1,
                    near: nearFar.near,
                    far: nearFar.far,
                    position: [0, 5000, 0],
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
                <CameraControls ref={cameraControlsRef} makeDefault />
                {/* <Sphere
                    position={[
                        -40186.6160905447, 22408.3814400409, 43362.1746671311,
                    ]}
                    args={[100]}>
                    <meshBasicMaterial color={0xff0000} />
                </Sphere> */}
                {blade1YPoints && (
                    <>
                        <Sphere position={blade1YPoints[0]} args={[50]}>
                            <meshBasicMaterial color={0xff0000} />
                        </Sphere>
                        <Sphere position={blade1YPoints[1]} args={[50]}>
                            <meshBasicMaterial color={0xff0000} />
                        </Sphere>
                    </>
                )}
                {blade2YPoints && (
                    <>
                        <Sphere position={blade2YPoints[0]} args={[50]}>
                            <meshBasicMaterial color={0xffff00} />
                        </Sphere>
                        <Sphere position={blade2YPoints[1]} args={[50]}>
                            <meshBasicMaterial color={0xffff00} />
                        </Sphere>
                    </>
                )}
                {blade1Far && (
                    <>
                        <Sphere position={blade1Far.point} args={[50]}>
                            <meshBasicMaterial color={0x00ffee} />
                        </Sphere>
                    </>
                )}
                {blade2Far && (
                    <>
                        <Sphere position={blade2Far.point} args={[50]}>
                            <meshBasicMaterial color={0x00ffee} />
                        </Sphere>
                    </>
                )}
                <group ref={groupRef}>
                    <group ref={modelGroupRef}>
                        {model1 && <LoadModel mesh={model1} color={0x00ff00} />}
                        {model2 && <LoadModel mesh={model2} color={0x000ff0} />}
                        <group>
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

const Vec3Display = ({ vec }) => {
    if (!vec) return '-';
    return (
        <>
            (<span style={{ color: 'red' }}>{vec.x.toFixed(2)}</span>,{' '}
            <span style={{ color: 'green' }}>{vec.y.toFixed(2)}</span>,{' '}
            <span style={{ color: 'blue' }}>{vec.z.toFixed(2)}</span>)
        </>
    );
};
