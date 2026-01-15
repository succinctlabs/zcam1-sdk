# `react-native-zcam1-picker`

`@succinctlabs/react-native-zcam1-picker` is the React Native image picker component used to browse and select images from either:

- The device photo gallery (via `@react-native-camera-roll/camera-roll`), or
- A private on-device folder (via `react-native-file-access`).

It is designed to pair with the ZCAM1 SDK pipeline by optionally computing an authenticity signal for each image (via `@succinctlabs/react-native-zcam1-c2pa`) and letting you render a badge overlay per item.

At a high level it provides:

- A `ZImagePicker` React component that renders a performant grid of images.
- A `privateDirectory()` helper that returns your app’s private document directory path.
- An `AuthenticityStatus` enum (re-exported) plus per-image status evaluation used for badges.

The Expo example app in `examples/e2e` shows a complete “pick → prove/upload” flow.

## Installation

```bash
npm i @succinctlabs/react-native-zcam1-picker
cd ios && pod install
```

Note: In this monorepo’s example apps you may see imports from `react-native-zcam1-picker`. That is a workspace/alias convenience for local development. In the published package, import from `@succinctlabs/react-native-zcam1-picker`.

## Permissions

### iOS (Photo Gallery)

If you use the photo gallery source, add a photo library usage string to your app’s `Info.plist`:

- `NSPhotoLibraryUsageDescription`

### Android (Photo Gallery)

If you use the photo gallery source, ensure your app requests the appropriate permissions.

For Android 13+:

- `android.permission.READ_MEDIA_IMAGES`

For older Android versions:

- `android.permission.READ_EXTERNAL_STORAGE` (legacy)

Exact permission requirements can vary based on Android version and your target SDK; configure and request permissions according to the needs of your app and the version of `@react-native-camera-roll/camera-roll` you’re using.

## Picking from a private folder vs photo gallery

The picker supports two sources via the `source` prop:

- Private folder: `source={{ path: string }}`
- Photo gallery: `source={{ album?: string }}`

If you only need to display assets your app has already written into its sandbox, prefer the private folder source (it avoids photo library permissions).

## Basic usage

Render `ZImagePicker`, pass a `source`, and handle `onSelect(uri)` when the user taps an image.

```/dev/null/ZImagePickerBasic.tsx#L1-34
import { ZImagePicker, privateDirectory } from "@succinctlabs/react-native-zcam1-picker";

export function Screen() {
  return (
    <ZImagePicker
      source={{ path: privateDirectory() }}
      onSelect={(uri) => {
        // uri is typically a file:// URI when loading from a private folder
        console.log("Selected:", uri);
      }}
    />
  );
}
```

To load from the photo gallery (optionally scoped to an album):

```/dev/null/ZImagePickerGallery.tsx#L1-26
import { ZImagePicker } from "@succinctlabs/react-native-zcam1-picker";

export function Screen() {
  return (
    <ZImagePicker
      source={{ album: "MyAlbum" }}
      onSelect={(uri) => {
        console.log("Selected:", uri);
      }}
    />
  );
}
```

## Rendering authenticity badges

`ZImagePicker` can call into the C2PA authenticity checker for each image and pass the resulting `AuthenticityStatus` into your `renderBadge` callback. You can use that to overlay icons (e.g. “bindings” vs “proof”) on top of each thumbnail.

```/dev/null/ZImagePickerBadges.tsx#L1-55
import { Image } from "react-native";
import { ZImagePicker, AuthenticityStatus, privateDirectory } from "@succinctlabs/react-native-zcam1-picker";

const renderBadge = (status: AuthenticityStatus): React.ReactElement | null => {
  switch (status) {
    case AuthenticityStatus.Bindings:
      return (
        <Image
          source={require("./assets/bindings.png")}
          style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18 }}
          resizeMode="contain"
        />
      );
    case AuthenticityStatus.Proof:
      return (
        <Image
          source={require("./assets/proof.png")}
          style={{ position: "absolute", top: 6, right: 6, width: 18, height: 18 }}
          resizeMode="contain"
        />
      );
    default:
      return null;
  }
};

export function Screen() {
  return (
    <ZImagePicker
      source={{ path: privateDirectory() }}
      renderBadge={renderBadge}
      onSelect={(uri) => console.log("Selected:", uri)}
    />
  );
}
```

## Limitations / notes

- "Photo gallery source (`album`) loads a maximum of 20 photos. This limitation does not apply to private folder source (`path`) since it loads all available photos."
  - Why do we need `album` as a source? Can we nuke this?
- Only photos are shown (no videos).
- Single-selection only (tap returns one `uri` via `onSelect`).
- This package does not request runtime permissions for you; handle permission prompts in your app before rendering a photo gallery source.
