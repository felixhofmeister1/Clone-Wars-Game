# Echoes in the Drywall (UE5 C++)

Core gameplay systems for a first-person psychological horror game, written as a
self-contained Unreal Engine 5 C++ project (`EngineAssociation` 5.4; any UE 5.1+ should work,
right-click the `.uproject` > *Switch Unreal Engine version* to change it).

## Module

`Source/EchoesInTheDrywall/EchoesInTheDrywall.Build.cs` depends on
`Core`, `CoreUObject`, `Engine`, `InputCore`, `EnhancedInput` and `AudioExtensions`.
All gameplay logs go to the `LogEchoes` category.

```
Source/EchoesInTheDrywall/
  Public/  Characters/EchoPlayerCharacter.h     Private/  Characters/EchoPlayerCharacter.cpp
           Components/BreathingComponent.h                Components/BreathingComponent.cpp
           Environment/NonEuclideanShiftTrigger.h         Environment/NonEuclideanShiftTrigger.cpp
           Audio/HorrorAudioManager.h                     Audio/HorrorAudioManager.cpp
```

## Systems

### `AEchoPlayerCharacter` (ACharacter)
- First-person `UCameraComponent` plus a `USpotLightComponent` flashlight attached to it.
- Enhanced Input: `MoveAction`, `LookAction`, `FlashlightAction`, optional `HoldBreathAction`,
  mapped through `DefaultMappingContext`. The context is added in `PawnClientRestart` and
  removed in `UnPossessed`, so it works whenever the pawn is (re)possessed.
- Battery: `MaxBatterySeconds` of light, drained per second while on. When the charge runs out
  the light switches itself off and `OnFlashlightBatteryDepleted` fires. `AddBatteryCharge`
  handles pickups.
- Flicker: two octaves of `FMath::PerlinNoise1D`. A healthy battery gives a ±5% shimmer. Below
  `LowBatteryThreshold` the flicker gets faster and deeper, the beam dims, and near-blackout
  dropouts become more frequent (about 10% of frames on an empty battery).
- Getters: `GetBatteryPercentage()` (0-100), `GetBatteryFraction()` (0-1),
  `GetRemainingBatterySeconds()`, `IsFlashlightOn()`, `IsBatteryLow()`.
- Owns a `UBreathingComponent`; the hold-breath action drives it.

### `UBreathingComponent` (UActorComponent)
- Panic from 0 to 100. It decays after `PanicDecayDelay` and never drops below `PanicFloor`.
  `OnPanicChanged` fires on every change.
- `StartHoldingBreath` / `StopHoldingBreath`. While the breath is held the noise multiplier drops
  to 0.1 (`GetNoiseMultiplier` is for footstep and AI-hearing code) and breath capacity drains.
- `OnForcedGasp(Reason, Panic)` fires in two cases:
  - **BreathExhausted**: the breath was held past `MaxBreathHoldDuration` (6.0 s for a calm
    player; panic drains the breath faster, so at 100 panic it lasts 4 s).
  - **PanickedRelease**: the breath was released while panic was at or above `HighPanicThreshold`.
- A gasp adds `ForcedGaspPanicSpike` to panic, plays `GaspSound`, reports an AI noise through
  `AActor::MakeNoise` (AI Perception hearing picks it up), and blocks new holds for
  `GaspRecoveryDuration`.

### `ANonEuclideanShiftTrigger` (AActor, `UBoxComponent` root)
- Tracks the locally controlled player inside the box and compares the camera's forward vector
  with the direction to the focus point. When `Dot < BackTurnedDotThreshold` (-0.7, about 135°)
  it hides and disables collision on `ActorsToDisable` and reveals `ActorsToEnable`.
- `ActorsToEnable` / `ActorsToDisable` are `TArray<TWeakObjectPtr<AActor>>` set in the Details
  panel. By default `ActorsToEnable` is hidden at BeginPlay, so both layouts can be built in place.
- Drag the `ShiftFocusOffset` widget in the viewport onto the space that changes. It defaults to
  the trigger's own location.
- Safeguards so the swap is never witnessed:
  - The trigger arms only after the player has looked at the focus.
  - Yaw-only comparison, so looking at the floor never counts as turning around.
  - The swap waits while any affected actor is still on screen (`WasRecentlyRendered`).
- Set `bTriggerOnce = false` for looping corridors: every look-back-then-turn flips the layout.
- `TriggerShift()`, `ResetShift()` and `OnEnvironmentShifted` are available to Blueprint and
  Sequencer. `bDrawDebug` shows the live dot product and angle.

### `AHorrorAudioManager` (AActor)
- A `UAudioComponent` plays the non-spatialized low-frequency drone and fades it in at BeginPlay.
- A looping `FTimerHandle` (period `EventInterval` ± `EventIntervalJitter`, fires with probability
  `EventChance`) works out a point 3.5 m directly behind the player's actor transform and plays a
  random entry from `BehindPlayerSounds` there with `UGameplayStatics::PlaySoundAtLocation`.
- At the same moment the drone fades (`AdjustVolume`, so the loop keeps running) to 0.0, holds
  absolute silence for 4.5 s, then swells back. An optional `SilenceSoundMix` is pushed for the
  silence window, and every timer and mix is cleaned up in `EndPlay`.

## Editor setup

1. Open `EchoesInTheDrywall.uproject` and let it build the module (or generate project files
   and build the `EchoesInTheDrywallEditor` target).
2. Create the input assets:
   - `IA_Move`: Axis2D. `IMC_Default`: W (Swizzle YXZ), S (Swizzle YXZ + Negate),
     D, A (Negate), gamepad left stick.
   - `IA_Look`: Axis2D. Mouse XY (Negate Y), gamepad right stick.
   - `IA_Flashlight`: Digital. F, gamepad face button.
   - `IA_HoldBreath`: Digital. Left Alt, gamepad shoulder.
3. Create `BP_EchoPlayer` from `EchoPlayerCharacter` and assign the mapping context and actions.
   Then set it as the Default Pawn in a GameMode and pick that GameMode in World Settings.
4. Place one `HorrorAudioManager` per level. Assign a looping drone, one-shot
   `BehindPlayerSounds`, and a `BehindPlayerAttenuation` asset; without attenuation the sound
   plays in 2D and the "behind you" effect is lost. For a seamless drone resume, set the drone
   asset's *Virtualization Mode* to *Play When Silent*.
5. Place `NonEuclideanShiftTrigger` volumes and fill their actor lists with actors from the same
   level.

`Config/DefaultEngine.ini` turns auto exposure off so unlit rooms stay dark and the flashlight
matters.
