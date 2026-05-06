import { StyleSheet } from 'react-native';
import { FONTS } from '../utils/constants';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 36,
  },
  heroShell: {
    marginTop: 50,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroCopy: {
    flex: 1,
    paddingRight: 14,
  },
  greeting: {
    fontSize: 15,
    fontFamily: FONTS.regular,
  },
  userName: {
    fontSize: 31,
    fontFamily: FONTS.bold,
    marginTop: 6,
    lineHeight: 36,
  },
  studentId: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    marginTop: 8,
  },
  heroRightRail: {
    alignItems: 'flex-end',
  },
  roundIconButton: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoutButton: {
    marginTop: 12,
  },
  heroStatusRow: {
    flexDirection: 'row',
    marginTop: 22,
  },
  heroStatusCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    minHeight: 100,
  },
  heroStatusGap: {
    width: 12,
  },
  heroStatusLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 10,
  },
  heroStatusValue: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    marginTop: 6,
  },
  heroStatusMeta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 4,
    lineHeight: 18,
  },
  body: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 26,
    fontFamily: FONTS.bold,
    letterSpacing: 0.3,
    fontWeight: '700',
  },
  sectionCaption: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  sectionMeta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  quickActions: {
    marginBottom: 22,
  },
  announcementCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    marginBottom: 22,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 3,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  announcementTitle: {
    fontSize: 19,
    fontFamily: FONTS.bold,
    letterSpacing: 0.2,
  },
  announcementSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 4,
  },
  announcementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  announcementPillText: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    marginLeft: 6,
  },
  announcementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  announcementTone: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  announcementRowTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  announcementRowMessage: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 3,
    lineHeight: 17,
  },
  announcementTime: {
    fontSize: 11,
    fontFamily: FONTS.bold,
    marginLeft: 10,
    marginTop: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    marginBottom: 10,
  },
  actionCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionArrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    marginTop: 0,
    fontWeight: '700',
  },
  actionSubText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    marginTop: 3,
    lineHeight: 15,
  },
  insightGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  insightCard: {
    width: '48%',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    minHeight: 138,
  },
  insightValue: {
    fontSize: 28,
    fontFamily: FONTS.bold,
    marginTop: 16,
  },
  insightLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 8,
  },
  insightSubText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    marginTop: 5,
    lineHeight: 17,
  },
  activityCard: {
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityCopy: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  activityText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    lineHeight: 18,
    marginTop: 3,
  },
});
