import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  View,
  Text,
} from "react-native";
import { Dirs, FileSystem, Util } from "react-native-file-access";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { createThumbnail } from "react-native-create-thumbnail";
import { FlashList, useRecyclingState } from "@shopify/flash-list";
import {
  authenticityStatus,
  AuthenticityStatus,
} from "@succinctlabs/react-native-zcam1-c2pa";
import { getVideoInfo } from "@succinctlabs/react-native-zcam1-capture";

/**
 * Format duration in seconds to "M:SS" format.
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export {
  authenticityStatus,
  AuthenticityStatus,
} from "@succinctlabs/react-native-zcam1-c2pa";

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
  sortOrder?: 'newest-first' | 'oldest-first';

  /**
   * Optional function to render a badge based on the authenticity status of an image.
   * @param status - The authenticity status of the image.
   * @returns A React element to display as a badge, or null to display nothing.
   */
  renderBadge?: (
    uri: string,
    status: AuthenticityStatus,
  ) => React.ReactElement | null;

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
  renderSelectionOverlay?: (
    uri: string,
    isSelected: boolean,
  ) => React.ReactElement | null;
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
  renderBadge?: (
    uri: string,
    status: AuthenticityStatus,
  ) => React.ReactElement | null;
  renderSelectionOverlay?: (
    uri: string,
    isSelected: boolean,
  ) => React.ReactElement | null;
  onSelect: (uri: string) => void;
  multiSelect?: boolean;
  isSelected?: boolean;
}) => {
  const [authStatus, setAuthStatus] = useRecyclingState(
    AuthenticityStatus.Unknown,
    [uri],
  );
  const [thumbnail, setThumbnail] = useRecyclingState(uri, [uri]);
  const [videoDuration, setVideoDuration] = useRecyclingState<number | null>(
    null,
    [uri],
  );

  // Check if this is a video file.
  const isVideo = useMemo(() => {
    const ext = Util.extname(uri)?.toLowerCase();
    return ext === "mov" || ext === "mp4";
  }, [uri]);

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
  }, [uri]);

  useEffect(() => {
    if (!isVideo) return;

    let active = true;
    const buildThumbnailAndGetDuration = async () => {
      try {
        // Generate thumbnail.
        const thumbResult = await createThumbnail({
          url: uri.replace("file://", ""),
        });
        if (active) {
          setThumbnail(thumbResult.path);
        }

        // Get video duration.
        const videoPath = uri.replace("file://", "");
        const videoInfo = await getVideoInfo(videoPath);
        if (active && videoInfo.durationSeconds > 0) {
          setVideoDuration(videoInfo.durationSeconds);
        }
      } catch (err) {
        console.warn("[ZImagePicker] Failed to process video:", err);
      }
    };

    buildThumbnailAndGetDuration();
    return () => {
      active = false;
    };
  }, [uri, isVideo]);

  const badge = useMemo(() => {
    return renderBadge ? renderBadge(uri, authStatus) : null;
  }, [renderBadge, uri, authStatus]);

  const selectionOverlay = useMemo(() => {
    return multiSelect && renderSelectionOverlay
      ? renderSelectionOverlay(uri, isSelected ?? false)
      : null;
  }, [multiSelect, renderSelectionOverlay, uri, isSelected]);

  return (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => onSelect(uri)}
    >
      <Image
        style={styles.image}
        source={{ uri: thumbnail }}
      />
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
      {/* Video duration badge in bottom-left. */}
      {isVideo && videoDuration !== null && (
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatDuration(videoDuration)}
          </Text>
        </View>
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
  const [photos, setPhotos] = useState<string[]>([]);

  const sourceKey = useMemo(() => {
    if ("album" in props.source) return `album:${props.source.album ?? ""}`;
    else if ("path" in props.source) return `path:${props.source.path}`;
    else return "unknown";
  }, [props.source]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if ("album" in props.source) {
          const result = await CameraRoll.getPhotos({
            first: 20,
            groupTypes: "Album",
            groupName: props.source.album,
          });

          const sortMultiplier = props.sortOrder === 'newest-first' ? -1 : 1;
          result.edges.sort((a, b) =>
            sortMultiplier * (a.node.modificationTimestamp - b.node.modificationTimestamp)
          );

          const photoUris = result.edges
            .map((photo) => photo.node.image.uri)
            .filter((path) => path !== null);

          if (!cancelled) setPhotos(photoUris);
        } else if ("path" in props.source) {
          const photoFiles = await FileSystem.statDir(props.source.path);

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

          const sortMultiplier = props.sortOrder === 'newest-first' ? -1 : 1;
          photosWithTimestamps.sort((a, b) =>
            sortMultiplier * (a.timestamp - b.timestamp)
          );

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
  }, [sourceKey, props.refreshToken]);

  const handleSelect = useCallback(
    (uri: string) => {
      if (props.multiSelect) {
        // Multi-select mode: toggle selection.
        const currentSelection = props.selectedUris ?? [];
        const isSelected = currentSelection.includes(uri);
        const newSelection = isSelected
          ? currentSelection.filter((u) => u !== uri)
          : [...currentSelection, uri];
        props.onSelectionChange?.(newSelection);
      } else {
        // Single-select mode: call onSelect callback.
        props.onSelect?.(uri);
      }
    },
    [props.multiSelect, props.selectedUris, props.onSelectionChange, props.onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => {
      const isSelected = props.multiSelect && props.selectedUris?.includes(item);
      return (
        <ZImageItem
          uri={item}
          onSelect={handleSelect}
          renderBadge={props.renderBadge}
          renderSelectionOverlay={props.renderSelectionOverlay}
          multiSelect={props.multiSelect}
          isSelected={isSelected}
        />
      );
    },
    [handleSelect, props.renderBadge, props.renderSelectionOverlay, props.multiSelect, props.selectedUris],
  );

  return (
    <FlashList
      data={photos}
      contentContainerStyle={{ flexGrow: 1 }}
      renderItem={renderItem}
      numColumns={3}
      keyExtractor={(uri) => uri}
      maintainVisibleContentPosition={{
        startRenderingFromBottom: props.renderFromBottom ?? false,
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
  durationBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
});
