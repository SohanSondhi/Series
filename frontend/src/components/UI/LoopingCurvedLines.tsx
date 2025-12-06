import { useEffect, useRef, useState } from 'react';

interface LoopingCurvedLinesProps {
    side: 'left' | 'right';
}

export default function LoopingCurvedLines({ side }: LoopingCurvedLinesProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                    }
                });
            },
            { threshold: 0.5 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, [isVisible]);

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

    // Generate looping paths positioned on the left or right side, avoiding center content
    const paths = [];
    const pathCount = 3; // Reduced to 3 lines
    const viewBoxHeight = 1000;
    const viewBoxWidth = 400; // Wider viewBox for larger lines

    for (let i = 0; i < pathCount; i++) {
        // Random Y position across the height, avoiding center area
        const yCenter = 150 + Math.random() * (viewBoxHeight - 300);

        // Position on the very outer edges to avoid center content (600px container is centered)
        // Left side: position in leftmost 10% of viewBox
        // Right side: position in rightmost 10% of viewBox
        const xCenter = side === 'left'
            ? 20 + Math.random() * 20  // Left side: 20-40px range (very close to edge)
            : 360 + Math.random() * 20; // Right side: 360-380px range (very close to edge)

        const radius = 100 + Math.random() * 60; // Large radius (100-160px)

        paths.push({
            d: generateLoopingPath(xCenter, yCenter, radius, 6),
            index: i,
        });
    }

    return (
        <div ref={containerRef} className={`looping-curved-lines looping-curved-lines--${side}`}>
            <svg
                ref={svgRef}
                className="looping-curved-lines__svg"
                viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
                preserveAspectRatio="xMidYMid meet"
            >
                {isVisible && paths.map((path, index) => (
                    <path
                        key={index}
                        className={`looping-curved-lines__path looping-curved-lines__path--${index + 1}`}
                        d={path.d}
                        fill="none"
                        stroke="#000000"
                        strokeWidth="4"
                        opacity="0.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
            </svg>
        </div>
    );
}
