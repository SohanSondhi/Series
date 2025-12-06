import { useEffect, useRef, useState } from 'react';

export default function PulsatingNodes() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const nodeCount = 8;

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

    // Generate nodes randomly positioned, avoiding center content area
    const nodes = Array.from({ length: nodeCount }, (_, i) => {
        const rand = Math.random();
        let top: string;
        let left: string;

        // Place nodes in outer areas to avoid center where summary grid is
        if (rand < 0.33) {
            // Top area (5-25%)
            top = `${5 + Math.random() * 20}%`;
            left = `${5 + Math.random() * 90}%`;
        } else if (rand < 0.66) {
            // Bottom area (75-95%)
            top = `${75 + Math.random() * 20}%`;
            left = `${5 + Math.random() * 90}%`;
        } else {
            // Left or right side areas
            top = `${5 + Math.random() * 90}%`;
            if (Math.random() < 0.5) {
                // Left side (5-25%)
                left = `${5 + Math.random() * 20}%`;
            } else {
                // Right side (75-95%)
                left = `${75 + Math.random() * 20}%`;
            }
        }

        return {
            id: `node-${i}`,
            top,
            left,
            delay: i * 0.3,
        };
    });

    return (
        <div ref={containerRef} className="pulsating-nodes">
            {isVisible && nodes.map((node) => (
                <div
                    key={node.id}
                    className="pulsating-nodes__node"
                    style={{
                        top: node.top,
                        left: node.left,
                        animationDelay: `${node.delay}s`,
                    }}
                >
                    <div className="pulsating-nodes__haze"></div>
                    <div className="pulsating-nodes__circle"></div>
                </div>
            ))}
        </div>
    );
}
