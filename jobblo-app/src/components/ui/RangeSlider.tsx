import React, { useRef, useState } from 'react';
import { View, PanResponder } from 'react-native';

interface RangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  step?: number;
  onMinChange: (value: number) => void;
  onMaxChange: (value: number) => void;
}

/**
 * Simple range slider UI component for selecting min/max values.
 * Uses React Native's built-in Animated + PanResponder for gesture handling.
 * 
 * Designed for price range filtering with visual feedback.
 */
export const RangeSlider = ({
  min,
  max,
  minValue,
  maxValue,
  step = 1,
  onMinChange,
  onMaxChange,
}: RangeSliderProps) => {
  const sliderWidth = 280;
  const trackWidth = sliderWidth - 20; // 10px padding each side
  
  // Calculate positions as percentage of track
  const minPercent = ((minValue - min) / (max - min)) * 100;
  const maxPercent = ((maxValue - min) / (max - min)) * 100;

  const handleMinChange = (x: number) => {
    // x is 0 to trackWidth
    const percent = Math.max(0, Math.min(x / trackWidth, 1));
    const value = min + percent * (max - min);
    const snapped = Math.round(value / step) * step;
    
    if (snapped <= maxValue) {
      onMinChange(snapped);
    }
  };

  const handleMaxChange = (x: number) => {
    const percent = Math.max(0, Math.min(x / trackWidth, 1));
    const value = min + percent * (max - min);
    const snapped = Math.round(value / step) * step;
    
    if (snapped >= minValue) {
      onMaxChange(snapped);
    }
  };

  return (
    <View className="w-full items-center py-2">
      <View
        className="relative h-1 w-[280px] rounded-full bg-[#E6E7E1]"
      >
        {/* Active track (between min and max) */}
        <View
          className="absolute h-1 rounded-full bg-[#2E6641]"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
          }}
        />

        {/* Min thumb */}
        <PressableThumb
          position={minPercent}
          onMove={handleMinChange}
          trackWidth={trackWidth}
        />

        {/* Max thumb */}
        <PressableThumb
          position={maxPercent}
          onMove={handleMaxChange}
          trackWidth={trackWidth}
        />
      </View>
    </View>
  );
};

interface PressableThumbProps {
  position: number;
  onMove: (x: number) => void;
  trackWidth: number;
}

/**
 * Individual draggable thumb for range slider.
 * Uses simple touch handling.
 */
function PressableThumb({
  position,
  onMove,
  trackWidth,
}: PressableThumbProps) {
  const [isDragging, setIsDragging] = useState(false);
  const positionRef = useRef((position / 100) * trackWidth);
  positionRef.current = (position / 100) * trackWidth;
  const dragStart = useRef(positionRef.current);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragStart.current = positionRef.current; setIsDragging(true); },
    onPanResponderMove: (_, gesture) => onMove(dragStart.current + gesture.dx),
    onPanResponderRelease: () => setIsDragging(false),
    onPanResponderTerminate: () => setIsDragging(false),
  })).current;

  return (
    <View
      style={{
        position: 'absolute',
        left: `${position}%`,
        transform: [{ translateX: -8 }], // Half of thumb width for center alignment
        top: -6, // Center vertically
      }}
      {...responder.panHandlers}
      className={`h-4 w-4 rounded-full border-2 border-[#2E6641] bg-white shadow-sm ${
        isDragging ? 'border-4' : ''
      }`}
    />
  );
}
