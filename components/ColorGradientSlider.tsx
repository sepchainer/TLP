import React, { useState, useCallback, memo } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';

interface ColorGradientSliderProps {
  label: string;
  initialValue: number;
  onValueChange: (value: number) => void;
  isReversed?: boolean; // For stress: reversed so green is low, red is high
}

// Color mapping: 1 = dark red, 5 = yellow, 10 = mid-dark green (or reversed for stress)
const getColorForValue = (value: number, isReversed: boolean = false) => {
  // Normalize value to 0-1
  const normalized = (value - 1) / 9;
  
  // Dark red: rgb(178, 0, 0) | Yellow: rgb(255, 255, 0) | Mid-dark green: rgb(45, 122, 45)
  const darkRed = { r: 178, g: 0, b: 0 };
  const yellow = { r: 255, g: 255, b: 0 };
  const midDarkGreen = { r: 45, g: 122, b: 45 };
  
  if (isReversed) {
    // Reversed: LOW (1) = MID-DARK GREEN, MID (5) = YELLOW, HIGH (10) = DARK RED
    if (normalized <= 0.5) {
      // Mid-dark green (1) to Yellow (5)
      const t = normalized * 2; // 0 to 1
      const r = Math.round(midDarkGreen.r + (yellow.r - midDarkGreen.r) * t);
      const g = Math.round(midDarkGreen.g + (yellow.g - midDarkGreen.g) * t);
      const b = Math.round(midDarkGreen.b + (yellow.b - midDarkGreen.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow (5) to Dark Red (10)
      const t = (normalized - 0.5) * 2; // 0 to 1
      const r = Math.round(yellow.r + (darkRed.r - yellow.r) * t);
      const g = Math.round(yellow.g + (darkRed.g - yellow.g) * t);
      const b = Math.round(yellow.b + (darkRed.b - yellow.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  } else {
    // Normal: LOW (1) = DARK RED, MID (5) = YELLOW, HIGH (10) = MID-DARK GREEN
    if (normalized <= 0.5) {
      // Dark red (1) to Yellow (5)
      const t = normalized * 2; // 0 to 1
      const r = Math.round(darkRed.r + (yellow.r - darkRed.r) * t);
      const g = Math.round(darkRed.g + (yellow.g - darkRed.g) * t);
      const b = Math.round(darkRed.b + (yellow.b - darkRed.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Yellow (5) to Mid-dark green (10)
      const t = (normalized - 0.5) * 2; // 0 to 1
      const r = Math.round(yellow.r + (midDarkGreen.r - yellow.r) * t);
      const g = Math.round(yellow.g + (midDarkGreen.g - yellow.g) * t);
      const b = Math.round(yellow.b + (midDarkGreen.b - yellow.b) * t);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
};

const ColorGradientSlider = memo(
  ({ label, initialValue, onValueChange, isReversed = false }: ColorGradientSliderProps) => {
    const [displayValue, setDisplayValue] = useState(initialValue);
    const [trackLayout, setTrackLayout] = useState<any>(null);
    const screenWidth = Dimensions.get('window').width;
    const TRACK_WIDTH = screenWidth - 50; // Full width minus padding and margins
    const THUMB_SIZE = 28;
    const TRACK_HEIGHT = 16;

    // Handle touch anywhere on the slider (both track and thumb)
    const handleTouchMove = useCallback((gestureState: any) => {
      if (!trackLayout) return;

      const touchX = gestureState.moveX;
      const trackStartX = trackLayout.x;
      const relativeX = Math.max(0, Math.min(TRACK_WIDTH, touchX - trackStartX));
      const progress = relativeX / TRACK_WIDTH;
      const newValue = Math.round(1 + progress * 9);
      
      if (newValue >= 1 && newValue <= 10) {
        setDisplayValue(newValue);
      }
    }, [trackLayout, TRACK_WIDTH]);

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (evt, gestureState) => {
        handleTouchMove(gestureState);
      },
      onPanResponderRelease: () => {
        onValueChange(displayValue);
      },
    });

    const handleTrackPress = useCallback((evt: any) => {
      const { locationX } = evt.nativeEvent;
      const progress = Math.max(0, Math.min(1, locationX / TRACK_WIDTH));
      const newValue = Math.round(1 + progress * 9);
      
      if (newValue >= 1 && newValue <= 10) {
        setDisplayValue(newValue);
        onValueChange(newValue);
      }
    }, [onValueChange, TRACK_WIDTH]);

    const handleTrackLayout = useCallback((evt: any) => {
      setTrackLayout(evt.nativeEvent.layout);
    }, []);

    const sliderColor = getColorForValue(displayValue, isReversed);
    
    // Calculate positions based directly on displayValue for perfect alignment
    const normalizedValue = (displayValue - 1) / 9;
    const fillWidth = normalizedValue * TRACK_WIDTH;
    const thumbLeftPosition = normalizedValue * TRACK_WIDTH;

    return (
      <View style={styles.container}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.valueText}>
            {Math.round(displayValue)}/10
          </Text>
        </View>
        
        <View style={styles.sliderWrapper} {...panResponder.panHandlers}>
          {/* Track background */}
          <View 
            style={[styles.track, { width: TRACK_WIDTH, height: TRACK_HEIGHT }]}
            onLayout={handleTrackLayout}
            onStartShouldSetResponder={() => true}
            onResponderRelease={handleTrackPress}
          >
            {/* Colored fill based directly on display value */}
            <View
              style={[
                styles.trackFill,
                {
                  width: fillWidth,
                  backgroundColor: sliderColor,
                },
              ]}
            />
          </View>

          {/* Draggable thumb */}
          <View
            style={[
              styles.thumb,
              {
                width: THUMB_SIZE,
                height: THUMB_SIZE,
                left: thumbLeftPosition,
              },
            ]}
          />
        </View>
      </View>
    );
  }
);

ColorGradientSlider.displayName = 'ColorGradientSlider';

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  valueText: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#ffffff',
  },
  sliderWrapper: {
    position: 'relative',
    height: 40,
    justifyContent: 'center',
  },
  track: {
    height: 16,
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 8,
  },
  thumb: {
    position: 'absolute',
    borderRadius: 14,
    top: '50%',
    marginTop: -14,
    marginLeft: -14,
    backgroundColor: '#e8e8e8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
});

export default ColorGradientSlider;
