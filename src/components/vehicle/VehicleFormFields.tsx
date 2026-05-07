import React, { useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Car, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Chip, ChipGroup } from "@/components/ui/Chip";
import { Divider } from "@/components/ui/Divider";
import { useTheme } from "@/hooks/useTheme";
import { useAgency } from "@/hooks/useAgency";
import type {
  VehicleBrand,
  VehicleCategory,
  FuelType,
  Transmission,
} from "@/types/vehicle";

const BRANDS: VehicleBrand[] = [
  "Audi",
  "BMW",
  "Mercedes-Benz",
  "Škoda",
  "Volkswagen",
  "Mini",
  "Land Rover",
];

const CATEGORIES: VehicleCategory[] = [
  "SUV",
  "SUV Compact",
  "Sedan Compact",
  "Van / Minivan",
  "City Car",
  "SUV Coupé",
  "Hatchback",
  "SUV / 7 Places",
  "SUV Luxury",
  "Van / Utilitaire",
];

const FUEL_TYPES: { label: string; value: FuelType }[] = [
  { label: "Gasoline", value: "gasoline" },
  { label: "Diesel", value: "diesel" },
  { label: "Electric", value: "electric" },
  { label: "Hybrid", value: "hybrid" },
  { label: "Plug-in Hybrid", value: "plug-in-hybrid" },
];

const TRANSMISSIONS: { label: string; value: Transmission }[] = [
  { label: "Manual", value: "manual" },
  { label: "Automatic", value: "automatic" },
];

const stagger = (index: number) =>
  FadeInDown.delay(index * 60)
    .duration(400)
    .springify();

export interface VehicleFormState {
  name: string;
  brand: VehicleBrand | null;
  category: VehicleCategory | null;
  year: string;
  color: string;
  licensePlate: string;
  mileage: string;
  fuelType: FuelType | null;
  transmission: Transmission | null;
  seats: string;
  dailyRate: string;
  features: string[];
}

export interface VehicleFormFieldsProps {
  state: VehicleFormState;
  setState: {
    setName: (v: string) => void;
    setBrand: (v: VehicleBrand) => void;
    setCategory: (v: VehicleCategory) => void;
    setYear: (v: string) => void;
    setColor: (v: string) => void;
    setLicensePlate: (v: string) => void;
    setMileage: (v: string) => void;
    setFuelType: (v: FuelType) => void;
    setTransmission: (v: Transmission) => void;
    setSeats: (v: string) => void;
    setDailyRate: (v: string) => void;
    setFeatures: (v: string[]) => void;
  };
  fieldErrors: Record<string, string>;
  clearFieldError: (key: string) => void;
  startIndex: number;
}

/**
 * Number of `entering={stagger(i++)}` blocks inside <VehicleFormFields/>.
 * Parent screens advance their own `sectionIndex` by this amount after the
 * component to keep the staggered animation continuous across following
 * sections. Update this whenever you add/remove an Animated.View entering
 * step inside the form.
 */
export const VEHICLE_FORM_FIELDS_STAGGER_COUNT = 19;

