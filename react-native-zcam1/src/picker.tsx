import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { FlashList, useRecyclingState } from "@shopify/flash-list";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Image, StyleSheet, TouchableOpacity, View } from "react-native";
import { createThumbnail } from "react-native-create-thumbnail";
import { Dirs, FileSystem, Util } from "react-native-file-access";

import { AuthenticityStatus, authenticityStatus } from "./bindings";
import { stripFileProtocol } from "./utils";

/**
 * Configuration for loading images from a private folder.
 */
export interface PrivateFolder {
  /**
   * The file system path to the private folder containing images.
   */
  path: string;
}

/**
 * Configuration for loading images from the device's photo gallery.
 */
export interface PhotoGallery {
  /**
   * The name of the album to load images from.
   */
  album?: string;
}

/**
 * Props for the ZImagePicker component.
 */
export interface ZImagePickerProps {
  /**
   * The source from which to load images. Can be either a PrivateFolder or PhotoGallery.
   */
  source: PrivateFolder | PhotoGallery;

  /**
   * Change this value to force the picker to reload images.
   * Useful when the underlying folder/album contents may have changed
   * while this screen stayed mounted.
   */
  refreshToken?: string | number;

  /**
   * Whether to start rendering images from the bottom of the list.
   * Defaults to false (renders from top).
   */
  renderFromBottom?: boolean;

  /**
   * Sort order for images.
   * Defaults to 'oldest-first' (oldest images first in the list).
   */
  sortOrder?: "newest-first" | "oldest-first";

  /**
   * Optional function to render a badge based on the authenticity status of an image.
   * @param status - The authenticity status of the image.
   * @returns A React element to display as a badge, or null to display nothing.
   */
  renderBadge?: (uri: string, status: AuthenticityStatus) => React.ReactElement | null;

  /**
   * Optional callback function that is called when an image is selected.
   * @param uri - The URI of the selected image.
   */
  onSelect?: (uri: string) => void;

  /**
   * Enable multi-selection mode.
   * Defaults to false (single-selection mode).
   */
  multiSelect?: boolean;

  /**
   * Array of currently selected image URIs. Only used when multiSelect is true.
   */
  selectedUris?: string[];

  /**
   * Optional callback function that is called when the selection changes in multi-select mode.
   * @param uris - Array of currently selected image URIs.
   */
  onSelectionChange?: (uris: string[]) => void;

  /**
   * Optional function to render a selection overlay when an image is selected in multi-select mode.
   * @param uri - The URI of the image.
   * @param isSelected - Whether the image is currently selected.
   * @returns A React element to display as a selection overlay, or null to display nothing.
   */
  renderSelectionOverlay?: (uri: string, isSelected: boolean) => React.ReactElement | null;
}

/**
 * Returns the path to the app's private document directory.
 * @returns {string} The path to the private document directory.
 */
export function privateDirectory(): string {
  return Dirs.DocumentDir;
}

const ZImageItem = ({
  uri,
  renderBadge,
  renderSelectionOverlay,
  onSelect,
  multiSelect,
  isSelected,
}: {
  uri: string;
  renderBadge?: (uri: string, status: AuthenticityStatus) => React.ReactElement | null;
  renderSelectionOverlay?: (uri: string, isSelected: boolean) => React.ReactElement | null;
  onSelect: (uri: string) => void;
  multiSelect?: boolean;
  isSelected?: boolean;
}) => {
  const [authStatus, setAuthStatus] = useRecyclingState(AuthenticityStatus.Unknown, [uri]);
  const [thumbnail, setThumbnail] = useRecyclingState(uri, [uri]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      const result = await authenticityStatus(uri);
      if (active) {
        setAuthStatus(result);
      }
    };

    check();
    return () => {
      active = false;
    };
  }, [uri, setAuthStatus]);

  useEffect(() => {
    const buildThumbnail = async () => {
      const ext = Util.extname(uri)?.toLowerCase();

      if (ext === "mov" || ext === "mp4") {
        const thumbnail = await createThumbnail({
          url: stripFileProtocol(uri),
        });
        setThumbnail(thumbnail.path);
      }
    };

    buildThumbnail();
  }, [uri, setThumbnail]);

  const badge = useMemo(() => {
    return renderBadge ? renderBadge(uri, authStatus) : null;
  }, [renderBadge, uri, authStatus]);

  const selectionOverlay = useMemo(() => {
    return multiSelect && renderSelectionOverlay
      ? renderSelectionOverlay(uri, isSelected ?? false)
      : null;
  }, [multiSelect, renderSelectionOverlay, uri, isSelected]);

  return (
    <TouchableOpacity style={styles.imageContainer} onPress={() => onSelect(uri)}>
      <Image style={styles.image} source={{ uri: thumbnail }} />
      {multiSelect && isSelected && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        />
      )}
      {badge}
      {selectionOverlay}
    </TouchableOpacity>
  );
};

