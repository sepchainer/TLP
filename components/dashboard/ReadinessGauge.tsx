import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export const ReadinessGauge = ({ score }: { score: number }) => {
  const size = 200;
  const strokeWidth = 15;
  const center = size / 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = (s: number) => {
    if (s > 70) return '#4CAF50';
    if (s > 40) return '#FF9800';
    return '#F44336';
  };

  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={radius} stroke="#444444" strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center} cy={center} r={radius}
          stroke={getColor(score)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={styles.scoreTextContainer}>
        <Text style={styles.scoreValue}>{score}</Text>
        <Text style={styles.scoreLabel}>Readiness</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gaugeContainer: { alignItems: 'center', justifyContent: 'center' },
  scoreTextContainer: { position: 'absolute', alignItems: 'center' },
  scoreValue: { fontSize: 58, fontWeight: 'bold', color: '#ffffff' },
  scoreLabel: { fontSize: 14, color: '#888888', textTransform: 'uppercase' },
});