export function VehicleFormFields({
  state,
  setState,
  fieldErrors,
  clearFieldError,
  startIndex,
}: VehicleFormFieldsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: agency } = useAgency();
  const currency = agency?.currency ?? "EUR";
  let i = startIndex;

  return (
    <>
      <Animated.View entering={stagger(i++)} className="mb-2">
        <Text variant="labelLarge" color={theme.textSecondary} className="mb-3">
          {t("fleet.vehicleInfo", { defaultValue: "Vehicle Info" })}
        </Text>
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Input
          label={t("fleet.vehicleName", { defaultValue: "Vehicle Name" })}
          placeholder="e.g., BMW X3"
          value={state.name}
          onChangeText={(v) => {
            setState.setName(v);
            clearFieldError("name");
          }}
          leftIcon={Car}
          error={fieldErrors.name}
        />
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          className="mb-1.5"
        >
          {t("fleet.brand", { defaultValue: "Brand" })}
        </Text>
        <ChipGroup>
          {BRANDS.map((b) => (
            <Chip
              key={b}
              label={b}
              selected={state.brand === b}
              onPress={() => {
                setState.setBrand(b);
                clearFieldError("brand");
              }}
            />
          ))}
        </ChipGroup>
        {fieldErrors.brand && (
          <Text variant="caption" color={theme.danger} style={{ marginTop: 6 }}>
            {fieldErrors.brand}
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          className="mb-1.5"
        >
          {t("fleet.category", { defaultValue: "Category" })}
        </Text>
        <ChipGroup>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={c}
              selected={state.category === c}
              onPress={() => {
                setState.setCategory(c);
                clearFieldError("category");
              }}
            />
          ))}
        </ChipGroup>
        {fieldErrors.category && (
          <Text variant="caption" color={theme.danger} style={{ marginTop: 6 }}>
            {fieldErrors.category}
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="flex-row gap-3 mb-3">
        <View className="flex-1">
          <Input
            label={t("fleet.year", { defaultValue: "Year" })}
            placeholder="2024"
            value={state.year}
            onChangeText={(v) => {
              setState.setYear(v);
              clearFieldError("year");
            }}
            keyboardType="number-pad"
            error={fieldErrors.year}
          />
        </View>
        <View className="flex-1">
          <Input
            label={t("fleet.color", { defaultValue: "Color" })}
            placeholder="e.g., Black"
            value={state.color}
            onChangeText={(v) => {
              setState.setColor(v);
              clearFieldError("color");
            }}
            error={fieldErrors.color}
          />
        </View>
      </Animated.View>

      <Animated.View entering={stagger(i++)}>
        <Divider className="my-4" />
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-2">
        <Text variant="labelLarge" color={theme.textSecondary} className="mb-3">
          {t("fleet.registration", { defaultValue: "Registration" })}
        </Text>
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Input
          label={t("fleet.licensePlate", { defaultValue: "License Plate" })}
          placeholder="AB-123-CD"
          value={state.licensePlate}
          onChangeText={(v) => {
            setState.setLicensePlate(v);
            clearFieldError("licensePlate");
          }}
          error={fieldErrors.licensePlate}
        />
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Input
          label={t("fleet.mileage", { defaultValue: "Mileage (km)" })}
          value={state.mileage}
          onChangeText={(v) => {
            setState.setMileage(v);
            clearFieldError("mileage");
          }}
          keyboardType="number-pad"
          error={fieldErrors.mileage}
        />
      </Animated.View>

      <Animated.View entering={stagger(i++)}>
        <Divider className="my-4" />
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-2">
        <Text variant="labelLarge" color={theme.textSecondary} className="mb-3">
          {t("fleet.specifications", { defaultValue: "Specifications" })}
        </Text>
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          className="mb-1.5"
        >
          {t("fleet.fuelType", { defaultValue: "Fuel Type" })}
        </Text>
        <ChipGroup>
          {FUEL_TYPES.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              selected={state.fuelType === f.value}
              onPress={() => {
                setState.setFuelType(f.value);
                clearFieldError("fuelType");
              }}
            />
          ))}
        </ChipGroup>
        {fieldErrors.fuelType && (
          <Text variant="caption" color={theme.danger} style={{ marginTop: 6 }}>
            {fieldErrors.fuelType}
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <Text
          variant="bodySmall"
          color={theme.textSecondary}
          className="mb-1.5"
        >
          {t("fleet.transmission", { defaultValue: "Transmission" })}
        </Text>
        <ChipGroup>
          {TRANSMISSIONS.map((tr) => (
            <Chip
              key={tr.value}
              label={tr.label}
              selected={state.transmission === tr.value}
              onPress={() => {
                setState.setTransmission(tr.value);
                clearFieldError("transmission");
              }}
            />
          ))}
        </ChipGroup>
        {fieldErrors.transmission && (
          <Text variant="caption" color={theme.danger} style={{ marginTop: 6 }}>
            {fieldErrors.transmission}
          </Text>
        )}
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="flex-row gap-3 mb-3">
        <View className="flex-1">
          <Input
            label={t("fleet.seats", { defaultValue: "Seats" })}
            placeholder="5"
            value={state.seats}
            onChangeText={(v) => {
              setState.setSeats(v);
              clearFieldError("seats");
            }}
            keyboardType="number-pad"
            error={fieldErrors.seats}
          />
        </View>
        <View className="flex-1">
          <Input
            label={t("fleet.dailyRate", {
              defaultValue: `Daily Rate (${currency})`,
            })}
            placeholder="120"
            value={state.dailyRate}
            onChangeText={(v) => {
              setState.setDailyRate(v);
              clearFieldError("dailyRate");
            }}
            keyboardType="decimal-pad"
            error={fieldErrors.dailyRate}
          />
        </View>
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-2">
        <Text variant="labelLarge" color={theme.textSecondary} className="mb-3">
          {t("fleet.features", { defaultValue: "Features" })}
        </Text>
      </Animated.View>

      <Animated.View entering={stagger(i++)} className="mb-3">
        <FeaturesEditor
          features={state.features}
          onChange={setState.setFeatures}
        />
      </Animated.View>
    </>
  );
}

interface FeaturesEditorProps {
  features: string[];
  onChange: (next: string[]) => void;
}

function FeaturesEditor({ features, onChange }: FeaturesEditorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [draft, setDraft] = useState("");

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (features.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...features, trimmed]);
    setDraft("");
  };

  const remove = (value: string) => {
    onChange(features.filter((f) => f !== value));
  };

  return (
    <View>
      {features.length > 0 ? (
        <View className="flex-row flex-wrap mb-2" style={{ gap: 6 }}>
          {features.map((f) => (
            <Pressable
              key={f}
              onPress={() => remove(f)}
              className="flex-row items-center rounded-full px-3 py-1.5"
              style={{
                backgroundColor: theme.accentSoft,
                gap: 6,
              }}
            >
              <Text
                variant="labelSmall"
                color={theme.accent}
                style={{ fontSize: 12 }}
              >
                {f}
              </Text>
              <X size={12} color={theme.accent} strokeWidth={2.4} />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View
        className="flex-row items-center rounded-2xl px-3.5"
        style={{
          backgroundColor: theme.surfaceSecondary,
          borderWidth: 1,
          borderColor: theme.borderLight,
          height: 48,
        }}
      >
        <TextInput
          className="flex-1"
          placeholder={t("fleet.featuresPlaceholder", {
            defaultValue: "Add a feature and press return",
          })}
          placeholderTextColor={theme.textTertiary}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          onBlur={submit}
          returnKeyType="done"
          submitBehavior="submit"
          style={{
            color: theme.textPrimary,
            fontFamily: "Poppins_400Regular",
            fontSize: 14,
            padding: 0,
          }}
        />
      </View>
    </View>
  );
}
