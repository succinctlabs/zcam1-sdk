import {
  FlatList,
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { Dirs, FileSystem } from "react-native-file-access";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import { useEffect, useState } from "react";

export interface PrivateFolder {
  path: string;
}

export interface PhotoGallery {
  album: string;
}

export interface ZCameraProps {
  source: PrivateFolder | PhotoGallery;
  onSelect?: (uri: string) => void;
}

/**
 * Returns the path to the app's private document directory.
 * @returns {string} The path to the private document directory.
 */
export function privateDirectory(): string {
  return Dirs.DocumentDir;
}

export const ZImagePicker = (props: ZCameraProps) => {
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

    console.log("image", photos.edges[0].node.image);

    const photoUris = photos.edges
      .map((photo) => photo.node.image.uri)
      .filter((path) => path !== null);

    setPhotos(photoUris);
  };

  const loadImagesfromPrivateFolder = async (
    source: PrivateFolder,
  ): Promise<void> => {
    const photoFiles = await FileSystem.ls(source.path);
    const photoUris = photoFiles.map((f) => `file://${source.path}/${f}`);

    setPhotos(photoUris);
  };

  const handleSelect = (uri: string) => {
    props.onSelect?.(uri);
  };

  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => handleSelect(item)}
      >
        <Image
          style={[styles.image]}
          source={{ uri: item }}
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    );
  };

  return (
    <View>
      <FlatList
        data={photos}
        keyExtractor={(item) => item}
        renderItem={renderItem}
        numColumns={3}
      />
    </View>
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
  selectedImage: {
    opacity: 0.5, // Dim image when selected
    borderWidth: 2,
    borderColor: "blue",
  },
  checkmarkContainer: {
    position: "absolute",
    bottom: 5,
    right: 5,
    backgroundColor: "blue",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: { color: "white", fontWeight: "bold" },
  uploadBtn: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "blue",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 30,
    elevation: 5,
  },
  btnText: { color: "white", fontWeight: "bold" },
});
