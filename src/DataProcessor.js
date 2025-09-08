import { ClipPlane } from './ClipPlane';
import { FaceExtractor } from './FaceExtractor';
import { Utils } from './Utils';
import * as THREE from 'three';

export class DataProcesser {
    static async processOBJ(url1, url2) {
        console.log('processOBJ: start');

        const blobUrl1 = URL.createObjectURL(new Blob([url1]));
        const blobUrl2 = URL.createObjectURL(new Blob([url2]));
        console.log('processOBJ: blob urls created');

        const mesh1 = await Utils.loadObjModel(blobUrl1);
        const mesh2 = await Utils.loadObjModel(blobUrl2);
        const group = new THREE.Group();
        const modelGroup = new THREE.Group();
        modelGroup.add(mesh1);
        modelGroup.add(mesh2);
        group.add(modelGroup);
        console.log('processOBJ: meshes loaded');

        mesh1.geometry.rotateY(Math.PI);
        mesh2.geometry.rotateY(Math.PI);
        console.log('processOBJ: meshes rotated');

        const midPlane1 = FaceExtractor.extractMidPlane(mesh1);
        const midPlane2 = FaceExtractor.extractMidPlane(mesh2);
        console.log(midPlane1, midPlane2);

        if (!(midPlane1 && midPlane2)) {
            console.log('processOBJ: midplanes invalid');
            return null;
        }

        // === Plane setup ===
        const planeInstance1 = new THREE.Plane().setFromNormalAndCoplanarPoint(
            midPlane1.normal,
            midPlane1.centroid,
        );
        const planeInstance2 = new THREE.Plane().setFromNormalAndCoplanarPoint(
            midPlane2.normal,
            midPlane2.centroid,
        );

        // === Intersection points ===
        const planeContour1 = ClipPlane.getIntersectionContour(
            mesh1,
            planeInstance1,
        );
        let localIntersectionPoint;
        let intersectionPoint = ClipPlane.getContourPlaneIntersection(
            planeContour1,
            planeInstance2,
            planeInstance1,
        );

        if (intersectionPoint.length === 0) {
            const planeShape = ClipPlane.getIntersectionContour(
                mesh2,
                planeInstance2,
            );
            intersectionPoint = ClipPlane.getContourPlaneIntersection(
                planeShape,
                planeInstance1,
                planeInstance2,
            );
        }
        const copy = intersectionPoint.map((v) => v.clone());
        localIntersectionPoint = copy;

        // === Rotation calculations ===
        const angleX = Utils.angleToEqualizeZ(
            intersectionPoint[0],
            intersectionPoint[1],
        );
        const degR = THREE.MathUtils.radToDeg(angleX);
        intersectionPoint[0].applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
        intersectionPoint[1].applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX);
        modelGroup.rotateOnAxis(new THREE.Vector3(1, 0, 0), angleX);

        const angleZ = Utils.angleZToEqualizeX(
            intersectionPoint[0],
            intersectionPoint[1],
        );
        const degW = THREE.MathUtils.radToDeg(angleZ);
        intersectionPoint[0].applyAxisAngle(new THREE.Vector3(0, 0, 1), angleZ);
        intersectionPoint[1].applyAxisAngle(new THREE.Vector3(0, 0, 1), angleZ);
        group.rotateOnAxis(new THREE.Vector3(0, 0, 1), angleZ);

        // === Mesh highest/lowest ===
        const {
            highest: highest1,
            lowest: lowest1,
            localHighest,
            localLowest,
        } = Utils.getMeshHighestLowest(mesh1);
        const {
            highest: highest2,
            lowest: lowest2,
            localHighest: localHighest2,
            localLowest: localLowest2,
        } = Utils.getMeshHighestLowest(mesh2);

        // === Line for farthest point calculation ===
        const line = new THREE.Line3(
            intersectionPoint[0],
            intersectionPoint[1],
        );
        const blade1FarPoint = Utils.getFarthestPointsFromLine(
            mesh1,
            line,
            intersectionPoint[0],
            planeInstance1,
        );
        const blade2FarPoint = Utils.getFarthestPointsFromLine(
            mesh2,
            line,
            intersectionPoint[0],
            planeInstance2,
        );
        const cameraIntersectionData = FaceExtractor.getCameraData(
            intersectionPoint,
            highest1,
            highest2,
        );
        const cameraIntersectionDataLocal = FaceExtractor.getCameraDataLocal(
            intersectionPoint,
            localIntersectionPoint,
            localHighest,
            localHighest2,
        );

        // === Construct data object ===
        const data = {
            RotationR: 270 - degR,
            RotationW: 90 - degW,
            IntersectionTop: intersectionPoint[0].toArray(),
            IntersectionBottom: intersectionPoint[1].toArray(),
            LocalIntersectionTop: localIntersectionPoint[0].toArray(),
            LocalIntersectionBottom: localIntersectionPoint[1].toArray(),
            Blade1Top: highest1.toArray(),
            Blade1Bottom: lowest1.toArray(),
            Blade1FarthestPoint1: blade1FarPoint.farPoint1.toArray(),
            Blade1FarthestPoint2: blade1FarPoint.farPoint2.toArray(),
            Blade1LocalFarthestPoint1: blade1FarPoint.localPoint1.toArray(),
            Blade1LocalFarthestPoint2: blade1FarPoint.localPoint2.toArray(),
            Blade1FarDistance: blade1FarPoint.distance,
            Blade1Angle: blade1FarPoint.angle,
            Blade2Top: highest2.toArray(),
            Blade2Bottom: lowest2.toArray(),
            Blade2FarthestPoint1: blade2FarPoint.farPoint1.toArray(),
            Blade2FarthestPoint2: blade2FarPoint.farPoint2.toArray(),
            Blade2LocalFarthestPoint1: blade2FarPoint.localPoint1.toArray(),
            Blade2LocalFarthestPoint2: blade2FarPoint.localPoint2.toArray(),
            Blade2FarDistance: blade2FarPoint.distance,
            Blade2Angle: blade2FarPoint.angle,
            Blade1LocalTop: localHighest.toArray(),
            Blade1LocalBottom: localLowest.toArray(),
            Blade2LocalTop: localHighest2.toArray(),
            Blade2LocalBottom: localLowest2.toArray(),
            CameraIntersectionDistance:
                cameraIntersectionData.cameraDistanceIntersection.toFixed(2),
            CameraDistanceToFarPoint:
                cameraIntersectionData.cameraDistanceToTopPoint.toFixed(2),
            CameraIntersectionDistanceLocal:
                cameraIntersectionDataLocal.cameraDistanceIntersection.toFixed(
                    2,
                ),
            CameraDistanceToFarPointLocal:
                cameraIntersectionDataLocal.cameraDistanceToTopPoint.toFixed(2),
        };

        console.log('processOBJ: final data', data);
        return data;
    }
}
