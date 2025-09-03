import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class FaceExtractor {
    /**
     * Extract planar face regions from a mesh
     * @param {THREE.Mesh} mesh - The mesh to extract faces from
     * @param {number} epsilon - Tolerance for planarity check
     * @returns {Array<Array<number>>} - Array of face groups (each group is a list of face indices)
     */
    static extractCoplanarGroups(mesh, epsilon = 1e-4) {
        let geometry = mesh.geometry.clone();
        geometry = mergeVertices(geometry);
        mesh.geometry = geometry;
        geometry.computeVertexNormals();

        const posAttr = geometry.attributes.position;
        const indexAttr = geometry.index.array;

        const triangleCount = indexAttr.length / 3;

        // Precompute triangle data (verts + normal + area)
        const triangles = [];
        const triNormals = [];
        const triAreas = [];

        for (let i = 0; i < triangleCount; i++) {
            const a = indexAttr[i * 3];
            const b = indexAttr[i * 3 + 1];
            const c = indexAttr[i * 3 + 2];

            const vA = new THREE.Vector3().fromBufferAttribute(posAttr, a);
            const vB = new THREE.Vector3().fromBufferAttribute(posAttr, b);
            const vC = new THREE.Vector3().fromBufferAttribute(posAttr, c);

            const ab = new THREE.Vector3().subVectors(vB, vA);
            const ac = new THREE.Vector3().subVectors(vC, vA);

            const normal = new THREE.Vector3().crossVectors(ab, ac).normalize();
            const area = 0.5 * ab.cross(ac).length(); // triangle area

            triangles.push([a, b, c]);
            triNormals.push(normal);
            triAreas.push(area);
        }

        // Build adjacency (triangle -> neighbors)
        const vertexToTriangles = new Map();
        for (let i = 0; i < triangleCount; i++) {
            for (const v of triangles[i]) {
                if (!vertexToTriangles.has(v)) vertexToTriangles.set(v, []);
                vertexToTriangles.get(v).push(i);
            }
        }

        const neighbors = new Map();
        for (let i = 0; i < triangleCount; i++) {
            neighbors.set(i, new Set());
            for (const v of triangles[i]) {
                for (const nb of vertexToTriangles.get(v)) {
                    if (nb !== i) neighbors.get(i).add(nb);
                }
            }
        }

        // BFS for coplanar groups
        const visited = new Array(triangleCount).fill(false);
        const groups = [];

        for (let i = 0; i < triangleCount; i++) {
            if (visited[i]) continue;

            const group = { faces: [], area: 0 };
            const queue = [i];

            while (queue.length > 0) {
                const cur = queue.pop();
                if (visited[cur]) continue;
                visited[cur] = true;

                group.faces.push(cur);
                group.area += triAreas[cur];

                for (const nb of neighbors.get(cur)) {
                    if (!visited[nb]) {
                        // Check if coplanar
                        if (triNormals[cur].dot(triNormals[nb]) > 1 - epsilon) {
                            const vA = new THREE.Vector3().fromBufferAttribute(
                                posAttr,
                                triangles[cur][0],
                            );
                            const vN = triNormals[cur];
                            const vB = new THREE.Vector3().fromBufferAttribute(
                                posAttr,
                                triangles[nb][0],
                            );
                            const dist = Math.abs(vN.dot(vB.clone().sub(vA)));
                            if (dist < epsilon) {
                                queue.push(nb);
                            }
                        }
                    }
                }
            }
            groups.push(group);
        }
        return groups;
    }

    /**
     * Extract N largest planar face groups
     * @param {THREE.Mesh} mesh
     * @param {number} n - number of largest groups to return
     * @returns {Array<Array<number>>}
     */
    static extractLargestFaces(mesh, n = 2) {
        return this.extractCoplanarGroups(mesh)
            .sort((a, b) => b.area - a.area)
            .slice(0, n);
    }
    static buildGeometryFromFace(mesh, faceGroup) {
        const geometry = mesh.geometry;
        const posAttr = geometry.attributes.position;
        const indices = geometry.index.array;

        const vertices = [];
        const newIndices = [];
        const vertMap = new Map();
        let counter = 0;

        for (const f of faceGroup) {
            const a = indices[f * 3],
                b = indices[f * 3 + 1],
                c = indices[f * 3 + 2];

            for (const v of [a, b, c]) {
                if (!vertMap.has(v)) {
                    vertices.push(
                        posAttr.getX(v),
                        posAttr.getY(v),
                        posAttr.getZ(v),
                    );
                    vertMap.set(v, counter++);
                }
                newIndices.push(vertMap.get(v));
            }
        }

        const geom = new THREE.BufferGeometry();
        geom.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3),
        );
        geom.setIndex(newIndices);
        geom.computeVertexNormals();

        return geom;
    }

    /**
     * Computes the midplane from the two largest faces
     * @param {THREE.Mesh} mesh
     * @returns {Object} { normal: THREE.Vector3, centroid: THREE.Vector3 } or null
     */
    static extractMidPlane(mesh) {
        const faces = this.extractLargestFaces(mesh, 2);
        if (faces.length < 2) return null;

        // Compute the two planes from the two largest faces
        const planeA = this.computePlaneFromFace(mesh, faces[0].faces);
        const planeB = this.computePlaneFromFace(mesh, faces[1].faces);
        if (!planeA || !planeB) return null;

        // Compute the midplane between the two planes
        const planeInstanceA = new THREE.Plane().setFromNormalAndCoplanarPoint(
            planeA.normal,
            planeA.centroid,
        );
        const distance = planeInstanceA.distanceToPoint(
            planeB.centroid.clone(),
        );
        const newPoint = planeA.centroid
            .clone()
            .addScaledVector(
                planeA.normal.clone().negate(),
                Math.abs(distance) / 2,
            );

        return {
            normal: planeA.normal,
            centroid: newPoint,
        };
    }
    static computePlaneFromFace(mesh, faceGroup) {
        const geometry = mesh.geometry;
        const posAttr = geometry.attributes.position;
        const indexAttr = geometry.index ? geometry.index.array : null;

        if (!posAttr || faceGroup.length === 0) return null;

        // Collect all vertex indices from the face group
        const vertexIndices = [];
        for (const f of faceGroup) {
            const a = indexAttr ? indexAttr[f * 3] : f * 3;
            const b = indexAttr ? indexAttr[f * 3 + 1] : f * 3 + 1;
            const c = indexAttr ? indexAttr[f * 3 + 2] : f * 3 + 2;
            vertexIndices.push(a, b, c);
        }

        // --- Compute normal from first non-degenerate triangle ---
        let normal = new THREE.Vector3();
        let centroid = new THREE.Vector3();
        for (let i = 0; i < vertexIndices.length - 2; i += 3) {
            const v0 = new THREE.Vector3().fromBufferAttribute(
                posAttr,
                vertexIndices[i],
            );
            const v1 = new THREE.Vector3().fromBufferAttribute(
                posAttr,
                vertexIndices[i + 1],
            );
            const v2 = new THREE.Vector3().fromBufferAttribute(
                posAttr,
                vertexIndices[i + 2],
            );

            const n = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(v1, v0),
                new THREE.Vector3().subVectors(v2, v0),
            );
            centroid = v0;

            if (n.lengthSq() > 1e-10) {
                normal.copy(n.normalize());
                break;
            }
        }

        return { normal, centroid };
    }
    static getCameraData(intersectionPoint, blade1TopPoint, blade2TopPoint) {
        let cameraPosition = null;
        let cameraDistanceIntersection = null;
        let cameraDistanceToTopPoint = null;
        if (intersectionPoint[0].y > intersectionPoint[1].y) {
            const directionIntersection = intersectionPoint[1]
                .clone()
                .sub(intersectionPoint[0].clone());
            cameraPosition = new THREE.Vector3()
                .copy(intersectionPoint[0].clone())
                .add(
                    new THREE.Vector3()
                        .copy(directionIntersection.clone().normalize())
                        .multiplyScalar(5000),
                );
            cameraDistanceIntersection = cameraPosition.distanceTo(
                intersectionPoint[0],
            );
        } else {
            const directionIntersection = intersectionPoint[0]
                .clone()
                .sub(intersectionPoint[1].clone());
            cameraPosition = new THREE.Vector3()
                .copy(intersectionPoint[1].clone())
                .add(
                    new THREE.Vector3()
                        .copy(directionIntersection.clone().normalize())
                        .multiplyScalar(5000),
                );
            cameraDistanceIntersection = cameraPosition.distanceTo(
                intersectionPoint[1],
            );
        }
        const distanceBlade1 = cameraPosition.distanceTo(blade1TopPoint);
        const distanceBlade2 = cameraPosition.distanceTo(blade2TopPoint);
        cameraDistanceToTopPoint = Math.min(distanceBlade1, distanceBlade2);
        return {
            cameraDistanceIntersection,
            cameraDistanceToTopPoint,
        };
    }
    static getCameraDataLocal(
        intersectionPoint,
        intersectionPointLocal,
        blade1TopPoint,
        blade2TopPoint,
    ) {
        let cameraPosition = null;
        let cameraDistanceIntersection = null;
        let cameraDistanceToTopPoint = null;
        if (intersectionPoint[0].y > intersectionPoint[1].y) {
            const directionIntersection = intersectionPoint[1]
                .clone()
                .sub(intersectionPoint[0].clone());
            cameraPosition = new THREE.Vector3()
                .copy(intersectionPoint[0].clone())
                .add(
                    new THREE.Vector3()
                        .copy(directionIntersection.clone().normalize())
                        .multiplyScalar(5000),
                );
            cameraDistanceIntersection = cameraPosition.distanceTo(
                intersectionPointLocal[0],
            );
        } else {
            const directionIntersection = intersectionPoint[0]
                .clone()
                .sub(intersectionPoint[1].clone());
            cameraPosition = new THREE.Vector3()
                .copy(intersectionPoint[1].clone())
                .add(
                    new THREE.Vector3()
                        .copy(directionIntersection.clone().normalize())
                        .multiplyScalar(5000),
                );
            cameraDistanceIntersection = cameraPosition.distanceTo(
                intersectionPointLocal[1],
            );
        }
        const distanceBlade1 = cameraPosition.distanceTo(blade1TopPoint);
        const distanceBlade2 = cameraPosition.distanceTo(blade2TopPoint);
        cameraDistanceToTopPoint = Math.min(distanceBlade1, distanceBlade2);
        return {
            cameraDistanceIntersection,
            cameraDistanceToTopPoint,
        };
    }
}
