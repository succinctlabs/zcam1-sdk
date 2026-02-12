import type { ECKey } from '@succinctlabs/react-native-zcam1-common';

import {
  createAndroidBindings,
  createDeviceBindings,
  createIOSBindings,
  getBindingsPlatform,
  serializeBindings,
} from '../src/bindings';
import type { CaptureInfo } from '../src/types';

describe('bindings', () => {
  const mockContentPublicKey: ECKey = {
    kty: 'EC',
    crv: 'P-256',
    x: 'test-x',
    y: 'test-y',
  };

  describe('createIOSBindings', () => {
    it('should create iOS bindings with attestation and assertion', () => {
      const bindings = createIOSBindings('attestation-data', 'assertion-data');

      expect(bindings.platform).toBe('ios');
      expect(bindings.attestation).toBe('attestation-data');
      expect(bindings.assertion).toBe('assertion-data');
    });
  });

  describe('createAndroidBindings', () => {
    it('should create Android bindings with key attestation and signature', () => {
      const bindings = createAndroidBindings('cert-chain', 'signature-data');

      expect(bindings.platform).toBe('android');
      expect(bindings.keyAttestationChain).toBe('cert-chain');
      expect(bindings.signature).toBe('signature-data');
      expect(bindings.playIntegrityToken).toBeUndefined();
    });

    it('should create Android bindings with Play Integrity token', () => {
      const bindings = createAndroidBindings('cert-chain', 'signature-data', 'integrity-token');

      expect(bindings.platform).toBe('android');
      expect(bindings.keyAttestationChain).toBe('cert-chain');
      expect(bindings.signature).toBe('signature-data');
      expect(bindings.playIntegrityToken).toBe('integrity-token');
    });
  });

  describe('createDeviceBindings', () => {
    it('should create iOS bindings from iOS CaptureInfo', () => {
      const captureInfo: CaptureInfo = {
        appId: 'test-app',
        deviceKeyId: 'device-key-id',
        contentPublicKey: mockContentPublicKey,
        contentKeyId: new Uint8Array([1, 2, 3]),
        platform: 'ios',
        attestation: 'ios-attestation',
      };

      const bindings = createDeviceBindings(captureInfo, 'ios-assertion');

      expect(bindings.platform).toBe('ios');
      if (bindings.platform === 'ios') {
        expect(bindings.attestation).toBe('ios-attestation');
        expect(bindings.assertion).toBe('ios-assertion');
      }
    });

    it('should create Android bindings from Android CaptureInfo', () => {
      const captureInfo: CaptureInfo = {
        appId: 'test-app',
        deviceKeyId: 'device-key-id',
        contentPublicKey: mockContentPublicKey,
        contentKeyId: new Uint8Array([1, 2, 3]),
        platform: 'android',
        attestation: 'android-cert-chain',
      };

      const bindings = createDeviceBindings(captureInfo, 'android-signature');

      expect(bindings.platform).toBe('android');
      if (bindings.platform === 'android') {
        expect(bindings.keyAttestationChain).toBe('android-cert-chain');
        expect(bindings.signature).toBe('android-signature');
        expect(bindings.playIntegrityToken).toBeUndefined();
      }
    });

    it('should create Android bindings with Play Integrity token', () => {
      const captureInfo: CaptureInfo = {
        appId: 'test-app',
        deviceKeyId: 'device-key-id',
        contentPublicKey: mockContentPublicKey,
        contentKeyId: new Uint8Array([1, 2, 3]),
        platform: 'android',
        attestation: 'android-cert-chain',
        playIntegrityToken: 'play-integrity-token',
      };

      const bindings = createDeviceBindings(captureInfo, 'android-signature');

      expect(bindings.platform).toBe('android');
      if (bindings.platform === 'android') {
        expect(bindings.playIntegrityToken).toBe('play-integrity-token');
      }
    });
  });

  describe('serializeBindings', () => {
    it('should serialize iOS bindings to JSON', () => {
      const bindings = createIOSBindings('attestation', 'assertion');
      const json = serializeBindings(bindings);
      const parsed = JSON.parse(json);

      expect(parsed.platform).toBe('ios');
      expect(parsed.attestation).toBe('attestation');
      expect(parsed.assertion).toBe('assertion');
    });

    it('should serialize Android bindings to JSON', () => {
      const bindings = createAndroidBindings('chain', 'sig', 'token');
      const json = serializeBindings(bindings);
      const parsed = JSON.parse(json);

      expect(parsed.platform).toBe('android');
      expect(parsed.keyAttestationChain).toBe('chain');
      expect(parsed.signature).toBe('sig');
      expect(parsed.playIntegrityToken).toBe('token');
    });
  });

  describe('getBindingsPlatform', () => {
    it('should return ios for iOS bindings', () => {
      const bindings = createIOSBindings('attestation', 'assertion');
      expect(getBindingsPlatform(bindings)).toBe('ios');
    });

    it('should return android for Android bindings', () => {
      const bindings = createAndroidBindings('chain', 'sig');
      expect(getBindingsPlatform(bindings)).toBe('android');
    });
  });
});
