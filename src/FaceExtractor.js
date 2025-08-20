import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class FaceExtractor {
    /**
     * Extract planar face regions from a mesh
     * @param {THREE.Mesh} mesh - The mesh to extract faces from
     * @param {number} epsilon - Tolerance for planarity check
     * @returns {Array<Array<number>>} - Array of face groups (each group is a list of face indices)
     */
    static extractFaces(mesh, epsilon = 1e-4) {
        let geometry = mesh.geometry;
        geometry = mergeVertices(geometry);
        mesh.geometry = geometry;
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();

        if (!geometry.index) {
            console.error(
                'Mesh must be indexed geometry (BufferGeometry with index).',
            );
            return [];
        }

        const positions = geometry.attributes.position.array;
        const indices = geometry.index.array;
        const faceNormals = [];

        // Compute face normals
        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i],
                b = indices[i + 1],
                c = indices[i + 2];
            const vA = new THREE.Vector3().fromArray(positions, a * 3);
            const vB = new THREE.Vector3().fromArray(positions, b * 3);
            const vC = new THREE.Vector3().fromArray(positions, c * 3);

            const cb = new THREE.Vector3().subVectors(vC, vB);
            const ab = new THREE.Vector3().subVectors(vA, vB);
            const normal = new THREE.Vector3().crossVectors(cb, ab).normalize();

            faceNormals.push(normal);
        }

        // Build adjacency
        const faceNeighbors = Array(faceNormals.length)
            .fill(null)
            .map(() => []);
        const edgeMap = new Map();
        function edgeKey(i1, i2) {
            return i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
        }

        for (let i = 0; i < indices.length; i += 3) {
            const faceIdx = i / 3;
            const face = [indices[i], indices[i + 1], indices[i + 2]];
            for (let e = 0; e < 3; e++) {
                const a = face[e],
                    b = face[(e + 1) % 3];
                const key = edgeKey(a, b);

                if (edgeMap.has(key)) {
                    const otherFace = edgeMap.get(key);
                    faceNeighbors[faceIdx].push(otherFace);
                    faceNeighbors[otherFace].push(faceIdx);
                } else {
                    edgeMap.set(key, faceIdx);
                }
            }
        }

        // DFS to group coplanar faces
        const visited = new Array(faceNormals.length).fill(false);
        const planarGroups = [];

        function isCoplanar(n1, n2) {
            return n1.dot(n2) > 1 - epsilon;
        }

        function triangleArea(a, b, c) {
            const ab = new THREE.Vector3().subVectors(b, a);
            const ac = new THREE.Vector3().subVectors(c, a);
            return new THREE.Vector3().crossVectors(ab, ac).length() * 0.5;
        }

        for (let f = 0; f < faceNormals.length; f++) {
            if (visited[f]) continue;

            const group = [];
            let totalArea = 0;
            const stack = [f];
            visited[f] = true;

            while (stack.length) {
                const curr = stack.pop();
                group.push(curr);

                // area of this face
                const i0 = indices[curr * 3],
                    i1 = indices[curr * 3 + 1],
                    i2 = indices[curr * 3 + 2];
                const v0 = new THREE.Vector3().fromArray(positions, i0 * 3);
                const v1 = new THREE.Vector3().fromArray(positions, i1 * 3);
                const v2 = new THREE.Vector3().fromArray(positions, i2 * 3);
                totalArea += triangleArea(v0, v1, v2);

                for (const neigh of faceNeighbors[curr]) {
                    if (
                        !visited[neigh] &&
                        isCoplanar(faceNormals[curr], faceNormals[neigh])
                    ) {
                        visited[neigh] = true;
                        stack.push(neigh);
                    }
                }
            }

            planarGroups.push({ group, area: totalArea });
        }

        return planarGroups;
    }

    /**
     * Extract N largest planar face groups
     * @param {THREE.Mesh} mesh
     * @param {number} n - number of largest groups to return
     * @returns {Array<Array<number>>}
     */
    static extractLargestFaces(mesh, n = 2) {
        return this.extractFaces(mesh)
            .sort((a, b) => b.area - a.area)
            .slice(0, n);
    }

    /**
     * Export face group as OBJ string
     * @param {THREE.Mesh} mesh
     * @param {Array<number>} faceGroup
     * @returns {string} OBJ formatted string
     */
    static exportFaceGroupAsOBJ(mesh, faceGroup) {
        const geometry = mesh.geometry;
        const positions = geometry.attributes.position.array;
        const indices = geometry.index.array;

        let objStr = 'o FaceGroup\n';

        const vertMap = new Map();
        let vertList = [];
        let faceList = [];

        let vertCounter = 1;

        for (const f of faceGroup) {
            const a = indices[f * 3],
                b = indices[f * 3 + 1],
                c = indices[f * 3 + 2];
            const faceVerts = [a, b, c].map((vIdx) => {
                if (!vertMap.has(vIdx)) {
                    const vx = positions[vIdx * 3];
                    const vy = positions[vIdx * 3 + 1];
                    const vz = positions[vIdx * 3 + 2];
                    vertList.push(`v ${vx} ${vy} ${vz}`);
                    vertMap.set(vIdx, vertCounter++);
                }
                return vertMap.get(vIdx);
            });
            faceList.push(`f ${faceVerts[0]} ${faceVerts[1]} ${faceVerts[2]}`);
        }

        objStr += vertList.join('\n') + '\n';
        objStr += faceList.join('\n') + '\n';

        return objStr;
    }
    static getBoundaryLoop(mesh, faceGroup) {
        const geometry = mesh.geometry;
        const indices = geometry.index.array;

        const edgeCount = new Map();

        function edgeKey(a, b) {
            return a < b ? `${a}_${b}` : `${b}_${a}`;
        }

        // Count edges
        for (const f of faceGroup) {
            const a = indices[f * 3],
                b = indices[f * 3 + 1],
                c = indices[f * 3 + 2];

            const edges = [
                [a, b],
                [b, c],
                [c, a],
            ];

            for (const [v1, v2] of edges) {
                const key = edgeKey(v1, v2);
                if (!edgeCount.has(key)) {
                    edgeCount.set(key, { count: 1, verts: [v1, v2] });
                } else {
                    edgeCount.get(key).count++;
                }
            }
        }

        // Keep only boundary edges (count = 1)
        const boundaryEdges = [];
        for (const { count, verts } of edgeCount.values()) {
            if (count === 1) boundaryEdges.push(verts);
        }

        if (boundaryEdges.length === 0) return [];

        // Build adjacency map from boundary edges
        const adjacency = new Map();
        for (const [v1, v2] of boundaryEdges) {
            if (!adjacency.has(v1)) adjacency.set(v1, []);
            if (!adjacency.has(v2)) adjacency.set(v2, []);
            adjacency.get(v1).push(v2);
            adjacency.get(v2).push(v1);
        }

        // Order into loop
        const loop = [];
        let start = boundaryEdges[0][0];
        let current = start;
        let prev = null;

        do {
            loop.push(current);
            const neighbors = adjacency.get(current);
            const next = neighbors.find((n) => n !== prev);
            prev = current;
            current = next;
        } while (current !== start && current !== undefined);

        return loop;
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

    static extractMidPlane(mesh) {
        const faces = this.extractLargestFaces(mesh, 2);
        if (faces.length < 2) return null;

        const planeA = this.computePlaneFromFace(mesh, faces[0].group);
        const planeB = this.computePlaneFromFace(mesh, faces[1].group);
        const planeInstanceA = new THREE.Plane().setFromNormalAndCoplanarPoint(
            planeA.normal,
            planeA.centroid,
        );
        const distance = planeInstanceA.distanceToPoint(
            planeB.centroid.clone(),
        );

        if (!planeA || !planeB) return null;

        // Average normals
        // const normal = new THREE.Vector3()
        //     .addVectors(planeA.normal, planeB.normal.negate())
        //     .normalize();
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
}
