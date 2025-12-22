import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
  Text,
  Image,
} from "react-native";
import { Dirs, FileSystem } from "react-native-file-access";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { FlashList } from "@shopify/flash-list";
import {
  authenticityStatus,
  AuthenticityStatus,
} from "react-native-zcam1-c2pa";

export { AuthenticityStatus } from "react-native-zcam1-c2pa";

export interface PrivateFolder {
  path: string;
}

export interface PhotoGallery {
  album: string;
}

export interface ZImagePickerProps {
  source: PrivateFolder | PhotoGallery;
  renderBadge?: (status: AuthenticityStatus) => React.ReactElement | null;
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
  renderBadge?: (status: AuthenticityStatus) => React.ReactElement | null;
  onSelect: (uri: string) => void;
}) => {
  const [authStatus, setAuthStatus] = useState<AuthenticityStatus>(
    AuthenticityStatus.Unknown,
  );

  useEffect(() => {
    let active = true;
    const check = async () => {
      const result = await authenticityStatus(uri);
      if (active) {
        setAuthStatus(result);
        console.log(result);
      }
    };
    check();
    return () => {
      active = false;
    };
  }, [uri]);

  const badge = useMemo(() => {
    return renderBadge ? renderBadge(authStatus) : null;
  }, [renderBadge, authStatus]);

  return (
    <TouchableOpacity
      style={styles.imageContainer}
      onPress={() => onSelect(uri)}
    >
      <Image
        style={[styles.image]}
        source={{ uri }}
        //cachePolicy="memory-disk"
      />
      {badge}
    </TouchableOpacity>
  );
};

export const ZImagePicker = (props: ZImagePickerProps) => {
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if ("album" in props.source) {
      loadImagesfromPhotoGallery(props.source);
    } else if ("path" in props.source) {
      loadImagesfromPrivateFolder(props.source);
    }
  }, []);

  const loadImagesfromPhotoGallery = async (
    source: PhotoGallery,
  ): Promise<void> => {
    const photos = await CameraRoll.getPhotos({
      first: 20,
      groupTypes: "Album",
      groupName: source.album,
      assetType: "Photos",
    });

    // Sort photos with most recent first (descending timestamp)
    photos.edges.sort(
      (a, b) => b.node.modificationTimestamp - a.node.modificationTimestamp,
    );

    const photoUris = photos.edges
      .map((photo) => photo.node.image.uri)
      .filter((path) => path !== null);

    setPhotos(photoUris);
  };

  const loadImagesfromPrivateFolder = async (
    source: PrivateFolder,
  ): Promise<void> => {
    const photoFiles = await FileSystem.statDir(source.path);

    // Sort photos with most recent first (descending timestamp)
    photoFiles.sort((a, b) => b.lastModified - a.lastModified);

    const photoUris = photoFiles
      .filter((f) => f.type === "file")
      .map((f) => `file://${f.path}`);

    setPhotos(photoUris);
  };

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
      renderItem={renderItem}
      numColumns={3}
      keyExtractor={(uri) => uri}
    />
  );
};

const { width } = Dimensions.get("window");
const IMAGE_SIZE = width / 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  imageContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    padding: 2,
  },
  image: {
    flex: 1,
    backgroundColor: "#e1e4e8",
  },
});
