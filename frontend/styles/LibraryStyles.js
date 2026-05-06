import { StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../utils/constants';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  // SECTION CARD
  subText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    marginBottom: 4,
  },
  secondaryText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 8,
  },

  // Issued Books
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
  },

  headerTitle: {
    marginTop: 0,
    fontSize: 24, // Larger
    fontWeight: 'bold', // Bolder
    flex: 1,
    textAlign: 'center',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },

  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  inlineText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },

  seatNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e74c3c',
    textAlign: 'center',
  },

  notifyBar: {
    marginTop: 10,
    backgroundColor: '#eee',
    padding: 8,
    borderRadius: 6,
  },

  notifyText: {
    fontSize: 14,
    textAlign: 'center',
  },

  issuedBooksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  bookCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4a90e2',
  },

  bookTableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },

  tableHeaderCol: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 13,
  },

  bookRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },

  dueBookRow: {
    backgroundColor: '#ffe6e6',
    borderRadius: 6,
  },

  bookCol: {
    flex: 1,
    fontSize: 13,
  },

  dueText: {
    color: 'red',
    fontWeight: 'bold',
    fontSize: 12,
  },

  statusCard: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },

  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },

  statusContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 10,
  },

  bigNumber: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#4a90e2',
    lineHeight: 80,
    marginRight: 20,
  },

  statusDescriptionContainer: {
    justifyContent: 'center',
  },

  descriptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginVertical: 2,
  },
});
