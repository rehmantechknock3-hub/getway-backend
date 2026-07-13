import { useState } from "react";

import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SuggestedServiceCategoriesModal } from "./SuggestedServiceCategoriesModal";
import { appColors } from "../styles/colors";
import { textInputBaselineStyle } from "../styles/text-input";

const MAX_DEFAULT = 12;

function addCategoryName(list: string[], name: string, max: number): string[] {
  const t = name.trim();
  if (!t || list.length >= max) return list;
  const lower = t.toLowerCase();
  if (list.some((x) => x.toLowerCase() === lower)) return list;
  return [...list, t];
}

function togglePreset(list: string[], name: string, max: number): string[] {
  const lower = name.toLowerCase();
  const idx = list.findIndex((x) => x.toLowerCase() === lower);
  if (idx >= 0) return list.filter((_, i) => i !== idx);
  if (list.length >= max) return list;
  return [...list, name];
}

export type ProviderServiceCategoriesFieldProps = {
  value: string[];
  onChange: (next: string[]) => void;
  maxCategories?: number;
};

export function ProviderServiceCategoriesField({
  value,
  onChange,
  maxCategories = MAX_DEFAULT,
}: ProviderServiceCategoriesFieldProps) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [customName, setCustomName] = useState("");

  function openModal() {
    setIsModalVisible(true);
  }

  function closeModal() {
    setIsModalVisible(false);
  }

  function addCustom() {
    const next = addCategoryName(value, customName, maxCategories);
    if (next.length === value.length && customName.trim()) {
      /* duplicate or at cap */
    }
    onChange(next);
    setCustomName("");
  }

  return (
    <View className="mb-1">
      <Text className="text-ink text-sm font-medium mb-2">Service categories</Text>
      <Text className="text-ink-muted text-xs mb-3 leading-4">
        Select all that apply (up to {maxCategories}). Customers see these on your profile; each can map to bookable
        services you add later.
      </Text>

      {value.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 mb-3">
          {value.map((name, index) => (
            <View
              key={`${name}-${String(index)}`}
              className="flex-row items-center rounded-full bg-primary-50 border border-primary-100"
            >
              <Text className="text-primary-800 text-sm font-medium pl-3 pr-1 py-2">{name}</Text>
              <TouchableOpacity
                onPress={() => onChange(value.filter((_, i) => i !== index))}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 12 }}
                accessibilityLabel={`Remove ${name}`}
                className="w-11 h-11 items-center justify-center -mr-0.5 active:opacity-70"
              >
                <Ionicons name="close-circle" size={22} color={appColors.primary[800]} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity
        className="bg-canvas border border-ink-faint rounded-2xl px-4 py-3.5 mb-3 flex-row items-center justify-between"
        onPress={openModal}
        activeOpacity={0.85}
      >
        <Text className="text-ink text-base">Browse suggested categories</Text>
        <Ionicons name="chevron-down" size={18} color={appColors.ink.soft} />
      </TouchableOpacity>

      <Text className="text-ink text-sm font-medium mb-2">Or add your own</Text>
      <View className="flex-row gap-2 items-center">
        <TextInput
          className="flex-1 bg-canvas border border-ink-faint rounded-2xl px-4 py-3 text-ink text-base"
          style={textInputBaselineStyle}
          value={customName}
          onChangeText={setCustomName}
          placeholder="e.g. Mobile mechanic"
          placeholderTextColor={appColors.ink.subtle}
          onSubmitEditing={() => addCustom()}
        />
        <TouchableOpacity
          className="bg-primary-600 rounded-2xl px-4 py-3"
          onPress={() => addCustom()}
          disabled={!customName.trim() || value.length >= maxCategories}
          style={{ opacity: !customName.trim() || value.length >= maxCategories ? 0.5 : 1 }}
        >
          <Text className="text-white font-semibold text-sm">Add</Text>
        </TouchableOpacity>
      </View>

      <SuggestedServiceCategoriesModal
        visible={isModalVisible}
        onClose={closeModal}
        selectedNames={value}
        onToggle={(category) => onChange(togglePreset(value, category, maxCategories))}
      />
    </View>
  );
}
