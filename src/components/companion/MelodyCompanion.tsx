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
import type { AppTheme, CompanionMood } from '@shared/types';
import { Sparkles, Coffee, BookOpen, PartyPopper } from 'lucide-react';

interface MelodyCompanionProps {
  mood: CompanionMood;
  onMoodChange: (mood: CompanionMood) => void;
  activeActivityLabel?: string | null;
  theme: AppTheme;
  eyeTracking: boolean;
}

const MOOD_OPTIONS: { id: CompanionMood; label: string; icon: typeof Sparkles }[] = [
  { id: 'idle', label: 'Cozy', icon: Sparkles },
  { id: 'focus', label: 'Study', icon: BookOpen },
  { id: 'relax', label: 'Chill', icon: Coffee },
  { id: 'celebrate', label: 'Yay', icon: PartyPopper },
];

const CROSSFADE_SEC = 0.45;

export function MelodyCompanion({
  mood,
  onMoodChange,
  activeActivityLabel,
  theme,
  eyeTracking,
}: MelodyCompanionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const moodRef = useRef<CompanionMood>(mood);
  const eyeTrackingRef = useRef<boolean>(eyeTracking);
  const playMoodAnimRef = useRef<((nextMood: CompanionMood) => void) | null>(null);
  const pointerNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    moodRef.current = mood;
    playMoodAnimRef.current?.(mood);
  }, [mood]);

  useEffect(() => {
    eyeTrackingRef.current = eyeTracking;
  }, [eyeTracking]);

  // Track cursor across the entire window relative to Melody's viewport center
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width * 0.5;
      const centerY = rect.top + rect.height * 0.32; // roughly Melody's eye height
      const nx = THREE.MathUtils.clamp((e.clientX - centerX) / (window.innerWidth * 0.45), -1, 1);
      const ny = THREE.MathUtils.clamp((centerY - e.clientY) / (window.innerHeight * 0.45), -1, 1);
      pointerNormRef.current = { x: nx, y: ny };
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

    const width = container.clientWidth || 340;
    const height = container.clientHeight || 480;

    const scene = new THREE.Scene();

    // Full-panel framing with head-anchored zoom
    const camera = new THREE.PerspectiveCamera(26, width / height, 0.1, 20);
    const minDistance = 0.72;
    const maxDistance = 2.6;
    const headTopY = 1.62;

    camera.position.set(0, 1.32, 1.55);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.24, 0);
    controls.enablePan = false;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.minPolarAngle = Math.PI * 0.25;
    controls.maxPolarAngle = Math.PI * 0.62;
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.update();

    // Soft daylight + cozy warm rim lighting
    const ambient = new THREE.AmbientLight(0xfaf7f2, 0.9);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 1.3);
    keyLight.position.set(1.6, 2.4, 2.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xbbe6f7, 0.7);
    rimLight.position.set(-1.8, 1.8, -1.5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xfde68a, 0.28, 6);
    fillLight.position.set(0, 1.0, 1.5);
    scene.add(fillLight);

    // LookAt target for VRM eye tracking
    const lookAtTarget = new THREE.Object3D();
    lookAtTarget.position.set(0, 1.45, 2.0);
    scene.add(lookAtTarget);

    let currentVrm: VRM | null = null;
    let mixer: THREE.AnimationMixer | null = null;
    let activeAction: THREE.AnimationAction | null = null;
    const actionsByMood = new Map<CompanionMood, THREE.AnimationAction>();

    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

    const playMoodAnimation = (nextMood: CompanionMood) => {
      const nextAction = actionsByMood.get(nextMood) ?? actionsByMood.get('idle') ?? null;
      if (!nextAction) {
        if (activeAction) {
          activeAction.fadeOut(CROSSFADE_SEC);
          activeAction = null;
        }
        return;
      }
      if (activeAction === nextAction) return;

      nextAction.reset();
      nextAction.setEffectiveWeight(1);
      nextAction.play();

      if (activeAction) {
        activeAction.crossFadeTo(nextAction, CROSSFADE_SEC, true);
      } else {
        nextAction.fadeIn(CROSSFADE_SEC);
      }
      activeAction = nextAction;
    };

    playMoodAnimRef.current = playMoodAnimation;

    const preloadVrmaAnimations = async (vrm: VRM) => {
      mixer = new THREE.AnimationMixer(vrm.scene);
      const moods: CompanionMood[] = ['idle', 'focus', 'relax', 'celebrate'];

      await Promise.all(
        moods.map(async (m) => {
          const url = `/animations/${m}.vrma`;
          try {
            const head = await fetch(url, { method: 'HEAD' });
            if (!head.ok) return;
            const gltf = await loader.loadAsync(url);
            const vrmAnimations = gltf.userData.vrmAnimations as VRMAnimation[] | undefined;
            if (!vrmAnimations || vrmAnimations.length === 0 || !mixer) return;
            const clip = createVRMAnimationClip(vrmAnimations[0], vrm);
            const action = mixer.clipAction(clip);
            action.loop = THREE.LoopRepeat;
            actionsByMood.set(m, action);
          } catch {
            // Optional animation file not present; procedural idle handles it
          }
        })
      );

      if (actionsByMood.size > 0) {
        playMoodAnimation(moodRef.current);
      }
    };

    loader.load(
      '/models/Melody.vrm',
      (gltf) => {
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

        scene.add(vrm.scene);
        currentVrm = vrm;

        // Relax arms down from T-pose immediately
        const leftUpperArm = vrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
        const rightUpperArm = vrm.humanoid?.getNormalizedBoneNode('rightUpperArm');
        const leftLowerArm = vrm.humanoid?.getNormalizedBoneNode('leftLowerArm');
        const rightLowerArm = vrm.humanoid?.getNormalizedBoneNode('rightLowerArm');
        if (leftUpperArm) leftUpperArm.rotation.z = -1.15;
        if (rightUpperArm) rightUpperArm.rotation.z = 1.15;
        if (leftLowerArm) leftLowerArm.rotation.z = -0.15;
        if (rightLowerArm) rightLowerArm.rotation.z = 0.15;

        void preloadVrmaAnimations(vrm);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error('Failed to load Melody.vrm:', err);
        setError('Could not load Melody.vrm');
        setLoading(false);
      }
    );

    const clock = new THREE.Clock();
    let blinkTimer = 0;
    let nextBlinkIn = 2.6;
    let smoothLookX = 0;
    let smoothLookY = 0;
    let animFrame = 0;

    const animate = () => {
      animFrame = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (mixer && activeAction) {
        mixer.update(delta);
      }

      // Smoothly damp pointer tracking values
      const targetX = eyeTrackingRef.current ? pointerNormRef.current.x : 0;
      const targetY = eyeTrackingRef.current ? pointerNormRef.current.y : 0;
      const lerpAlpha = Math.min(1, delta * 6.5);
      smoothLookX += (targetX - smoothLookX) * lerpAlpha;
      smoothLookY += (targetY - smoothLookY) * lerpAlpha;

      // Update VRM eye lookAt target in 3D space
      lookAtTarget.position.set(smoothLookX * 1.4, 1.45 + smoothLookY * 0.9, 2.0);

      if (currentVrm) {
        const currentMood = moodRef.current;
        const head = currentVrm.humanoid?.getNormalizedBoneNode('head');
        const neck = currentVrm.humanoid?.getNormalizedBoneNode('neck');

        if (!activeAction) {
          const spine = currentVrm.humanoid?.getNormalizedBoneNode('spine');
          const leftUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('leftUpperArm');
          const rightUpperArm = currentVrm.humanoid?.getNormalizedBoneNode('rightUpperArm');

          if (spine) {
            spine.rotation.x =
              Math.sin(elapsed * 1.6) * 0.018 + (currentMood === 'focus' ? 0.045 : 0);
            spine.rotation.y = Math.sin(elapsed * 0.7) * 0.025 + smoothLookX * 0.05;
          }
          if (neck) {
            neck.rotation.y = smoothLookX * 0.16;
            neck.rotation.x = -smoothLookY * 0.1;
          }
          if (head) {
            const idleYaw = Math.sin(elapsed * 0.85) * 0.03;
            const idlePitch = currentMood === 'focus' ? 0.06 : Math.sin(elapsed * 1.1) * 0.015;
            head.rotation.y = THREE.MathUtils.clamp(idleYaw + smoothLookX * 0.28, -0.42, 0.42);
            head.rotation.x = THREE.MathUtils.clamp(idlePitch - smoothLookY * 0.2, -0.28, 0.28);
            head.rotation.z =
              Math.sin(elapsed * 0.55) * 0.025 +
              (currentMood === 'relax' ? 0.05 : 0) -
              smoothLookX * 0.06;
          }
          if (leftUpperArm && rightUpperArm) {
            const armBase = currentMood === 'celebrate' ? -0.35 : -1.15;
            const wave =
              currentMood === 'celebrate'
                ? Math.sin(elapsed * 6) * 0.18
                : Math.sin(elapsed * 1.4) * 0.025;
            leftUpperArm.rotation.z = armBase + wave;
            rightUpperArm.rotation.z = -armBase - wave;
          }
        } else if (eyeTrackingRef.current && head) {
          // Subtle additive head glance even during custom .vrma animations
          head.rotation.y += smoothLookX * 0.2;
          head.rotation.x -= smoothLookY * 0.12;
        }

        // Natural blinking & facial expressions
        blinkTimer += delta;
        let blinkVal = 0;
        if (blinkTimer >= nextBlinkIn) {
          const blinkPhase = (blinkTimer - nextBlinkIn) / 0.16;
          if (blinkPhase < 1) {
            blinkVal = Math.sin(blinkPhase * Math.PI);
          } else {
            blinkTimer = 0;
            nextBlinkIn = 2.2 + Math.random() * 3.2;
          }
        }
        currentVrm.expressionManager?.setValue('blink', blinkVal);
        currentVrm.expressionManager?.setValue(
          'happy',
          currentMood === 'celebrate' ? 0.85 : currentMood === 'relax' ? 0.35 : 0.15
        );
        currentVrm.expressionManager?.setValue('relaxed', currentMood === 'relax' ? 0.5 : 0);

        currentVrm.update(delta);
      }

      // Keep Melody's head anchored near the top of the frame as you zoom in/out
      const dist = camera.position.distanceTo(controls.target);
      const halfHeightAtDist = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * dist;
      const desiredTargetY = THREE.MathUtils.clamp(headTopY - halfHeightAtDist * 0.82, 0.88, 1.5);
      controls.target.y += (desiredTargetY - controls.target.y) * 0.14;

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
      playMoodAnimRef.current = null;
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const viewportBg =
    theme === 'pastel'
      ? 'bg-[radial-gradient(ellipse_at_top,_#e0f4fc_0%,_#eef7f3_55%,_#fdf6ec_100%)]'
      : 'bg-[radial-gradient(ellipse_at_top,_rgba(125,211,252,0.14),_rgba(28,27,26,0.95)_65%,_rgba(18,18,17,1)_100%)]';

  return (
    <aside className="cozy-card relative flex h-full flex-col overflow-hidden rounded-3xl">
      {/* Full-panel 3D Viewport */}
      <div ref={containerRef} className={`relative h-full w-full flex-1 ${viewportBg}`}>
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
            Loading Melody.vrm...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-rose-500">
            {error}
          </div>
        )}

        {/* Floating status pill */}
        <div className="pointer-events-none absolute top-3 right-3 left-3 flex items-center justify-between">
          <span className="rounded-full bg-[var(--bg-glass)] px-3 py-1 text-xs font-semibold text-[var(--text-main)] shadow-sm ring-1 ring-[var(--border-card)] backdrop-blur">
            Melody
          </span>
          {activeActivityLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--pastel-mint)] px-3 py-1 text-xs font-semibold text-[var(--text-main)] shadow-sm ring-1 ring-[var(--border-card)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              {activeActivityLabel}
            </span>
          ) : (
            <span className="rounded-full bg-[var(--bg-glass)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)] ring-1 ring-[var(--border-card)] backdrop-blur">
              Chilling
            </span>
          )}
        </div>

        {/* Floating Mood / Pose Selector */}
        <div className="absolute right-3 bottom-3 left-3 grid grid-cols-4 gap-1 rounded-2xl border border-[var(--border-card)] bg-[var(--bg-glass)] p-1.5 shadow-sm backdrop-blur">
          {MOOD_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = mood === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onMoodChange(opt.id)}
                className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-main)]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
