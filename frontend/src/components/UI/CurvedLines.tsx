import { useEffect, useRef, useState } from 'react';

export default function CurvedLines() {
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

    // Generate looping curved paths that move in random directions
    const generateLoopingPath = (centerX: number, centerY: number, radius: number, angleOffset: number = 0) => {
        // Create a looping path that goes around in a circle with curves
        const points = 8; // Number of points in the loop
        const path: string[] = [];
        const angleStep = (Math.PI * 2) / points;

        const pointsArray: Array<{ x: number; y: number }> = [];

        for (let i = 0; i < points; i++) {
            const angle = i * angleStep + angleOffset;
            const r = radius + (Math.random() - 0.5) * radius * 0.3; // Vary radius slightly
            pointsArray.push({
                x: centerX + r * Math.cos(angle),
                y: centerY + r * Math.sin(angle),
            });
        }

        // Start at first point
        path.push(`M ${pointsArray[0].x} ${pointsArray[0].y}`);

        // Create smooth curved connections
        for (let i = 1; i < pointsArray.length; i++) {
            const prev = pointsArray[i - 1];
            const curr = pointsArray[i];
            const next = pointsArray[(i + 1) % pointsArray.length];

            // Control points for smooth curves
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

    // Generate multiple looping paths distributed across the screen
    const paths = [];
    const pathCount = 8;

    // Use a grid-based approach to ensure even distribution
    const cols = 3;
    const rows = 3;
    const cellWidth = 1000 / cols;
    const cellHeight = 1000 / rows;

    // Predefined positions to ensure good distribution
    const positions = [
        { x: cellWidth * 0.5, y: cellHeight * 0.5 },      // Top-left
        { x: cellWidth * 1.5, y: cellHeight * 0.5 },      // Top-center
        { x: cellWidth * 2.5, y: cellHeight * 0.5 },      // Top-right
        { x: cellWidth * 0.5, y: cellHeight * 1.5 },      // Middle-left
        { x: cellWidth * 2.5, y: cellHeight * 1.5 },     // Middle-right
        { x: cellWidth * 0.5, y: cellHeight * 2.5 },      // Bottom-left
        { x: cellWidth * 1.5, y: cellHeight * 2.5 },      // Bottom-center
        { x: cellWidth * 2.5, y: cellHeight * 2.5 },      // Bottom-right
    ];

    for (let i = 0; i < pathCount; i++) {
        const pos = positions[i];
        // Add some randomness within each cell to avoid perfect grid
        const centerX = pos.x + (Math.random() - 0.5) * cellWidth * 0.3;
        const centerY = pos.y + (Math.random() - 0.5) * cellHeight * 0.3;
        const radius = 180 + Math.random() * 120; // Slightly smaller but still visible
        const angleOffset = Math.random() * Math.PI * 2;

        paths.push({
            d: generateLoopingPath(centerX, centerY, radius, angleOffset),
            delay: i * 0.5,
            translateX: (Math.random() - 0.5) * 150,
            translateY: (Math.random() - 0.5) * 150,
        });
    }

    return (
        <div ref={containerRef} className="curved-lines">
            <svg
                ref={svgRef}
                className="curved-lines__svg"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="xMidYMid meet"
            >
                {isVisible && paths.map((path, index) => (
                    <g
                        key={index}
                        className={`curved-lines__group curved-lines__group--${index + 1}`}
                    >
                        <path
                            className={`curved-lines__path curved-lines__path--${index + 1}`}
                            d={path.d}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="3"
                            opacity="0.6"
                        />
                    </g>
                ))}
            </svg>
        </div>
    );
}
