import React, { useEffect } from 'react';
import { View, Text, Dimensions, StyleSheet, Pressable } from 'react-native';
import Svg, { Line, Circle, Rect, Path, Text as SvgText, TSpan } from 'react-native-svg';
import { ChartDataPoint } from '../../hooks/useAnalyticsData';

interface ReadinessLoadChartProps {
  data: ChartDataPoint[];
  period: 'week' | 'month' | 'quarter';
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number | null) => void;
  dismissSignal?: number;
}

export function ReadinessLoadChart({ data, period, selectedIndex, onSelectedIndexChange, dismissSignal }: ReadinessLoadChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 8;
  const chartHeight = 320;
  
  const padding = { 
    top: 20, 
    right: 42, 
    bottom: 50, 
    left: 42 
  };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  useEffect(() => {
    if (dismissSignal !== undefined) {
      onSelectedIndexChange(null);
    }
  }, [dismissSignal, onSelectedIndexChange]);

  if (!data || data.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: '#999', fontSize: 14 }}>Keine Daten verfügbar</Text>
      </View>
    );
  }

  const loadValues = data.map(d => d.load);

  const maxLoad = Math.max(...loadValues, 100);

  // Seitenränder um Balken von den Achsen weg zu positionieren
  const horizontalMarginFactor = 0.06; // 6% Margin auf jeder Seite
  const usableWidth = innerWidth * (1 - 2 * horizontalMarginFactor);
  const marginOffset = innerWidth * horizontalMarginFactor;

  const scaleX = (index: number) => {
    const scaledIndex = (index / Math.max(data.length - 1, 1)) * usableWidth;
    return padding.left + marginOffset + scaledIndex;
  };
  // Feste Skala 0-100 für Readiness
  const scaleReadinessY = (value: number) => {
    const normalized = value / 100;
    return padding.top + innerHeight - normalized * innerHeight;
  };
  const scaleLoadY = (value: number) => {
    const normalized = value / (maxLoad || 1);
    return padding.top + innerHeight - normalized * innerHeight;
  };

  const barWidth = Math.min(Math.max(innerWidth / (data.length * 1.6), 6), 36);

  // Catmull-Rom Spline für gekrümmte Linie
  const generateSplinePath = () => {
    const points = data.map((point, index) => ({
      x: scaleX(index),
      y: scaleReadinessY(point.readiness),
    }));

    if (points.length < 2) {
      return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    }

    let pathD = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      // Catmull-Rom Kontrollpunkte
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }

    return pathD;
  };

  const linePathD = generateSplinePath();

  const getHitIndex = (tapX: number, tapY: number): number | null => {
    const hitRadius = 14;
    const barBottom = padding.top + innerHeight;

    let bestIndex: number | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 0; index < data.length; index++) {
      const point = data[index];
      const x = scaleX(index);
      const pointY = scaleReadinessY(point.readiness);
      const barY = scaleLoadY(point.load);

      const isOnBar =
        tapX >= x - barWidth / 2 &&
        tapX <= x + barWidth / 2 &&
        tapY >= barY &&
        tapY <= barBottom;

      const distanceToPoint = Math.hypot(tapX - x, tapY - pointY);
      const isOnPoint = distanceToPoint <= hitRadius;

      if (!isOnBar && !isOnPoint) {
        continue;
      }

      // Prefer direct point hits over bar hits when both overlap.
      const score = isOnPoint ? distanceToPoint : 100 + Math.abs(tapX - x);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    return bestIndex;
  };

  const handleChartPress = (event: any) => {
    event?.stopPropagation?.();
    const { locationX, locationY } = event.nativeEvent;
    const hitIndex = getHitIndex(locationX, locationY);

    onSelectedIndexChange(((prev: number | null) => {
      if (hitIndex === null) return null;
      return prev === hitIndex ? null : hitIndex;
    })(selectedIndex));
  };

  const selectedPoint = selectedIndex !== null ? data[selectedIndex] : null;
  const selectedX = selectedIndex !== null ? scaleX(selectedIndex) : 0;
  const selectedReadinessY = selectedPoint ? scaleReadinessY(selectedPoint.readiness) : 0;
  const selectedLoadY = selectedPoint ? scaleLoadY(selectedPoint.load) : 0;
  const selectedAnchorY = selectedPoint ? selectedReadinessY : 0;

  const tooltipWidth = 118;
  const tooltipHeight = 48;
  const chartMinX = padding.left + 4;
  const chartMaxX = chartWidth - padding.right - tooltipWidth - 4;
  const chartMinY = padding.top + 4;
  const chartMaxY = padding.top + innerHeight - tooltipHeight - 4;

  const readinessCoords = data.map((point, index) => ({
    x: scaleX(index),
    y: scaleReadinessY(point.readiness),
  }));

  const segmentIntersectsSegment = (
    a1: { x: number; y: number },
    a2: { x: number; y: number },
    b1: { x: number; y: number },
    b2: { x: number; y: number }
  ) => {
    const det = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

    const d1 = det(a1, a2, b1);
    const d2 = det(a1, a2, b2);
    const d3 = det(b1, b2, a1);
    const d4 = det(b1, b2, a2);

    return d1 * d2 < 0 && d3 * d4 < 0;
  };

  const lineIntersectsTooltip = (x: number, y: number, width: number, height: number) => {
    const left = x;
    const right = x + width;
    const top = y;
    const bottom = y + height;

    for (let i = 0; i < readinessCoords.length - 1; i++) {
      const p1 = readinessCoords[i];
      const p2 = readinessCoords[i + 1];

      const p1Inside = p1.x >= left && p1.x <= right && p1.y >= top && p1.y <= bottom;
      const p2Inside = p2.x >= left && p2.x <= right && p2.y >= top && p2.y <= bottom;
      if (p1Inside || p2Inside) return true;

      const edges = [
        [{ x: left, y: top }, { x: right, y: top }],
        [{ x: right, y: top }, { x: right, y: bottom }],
        [{ x: right, y: bottom }, { x: left, y: bottom }],
        [{ x: left, y: bottom }, { x: left, y: top }],
      ] as const;

      for (const [e1, e2] of edges) {
        if (segmentIntersectsSegment(p1, p2, e1, e2)) {
          return true;
        }
      }
    }

    return false;
  };

  const selectedTopY = Math.min(selectedReadinessY, selectedLoadY);
  const selectedBottomY = Math.max(selectedReadinessY, selectedLoadY);

  const barGap = barWidth / 2 + 14; // Mindestabstand Tooltip-Rand zum Balken-Rand
  const candidates = [
    { x: selectedX + barGap, y: selectedTopY - tooltipHeight - 8 },
    { x: selectedX - tooltipWidth - barGap, y: selectedTopY - tooltipHeight - 8 },
    { x: selectedX + barGap, y: selectedBottomY + 8 },
    { x: selectedX - tooltipWidth - barGap, y: selectedBottomY + 8 },
    { x: selectedX - tooltipWidth / 2, y: selectedTopY - tooltipHeight - 10 },
  ];

  const clampedCandidates = candidates.map(candidate => {
    const clampedX = Math.max(chartMinX, Math.min(candidate.x, chartMaxX));
    const clampedY = Math.max(chartMinY, Math.min(candidate.y, chartMaxY));
    return { x: clampedX, y: clampedY, wasXClamped: Math.abs(clampedX - candidate.x) > 0.5 };
  });

  const candidateWithScore = clampedCandidates.map(candidate => {
    const centerX = candidate.x + tooltipWidth / 2;
    const centerY = candidate.y + tooltipHeight / 2;
    const distanceToAnchor = Math.hypot(centerX - selectedX, centerY - selectedAnchorY);
    const intersectsLine = lineIntersectsTooltip(candidate.x, candidate.y, tooltipWidth, tooltipHeight);
    const isPinnedToEdge = candidate.x <= chartMinX + 2 || candidate.x >= chartMaxX - 2;
    const overlapsSelectedX = selectedX >= candidate.x && selectedX <= candidate.x + tooltipWidth;
    // Only penalise bar-overlap when the candidate freely chose this x (not forced by clamping)
    const tooCloseToBar = !candidate.wasXClamped &&
      (candidate.x + tooltipWidth > selectedX - barGap && candidate.x < selectedX + barGap);
    const score =
      distanceToAnchor +
      (intersectsLine ? 300 : 0) +
      (isPinnedToEdge ? 120 : 0) +
      (overlapsSelectedX ? 160 : 0) +
      (tooCloseToBar ? 300 : 0);
    return { ...candidate, score };
  });

  const centerAnchoredCandidates = [
    {
      x: Math.max(chartMinX, Math.min((padding.left + innerWidth / 2) - tooltipWidth / 2, chartMaxX)),
      y: Math.max(chartMinY, Math.min(selectedTopY - tooltipHeight - 10, chartMaxY)),
    },
    {
      x: Math.max(chartMinX, Math.min((padding.left + innerWidth / 2) - tooltipWidth / 2, chartMaxX)),
      y: Math.max(chartMinY, Math.min(selectedBottomY + 10, chartMaxY)),
    },
  ].map(candidate => {
    const centerX = candidate.x + tooltipWidth / 2;
    const centerY = candidate.y + tooltipHeight / 2;
    const distanceToAnchor = Math.hypot(centerX - selectedX, centerY - selectedAnchorY);
    const intersectsLine = lineIntersectsTooltip(candidate.x, candidate.y, tooltipWidth, tooltipHeight);
    const overlapsSelectedX = selectedX >= candidate.x && selectedX <= candidate.x + tooltipWidth;
    const tooCloseToBar =
      (candidate.x + tooltipWidth > selectedX - barGap && candidate.x < selectedX + barGap);
    const score = distanceToAnchor + (intersectsLine ? 300 : 0) + (overlapsSelectedX ? 160 : 0) + (tooCloseToBar ? 300 : 0);
    return { ...candidate, score };
  });

  const allCandidates = [...candidateWithScore, ...centerAnchoredCandidates];

  const bestTooltip = allCandidates.reduce((best, current) => {
    if (!best || current.score < best.score) return current;
    return best;
  }, null as null | { x: number; y: number; score: number });

  const tooltipX = bestTooltip ? bestTooltip.x : clampedCandidates[0].x;
  const tooltipY = bestTooltip ? bestTooltip.y : clampedCandidates[0].y;

  const getTooltipPointerPath = () => {
    if (!selectedPoint) return '';

    const pointerSize = 7;
    const minInset = 12;

    if (selectedAnchorY > tooltipY + tooltipHeight) {
      const baseX = Math.max(tooltipX + minInset, Math.min(selectedX, tooltipX + tooltipWidth - minInset));
      return `M ${baseX - pointerSize} ${tooltipY + tooltipHeight} L ${baseX + pointerSize} ${tooltipY + tooltipHeight} L ${selectedX} ${selectedAnchorY - 2} Z`;
    }

    if (selectedAnchorY < tooltipY) {
      const baseX = Math.max(tooltipX + minInset, Math.min(selectedX, tooltipX + tooltipWidth - minInset));
      return `M ${baseX - pointerSize} ${tooltipY} L ${baseX + pointerSize} ${tooltipY} L ${selectedX} ${selectedAnchorY + 2} Z`;
    }

    if (selectedX < tooltipX) {
      const baseY = Math.max(tooltipY + minInset, Math.min(selectedAnchorY, tooltipY + tooltipHeight - minInset));
      return `M ${tooltipX} ${baseY - pointerSize} L ${tooltipX} ${baseY + pointerSize} L ${selectedX + 2} ${selectedAnchorY} Z`;
    }

    const baseY = Math.max(tooltipY + minInset, Math.min(selectedAnchorY, tooltipY + tooltipHeight - minInset));
    return `M ${tooltipX + tooltipWidth} ${baseY - pointerSize} L ${tooltipX + tooltipWidth} ${baseY + pointerSize} L ${selectedX - 2} ${selectedAnchorY} Z`;
  };

  const tooltipPointerPath = getTooltipPointerPath();

  const getDateLabel = (date: string, index: number): string => {
    if (period === 'week') {
      const d = new Date(date);
      const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
      return days[d.getDay()];
    }
    if (period === 'month') {
      if (index % 5 === 0) {
        return new Date(date).getDate().toString();
      }
      return '';
    }
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return months[d.getMonth()];
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={handleChartPress}>
        <Svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >

        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
          const y = padding.top + innerHeight * (1 - fraction);
          return (
            <Line
              key={`grid-${i}`}
              x1={padding.left + marginOffset}
              x2={chartWidth - padding.right - marginOffset}
              y1={y}
              y2={y}
              stroke="#333"
              strokeWidth="0.5"
              opacity={0.5}
            />
          );
        })}

        {/* Load bars (Purpur - wie WeeklyLoadBars) */}
        {data.map((point, index) => {
          const x = scaleX(index);
          const barY = scaleLoadY(point.load);
          const barBottom = padding.top + innerHeight;
          const height = Math.max(barBottom - barY, 1);
          const isSelected = selectedIndex === index;

          return (
            <Rect
              key={`bar-${index}`}
              x={x - barWidth / 2}
              y={barY}
              width={barWidth}
              height={height}
              fill="#5856D6"
              opacity={isSelected ? 1 : 0.78}
              stroke={isSelected ? '#c7c8ff' : 'none'}
              strokeWidth={isSelected ? 1.5 : 0}
              rx={isSelected ? 2 : 0}
            />
          );
        })}

        {/* Readiness line */}
        {linePathD && (
          <Path 
            d={linePathD} 
            stroke="#2f95dc" 
            strokeWidth="3" 
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Readiness line circles with glow effect */}
        {data.map((point, index) => {
          const x = scaleX(index);
          const y = scaleReadinessY(point.readiness);
          const isSelected = selectedIndex === index;
          return (
            <React.Fragment key={`point-${index}`}>
              {/* Outer glow - softer */}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 10 : 7}
                fill="#2f95dc"
                opacity={isSelected ? 0.28 : 0.15}
              />
              {/* Middle glow - medium */}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 6 : 4.5}
                fill="#2f95dc"
                opacity={isSelected ? 0.45 : 0.3}
              />
              {/* Inner point - solid white with border */}
              <Circle
                cx={x}
                cy={y}
                r={isSelected ? 4 : 3}
                fill="white"
                stroke="#2f95dc"
                strokeWidth={isSelected ? 2 : 1.5}
              />
            </React.Fragment>
          );
        })}

        {selectedIndex !== null && (
          <>
            <Line
              x1={selectedX}
              x2={selectedX}
              y1={padding.top}
              y2={padding.top + innerHeight + 2}
              stroke="#7f88a8"
              strokeWidth="1"
              opacity={0.32}
              strokeDasharray="3,4"
            />
            <Circle
              cx={selectedX}
              cy={padding.top + innerHeight + 4}
              r="3.5"
              fill="#cfd6f6"
              opacity={0.9}
            />
          </>
        )}

        {/* Tooltip */}
        {selectedPoint && (
          <>
            {tooltipPointerPath ? (
              <Path d={tooltipPointerPath} fill="#141824" stroke="#4b5aa2" strokeWidth="1" opacity={0.96} />
            ) : null}
            <Rect
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              rx={10}
              fill="#141824"
              stroke="#4b5aa2"
              strokeWidth="1"
              opacity={0.96}
            />
            <SvgText x={tooltipX + 9} y={tooltipY + 18} fontSize="11" fill="#2f95dc" textAnchor="start">
              <TSpan>Readiness: {Math.round(selectedPoint.readiness)}</TSpan>
            </SvgText>
            <SvgText x={tooltipX + 9} y={tooltipY + 34} fontSize="11" fill="#5856D6" textAnchor="start">
              <TSpan>Last: {Math.round(selectedPoint.load)}</TSpan>
            </SvgText>
          </>
        )}

        {/* Axes */}
        <Line x1={padding.left} x2={padding.left} y1={padding.top} y2={padding.top + innerHeight} stroke="#666" strokeWidth="1.5" />
        <Line x1={chartWidth - padding.right} x2={chartWidth - padding.right} y1={padding.top} y2={padding.top + innerHeight} stroke="#666" strokeWidth="1.5" />
        <Line x1={padding.left} x2={chartWidth - padding.right} y1={padding.top + innerHeight} y2={padding.top + innerHeight} stroke="#666" strokeWidth="1.5" />

        {/* Y1 axis labels (Load) */}
        {[0, 0.5, 1].map((fraction, i) => {
          const y = padding.top + innerHeight * (1 - fraction);
          const value = Math.round(maxLoad * fraction);
          return (
            <SvgText key={`y1-${i}`} x={padding.left - 10} y={y + 5} fontSize="11" fill="#999" textAnchor="end">
              <TSpan>{value}</TSpan>
            </SvgText>
          );
        })}

        {/* Y2 axis labels (Readiness) */}
        {[0, 50, 100].map((value, i) => {
          const normalizedValue = value / 100;
          const y = padding.top + innerHeight * (1 - normalizedValue);
          return (
            <SvgText key={`y2-${i}`} x={chartWidth - padding.right + 10} y={y + 5} fontSize="11" fill="#999" textAnchor="start">
              <TSpan>{value}</TSpan>
            </SvgText>
          );
        })}

        {/* X axis labels */}
        {data.map((point, index) => {
          const label = getDateLabel(point.date, index);
          if (!label) return null;
          const x = scaleX(index);
          const isSelected = selectedIndex === index;
          return (
            <SvgText
              key={`x-${index}`}
              x={x}
              y={padding.top + innerHeight + 18}
              fontSize={isSelected ? '11' : '10'}
              fill={isSelected ? '#e6ebff' : '#999'}
              textAnchor="middle"
              fontWeight={isSelected ? '700' : '400'}
            >
              <TSpan>{label}</TSpan>
            </SvgText>
          );
        })}
        </Svg>
      </Pressable>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#5856D6' }]} />
          <Text style={styles.legendText}>Last (Load)</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={{ width: 12, height: 2, backgroundColor: '#2f95dc' }} />
          <Text style={styles.legendText}>Readiness Score</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    opacity: 0.7,
  },
  legendText: {
    color: '#999',
    fontSize: 12,
  },
});
