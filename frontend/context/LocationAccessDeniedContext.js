import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Modal, StatusBar, View } from 'react-native';
import { useTheme } from './ThemeContext';
import LocationAccessDeniedCard from '../components/LocationAccessDeniedCard';

const DEFAULT_TITLE = 'Access Out Of Bounds';
const DEFAULT_MESSAGE =
  'You are not within the required location proximity. Current access attempt is outside the allowed campus range.';
const DEFAULT_ACTION_LABEL = 'Go To Dashboard';
const DEBUG_LOCATION_ACCESS = __DEV__;

const locationAccessLog = (event, payload = {}) => {
  if (!DEBUG_LOCATION_ACCESS) {
    console.log('[LOCATION_ACCESS]', JSON.stringify({ event, ...payload }));
  }
  return;
};

const LocationAccessDeniedContext = createContext(null);

export const useLocationAccessDenied = () => {
  const context = useContext(LocationAccessDeniedContext);

  if (!context) {
    throw new Error(
      'useLocationAccessDenied must be used within a LocationAccessDeniedProvider'
    );
  }

  return context;
};

export const LocationAccessDeniedProvider = ({ children }) => {
  const { colors } = useTheme();
  const [state, setState] = useState({
    visible: false,
    title: DEFAULT_TITLE,
    message: DEFAULT_MESSAGE,
    actionLabel: DEFAULT_ACTION_LABEL,
    distance: null,
    targetLocation: null,
    onConfirm: null,
  });
  const visibleRef = useRef(false);

  useEffect(() => {
    visibleRef.current = state.visible;
  }, [state.visible]);

  const hideLocationAccessDenied = useCallback(() => {
    locationAccessLog('modal-close', {
      title: state.title,
      targetLocation: state.targetLocation,
    });
    setState((current) => ({
      ...current,
      visible: false,
      onConfirm: null,
    }));
  }, [state.targetLocation, state.title]);

  const showLocationAccessDenied = useCallback((payload = {}) => {
    if (visibleRef.current) {
      return;
    }

    visibleRef.current = true;
    locationAccessLog('modal-open', {
      title: payload.title || DEFAULT_TITLE,
      targetLocation: payload.targetLocation || null,
      distance: payload.distance === undefined ? null : payload.distance,
    });
    setState({
      visible: true,
      title: payload.title || DEFAULT_TITLE,
      message: payload.message || DEFAULT_MESSAGE,
      actionLabel: payload.actionLabel || DEFAULT_ACTION_LABEL,
      distance: payload.distance === undefined ? null : payload.distance,
      targetLocation: payload.targetLocation || null,
      onConfirm: payload.onConfirm || null,
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    const confirm = state.onConfirm;
    locationAccessLog('confirm-pressed', {
      title: state.title,
      targetLocation: state.targetLocation,
    });
    hideLocationAccessDenied();

    if (typeof confirm === 'function') {
      locationAccessLog('navigation-start', {
        title: state.title,
        targetLocation: state.targetLocation,
      });
      await confirm();
      locationAccessLog('navigation-complete', {
        title: state.title,
        targetLocation: state.targetLocation,
      });
    }
  }, [hideLocationAccessDenied, state.onConfirm]);

  const contextValue = useMemo(
    () => ({
      showLocationAccessDenied,
      hideLocationAccessDenied,
      isLocationAccessDeniedVisible: state.visible,
    }),
    [hideLocationAccessDenied, showLocationAccessDenied, state.visible]
  );

  return (
    <LocationAccessDeniedContext.Provider value={contextValue}>
      {children}

      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleConfirm}
      >
        <StatusBar
          backgroundColor={colors.modalBackdrop}
          barStyle="light-content"
        />
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 18,
            backgroundColor: colors.modalBackdrop,
          }}
        >
          <LocationAccessDeniedCard
            visible={state.visible}
            title={state.title}
            message={state.message}
            onConfirm={handleConfirm}
            actionLabel={state.actionLabel}
            distance={state.distance}
            targetLocation={state.targetLocation}
          />
        </View>
      </Modal>
    </LocationAccessDeniedContext.Provider>
  );
};
