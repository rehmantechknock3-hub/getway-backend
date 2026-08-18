import { useEffect, useMemo, useState } from "react";

import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  DEFAULT_PHONE_COUNTRY_ISO,
  formatNationalNumber,
  isValidNationalNumber,
  normalizeNationalDigits,
  PHONE_COUNTRIES,
  splitPhoneInput,
  toE164,
  type PhoneCountry,
} from "@repo/schemas";

import { appColors } from "../styles/colors";
import { textInputBaselineStyle } from "../styles/text-input";
import { phoneValidationMessage } from "../utils/phone";

function countryFlag(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return "";
  return String.fromCodePoint(
    ...[...code].map((char) => 127397 + char.charCodeAt(0))
  );
}

function rankedCountries(query: string): PhoneCountry[] {
  const needle = query.trim().toLowerCase();
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
  if (!needle) {
    const suggested = sorted.find((country) => country.iso === DEFAULT_PHONE_COUNTRY_ISO);
    const rest = sorted.filter((country) => country.iso !== DEFAULT_PHONE_COUNTRY_ISO);
    return suggested ? [suggested, ...rest] : sorted;
  }
  return sorted.filter((country) => {
    return (
      country.name.toLowerCase().includes(needle) ||
      country.iso.toLowerCase().includes(needle) ||
      country.dial.includes(needle.replace("+", "")) ||
      `+${country.dial}`.includes(needle)
    );
  });
}

export function PhoneNumberField({
  value,
  onChange,
  helperText,
}: {
  value: string;
  onChange: (e164: string) => void;
  helperText: string;
}) {
  const initial = splitPhoneInput(value, DEFAULT_PHONE_COUNTRY_ISO);
  const [country, setCountry] = useState<PhoneCountry>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!value) return;
    const parsed = splitPhoneInput(value, DEFAULT_PHONE_COUNTRY_ISO);
    setCountry((prev) => (prev.iso === parsed.country.iso ? prev : parsed.country));
    setNational((prev) => (prev === parsed.national ? prev : parsed.national));
  }, [value]);

  const countries = useMemo(() => rankedCountries(query), [query]);
  const formatted = formatNationalNumber(national, country.groups);
  const placeholder = formatNationalNumber(country.example, country.groups);
  const valid = isValidNationalNumber(country, national);

  function emit(nextCountry: PhoneCountry, nextNational: string) {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(nextNational ? toE164(nextCountry, nextNational) : "");
  }

  return (
    <View className="mb-5">
      <Text className="text-ink text-sm font-medium mb-2">Phone number</Text>
      <View className="flex-row gap-2 mb-1">
        <TouchableOpacity
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-3 py-3.5 flex-row items-center gap-2"
          onPress={() => {
            setQuery("");
            setPickerOpen(true);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${country.name} plus ${country.dial}`}
        >
          <Text className="text-base">{countryFlag(country.iso)}</Text>
          <Text className="text-ink text-base font-medium">+{country.dial}</Text>
          <Ionicons name="chevron-down" size={16} color={appColors.ink.muted} />
        </TouchableOpacity>
        <TextInput
          className="flex-1 bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base"
          keyboardType="phone-pad"
          placeholder={placeholder}
          placeholderTextColor={appColors.ink.subtle}
          style={textInputBaselineStyle}
          value={formatted}
          onChangeText={(raw) => {
            emit(country, normalizeNationalDigits(country, raw));
          }}
          accessibilityLabel="Phone number"
        />
      </View>
      <Text className={`text-xs mb-1 leading-5 ${valid ? "text-ink-muted" : "text-ink-soft"}`}>
        {phoneValidationMessage(country, national)}
      </Text>
      <Text className="text-ink-muted text-xs leading-5">{helperText}</Text>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable className="flex-1 bg-black/30 justify-end" onPress={() => setPickerOpen(false)}>
          <Pressable className="bg-canvas rounded-t-3xl p-5 max-h-[80%]" onPress={() => undefined}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-ink text-lg font-semibold">Select country</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={20} color={appColors.ink.DEFAULT} />
              </TouchableOpacity>
            </View>
            <TextInput
              className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 text-ink text-base mb-3"
              placeholder="Search country or code"
              placeholderTextColor={appColors.ink.subtle}
              style={textInputBaselineStyle}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
            />
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-4">
                {countries.length === 0 ? (
                  <Text className="text-ink-muted text-sm py-4">No matching country.</Text>
                ) : (
                  countries.map((item) => {
                    const selected = item.iso === country.iso;
                    return (
                      <TouchableOpacity
                        key={item.iso}
                        className={`rounded-2xl border px-4 py-3 flex-row items-center justify-between ${
                          selected ? "border-primary-600 bg-primary-50" : "border-ink-faint bg-canvas-raised"
                        }`}
                        onPress={() => {
                          const nextNational = normalizeNationalDigits(item, national);
                          emit(item, nextNational);
                          setPickerOpen(false);
                        }}
                      >
                        <View className="flex-row items-center gap-3 flex-1 pr-3">
                          <Text className="text-lg">{countryFlag(item.iso)}</Text>
                          <View className="flex-1">
                            <Text className={selected ? "text-primary-600 font-semibold" : "text-ink"}>
                              {item.name}
                            </Text>
                            <Text className="text-ink-muted text-xs">+{item.dial}</Text>
                          </View>
                        </View>
                        {selected ? (
                          <Ionicons name="checkmark-circle" size={18} color={appColors.primary[600]} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

