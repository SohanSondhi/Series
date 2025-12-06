import { useEffect, useRef, useState } from 'react';

export default function RippleEffect() {
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

    return (
        <div ref={containerRef} className="ripple-effect">
            {isVisible && (
                <>
                    <div className="ripple-effect__ripple ripple-effect__ripple--1"></div>
                    <div className="ripple-effect__ripple ripple-effect__ripple--2"></div>
                    <div className="ripple-effect__ripple ripple-effect__ripple--3"></div>
                </>
            )}
        </div>
    );
}
