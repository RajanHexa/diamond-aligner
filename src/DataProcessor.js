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
        const { highest: highest1, lowest: lowest1 } =
            Utils.getMeshHighestLowest(mesh1);
        const { highest: highest2, lowest: lowest2 } =
            Utils.getMeshHighestLowest(mesh2);

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

        // === Compute distances & angles ===
        const blade1Distance = blade1FarPoint.distance;
        const blade2Distance = blade2FarPoint.distance;
        // const blade1Angle = Utils.computeBladeAngle(
        //     intersectionPoint,
        //     blade1FarPoint.point,
        // );
        // const blade2Angle = Utils.computeBladeAngle(
        //     intersectionPoint,
        //     blade2FarPoint.point,
        // );

        // === Construct data object ===
        const data = {
            RotationR: degR,
            RotationW: degW,
            IntersectionTop: intersectionPoint[0].toArray(),
            IntersectionBottom: intersectionPoint[1].toArray(),
            Blade1Top: highest1.toArray(),
            Blade1Bottom: lowest1.toArray(),
            Blade1FarthestPoint: blade1FarPoint.point.toArray(),
            Blade1FarDistance: blade1Distance,
            Blade1Angle: 0,
            Blade2Top: highest2.toArray(),
            Blade2Bottom: lowest2.toArray(),
            Blade2FarthestPoint: blade2FarPoint.point.toArray(),
            Blade2FarDistance: blade2Distance,
            Blade2Angle: 0,
        };

        console.log('processOBJ: final data', data);
        return data;
    }
}
