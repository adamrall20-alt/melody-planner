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
    camera.position.set(1.55, 1.42, 1.98);

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
    controls.target.set(0, 0.78, 0.12);
    controls.enablePan = false;
    controls.minDistance = 1.1;
    controls.maxDistance = 3.5;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minAzimuthAngle = -Math.PI * 0.45;
    controls.maxAzimuthAngle = Math.PI * 0.48;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.update();

    // ─── Lights (dynamically tinted by Morning / Golden / Night preset) ───────
    const ambient = new THREE.AmbientLight(0xfff7ed, 0.88);
    scene.add(ambient);

    const sunLight = new THREE.DirectionalLight(0xfff1dc, 1.35);
    sunLight.position.set(2.8, 3.8, 2.4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    scene.add(sunLight);

    const lampLight = new THREE.PointLight(0xffd28a, 1.2, 5.5);
    lampLight.position.set(-1.18, 1.12, -0.88);
    scene.add(lampLight);

    const rimLight = new THREE.DirectionalLight(0xbbe6f7, 0.55);
    rimLight.position.set(-2.2, 2.0, -1.6);
    scene.add(rimLight);

    // References to dynamic materials inside study-room.glb
    let lampShadeMat: THREE.MeshStandardMaterial | null = null;
    let windowSkyMat: THREE.MeshStandardMaterial | null = null;

    // Animated Turning Page Pivot resting on top of the Blender book
    const turnPagePivot = new THREE.Group();
    turnPagePivot.position.set(0, 0.625, 0.52);
    turnPagePivot.rotation.y = Math.PI;
    scene.add(turnPagePivot);
    const turningPage = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.004, 0.29),
      new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.9 })
    );
    turningPage.position.set(0.105, 0, 0);
    turningPage.visible = false;
    turnPagePivot.add(turningPage);

    // LookAt Target for Eye Tracking
    const lookAtTarget = new THREE.Object3D();
    lookAtTarget.position.set(0, 0.9, 1.5);
    scene.add(lookAtTarget);

    // ─── Load Blender Textured Bedroom GLB + Melody.vrm ───────────────────────
    let currentVrm: VRM | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let hasCustomBedAnim = false;

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    // Load textured Blender bedroom
    loader.load(
      '/models/study-room.glb',
      (roomGltf) => {
        roomGltf.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.receiveShadow = true;
            if (!['Floor', 'BackWall', 'LeftWall', 'Rug', 'WindowGlass'].includes(mesh.name)) {
              mesh.castShadow = true;
            }
            if (mesh.name === 'LampShade' && mesh.material instanceof THREE.MeshStandardMaterial) {
              lampShadeMat = mesh.material;
            }
            if (mesh.name === 'WindowGlass' && mesh.material instanceof THREE.MeshStandardMaterial) {
              windowSkyMat = mesh.material;
            }
          }
        });
        scene.add(roomGltf.scene);
      },
      undefined,
      (err) => console.error('Failed to load study-room.glb:', err)
    );

    // Load Melody.vrm
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

        // Rest Melody flush on top of the quilted duvet (duvet top y ≈ 0.58)
        vrm.scene.position.set(0, 0.635, -0.22);
        scene.add(vrm.scene);
        currentVrm = vrm;

        // Optional custom Blender study_bed.vrma override
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
          // Use procedural stomach-down chin-in-hands pose below
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

      // Update lighting preset
      const mode = lightingRef.current;
      if (mode === 'morning') {
        ambient.color.setHex(0xfff8f0);
        ambient.intensity = 0.95;
        sunLight.color.setHex(0xfff4e0);
        sunLight.intensity = 1.35;
        lampLight.intensity = 0.45;
        if (lampShadeMat) lampShadeMat.emissiveIntensity = 0.25;
        if (windowSkyMat) windowSkyMat.color.setHex(0xbce6fb);
      } else if (mode === 'golden') {
        ambient.color.setHex(0xffdfc2);
        ambient.intensity = 0.85;
        sunLight.color.setHex(0xffb470);
        sunLight.intensity = 1.45;
        lampLight.intensity = 1.25;
        if (lampShadeMat) lampShadeMat.emissiveIntensity = 0.75;
        if (windowSkyMat) windowSkyMat.color.setHex(0xfdba8c);
      } else {
        ambient.color.setHex(0x8aa4c8);
        ambient.intensity = 0.52;
        sunLight.color.setHex(0x9ec5fe);
        sunLight.intensity = 0.42;
        lampLight.intensity = 2.1;
        if (lampShadeMat) lampShadeMat.emissiveIntensity = 1.25;
        if (windowSkyMat) windowSkyMat.color.setHex(0x1e2942);
      }

      // Subtle page-turn animation while focusing
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

      lookAtTarget.position.set(smoothLookX * 1.3, 0.92 + smoothLookY * 0.75, 1.7);

      if (currentVrm) {
        const isCeleb = celebratingRef.current;
        const head = currentVrm.humanoid?.getNormalizedBoneNode('head');
        const neck = currentVrm.humanoid?.getNormalizedBoneNode('neck');

        if (!hasCustomBedAnim) {
          const hips = currentVrm.humanoid?.getNormalizedBoneNode('hips');
          const spine = currentVrm.humanoid?.getNormalizedBoneNode('spine');
          const chest = currentVrm.humanoid?.getNormalizedBoneNode('chest');
          const upperChest = currentVrm.humanoid?.getNormalizedBoneNode('upperChest');
          const leftShoulder = currentVrm.humanoid?.getNormalizedBoneNode('leftShoulder');
          const rightShoulder = currentVrm.humanoid?.getNormalizedBoneNode('rightShoulder');
          const leftUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
          const leftLowerArm = currentVrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
          const rightLowerArm = currentVrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
          const leftHand = currentVrm.humanoid?.getNormalizedBoneNode('leftHand');
          const rightHand = currentVrm.humanoid?.getNormalizedBoneNode('rightHand');
          const leftUpperLeg = currentVrm.humanoid?.getNormalizedBoneNode('leftUpperLeg');
          const rightUpperLeg = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperLeg');
          const leftLowerLeg = currentVrm.humanoid?.getNormalizedBoneNode('leftLowerLeg');
          const rightLowerLeg = currentVrm.humanoid?.getNormalizedBoneNode('rightLowerLeg');

          if (hips) {
            hips.position.y = -0.02;
            hips.rotation.x = 1.52;
            hips.rotation.y = 0;
            hips.rotation.z = Math.sin(elapsed * 0.9) * 0.015;
          }
          // Arch upper torso gently off the duvet
          if (spine) spine.rotation.x = -0.34 + Math.sin(elapsed * 1.5) * 0.015;
          if (chest) chest.rotation.x = -0.32;
          if (upperChest) upperChest.rotation.x = -0.2;

          // Chin-in-hands pose: elbows resting on duvet, forearms bent up, softly cupped hands under cheeks/chin
          if (leftShoulder && rightShoulder) {
            leftShoulder.rotation.set(0.12, -0.22, 0.14);
            rightShoulder.rotation.set(0.12, 0.22, -0.14);
          }
          if (leftUpperArm && rightUpperArm) {
            // Elbows resting on the duvet right underneath her cheeks
            leftUpperArm.rotation.set(-0.76, -0.24, -1.16);
            rightUpperArm.rotation.set(-0.76, 0.24, 1.16);
          }
          if (leftLowerArm && rightLowerArm) {
            // Forearms bent up so wrists/cupped palms sit right UNDER her chin/cheeks (face clearly visible!)
            leftLowerArm.rotation.set(-0.16, -2.18, 0.22);
            rightLowerArm.rotation.set(-0.16, 2.18, -0.22);
          }
          if (leftHand && rightHand) {
            leftHand.rotation.set(0.12, 0.28, -0.42);
            rightHand.rotation.set(0.12, -0.28, 0.42);
          }

          // Softly curl fingers into cozy cupped hands cradling her cheeks/chin
          const curlFinger = (side: 'left' | 'right', bone: string, angle: number) => {
            const node = currentVrm?.humanoid?.getNormalizedBoneNode(
              `${side}${bone}` as Parameters<NonNullable<VRM['humanoid']>['getNormalizedBoneNode']>[0]
            );
            if (node) node.rotation.z = side === 'left' ? -angle : angle;
          };
          for (const side of ['left', 'right'] as const) {
            for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
              curlFinger(side, `${f}Proximal`, 0.72);
              curlFinger(side, `${f}Intermediate`, 0.85);
            }
          }

          // Keep legs the exact same — kicked playfully in the air!
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

          // Head resting gently in hands, glancing toward cursor when moving
          if (neck) {
            neck.rotation.x = -0.12 - smoothLookY * 0.1;
            neck.rotation.y = smoothLookX * 0.14;
          }
          if (head) {
            head.rotation.x = THREE.MathUtils.clamp(-0.04 - smoothLookY * 0.15, -0.38, 0.22);
            head.rotation.y = THREE.MathUtils.clamp(
              Math.sin(elapsed * 0.55) * 0.025 + smoothLookX * 0.2,
              -0.34,
              0.34
            );
            head.rotation.z = Math.sin(elapsed * 0.7) * 0.02 - smoothLookX * 0.03;
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
        currentVrm.expressionManager?.setValue('happy', isCeleb ? 0.9 : 0.25);
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
