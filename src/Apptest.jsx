import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import LoadModel from './ModelLoader';
import { Utils } from './Utils';
import { CameraControls, Environment, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { FaceExtractor } from './FaceExtractor';
import { ClipPlane } from './ClipPlane';
import { DataProcesser } from './DataProcessor';

export default function AppTest() {
    // ✅ Fix here
    window.processData = DataProcesser.processOBJ;
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
    const [blade1LocalYPoints, setBlade1LocalYPoints] = useState(null);
    const [blade2LocalYPoints, setBlade2LocalYPoints] = useState(null);
    const [pointsLocal, setPointsLocal] = useState(null);
    const [blade1Data, setBlade1Data] = useState(null);
    const [blade2Data, setBlade2Data] = useState(null);
    // const [blade1Angle, setBlade1Angle] = useState(null);
    // const [blade2Angle, setBlade2Angle] = useState(null);
    const [bladeIntersection1, setBladeIntersection1] = useState(null);
    const [bladeIntersection2, setBladeIntersection2] = useState(null);
    const [bladeContour, setBladeContour] = useState(null);
    const [contour1, setContour1] = useState(null);
    const [cameraDistanceData, setCameraDistanceData] = useState(null);
    const [threePlane1, setThreePlane1] = useState(null);
    const [threePlane2, setThreePlane2] = useState(null);
    const [cameraDistanceDataLocal, setCameraDistanceDataLocal] =
        useState(null);

    const handleApply = () => {
        if (!midPlane1 || !midPlane2) return;

        const planeInstance1 = new THREE.Plane().setFromNormalAndCoplanarPoint(
            midPlane1.normal,
            midPlane1.centroid,
        );
        const planeInstance2 = new THREE.Plane().setFromNormalAndCoplanarPoint(
            midPlane2.normal,
            midPlane2.centroid,
        );

        // Try intersection with model1 first
        let planeShape = ClipPlane.getIntersectionContour(
            model1,
            planeInstance1,
        );
        let point = ClipPlane.getContourPlaneIntersection(
            planeShape,
            planeInstance2,
            planeInstance1,
        );

        // Fallback if no intersection
        if (point.length === 0) {
            planeShape = ClipPlane.getIntersectionContour(
                model2,
                planeInstance2,
            );
            point = ClipPlane.getContourPlaneIntersection(
                planeShape,
                planeInstance1,
                planeInstance2,
            );
        }

        // Always clone to local before setting state
        const copy = point.map((v) => v.clone());

        setAligned(true);
        setPoints(point);
        setPointsLocal(copy);
        setBladeIntersection2(point);
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
                const { highest, lowest, localHighest, localLowest } =
                    Utils.getMeshHighestLowest(model1);
                const {
                    highest: highest2,
                    lowest: lowest2,
                    localHighest: localHighest2,
                    localLowest: localLowest2,
                } = Utils.getMeshHighestLowest(model2);
                const blade1FarPoint = Utils.getFarthestPointsFromLine(
                    model1,
                    points,
                    midPlane1,
                );
                const blade2FarPoint = Utils.getFarthestPointsFromLine(
                    model2,
                    points,
                    midPlane2,
                );
                console.log(blade1FarPoint, blade2FarPoint);
                setBlade1Data(blade1FarPoint);
                setBlade2Data(blade2FarPoint);
                setBlade1YPoints([highest, lowest]);
                setBlade2YPoints([highest2, lowest2]);
                setBlade1LocalYPoints([localHighest, localLowest]);
                setBlade2LocalYPoints([localHighest2, localLowest2]);
                // const blade1Angle = Utils.computeBladeAngleAndDistance(
                //     points,
                //     blade1FarPoint.point,
                // );
                // const blade2Angle = Utils.computeBladeAngleAndDistance(
                //     points,
                //     blade2FarPoint.point,
                // );
                // setBlade1Angle(blade1Angle);
                // setBlade2Angle(blade2Angle);
                const data = FaceExtractor.getCameraData(
                    points,
                    highest,
                    highest2,
                );
                const dataLocal = FaceExtractor.getCameraDataLocal(
                    points,
                    pointsLocal,
                    localHighest,
                    localHighest2,
                );
                setCameraDistanceData(data);
                setCameraDistanceDataLocal(dataLocal);
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
                    fontFamily: 'Arial, sans-serif',
                }}>
                {/* Left side panel */}
                <div>
                    <div style={{ marginBottom: '10px' }}>
                        <button
                            onClick={handleApply}
                            style={{
                                marginRight: 10,
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                background: '#4cafef',
                                color: 'white',
                            }}>
                            Apply
                        </button>

                        <button
                            style={{
                                marginRight: 10,
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                background: '#3b82f6',
                                color: 'white',
                            }}
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

                        <button
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                cursor: 'pointer',
                                background: '#3b82f6',
                                color: 'white',
                            }}
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
                    </div>
                    <div style={{ marginBottom: '10px', display: 'flex' }}>
                        {/* Data panel */}
                        <div
                            style={{
                                marginTop: '10px',
                                marginLeft: '10px',
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'rgba(0,0,0,0.6)',
                                lineHeight: '1.6',
                            }}>
                            <div>Without Rotation</div>
                            <div>
                                <strong>Rotation R:</strong>{' '}
                                {machineRotaryR || '-'}
                            </div>
                            <div>
                                <strong>Rotation W:</strong>{' '}
                                {machineRotaryW || '-'}
                            </div>

                            {blade1YPoints && (
                                <>
                                    <div>
                                        <strong>Blade 1 Top Most Point:</strong>{' '}
                                        <Vec3Display vec={blade1YPoints[0]} />
                                    </div>
                                    <div>
                                        <strong>
                                            Blade 1 Bottom Most Point:
                                        </strong>{' '}
                                        <Vec3Display vec={blade1YPoints[1]} />
                                    </div>
                                </>
                            )}

                            {blade2YPoints && (
                                <>
                                    <div>
                                        <strong>Blade 2 Top Most Point:</strong>{' '}
                                        <Vec3Display vec={blade2YPoints[0]} />
                                    </div>
                                    <div>
                                        <strong>
                                            Blade 2 Bottom Most Point:
                                        </strong>{' '}
                                        <Vec3Display vec={blade2YPoints[1]} />
                                    </div>
                                </>
                            )}

                            {points && (
                                <>
                                    <div>
                                        <strong>Intersection Top Point:</strong>{' '}
                                        <Vec3Display vec={points[0]} />
                                    </div>
                                    <div>
                                        <strong>
                                            Intersection Bottom Point:
                                        </strong>{' '}
                                        <Vec3Display vec={points[1]} />
                                    </div>
                                </>
                            )}

                            {blade1Data && (
                                <div style={{ marginTop: '8px' }}>
                                    <strong>Blade 1 Farthest Distance:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade1Data.distance.toFixed(2)}
                                    </span>
                                    <br />
                                    <strong>
                                        Blade 1 Farthest Point 1:
                                    </strong>{' '}
                                    <Vec3Display vec={blade1Data.farPoint1} />
                                    <br />
                                    {blade1Data.farPoint2 && (
                                        <>
                                            <strong>
                                                Blade 1 Farthest Point 2:
                                            </strong>
                                            <Vec3Display
                                                vec={blade1Data.farPoint2}
                                            />
                                            <br />
                                        </>
                                    )}
                                    <strong>Blade 1 Angle:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade1Data.angle.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {blade2Data && (
                                <div style={{ marginTop: '8px' }}>
                                    <strong>Blade 2 Farthest Distance:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade2Data.distance.toFixed(2)}
                                    </span>
                                    <br />
                                    <strong>
                                        Blade 2 Farthest Point 1:
                                    </strong>{' '}
                                    <Vec3Display vec={blade2Data.farPoint1} />
                                    <br />
                                    {blade2Data.farPoint2 && (
                                        <>
                                            <strong>
                                                Blade 1 Farthest Point 2:
                                            </strong>
                                            <Vec3Display
                                                vec={blade2Data.farPoint2}
                                            />
                                            <br />
                                        </>
                                    )}
                                    <strong>Blade 2 Angle:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade2Data.angle.toFixed(2)}
                                    </span>
                                    <br />
                                    <strong>
                                        Camera Intersection Distance:
                                    </strong>
                                    {cameraDistanceData && (
                                        <>
                                            <span
                                                style={{
                                                    color: '#f87171',
                                                    fontWeight: 'bold',
                                                }}>
                                                {cameraDistanceData.cameraDistanceIntersection.toFixed(
                                                    2,
                                                )}
                                            </span>
                                            <br />
                                            <strong>
                                                Camera Distance TopPoint:
                                            </strong>
                                            <span
                                                style={{
                                                    color: '#f87171',
                                                    fontWeight: 'bold',
                                                }}>
                                                {cameraDistanceData.cameraDistanceToTopPoint.toFixed(
                                                    2,
                                                )}
                                            </span>
                                            <br />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        {/* Data panel */}
                        <div
                            style={{
                                marginTop: '10px',
                                marginLeft: '10px',
                                padding: '12px',
                                borderRadius: '10px',
                                background: 'rgba(0,0,0,0.6)',
                                lineHeight: '1.6',
                            }}>
                            <div>Without Rotation</div>
                            <div>
                                <strong>Rotation R:</strong>{' '}
                                {machineRotaryR || '-'}
                            </div>
                            <div>
                                <strong>Rotation W:</strong>{' '}
                                {machineRotaryW || '-'}
                            </div>

                            {blade1LocalYPoints && (
                                <>
                                    <div>
                                        <strong>Blade 1 Top Most Point:</strong>{' '}
                                        <Vec3Display
                                            vec={blade1LocalYPoints[0]}
                                        />
                                    </div>
                                    <div>
                                        <strong>
                                            Blade 1 Bottom Most Point:
                                        </strong>{' '}
                                        <Vec3Display
                                            vec={blade1LocalYPoints[1]}
                                        />
                                    </div>
                                </>
                            )}

                            {blade2LocalYPoints && (
                                <>
                                    <div>
                                        <strong>Blade 2 Top Most Point:</strong>{' '}
                                        <Vec3Display
                                            vec={blade2LocalYPoints[0]}
                                        />
                                    </div>
                                    <div>
                                        <strong>
                                            Blade 2 Bottom Most Point:
                                        </strong>{' '}
                                        <Vec3Display
                                            vec={blade2LocalYPoints[1]}
                                        />
                                    </div>
                                </>
                            )}

                            {pointsLocal && (
                                <>
                                    <div>
                                        <strong>Intersection Top Point:</strong>{' '}
                                        <Vec3Display vec={pointsLocal[0]} />
                                    </div>
                                    <div>
                                        <strong>
                                            Intersection Bottom Point:
                                        </strong>{' '}
                                        <Vec3Display vec={pointsLocal[1]} />
                                    </div>
                                </>
                            )}

                            {blade1Data && (
                                <div style={{ marginTop: '8px' }}>
                                    <strong>Blade 1 Farthest Distance:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade1Data.distance.toFixed(2)}
                                    </span>
                                    <br />
                                    <strong>
                                        Blade 1 Farthest Point 1:
                                    </strong>{' '}
                                    <Vec3Display vec={blade1Data.localPoint1} />
                                    <br />
                                    {blade1Data.localPoint2 && (
                                        <>
                                            <strong>
                                                Blade 1 Farthest Point 2:
                                            </strong>
                                            <Vec3Display
                                                vec={blade1Data.localPoint2}
                                            />
                                            <br />
                                        </>
                                    )}
                                    <strong>Blade 1 Angle:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade1Data.angle.toFixed(2)}
                                    </span>
                                </div>
                            )}

                            {blade2Data && (
                                <div style={{ marginTop: '8px' }}>
                                    <strong>Blade 2 Farthest Distance:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade2Data.distance.toFixed(2)}
                                    </span>
                                    <br />
                                    <strong>
                                        Blade 2 Farthest Point 1:
                                    </strong>{' '}
                                    <Vec3Display vec={blade2Data.localPoint1} />
                                    <br />
                                    {blade2Data.localPoint2 && (
                                        <>
                                            <strong>
                                                Blade 1 Farthest Point 2:
                                            </strong>
                                            <Vec3Display
                                                vec={blade2Data.localPoint2}
                                            />
                                            <br />
                                        </>
                                    )}
                                    <strong>Blade 2 Angle:</strong>{' '}
                                    <span
                                        style={{
                                            color: '#f87171',
                                            fontWeight: 'bold',
                                        }}>
                                        {blade2Data.angle.toFixed(2)}
                                    </span>
                                    <br />
                                    <strong>
                                        Camera Intersection Distance:
                                    </strong>
                                    {cameraDistanceData && (
                                        <>
                                            <span
                                                style={{
                                                    color: '#f87171',
                                                    fontWeight: 'bold',
                                                }}>
                                                {cameraDistanceDataLocal.cameraDistanceIntersection.toFixed(
                                                    2,
                                                )}
                                            </span>
                                            <br />
                                            <strong>
                                                Camera Distance TopPoint:
                                            </strong>
                                            <span
                                                style={{
                                                    color: '#f87171',
                                                    fontWeight: 'bold',
                                                }}>
                                                {cameraDistanceDataLocal.cameraDistanceToTopPoint.toFixed(
                                                    2,
                                                )}
                                            </span>
                                            <br />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right side buttons */}
                <div>
                    <button
                        onClick={handleFitToView}
                        style={{
                            marginRight: 10,
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: '#10b981',
                            color: 'white',
                        }}>
                        Top View
                    </button>
                    <button
                        onClick={handleFrontView}
                        style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            background: '#10b981',
                            color: 'white',
                        }}>
                        Front View
                    </button>
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
                {blade1Data && (
                    <>
                        <Sphere position={blade1Data.farPoint1} args={[50]}>
                            <meshBasicMaterial color={0x00ffee} />
                        </Sphere>
                    </>
                )}
                {blade1Data && blade1Data.farPoint2 && (
                    <>
                        <Sphere position={blade1Data.farPoint2} args={[50]}>
                            <meshBasicMaterial color={0x00ffee} />
                        </Sphere>
                    </>
                )}
                {blade2Data && (
                    <>
                        <Sphere position={blade2Data.farPoint1} args={[50]}>
                            <meshBasicMaterial color={0x00ffee} />
                        </Sphere>
                    </>
                )}
                {blade2Data && blade2Data.farPoint2 && (
                    <>
                        <Sphere position={blade2Data.farPoint2} args={[50]}>
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
            <span style={{ color: 'yellow' }}>{vec.z.toFixed(2)}</span>)
        </>
    );
};
