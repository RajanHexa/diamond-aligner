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

        const blade1FarPoint = Utils.getFarthestPointFromLine(
            mesh1,
            line,
            intersectionPoint[0],
        );
        const blade2FarPoint = Utils.getFarthestPointFromLine(
            mesh2,
            line,
            intersectionPoint[0],
        );

        const blade1Angle = Utils.computeBladeAngle(
            intersectionPoint,
            blade1FarPoint.point,
        );
        const blade2Angle = Utils.computeBladeAngle(
            intersectionPoint,
            blade2FarPoint.point,
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
            Blade1FarthestPoint: blade1FarPoint.point.toArray(),
            Blade1LocalFarthestPoint: blade1FarPoint.localPoint.toArray(),
            Blade1FarDistance: blade1Angle.distance,
            Blade1Angle: blade1Angle.deg,
            Blade2Top: highest2.toArray(),
            Blade2Bottom: lowest2.toArray(),
            Blade2FarthestPoint: blade2FarPoint.point.toArray(),
            Blade2LocalFarthestPoint: blade2FarPoint.localPoint.toArray(),
            Blade2FarDistance: blade2Angle.distance,
            Blade2Angle: blade2Angle.deg,
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
    static async processSingleBlade(url) {
        const blobUrl = URL.createObjectURL(new Blob([url]));
        const mesh = await Utils.loadObjModel(blobUrl);
        const group = new THREE.Group();
        const modelGroup = new THREE.Group();
        modelGroup.add(mesh);
        group.add(modelGroup);
        mesh.geometry.rotateY(Math.PI);
        const midPlane = FaceExtractor.extractMidPlane(mesh);
        const planeInstance = new THREE.Plane().setFromNormalAndCoplanarPoint(
            midPlane.normal,
            midPlane.centroid,
        );
        // === Intersection points ===
        const planeContour = ClipPlane.getIntersectionContour(
            mesh,
            planeInstance,
        );
        const farthestPair = DataProcesser.findFarthestPoints(
            mesh,
            planeContour,
            midPlane,
        );
        const farthestPoint = farthestPair.perpendicularPoint;
        const localIntersectionPoint = farthestPair.localPerpendicularPoint.map(
            (v) => v.clone(),
        );

        const angleX = farthestPair.angleR;
        const degR = THREE.MathUtils.radToDeg(angleX);
        modelGroup.rotateOnAxis(new THREE.Vector3(1, 0, 0), angleX);

        const angleZ = farthestPair.angleW;
        const degW = THREE.MathUtils.radToDeg(angleZ);
        group.rotateOnAxis(new THREE.Vector3(0, 0, 1), angleZ);

        const { highest, lowest, localHighest, localLowest } =
            Utils.getMeshHighestLowest(mesh);
        const bladeFarPoint = Utils.getFarthestPointsFromLine(
            mesh,
            farthestPoint,
            midPlane,
        );
        const cameraIntersectionData = FaceExtractor.getCameraData2(
            farthestPoint,
            highest,
        );
        const cameraIntersectionDataLocal = FaceExtractor.getCameraDataLocal2(
            farthestPoint,
            localIntersectionPoint,
            localHighest,
        );
        const data = {
            RotationR: 270 - degR,
            RotationW: 90 - degW,
            IntersectionTop: farthestPoint[0].toArray(),
            IntersectionBottom: farthestPoint[1].toArray(),
            LocalIntersectionTop: localIntersectionPoint[0].toArray(),
            LocalIntersectionBottom: localIntersectionPoint[1].toArray(),
            BladeTop: highest.toArray(),
            BladeBottom: lowest.toArray(),
            BladeFarthestPoint1: bladeFarPoint.farPoint1.toArray(),
            BladeFarthestPoint2: bladeFarPoint.farPoint2.toArray(),
            BladeLocalFarthestPoint1: bladeFarPoint.localPoint1.toArray(),
            BladeLocalFarthestPoint2: bladeFarPoint.localPoint2.toArray(),
            BladeFarDistance: bladeFarPoint.distance,
            BladeAngle: bladeFarPoint.deg,
            BladeLocalTop: localHighest.toArray(),
            BladeLocalBottom: localLowest.toArray(),
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
        return data;
    }

    static findFarthestPoints(mesh, points, midPlane) {
        if (!points || points.length < 2) return null;

        let maxDist = -Infinity;
        let farthestPair = [points[0], points[1]];

        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const dist = points[i].distanceToSquared(points[j]);
                if (dist > maxDist) {
                    maxDist = dist;
                    farthestPair = [points[i], points[j]];
                }
            }
        }
        const direction = new THREE.Vector3()
            .subVectors(farthestPair[1], farthestPair[0])
            .normalize();
        const planeNormal = midPlane.normal.clone();
        const perpendicularAxis = new THREE.Vector3().crossVectors(
            direction,
            planeNormal,
        );
        const [p1, p2] = farthestPair;
        const center = new THREE.Vector3(
            (p1.x + p2.x) / 2,
            (p1.y + p2.y) / 2,
            (p1.z + p2.z) / 2,
        );
        const raycaster = new THREE.Raycaster();
        raycaster.ray.origin.copy(center);
        raycaster.ray.direction.copy(perpendicularAxis).normalize();
        let perpendicularPoint = [];
        const intersections = raycaster.intersectObject(mesh, true);
        if (intersections.length > 0) {
            console.log(intersections);
            perpendicularPoint = [intersections[0].point];
        }
        const raycaster2 = new THREE.Raycaster();
        raycaster2.ray.origin.copy(center);
        raycaster2.ray.direction
            .copy(perpendicularAxis.clone().negate())
            .normalize();
        const intersections2 = raycaster2.intersectObject(mesh, true);
        if (intersections2.length > 0) {
            console.log(intersections2);

            perpendicularPoint.push(intersections2[0].point);
        }
        const localPerpendicularPoint = [...perpendicularPoint];
        const angleEqX = Utils.angleToEqualizeZ(
            farthestPair[0],
            farthestPair[1],
        );
        const angleR = Math.PI / 2 + angleEqX;
        perpendicularPoint[0].applyAxisAngle(
            new THREE.Vector3(1, 0, 0),
            angleR,
        );
        perpendicularPoint[1].applyAxisAngle(
            new THREE.Vector3(1, 0, 0),
            angleR,
        );
        const angleW = Utils.angleZToEqualizeX(
            perpendicularPoint[0],
            perpendicularPoint[1],
        );
        perpendicularPoint[0].applyAxisAngle(
            new THREE.Vector3(0, 0, 1),
            angleW,
        );
        perpendicularPoint[1].applyAxisAngle(
            new THREE.Vector3(0, 0, 1),
            angleW,
        );
        return { perpendicularPoint, angleR, angleW, localPerpendicularPoint };
    }
}
