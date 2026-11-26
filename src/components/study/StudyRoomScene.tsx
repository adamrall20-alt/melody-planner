import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation';
import { Sun, Sunset, Moon, BookOpen } from 'lucide-react';
import type { AppTheme } from '@shared/types';

interface StudyRoomSceneProps {
  theme: AppTheme;
  eyeTracking: boolean;
  isFocusing: boolean;
  celebrating: boolean;
  topicLabel?: string;
}

type LightingPreset = 'morning' | 'golden' | 'night';

export function StudyRoomScene({
  theme,
  eyeTracking,
  isFocusing,
  celebrating,
  topicLabel,
}: StudyRoomSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const eyeTrackingRef = useRef(eyeTracking);
  const isFocusingRef = useRef(isFocusing);
  const celebratingRef = useRef(celebrating);
  const pointerNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lighting, setLighting] = useState<LightingPreset>(theme === 'dark' ? 'night' : 'morning');
  const lightingRef = useRef<LightingPreset>(lighting);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eyeTrackingRef.current = eyeTracking;
  }, [eyeTracking]);

  useEffect(() => {
    isFocusingRef.current = isFocusing;
  }, [isFocusing]);

  useEffect(() => {
    celebratingRef.current = celebrating;
  }, [celebrating]);

  useEffect(() => {
    lightingRef.current = lighting;
  }, [lighting]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.42;
      pointerNormRef.current = {
        x: THREE.MathUtils.clamp((e.clientX - cx) / (window.innerWidth * 0.45), -1, 1),
        y: THREE.MathUtils.clamp((cy - e.clientY) / (window.innerHeight * 0.45), -1, 1),
      };
    };
    const handlePointerLeave = () => {
      pointerNormRef.current = { x: 0, y: 0 };
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 540;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 30);
    camera.position.set(1.65, 1.48, 2.05);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.72, 0.08);
    controls.enablePan = false;
    controls.minDistance = 1.15;
    controls.maxDistance = 3.5;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minAzimuthAngle = -Math.PI * 0.45;
    controls.maxAzimuthAngle = Math.PI * 0.48;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.update();

    // ─── Lights (dynamically tinted by Morning / Golden / Night preset) ───────
    const ambient = new THREE.AmbientLight(0xfff7ed, 0.85);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff1dc, 1.35);
    sunLight.position.set(2.8, 3.8, 2.4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const lampLight = new THREE.PointLight(0xffd28a, 1.1, 5.5);
    lampLight.position.set(-1.15, 1.12, -0.82);
    scene.add(lampLight);

    const rimLight = new THREE.DirectionalLight(0xbbe6f7, 0.55);
    rimLight.position.set(-2.2, 2.0, -1.6);
    scene.add(rimLight);

    // ─── Cozy Bedroom Geometry ────────────────────────────────────────────────
    const roomGroup = new THREE.Group();
    scene.add(roomGroup);

    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xe6c9a8, roughness: 0.85 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.1, 5.0), floorMat);
    floor.position.set(0, -0.05, 0);
    floor.receiveShadow = true;
    roomGroup.add(floor);

    // Soft Pastel Rug
    const rugMat = new THREE.MeshStandardMaterial({ color: 0xc8f1e1, roughness: 0.95 });
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.02, 40), rugMat);
    rug.position.set(0.15, 0.01, 0.25);
    rug.receiveShadow = true;
    roomGroup.add(rug);

    // Back & Left Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf6eef5, roughness: 0.92 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(5.4, 3.2, 0.12), wallMat);
    backWall.position.set(0, 1.55, -1.45);
    backWall.receiveShadow = true;
    roomGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 5.0), wallMat);
    leftWall.position.set(-2.05, 1.55, 0.2);
    leftWall.receiveShadow = true;
    roomGroup.add(leftWall);

    // Cozy Window on Back Wall
    const windowFrameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const windowFrame = new THREE.Mesh(new THREE.BoxGeometry(1.55, 1.15, 0.08), windowFrameMat);
    windowFrame.position.set(0.65, 1.85, -1.36);
    roomGroup.add(windowFrame);

    const skyMat = new THREE.MeshBasicMaterial({ color: 0xbce6fb });
    const windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.38, 0.98), skyMat);
    windowGlass.position.set(0.65, 1.85, -1.31);
    roomGroup.add(windowGlass);

    // Window Mullions
    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 0.04), windowFrameMat);
    mullionV.position.set(0.65, 1.85, -1.31);
    roomGroup.add(mullionV);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.04), windowFrameMat);
    mullionH.position.set(0.65, 1.85, -1.31);
    roomGroup.add(mullionH);

    // ─── Cozy Bed ─────────────────────────────────────────────────────────────
    const woodMat = new THREE.MeshStandardMaterial({ color: 0xc9966b, roughness: 0.72 });
    const mattressMat = new THREE.MeshStandardMaterial({ color: 0xfffaf5, roughness: 0.9 });
    const duvetMat = new THREE.MeshStandardMaterial({ color: 0xfbd5e6, roughness: 0.88 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: 0xc7eafc, roughness: 0.88 });

    // Bed Frame Base
    const bedFrame = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.24, 2.25), woodMat);
    bedFrame.position.set(0, 0.22, -0.08);
    bedFrame.castShadow = true;
    bedFrame.receiveShadow = true;
    roomGroup.add(bedFrame);

    // Bed Headboard
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.92, 0.1), woodMat);
    headboard.position.set(0, 0.62, -1.18);
    headboard.castShadow = true;
    roomGroup.add(headboard);

    // Bed Legs
    for (const [lx, lz] of [
      [-0.74, -1.12],
      [0.74, -1.12],
      [-0.74, 0.96],
      [0.74, 0.96],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.14, 12), woodMat);
      leg.position.set(lx, 0.07, lz);
      roomGroup.add(leg);
    }

    // Mattress (top surface at y = 0.54)
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.22, 2.14), mattressMat);
    mattress.position.set(0, 0.43, -0.08);
    mattress.receiveShadow = true;
    roomGroup.add(mattress);

    // Soft Pastel Duvet draped over lower half of bed
    const duvet = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.48), duvetMat);
    duvet.position.set(0, 0.54, 0.22);
    duvet.receiveShadow = true;
    roomGroup.add(duvet);

    // Fluffy Pillows
    const pillowL = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.38), pillowMat);
    pillowL.position.set(-0.36, 0.62, -0.88);
    pillowL.rotation.x = 0.22;
    roomGroup.add(pillowL);

    const pillowR = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.16, 0.38),
      new THREE.MeshStandardMaterial({ color: 0xfdebb6, roughness: 0.88 })
    );
    pillowR.position.set(0.36, 0.62, -0.88);
    pillowR.rotation.x = 0.22;
    roomGroup.add(pillowR);

    // Bedside Nightstand & Warm Lamp
    const nightstand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.56, 0.46), woodMat);
    nightstand.position.set(-1.18, 0.28, -0.88);
    nightstand.castShadow = true;
    roomGroup.add(nightstand);

    const lampBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.09, 0.24, 16),
      new THREE.MeshStandardMaterial({ color: 0xfdebb6, roughness: 0.5 })
    );
    lampBase.position.set(-1.18, 0.68, -0.88);
    roomGroup.add(lampBase);

    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: 0xfff3d6,
      emissive: 0xffc978,
      emissiveIntensity: 0.55,
      roughness: 0.6,
    });
    const lampShade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.19, 0.22, 20), lampShadeMat);
    lampShade.position.set(-1.18, 0.88, -0.88);
    roomGroup.add(lampShade);

    // ─── Open Book Prop on Bed (in front of Melody) ───────────────────────────
    const bookGroup = new THREE.Group();
    bookGroup.position.set(0.0, 0.585, 0.52);
    bookGroup.rotation.y = Math.PI; // open facing Melody
    roomGroup.add(bookGroup);

    const coverMat = new THREE.MeshStandardMaterial({ color: 0x38b2c4, roughness: 0.7 });
    const pageMat = new THREE.MeshStandardMaterial({ color: 0xfffdf7, roughness: 0.9 });

    const leftCover = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.32), coverMat);
    leftCover.position.set(-0.125, 0.01, 0);
    leftCover.rotation.z = -0.14;
    bookGroup.add(leftCover);

    const rightCover = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.32), coverMat);
    rightCover.position.set(0.125, 0.01, 0);
    rightCover.rotation.z = 0.14;
    bookGroup.add(rightCover);

    const leftPage = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.3), pageMat);
    leftPage.position.set(-0.115, 0.025, 0);
    leftPage.rotation.z = -0.14;
    bookGroup.add(leftPage);

    const rightPage = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.3), pageMat);
    rightPage.position.set(0.115, 0.025, 0);
    rightPage.rotation.z = 0.14;
    bookGroup.add(rightPage);

    // Animated Turning Page Pivot
    const turnPagePivot = new THREE.Group();
    turnPagePivot.position.set(0, 0.036, 0);
    bookGroup.add(turnPagePivot);
    const turningPage = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.004, 0.29), pageMat);
    turningPage.position.set(0.105, 0, 0);
    turnPagePivot.add(turningPage);

    // LookAt Target for Eye Tracking
    const lookAtTarget = new THREE.Object3D();
    lookAtTarget.position.set(0, 0.85, 1.4);
    scene.add(lookAtTarget);

    // ─── Load Melody.vrm & Optional study_bed.vrma ────────────────────────────
    let currentVrm: VRM | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let hasCustomBedAnim = false;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    loader.load(
      '/models/Melody.vrm',
      async (gltf) => {
        const vrm = gltf.userData.vrm as VRM;
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        vrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });
        VRMUtils.rotateVRM0(vrm);

        if (vrm.lookAt) {
          vrm.lookAt.target = lookAtTarget;
        }

        // Place Melody on top of the cozy bed, facing forward toward the book (+Z)
        vrm.scene.position.set(0, 0.66, -0.22);
        scene.add(vrm.scene);
        currentVrm = vrm;

        // Check for optional custom Blender study_bed.vrma
        try {
          const head = await fetch('/animations/study_bed.vrma', { method: 'HEAD' });
          if (head.ok) {
            const animGltf = await loader.loadAsync('/animations/study_bed.vrma');
            const anims = animGltf.userData.vrmAnimations as VRMAnimation[] | undefined;
            if (anims && anims.length > 0) {
              mixer = new THREE.AnimationMixer(vrm.scene);
              const clip = createVRMAnimationClip(anims[0], vrm);
              const action = mixer.clipAction(clip);
              action.loop = THREE.LoopRepeat;
              action.play();
              hasCustomBedAnim = true;
            }
          }
        } catch {
          // Use procedural stomach-down reading pose below
        }

        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load Melody.vrm in Study Room:', err);
        setLoading(false);
      }
    );

    const clock = new THREE.Clock();
    let blinkTimer = 0;
    let nextBlinkIn = 2.8;
    let smoothLookX = 0;
    let smoothLookY = 0;
    let animFrame = 0;

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Update lighting preset smoothly
      const mode = lightingRef.current;
      if (mode === 'morning') {
        ambient.color.setHex(0xfff8f0);
        ambient.intensity = 0.92;
        sunLight.color.setHex(0xfff4e0);
        sunLight.intensity = 1.35;
        lampLight.intensity = 0.45;
        lampShadeMat.emissiveIntensity = 0.25;
        skyMat.color.setHex(0xbce6fb);
        wallMat.color.setHex(0xf4f0f7);
      } else if (mode === 'golden') {
        ambient.color.setHex(0xffdfc2);
        ambient.intensity = 0.82;
        sunLight.color.setHex(0xffb470);
        sunLight.intensity = 1.45;
        lampLight.intensity = 1.15;
        lampShadeMat.emissiveIntensity = 0.7;
        skyMat.color.setHex(0xfdba8c);
        wallMat.color.setHex(0xf7e7dc);
      } else {
        ambient.color.setHex(0x8aa4c8);
        ambient.intensity = 0.48;
        sunLight.color.setHex(0x9ec5fe);
        sunLight.intensity = 0.4;
        lampLight.intensity = 1.85;
        lampShadeMat.emissiveIntensity = 1.15;
        skyMat.color.setHex(0x1e2942);
        wallMat.color.setHex(0x2c3345);
      }

      // Subtle page-turn animation every 14 seconds while focusing
      const pageCycle = elapsed % 14;
      if (isFocusingRef.current && pageCycle > 12.6) {
        const t = (pageCycle - 12.6) / 1.4;
        turnPagePivot.rotation.z = THREE.MathUtils.lerp(0.14, Math.PI - 0.14, t);
        turningPage.visible = true;
      } else {
        turningPage.visible = false;
      }

      if (mixer) {
        mixer.update(delta);
      }

      // Smooth cursor tracking
      const targetX = eyeTrackingRef.current ? pointerNormRef.current.x : 0;
      const targetY = eyeTrackingRef.current ? pointerNormRef.current.y : 0;
      const lerpAlpha = Math.min(1, delta * 5.5);
      smoothLookX += (targetX - smoothLookX) * lerpAlpha;
      smoothLookY += (targetY - smoothLookY) * lerpAlpha;

      lookAtTarget.position.set(smoothLookX * 1.3, 0.86 + smoothLookY * 0.75, 1.65);

      if (currentVrm) {
        const isCeleb = celebratingRef.current;
        const head = currentVrm.humanoid?.getNormalizedBoneNode('head');
        const neck = currentVrm.humanoid?.getNormalizedBoneNode('neck');

        if (!hasCustomBedAnim) {
          // Stomach-down on bed, propped up on elbows, legs kicked playfully in the air!
          const hips = currentVrm.humanoid?.getNormalizedBoneNode('hips');
          const spine = currentVrm.humanoid?.getNormalizedBoneNode('spine');
          const chest = currentVrm.humanoid?.getNormalizedBoneNode('chest');
          const upperChest = currentVrm.humanoid?.getNormalizedBoneNode('upperChest');
          const leftUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
          const leftLowerArm = currentVrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
          const rightLowerArm = currentVrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
          const leftUpperLeg = currentVrm.humanoid?.getNormalizedBoneNode('leftUpperLeg');
          const rightUpperLeg = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperLeg');
          const leftLowerLeg = currentVrm.humanoid?.getNormalizedBoneNode('leftLowerLeg');
          const rightLowerLeg = currentVrm.humanoid?.getNormalizedBoneNode('rightLowerLeg');

          if (hips) {
            hips.position.y = -0.02;
            hips.rotation.x = 1.46; // Lay stomach-down along the bed
            hips.rotation.y = 0;
            hips.rotation.z = Math.sin(elapsed * 0.9) * 0.02;
          }
          // Arch upper body gently up off the mattress toward the book
          if (spine) {
            spine.rotation.x = -0.34 + Math.sin(elapsed * 1.5) * 0.018;
          }
          if (chest) {
            chest.rotation.x = -0.32;
          }
          if (upperChest) {
            upperChest.rotation.x = -0.2;
          }

          // Elbows propped on mattress, hands resting near cheeks / book
          if (leftUpperArm && rightUpperArm) {
            leftUpperArm.rotation.z = -1.05;
            rightUpperArm.rotation.z = 1.05;
            leftUpperArm.rotation.x = -0.68;
            rightUpperArm.rotation.x = -0.68;
            leftUpperArm.rotation.y = 0.25;
            rightUpperArm.rotation.y = -0.25;
          }
          if (leftLowerArm && rightLowerArm) {
            leftLowerArm.rotation.x = -1.15;
            rightLowerArm.rotation.x = -1.15;
            leftLowerArm.rotation.z = -0.28;
            rightLowerArm.rotation.z = 0.28;
          }

          // Legs kicked up in the air with alternating playful kicks!
          const kickSpeed = isCeleb ? 5.2 : 1.7;
          const kickAmp = isCeleb ? 0.34 : 0.22;
          if (leftUpperLeg && rightUpperLeg) {
            leftUpperLeg.rotation.x = -0.08;
            rightUpperLeg.rotation.x = -0.08;
            leftUpperLeg.rotation.z = -0.06;
            rightUpperLeg.rotation.z = 0.06;
          }
          if (leftLowerLeg && rightLowerLeg) {
            leftLowerLeg.rotation.x = 1.48 + Math.sin(elapsed * kickSpeed) * kickAmp;
            rightLowerLeg.rotation.x = 1.48 + Math.sin(elapsed * kickSpeed + 2.1) * kickAmp;
          }

          // Head looks slightly down at book, glancing up toward cursor when moving
          if (neck) {
            neck.rotation.x = -0.25 - smoothLookY * 0.14;
            neck.rotation.y = smoothLookX * 0.18;
          }
          if (head) {
            head.rotation.x = THREE.MathUtils.clamp(-0.18 - smoothLookY * 0.22, -0.55, 0.25);
            head.rotation.y = THREE.MathUtils.clamp(
              Math.sin(elapsed * 0.55) * 0.04 + smoothLookX * 0.28,
              -0.45,
              0.45
            );
            head.rotation.z = Math.sin(elapsed * 0.7) * 0.03 - smoothLookX * 0.05;
          }
        } else if (eyeTrackingRef.current && head) {
          head.rotation.y += smoothLookX * 0.2;
          head.rotation.x -= smoothLookY * 0.14;
        }

        // Blinking & expressions
        blinkTimer += delta;
        let blinkVal = 0;
        if (blinkTimer >= nextBlinkIn) {
          const p = (blinkTimer - nextBlinkIn) / 0.16;
          if (p < 1) blinkVal = Math.sin(p * Math.PI);
          else {
            blinkTimer = 0;
            nextBlinkIn = 2.4 + Math.random() * 3.0;
          }
        }
        currentVrm.expressionManager?.setValue('blink', blinkVal);
        currentVrm.expressionManager?.setValue('happy', isCeleb ? 0.9 : 0.22);
        currentVrm.expressionManager?.setValue('relaxed', isFocusingRef.current ? 0.35 : 0.2);

        currentVrm.update(delta);
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animFrame);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const canvasBg =
    lighting === 'morning'
      ? 'bg-[radial-gradient(ellipse_at_top,_#c7eafc_0%,_#dff5ec_55%,_#fde7ef_100%)]'
      : lighting === 'golden'
        ? 'bg-[radial-gradient(ellipse_at_top,_#fed7aa_0%,_#fde6d8_55%,_#fbcfe8_100%)]'
        : 'bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#151c2c_60%,_#0f1420_100%)]';

  return (
    <section className="cozy-card cozy-card-pink relative flex h-[340px] flex-col overflow-hidden rounded-3xl lg:h-full lg:min-h-[580px]">
      <div ref={containerRef} className={`relative h-full w-full flex-1 ${canvasBg}`}>
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs font-semibold text-[var(--text-muted)]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Setting up Melody&apos;s Study Room...
          </div>
        )}

        {/* Top Floating Status */}
        <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-glass)] px-3 py-1 text-xs font-extrabold text-[var(--text-main)] shadow-xs ring-1 ring-[var(--border-card)] backdrop-blur">
            <BookOpen className="h-3.5 w-3.5 text-[var(--accent)]" />
            Melody&apos;s Study Room
          </span>
          {isFocusing ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pastel-mint)] px-3 py-1 text-xs font-extrabold text-[var(--text-main)] shadow-xs ring-1 ring-[var(--border-card)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {topicLabel?.trim() || 'Studying together'}
            </span>
          ) : (
            <span className="rounded-full bg-[var(--bg-glass)] px-3 py-1 text-[11px] font-bold text-[var(--text-muted)] ring-1 ring-[var(--border-card)] backdrop-blur">
              Reading on bed
            </span>
          )}
        </div>

        {/* Bottom Lighting Preset Switcher */}
        <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-glass)] p-1 shadow-xs backdrop-blur">
            {[
              { id: 'morning' as const, label: 'Morning', icon: Sun },
              { id: 'golden' as const, label: 'Golden', icon: Sunset },
              { id: 'night' as const, label: 'Night', icon: Moon },
            ].map((p) => {
              const Icon = p.icon;
              const active = lighting === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLighting(p.id)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-extrabold transition ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {p.label}
                </button>
              );
            })}
          </div>
          <span className="hidden rounded-full bg-[var(--bg-glass)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)] backdrop-blur sm:inline">
            Drag to orbit · Scroll to zoom
          </span>
        </div>
      </div>
    </section>
  );
}
