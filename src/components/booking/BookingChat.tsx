import React from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { MessageSquare, Send } from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { useToastStore } from "@/components/ui/Toast";
import {
  useBookingMessages,
  useSendBookingMessage,
} from "@/hooks/useBookingMessages";
import type { BookingMessage } from "@/services/messageService";
import { fontFamilies } from "@/theme/typography";

// Max body length matches typical chat limits; the backend is the source of
// truth, this just keeps the UI from posting absurdly long bodies.
const MAX_BODY_LENGTH = 2000;

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface MessageBubbleProps {
  message: BookingMessage;
  theme: ReturnType<typeof useTheme>;
}

function MessageBubble({ message, theme }: MessageBubbleProps) {
  const isAgency = message.senderRole === "agency";
  return (
    <View
      style={{
        alignSelf: isAgency ? "flex-end" : "flex-start",
        maxWidth: "82%",
        marginBottom: 10,
      }}
    >
      <View
        style={{
          backgroundColor: isAgency ? theme.accent : theme.surfaceTertiary,
          borderRadius: 16,
          borderBottomRightRadius: isAgency ? 4 : 16,
          borderBottomLeftRadius: isAgency ? 16 : 4,
          paddingHorizontal: 12,
          paddingVertical: 9,
        }}
      >
        <Text
          variant="bodyMedium"
          color={isAgency ? theme.textInverse : theme.textPrimary}
          style={{ fontSize: 13, lineHeight: 18 }}
        >
          {message.body}
        </Text>
      </View>
      <Text
        variant="caption"
        color={theme.textTertiary}
        align={isAgency ? "right" : "left"}
        style={{ fontSize: 10, marginTop: 3, marginHorizontal: 4 }}
      >
        {formatTime(message.createdAt)}
      </Text>
    </View>
  );
}

export function BookingChat({ bookingId }: { bookingId: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.show);

  const {
    data: messages = [],
    isLoading,
    isError,
    refetch,
  } = useBookingMessages(bookingId);
  const sendMut = useSendBookingMessage(bookingId);

  const [draft, setDraft] = React.useState("");

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && !sendMut.isPending;

  const handleSend = React.useCallback(() => {
    if (!canSend) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMut.mutate(trimmed, {
      onSuccess: () => {
        setDraft("");
      },
      onError: (err) => {
        showToast({
          variant: "error",
          title: t("bookings.chat.sendError", "Could not send message"),
          message: err instanceof Error ? err.message : undefined,
        });
      },
    });
  }, [canSend, sendMut, trimmed, showToast, t]);

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: theme.borderLight,
      }}
    >
      {/* ── Message list ──────────────────────────────────────────────── */}
      {isLoading && messages.length === 0 ? (
        <View
          style={{ paddingVertical: 24, alignItems: "center" }}
          testID="booking-chat-loading"
        >
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      ) : isError && messages.length === 0 ? (
        <Pressable
          onPress={() => void refetch()}
          testID="booking-chat-retry"
          accessibilityRole="button"
          accessibilityLabel={t("common.retry", "Retry")}
          style={{ paddingVertical: 20, alignItems: "center" }}
        >
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            align="center"
            style={{ fontSize: 13 }}
          >
            {t("bookings.chat.loadError", "Could not load messages. Tap to retry.")}
          </Text>
        </Pressable>
      ) : messages.length === 0 ? (
        <View style={{ paddingVertical: 24, alignItems: "center" }}>
          <MessageSquare
            size={28}
            color={theme.textTertiary}
            strokeWidth={1.5}
          />
          <Text
            variant="bodySmall"
            color={theme.textTertiary}
            align="center"
            style={{ fontSize: 13, marginTop: 8 }}
          >
            {t("bookings.chat.empty", "No messages yet")}
          </Text>
        </View>
      ) : (
        <View testID="booking-chat-messages" style={{ marginBottom: 4 }}>
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} theme={theme} />
          ))}
        </View>
      )}

      {/* ── Composer ──────────────────────────────────────────────────── */}
      <View
        className="flex-row items-end"
        style={{ gap: 8, marginTop: messages.length > 0 ? 6 : 0 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: theme.surfaceTertiary,
            borderRadius: 16,
            paddingHorizontal: 12,
            minHeight: 44,
            justifyContent: "center",
          }}
        >
          <TextInput
            testID="booking-chat-input"
            accessibilityLabel={t(
              "bookings.chat.inputAccessibility",
              "Message to client",
            )}
            value={draft}
            onChangeText={setDraft}
            placeholder={t("bookings.chat.placeholder", "Write a message…")}
            placeholderTextColor={theme.textTertiary}
            multiline
            maxLength={MAX_BODY_LENGTH}
            editable={!sendMut.isPending}
            style={{
              fontFamily: fontFamilies.regular,
              fontSize: 14,
              color: theme.textPrimary,
              paddingVertical: 10,
              maxHeight: 120,
            }}
          />
        </View>

        <Pressable
          testID="booking-chat-send"
          accessibilityRole="button"
          accessibilityLabel={t("bookings.chat.send", "Send message")}
          accessibilityState={{ disabled: !canSend }}
          disabled={!canSend}
          onPress={handleSend}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: canSend ? theme.accent : theme.surfaceTertiary,
            alignItems: "center",
            justifyContent: "center",
            opacity: canSend ? 1 : 0.6,
          }}
        >
          {sendMut.isPending ? (
            <ActivityIndicator size="small" color={theme.textInverse} />
          ) : (
            <Send
              size={18}
              color={canSend ? theme.textInverse : theme.textTertiary}
              strokeWidth={2}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}
