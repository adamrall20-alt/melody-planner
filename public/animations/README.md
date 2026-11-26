# Melody Custom Blender Animations (`.vrma`)

Drop your exported VRM Animation (`.vrma`) files right into this folder (`public/animations/`) and Melody will automatically load them and **smoothly cross-fade** between moods!

## Expected Filenames
- `idle.vrma` — Cozy default idle loop
- `focus.vrma` — Studying / typing / reading loop (triggered when you start a timer or Study session)
- `relax.vrma` — Chilling / break loop
- `celebrate.vrma` — Happy celebration loop (triggered when you complete a task or Pomodoro)

## How to Export from Blender
1. Install the free **VRM Add-on for Blender** (`VRM-Addon-for-Blender`).
2. Import `Melody.vrm` via `File → Import → VRM (.vrm)`.
3. Animate the armature in Pose Mode.
4. Export via `File → Export → VRM Animation (.vrma)` and save into `public/animations/` using one of the names above.

Any mood without a `.vrma` file gracefully falls back to Melody's built-in procedural breathing & blinking animation.
