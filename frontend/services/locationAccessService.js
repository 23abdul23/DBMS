const DEFAULT_DENIED_TITLE = 'Access Out Of Bounds';
const DEFAULT_DENIED_MESSAGE =
  'You are not within the required location proximity. Current access attempt is outside the allowed campus range.';
const DEFAULT_ACTION_LABEL = 'Go To Dashboard';

export const buildLocationAccessDeniedCopy = ({
  title,
  message,
  actionLabel = DEFAULT_ACTION_LABEL,
  distance = null,
  targetLocation = null,
  failureType = 'out_of_range',
} = {}) => {
  if (title || message) {
    return {
      title: title || DEFAULT_DENIED_TITLE,
      message: message || DEFAULT_DENIED_MESSAGE,
      actionLabel,
      distance,
      targetLocation,
    };
  }

  if (failureType === 'location_required') {
    return {
      title: 'Location Required',
      message:
        'We could not verify your location right now. Please enable location access and try again.',
      actionLabel,
      distance,
      targetLocation,
    };
  }

  return {
    title: DEFAULT_DENIED_TITLE,
    message:
      distance === null || distance === undefined
        ? DEFAULT_DENIED_MESSAGE
        : `You are not within the required location proximity. You are ${
            distance < 1000
              ? `${Math.round(distance)} meters`
              : `${(distance / 1000).toFixed(2)} kilometers`
          } away from ${targetLocation || 'the scanned location'}.`,
    actionLabel,
    distance,
    targetLocation,
  };
};
