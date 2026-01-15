import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from "react-native";
import { Dirs, FileSystem, Util } from "react-native-file-access";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { createThumbnail } from "react-native-create-thumbnail";
import { FlashList, useRecyclingState } from "@shopify/flash-list";
import {
  authenticityStatus,
  AuthenticityStatus,
} from "@succinctlabs/react-native-zcam1-c2pa";

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
  onSelect,
}: {
  uri: string;
  renderBadge?: (
    uri: string,
    status: AuthenticityStatus,
  ) => React.ReactElement | null;
  onSelect: (uri: string) => void;
}) => {
  const [authStatus, setAuthStatus] = useRecyclingState(
    AuthenticityStatus.Unknown,
    [uri],
  );
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
  }, [uri]);

  useEffect(() => {
    const buildThumbnail = async () => {
      const ext = Util.extname(uri)?.toLowerCase();

      if (ext === "mov" || ext === "mp4") {
        const thumbnail = await createThumbnail({
          url: uri.replace("file://", ""),
        });
        setThumbnail(thumbnail.path);
      }
    };

    buildThumbnail();
  }, [uri]);

  const badge = useMemo(() => {
    return renderBadge ? renderBadge(uri, authStatus) : null;
  }, [renderBadge, uri, authStatus]);

  return (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => onSelect(uri)}
    >
      <Image style={styles.image} source={{ uri: thumbnail }} />
      {badge}
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

          const sortMultiplier = props.sortOrder === 'newest-first' ? -1 : 1;
          photoFiles.sort((a, b) => sortMultiplier * (a.lastModified - b.lastModified));

          const photoUris = photoFiles
            .filter((f) => f.type === "file")
            .filter((f) => !f.filename.startsWith("."))
            .map((f) => `file://${f.path}`);

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
    (uri: string) => props.onSelect?.(uri),
    [props.onSelect],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => (
      <ZImageItem
        uri={item}
        onSelect={handleSelect}
        renderBadge={props.renderBadge}
      />
    ),
    [handleSelect],
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
});
