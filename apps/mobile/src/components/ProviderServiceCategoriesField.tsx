import { useState } from "react";

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

import { PROVIDER_SERVICE_CATEGORY_PRESETS } from "../data/provider-service-category-presets";
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
  const [showModal, setShowModal] = useState(false);
  const [customName, setCustomName] = useState("");

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
        onPress={() => setShowModal(true)}
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

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable className="flex-1 bg-black/30 justify-end" onPress={() => setShowModal(false)}>
          <Pressable className="bg-canvas rounded-t-3xl p-5 max-h-[70%]" onPress={() => undefined}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-ink text-lg font-semibold">Suggested categories</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={appColors.ink.DEFAULT} />
              </TouchableOpacity>
            </View>
            <Text className="text-ink-muted text-xs mb-3">Tap to add or remove. You can choose several.</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-4">
                {PROVIDER_SERVICE_CATEGORY_PRESETS.map((category) => {
                  const selected = value.some((x) => x.toLowerCase() === category.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={category}
                      className={`rounded-2xl border px-4 py-3 flex-row items-center justify-between ${
                        selected ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised"
                      }`}
                      onPress={() => onChange(togglePreset(value, category, maxCategories))}
                    >
                      <Text className={selected ? "text-primary-800 font-semibold" : "text-ink"}>{category}</Text>
                      {selected ? <Ionicons name="checkmark-circle" size={20} color={appColors.primary[700]} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity
              className="bg-primary-600 rounded-2xl py-3 items-center mt-2"
              onPress={() => setShowModal(false)}
            >
              <Text className="text-white font-semibold">Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
