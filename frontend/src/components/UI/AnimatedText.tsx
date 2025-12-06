import { useEffect, useState, useRef } from 'react';

interface AnimatedTextProps {
    text: string;
    className?: string;
    delay?: number;
    onComplete?: () => void;
}

export default function AnimatedText({ text, className = '', delay = 0, onComplete }: AnimatedTextProps) {
    const [visibleChars, setVisibleChars] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const elementRef = useRef<HTMLHeadingElement>(null);

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

        const timer = setTimeout(() => {
            let currentIndex = 0;
            const interval = setInterval(() => {
                if (currentIndex < text.length) {
                    setVisibleChars(currentIndex + 1);
                    currentIndex++;
                } else {
                    clearInterval(interval);
                    // Animation complete, wait 2 seconds then call onComplete
                    if (onComplete) {
                        setTimeout(() => {
                            onComplete();
                        }, 2000);
                    }
                }
            }, 80); // Speed of letter appearance

            return () => clearInterval(interval);
        }, delay);

        return () => clearTimeout(timer);
    }, [text, delay, isVisible, onComplete]);

    return (
        <h2 ref={elementRef} className={className}>
            {text.split('').map((char, index) => (
                <span
                    key={index}
                    className={`animated-text__char ${index < visibleChars ? 'animated-text__char--visible' : ''}`}
                    style={{ animationDelay: `${index * 0.08}s` }}
                >
                    {char === ' ' ? '\u00A0' : char}
                </span>
            ))}
        </h2>
    );
}
