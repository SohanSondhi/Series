import { useEffect, useRef, useState } from 'react';

export default function StarDrawing() {
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

    // Create star path with smooth curved lines
    const createStarPath = (centerX: number, centerY: number, outerRadius: number, innerRadius: number, points: number) => {
        const path: string[] = [];
        const angleStep = (Math.PI * 2) / points;
        const pointsArray: Array<{ x: number; y: number }> = [];

        // Calculate all star points
        for (let i = 0; i < points * 2; i++) {
            const angle = i * angleStep - Math.PI / 2;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            pointsArray.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            });
        }

        // Start at first point
        path.push(`M ${pointsArray[0].x} ${pointsArray[0].y}`);

        // Draw curved lines between points
        for (let i = 1; i < pointsArray.length; i++) {
            const prev = pointsArray[i - 1];
            const curr = pointsArray[i];
            const next = pointsArray[(i + 1) % pointsArray.length];

            // Calculate control points for smooth curves
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

        // Close the path with a curve back to start
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

    return (
        <div ref={containerRef} className="star-drawing">
            <svg
                ref={svgRef}
                className="star-drawing__svg"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="xMidYMid meet"
            >
                {isVisible && (
                    <>
                        {/* Multiple stars at different positions */}
                        <path
                            className="star-drawing__path star-drawing__path--1"
                            d={createStarPath(200, 200, 80, 40, 5)}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="2"
                            opacity="0.6"
                        />
                        <path
                            className="star-drawing__path star-drawing__path--2"
                            d={createStarPath(800, 300, 100, 50, 5)}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="2"
                            opacity="0.5"
                        />
                        <path
                            className="star-drawing__path star-drawing__path--3"
                            d={createStarPath(500, 700, 90, 45, 5)}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="2"
                            opacity="0.4"
                        />
                        <path
                            className="star-drawing__path star-drawing__path--4"
                            d={createStarPath(150, 800, 70, 35, 5)}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="2"
                            opacity="0.5"
                        />
                        <path
                            className="star-drawing__path star-drawing__path--5"
                            d={createStarPath(850, 750, 85, 42, 5)}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="2"
                            opacity="0.4"
                        />
                    </>
                )}
            </svg>
        </div>
    );
}
