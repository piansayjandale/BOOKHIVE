import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../hooks/useThemeColors';
import { useAuth } from '../data/AuthContext';
import {
  getStudentProfile,
  loadStudentIdCardsForUser,
  rotateIdCardSlot,
  toggleIdCardsOrientation,
  StudentIdCardsData,
  subscribe,
} from '../data/store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface StudentIdCardsPopupProps {
  visible: boolean;
  onClose: () => void;
}

export default function StudentIdCardsPopup({
  visible,
  onClose,
}: StudentIdCardsPopupProps) {
  const insets = useSafeAreaInsets();
  const { isDarkMode, theme } = useThemeColors();
  const { user } = useAuth();
  const profile = getStudentProfile();

  const [idCards, setIdCards] = useState<StudentIdCardsData | null>(null);
  const [enlargedPhoto, setEnlargedPhoto] = useState<{
    title: string;
    uri: string;
    slotKey?: string;
    rotation?: number;
    orientation?: "portrait" | "landscape";
  } | null>(null);

  const studentFullName =
    (user as any)?.name ||
    user?.fullName ||
    profile.name ||
    (profile as any)?.fullName ||
    "Student User";

  const studentIdNumber =
    user?.studentId ||
    profile.studentId ||
    user?.id ||
    "23-1111-111";

  const loadCards = async () => {
    const targetUser = user || profile;
    let baseCards: StudentIdCardsData | null = null;
    if (user?.schoolIdFront || profile?.schoolIdFront) {
      baseCards = {
        schoolIdFront: String(user?.schoolIdFront || profile?.schoolIdFront),
        schoolIdBack: String(user?.schoolIdBack || profile?.schoolIdBack),
        libraryIdFront: String(user?.libraryIdFront || profile?.libraryIdFront),
        libraryIdBack: String(user?.libraryIdBack || profile?.libraryIdBack),
        ownerEmail: user?.email || profile?.email,
        ownerStudentId: user?.studentId || profile?.studentId,
      };
    }
    const stored = await loadStudentIdCardsForUser(targetUser);
    const merged: StudentIdCardsData = {
      ...(baseCards || {}),
      ...(stored || {}),
      schoolIdFront: stored?.schoolIdFront || baseCards?.schoolIdFront,
      schoolIdBack: stored?.schoolIdBack || baseCards?.schoolIdBack,
      libraryIdFront: stored?.libraryIdFront || baseCards?.libraryIdFront,
      libraryIdBack: stored?.libraryIdBack || baseCards?.libraryIdBack,
      orientation: stored?.orientation || (baseCards as any)?.orientation || "portrait",
      rotations: { ...(baseCards?.rotations || {}), ...(stored?.rotations || {}) },
    };
    setIdCards(merged);
  };

  useEffect(() => {
    if (visible) {
      void loadCards();
    }
    const unsub = subscribe(() => {
      if (visible) void loadCards();
    });
    return unsub;
  }, [visible, user]);

  const isPortrait = (idCards?.orientation || "portrait") === "portrait";

  const handleRotateEnlarged = async () => {
    if (!enlargedPhoto) return;
    const targetSlot = enlargedPhoto.slotKey;
    const nextRot = ((enlargedPhoto.rotation || 0) + 90) % 360;

    setEnlargedPhoto((prev) => (prev ? { ...prev, rotation: nextRot } : null));

    if (targetSlot) {
      setIdCards((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rotations: {
            ...(prev.rotations || {}),
            [targetSlot]: nextRot,
          },
        };
      });

      const targetEmail = user?.email || profile?.email;
      const targetStudentId = user?.studentId || profile?.studentId;
      await rotateIdCardSlot(targetSlot, targetEmail, targetStudentId, 90);
    }
  };

  const handleToggleOrientation = async () => {
    const currentOri = enlargedPhoto?.orientation || idCards?.orientation || "portrait";
    const nextOri = currentOri === "portrait" ? "landscape" : "portrait";

    setEnlargedPhoto((prev) => (prev ? { ...prev, orientation: nextOri } : null));
    setIdCards((prev) => (prev ? { ...prev, orientation: nextOri } : null));

    const targetEmail = user?.email || profile?.email;
    const targetStudentId = user?.studentId || profile?.studentId;
    await toggleIdCardsOrientation(targetEmail, targetStudentId);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: isDarkMode ? "#0F172A" : "#FFFFFF",
              borderColor: isDarkMode ? "#24334C" : "#CBD5E1",
            },
          ]}
        >
          {/* Top Header with title and prominent X icon at corner */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View
                style={[
                  styles.badgeCircle,
                  {
                    backgroundColor: isDarkMode
                      ? "rgba(250, 204, 21, 0.15)"
                      : "rgba(2, 116, 187, 0.1)",
                  },
                ]}
              >
                <Ionicons
                  name="id-card"
                  size={20}
                  color={isDarkMode ? theme.accentGold : theme.accentBlue}
                />
              </View>
              <View>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDarkMode ? "#F8FAFC" : "#0F172A" },
                  ]}
                >
                  School ID
                </Text>
                <Text
                  style={[styles.modalSubtitle, { color: theme.textSecondary }]}
                >
                  {studentFullName} • {studentIdNumber}
                </Text>
              </View>
            </View>

            {/* X Icon Button at top corner */}
            <TouchableOpacity
              style={[
                styles.closeIconBtn,
                {
                  backgroundColor: isDarkMode
                    ? "rgba(255, 255, 255, 0.08)"
                    : "#F1F5F9",
                },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityLabel="Close ID cards popup"
            >
              <Ionicons
                name="close"
                size={22}
                color={isDarkMode ? "#F8FAFC" : "#0F172A"}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* SCHOOL ID (FRONT & BACK) */}
            <View style={styles.sectionHeaderRow}>
              <Ionicons
                name="school"
                size={16}
                color={isDarkMode ? theme.accentGold : "#0274BB"}
              />
              <Text
                style={[
                  styles.sectionHeading,
                  { color: isDarkMode ? theme.accentGold : "#0274BB" },
                ]}
              >
                School ID (Front & Back)
              </Text>
            </View>

            <View style={styles.slotsGrid}>
              {/* School ID Front */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (idCards?.schoolIdFront) {
                    setEnlargedPhoto({
                      title: "School ID • Front",
                      uri: idCards.schoolIdFront,
                      slotKey: "schoolIdFront",
                      rotation: idCards?.rotations?.schoolIdFront || 0,
                      orientation: idCards?.orientation || "portrait",
                    });
                  }
                }}
                style={[
                  styles.slotCard,
                  {
                    backgroundColor: isDarkMode ? "#111C33" : "#F8FAFC",
                    borderColor: isDarkMode ? "#263554" : "#CBD5E1",
                  },
                ]}
              >
                <View style={styles.slotLabelRow}>
                  <Text
                    style={[
                      styles.slotLabel,
                      { color: isDarkMode ? "#E2E8F0" : "#1E293B" },
                    ]}
                  >
                    Front
                  </Text>
                  <Ionicons
                    name="expand-outline"
                    size={14}
                    color={isDarkMode ? "#94A3B8" : "#64748B"}
                  />
                </View>
                {idCards?.schoolIdFront ? (
                  <View
                    style={[
                      styles.previewWrap,
                      { height: isPortrait ? 165 : 100 },
                    ]}
                  >
                    <Image
                      source={{ uri: idCards.schoolIdFront }}
                      style={[
                        styles.previewImage,
                        Boolean(idCards?.rotations?.schoolIdFront)
                          ? {
                              transform: [
                                {
                                  rotate: `${idCards?.rotations?.schoolIdFront}deg`,
                                },
                              ],
                            }
                          : null,
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.emptyWrap,
                      { height: isPortrait ? 165 : 100 },
                    ]}
                  >
                    <Ionicons name="image-outline" size={24} color="#94A3B8" />
                    <Text style={styles.emptyText}>Front Missing</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* School ID Back */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (idCards?.schoolIdBack) {
                    setEnlargedPhoto({
                      title: "School ID • Back",
                      uri: idCards.schoolIdBack,
                      slotKey: "schoolIdBack",
                      rotation: idCards?.rotations?.schoolIdBack || 0,
                      orientation: idCards?.orientation || "portrait",
                    });
                  }
                }}
                style={[
                  styles.slotCard,
                  {
                    backgroundColor: isDarkMode ? "#111C33" : "#F8FAFC",
                    borderColor: isDarkMode ? "#263554" : "#CBD5E1",
                  },
                ]}
              >
                <View style={styles.slotLabelRow}>
                  <Text
                    style={[
                      styles.slotLabel,
                      { color: isDarkMode ? "#E2E8F0" : "#1E293B" },
                    ]}
                  >
                    Back
                  </Text>
                  <Ionicons
                    name="expand-outline"
                    size={14}
                    color={isDarkMode ? "#94A3B8" : "#64748B"}
                  />
                </View>
                {idCards?.schoolIdBack ? (
                  <View
                    style={[
                      styles.previewWrap,
                      { height: isPortrait ? 165 : 100 },
                    ]}
                  >
                    <Image
                      source={{ uri: idCards.schoolIdBack }}
                      style={[
                        styles.previewImage,
                        Boolean(idCards?.rotations?.schoolIdBack)
                          ? {
                              transform: [
                                {
                                  rotate: `${idCards?.rotations?.schoolIdBack}deg`,
                                },
                              ],
                            }
                          : null,
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.emptyWrap,
                      { height: isPortrait ? 165 : 100 },
                    ]}
                  >
                    <Ionicons name="image-outline" size={24} color="#94A3B8" />
                    <Text style={styles.emptyText}>Back Missing</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: 11.5,
                color: isDarkMode ? "#94A3B8" : "#64748B",
                textAlign: "center",
                marginTop: 16,
              }}
            >
              Tap any ID card to view full screen or rotate.
            </Text>
          </ScrollView>

          {/* Bottom Close Button */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.dismissBtn,
                {
                  backgroundColor: isDarkMode
                    ? theme.accentGold
                    : theme.accentBlue,
                },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.dismissBtnText,
                  { color: isDarkMode ? "#080F1E" : "#FFFFFF" },
                ]}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* FULL-SCREEN SINGLE ID CARD ZOOM MODAL WITH ROTATE */}
      <Modal
        visible={Boolean(enlargedPhoto)}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlargedPhoto(null)}
      >
        <View style={styles.viewerBackdrop}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => setEnlargedPhoto(null)}
              style={styles.viewerBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
              <Text style={styles.viewerBackBtnText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.viewerHeaderTitle}>
              {enlargedPhoto?.title || "ID Card"}
            </Text>
            <TouchableOpacity
              onPress={handleRotateEnlarged}
              style={styles.viewerHeaderRotateBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color="#FACC15" />
              <Text style={styles.viewerHeaderRotateBtnText}>Rotate</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.viewerBody}>
            {enlargedPhoto?.uri ? (
              <Image
                source={{ uri: enlargedPhoto.uri }}
                style={{
                  width:
                    (enlargedPhoto.orientation ||
                      idCards?.orientation ||
                      "portrait") === "portrait"
                      ? Math.min(SCREEN_WIDTH - 48, 290)
                      : SCREEN_WIDTH - 32,
                  height:
                    (enlargedPhoto.orientation ||
                      idCards?.orientation ||
                      "portrait") === "portrait"
                      ? Math.min(SCREEN_WIDTH - 48, 290) * 1.48
                      : (SCREEN_WIDTH - 32) * 0.65,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: "#FACC15",
                  transform: [{ rotate: `${enlargedPhoto.rotation || 0}deg` }],
                }}
                resizeMode="contain"
              />
            ) : null}
          </View>

          <View
            style={[
              styles.viewerBottomContainer,
              { paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={{ flexDirection: "row", gap: 10, width: "100%" }}>
              <TouchableOpacity
                style={styles.viewerRotateActionBtn}
                onPress={handleRotateEnlarged}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="refresh"
                  size={18}
                  color="#080F1E"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.viewerRotateActionText}>Rotate 90°</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.viewerOrientationActionBtn}
                onPress={handleToggleOrientation}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={
                    (enlargedPhoto?.orientation ||
                      idCards?.orientation ||
                      "portrait") === "portrait"
                      ? "phone-portrait"
                      : "phone-landscape"
                  }
                  size={18}
                  color="#FACC15"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.viewerOrientationActionText}>
                  {(enlargedPhoto?.orientation ||
                    idCards?.orientation ||
                    "portrait") === "portrait"
                    ? "Portrait Frame"
                    : "Landscape Frame"}
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.viewerBottomCloseBtn}
              onPress={() => setEnlargedPhoto(null)}
              activeOpacity={0.8}
            >
              <Ionicons
                name="close"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.viewerBottomCloseText}>Close Preview</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "88%",
    borderRadius: 24,
    borderWidth: 1.5,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  badgeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 1,
  },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  slotsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  slotCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 8,
  },
  slotLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  previewWrap: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#080F1E",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  emptyWrap: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(148, 163, 184, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  emptyText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  modalFooter: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  dismissBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: "800",
  },
  /* Fullscreen viewer modal */
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 8, 18, 0.96)",
    justifyContent: "space-between",
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  viewerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  viewerBackBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  viewerHeaderTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  viewerHeaderRotateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(250, 204, 21, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.4)",
  },
  viewerHeaderRotateBtnText: {
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "700",
  },
  viewerBody: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  viewerBottomContainer: {
    flexDirection: "column",
    gap: 10,
    paddingHorizontal: 24,
  },
  viewerRotateActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#FACC15",
  },
  viewerRotateActionText: {
    color: "#080F1E",
    fontSize: 14,
    fontWeight: "800",
  },
  viewerOrientationActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(250, 204, 21, 0.4)",
  },
  viewerOrientationActionText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontWeight: "700",
  },
  viewerBottomCloseBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  viewerBottomCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
