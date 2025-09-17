import gsap from 'gsap';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';

import * as THREE from 'three';
import { ClipPlane } from './ClipPlane';

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
        const matrixInvert = mesh.matrixWorld.clone().invert();
        const localHighest = new THREE.Vector3().copy(highest);
        localHighest.applyMatrix4(matrixInvert);
        const localLowest = new THREE.Vector3().copy(lowest);
        localLowest.applyMatrix4(matrixInvert);

        return { highest, lowest, localHighest, localLowest };
    }
    static getTopBottomWithMidpoint(points) {
        if (!points || points.length === 0) {
            return { top: null, bottom: null, centroid: null };
        }

        // Get top and bottom by Y
        let top = points[0].clone();
        let bottom = points[0].clone();

        for (let p of points) {
            if (p.y > top.y) top = p.clone();
            if (p.y < bottom.y) bottom = p.clone();
        }

        return { top, bottom };
    }

    static getTopBottomProjected(points, centroid) {
        if (!points || points.length === 0 || !centroid) {
            return { top: null, bottom: null };
        }

        let maxY = -Infinity;
        let minY = Infinity;

        for (const p of points) {
            if (p.y > maxY) maxY = p.y;
            if (p.y < minY) minY = p.y;
        }

        // Create points with same X,Z as centroid, but Y from top/bottom
        const top = new THREE.Vector3(centroid.x, maxY, centroid.z);
        const bottom = new THREE.Vector3(centroid.x, minY, centroid.z);

        return { top, bottom };
    }

    static getXZAngleWithNegX(top, bottom) {
        if (!top || !bottom) return null;

        // 1️⃣ Project points onto XZ plane
        const topXZ = new THREE.Vector3(top.x, 0, top.z);
        const bottomXZ = new THREE.Vector3(bottom.x, 0, bottom.z);

        // 2️⃣ Vector from bottom → top
        const vec = new THREE.Vector3().subVectors(topXZ, bottomXZ).normalize();

        // 3️⃣ Negative X-axis vector
        const negX = new THREE.Vector3(-1, 0, 0);

        // 4️⃣ Angle in radians
        const angleRad = vec.angleTo(negX);
        const angleDeg = THREE.MathUtils.radToDeg(angleRad);

        return angleDeg;
    }

    static getFarthestPointsXZ(points) {
        if (!points || points.length < 2)
            return { farthest1: null, farthest2: null };

        let maxDistSq = -Infinity;
        let farthest1 = null;
        let farthest2 = null;

        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                // Compute squared distance in XZ plane (ignore y)
                const dx = points[i].x - points[j].x;
                const dz = points[i].z - points[j].z;
                const distSq = dx * dx + dz * dz;

                if (distSq > maxDistSq) {
                    maxDistSq = distSq;
                    // clone full 3D point but still return original y values
                    farthest1 = points[i].clone();
                    farthest2 = points[j].clone();
                }
            }
        }

        return { farthest1, farthest2 };
    }

    static restorePointsToOriginal(points, angle, axis = 'x') {
        if (!points || points.length === 0) return [];

        const axisVector =
            axis === 'x'
                ? new THREE.Vector3(1, 0, 0)
                : axis === 'y'
                  ? new THREE.Vector3(0, 1, 0)
                  : new THREE.Vector3(0, 0, 1);

        // Invert the applied rotation (apply negative angle)
        return points.map((p) => p.clone().applyAxisAngle(axisVector, -angle));
    }

    static getHighestZPoint(points) {
        if (!points || points.length === 0) return null;

        let highest = points[0].clone();

        for (const p of points) {
            if (p.z < highest.z) {
                highest.copy(p);
            }
        }
        //return three.js vector
        highest = new THREE.Vector3(highest.x, highest.y, highest.z);

        return highest;
    }

    /**
     * Finds the farthest vertex of a mesh from a given line
     * @param {THREE.Mesh} mesh - The mesh
     * @param {THREE.Line3} line - The line (start + end)
     * @returns {{point: THREE.Vector3, distance: number}}
     */
    static getFarthestPointFromLine(mesh, line, planePoint, midPlane) {
        const planeInstance = new THREE.Plane();
        planeInstance.setFromNormalAndCoplanarPoint(
            midPlane.normal,
            midPlane.centroid,
        );
        mesh.updateWorldMatrix(true, false);

        // clone geometry and apply world transform
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        planeInstance.applyMatrix4(mesh.matrixWorld);

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
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            planePoint,
        );
        const projectedFarthestPoint = new THREE.Vector3();
        const midPlaneProjectPoint = new THREE.Vector3();
        planeInstance.projectPoint(farthestPoint.clone(), midPlaneProjectPoint);
        plane.projectPoint(
            midPlaneProjectPoint.clone(),
            projectedFarthestPoint,
        );
        const distance = farthestPoint.distanceTo(projectedFarthestPoint);
        const invertMatrix = mesh.matrixWorld.clone().invert();
        const localProjectedFarthestPoint = new THREE.Vector3().copy(
            projectedFarthestPoint,
        );
        localProjectedFarthestPoint.applyMatrix4(invertMatrix);
        return {
            point: midPlaneProjectPoint.clone(),
            distance: distance,
            localPoint: localProjectedFarthestPoint,
        };
    }
    static getFarthestPointsFromLine(mesh, linePoints, plane) {
        const planeInstance = new THREE.Plane();
        planeInstance.setFromNormalAndCoplanarPoint(
            plane.normal,
            plane.centroid,
        );
        mesh.updateWorldMatrix(true, false);

        // Clone geometry in world space
        const geometry = mesh.geometry.clone();
        geometry.applyMatrix4(mesh.matrixWorld);
        planeInstance.applyMatrix4(mesh.matrixWorld);

        const posAttr = geometry.attributes.position;
        const p0 = linePoints[0].clone();
        const p1 = linePoints[1].clone();
        const lineDir = p1.clone().sub(p0);
        const d = lineDir.clone().normalize();

        let farthestLeft = null,
            farthestRight = null;
        let maxLeftDist = -Infinity,
            maxRightDist = -Infinity;

        const tmp = new THREE.Vector3();
        const v = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
            tmp.fromBufferAttribute(posAttr, i);

            // Vector from line point to this vertex
            v.subVectors(tmp, p0);

            // Project onto line to get closest point
            const t = v.dot(d);
            const closestPoint = p0.clone().addScaledVector(d, t);

            // Perpendicular vector from line to point
            const perp = tmp.clone().sub(closestPoint);

            const dist = perp.length();

            // Determine left/right using sign of triple product
            const sign = Math.sign(
                planeInstance.normal.dot(d.clone().cross(perp)),
            );
            const projectedPoint = new THREE.Vector3();
            planeInstance.projectPoint(tmp.clone(), projectedPoint);
            if (sign > 0) {
                if (dist > maxRightDist) {
                    maxRightDist = dist;
                    farthestRight = projectedPoint.clone();
                }
            } else if (sign < 0) {
                if (dist > maxLeftDist) {
                    maxLeftDist = dist;
                    farthestLeft = projectedPoint.clone();
                }
            }
        }
        let distance = null;
        const topPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 1, 0),
            linePoints[0].clone(),
        );
        const invertMatrix = mesh.matrixWorld.clone().invert();

        if (farthestLeft && farthestRight) {
            const projectedTopFarthestPoint1 = new THREE.Vector3();
            const projectedTopFarthestPoint2 = new THREE.Vector3();
            topPlane.projectPoint(
                farthestLeft.clone(),
                projectedTopFarthestPoint1,
            );
            topPlane.projectPoint(
                farthestRight.clone(),
                projectedTopFarthestPoint2,
            );
            const distance = projectedTopFarthestPoint1.distanceTo(
                projectedTopFarthestPoint2,
            );
            const localProjectedFarthestPoint1 = new THREE.Vector3().copy(
                farthestLeft.clone(),
            );
            const localProjectedFarthestPoint2 = new THREE.Vector3().copy(
                farthestRight.clone(),
            );
            localProjectedFarthestPoint1.applyMatrix4(invertMatrix.clone());
            localProjectedFarthestPoint2.applyMatrix4(invertMatrix.clone());
            const angle = this.computeBladeAngle(linePoints[0], farthestRight);

            return {
                farPoint1: farthestLeft.clone(),
                farPoint2: farthestRight.clone(),
                distance: distance,
                localPoint1: localProjectedFarthestPoint1,
                localPoint2: localProjectedFarthestPoint2,
                angle: angle,
            };
        } else {
            const projectedFarPoint = new THREE.Vector3();
            let intersectionClosestPoint = null;
            const farPoint = farthestLeft ? farthestLeft : farthestRight;
            const point1Distance = linePoints[0].distanceTo(farPoint.clone());
            const point2Distance = linePoints[1].distanceTo(farPoint.clone());
            if (point1Distance < point2Distance) {
                intersectionClosestPoint = linePoints[0];
            } else {
                intersectionClosestPoint = linePoints[1];
            }
            const angle = this.computeBladeAngle(linePoints[0], farPoint);
            topPlane.projectPoint(farPoint.clone(), projectedFarPoint);
            distance = intersectionClosestPoint.distanceTo(projectedFarPoint);
            const localProjectedFarthestPoint1 = new THREE.Vector3().copy(
                farthestRight.clone(),
            );
            localProjectedFarthestPoint1.applyMatrix4(invertMatrix.clone());
            return {
                farPoint1: farPoint.clone(),
                distance: distance,
                localPoint1: localProjectedFarthestPoint1.clone(),
                angle: angle,
            };
        }
    }
    static exportPointsToOBJ(points) {
        let objData = '';

        // Each point becomes a vertex line in OBJ
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            objData += `v ${p.x} ${p.y} ${p.z}\n`;
        }

        return objData;
    }
    static downloadOBJ(points, filename = 'points.obj') {
        const objText = Utils.exportPointsToOBJ(points);
        const blob = new Blob([objText], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }
    static computeBladeAngleAndDistance(intersectionPoint, farPoint) {
        let intersectionClosestPoint = null;
        const point1Distance = intersectionPoint[0].distanceTo(farPoint);
        const point2Distance = intersectionPoint[1].distanceTo(farPoint);
        if (point1Distance < point2Distance) {
            intersectionClosestPoint = intersectionPoint[0];
        } else {
            intersectionClosestPoint = intersectionPoint[1];
        }
        const p2 = new THREE.Vector3()
            .copy(intersectionClosestPoint.clone())
            .add(new THREE.Vector3(-1, 0, 0).multiplyScalar(100));
        const distance = intersectionClosestPoint.distanceTo(farPoint);
        const angleSigned = this.signedAngleBetweenLinesXZ(
            farPoint.clone(),
            p2.clone(),
            intersectionClosestPoint.clone(),
        );
        return { deg: angleSigned, distance };
    }
    static signedAngleBetweenLinesXZ(p1, p2, origin) {
        // v1 = line from origin -> p1
        const v1 = new THREE.Vector3().subVectors(p1, origin);
        v1.y = 0; // project to XZ plane
        v1.normalize();
        // v2 = line from origin -> p2
        const v2 = new THREE.Vector3().subVectors(p2, origin);
        v2.y = 0;
        v2.normalize();
        // Dot product gives cos(theta)
        const dot = THREE.MathUtils.clamp(v1.dot(v2), -1, 1);
        // Cross product → use Y component to know clockwise / counterclockwise
        const cross = new THREE.Vector3().crossVectors(v1, v2);
        // atan2(sin, cos) → signed angle in [-PI, PI]
        let angle = Math.atan2(cross.y, dot);
        // convert to [0, 360)
        angle = THREE.MathUtils.radToDeg(angle);
        return (angle + 360) % 360;
    }
    static computeBladeAngle(intersectionPoint, farPoint) {
        const p2 = new THREE.Vector3()
            .copy(intersectionPoint.clone())
            .add(new THREE.Vector3(-1, 0, 0).multiplyScalar(100));
        const angleSigned = this.signedAngleBetweenLinesXZ(
            farPoint.clone(),
            p2.clone(),
            intersectionPoint.clone(),
        );
        return angleSigned;
    }
}
