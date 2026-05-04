"use client"

import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native"
import { useMemo } from "react"
import { FONTS, SIZES, SPACING } from "../utils/constants"
import { useTheme } from "../context/ThemeContext"

export default function FilterTabs({ options, activeFilter, onFilterChange }) {
  const { colors } = useTheme()
  const totalWidth = useMemo(() => options.length * 124, [options.length])

  return (
    <View style={[styles.container, { backgroundColor: "transparent", borderBottomColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { minWidth: totalWidth }]}>
        {options.map((option) => {
          const active = activeFilter === option.key

          return (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.primary : colors.cardMuted,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onFilterChange(option.key)}
            >
              <Text style={[styles.tabText, { color: active ? colors.onPrimary : colors.subText }]}>{option.label}</Text>
              {option.count > 0 ? (
                <View style={[styles.badge, { backgroundColor: active ? "rgba(255,255,255,0.18)" : colors.cardElevated }]}>
                  <Text style={[styles.badgeText, { color: active ? colors.onPrimary : colors.text }]}>{option.count}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginRight: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  badge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: SPACING.xs,
    minWidth: 20,
    alignItems: "center",
  },
  badgeText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
  },
})
