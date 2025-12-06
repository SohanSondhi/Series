import { useEffect, useRef, useState, useMemo } from 'react';

const colors = [
    'rgba(99, 102, 241, 0.15)', // indigo
    'rgba(139, 92, 246, 0.15)', // purple
    'rgba(236, 72, 153, 0.15)', // pink
    'rgba(59, 130, 246, 0.15)', // blue
    'rgba(34, 197, 94, 0.15)',  // green
];

export default function GradientOrbs({ count = 5 }: { count?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible) {
                        setIsVisible(true);
                    }
                });
            },
            { threshold: 0.1 }
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

    const orbs = useMemo(() => {
        return Array.from({ length: count }, (_, i) => {
            const size = 150 + Math.random() * 200;
            return {
                id: `orb-${i}`,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size,
                color: colors[i % colors.length],
            };
        });
    }, [count]);

    return (
        <div ref={containerRef} className="gradient-orbs">
            {isVisible && orbs.map((orb) => (
                <div
                    key={orb.id}
                    className="gradient-orbs__orb"
                    style={{
                        left: `${orb.x}%`,
                        top: `${orb.y}%`,
                        width: `${orb.size}px`,
                        height: `${orb.size}px`,
                        background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                        transform: 'translate(-50%, -50%)',
                    }}
                />
            ))}
        </div>
    );
}
