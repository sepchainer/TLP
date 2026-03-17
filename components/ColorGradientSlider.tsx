import React, { useState, useCallback, useRef, memo } from 'react';
import { View, Text, StyleSheet, PanResponder, Dimensions } from 'react-native';

interface ColorGradientSliderProps {
  label: string;
  initialValue: number;
  onValueChange: (value: number) => void;
  isReversed?: boolean; // For stress: reversed so green is low, red is high
}

// Color mapping: 1 = red, 5 = yellow, 10 = green (or reversed for stress)
// Uses HSL hue interpolation (0°→120°) for perceptually distinct steps at every value.
const getColorForValue = (value: number, isReversed: boolean = false) => {
  const normalized = (value - 1) / 9; // 0 to 1
  const t = isReversed ? 1 - normalized : normalized;

  // Hue: 0° = red, 60° = yellow, 120° = green — each step shifts ~13° for a clear colour change
  const hue = Math.round(t * 120);
  const saturation = 88;
  // Lightness peaks slightly at yellow (perceptually brightest hue) and is darker at ends
  const lightness = Math.round(40 + Math.sin(t * Math.PI) * 10);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const ColorGradientSlider = memo(
  ({ label, initialValue, onValueChange, isReversed = false }: ColorGradientSliderProps) => {
    const [displayValue, setDisplayValue] = useState(initialValue);
    // Ref to track the latest displayValue — avoids stale closure in panResponder release handler
    const displayValueRef = useRef(initialValue);
    // Ref to the track View for measuring absolute screen position (pageX)
    const trackRef = useRef<View>(null);
    const trackPageXRef = useRef<number>(0);
    const screenWidth = Dimensions.get('window').width;
    const TRACK_WIDTH = screenWidth - 50; // Full width minus padding and margins
    const THUMB_SIZE = 28;
    const TRACK_HEIGHT = 16;

    const updateValue = useCallback((newValue: number) => {
      if (newValue >= 1 && newValue <= 10) {
        displayValueRef.current = newValue;
        setDisplayValue(newValue);
      }
    }, []);

    // Called once the track is laid out — measure() gives absolute pageX on screen
    const handleTrackLayout = useCallback(() => {
      trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
        trackPageXRef.current = pageX;
      });
    }, []);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (evt, gestureState) => {
          // gestureState.moveX is absolute screen X; subtract absolute track origin
          const relativeX = Math.max(0, Math.min(TRACK_WIDTH, gestureState.moveX - trackPageXRef.current));
          const newValue = Math.round(1 + (relativeX / TRACK_WIDTH) * 9);
          updateValue(newValue);
        },
        onPanResponderRelease: () => {
          onValueChange(displayValueRef.current);
        },
      })
    ).current;

    const handleTrackPress = useCallback((evt: any) => {
      const { locationX } = evt.nativeEvent;
      const progress = Math.max(0, Math.min(1, locationX / TRACK_WIDTH));
      const newValue = Math.round(1 + progress * 9);
      if (newValue >= 1 && newValue <= 10) {
        updateValue(newValue);
        onValueChange(newValue);
      }
    }, [onValueChange, TRACK_WIDTH, updateValue]);

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
            ref={trackRef}
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
