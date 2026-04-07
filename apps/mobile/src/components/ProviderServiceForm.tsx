import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import type { ProviderMyService } from "@repo/schemas";
import {
  useCreateProviderService,
  useCreateProviderServiceCategory,
  useDeleteProviderServiceCategory,
  useProviderServiceCategories,
  useUpdateProviderService,
} from "@repo/api-client";

import { textInputBaselineStyle } from "../styles/text-input";
import { appColors } from "../styles/colors";

function apiErrorMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) return undefined;
  const res = (error as { response?: { data?: unknown } }).response;
  if (!res || typeof res !== "object" || res.data === undefined || typeof res.data !== "object") {
    return undefined;
  }
  const msg = (res.data as { message?: unknown }).message;
  return typeof msg === "string" && msg.length > 0 ? msg : undefined;
}

type Props =
  | { mode: "new"; enabled: boolean }
  | { mode: "edit"; enabled: boolean; initial: ProviderMyService };

export function ProviderServiceForm(props: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: categories, isLoading: catLoading, refetch: refetchCategories } =
    useProviderServiceCategories({
      enabled: props.enabled,
    });

  const createCategory = useCreateProviderServiceCategory();
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("");
  const [isActive, setIsActive] = useState(true);

  const create = useCreateProviderService();
  const update = useUpdateProviderService();
  const deleteCategory = useDeleteProviderServiceCategory();

  useEffect(() => {
    if (props.mode !== "edit") return;
    const s = props.initial;
    setCategoryId(s.categoryId);
    setTitle(s.title);
    setDescription(s.description ?? "");
    setPrice(String(s.price));
    setDuration(String(s.duration));
    setIsActive(s.isActive);
  }, [props.mode, props.mode === "edit" ? props.initial.id : ""]);

  useEffect(() => {
    if (props.mode !== "new") return;
    if (!categories?.length || categoryId) return;
    setCategoryId(categories[0]!.id);
  }, [props.mode, categories, categoryId]);

  const busy =
    create.isPending || update.isPending || createCategory.isPending || deleteCategory.isPending;

  function promptDeleteCategory(c: { id: string; name: string }) {
    Alert.alert(
      "Delete category?",
      `Remove “${c.name}”? You can delete categories you added, or unused shared ones, only if no service uses them.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void runDeleteCategory(c.id),
        },
      ]
    );
  }

  async function runDeleteCategory(id: string) {
    try {
      await deleteCategory.mutateAsync(id);
      const refreshed = await refetchCategories();
      const list = refreshed.data ?? [];
      setCategoryId((current) => {
        if (current !== id) return current;
        return list[0]?.id ?? "";
      });
    } catch (e: unknown) {
      Alert.alert(
        "Could not delete category",
        apiErrorMessage(e) ?? "Check your connection and try again."
      );
    }
  }

  async function handleCreateCategory() {
    const t = newCategoryName.trim();
    if (!t) {
      Alert.alert("Category name", "Enter a name for the new category.");
      return;
    }
    try {
      const row = await createCategory.mutateAsync({ name: t });
      setNewCategoryName("");
      setCategoryId(row.id);
      await refetchCategories();
    } catch {
      Alert.alert("Could not create category", "Try a different name or check your connection.");
    }
  }

  async function onSave() {
    const priceNum = Number.parseFloat(price);
    const durNum = Number.parseInt(duration, 10);
    if (!title.trim()) {
      Alert.alert("Required", "Enter a service title.");
      return;
    }
    if (!categoryId) {
      Alert.alert("Category", "Select a category below, or create a new one.");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      Alert.alert("Price", "Enter a valid price greater than zero.");
      return;
    }
    if (Number.isNaN(durNum) || durNum <= 0) {
      Alert.alert("Duration", "Enter duration in whole minutes (e.g. 60).");
      return;
    }

    try {
      if (props.mode === "new") {
        await create.mutateAsync({
          categoryId,
          title: title.trim(),
          description: description.trim() ? description.trim() : undefined,
          price: priceNum,
          duration: durNum,
        });
      } else {
        const wasIncomplete = props.initial.price <= 0 || props.initial.duration <= 0;
        const nowComplete = priceNum > 0 && durNum > 0;
        const resolvedActive = wasIncomplete && nowComplete ? true : isActive;
        await update.mutateAsync({
          serviceId: props.initial.id,
          input: {
            categoryId,
            title: title.trim(),
            description: description.trim() ? description.trim() : undefined,
            price: priceNum,
            duration: durNum,
            isActive: resolvedActive,
          },
        });
      }
      router.back();
    } catch {
      Alert.alert("Could not save", "Check your connection and try again.");
    }
  }

  if (!props.enabled || catLoading) {
    return (
      <View className="flex-1 bg-canvas items-center justify-center py-20">
        <ActivityIndicator color={appColors.primary[600]} />
      </View>
    );
  }

  const priceNumDraft = Number.parseFloat(price);
  const durNumDraft = Number.parseInt(duration, 10);
  const priceInvalid = Number.isNaN(priceNumDraft) || priceNumDraft <= 0;
  const durationInvalid = Number.isNaN(durNumDraft) || durNumDraft <= 0;
  const showIncompleteListingBanner = props.mode === "edit" && (priceInvalid || durationInvalid);
  const priceFieldBorder =
    props.mode === "edit" && priceInvalid ? "border-red-400" : "border-ink-faint";
  const durationFieldBorder =
    props.mode === "edit" && durationInvalid ? "border-red-400" : "border-ink-faint";

  if (!categories?.length) {
    return (
      <ScrollView
        className="flex-1 bg-canvas"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: Math.max(insets.bottom + 24, 32),
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-ink font-semibold text-lg text-center mb-2">Create a category</Text>
        <Text className="text-ink-muted text-sm text-center leading-5 mb-6">
          Every service belongs to a category (e.g. Oil change). Create one here, then complete the rest of this
          form.
        </Text>
        <Text className="text-ink text-sm font-medium mb-2">New category name</Text>
        <TextInput
          className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
          style={textInputBaselineStyle}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="e.g. Transmission service"
          placeholderTextColor={appColors.ink.subtle}
          onSubmitEditing={() => void handleCreateCategory()}
        />
        <TouchableOpacity
          className="bg-primary-600 rounded-2xl py-3.5 items-center mb-4"
          onPress={() => void handleCreateCategory()}
          disabled={busy}
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          {createCategory.isPending ? (
            <ActivityIndicator color={appColors.canvas.raised} />
          ) : (
            <Text className="text-white font-semibold">Create category</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity className="py-3 items-center" onPress={() => router.back()} disabled={busy}>
          <Text className="text-ink-muted font-semibold">Go back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-canvas"
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom + 24, 32),
      }}
      keyboardShouldPersistTaps="handled"
    >
      {showIncompleteListingBanner ? (
        <View className="mb-4 p-4 rounded-2xl border border-red-300 bg-red-50">
          <Text className="text-red-800 font-semibold text-sm mb-1">Add price and duration</Text>
          <Text className="text-ink-muted text-sm leading-5">
            Please add the price of this service and how long it takes (minutes) before customers can book it.
          </Text>
        </View>
      ) : null}
      <Text className="text-ink text-sm font-medium mb-2">Category</Text>
      <Text className="text-ink-muted text-xs mb-3 leading-4">
        Tap a name to select it for this service. Trash removes a category you created (or an unused shared one) when no listing uses it—other providers keep their own labels.
      </Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {categories.map((c) => {
          const selected = c.id === categoryId;
          return (
            <View
              key={c.id}
              className={`flex-row items-center rounded-xl border overflow-hidden ${
                selected ? "bg-primary-50 border-primary-600" : "bg-canvas-raised border-ink-faint"
              }`}
            >
              <Pressable
                onPress={() => setCategoryId(c.id)}
                className="px-3 py-2.5 active:opacity-80"
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Select category ${c.name}`}
              >
                <Text className={`text-sm font-medium ${selected ? "text-primary-700" : "text-ink"}`}>
                  {c.name}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => promptDeleteCategory(c)}
                disabled={busy}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={`Delete category ${c.name}`}
                className="pr-2 pl-1 py-2 active:opacity-70"
              >
                <Ionicons name="trash-outline" size={20} color={appColors.primary[800]} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text className="text-ink text-sm font-medium mb-2">Add another category</Text>
      <View className="flex-row gap-2 items-center mb-5">
        <TextInput
          className="flex-1 bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3 text-ink text-base"
          style={textInputBaselineStyle}
          value={newCategoryName}
          onChangeText={setNewCategoryName}
          placeholder="New category name"
          placeholderTextColor={appColors.ink.subtle}
          onSubmitEditing={() => void handleCreateCategory()}
        />
        <TouchableOpacity
          className="bg-canvas-raised border border-primary-600 rounded-2xl px-4 py-3"
          onPress={() => void handleCreateCategory()}
          disabled={busy || !newCategoryName.trim()}
          style={{ opacity: busy || !newCategoryName.trim() ? 0.5 : 1 }}
        >
          <Text className="text-primary-700 font-semibold text-sm">Add</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-ink text-sm font-medium mb-2">Title</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4"
        style={textInputBaselineStyle}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Full synthetic oil change"
        placeholderTextColor={appColors.ink.subtle}
      />

      <Text className="text-ink text-sm font-medium mb-2">Description (optional)</Text>
      <TextInput
        className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-3.5 text-ink text-base mb-4 min-h-[100px]"
        style={[textInputBaselineStyle, { textAlignVertical: "top" }]}
        value={description}
        onChangeText={setDescription}
        placeholder="What customers get"
        placeholderTextColor={appColors.ink.subtle}
        multiline
      />

      <Text className="text-ink text-sm font-medium mb-2">Price (USD)</Text>
      <TextInput
        className={`bg-canvas-raised border ${priceFieldBorder} rounded-2xl px-4 py-3.5 text-ink text-base mb-4`}
        style={textInputBaselineStyle}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="49"
        placeholderTextColor={appColors.ink.subtle}
      />

      <Text className="text-ink text-sm font-medium mb-2">Duration (minutes)</Text>
      <TextInput
        className={`bg-canvas-raised border ${durationFieldBorder} rounded-2xl px-4 py-3.5 text-ink text-base mb-4`}
        style={textInputBaselineStyle}
        value={duration}
        onChangeText={setDuration}
        keyboardType="number-pad"
        placeholder="60"
        placeholderTextColor={appColors.ink.subtle}
      />

      {props.mode === "edit" ? (
        <View className="bg-canvas-raised border border-ink-faint rounded-2xl px-4 py-4 mb-6 flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-ink font-semibold">Visible to customers</Text>
            <Text className="text-ink-muted text-sm">Turn off to hide this service from Discover and your profile.</Text>
          </View>
          <Switch value={isActive} onValueChange={setIsActive} />
        </View>
      ) : (
        <View className="mb-6" />
      )}

      <TouchableOpacity
        className="bg-primary-600 rounded-2xl py-3.5 items-center mb-4"
        onPress={() => void onSave()}
        disabled={busy}
        style={{ opacity: busy ? 0.6 : 1 }}
      >
        {busy ? (
          <ActivityIndicator color={appColors.canvas.raised} />
        ) : (
          <Text className="text-white font-semibold">{props.mode === "new" ? "Add service" : "Save changes"}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity className="py-3 items-center" onPress={() => router.back()} disabled={busy}>
        <Text className="text-ink-muted font-semibold">Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
