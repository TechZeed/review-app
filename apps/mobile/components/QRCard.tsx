import React from "react";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

interface QRCardProps {
  value: string;
  /** `QRCode` ref accessor for exporting as PNG via `toDataURL(callback)`. */
  getRef?: (c: unknown) => void;
}

export function QRCard({ value, getRef }: QRCardProps) {
  return (
    <View style={styles.wrapper} testID="share-qr-image">
      <View style={styles.card}>
        <QRCode value={value} size={240} backgroundColor="#ffffff" getRef={getRef} />
      </View>
      <Text style={styles.url} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  url: {
    marginTop: 14,
    color: "#475569",
    fontSize: 13,
    fontFamily: "Menlo",
    textAlign: "center",
  },
});

export default QRCard;
