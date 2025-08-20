import * as THREE from 'three';
const LoadModel = ({ mesh }) => {
    return mesh ? <primitive object={mesh} dispose={null} /> : null;
};

export default LoadModel;
