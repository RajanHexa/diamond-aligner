import gsap from 'gsap';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

import * as THREE from 'three';

export class Utils {
    static angleToEqualize(p1, p2, axis) {
        let dx, dy;

        switch (axis) {
            case 'x': // Rotate around X-axis → use YZ plane
                dx = p1.y - p2.y; // horizontal in YZ view
                dy = p2.z - p1.z; // vertical in YZ view
                break;

            case 'y': // Rotate around Y-axis → use XZ plane
                dx = p1.x - p2.x; // horizontal in XZ view
                dy = p2.z - p1.z; // vertical in XZ view
                break;

            case 'z': // Rotate around Z-axis → use XY plane
                dx = p1.y - p2.y; // vertical in XY view
                dy = p1.x - p2.x; // horizontal in XY view
                break;

            default:
                throw new Error("Axis must be 'x', 'y', or 'z'");
        }

        return Math.atan2(dy, dx); // radians
    }
    static animateRotation(object, angle, axis) {
        const obj = {};
        if (axis === 'x') {
            obj.x = angle;
        } else if (axis === 'y') {
            obj.y = angle;
        } else if (axis === 'z') {
            obj.z = angle;
        }

        return new Promise((resolve) => {
            gsap.to(object.rotation, {
                ...obj,
                duration: 1,
                ease: 'power2.inOut',
                onComplete: resolve, // resolve promise when done
            });
        });
    }
    static angleToEqualizeZ(p1, p2) {
        // p1 and p2 are THREE.Vector3
        const y1 = p1.y,
            z1 = p1.z;
        const y2 = p2.y,
            z2 = p2.z;
        return Math.atan2(z2 - z1, y1 - y2); // radians
    }
    static angleZToEqualizeX(p1, p2) {
        // p1 and p2 are THREE.Vector3
        const x1 = p1.x,
            y1 = p1.y;
        const x2 = p2.x,
            y2 = p2.y;
        return Math.atan2(x1 - x2, y1 - y2); // radians
    }
    static getPlanesIntersectionLine(plane1, plane2) {
        // Direction of the intersection line
        const direction = new THREE.Vector3().crossVectors(
            plane1.normal,
            plane2.normal,
        );

        if (direction.lengthSq() === 0) {
            // Parallel or coincident planes
            return null;
        }

        const n1 = plane1.normal;
        const n2 = plane2.normal;
        const c1 = -plane1.constant;
        const c2 = -plane2.constant;

        const n1xn2 = new THREE.Vector3().crossVectors(n1, n2);
        const temp1 = new THREE.Vector3()
            .crossVectors(n1xn2, n2)
            .multiplyScalar(c1);
        const temp2 = new THREE.Vector3()
            .crossVectors(n1, n1xn2)
            .multiplyScalar(c2);

        const pointOnLine = new THREE.Vector3()
            .addVectors(temp1, temp2)
            .divideScalar(n1xn2.lengthSq());

        return { point: pointOnLine, direction: direction.normalize() };
    }
    static getMeshIntersectionWithLine(mesh, linePoint, lineDir) {
        const raycaster = new THREE.Raycaster();
        raycaster.ray.origin.copy(linePoint);
        raycaster.ray.direction.copy(lineDir).normalize();
        const intersections = raycaster.intersectObject(mesh, true);
        console.log(intersections);
        return intersections.length > 0 ? intersections : null;
    }
    static async loadObjModel(url) {
        const loader = new OBJLoader();

        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (object) => {
                    if (
                        object.children.length === 1 &&
                        object.children[0].isMesh
                    ) {
                        resolve(object.children[0]);
                    } else {
                        resolve(object); // keep group if multiple meshes
                    }
                }, // onLoad
                undefined, // onProgress (optional)
                (error) => reject(error), // onError
            );
        });
    }
    static setCameraNearFarByObject(object) {
        const box = new THREE.Box3();
        box.setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const max = Math.max(size.x, size.y, size.z);
        if (box.isEmpty()) return null;
        if (max === Infinity) return null;
        const near = max / 1000;
        const far = max * 100;
        return { far, near };
    }
    static getMeshHighestLowest(mesh) {
        mesh.updateWorldMatrix(true, false);

        // clone geometry and apply world transform
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);

        // Ensure geometry is non-indexed for easy access
        const geo = geometry.index ? geometry.toNonIndexed() : geometry;

        const posAttr = geo.attributes.position;
        const highest = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        const lowest = new THREE.Vector3(Infinity, Infinity, Infinity);

        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);

            if (v.y > highest.y) {
                highest.copy(v);
            }
            if (v.y < lowest.y) {
                lowest.copy(v);
            }
        }

        return { highest, lowest };
    }
    /**
     * Finds the farthest vertex of a mesh from a given line
     * @param {THREE.Mesh} mesh - The mesh
     * @param {THREE.Line3} line - The line (start + end)
     * @returns {{point: THREE.Vector3, distance: number}}
     */
    static getFarthestPointFromLine(mesh, line) {
        mesh.updateWorldMatrix(true, false);

        // clone geometry and apply world transform
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);

        const posAttr = geometry.attributes.position;

        let farthestPoint = new THREE.Vector3();
        let maxDist = -Infinity;

        const v = new THREE.Vector3();
        const closest = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            v.fromBufferAttribute(posAttr, i);

            // Get closest point on line to this vertex
            line.closestPointToPoint(v, false, closest);

            // Distance between vertex and line
            const dist = v.distanceTo(closest);

            if (dist > maxDist) {
                maxDist = dist;
                farthestPoint.copy(v);
            }
        }

        return { point: farthestPoint, distance: maxDist };
    }
}
