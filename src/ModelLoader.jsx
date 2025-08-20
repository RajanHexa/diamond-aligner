import * as THREE from 'three';
const LoadModel = ({ mesh, color }) => {
    mesh.material.color.set(color);
    return mesh ? <primitive object={mesh} dispose={null} /> : null;
};

export default LoadModel;
