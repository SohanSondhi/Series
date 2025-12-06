import { useEffect, useState, useRef } from 'react';

interface AnimatedTextProps {
    text: string;
    className?: string;
    delay?: number;
    onComplete?: () => void;
    scrollContainerRef?: React.RefObject<HTMLDivElement>;
}

export default function AnimatedText({ text, className = '', delay = 0, onComplete, scrollContainerRef }: AnimatedTextProps) {
    const [visibleChars, setVisibleChars] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [scrollSettled, setScrollSettled] = useState(false);
    const elementRef = useRef<HTMLHeadingElement>(null);
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Wait for scroll to settle before starting animation
    useEffect(() => {
        const checkScrollSettled = () => {
            // Clear any existing timeout
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }

            // Set a new timeout - if no scroll happens for 500ms, consider it settled
            scrollTimeoutRef.current = setTimeout(() => {
                setScrollSettled(true);
            }, 500);
        };

        // Get the scroll container (either provided ref or window)
        const scrollElement = scrollContainerRef?.current || window;

        // Initial check after a delay to allow initial render/scroll
        const initialDelay = setTimeout(() => {
            // Check if we're at the top of the scroll container
            if (scrollContainerRef?.current) {
                const container = scrollContainerRef.current;
                // Wait for any initial scroll to complete, then check position
                // If scroll position is at or near the top (within 10px), consider it settled
                const checkPosition = () => {
                    if (container.scrollTop <= 10) {
                        setScrollSettled(true);
                    } else {
                        // Still scrolling, wait a bit more
                        checkScrollSettled();
                    }
                };
                // Give extra time for any initial scroll animation to complete
                setTimeout(checkPosition, 600);
            } else {
                checkScrollSettled();
            }
        }, 1000); // Give time for initial render and any scroll to complete

        // Listen for scroll events on the container
        const handleScroll = () => {
            if (scrollContainerRef?.current) {
                const container = scrollContainerRef.current;
                // If we're at the top, scroll is settled
                if (container.scrollTop <= 10) {
                    setScrollSettled(true);
                } else {
                    checkScrollSettled();
                }
            } else {
                checkScrollSettled();
            }
        };

        scrollElement.addEventListener('scroll', handleScroll, { passive: true });

        // Also check on scrollend if supported
        if ('onscrollend' in scrollElement) {
            scrollElement.addEventListener('scrollend', () => {
                setScrollSettled(true);
            }, { passive: true });
        }

        return () => {
            clearTimeout(initialDelay);
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            scrollElement.removeEventListener('scroll', handleScroll);
            if ('onscrollend' in scrollElement) {
                scrollElement.removeEventListener('scrollend', () => {
                    setScrollSettled(true);
                });
            }
        };
    }, [scrollContainerRef]);

    // Intersection Observer to trigger animation when visible AND scroll is settled
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && !isVisible && scrollSettled) {
                        setIsVisible(true);
                    }
                });
            },
            { threshold: 0.5 }
        );

        const currentElement = elementRef.current;
        if (currentElement) {
            observer.observe(currentElement);
        }

        return () => {
            if (currentElement) {
                observer.unobserve(currentElement);
            }
        };
    }, [isVisible, scrollSettled]);

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
                    // Animation complete, wait 3 seconds then call onComplete to ensure all text is visible
                    if (onComplete) {
                        setTimeout(() => {
                            onComplete();
                        }, 3000);
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
