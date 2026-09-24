// Copyright Echoes in the Drywall. All Rights Reserved.

#include "Characters/EchoPlayerCharacter.h"

#include "Camera/CameraComponent.h"
#include "Components/BreathingComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SpotLightComponent.h"
#include "EchoesInTheDrywall.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "Engine/LocalPlayer.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "InputAction.h"
#include "InputActionValue.h"
#include "InputMappingContext.h"
#include "Kismet/GameplayStatics.h"
#include "Sound/SoundBase.h"

namespace EchoFlashlight
{
	/** FMath::PerlinNoise1D repeats every 256 units, so the noise clock can wrap there seamlessly. */
	constexpr float NoisePeriod = 256.0f;

	/** Brightness left in the bulb during a low-battery dropout. */
	constexpr float DropoutBrightness = 0.05f;
}

AEchoPlayerCharacter::AEchoPlayerCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = true;

	UCapsuleComponent* Capsule = GetCapsuleComponent();
	if (Capsule)
	{
		Capsule->InitCapsuleSize(42.0f, 96.0f);
	}

	// First person: the body yaws with the controller, the camera carries the pitch.
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = true;
	bUseControllerRotationRoll = false;

	if (UCharacterMovementComponent* MoveComp = GetCharacterMovement())
	{
		MoveComp->bOrientRotationToMovement = false;
		MoveComp->MaxWalkSpeed = 300.0f; // Deliberate, vulnerable pace.
		MoveComp->BrakingDecelerationWalking = 1600.0f;
	}

	FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
	FirstPersonCamera->SetupAttachment(Capsule);
	FirstPersonCamera->SetRelativeLocation(FVector(0.0f, 0.0f, BaseEyeHeight));
	FirstPersonCamera->bUsePawnControlRotation = true;

	Flashlight = CreateDefaultSubobject<USpotLightComponent>(TEXT("Flashlight"));
	Flashlight->SetupAttachment(FirstPersonCamera);
	// Held a little right of and below the eyes so the beam edge and its shadows read as hand-held.
	Flashlight->SetRelativeLocation(FVector(10.0f, 14.0f, -12.0f));
	Flashlight->SetMobility(EComponentMobility::Movable);
	Flashlight->IntensityUnits = ELightUnits::Candelas;
	Flashlight->Intensity = FlashlightBaseIntensity;
	Flashlight->AttenuationRadius = 2400.0f;
	Flashlight->InnerConeAngle = 14.0f;
	Flashlight->OuterConeAngle = 30.0f;
	Flashlight->bUseTemperature = true;
	Flashlight->Temperature = 4300.0f; // Warm, slightly failing incandescent bulb.
	Flashlight->CastShadows = true;

	Breathing = CreateDefaultSubobject<UBreathingComponent>(TEXT("Breathing"));
}

void AEchoPlayerCharacter::BeginPlay()
{
	Super::BeginPlay();

	CurrentBatterySeconds = MaxBatterySeconds * FMath::Clamp(InitialBatteryFraction, 0.0f, 1.0f);

	// Random phase so the flicker pattern differs every session.
	FlickerNoiseTime = FMath::FRandRange(0.0f, EchoFlashlight::NoisePeriod);

	if (!Flashlight)
	{
		UE_LOG(LogEchoes, Error, TEXT("%s: Flashlight component is missing; flashlight disabled."), *GetName());
		return;
	}

	// The light is visible by default so it can be previewed in the editor; sync it to gameplay state.
	bFlashlightOn = false;
	Flashlight->SetVisibility(false);

	if (bStartWithFlashlightOn && (bInfiniteBattery || CurrentBatterySeconds > 0.0f))
	{
		ApplyFlashlightState(true);
	}
}

void AEchoPlayerCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!bFlashlightOn)
	{
		return;
	}

	DrainBattery(DeltaSeconds);

	// The battery may have died during this frame's drain.
	if (bFlashlightOn)
	{
		UpdateFlashlightFlicker(DeltaSeconds);
	}
}

void AEchoPlayerCharacter::PawnClientRestart()
{
	Super::PawnClientRestart();

	// Runs on the owning client whenever this pawn is (re)possessed, so the context is always
	// registered even if possession happens after BeginPlay.
	AddInputMappingContext();
}

void AEchoPlayerCharacter::UnPossessed()
{
	// Controller is still valid until Super clears it.
	RemoveInputMappingContext();

	Super::UnPossessed();
}

void AEchoPlayerCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	UEnhancedInputComponent* EnhancedInput = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!EnhancedInput)
	{
		UE_LOG(LogEchoes, Error,
			TEXT("%s: input component is not a UEnhancedInputComponent. Set Default Input Component Class to EnhancedInputComponent in Project Settings > Input."),
			*GetName());
		return;
	}

	if (MoveAction)
	{
		EnhancedInput->BindAction(MoveAction, ETriggerEvent::Triggered, this, &ThisClass::Move);
	}
	else
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: MoveAction is not assigned."), *GetName());
	}

	if (LookAction)
	{
		EnhancedInput->BindAction(LookAction, ETriggerEvent::Triggered, this, &ThisClass::Look);
	}
	else
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: LookAction is not assigned."), *GetName());
	}

	if (FlashlightAction)
	{
		EnhancedInput->BindAction(FlashlightAction, ETriggerEvent::Started, this, &ThisClass::HandleFlashlightInput);
	}
	else
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: FlashlightAction is not assigned."), *GetName());
	}

	// Optional: breathing still works from Blueprint/AI without a bound action.
	if (HoldBreathAction)
	{
		EnhancedInput->BindAction(HoldBreathAction, ETriggerEvent::Started, this, &ThisClass::HandleHoldBreathStarted);
		EnhancedInput->BindAction(HoldBreathAction, ETriggerEvent::Completed, this, &ThisClass::HandleHoldBreathReleased);
		EnhancedInput->BindAction(HoldBreathAction, ETriggerEvent::Canceled, this, &ThisClass::HandleHoldBreathReleased);
	}
}

bool AEchoPlayerCharacter::ToggleFlashlight()
{
	SetFlashlightEnabled(!bFlashlightOn);
	return bFlashlightOn;
}

bool AEchoPlayerCharacter::SetFlashlightEnabled(bool bEnable)
{
	if (!Flashlight)
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: SetFlashlightEnabled called without a Flashlight component."), *GetName());
		return false;
	}

	if (bEnable == bFlashlightOn)
	{
		return true;
	}

	// The switch clicks even when the battery is dead; that hollow click is part of the scare.
	PlayFlashlightClick();

	if (bEnable && !bInfiniteBattery && CurrentBatterySeconds <= 0.0f)
	{
		return false;
	}

	ApplyFlashlightState(bEnable);
	return true;
}

float AEchoPlayerCharacter::AddBatteryCharge(float SecondsToAdd)
{
	if (SecondsToAdd <= 0.0f)
	{
		return 0.0f;
	}

	const float Previous = CurrentBatterySeconds;
	CurrentBatterySeconds = FMath::Min(MaxBatterySeconds, CurrentBatterySeconds + SecondsToAdd);
	return CurrentBatterySeconds - Previous;
}

float AEchoPlayerCharacter::GetBatteryFraction() const
{
	return MaxBatterySeconds > 0.0f
		? FMath::Clamp(CurrentBatterySeconds / MaxBatterySeconds, 0.0f, 1.0f)
		: 0.0f;
}

void AEchoPlayerCharacter::Move(const FInputActionValue& Value)
{
	const FVector2D MoveInput = Value.Get<FVector2D>();
	if (MoveInput.IsNearlyZero())
	{
		return;
	}

	AddMovementInput(GetActorForwardVector(), static_cast<float>(MoveInput.Y));
	AddMovementInput(GetActorRightVector(), static_cast<float>(MoveInput.X));
}

void AEchoPlayerCharacter::Look(const FInputActionValue& Value)
{
	const FVector2D LookInput = Value.Get<FVector2D>();

	AddControllerYawInput(static_cast<float>(LookInput.X) * LookSensitivity);
	AddControllerPitchInput(static_cast<float>(LookInput.Y) * LookSensitivity);
}

void AEchoPlayerCharacter::HandleFlashlightInput()
{
	ToggleFlashlight();
}

void AEchoPlayerCharacter::HandleHoldBreathStarted()
{
	if (Breathing)
	{
		Breathing->StartHoldingBreath();
	}
}

void AEchoPlayerCharacter::HandleHoldBreathReleased()
{
	if (Breathing)
	{
		Breathing->StopHoldingBreath();
	}
}