/**
 * A component that displays a grid of images from either a private folder or photo gallery.
 * Each image can display an authenticity badge and be selected by the user.
 *
 * @example
 * ```tsx
 * // Load from private folder
 * <ZImagePicker
 *   source={{ path: privateDirectory() }}
 *   renderBadge={(status) => <Badge status={status} />}
 *   onSelect={(uri) => console.log('Selected:', uri)}
 * />
 *
 * // Load from photo gallery album
 * <ZImagePicker
 *   source={{ album: 'MyAlbum' }}
 *   onSelect={(uri) => console.log('Selected:', uri)}
 * />
 * ```
 */
export const ZImagePicker = (props: ZImagePickerProps) => {
  const {
    multiSelect,
    selectedUris,
    onSelectionChange,
    onSelect,
    renderBadge,
    renderSelectionOverlay,
    renderFromBottom,
    refreshToken,
    sortOrder,
    source,
  } = props;
  const [photos, setPhotos] = useState<string[]>([]);

  const sourceKey = useMemo(() => {
    if ("album" in source) return `album:${source.album ?? ""}`;
    else if ("path" in source) return `path:${source.path}`;
    else return "unknown";
  }, [source]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if ("album" in source) {
          const result = await CameraRoll.getPhotos({
            first: 20,
            groupTypes: "Album",
            groupName: source.album,
          });

          const sortMultiplier = sortOrder === "newest-first" ? -1 : 1;
          result.edges.sort(
            (a, b) =>
              sortMultiplier * (a.node.modificationTimestamp - b.node.modificationTimestamp),
          );

          const photoUris = result.edges
            .map((photo) => photo.node.image.uri)
            .filter((path) => path !== null);

          if (!cancelled) setPhotos(photoUris);
        } else if ("path" in source) {
          const photoFiles = await FileSystem.statDir(source.path);

          const photosWithTimestamps = photoFiles
            .filter((f) => f.type === "file")
            .filter((f) => !f.filename.startsWith("."))
            .map((f) => {
              const uri = `file://${f.path}`;
              // Parse timestamp from ZCAM filename: "zcam-1768552335459-random.jpg"
              const match = f.filename.match(/^zcam-(\d+)-/);
              const timestamp = match?.[1] ? parseInt(match[1], 10) : f.lastModified;
              return { uri, timestamp };
            });

          const sortMultiplier = sortOrder === "newest-first" ? -1 : 1;
          photosWithTimestamps.sort((a, b) => sortMultiplier * (a.timestamp - b.timestamp));

          const photoUris = photosWithTimestamps.map((p) => p.uri);
          if (!cancelled) setPhotos(photoUris);
        }
      } catch (e) {
        console.warn("ZImagePicker: failed to load images", e);
        if (!cancelled) setPhotos([]);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [sourceKey, refreshToken, sortOrder, source]);

  const handleSelect = useCallback(
    (uri: string) => {
      if (multiSelect) {
        // Multi-select mode: toggle selection.
        const currentSelection = selectedUris ?? [];
        const isSelected = currentSelection.includes(uri);
        const newSelection = isSelected
          ? currentSelection.filter((u) => u !== uri)
          : [...currentSelection, uri];
        onSelectionChange?.(newSelection);
      } else {
        // Single-select mode: call onSelect callback.
        onSelect?.(uri);
      }
    },
    [multiSelect, selectedUris, onSelectionChange, onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = multiSelect && selectedUris?.includes(item);
      return (
        <ZImageItem
          uri={item}
          onSelect={handleSelect}
          renderBadge={renderBadge}
          renderSelectionOverlay={renderSelectionOverlay}
          multiSelect={multiSelect}
          isSelected={isSelected}
        />
      );
    },
    [handleSelect, renderBadge, renderSelectionOverlay, multiSelect, selectedUris],
  );

  return (
    <FlashList
      data={photos}
      contentContainerStyle={{ flexGrow: 1 }}
      renderItem={renderItem}
      numColumns={3}
      keyExtractor={(uri) => uri}
      maintainVisibleContentPosition={{
        startRenderingFromBottom: renderFromBottom ?? false,
      }}
    />
  );
};

const { width } = Dimensions.get("window");
const IMAGE_SIZE = width / 3;

const styles = StyleSheet.create({
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    padding: 2,
  },
  image: {
    flex: 1,
  },
});
