import { CameraControls } from '@react-three/drei';
import React from 'react';
import * as THREE from 'three';

const Viewer3D = ({ cameraControlsRef }) => {
    const boxRef = React.useRef(null);
    return (
        <>
            <mesh position={[0, 0, 0]}>
                <boxGeometry
                    attach="geometry"
                    args={[10, 10, 10]}
                    ref={boxRef}
                />
                <meshBasicMaterial attach="material" color="white" />
            </mesh>
        </>
    );
};

export default Viewer3D;
