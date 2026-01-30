import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps, HostComponent } from 'react-native';
import type { Float, WithDefault } from 'react-native/Libraries/Types/CodegenTypes';

/**
 * Native props for Zcam1CameraView.
 * These must match the RCT_EXPORT_VIEW_PROPERTY declarations in Zcam1CameraViewManager.m
 */
export interface NativeProps extends ViewProps {
  isActive?: boolean;
  position?: WithDefault<'front' | 'back', 'back'>;
  captureFormat?: WithDefault<'jpeg' | 'dng', 'jpeg'>;
  zoom?: Float;
  torch?: boolean;
  exposure?: Float;
  filter?: WithDefault<'normal' | 'vivid' | 'warm' | 'cool', 'normal'>;
}

/**
 * Codegen spec for Zcam1CameraView.
 * Uses interfaceOnly mode to enable Fabric interop with the legacy RCTViewManager.
 */
export default codegenNativeComponent<NativeProps>('Zcam1CameraView', {
  interfaceOnly: true,
  paperComponentName: 'Zcam1CameraView',
}) as HostComponent<NativeProps>;
