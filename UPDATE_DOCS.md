# Docs Update Checklist

Run this checklist at the end of any PR to ensure documentation stays in sync with code changes.

## Step 1: Identify what changed

Diff the PR branch against main to find code changes that affect the public API:

```bash
# All changed source files (excluding tests, examples, docs themselves)
git diff main --name-only -- \
  'react-native-zcam1/src/**' \
  'zcam1-verify/src/**'

# Show actual diffs for exports, types, props, and public methods
git diff main -- \
  react-native-zcam1/src/index.ts \
  react-native-zcam1/src/proving/index.ts \
  zcam1-verify/src/index.ts \
  zcam1-verify/src/index.node.ts

# Find new/changed exports
git diff main -- react-native-zcam1/src/index.ts | grep '^[+-].*export'

# Find changed type definitions, interfaces, and classes
git diff main -- 'react-native-zcam1/src/*.ts' 'react-native-zcam1/src/*.tsx' | grep '^[+-].*\(type \|interface \|class \|enum \)'

# Find changed props (ZCamera, ZImagePicker)
git diff main -- react-native-zcam1/src/camera.tsx react-native-zcam1/src/picker.tsx | grep '^[+-].*\?:'

# Find changed method signatures
git diff main -- react-native-zcam1/src/camera.tsx | grep '^[+-].*async \|^[+-].*): '

# Same for zcam1-verify
git diff main -- 'zcam1-verify/src/*.ts' | grep '^[+-].*export'
```

## Step 2: Cross-reference against docs

For each change found in Step 1, check the corresponding doc page:

### react-native-zcam1 mapping

| Code location | Doc page(s) |
|---|---|
| `src/index.ts` exports | All — every public export should appear in at least one doc page |
| `src/camera.tsx` ZCameraProps | `docs/docs/pages/sdk/capture/ZCamera.mdx` |
| `src/camera.tsx` methods (takePhoto, etc.) | `docs/docs/pages/sdk/capture/takePhoto.mdx` and siblings |
| `src/camera.tsx` TakePhotoOptions | `docs/docs/pages/sdk/capture/types.mdx` |
| `src/capture.tsx` initCapture, CaptureInfo | `docs/docs/pages/sdk/capture/initCapture.mdx`, `types.mdx` |
| `src/capture.tsx` previewFile | `docs/docs/pages/sdk/capture/previewFile.mdx` |
| `src/picker.tsx` ZImagePickerProps | `docs/docs/pages/sdk/picker.mdx` |
| `src/verify.tsx` VerifiableFile | `docs/docs/pages/sdk/verify-react-native/VerifiableFile.mdx` |
| `src/verify.tsx` CaptureMetadata | `docs/docs/pages/sdk/verify-react-native/types.mdx` |
| `src/proving/prove.tsx` ProvingClient | `docs/docs/pages/sdk/prove/types.mdx` |
| `src/proving/prove.tsx` ProverProvider | `docs/docs/pages/sdk/prove/ProverProvider.mdx` |
| `src/proving/prove.tsx` useProver | `docs/docs/pages/sdk/prove/useProver.mdx` |
| `src/proving/prove.tsx` Settings | `docs/docs/pages/sdk/prove/types.mdx` |
| `src/NativeZcam1Capture.ts` FlashMode | `docs/docs/pages/sdk/capture/types.mdx` |

### zcam1-verify mapping

| Code location | Doc page(s) |
|---|---|
| `src/index.ts` VerifiableFile | `docs/docs/pages/sdk/verify/VerifiableFile.mdx` |
| `src/index.node.ts` VerifiableBuffer | `docs/docs/pages/sdk/verify/VerifiableBuffer.mdx` |
| `src/core.ts` CaptureMetadata | `docs/docs/pages/sdk/verify/types.mdx` |
| Rust-generated types (PhotoMetadataInfo, etc.) | `docs/docs/pages/sdk/verify/types.mdx` |

### Shared types from Rust bindings

Types like `PhotoMetadataInfo`, `VideoMetadataInfo`, `AuthenticityData`, `DepthData`, `FilmStyleInfo` are generated from the Rust crate via uniffi. They appear in both:
- `docs/docs/pages/sdk/verify-react-native/types.mdx` (RN on-device)
- `docs/docs/pages/sdk/verify/types.mdx` (browser/Node.js)

If the Rust crate changes these types, **both** doc pages need updating.

## Step 3: Verify specific change categories

### New export added?
- [ ] Doc page exists or existing page updated
- [ ] Import path in doc examples is correct (test with `grep 'export.*TheName' react-native-zcam1/src/index.ts`)
- [ ] Type signature in docs matches code

### Prop added/changed on ZCamera or ZImagePicker?
- [ ] Prop listed in component doc page with correct type and default
- [ ] If prop uses a new type, that type is documented in `types.mdx`

### Method added/changed on ZCamera?
- [ ] Method listed in ZCamera.mdx methods section
- [ ] Dedicated method doc page exists if it's a primary API (like takePhoto)
- [ ] Return type documented correctly

### Type/interface changed?
- [ ] Updated in relevant `types.mdx` page(s)
- [ ] All fields present with correct types
- [ ] "Used by" references still accurate

### Return type changed?
- [ ] Doc page shows correct return type
- [ ] Code examples handle the return type correctly (e.g., `ResultAsync` needs `.isOk()` pattern, not `.then()`)

### Export removed?
- [ ] Doc page removed or marked deprecated
- [ ] No remaining references from other doc pages

## Step 4: Validate

```bash
# Ensure no doc references to exports that don't exist
# (manually check a few key ones)
grep -r 'verifyHash' docs/docs/pages/  # should return nothing

# Ensure all index.ts exports appear somewhere in docs
# Compare this list against doc pages:
grep 'export' react-native-zcam1/src/index.ts

# Check for broken internal doc links (relative paths)
grep -rn '\](/sdk/' docs/docs/pages/ | grep -v node_modules
```

## Step 5: Rebuild (optional)

If doc content changed:
```bash
cd docs && npm run build
```

Note: only rebuild if you want to update `docs/dist/`. This generates `llms-full.txt` and the static site. Skip if it makes the PR diff too noisy.

## Common mistakes caught by this process

- Documenting a function that isn't re-exported from `index.ts` (import will fail)
- Copy-pasting a browser example into Node.js docs (or vice versa)
- Listing methods on `VerifiableBuffer` that only exist on `VerifiableFile` (or vice versa)
- Forgetting to update both RN and web verify type pages when Rust types change
- Showing `Promise<T>` return types when the actual return is `ResultAsync<T, Error>`
- Missing fields on types (especially after adding new camera features)
- Stale "Limitations" sections that list restrictions that were since removed
