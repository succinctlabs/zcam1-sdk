import {
  isAndroidBindings,
  isIOSBindings,
  type AndroidDeviceBindings,
  type DeviceBindings,
  type IOSDeviceBindings,
} from '../src/types';

describe('types', () => {
  describe('isIOSBindings', () => {
    it('should return true for iOS bindings', () => {
      const bindings: IOSDeviceBindings = {
        platform: 'ios',
        attestation: 'test-attestation',
        assertion: 'test-assertion',
      };

      expect(isIOSBindings(bindings)).toBe(true);
    });

    it('should return false for Android bindings', () => {
      const bindings: AndroidDeviceBindings = {
        platform: 'android',
        keyAttestationChain: 'test-chain',
        signature: 'test-signature',
      };

      expect(isIOSBindings(bindings)).toBe(false);
    });
  });

  describe('isAndroidBindings', () => {
    it('should return true for Android bindings', () => {
      const bindings: AndroidDeviceBindings = {
        platform: 'android',
        keyAttestationChain: 'test-chain',
        signature: 'test-signature',
      };

      expect(isAndroidBindings(bindings)).toBe(true);
    });

    it('should return true for Android bindings with Play Integrity token', () => {
      const bindings: AndroidDeviceBindings = {
        platform: 'android',
        keyAttestationChain: 'test-chain',
        signature: 'test-signature',
        playIntegrityToken: 'test-token',
      };

      expect(isAndroidBindings(bindings)).toBe(true);
      expect(bindings.playIntegrityToken).toBe('test-token');
    });

    it('should return false for iOS bindings', () => {
      const bindings: IOSDeviceBindings = {
        platform: 'ios',
        attestation: 'test-attestation',
        assertion: 'test-assertion',
      };

      expect(isAndroidBindings(bindings)).toBe(false);
    });
  });

  describe('DeviceBindings union type', () => {
    it('should allow narrowing with type guards', () => {
      const iosBindings: DeviceBindings = {
        platform: 'ios',
        attestation: 'test-attestation',
        assertion: 'test-assertion',
      };

      const androidBindings: DeviceBindings = {
        platform: 'android',
        keyAttestationChain: 'test-chain',
        signature: 'test-signature',
      };

      // Test type narrowing
      if (isIOSBindings(iosBindings)) {
        expect(iosBindings.attestation).toBe('test-attestation');
        expect(iosBindings.assertion).toBe('test-assertion');
      }

      if (isAndroidBindings(androidBindings)) {
        expect(androidBindings.keyAttestationChain).toBe('test-chain');
        expect(androidBindings.signature).toBe('test-signature');
      }
    });
  });
});
