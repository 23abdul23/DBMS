import { StyleSheet } from 'react-native';
import { COLORS, FONTS, SIZES, SPACING } from '../utils/constants';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: SIZES.xl,
    fontFamily: FONTS.bold,
  },
  headerSubtitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginTop: SPACING.xs,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    color: COLORS.gray[600],
    marginBottom: SPACING.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  statLabel: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginBottom: SPACING.xs,
  },
  statValue: {
    fontSize: SIZES.xxl,
    fontFamily: FONTS.bold,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  card: {
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: SIZES.md,
    fontFamily: FONTS.bold,
  },
  metaText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    marginTop: SPACING.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: SPACING.sm,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  badgeText: {
    fontSize: SIZES.xs,
    fontFamily: FONTS.bold,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  secondaryActionButton: {
    marginRight: 0,
  },
  actionButtonText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.bold,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: SIZES.lg,
    fontFamily: FONTS.bold,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: SIZES.sm,
    fontFamily: FONTS.regular,
    textAlign: 'center',
    marginTop: SPACING.xs,
    maxWidth: 260,
  },
});
