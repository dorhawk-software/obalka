import RNHaptic from 'react-native-haptic-feedback';
import { haptics } from '../../src/services/haptics';

// jest.setup.js mocks the native module's `trigger` with a jest.fn.
const trigger = RNHaptic.trigger as unknown as jest.Mock;

describe('haptics', () => {
  beforeEach(() => trigger.mockReset());

  it('maps each semantic kind to the right native feedback type', () => {
    haptics.selection();
    haptics.light();
    haptics.medium();
    haptics.success();
    haptics.warning();
    haptics.error();
    expect(trigger.mock.calls.map(c => c[0])).toEqual([
      'selection',
      'impactLight',
      'impactMedium',
      'notificationSuccess',
      'notificationWarning',
      'notificationError',
    ]);
  });

  it('honours system haptics + no crude vibrate fallback', () => {
    haptics.selection();
    expect(trigger).toHaveBeenCalledWith('selection', {
      enableVibrateFallback: false,
      ignoreAndroidSystemSettings: false,
    });
  });

  it('never throws if the native trigger fails (feedback must not break the interaction)', () => {
    trigger.mockImplementationOnce(() => {
      throw new Error('no native module');
    });
    expect(() => haptics.medium()).not.toThrow();
  });
});
