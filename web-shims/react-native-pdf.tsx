import React from "react";
import { View, Text } from "react-native";

type PdfProps = {
  source?: { uri?: string };
  style?: any;
  onError?: (err: unknown) => void;
};

export default function Pdf({ source, style }: PdfProps) {
  const uri = source?.uri;
  if (!uri) {
    return (
      <View style={style}>
        <Text style={{ color: "#FFF" }}>No PDF source</Text>
      </View>
    );
  }
  return (
    <iframe
      src={uri}
      title="PDF"
      style={{
        border: "none",
        width: "100%",
        height: "100%",
        backgroundColor: "#111827",
      }}
    />
  );
}
