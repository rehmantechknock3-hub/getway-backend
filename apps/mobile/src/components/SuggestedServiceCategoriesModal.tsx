import { useEffect, useRef } from "react";

import { Animated, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PROVIDER_SERVICE_CATEGORY_PRESETS } from "../data/provider-service-category-presets";
import { appColors } from "../styles/colors";

type SuggestedServiceCategoriesModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedNames: string[];
  onToggle: (name: string) => void;
};

export function SuggestedServiceCategoriesModal({
  visible,
  onClose,
  selectedNames,
  onToggle,
}: SuggestedServiceCategoriesModalProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      overlayOpacity.setValue(0);
      return;
    }
    overlayOpacity.setValue(0);
    Animated.timing(overlayOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, overlayOpacity]);

  function closeModal() {
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeModal}>
      <Animated.View
        className="flex-1 justify-end"
        style={{ backgroundColor: "rgba(0,0,0,0.3)", opacity: overlayOpacity }}
      >
        <Pressable className="flex-1 justify-end" onPress={closeModal}>
          <Pressable className="bg-canvas rounded-t-3xl p-5 max-h-[70%]" onPress={() => undefined}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-ink text-lg font-semibold">Suggested categories</Text>
              <TouchableOpacity onPress={closeModal} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={appColors.ink.DEFAULT} />
              </TouchableOpacity>
            </View>
            <Text className="text-ink-muted text-xs mb-3">Tap to add or select a category.</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-2 pb-4">
                {PROVIDER_SERVICE_CATEGORY_PRESETS.map((category) => {
                  const selected = selectedNames.some((x) => x.toLowerCase() === category.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={category}
                      className={`rounded-2xl border px-4 py-3 flex-row items-center justify-between ${
                        selected ? "border-primary-500 bg-primary-50" : "border-ink-faint bg-canvas-raised"
                      }`}
                      onPress={() => onToggle(category)}
                    >
                      <Text className={selected ? "text-primary-800 font-semibold" : "text-ink"}>{category}</Text>
                      {selected ? <Ionicons name="checkmark-circle" size={20} color={appColors.primary[700]} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity className="bg-primary-600 rounded-2xl py-3 items-center mt-2" onPress={closeModal}>
              <Text className="text-white font-semibold">Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}
