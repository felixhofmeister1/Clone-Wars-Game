// Copyright Echoes in the Drywall. All Rights Reserved.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "EchoPlayerCharacter.generated.h"

class UBreathingComponent;
class UCameraComponent;
class UInputAction;
class UInputComponent;
class UInputMappingContext;
class USoundBase;
class USpotLightComponent;
struct FInputActionValue;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFlashlightToggledSignature, bool, bIsOn);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnFlashlightBatteryDepletedSignature);

/**
 * First-person horror protagonist.
 *
 * Owns the first-person camera, a camera-mounted flashlight running on a draining battery
 * (Perlin-noise flicker that worsens as the charge runs low) and a UBreathingComponent.
 * All input goes through Enhanced Input; assign the actions and mapping context in a Blueprint child.
 */
UCLASS(Blueprintable)
class ECHOESINTHEDRYWALL_API AEchoPlayerCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AEchoPlayerCharacter();

	//~ Begin AActor Interface
	virtual void Tick(float DeltaSeconds) override;
	//~ End AActor Interface

	//~ Begin APawn Interface
	virtual void PawnClientRestart() override;
	virtual void UnPossessed() override;
	//~ End APawn Interface

	/** Flips the flashlight. Returns true if the flashlight is on afterwards. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Flashlight")
	bool ToggleFlashlight();

	/**
	 * Turns the flashlight on or off. Returns true if it ends up in the requested state;
	 * turning on with a dead battery fails (the switch still clicks).
	 */
	UFUNCTION(BlueprintCallable, Category = "Echo|Flashlight")
	bool SetFlashlightEnabled(bool bEnable);

	/** Adds charge (seconds of light), e.g. from a battery pickup. Returns the charge actually added. */
	UFUNCTION(BlueprintCallable, Category = "Echo|Flashlight")
	float AddBatteryCharge(float SecondsToAdd);

	UFUNCTION(BlueprintPure, Category = "Echo|Flashlight")
	bool IsFlashlightOn() const { return bFlashlightOn; }

	/** Battery charge as a percentage in [0, 100]. */
	UFUNCTION(BlueprintPure, Category = "Echo|Flashlight")
	float GetBatteryPercentage() const { return GetBatteryFraction() * 100.0f; }

	/** Battery charge in [0, 1], ready for progress bars. */
	UFUNCTION(BlueprintPure, Category = "Echo|Flashlight")
	float GetBatteryFraction() const;

	/** Seconds of light left at the current drain rate. */
	UFUNCTION(BlueprintPure, Category = "Echo|Flashlight")
	float GetRemainingBatterySeconds() const { return CurrentBatterySeconds; }

	UFUNCTION(BlueprintPure, Category = "Echo|Flashlight")
	bool IsBatteryLow() const { return GetBatteryFraction() <= LowBatteryThreshold; }

	UCameraComponent* GetFirstPersonCamera() const { return FirstPersonCamera; }
	USpotLightComponent* GetFlashlight() const { return Flashlight; }
	UBreathingComponent* GetBreathing() const { return Breathing; }

	UPROPERTY(BlueprintAssignable, Category = "Echo|Flashlight")
	FOnFlashlightToggledSignature OnFlashlightToggled;

	UPROPERTY(BlueprintAssignable, Category = "Echo|Flashlight")
	FOnFlashlightBatteryDepletedSignature OnFlashlightBatteryDepleted;

protected:
	//~ Begin AActor Interface
	virtual void BeginPlay() override;
	//~ End AActor Interface

	//~ Begin APawn Interface
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	//~ End APawn Interface

	// ---------------------------------------------------------------- Components

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UCameraComponent> FirstPersonCamera;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<USpotLightComponent> Flashlight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Components")
	TObjectPtr<UBreathingComponent> Breathing;

	// ---------------------------------------------------------------- Input

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Echo|Input")
	TObjectPtr<UInputMappingContext> DefaultMappingContext;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Echo|Input")
	int32 MappingContextPriority = 0;

	/** Axis2D: X = strafe, Y = forward. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Echo|Input")
	TObjectPtr<UInputAction> MoveAction;

	/** Axis2D: X = yaw, Y = pitch. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Echo|Input")
	TObjectPtr<UInputAction> LookAction;

	/** Digital: toggles the flashlight on press. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Echo|Input")
	TObjectPtr<UInputAction> FlashlightAction;

	/** Digital (optional): hold to hold breath, release to exhale. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Echo|Input")
	TObjectPtr<UInputAction> HoldBreathAction;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Input", meta = (ClampMin = "0.01"))
	float LookSensitivity = 1.0f;

	// ---------------------------------------------------------------- Flashlight: battery

	/** Seconds of continuous light a full battery provides. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Battery", meta = (ClampMin = "1.0", Units = "s"))
	float MaxBatterySeconds = 300.0f;

	/** Charge the player starts with, as a fraction of MaxBatterySeconds. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Battery", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float InitialBatteryFraction = 1.0f;

	/** Battery seconds consumed per real second while the light is on. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Battery", meta = (ClampMin = "0.0"))
	float BatteryDrainRate = 1.0f;

	/** Below this fraction the flicker turns erratic and the beam browns out. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Battery", meta = (ClampMin = "0.01", ClampMax = "1.0"))
	float LowBatteryThreshold = 0.2f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Battery")
	bool bStartWithFlashlightOn = false;

	/** Debug/cheat: the light never drains. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Battery")
	bool bInfiniteBattery = false;

	// ---------------------------------------------------------------- Flashlight: output and flicker

	/** Beam intensity (candelas) at full charge before flicker is applied. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0"))
	float FlashlightBaseIntensity = 1500.0f;

	/** Brightness multiplier the beam sags to as the battery approaches empty. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float EmptyBatteryBrightness = 0.35f;

	/** Noise samples per second on a healthy battery. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0"))
	float FlickerSpeed = 3.0f;

	/** +/- intensity fraction on a healthy battery (subtle filament shimmer). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float FlickerAmplitude = 0.05f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0"))
	float LowBatteryFlickerSpeed = 14.0f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float LowBatteryFlickerAmplitude = 0.6f;

	/**
	 * On a low battery, noise values below -Threshold cut the beam to a near-blackout for that instant.
	 * The flicker noise stays within about +/-0.7: at 0.3 roughly 10% of frames black out on an empty
	 * battery (none above ~10% charge); 0.55 gives about 1%. Raise towards 1 for rarer dropouts.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight|Flicker", meta = (ClampMin = "0.0", ClampMax = "1.0"))
	float LowBatteryDropoutThreshold = 0.3f;

	/** Optional click played when the switch is pressed (including a dead-battery click). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Echo|Flashlight")
	TObjectPtr<USoundBase> FlashlightClickSound;

private:
	void Move(const FInputActionValue& Value);
	void Look(const FInputActionValue& Value);
	void HandleFlashlightInput();
	void HandleHoldBreathStarted();
	void HandleHoldBreathReleased();

	void AddInputMappingContext() const;
	void RemoveInputMappingContext() const;

	/** Commits the on/off state to the light and notifies listeners. No validation, no click. */
	void ApplyFlashlightState(bool bOn);

	void DrainBattery(float DeltaSeconds);
	void UpdateFlashlightFlicker(float DeltaSeconds);
	void PlayFlashlightClick() const;

	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	float CurrentBatterySeconds = 0.0f;

	UPROPERTY(VisibleInstanceOnly, Transient, Category = "Echo|State")
	bool bFlashlightOn = false;

	/** Noise-space time, advanced by DeltaSeconds * current flicker speed so speed changes stay continuous. */
	float FlickerNoiseTime = 0.0f;
};
