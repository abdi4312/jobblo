import React, { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

interface ImageViewerProps {
  images: string[];
  /** Index to open at; null = closed. */
  index: number | null;
  onClose: () => void;
}

/**
 * Full-screen photo viewer: swipe sideways between images, pinch to zoom, swipe down to close.
 *
 * ponytail: pinch-zoom uses the native ScrollView zoom, which only exists on iOS. Android gets
 * swipe + full-screen without zoom; upgrade to a reanimated pinch gesture if Android needs it.
 */
export function ImageViewer({ images, index, onClose }: ImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  const [zoomed, setZoomed] = useState(false);
  const dragY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (index !== null) {
      setCurrent(index);
      setZoomed(false);
      dragY.setValue(0);
    }
  }, [index, dragY]);

  // Pull down to close; disabled while zoomed so panning a zoomed photo does not close it.
  const swipeDown = Gesture.Pan()
    .runOnJS(true)
    .enabled(!zoomed)
    .activeOffsetY(15)
    .failOffsetX([-15, 15])
    .onUpdate((event) => dragY.setValue(Math.max(0, event.translationY)))
    .onEnd((event) => {
      if (event.translationY > 120 || event.velocityY > 900) onClose();
      else Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
    });

  const backdrop = dragY.interpolate({ inputRange: [0, 300], outputRange: [1, 0.3], extrapolate: 'clamp' });

  return (
    <Modal visible={index !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, backgroundColor: 'black', opacity: backdrop }}>
          <GestureDetector gesture={swipeDown}>
            <Animated.View style={{ flex: 1, transform: [{ translateY: dragY }] }}>
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                scrollEnabled={!zoomed}
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={index ?? 0}
                getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
                keyExtractor={(uri, i) => `${uri}-${i}`}
                onMomentumScrollEnd={(event) => setCurrent(Math.round(event.nativeEvent.contentOffset.x / width))}
                renderItem={({ item }) => (
                  <ScrollView
                    style={{ width, height }}
                    contentContainerStyle={{ width, height }}
                    maximumZoomScale={4}
                    minimumZoomScale={1}
                    centerContent
                    bouncesZoom
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={32}
                    onScroll={(event) => setZoomed((event.nativeEvent.zoomScale ?? 1) > 1.01)}
                  >
                    <Image source={{ uri: item }} style={{ width, height }} resizeMode="contain" />
                  </ScrollView>
                )}
              />
            </Animated.View>
          </GestureDetector>

          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16 }}
            className="flex-row items-center justify-between"
          >
            <Text className="text-[0.9375rem] font-semibold text-white">
              {images.length > 1 ? `${current + 1} / ${images.length}` : ''}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Lukk bildevisning"
              className="h-10 w-10 items-center justify-center rounded-full bg-white/20"
            >
              <X size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
