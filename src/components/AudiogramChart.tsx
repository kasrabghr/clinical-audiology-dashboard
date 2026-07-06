import React, { useRef, useState } from 'react';

export interface TestPoint {
  db: number | '';
  masked: boolean;
}

export interface FrequencyData {
  air: TestPoint;
  bone: TestPoint;
}

export type EarData = Record<number, FrequencyData>;

interface AudiogramChartProps {
  isRight: boolean;
  data: EarData;
  onPointChange: (frequency: number, type: 'air' | 'bone', db: number | '') => void;
  activeInputType: 'air' | 'bone';
}

const FREQUENCIES = [250, 500, 1000, 2000, 4000, 8000];
const DB_VALUES = [-10, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];

// SVG layout constants
const WIDTH = 480;
const HEIGHT = 460;
const PADDING_TOP = 40;
const PADDING_BOTTOM = 40;
const PADDING_LEFT = 65;
const PADDING_RIGHT = 30;

const GRID_WIDTH = WIDTH - PADDING_LEFT - PADDING_RIGHT;
const GRID_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;

export const AudiogramChart: React.FC<AudiogramChartProps> = ({
  isRight,
  data,
  onPointChange,
  activeInputType,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ freq: number; db: number } | null>(null);

  // Map frequency to X coordinate
  const getX = (freq: number) => {
    const index = FREQUENCIES.indexOf(freq);
    if (index === -1) return 0;
    return PADDING_LEFT + (index / (FREQUENCIES.length - 1)) * GRID_WIDTH;
  };

  // Map dB to Y coordinate (-10 is at the top, 120 is at the bottom)
  const getY = (db: number) => {
    return PADDING_TOP + ((db - (-10)) / 130) * GRID_HEIGHT;
  };

  // Map mouse coordinate to nearest grid point
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Scale coordinates back to original viewBox dimensions
    const scaleX = WIDTH / rect.width;
    const scaleY = HEIGHT / rect.height;
    const svgX = x * scaleX;
    const svgY = y * scaleY;

    // Find closest frequency
    let closestFreq = FREQUENCIES[0];
    let minDistanceX = Infinity;
    FREQUENCIES.forEach((freq) => {
      const dist = Math.abs(getX(freq) - svgX);
      if (dist < minDistanceX) {
        minDistanceX = dist;
        closestFreq = freq;
      }
    });

    // Find closest dB (rounded to nearest 5 dB for realistic audiology measurements)
    let closestDb = DB_VALUES[0];
    let minDistanceY = Infinity;
    // Audiologists test at 5 dB steps. Let's include 5 dB intervals for selection.
    for (let db = -10; db <= 120; db += 5) {
      const dist = Math.abs(getY(db) - svgY);
      if (dist < minDistanceY) {
        minDistanceY = dist;
        closestDb = db;
      }
    }

    // Only show hover state if within responsive area of the grid
    if (
      svgX >= PADDING_LEFT - 15 &&
      svgX <= WIDTH - PADDING_RIGHT + 15 &&
      svgY >= PADDING_TOP - 15 &&
      svgY <= HEIGHT - PADDING_BOTTOM + 15
    ) {
      setHoveredPoint({ freq: closestFreq, db: closestDb });
    } else {
      setHoveredPoint(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const handleChartClick = () => {
    if (hoveredPoint) {
      // Toggle value: if they click on the same value again, it clears it
      const currentVal = data[hoveredPoint.freq][activeInputType].db;
      if (currentVal === hoveredPoint.db) {
        onPointChange(hoveredPoint.freq, activeInputType, '');
      } else {
        onPointChange(hoveredPoint.freq, activeInputType, hoveredPoint.db);
      }
    }
  };

  const color = isRight ? '#ef4444' : '#3b82f6'; // red or blue

  // Generate paths for connection lines
  const getLinePath = (type: 'air' | 'bone') => {
    const points: { x: number; y: number }[] = [];
    FREQUENCIES.forEach((freq) => {
      const db = data[freq][type].db;
      if (db !== '') {
        points.push({ x: getX(freq), y: getY(Number(db)) });
      }
    });

    if (points.length < 2) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const airPath = getLinePath('air');
  const bonePath = getLinePath('bone');

  const renderSymbol = (type: 'air' | 'bone', masked: boolean, x: number, y: number) => {
    const strokeWidth = 2.5;
    if (type === 'air') {
      if (!masked) {
        // Right is Circle, Left is X
        return isRight ? (
          <circle cx={x} cy={y} r="6" fill="none" stroke={color} strokeWidth={strokeWidth} />
        ) : (
          <g>
            <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
            <line x1={x + 5} y1={y - 5} x2={x - 5} y2={y + 5} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
          </g>
        );
      } else {
        // Right is Triangle, Left is Square
        return isRight ? (
          <polygon points={`${x},${y - 7} ${x - 6},${y + 4} ${x + 6},${y + 4}`} fill="none" stroke={color} strokeWidth={strokeWidth} />
        ) : (
          <rect x={x - 5} y={y - 5} width="10" height="10" fill="none" stroke={color} strokeWidth={strokeWidth} />
        );
      }
    } else {
      // Bone
      if (!masked) {
        // Right is <, Left is >
        return isRight ? (
          <polyline points={`${x + 4},${y - 6} ${x - 2},${y} ${x + 4},${y + 6}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <polyline points={`${x - 4},${y - 6} ${x + 2},${y} ${x - 4},${y + 6}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        );
      } else {
        // Right is [, Left is ]
        return isRight ? (
          <polyline points={`${x + 3},${y - 6} ${x - 3},${y - 6} ${x - 3},${y + 6} ${x + 3},${y + 6}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <polyline points={`${x - 3},${y - 6} ${x + 3},${y - 6} ${x + 3},${y + 6} ${x - 3},${y + 6}`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        );
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h3 style={{ margin: '0 0 10px', color: color, fontSize: '18px', fontWeight: 600 }}>
        {isRight ? 'Right Ear' : 'Left Ear'}
      </h3>
      <div className="audiogram-chart-wrapper" style={{ position: 'relative', background: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f0f0f0' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ cursor: 'crosshair', userSelect: 'none', display: 'block' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleChartClick}
        >
          {/* Vertical Normal Hearing Line & Text on Left Margin */}
          <g>
            <line
              x1={PADDING_LEFT - 32}
              y1={getY(-10)}
              x2={PADDING_LEFT - 32}
              y2={getY(20)}
              stroke="#22c55e"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Small horizontal ticks at start and end of normal hearing range */}
            <line
              x1={PADDING_LEFT - 35}
              y1={getY(-10)}
              x2={PADDING_LEFT - 29}
              y2={getY(-10)}
              stroke="#22c55e"
              strokeWidth="2"
            />
            <line
              x1={PADDING_LEFT - 35}
              y1={getY(20)}
              x2={PADDING_LEFT - 29}
              y2={getY(20)}
              stroke="#22c55e"
              strokeWidth="2"
            />
            <text
              transform={`translate(${PADDING_LEFT - 40}, ${(getY(-10) + getY(20)) / 2}) rotate(-90)`}
              textAnchor="middle"
              fill="#22c55e"
              fontSize="9"
              fontWeight="600"
              letterSpacing="0.5"
            >
              Normal Hearing
            </text>
          </g>

          {/* Grid lines - horizontal (dB) */}
          {DB_VALUES.map((db) => {
            const y = getY(db);
            const isMajor = db === 0 || db === 20 || db === 40 || db === 90;
            return (
              <g key={`y-grid-${db}`}>
                <line
                  x1={PADDING_LEFT}
                  y1={y}
                  x2={WIDTH - PADDING_RIGHT}
                  y2={y}
                  stroke={isMajor ? '#e2e8f0' : '#f1f5f9'}
                  strokeWidth={isMajor ? 1.5 : 1}
                />
                <text
                  x={PADDING_LEFT - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                  fontWeight={isMajor ? '600' : '400'}
                >
                  {db}
                </text>
              </g>
            );
          })}

          {/* Grid lines - vertical (frequencies) */}
          {FREQUENCIES.map((freq) => {
            const x = getX(freq);
            return (
              <g key={`x-grid-${freq}`}>
                <line
                  x1={x}
                  y1={PADDING_TOP}
                  x2={x}
                  y2={HEIGHT - PADDING_BOTTOM}
                  stroke="#e2e8f0"
                  strokeWidth="1.2"
                />
                <text
                  x={x}
                  y={PADDING_TOP - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="#475569"
                >
                  {freq >= 1000 ? `${freq / 1000}k` : freq}
                </text>
                <text
                  x={x}
                  y={HEIGHT - PADDING_BOTTOM + 20}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="#94a3b8"
                >
                  {freq}Hz
                </text>
              </g>
            );
          })}

          {/* Connecting lines for Air conduction */}
          {airPath && (
            <path
              d={airPath}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Connecting lines for Bone conduction (dashed line) */}
          {bonePath && (
            <path
              d={bonePath}
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeDasharray="5,5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Plotted points for Air conduction */}
          {FREQUENCIES.map((freq) => {
            const point = data[freq].air;
            if (point.db !== '') {
              const x = getX(freq);
              const y = getY(Number(point.db));
              return (
                <g key={`symbol-air-${freq}`} style={{ transition: 'all 0.2s' }}>
                  {renderSymbol('air', point.masked, x, y)}
                </g>
              );
            }
            return null;
          })}

          {/* Plotted points for Bone conduction */}
          {FREQUENCIES.map((freq) => {
            const point = data[freq].bone;
            if (point.db !== '') {
              const x = getX(freq);
              const y = getY(Number(point.db));
              return (
                <g key={`symbol-bone-${freq}`} style={{ transition: 'all 0.2s' }}>
                  {renderSymbol('bone', point.masked, x, y)}
                </g>
              );
            }
            return null;
          })}

          {/* Hover indicator crosshair & tooltip inside SVG */}
          {hoveredPoint && (
            <g pointerEvents="none">
              <line
                x1={PADDING_LEFT}
                y1={getY(hoveredPoint.db)}
                x2={WIDTH - PADDING_RIGHT}
                y2={getY(hoveredPoint.db)}
                stroke={color}
                strokeWidth="0.8"
                strokeDasharray="2,2"
                style={{ opacity: 0.6 }}
              />
              <line
                x1={getX(hoveredPoint.freq)}
                y1={PADDING_TOP}
                x2={getX(hoveredPoint.freq)}
                y2={HEIGHT - PADDING_BOTTOM}
                stroke={color}
                strokeWidth="0.8"
                strokeDasharray="2,2"
                style={{ opacity: 0.6 }}
              />
              {/* Highlight crosshair point */}
              <circle
                cx={getX(hoveredPoint.freq)}
                cy={getY(hoveredPoint.db)}
                r="5"
                fill={color}
                style={{ opacity: 0.4 }}
              />
              {/* Tooltip Box */}
              <rect
                x={getX(hoveredPoint.freq) > WIDTH - 100 ? getX(hoveredPoint.freq) - 95 : getX(hoveredPoint.freq) + 10}
                y={getY(hoveredPoint.db) > HEIGHT - 50 ? getY(hoveredPoint.db) - 45 : getY(hoveredPoint.db) + 10}
                width="85"
                height="32"
                rx="4"
                fill="#1e293b"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
              />
              <text
                x={getX(hoveredPoint.freq) > WIDTH - 100 ? getX(hoveredPoint.freq) - 90 + 42 : getX(hoveredPoint.freq) + 15 + 38}
                y={getY(hoveredPoint.db) > HEIGHT - 50 ? getY(hoveredPoint.db) - 34 + 10 : getY(hoveredPoint.db) + 21 + 10}
                fill="#ffffff"
                fontSize="9.5"
                fontWeight="500"
                textAnchor="middle"
              >
                {hoveredPoint.freq}Hz, {hoveredPoint.db}dB
              </text>
            </g>
          )}

          {/* Chart Border */}
          <rect
            x={PADDING_LEFT}
            y={PADDING_TOP}
            width={GRID_WIDTH}
            height={GRID_HEIGHT}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#64748b', textAlign: 'center', maxWidth: '380px', lineHeight: '1.4' }}>
        <span>Click on grid intersections to plot/adjust points. Hover shows frequency &amp; level.</span>
      </div>
    </div>
  );
};
