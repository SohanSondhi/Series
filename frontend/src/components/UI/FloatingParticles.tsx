import { useEffect, useRef, useState, useMemo } from 'react';

interface Particle {
    id: string;
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
}

export default function FloatingParticles({ count = 15 }: { count?: number }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number>();
    const [isVisible, setIsVisible] = useState(false);
    const [particles, setParticles] = useState<Particle[]>([]);

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

    // Initialize particles
    const initialParticles = useMemo(() => {
        return Array.from({ length: count }, (_, i) => {
            const size = 2 + Math.random() * 4;
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.2 + Math.random() * 0.3;
            return {
                id: `particle-${i}`,
                x: Math.random() * 100,
                y: Math.random() * 100,
                size,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                opacity: 0.3 + Math.random() * 0.4,
            };
        });
    }, [count]);

    useEffect(() => {
        if (isVisible && particles.length === 0) {
            setParticles(initialParticles);
        }
    }, [isVisible, initialParticles, particles.length]);

    useEffect(() => {
        if (!isVisible || particles.length === 0) return;

        const animate = () => {
            setParticles(prevParticles =>
                prevParticles.map(particle => {
                    let newX = particle.x + particle.speedX;
                    let newY = particle.y + particle.speedY;

                    // Wrap around edges
                    if (newX > 100) newX = 0;
                    if (newX < 0) newX = 100;
                    if (newY > 100) newY = 0;
                    if (newY < 0) newY = 100;

                    return {
                        ...particle,
                        x: newX,
                        y: newY,
                    };
                })
            );

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isVisible, particles.length]);

    return (
        <div ref={containerRef} className="floating-particles">
            {isVisible && particles.map((particle) => (
                <div
                    key={particle.id}
                    className="floating-particles__particle"
                    style={{
                        left: `${particle.x}%`,
                        top: `${particle.y}%`,
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        opacity: particle.opacity,
                    }}
                />
            ))}
        </div>
    );
}