void AEchoPlayerCharacter::AddInputMappingContext() const
{
	if (!DefaultMappingContext)
	{
		UE_LOG(LogEchoes, Warning, TEXT("%s: DefaultMappingContext is not assigned; player input will not work."), *GetName());
		return;
	}

	const APlayerController* PlayerController = Cast<APlayerController>(GetController());
	if (!PlayerController)
	{
		return;
	}

	if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PlayerController->GetLocalPlayer()))
	{
		Subsystem->AddMappingContext(DefaultMappingContext, MappingContextPriority);
	}
}

void AEchoPlayerCharacter::RemoveInputMappingContext() const
{
	if (!DefaultMappingContext)
	{
		return;
	}

	const APlayerController* PlayerController = Cast<APlayerController>(GetController());
	if (!PlayerController)
	{
		return;
	}

	if (UEnhancedInputLocalPlayerSubsystem* Subsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PlayerController->GetLocalPlayer()))
	{
		Subsystem->RemoveMappingContext(DefaultMappingContext);
	}
}

void AEchoPlayerCharacter::ApplyFlashlightState(bool bOn)
{
	bFlashlightOn = bOn;

	if (Flashlight)
	{
		if (bOn)
		{
			// Set a valid intensity before the first visible frame.
			UpdateFlashlightFlicker(0.0f);
		}
		Flashlight->SetVisibility(bOn);
	}

	OnFlashlightToggled.Broadcast(bFlashlightOn);
}

void AEchoPlayerCharacter::DrainBattery(float DeltaSeconds)
{
	if (bInfiniteBattery || BatteryDrainRate <= 0.0f)
	{
		return;
	}

	CurrentBatterySeconds = FMath::Max(0.0f, CurrentBatterySeconds - DeltaSeconds * BatteryDrainRate);
	if (CurrentBatterySeconds > 0.0f)
	{
		return;
	}

	// The bulb dies on its own: no click, just darkness.
	ApplyFlashlightState(false);
	UE_LOG(LogEchoes, Log, TEXT("%s: flashlight battery depleted."), *GetName());
	OnFlashlightBatteryDepleted.Broadcast();
}

void AEchoPlayerCharacter::UpdateFlashlightFlicker(float DeltaSeconds)
{
	if (!Flashlight)
	{
		return;
	}

	const float Charge = bInfiniteBattery ? 1.0f : GetBatteryFraction();

	// 0 while the battery is healthy, easing to 1 as the charge falls from LowBatteryThreshold to empty.
	const float LowBatteryAlpha = 1.0f - FMath::SmoothStep(0.0f, LowBatteryThreshold, Charge);

	const float Speed = FMath::Lerp(FlickerSpeed, LowBatteryFlickerSpeed, LowBatteryAlpha);
	const float Amplitude = FMath::Lerp(FlickerAmplitude, LowBatteryFlickerAmplitude, LowBatteryAlpha);

	// Advance by speed (not time * speed) so a changing speed never jumps the pattern. Wrapping at the
	// noise period keeps float precision in long sessions without a seam; the second octave uses an
	// integer frequency multiple so it wraps cleanly too.
	FlickerNoiseTime = FMath::Fmod(FlickerNoiseTime + DeltaSeconds * Speed, EchoFlashlight::NoisePeriod);

	// Two octaves of 1D Perlin noise, roughly in [-1, 1].
	const float Noise = 0.7f * FMath::PerlinNoise1D(FlickerNoiseTime)
		+ 0.3f * FMath::PerlinNoise1D(FlickerNoiseTime * 2.0f + 17.0f);

	float Brightness = FMath::Max(0.0f, 1.0f + Noise * Amplitude);

	// Brown-out: the whole beam sags as the charge approaches empty.
	Brightness *= FMath::Lerp(1.0f, EmptyBatteryBrightness, LowBatteryAlpha);

	// Dying battery: deep noise troughs starve the bulb for an instant. The cut-off eases in from
	// "never" (1.0) to LowBatteryDropoutThreshold so dropouts grow more frequent as the charge falls.
	const float DropoutLevel = FMath::Lerp(1.0f, LowBatteryDropoutThreshold, LowBatteryAlpha);
	if (Noise < -DropoutLevel)
	{
		Brightness *= EchoFlashlight::DropoutBrightness;
	}

	Flashlight->SetIntensity(FlashlightBaseIntensity * Brightness);
}

void AEchoPlayerCharacter::PlayFlashlightClick() const
{
	if (FlashlightClickSound)
	{
		UGameplayStatics::PlaySound2D(this, FlashlightClickSound);
	}
}
