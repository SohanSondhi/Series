import { useEffect, useRef, useState } from 'react';

interface ScrollableCurvedLinesProps {
    scrollContainerRef: React.RefObject<HTMLDivElement>;
    side: 'left' | 'right';
}

export default function ScrollableCurvedLines({ scrollContainerRef, side }: ScrollableCurvedLinesProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const scrollHeight = container.scrollHeight - container.clientHeight;
            const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
            setScrollProgress(progress);
        };

        container.addEventListener('scroll', handleScroll);
        handleScroll(); // Initial call

        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [scrollContainerRef]);

    // Generate looping curved paths
    const generateLoopingPath = (centerX: number, centerY: number, radius: number, points: number = 6) => {
        const path: string[] = [];
        const angleStep = (Math.PI * 2) / points;

        const pointsArray: Array<{ x: number; y: number }> = [];

        for (let i = 0; i < points; i++) {
            const angle = i * angleStep;
            const r = radius + (Math.random() - 0.5) * radius * 0.2;
            pointsArray.push({
                x: centerX + r * Math.cos(angle),
                y: centerY + r * Math.sin(angle),
            });
        }

        path.push(`M ${pointsArray[0].x} ${pointsArray[0].y}`);

        // Create smooth curved connections
        for (let i = 1; i < pointsArray.length; i++) {
            const prev = pointsArray[i - 1];
            const curr = pointsArray[i];
            const next = pointsArray[(i + 1) % pointsArray.length];

            const dx1 = (curr.x - prev.x) * 0.5;
            const dy1 = (curr.y - prev.y) * 0.5;
            const dx2 = (next.x - curr.x) * 0.3;
            const dy2 = (next.y - curr.y) * 0.3;

            const cp1x = prev.x + dx1;
            const cp1y = prev.y + dy1;
            const cp2x = curr.x - dx2;
            const cp2y = curr.y - dy2;

            path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`);
        }

        // Close the loop
        const last = pointsArray[pointsArray.length - 1];
        const first = pointsArray[0];
        const second = pointsArray[1];

        const dx1 = (first.x - last.x) * 0.5;
        const dy1 = (first.y - last.y) * 0.5;
        const dx2 = (second.x - first.x) * 0.3;
        const dy2 = (second.y - first.y) * 0.3;

        const cp1x = last.x + dx1;
        const cp1y = last.y + dy1;
        const cp2x = first.x - dx2;
        const cp2y = first.y - dy2;

        path.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${first.x} ${first.y}`);
        path.push('Z');

        return path.join(' ');
    };

    // Generate looping paths positioned on the left or right side
    const paths = [];
    const pathCount = 5;
    const viewBoxHeight = 2000;

    for (let i = 0; i < pathCount; i++) {
        const yCenter = (viewBoxHeight / pathCount) * i + (viewBoxHeight / pathCount) / 2;
        const xCenter = side === 'left' ? 75 : 125;
        const radius = 40 + Math.random() * 30;

        paths.push({
            d: generateLoopingPath(xCenter, yCenter, radius, 6),
            index: i,
        });
    }

    return (
        <div ref={containerRef} className={`curved-lines-side curved-lines-side--${side}`}>
            <svg
                ref={svgRef}
                className="curved-lines-side__svg"
                viewBox={`0 0 200 ${viewBoxHeight}`}
                preserveAspectRatio="xMidYMid meet"
            >
                {paths.map((path, index) => {
                    // Calculate scroll progress for this path
                    const pathStart = index / pathCount;
                    const pathEnd = (index + 1) / pathCount;
                    const pathProgress = Math.max(0, Math.min(1, (scrollProgress - pathStart) / (pathEnd - pathStart)));

                    // Draw forward, then erase backward (loop effect)
                    let drawProgress = 0;
                    if (pathProgress < 0.5) {
                        // Drawing phase
                        drawProgress = pathProgress * 2;
                    } else {
                        // Erasing phase
                        drawProgress = 2 - (pathProgress * 2);
                    }

                    return (
                        <path
                            key={index}
                            className={`curved-lines-side__path curved-lines-side__path--${index + 1}`}
                            d={path.d}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="2.5"
                            opacity="0.6"
                            strokeDasharray="1000"
                            strokeDashoffset={1000 * (1 - drawProgress)}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    );
                })}
            </svg>
        </div>
    );
}
