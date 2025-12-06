import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    className?: string;
}

export default function AnimatedNumber({ value, duration = 1000, className = '' }: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const [hasReachedTarget, setHasReachedTarget] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const startTimeRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number>();
    const elementRef = useRef<HTMLDivElement>(null);

    // Intersection Observer to trigger animation when visible
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

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => {
            if (elementRef.current) {
                observer.unobserve(elementRef.current);
            }
        };
    }, [isVisible]);

    useEffect(() => {
        if (!isVisible) return;

        setHasReachedTarget(false);
        setDisplayValue(0);
        startTimeRef.current = null;

        const animate = (currentTime: number) => {
            if (startTimeRef.current === null) {
                startTimeRef.current = currentTime;
            }

            const elapsed = currentTime - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(easeOutCubic * value);

            setDisplayValue(currentValue);

            if (progress >= 1) {
                setDisplayValue(value);
                setHasReachedTarget(true);
            } else {
                animationFrameRef.current = requestAnimationFrame(animate);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [value, duration, isVisible]);

    return (
        <div
            ref={elementRef}
            className={`animated-number ${hasReachedTarget ? 'animated-number--complete' : ''} ${className}`}
        >
            {displayValue.toLocaleString()}
        </div>
    );
}
